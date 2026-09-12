import { BadGatewayException, Injectable } from '@nestjs/common';
import { Intensity } from '@prisma/client';

import { NutritionProviderService } from '../nutrition-provider/nutrition-provider.service';
import { ProviderChatService } from '../nutrition-provider/provider-chat.service';
import { ActivityEntriesService } from './activity-entries.service';
import { ActivityTypesService } from './activity-types.service';
import type { ParseActivityDto, ParsedActivityDto } from './dto/parse-activity.dto';

const LANGUAGE_NAMES: Record<string, string> = {
  en: 'English',
  ru: 'Russian',
  uk: 'Ukrainian',
};

const INTENSITIES = new Set<string>(Object.values(Intensity));

interface ModelAnswer {
  slug?: unknown;
  title?: unknown;
  durationSec?: unknown;
  distanceM?: unknown;
  avgSpeedKmh?: unknown;
  inclinePercent?: unknown;
  sets?: unknown;
  reps?: unknown;
  intensity?: unknown;
}

const asPositiveNumber = (value: unknown): number | null => {
  const parsed = typeof value === 'string' ? Number(value) : value;

  return typeof parsed === 'number' && Number.isFinite(parsed) && parsed > 0 ? parsed : null;
};

const asPositiveInteger = (value: unknown): number | null => {
  const parsed = asPositiveNumber(value);

  return parsed === null ? null : Math.round(parsed);
};

@Injectable()
export class ActivityParsingService {
  constructor(
    private readonly providerService: NutritionProviderService,
    private readonly chat: ProviderChatService,
    private readonly activityTypes: ActivityTypesService,
    private readonly activityEntries: ActivityEntriesService,
  ) {}

  async parse(userId: string, dto: ParseActivityDto): Promise<ParsedActivityDto> {
    const credentials = await this.providerService.getCredentials(userId);
    const types = await this.activityTypes.list(userId);

    if (types.length === 0) {
      throw new BadGatewayException('No activity types are available to choose from');
    }

    const language = LANGUAGE_NAMES[dto.locale ?? 'en'] ?? LANGUAGE_NAMES.en;
    const content = await this.chat.complete(credentials, [
      { role: 'system', content: this.buildPrompt(types, language) },
      { role: 'user', content: dto.text },
    ]);

    const answer = this.readAnswer(content);
    const type = types.find((candidate) => candidate.slug === answer.slug);

    if (!type) {
      throw new BadGatewayException(`The provider chose an activity that does not exist`);
    }

    const draft = {
      activityTypeId: type.id,
      durationSec: type.tracksDuration ? asPositiveInteger(answer.durationSec) : null,
      distanceM: type.tracksDistance ? asPositiveNumber(answer.distanceM) : null,
      avgSpeedKmh: type.tracksDistance ? asPositiveNumber(answer.avgSpeedKmh) : null,
      inclinePercent: type.tracksIncline ? asPositiveNumber(answer.inclinePercent) : null,
      sets: type.tracksSets ? asPositiveInteger(answer.sets) : null,
      reps: type.tracksReps ? asPositiveInteger(answer.reps) : null,
      intensity:
        type.tracksIntensity &&
        typeof answer.intensity === 'string' &&
        INTENSITIES.has(answer.intensity)
          ? (answer.intensity as Intensity)
          : null,
    };

    const estimate = await this.activityEntries.estimate(userId, draft);

    return {
      ...draft,
      title: typeof answer.title === 'string' && answer.title.trim() ? answer.title.trim() : null,
      activityTypeName: type.name,
      energyKcal: estimate.energyKcal,
      effectiveDurationSec: estimate.effectiveDurationSec,
    };
  }

  private buildPrompt(
    types: {
      slug: string;
      name: string;
      tracksDuration: boolean;
      tracksDistance: boolean;
      tracksIncline: boolean;
      tracksReps: boolean;
      tracksSets: boolean;
      tracksIntensity: boolean;
    }[],
    language: string,
  ): string {
    const catalogue = types
      .map((type) => {
        const fields = [
          type.tracksDuration ? 'durationSec' : null,
          type.tracksDistance ? 'distanceM, avgSpeedKmh' : null,
          type.tracksIncline ? 'inclinePercent' : null,
          type.tracksSets ? 'sets' : null,
          type.tracksReps ? 'reps' : null,
          type.tracksIntensity ? 'intensity' : null,
        ]
          .filter(Boolean)
          .join(', ');

        return `${type.slug} (${type.name}): ${fields || 'no fields'}`;
      })
      .join('\n');

    return [
      'You turn a described workout into the fields of a logging form.',
      'Answer with one JSON object and nothing else.',
      'Pick exactly one activity from this list and answer with its slug:',
      catalogue,
      'Keys: slug (string), title (short string or null), and only the fields listed for that activity.',
      'durationSec is seconds, distanceM is metres, avgSpeedKmh is km/h, reps is the total across all sets.',
      'intensity is one of LOW, MODERATE, HIGH.',
      'Estimate a sensible duration when the description implies one without saying it, such as a number of repetitions taken with rests.',
      'Never answer with calories; they are calculated elsewhere.',
      `Write the title in ${language}.`,
      'Never add commentary or extra keys.',
    ].join('\n');
  }

  private readAnswer(content: string): ModelAnswer {
    const start = content.indexOf('{');
    const end = content.lastIndexOf('}');

    if (start === -1 || end <= start) {
      throw new BadGatewayException('The provider returned an answer that is not JSON');
    }

    try {
      return JSON.parse(content.slice(start, end + 1)) as ModelAnswer;
    } catch {
      throw new BadGatewayException('The provider returned an answer that is not JSON');
    }
  }
}
