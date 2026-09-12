import { BadGatewayException, BadRequestException, Injectable, Logger } from '@nestjs/common';
import { createHash } from 'node:crypto';
import { FoodSource } from '@prisma/client';

import { PrismaService } from '../../prisma/prisma.service';
import type { ParseFoodDto, ParsedFoodDto, ScanFoodDto } from './dto/parse-food.dto';
import { NutritionProviderService, type ProviderCredentials } from './nutrition-provider.service';
import { ProviderChatService } from './provider-chat.service';
import { looksLikeVisionModel } from './provider-catalog';
import {
  UnusableProviderAnswerError,
  normaliseQuery,
  parseNutritionPayload,
  type ParsedNutrition,
} from './nutrition-payload';

export const MODEL_FOOD_SOURCE = 'model';
export const PHOTO_FOOD_SOURCE = 'model-photo';

const ANSWER_SNIPPET_LENGTH = 500;

const LANGUAGE_NAMES: Record<string, string> = {
  en: 'English',
  ru: 'Russian',
  uk: 'Ukrainian',
};

const buildPhotoPrompt = (language: string): string =>
  [
    'You estimate the nutrition of the food shown in a photograph.',
    'Answer with one JSON object and nothing else.',
    'Keys: name (string), amount (number greater than zero), unit (GRAM, MILLILITER, PIECE or SERVING),',
    'energyKcal (number), proteinG (number), carbsG (number), fatG (number).',
    'All nutrition values describe the whole portion in the photograph, not 100 grams.',
    'Judge the portion from what the photograph shows, using any everyday object in it for scale.',
    'If several foods are on the plate, answer for the plate as a whole and name it accordingly.',
    `Write the name in ${language}.`,
    'Never add commentary, units inside numbers, or extra keys.',
  ].join(' ');

const buildSystemPrompt = (language: string): string =>
  [
    'You estimate the nutrition of a described portion of food.',
    'Answer with one JSON object and nothing else.',
    'Keys: name (string), amount (number greater than zero), unit (GRAM, MILLILITER, PIECE or SERVING),',
    'energyKcal (number), proteinG (number), carbsG (number), fatG (number).',
    'All nutrition values describe the whole portion the user asked about, not 100 grams.',
    'If the user gives no amount, assume one typical portion and say so through amount and unit.',
    `Write the name in ${language}.`,
    'Never add commentary, units inside numbers, or extra keys.',
  ].join(' ');

@Injectable()
export class FoodParsingService {
  private readonly logger = new Logger(FoodParsingService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly providerService: NutritionProviderService,
    private readonly chat: ProviderChatService,
  ) {}

  async parse(userId: string, dto: ParseFoodDto): Promise<ParsedFoodDto> {
    const query = normaliseQuery(dto.text);
    const cached = await this.prisma.food.findFirst({
      where: {
        userId,
        source: FoodSource.EXTERNAL,
        externalSource: MODEL_FOOD_SOURCE,
        externalId: query,
        archivedAt: null,
      },
    });

    if (cached) {
      return {
        foodId: cached.id,
        name: cached.name,
        amount: cached.servingSize,
        unit: cached.servingUnit,
        energyKcal: cached.energyKcal,
        proteinG: cached.proteinG,
        carbsG: cached.carbsG,
        fatG: cached.fatG,
        fromCache: true,
      };
    }

    const credentials = await this.providerService.getCredentials(userId);
    const nutrition = await this.requestNutrition(credentials, dto.text, dto.locale ?? 'en');

    const food = await this.prisma.food.create({
      data: {
        userId,
        name: nutrition.name,
        servingSize: nutrition.amount,
        servingUnit: nutrition.unit,
        energyKcal: nutrition.energyKcal,
        proteinG: nutrition.proteinG,
        carbsG: nutrition.carbsG,
        fatG: nutrition.fatG,
        source: FoodSource.EXTERNAL,
        externalSource: MODEL_FOOD_SOURCE,
        externalId: query,
      },
    });

    return {
      foodId: food.id,
      name: food.name,
      amount: food.servingSize,
      unit: food.servingUnit,
      energyKcal: food.energyKcal,
      proteinG: food.proteinG,
      carbsG: food.carbsG,
      fatG: food.fatG,
      fromCache: false,
    };
  }

  async scan(userId: string, dto: ScanFoodDto): Promise<ParsedFoodDto> {
    const credentials = await this.providerService.getCredentials(userId);
    const model = credentials.visionModelName;

    if (!model) {
      throw new BadRequestException('No model for photos is configured');
    }

    if (!looksLikeVisionModel(credentials.baseUrl, model) && !credentials.visionOverride) {
      throw new BadRequestException(`${model} is not known to accept images`);
    }

    const language = LANGUAGE_NAMES[dto.locale ?? 'en'] ?? LANGUAGE_NAMES.en;
    const digest = createHash('sha256').update(dto.image).digest('hex');

    const cached = await this.prisma.food.findFirst({
      where: {
        userId,
        source: FoodSource.EXTERNAL,
        externalSource: PHOTO_FOOD_SOURCE,
        externalId: digest,
        archivedAt: null,
      },
    });

    if (cached) {
      return {
        foodId: cached.id,
        name: cached.name,
        amount: cached.servingSize,
        unit: cached.servingUnit,
        energyKcal: cached.energyKcal,
        proteinG: cached.proteinG,
        carbsG: cached.carbsG,
        fatG: cached.fatG,
        fromCache: true,
      };
    }

    const content = await this.chat.complete(
      credentials,
      [
        { role: 'system', content: buildPhotoPrompt(language) },
        {
          role: 'user',
          content: [
            ...(dto.hint ? [{ type: 'text' as const, text: dto.hint }] : []),
            { type: 'image_url' as const, image_url: { url: dto.image } },
          ],
        },
      ],
      model,
    );

    const nutrition = this.readAnswer(content);

    const food = await this.prisma.food.create({
      data: {
        userId,
        name: nutrition.name,
        servingSize: nutrition.amount,
        servingUnit: nutrition.unit,
        energyKcal: nutrition.energyKcal,
        proteinG: nutrition.proteinG,
        carbsG: nutrition.carbsG,
        fatG: nutrition.fatG,
        source: FoodSource.EXTERNAL,
        externalSource: PHOTO_FOOD_SOURCE,
        externalId: digest,
      },
    });

    return {
      foodId: food.id,
      name: food.name,
      amount: food.servingSize,
      unit: food.servingUnit,
      energyKcal: food.energyKcal,
      proteinG: food.proteinG,
      carbsG: food.carbsG,
      fatG: food.fatG,
      fromCache: false,
    };
  }

  async check(credentials: ProviderCredentials): Promise<void> {
    await this.requestNutrition(credentials, '100 g of white rice', 'en');
  }

  private async requestNutrition(
    credentials: ProviderCredentials,
    text: string,
    locale: string,
  ): Promise<ParsedNutrition> {
    const content = await this.chat.complete(credentials, [
      { role: 'system', content: buildSystemPrompt(LANGUAGE_NAMES[locale] ?? LANGUAGE_NAMES.en) },
      { role: 'user', content: text },
    ]);

    return this.readAnswer(content);
  }

  private readAnswer(content: string): ParsedNutrition {
    try {
      return parseNutritionPayload(content);
    } catch (error) {
      if (error instanceof UnusableProviderAnswerError) {
        this.logger.warn(
          `${error.message}. The provider answered: ${content.trim().slice(0, ANSWER_SNIPPET_LENGTH)}`,
        );

        throw new BadGatewayException(`The provider returned an unusable answer: ${error.message}`);
      }

      throw error;
    }
  }
}
