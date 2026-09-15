import { encryptSecret } from '../../common/crypto/secret-cipher';
import type { PrismaService } from '../../prisma/prisma.service';
import { NutritionProviderService } from './nutrition-provider.service';

const key = Buffer.alloc(32, 7);
const OPENAI = 'https://api.openai.com/v1';

const storedProvider = (overrides: Record<string, unknown> = {}) => {
  const secret = encryptSecret('sk-test-key-1234', key);

  return {
    id: 'provider-1',
    userId: 'user-1',
    baseUrl: OPENAI,
    modelName: 'gpt-5',
    visionModelName: null,
    visionOverride: false,
    models: [] as string[],
    modelsFetchedAt: null as Date | null,
    apiKeyCipher: secret.cipher,
    apiKeyIv: secret.iv,
    apiKeyTag: secret.tag,
    apiKeyHint: 'sk-...1234',
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
};

const setup = (provider: ReturnType<typeof storedProvider>) => {
  const nutritionProvider = {
    findUnique: jest.fn().mockResolvedValue(provider),
    update: jest.fn().mockResolvedValue(provider),
    create: jest.fn().mockResolvedValue(provider),
  };
  const service = new NutritionProviderService({ nutritionProvider } as unknown as PrismaService, {
    encryptionKey: key,
  });

  return { service, nutritionProvider };
};

describe('nutrition provider model list', () => {
  afterEach(() => jest.restoreAllMocks());

  it('serves the stored list without asking the provider again', async () => {
    const fetchedAt = new Date('2026-09-14T10:00:00.000Z');
    const { service } = setup(
      storedProvider({ models: ['gpt-5', 'o3-mini'], modelsFetchedAt: fetchedAt }),
    );
    const fetchSpy = jest.spyOn(global, 'fetch');

    const result = await service.listModels('user-1');

    expect(fetchSpy).not.toHaveBeenCalled();
    expect(result).toEqual({
      models: ['gpt-5', 'o3-mini'],
      visionModels: ['gpt-5'],
      fetchedAt: fetchedAt.toISOString(),
    });
  });

  it('asks the provider on the first read and stores what it answered', async () => {
    const { service, nutritionProvider } = setup(storedProvider());

    jest
      .spyOn(global, 'fetch')
      .mockResolvedValue(
        new Response(
          JSON.stringify({ data: [{ id: 'gpt-4o' }, { id: 'whisper-1' }, { id: 'gpt-5' }] }),
          { status: 200 },
        ),
      );

    const result = await service.listModels('user-1');

    expect(result.models).toEqual(['gpt-5', 'gpt-4o']);
    expect(nutritionProvider.update).toHaveBeenCalledWith({
      where: { userId: 'user-1' },
      data: { models: ['gpt-5', 'gpt-4o'], modelsFetchedAt: expect.any(Date) },
    });
  });

  it('drops the stored list when a new key is saved', async () => {
    const { service, nutritionProvider } = setup(
      storedProvider({ models: ['gpt-5'], modelsFetchedAt: new Date() }),
    );

    await service.save('user-1', {
      baseUrl: OPENAI,
      modelName: 'gpt-5',
      apiKey: 'sk-another-key-5678',
    });

    expect(nutritionProvider.update.mock.calls[0][0].data).toMatchObject({
      models: [],
      modelsFetchedAt: null,
    });
  });

  it('keeps the stored list when only the model changes', async () => {
    const { service, nutritionProvider } = setup(
      storedProvider({ models: ['gpt-5', 'gpt-4o'], modelsFetchedAt: new Date() }),
    );

    await service.save('user-1', { baseUrl: `${OPENAI}/`, modelName: 'gpt-4o' });

    expect(nutritionProvider.update.mock.calls[0][0].data).not.toHaveProperty('models');
  });
});
