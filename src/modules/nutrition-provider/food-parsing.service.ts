import { BadGatewayException, BadRequestException, Injectable, Logger } from '@nestjs/common';
import { createHash } from 'node:crypto';
import { FoodSource } from '@prisma/client';

import { PrismaService } from '../../prisma/prisma.service';
import type { ParseFoodDto, ParsedFoodDto, ScanFoodDto } from './dto/parse-food.dto';
import { NutritionProviderService, type ProviderCredentials } from './nutrition-provider.service';
import { looksLikeVisionModel } from './provider-catalog';
import {
  UnusableProviderAnswerError,
  normaliseQuery,
  parseNutritionPayload,
  type ParsedNutrition,
} from './nutrition-payload';

export const MODEL_FOOD_SOURCE = 'model';
export const PHOTO_FOOD_SOURCE = 'model-photo';

const REQUEST_TIMEOUT_MS = 25_000;
const UNAUTHORISED = 401;
const BAD_REQUEST = 400;

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

type MessageContent =
  | string
  | ({ type: 'text'; text: string } | { type: 'image_url'; image_url: { url: string } })[];

interface ChatMessage {
  role: string;
  content: MessageContent;
}

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

  /**
   * The photo path. No cache lookup by text, because a photograph has no text
   * to key on; the saved food is keyed by a digest of the image instead, so the
   * same picture sent twice costs one request.
   */
  async scan(userId: string, dto: ScanFoodDto): Promise<ParsedFoodDto> {
    const credentials = await this.providerService.getCredentials(userId);
    const model = credentials.visionModelName;

    if (!model) {
      throw new BadRequestException('No model for photos is configured');
    }

    // The catalog trails new releases, so the user is allowed to insist.
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

    const content = await this.requestCompletion(
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

    let nutrition;

    try {
      nutrition = parseNutritionPayload(content);
    } catch (error) {
      if (error instanceof UnusableProviderAnswerError) {
        throw new BadGatewayException(`The provider returned an unusable answer: ${error.message}`);
      }

      throw error;
    }

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
    const content = await this.requestCompletion(credentials, [
      { role: 'system', content: buildSystemPrompt(LANGUAGE_NAMES[locale] ?? LANGUAGE_NAMES.en) },
      { role: 'user', content: text },
    ]);

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
    messages: ChatMessage[],
    model?: string,
  ): Promise<string> {
    let response = await this.send(credentials, { messages, jsonMode: true, model });

    if (response.status === BAD_REQUEST) {
      response = await this.send(credentials, { messages, jsonMode: false, model });
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
    options: { messages: ChatMessage[]; jsonMode: boolean; model?: string },
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
          model: options.model ?? credentials.modelName,
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
