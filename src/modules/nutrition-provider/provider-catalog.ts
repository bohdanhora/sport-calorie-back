/**
 * What the app knows about the OpenAI compatible providers it can talk to.
 *
 * The model list is deliberately not here: `GET /models` gives it live, with
 * whatever the user's own key can reach. What that endpoint does not give,
 * anywhere, is modality - no provider reports which models accept an image -
 * so vision has to be recognised from the id, and the list below will always
 * trail new releases. That is why the user can override it by hand.
 */
export interface CatalogProvider {
  id: string;
  label: string;
  baseUrl: string;
  /** Where the user creates a key. Shown next to the field, not called by us. */
  apiKeysUrl: string;
  /** Model ids known to accept images, as lowercase prefixes. */
  visionPrefixes: string[];
}

export const PROVIDER_CATALOG: CatalogProvider[] = [
  {
    id: 'groq',
    label: 'Groq',
    baseUrl: 'https://api.groq.com/openai/v1',
    apiKeysUrl: 'https://console.groq.com/keys',
    visionPrefixes: ['qwen/qwen3.6-27b', 'qwen/qwen3.8-27b'],
  },
  {
    id: 'openai',
    label: 'OpenAI',
    baseUrl: 'https://api.openai.com/v1',
    apiKeysUrl: 'https://platform.openai.com/api-keys',
    visionPrefixes: ['gpt-4o', 'gpt-4.1', 'gpt-5'],
  },
  {
    id: 'openrouter',
    label: 'OpenRouter',
    baseUrl: 'https://openrouter.ai/api/v1',
    apiKeysUrl: 'https://openrouter.ai/keys',
    // OpenRouter resells everyone's models under their own prefixes.
    visionPrefixes: [
      'openai/gpt-4o',
      'openai/gpt-4.1',
      'openai/gpt-5',
      'anthropic/claude',
      'google/gemini',
      'qwen/qwen3.6-27b',
      'qwen/qwen3.8-27b',
    ],
  },
];

const normalise = (baseUrl: string): string => baseUrl.trim().replace(/\/+$/, '').toLowerCase();

export const findProvider = (baseUrl: string): CatalogProvider | undefined =>
  PROVIDER_CATALOG.find((provider) => normalise(provider.baseUrl) === normalise(baseUrl));

/**
 * Whether the model is one this app knows to accept images. An unknown provider
 * or an unknown model answers false, which the caller is free to override.
 */
export const looksLikeVisionModel = (baseUrl: string, modelName: string): boolean => {
  const provider = findProvider(baseUrl);
  const model = modelName.trim().toLowerCase();

  if (!provider) {
    return false;
  }

  return provider.visionPrefixes.some((prefix) => model.startsWith(prefix));
};
