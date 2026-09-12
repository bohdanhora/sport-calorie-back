const TOO_MANY_REQUESTS = 429;
const SERVER_ERROR = 500;
const DETAIL_LENGTH = 320;
const MAX_RETRY_WAIT_S = 10;

interface ProviderErrorBody {
  error?: { message?: unknown } | string;
  message?: unknown;
}

export type RefusedParameter = 'response_format' | 'temperature';

export const isRetryable = (status: number): boolean =>
  status === TOO_MANY_REQUESTS || status >= SERVER_ERROR;

export const retryAfterSeconds = (header: string | null): number | null => {
  if (!header) {
    return null;
  }

  const seconds = Number(header.trim());

  if (!Number.isFinite(seconds) || seconds <= 0 || seconds > MAX_RETRY_WAIT_S) {
    return null;
  }

  return seconds;
};

export const refusedParameter = (body: string): RefusedParameter | null => {
  const text = body.toLowerCase();

  if (
    text.includes('response_format') ||
    text.includes('json_object') ||
    text.includes('json mode')
  ) {
    return 'response_format';
  }

  if (text.includes('temperature')) {
    return 'temperature';
  }

  return null;
};

export const requiresMaxTokens = (body: string): boolean => {
  const text = body.toLowerCase();

  return (
    (text.includes('max_tokens') || text.includes('max_completion_tokens')) &&
    (text.includes('required') || text.includes('missing'))
  );
};

export const providerDetail = (body: string): string | null => {
  let payload: ProviderErrorBody;

  try {
    payload = JSON.parse(body) as ProviderErrorBody;
  } catch {
    return null;
  }

  const candidate =
    typeof payload.error === 'string'
      ? payload.error
      : typeof payload.error?.message === 'string'
        ? payload.error.message
        : typeof payload.message === 'string'
          ? payload.message
          : null;

  const detail = candidate?.trim();

  return detail ? detail.slice(0, DETAIL_LENGTH) : null;
};

export const describeFailure = (
  status: number,
  body: string,
  retryAfter: number | null,
): string => {
  const detail = providerDetail(body);
  const suffix = detail ? `: ${detail}` : '';

  if (status === TOO_MANY_REQUESTS) {
    const wait = retryAfter ? ` Try again in about ${retryAfter} s.` : ' Try again in a minute.';

    return `The provider is rate limiting this key (429${suffix}).${wait}`;
  }

  if (status >= SERVER_ERROR) {
    return `The provider is having trouble (${status}${suffix}). Try again in a moment.`;
  }

  return `The provider refused the request (${status}${suffix})`;
};
