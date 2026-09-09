import { BadGatewayException, Injectable, Logger } from '@nestjs/common';
import { setTimeout as sleep } from 'node:timers/promises';

import type { ProviderCredentials } from './nutrition-provider.service';
import { aboutJsonMode, describeFailure, isRetryable, retryAfterSeconds } from './provider-failure';

const TEXT_TIMEOUT_MS = 25_000;
/**
 * A photograph is an order of magnitude more tokens than a sentence, and the
 * model reads it before it writes a word. The budget that is generous for text
 * cuts a picture off mid-thought, which is why the camera failed while typing
 * the same meal worked.
 */
const IMAGE_TIMEOUT_MS = 60_000;
const RETRY_DELAY_MS = 1_500;
/**
 * A ceiling on the answer. Without one a provider assumes the model's whole
 * output window - tens of thousands of tokens - and charges that against the
 * per minute output budget before it writes a word, which is what returned
 * "Request too large ... on output tokens per minute" for a request whose real
 * answer is a hundred tokens of JSON. The room is for the <think> block the
 * model opens with; the object itself is small.
 */
const TEXT_MAX_TOKENS = 1_200;
const IMAGE_MAX_TOKENS = 1_600;
const MS_PER_SECOND = 1_000;
const UNAUTHORISED = 401;
const BAD_REQUEST = 400;
const ERROR_SNIPPET_LENGTH = 500;
const BYTES_PER_KB = 1024;

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
  jsonMode: boolean;
  model: string;
  timeoutMs: number;
  maxTokens: number;
  label: string;
}

/** An answer that arrived, whatever it says. The body is read once, here, so
 * that both the log and the client can have it. */
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

/**
 * One place that talks to an OpenAI compatible chat endpoint. Both the food and
 * the activity parsers want the same behaviour around it: ask for JSON, retry
 * without that flag for providers that reject the parameter, give a photo the
 * time it needs, ask once more when the provider is merely busy, and turn every
 * failure into something the client can act on.
 */
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
    const attempt: Attempt = {
      messages,
      jsonMode: true,
      model: modelName,
      timeoutMs: photo ? IMAGE_TIMEOUT_MS : TEXT_TIMEOUT_MS,
      maxTokens: photo ? IMAGE_MAX_TOKENS : TEXT_MAX_TOKENS,
      label: photo ? `${modelName} on a photo` : modelName,
    };

    let reply = await this.ask(credentials, attempt);

    if (reply.status === BAD_REQUEST && aboutJsonMode(reply.body)) {
      this.logger.warn(
        `${attempt.label}: the provider refused JSON mode, asking again without it: ${snippet(reply.body)}`,
      );
      reply = await this.ask(credentials, { ...attempt, jsonMode: false });
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

  /**
   * The provider's answer, asked twice when the first refusal was one that
   * passes on its own - a rate limit, an overloaded model. A request that timed
   * out is not repeated: it would only spend the same minute again.
   */
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

    // A budget too small for the model's thinking truncates the JSON, which
    // reads downstream as a malformed answer rather than as the cause it is.
    if (choice?.finish_reason === RAN_OUT_OF_ROOM) {
      this.logger.warn(`${label}: the answer was cut off at the token ceiling`);

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
      temperature: 0,
      max_tokens: attempt.maxTokens,
      messages: attempt.messages,
      ...(attempt.jsonMode ? { response_format: { type: 'json_object' } } : {}),
    });
    const started = Date.now();

    try {
      const response = await fetch(`${credentials.baseUrl}/chat/completions`, {
        method: 'POST',
        signal: controller.signal,
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${credentials.apiKey}`,
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

      // Without this the log was silent and every cause - a timeout, DNS, a
      // dropped connection - reached the phone wearing the same sentence.
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
