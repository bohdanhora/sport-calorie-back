import { BadGatewayException, Injectable, Logger } from '@nestjs/common';

import type { ProviderCredentials } from './nutrition-provider.service';

const REQUEST_TIMEOUT_MS = 25_000;
const UNAUTHORISED = 401;
const BAD_REQUEST = 400;
const ERROR_SNIPPET_LENGTH = 500;

export type MessageContent =
  string | ({ type: 'text'; text: string } | { type: 'image_url'; image_url: { url: string } })[];

export interface ChatMessage {
  role: string;
  content: MessageContent;
}

interface ChatCompletionResponse {
  choices?: { message?: { content?: string } }[];
}

/**
 * One place that talks to an OpenAI compatible chat endpoint. Both the food and
 * the activity parsers want the same behaviour around it: ask for JSON, retry
 * without that flag for providers that reject the parameter, and turn every
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
    let response = await this.send(credentials, { messages, jsonMode: true, model });

    if (response.status === BAD_REQUEST) {
      this.logger.warn(`Provider refused JSON mode: ${await this.reason(response)}`);
      response = await this.send(credentials, { messages, jsonMode: false, model });
    }

    if (response.status === UNAUTHORISED) {
      throw new BadGatewayException('The provider rejected the API key');
    }

    if (!response.ok) {
      this.logger.warn(
        `Nutrition provider responded with ${response.status}: ${await this.reason(response)}`,
      );
      throw new BadGatewayException('The provider could not answer right now');
    }

    const payload = (await response.json()) as ChatCompletionResponse;
    const content = payload.choices?.[0]?.message?.content;

    if (!content) {
      throw new BadGatewayException('The provider returned an empty answer');
    }

    return content;
  }

  /**
   * What the provider said went wrong. Only ever reaches the log: the body is
   * the provider's prose, not something to hand a client, but without it a
   * refusal is a bare status code and nobody can tell why the photo failed.
   */
  private async reason(response: Response): Promise<string> {
    try {
      return (await response.text()).trim().slice(0, ERROR_SNIPPET_LENGTH) || '(empty body)';
    } catch {
      return '(unreadable body)';
    }
  }

  private async send(
    credentials: ProviderCredentials,
    options: { messages: ChatMessage[]; jsonMode: boolean; model?: string },
  ): Promise<Response> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

    try {
      return await fetch(`${credentials.baseUrl}/chat/completions`, {
        method: 'POST',
        signal: controller.signal,
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${credentials.apiKey}`,
        },
        body: JSON.stringify({
          model: options.model ?? credentials.modelName,
          temperature: 0,
          messages: options.messages,
          ...(options.jsonMode ? { response_format: { type: 'json_object' } } : {}),
        }),
      });
    } catch {
      throw new BadGatewayException('The provider did not respond in time');
    } finally {
      clearTimeout(timeout);
    }
  }
}
