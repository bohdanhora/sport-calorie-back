import {
  PROVIDER_CATALOG,
  cleanModelId,
  findProvider,
  looksLikeVisionModel,
  providerHeaders,
  usableModels,
} from './provider-catalog';

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
    expect(looksLikeVisionModel('https://api.anthropic.com/v1', 'claude-sonnet-5')).toBe(true);
    expect(
      looksLikeVisionModel(
        'https://generativelanguage.googleapis.com/v1beta/openai',
        'models/gemini-2.5-flash',
      ),
    ).toBe(true);
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

  it('gives every provider a key page, known models and one of them as the default', () => {
    for (const provider of PROVIDER_CATALOG) {
      expect(provider.apiKeysUrl).toMatch(/^https:\/\//);
      expect(provider.baseUrl).toMatch(/^https:\/\//);
      expect(provider.keyHint.length).toBeGreaterThan(0);
      expect(provider.models).toContain(provider.defaultModel);
    }
  });

  it('sends the key the way each provider reads it', () => {
    expect(providerHeaders('https://api.openai.com/v1', 'sk-1')).toEqual({
      Authorization: 'Bearer sk-1',
    });

    const anthropic = providerHeaders('https://api.anthropic.com/v1/', 'sk-ant-1');

    expect(anthropic['x-api-key']).toBe('sk-ant-1');
    expect(anthropic.Authorization).toBe('Bearer sk-ant-1');
    expect(anthropic['anthropic-version']).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it('drops the models that cannot answer a chat request at all', () => {
    const models = usableModels([
      'text-embedding-3-large',
      'whisper-1',
      'dall-e-3',
      'tts-1',
      'gpt-4o',
    ]);

    expect(models).toEqual(['gpt-4o']);
  });

  it('puts the models the catalog names first and sorts the rest', () => {
    const models = usableModels(['zeta', 'alpha', 'gpt-4o', 'gpt-5'], ['gpt-5', 'gpt-4o']);

    expect(models).toEqual(['gpt-5', 'gpt-4o', 'alpha', 'zeta']);
  });

  it('asks for a gemini model by the id the chat endpoint wants', () => {
    expect(cleanModelId('models/gemini-2.5-flash')).toBe('gemini-2.5-flash');
    expect(usableModels(['models/gemini-2.5-flash'])).toEqual(['gemini-2.5-flash']);
  });
});
