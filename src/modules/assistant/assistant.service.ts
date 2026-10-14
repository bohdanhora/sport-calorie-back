import { BadRequestException, Injectable } from '@nestjs/common';

import {
  addLocalDays,
  differenceInLocalDays,
  parseLocalDate,
  toLocalDateInTimeZone,
  toLocalDateString,
  todayInTimeZone,
  type LocalDateString,
} from '../../common/date/local-date';
import { PrismaService } from '../../prisma/prisma.service';
import { NutritionProviderService } from '../nutrition-provider/nutrition-provider.service';
import { ProviderChatService } from '../nutrition-provider/provider-chat.service';
import { ProgressService } from '../summary/progress.service';
import { UserContextService, type UserContext } from '../user-context/user-context.service';
import { buildDigest, type DigestProfile } from './assistant-digest';
import { chooseScope } from './assistant-scope';
import type { AskAssistantDto, AssistantAnswerDto } from './dto/assistant.dto';

const DEFAULT_DAYS = 30;
const MAX_DAYS = 366;
const ANSWER_TIMEOUT_MS = 180_000;
const ANSWER_TEMPERATURE = 0.4;
const MS_PER_YEAR = 365.25 * 86_400_000;
const HISTORY_MESSAGES = 6;

const LANGUAGE_NAMES: Record<string, string> = {
  en: 'English',
  ru: 'Russian',
  uk: 'Ukrainian',
};

const buildInstructions = (language: string, digest: string): string =>
  [
    'You are a nutrition and training coach inside a calorie tracking app.',
    "Below is the user's own log for a period. Answer their questions from it,",
    'citing concrete dates, times, meals, foods and numbers rather than generalities.',
    'When asked about lapses or overeating, look for days well above the target,',
    'eating late at night, very calorie dense snacks, weekday and meal patterns,',
    'and what tends to happen on the day before and after.',
    'Give practical, specific advice the user can act on this week.',
    'A day with nothing logged means nothing was written down, not that nothing was eaten.',
    'A time of --:-- means the entry was written down later and its time is unknown.',
    'Never invent entries that are not in the log. You are not a doctor:',
    'if something looks like a medical or eating disorder concern, say so briefly and suggest a professional.',
    `Answer in ${language}. Format with short paragraphs, "## " headings, "- " lists and **bold**;`,
    'no tables and no code blocks. Keep it reasonably short unless asked for detail.',
    '',
    digest,
  ].join('\n');

const timeFormatters = new Map<string, Intl.DateTimeFormat>();

const formatTime = (instant: Date, timeZone: string): string => {
  let formatter = timeFormatters.get(timeZone);

  if (!formatter) {
    formatter = new Intl.DateTimeFormat('en-GB', {
      timeZone,
      hour: '2-digit',
      minute: '2-digit',
      hourCycle: 'h23',
    });
    timeFormatters.set(timeZone, formatter);
  }

  return formatter.format(instant);
};

const knownTime = (
  happenedAt: Date,
  writtenAt: Date,
  localDate: LocalDateString,
  timeZone: string,
): string | null =>
  toLocalDateInTimeZone(writtenAt, timeZone) === localDate
    ? formatTime(happenedAt, timeZone)
    : null;

@Injectable()
export class AssistantService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly userContext: UserContextService,
    private readonly progress: ProgressService,
    private readonly providerService: NutritionProviderService,
    private readonly chat: ProviderChatService,
  ) {}

  async ask(userId: string, dto: AskAssistantDto): Promise<AssistantAnswerDto> {
    if (dto.messages.at(-1)?.role !== 'user') {
      throw new BadRequestException('The conversation has to end with a question');
    }

    const context = await this.userContext.getContext(userId);
    const today = todayInTimeZone(context.timezone);
    const to = dto.to ?? today;
    const from = dto.from ?? addLocalDays(to, -(DEFAULT_DAYS - 1));
    const span = differenceInLocalDays(from, to);

    if (span < 0 || span >= MAX_DAYS) {
      throw new BadRequestException(`The period has to be between 1 and ${MAX_DAYS} days`);
    }

    const credentials = await this.providerService.getCredentials(userId);
    const questions = dto.messages
      .filter((message) => message.role === 'user')
      .map((message) => message.content);
    const digest = await this.collect(context, today, from, to, questions, dto.detail === 'full');
    const language = LANGUAGE_NAMES[dto.locale ?? 'en'] ?? LANGUAGE_NAMES.en;

    const reply = await this.chat.converse(
      credentials,
      [
        { role: 'system', content: buildInstructions(language, digest) },
        ...dto.messages
          .slice(-HISTORY_MESSAGES)
          .map((message) => ({ role: message.role, content: message.content })),
      ],
      undefined,
      { json: false, temperature: ANSWER_TEMPERATURE, timeoutMs: ANSWER_TIMEOUT_MS },
    );

    return {
      answer: reply.content.trim(),
      from,
      to,
      promptTokens: reply.promptTokens,
      completionTokens: reply.completionTokens,
    };
  }

  private async collect(
    context: UserContext,
    today: LocalDateString,
    from: LocalDateString,
    to: LocalDateString,
    questions: string[],
    full: boolean,
  ): Promise<string> {
    const { userId, timezone } = context;
    const localDate = { gte: parseLocalDate(from), lte: parseLocalDate(to) };

    const [days, foods, activities] = await Promise.all([
      this.progress.getDayOverviews(userId, { from, to }),
      this.prisma.foodEntry.findMany({
        where: { userId, localDate },
        orderBy: [{ localDate: 'asc' }, { consumedAt: 'asc' }, { createdAt: 'asc' }],
      }),
      this.prisma.activityEntry.findMany({
        where: { userId, localDate },
        orderBy: [{ localDate: 'asc' }, { performedAt: 'asc' }],
        include: { activityType: { select: { name: true } } },
      }),
    ]);

    const digestFoods = foods.map((food) => {
      const date = toLocalDateString(food.localDate);

      return {
        date,
        time: knownTime(food.consumedAt, food.createdAt, date, timezone),
        meal: food.meal,
        name: food.name,
        amount: food.amount,
        unit: food.unit,
        energyKcal: food.energyKcal,
        proteinG: food.proteinG,
        carbsG: food.carbsG,
        fatG: food.fatG,
        notes: food.notes,
      };
    });

    return buildDigest({
      today,
      from,
      to,
      profile: this.describeProfile(context),
      days,
      foods: digestFoods,
      scope: chooseScope(questions, days, digestFoods, full),
      activities: activities.map((activity) => {
        const date = toLocalDateString(activity.localDate);

        return {
          date,
          time: knownTime(activity.performedAt, activity.createdAt, date, timezone),
          name: activity.title ?? activity.activityType.name,
          durationSec: activity.durationSec,
          distanceM: activity.distanceM,
          energyKcal: activity.energyKcal,
        };
      }),
    });
  }

  private describeProfile(context: UserContext): DigestProfile {
    const { profile } = context;

    return {
      sex: profile.sex,
      age: profile.birthDate
        ? Math.floor((Date.now() - profile.birthDate.getTime()) / MS_PER_YEAR)
        : null,
      heightCm: profile.heightCm,
      weightKg: context.latestWeightKg,
      targetWeightKg: profile.targetWeightKg,
      goal: profile.goal,
      activityLevel: profile.activityLevel,
    };
  }
}
