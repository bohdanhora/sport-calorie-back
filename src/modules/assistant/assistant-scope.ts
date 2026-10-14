import type { LocalDateString } from '../../common/date/local-date';
import type { DigestDay, DigestFood } from './assistant-digest';

export interface DigestScope {
  fullLog: 'all' | Set<LocalDateString>;
  activities: boolean;
}

const FULL_LOG_MAX_DAYS = 14;
const OVER_TARGET_RATIO = 1.1;
const LATE_FROM = '21:00';
const LATE_UNTIL = '05:00';

const ACTIVITY_WORDS =
  /трен|актив|спорт|ходьб|ходил|шаг|бег|біг|зал|кардио|кардіо|упражн|вправ|workout|train|exercis|activit|walk|run|gym|cardio|sport|step/i;

const DETAIL_WORDS =
  /подробн|детал|все записи|всё что|все що|каждый|каждую|кожн|детальн|every|detail|all (the )?entries|full log|everything/i;

const isLate = (time: string | null): boolean =>
  time !== null && (time >= LATE_FROM || time < LATE_UNTIL);

export const chooseScope = (
  questions: string[],
  days: DigestDay[],
  foods: DigestFood[],
  full = false,
): DigestScope => {
  const text = questions.join('\n');
  const everything = full || days.length <= FULL_LOG_MAX_DAYS;
  const activities = everything || ACTIVITY_WORDS.test(text);

  if (everything || DETAIL_WORDS.test(text)) {
    return { fullLog: 'all', activities };
  }

  const notable = new Set(
    days
      .filter((day) => day.consumedKcal > day.targetKcal * OVER_TARGET_RATIO)
      .map((day) => day.date),
  );

  for (const food of foods) {
    if (isLate(food.time)) {
      notable.add(food.date);
    }
  }

  return { fullLog: notable, activities };
};
