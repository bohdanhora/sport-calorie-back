import {
  BadGatewayException,
  BadRequestException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';

import { securityConfig, type SecurityConfig } from '../../config/app.config';
import { decryptSecret, encryptSecret, maskSecret } from '../../common/crypto/secret-cipher';
import { PrismaService } from '../../prisma/prisma.service';
import type {
  NutritionProviderDto,
  ProviderModelsDto,
  SaveNutritionProviderDto,
} from './dto/nutrition-provider.dto';
import {
  findProvider,
  looksLikeVisionModel,
  providerHeaders,
  usableModels,
} from './provider-catalog';

export interface ProviderCredentials {
  baseUrl: string;
  modelName: string;
  visionModelName: string | null;
  visionOverride: boolean;
  apiKey: string;
}

const MODELS_TIMEOUT_MS = 10_000;

interface ModelListResponse {
  data?: { id?: string }[];
}

const NOT_CONFIGURED: NutritionProviderDto = {
  isConfigured: false,
  baseUrl: null,
  modelName: null,
  visionModelName: null,
  supportsVision: false,
  visionModelKnown: false,
  visionOverride: false,
  apiKeyHint: null,
};

@Injectable()
export class NutritionProviderService {
  constructor(
    private readonly prisma: PrismaService,
    @Inject(securityConfig.KEY) private readonly config: SecurityConfig,
  ) {}

  async get(userId: string): Promise<NutritionProviderDto> {
    const provider = await this.prisma.nutritionProvider.findUnique({ where: { userId } });

    if (!provider) {
      return { ...NOT_CONFIGURED };
    }

    const known =
      provider.visionModelName !== null &&
      looksLikeVisionModel(provider.baseUrl, provider.visionModelName);

    return {
      isConfigured: true,
      baseUrl: provider.baseUrl,
      modelName: provider.modelName,
      visionModelName: provider.visionModelName,
      supportsVision: provider.visionModelName !== null && (known || provider.visionOverride),
      visionModelKnown: known,
      visionOverride: provider.visionOverride,
      apiKeyHint: provider.apiKeyHint,
    };
  }

  async save(userId: string, dto: SaveNutritionProviderDto): Promise<NutritionProviderDto> {
    const apiKey = dto.apiKey?.trim();
    const existing = await this.prisma.nutritionProvider.findUnique({ where: { userId } });

    if (!apiKey && !existing) {
      throw new BadRequestException('An API key is needed the first time');
    }

    const settings = {
      baseUrl: dto.baseUrl.trim().replace(/\/+$/, ''),
      modelName: dto.modelName.trim(),
      visionModelName: dto.visionModelName?.trim() || null,
      visionOverride: dto.visionOverride ?? false,
    };

    const secret = apiKey
      ? (() => {
          const encrypted = encryptSecret(apiKey, this.config.encryptionKey);

          return {
            apiKeyCipher: encrypted.cipher,
            apiKeyIv: encrypted.iv,
            apiKeyTag: encrypted.tag,
            apiKeyHint: maskSecret(apiKey),
          };
        })()
      : null;

    if (existing) {
      await this.prisma.nutritionProvider.update({
        where: { userId },
        data: { ...settings, ...(secret ?? {}) },
      });
    } else {
      await this.prisma.nutritionProvider.create({
        data: { userId, ...settings, ...secret! },
      });
    }

    return this.get(userId);
  }

  async remove(userId: string): Promise<void> {
    await this.prisma.nutritionProvider.deleteMany({ where: { userId } });
  }

  async getCredentials(userId: string): Promise<ProviderCredentials> {
    const provider = await this.prisma.nutritionProvider.findUnique({ where: { userId } });

    if (!provider) {
      throw new NotFoundException('No nutrition provider configured');
    }

    return {
      baseUrl: provider.baseUrl,
      modelName: provider.modelName,
      visionModelName: provider.visionModelName,
      visionOverride: provider.visionOverride,
      apiKey: decryptSecret(
        {
          cipher: provider.apiKeyCipher,
          iv: provider.apiKeyIv,
          tag: provider.apiKeyTag,
        },
        this.config.encryptionKey,
      ),
    };
  }

  async listModels(userId: string): Promise<ProviderModelsDto> {
    const credentials = await this.getCredentials(userId);

    let response: Response;

    try {
      response = await fetch(`${credentials.baseUrl}/models`, {
        headers: providerHeaders(credentials.baseUrl, credentials.apiKey),
        signal: AbortSignal.timeout(MODELS_TIMEOUT_MS),
      });
    } catch {
      throw new BadGatewayException('The provider could not be reached');
    }

    if (response.status === 401) {
      throw new BadGatewayException('The provider rejected the API key');
    }

    if (!response.ok) {
      throw new BadGatewayException('The provider could not list its models');
    }

    const payload = (await response.json()) as ModelListResponse;
    const models = usableModels(
      (payload.data ?? [])
        .map((model) => model.id)
        .filter((id): id is string => typeof id === 'string'),
      findProvider(credentials.baseUrl)?.models ?? [],
    );

    return {
      models,
      visionModels: models.filter((id) => looksLikeVisionModel(credentials.baseUrl, id)),
    };
  }
}
