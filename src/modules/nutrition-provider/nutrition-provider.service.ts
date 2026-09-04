import { Inject, Injectable, NotFoundException } from '@nestjs/common';

import { securityConfig, type SecurityConfig } from '../../config/app.config';
import { decryptSecret, encryptSecret, maskSecret } from '../../common/crypto/secret-cipher';
import { PrismaService } from '../../prisma/prisma.service';
import type { NutritionProviderDto, SaveNutritionProviderDto } from './dto/nutrition-provider.dto';

export interface ProviderCredentials {
  baseUrl: string;
  modelName: string;
  apiKey: string;
}

const NOT_CONFIGURED: NutritionProviderDto = {
  isConfigured: false,
  baseUrl: null,
  modelName: null,
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

    return {
      isConfigured: true,
      baseUrl: provider.baseUrl,
      modelName: provider.modelName,
      apiKeyHint: provider.apiKeyHint,
    };
  }

  async save(userId: string, dto: SaveNutritionProviderDto): Promise<NutritionProviderDto> {
    const apiKey = dto.apiKey.trim();
    const encrypted = encryptSecret(apiKey, this.config.encryptionKey);

    const data = {
      baseUrl: dto.baseUrl.trim().replace(/\/+$/, ''),
      modelName: dto.modelName.trim(),
      apiKeyCipher: encrypted.cipher,
      apiKeyIv: encrypted.iv,
      apiKeyTag: encrypted.tag,
      apiKeyHint: maskSecret(apiKey),
    };

    await this.prisma.nutritionProvider.upsert({
      where: { userId },
      create: { userId, ...data },
      update: data,
    });

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
}
