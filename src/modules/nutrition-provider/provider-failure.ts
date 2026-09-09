/**
 * Reading a refusal from an OpenAI compatible provider.
 *
 * The photo path fails far more often than the text one - an image is an order
 * of magnitude more tokens, so it is what runs into a rate limit or an
 * overloaded model first - and a bare "could not answer right now" tells nobody
 * which of those happened. These turn the provider's own answer into something
 * worth putting in a log and, where it is safe, in front of the user.
 */

const TOO_MANY_REQUESTS = 429;
const SERVER_ERROR = 500;
const DETAIL_LENGTH = 160;
const MAX_RETRY_WAIT_S = 10;

interface ProviderErrorBody {
  error?: { message?: unknown } | string;
  message?: unknown;
}

/** Worth asking again: a rate limit passes, and so does an overloaded model. */
export const isRetryable = (status: number): boolean =>
  status === TOO_MANY_REQUESTS || status >= SERVER_ERROR;

/**
 * How long the provider asked us to wait, in seconds, or null when it said
 * nothing usable. A wait longer than the user would sit through is no better
 * than a refusal, so it is not honoured.
 */
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

/**
 * Whether a 400 is the provider objecting to `response_format`, which several
 * of them reject on vision models, rather than to the request itself. Only the
 * first is worth asking again without the flag; retrying the rest sends the
 * whole photo a second time to be refused the same way.
 */
export const aboutJsonMode = (body: string): boolean => {
  const text = body.toLowerCase();

  return (
    text.includes('response_format') || text.includes('json_object') || text.includes('json mode')
  );
};

/**
 * The provider's own sentence about what went wrong, if it answered in the
 * usual shape. Anything else - an HTML error page from something in front of
 * the provider, say - is left to the log; only a message the provider meant as
 * a message is repeated to the user.
 */
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

/** What the phone shows. The status stays in it: it is the one word that says
 * whether to wait a minute, fix the key, or pick another model. */
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
