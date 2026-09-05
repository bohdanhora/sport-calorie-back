import { PROVIDER_CATALOG, findProvider, looksLikeVisionModel } from './provider-catalog';

describe('provider catalog', () => {
  it('matches a base url regardless of a trailing slash or case', () => {
    expect(findProvider('https://api.groq.com/openai/v1')?.id).toBe('groq');
    expect(findProvider('https://api.groq.com/openai/v1/')?.id).toBe('groq');
    expect(findProvider('HTTPS://API.GROQ.COM/openai/v1')?.id).toBe('groq');
  });

  it('does not invent a provider for an unknown url', () => {
    expect(findProvider('http://localhost:11434/v1')).toBeUndefined();
  });

  it('recognises the models known to accept images', () => {
    expect(looksLikeVisionModel('https://api.groq.com/openai/v1', 'qwen/qwen3.6-27b')).toBe(true);
    expect(looksLikeVisionModel('https://api.openai.com/v1', 'gpt-4o-mini')).toBe(true);
  });

  it('answers false for a text only model, which is what hides the camera', () => {
    expect(looksLikeVisionModel('https://api.groq.com/openai/v1', 'openai/gpt-oss-20b')).toBe(
      false,
    );
    expect(looksLikeVisionModel('https://api.openai.com/v1', 'o1-mini')).toBe(false);
  });

  it('answers false for a provider it does not know, leaving the user to decide', () => {
    expect(looksLikeVisionModel('http://localhost:11434/v1', 'llava')).toBe(false);
  });

  it('gives every provider somewhere to fetch a key from', () => {
    for (const provider of PROVIDER_CATALOG) {
      expect(provider.apiKeysUrl).toMatch(/^https:\/\//);
      expect(provider.baseUrl).toMatch(/^https:\/\//);
    }
  });
});
