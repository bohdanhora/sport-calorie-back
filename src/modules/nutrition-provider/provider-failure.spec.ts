import {
  describeFailure,
  isRetryable,
  providerDetail,
  refusedParameter,
  requiresMaxTokens,
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

  it('names the parameter a 400 objected to, so the retry drops that one', () => {
    expect(refusedParameter('{"error":{"message":"response_format is not supported"}}')).toBe(
      'response_format',
    );
    expect(refusedParameter('{"error":{"message":"json_object unavailable for this model"}}')).toBe(
      'response_format',
    );
    expect(
      refusedParameter(
        `{"error":{"message":"Unsupported value: 'temperature' does not support 0"}}`,
      ),
    ).toBe('temperature');
    expect(refusedParameter('{"error":{"message":"image exceeds the maximum size"}}')).toBeNull();
    expect(refusedParameter('{"error":{"message":"model does not support images"}}')).toBeNull();
  });

  it('spots the provider that will not answer without a ceiling on the answer', () => {
    expect(requiresMaxTokens('{"error":{"message":"max_tokens: Field required"}}')).toBe(true);
    expect(
      requiresMaxTokens(
        `{"error":{"message":"Unsupported parameter: 'max_tokens' is not supported with this model. Use 'max_completion_tokens' instead."}}`,
      ),
    ).toBe(false);
    expect(requiresMaxTokens('{"error":{"message":"rate limit reached"}}')).toBe(false);
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
