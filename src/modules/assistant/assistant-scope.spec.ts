import { FoodUnit, MealType } from '@prisma/client';

import type { DigestDay, DigestFood } from './assistant-digest';
import { chooseScope } from './assistant-scope';

const day = (date: string, consumedKcal: number): DigestDay => ({
  date,
  consumedKcal,
  targetKcal: 2000,
  activityKcal: 0,
  weightKg: null,
});

const food = (date: string, time: string | null): DigestFood => ({
  date,
  time,
  meal: MealType.SNACK,
  name: 'Chips',
  amount: 1,
  unit: FoodUnit.SERVING,
  energyKcal: 500,
  proteinG: null,
  carbsG: null,
  fatG: null,
  notes: null,
});

const month = Array.from({ length: 30 }, (_, index) =>
  day(`2026-09-${String(index + 1).padStart(2, '0')}`, 1900),
);

describe('chooseScope', () => {
  it('sends everything for a short period', () => {
    expect(chooseScope(['how was my week?'], month.slice(0, 7), [])).toEqual({
      fullLog: 'all',
      activities: true,
    });
  });

  it('keeps only the days over target or with late eating for a long period', () => {
    const days = month.map((entry) =>
      entry.date === '2026-09-05' ? { ...entry, consumedKcal: 2600 } : entry,
    );
    const scope = chooseScope(['когда были срывы?'], days, [
      food('2026-09-10', '23:15'),
      food('2026-09-11', '13:00'),
      food('2026-09-12', null),
    ]);

    expect(scope.activities).toBe(false);
    expect(scope.fullLog).toEqual(new Set(['2026-09-05', '2026-09-10']));
  });

  it('sends the whole log when the user asks for detail', () => {
    expect(chooseScope(['покажи подробно что я ел'], month, []).fullLog).toBe('all');
  });

  it('includes the activities when any question is about training', () => {
    expect(chooseScope(['hi', 'как мои тренировки?'], month, []).activities).toBe(true);
  });

  it('sends every entry and activity of a long period when asked for full detail', () => {
    expect(chooseScope(['analyse my year'], month, [], true)).toEqual({
      fullLog: 'all',
      activities: true,
    });
  });
});
