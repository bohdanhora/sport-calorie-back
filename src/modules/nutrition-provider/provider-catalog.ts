export interface CatalogProvider {
  id: string;
  label: string;
  baseUrl: string;
  apiKeysUrl: string;
  keyHint: string;
  defaultModel: string;
  models: string[];
  visionPrefixes: string[];
}

export const PROVIDER_CATALOG: CatalogProvider[] = [
  {
    id: 'openai',
    label: 'OpenAI',
    baseUrl: 'https://api.openai.com/v1',
    apiKeysUrl: 'https://platform.openai.com/api-keys',
    keyHint: 'sk-...',
    defaultModel: 'gpt-5',
    models: ['gpt-5', 'gpt-5-mini', 'gpt-4.1', 'gpt-4.1-mini', 'gpt-4o', 'gpt-4o-mini'],
    visionPrefixes: ['gpt-4o', 'gpt-4.1', 'gpt-5'],
  },
  {
    id: 'anthropic',
    label: 'Anthropic',
    baseUrl: 'https://api.anthropic.com/v1',
    apiKeysUrl: 'https://console.anthropic.com/settings/keys',
    keyHint: 'sk-ant-...',
    defaultModel: 'claude-sonnet-5',
    models: [
      'claude-opus-5',
      'claude-sonnet-5',
      'claude-haiku-4-5',
      'claude-fable-5-1',
      'claude-opus-4-8',
    ],
    visionPrefixes: ['claude-'],
  },
  {
    id: 'google',
    label: 'Google Gemini',
    baseUrl: 'https://generativelanguage.googleapis.com/v1beta/openai',
    apiKeysUrl: 'https://aistudio.google.com/apikey',
    keyHint: 'AIza...',
    defaultModel: 'gemini-2.5-flash',
    models: ['gemini-2.5-pro', 'gemini-2.5-flash', 'gemini-2.0-flash'],
    visionPrefixes: ['gemini-'],
  },
  {
    id: 'xai',
    label: 'xAI Grok',
    baseUrl: 'https://api.x.ai/v1',
    apiKeysUrl: 'https://console.x.ai/',
    keyHint: 'xai-...',
    defaultModel: 'grok-4-fast',
    models: ['grok-4', 'grok-4-fast', 'grok-3', 'grok-3-mini'],
    visionPrefixes: ['grok-4', 'grok-2-vision'],
  },
  {
    id: 'groq',
    label: 'Groq',
    baseUrl: 'https://api.groq.com/openai/v1',
    apiKeysUrl: 'https://console.groq.com/keys',
    keyHint: 'gsk_...',
    defaultModel: 'qwen/qwen3.8-27b',
    models: ['qwen/qwen3.8-27b', 'qwen/qwen3.6-27b', 'openai/gpt-oss-120b', 'openai/gpt-oss-20b'],
    visionPrefixes: ['qwen/qwen3.6-27b', 'qwen/qwen3.8-27b'],
  },
  {
    id: 'openrouter',
    label: 'OpenRouter',
    baseUrl: 'https://openrouter.ai/api/v1',
    apiKeysUrl: 'https://openrouter.ai/keys',
    keyHint: 'sk-or-...',
    defaultModel: 'openai/gpt-5',
    models: [
      'openai/gpt-5',
      'anthropic/claude-sonnet-5',
      'google/gemini-2.5-flash',
      'x-ai/grok-4-fast',
    ],
    visionPrefixes: [
      'openai/gpt-4o',
      'openai/gpt-4.1',
      'openai/gpt-5',
      'anthropic/claude',
      'google/gemini',
      'x-ai/grok-4',
      'qwen/qwen3.6-27b',
      'qwen/qwen3.8-27b',
    ],
  },
];

const ANTHROPIC_VERSION = '2023-06-01';
const SKIPPED_MODELS =
  /embed|whisper|tts|dall-e|image|audio|moderation|rerank|guard|realtime|speech|transcri|search/i;
const MODEL_LIMIT = 60;

const normalise = (baseUrl: string): string => baseUrl.trim().replace(/\/+$/, '').toLowerCase();

export const findProvider = (baseUrl: string): CatalogProvider | undefined =>
  PROVIDER_CATALOG.find((provider) => normalise(provider.baseUrl) === normalise(baseUrl));

export const providerHeaders = (baseUrl: string, apiKey: string): Record<string, string> => {
  const bearer = { Authorization: `Bearer ${apiKey}` };

  if (findProvider(baseUrl)?.id === 'anthropic') {
    return { ...bearer, 'x-api-key': apiKey, 'anthropic-version': ANTHROPIC_VERSION };
  }

  return bearer;
};

export const cleanModelId = (id: string): string => id.trim().replace(/^models\//, '');

export const usableModels = (ids: string[], preferred: string[] = []): string[] => {
  const available = [...new Set(ids.map(cleanModelId))].filter(
    (id) => id.length > 0 && !SKIPPED_MODELS.test(id),
  );
  const hoisted = preferred.filter((id) => available.includes(id));
  const rest = available
    .filter((id) => !hoisted.includes(id))
    .sort((first, second) => first.localeCompare(second));

  return [...hoisted, ...rest].slice(0, MODEL_LIMIT);
};

export const looksLikeVisionModel = (baseUrl: string, modelName: string): boolean => {
  const provider = findProvider(baseUrl);
  const model = cleanModelId(modelName).toLowerCase();

  if (!provider) {
    return false;
  }

  return provider.visionPrefixes.some((prefix) => model.startsWith(prefix));
};
