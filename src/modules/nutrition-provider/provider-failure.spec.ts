import {
  aboutJsonMode,
  describeFailure,
  isRetryable,
  providerDetail,
  retryAfterSeconds,
} from './provider-failure';

describe('provider failure', () => {
  it('asks again only for the refusals that pass on their own', () => {
    expect(isRetryable(429)).toBe(true);
    expect(isRetryable(503)).toBe(true);
    expect(isRetryable(400)).toBe(false);
    expect(isRetryable(401)).toBe(false);
    expect(isRetryable(200)).toBe(false);
  });

  it('honours a short retry-after and ignores one nobody would sit through', () => {
    expect(retryAfterSeconds('3')).toBe(3);
    expect(retryAfterSeconds(null)).toBeNull();
    expect(retryAfterSeconds('600')).toBeNull();
    expect(retryAfterSeconds('Wed, 21 Oct 2026 07:28:00 GMT')).toBeNull();
  });

  it('retries a 400 without JSON mode only when that is what was refused', () => {
    expect(aboutJsonMode('{"error":{"message":"response_format is not supported"}}')).toBe(true);
    expect(aboutJsonMode('{"error":{"message":"json_object unavailable for this model"}}')).toBe(
      true,
    );
    // Sending the whole photograph a second time cannot fix either of these.
    expect(aboutJsonMode('{"error":{"message":"image exceeds the maximum size"}}')).toBe(false);
    expect(aboutJsonMode('{"error":{"message":"model does not support images"}}')).toBe(false);
  });

  it('repeats the sentence the provider meant as a message', () => {
    expect(providerDetail('{"error":{"message":"Rate limit reached for qwen"}}')).toBe(
      'Rate limit reached for qwen',
    );
    expect(providerDetail('{"message":"Service unavailable"}')).toBe('Service unavailable');
  });

  it('keeps a gateway error page out of the answer, leaving it to the log', () => {
    expect(providerDetail('<html><body>502 Bad Gateway</body></html>')).toBeNull();
    expect(providerDetail('')).toBeNull();
  });

  it('names the rate limit rather than blaming the provider in general', () => {
    const message = describeFailure(429, '{"error":{"message":"Rate limit reached"}}', 8);

    expect(message).toContain('429');
    expect(message).toContain('Rate limit reached');
    expect(message).toContain('8 s');
  });

  it('says a busy provider is worth another try, and a refusal is not', () => {
    expect(describeFailure(503, '', null)).toContain('Try again');
    expect(describeFailure(422, '{"error":{"message":"unknown model"}}', null)).toBe(
      'The provider refused the request (422: unknown model)',
    );
  });
});
