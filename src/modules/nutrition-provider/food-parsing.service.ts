import { BadGatewayException, Injectable, Logger } from '@nestjs/common';
import { FoodSource } from '@prisma/client';

import { PrismaService } from '../../prisma/prisma.service';
import type { ParseFoodDto, ParsedFoodDto } from './dto/parse-food.dto';
import { NutritionProviderService, type ProviderCredentials } from './nutrition-provider.service';
import {
  UnusableProviderAnswerError,
  normaliseQuery,
  parseNutritionPayload,
  type ParsedNutrition,
} from './nutrition-payload';

export const MODEL_FOOD_SOURCE = 'model';

const REQUEST_TIMEOUT_MS = 25_000;
const UNAUTHORISED = 401;
const BAD_REQUEST = 400;

const LANGUAGE_NAMES: Record<string, string> = {
  en: 'English',
  ru: 'Russian',
  uk: 'Ukrainian',
};

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

interface ChatCompletionResponse {
  choices?: { message?: { content?: string } }[];
}

@Injectable()
export class FoodParsingService {
  private readonly logger = new Logger(FoodParsingService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly providerService: NutritionProviderService,
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

  async check(credentials: ProviderCredentials): Promise<void> {
    await this.requestNutrition(credentials, '100 g of white rice', 'en');
  }

  private async requestNutrition(
    credentials: ProviderCredentials,
    text: string,
    locale: string,
  ): Promise<ParsedNutrition> {
    const content = await this.requestCompletion(credentials, text, locale);

    try {
      return parseNutritionPayload(content);
    } catch (error) {
      if (error instanceof UnusableProviderAnswerError) {
        throw new BadGatewayException(`The provider returned an unusable answer: ${error.message}`);
      }

      throw error;
    }
  }

  private async requestCompletion(
    credentials: ProviderCredentials,
    text: string,
    locale: string,
  ): Promise<string> {
    const messages = [
      { role: 'system', content: buildSystemPrompt(LANGUAGE_NAMES[locale] ?? LANGUAGE_NAMES.en) },
      { role: 'user', content: text },
    ];

    let response = await this.send(credentials, { messages, jsonMode: true });

    if (response.status === BAD_REQUEST) {
      response = await this.send(credentials, { messages, jsonMode: false });
    }

    if (response.status === UNAUTHORISED) {
      throw new BadGatewayException('The provider rejected the API key');
    }

    if (!response.ok) {
      this.logger.warn(`Nutrition provider responded with ${response.status}`);
      throw new BadGatewayException('The provider could not answer right now');
    }

    const payload = (await response.json()) as ChatCompletionResponse;
    const content = payload.choices?.[0]?.message?.content;

    if (!content) {
      throw new BadGatewayException('The provider returned an empty answer');
    }

    return content;
  }

  private async send(
    credentials: ProviderCredentials,
    options: { messages: { role: string; content: string }[]; jsonMode: boolean },
  ): Promise<Response> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

    try {
      return await fetch(`${credentials.baseUrl}/chat/completions`, {
        method: 'POST',
        signal: controller.signal,
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${credentials.apiKey}`,
        },
        body: JSON.stringify({
          model: credentials.modelName,
          temperature: 0,
          messages: options.messages,
          ...(options.jsonMode ? { response_format: { type: 'json_object' } } : {}),
        }),
      });
    } catch {
      throw new BadGatewayException('The provider did not respond in time');
    } finally {
      clearTimeout(timeout);
    }
  }
}
