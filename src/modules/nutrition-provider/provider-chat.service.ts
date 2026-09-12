import { BadGatewayException, Injectable, Logger } from '@nestjs/common';
import { setTimeout as sleep } from 'node:timers/promises';

import type { ProviderCredentials } from './nutrition-provider.service';
import { providerHeaders } from './provider-catalog';
import {
  describeFailure,
  isRetryable,
  refusedParameter,
  requiresMaxTokens,
  retryAfterSeconds,
  type RefusedParameter,
} from './provider-failure';

const TEXT_TIMEOUT_MS = 25_000;
const IMAGE_TIMEOUT_MS = 90_000;
const RETRY_DELAY_MS = 1_500;
const MS_PER_SECOND = 1_000;
const UNAUTHORISED = 401;
const BAD_REQUEST = 400;
const ERROR_SNIPPET_LENGTH = 500;
const BYTES_PER_KB = 1024;
const PARAMETER_RETRIES = 3;
const FALLBACK_MAX_TOKENS = 8_000;

export type MessageContent =
  string | ({ type: 'text'; text: string } | { type: 'image_url'; image_url: { url: string } })[];

export interface ChatMessage {
  role: string;
  content: MessageContent;
}

interface ChatCompletionResponse {
  choices?: { message?: { content?: string }; finish_reason?: string }[];
}

const RAN_OUT_OF_ROOM = 'length';

interface Attempt {
  messages: ChatMessage[];
  dropped: RefusedParameter[];
  maxTokens: number | null;
  model: string;
  timeoutMs: number;
  label: string;
}

interface ProviderReply {
  status: number;
  ok: boolean;
  body: string;
  retryAfter: number | null;
  ms: number;
}

const hasImage = (messages: ChatMessage[]): boolean =>
  messages.some(
    (message) =>
      Array.isArray(message.content) && message.content.some((part) => part.type === 'image_url'),
  );

const snippet = (body: string): string =>
  body.trim().slice(0, ERROR_SNIPPET_LENGTH) || '(empty body)';

@Injectable()
export class ProviderChatService {
  private readonly logger = new Logger(ProviderChatService.name);

  async complete(
    credentials: ProviderCredentials,
    messages: ChatMessage[],
    model?: string,
  ): Promise<string> {
    const modelName = model ?? credentials.modelName;
    const photo = hasImage(messages);
    let attempt: Attempt = {
      messages,
      dropped: [],
      maxTokens: null,
      model: modelName,
      timeoutMs: photo ? IMAGE_TIMEOUT_MS : TEXT_TIMEOUT_MS,
      label: photo ? `${modelName} on a photo` : modelName,
    };

    let reply = await this.ask(credentials, attempt);

    for (let retry = 0; retry < PARAMETER_RETRIES && reply.status === BAD_REQUEST; retry += 1) {
      if (attempt.maxTokens === null && requiresMaxTokens(reply.body)) {
        this.logger.warn(
          `${attempt.label}: the provider wants a ceiling on the answer, adding one`,
        );
        attempt = { ...attempt, maxTokens: FALLBACK_MAX_TOKENS };
      } else {
        const refused = refusedParameter(reply.body);

        if (!refused || attempt.dropped.includes(refused)) {
          break;
        }

        this.logger.warn(
          `${attempt.label}: the provider refused ${refused}, asking again without it: ${snippet(reply.body)}`,
        );
        attempt = { ...attempt, dropped: [...attempt.dropped, refused] };
      }

      reply = await this.ask(credentials, attempt);
    }

    if (reply.status === UNAUTHORISED) {
      this.logger.warn(`${attempt.label}: the provider rejected the API key`);
      throw new BadGatewayException('The provider rejected the API key');
    }

    if (!reply.ok) {
      this.logger.warn(
        `${attempt.label}: the provider answered ${reply.status} after ${reply.ms} ms: ${snippet(reply.body)}`,
      );
      throw new BadGatewayException(describeFailure(reply.status, reply.body, reply.retryAfter));
    }

    return this.readContent(reply, attempt.label);
  }

  private async ask(credentials: ProviderCredentials, attempt: Attempt): Promise<ProviderReply> {
    const reply = await this.send(credentials, attempt);

    if (!isRetryable(reply.status)) {
      return reply;
    }

    const wait = reply.retryAfter ? reply.retryAfter * MS_PER_SECOND : RETRY_DELAY_MS;

    this.logger.warn(
      `${attempt.label}: the provider answered ${reply.status}, asking again in ${wait} ms: ${snippet(reply.body)}`,
    );
    await sleep(wait);

    return this.send(credentials, attempt);
  }

  private readContent(reply: ProviderReply, label: string): string {
    let payload: ChatCompletionResponse;

    try {
      payload = JSON.parse(reply.body) as ChatCompletionResponse;
    } catch {
      this.logger.warn(
        `${label}: the provider answered with something that is not JSON: ${snippet(reply.body)}`,
      );
      throw new BadGatewayException('The provider returned an answer the app could not read');
    }

    const choice = payload.choices?.[0];

    if (choice?.finish_reason === RAN_OUT_OF_ROOM) {
      this.logger.warn(`${label}: the answer was cut off at the provider's own ceiling`);

      throw new BadGatewayException('The provider ran out of room before it finished the answer');
    }

    const content = choice?.message?.content;

    if (!content) {
      this.logger.warn(`${label}: the provider returned no message: ${snippet(reply.body)}`);
      throw new BadGatewayException('The provider returned an empty answer');
    }

    return content;
  }

  private async send(credentials: ProviderCredentials, attempt: Attempt): Promise<ProviderReply> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), attempt.timeoutMs);
    const body = JSON.stringify({
      model: attempt.model,
      messages: attempt.messages,
      ...(attempt.maxTokens === null ? {} : { max_tokens: attempt.maxTokens }),
      ...(attempt.dropped.includes('temperature') ? {} : { temperature: 0 }),
      ...(attempt.dropped.includes('response_format')
        ? {}
        : { response_format: { type: 'json_object' } }),
    });
    const started = Date.now();

    try {
      const response = await fetch(`${credentials.baseUrl}/chat/completions`, {
        method: 'POST',
        signal: controller.signal,
        headers: {
          'Content-Type': 'application/json',
          ...providerHeaders(credentials.baseUrl, credentials.apiKey),
        },
        body,
      });

      const text = await response.text();
      const ms = Date.now() - started;

      this.logger.debug(
        `${attempt.label}: sent ${Math.round(body.length / BYTES_PER_KB)} kB, answered ${response.status} in ${ms} ms`,
      );

      return {
        status: response.status,
        ok: response.ok,
        body: text,
        retryAfter: retryAfterSeconds(response.headers.get('retry-after')),
        ms,
      };
    } catch (error) {
      const ms = Date.now() - started;

      if (controller.signal.aborted) {
        this.logger.warn(`${attempt.label}: no answer within ${attempt.timeoutMs} ms`);

        throw new BadGatewayException(
          `The provider did not answer within ${attempt.timeoutMs / MS_PER_SECOND} s`,
        );
      }

      this.logger.warn(
        `${attempt.label}: the request failed after ${ms} ms: ${error instanceof Error ? error.message : String(error)}`,
      );

      throw new BadGatewayException('The app could not reach the provider');
    } finally {
      clearTimeout(timeout);
    }
  }
}
