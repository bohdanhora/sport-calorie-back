import { FoodUnit, MealType } from '@prisma/client';

import { buildDigest, type DigestInput } from './assistant-digest';

const input = (overrides: Partial<DigestInput> = {}): DigestInput => ({
  today: '2026-10-15',
  from: '2026-10-14',
  to: '2026-10-15',
  profile: {
    sex: 'MALE',
    age: 30,
    heightCm: 180,
    weightKg: 82,
    targetWeightKg: null,
    goal: 'LOSE_WEIGHT',
    activityLevel: 'LIGHT',
  },
  days: [
    { date: '2026-10-14', consumedKcal: 0, targetKcal: 2100, activityKcal: 0, weightKg: null },
    { date: '2026-10-15', consumedKcal: 2860, targetKcal: 2100, activityKcal: 310, weightKg: 81.6 },
  ],
  foods: [
    {
      date: '2026-10-15',
      time: '23:40',
      meal: MealType.SNACK,
      name: 'Pizza',
      amount: 1,
      unit: FoodUnit.SERVING,
      energyKcal: 1200,
      proteinG: 40,
      carbsG: null,
      fatG: 50,
      notes: 'after a party',
    },
  ],
  activities: [],
  scope: { fullLog: 'all', activities: true },
  ...overrides,
});

describe('buildDigest', () => {
  it('describes each day against its target with the macros of its food', () => {
    const digest = buildDigest(input());

    expect(digest).toContain(
      '2026-10-15 Thu | 2860/2100 kcal | P40 C0 F50 | activity 310 kcal | weight 81.6 kg',
    );
    expect(digest).toContain('2026-10-14 Wed | nothing logged, target 2100 kcal');
  });

  it('lists each food with its time, an unknown macro and the note', () => {
    expect(buildDigest(input())).toContain(
      '2026-10-15 23:40 SNACK | Pizza | 1 serving | 1200 kcal | P40 C? F50 | note: after a party',
    );
  });

  it('marks a profile value that is missing and an empty activity log', () => {
    const digest = buildDigest(input());

    expect(digest).toContain('target weight unknown');
    expect(digest).toMatch(/Activities .*:\nnone/);
  });

  it('keeps the log to the chosen days and summarises the rest', () => {
    const digest = buildDigest(
      input({ scope: { fullLog: new Set(['2026-10-14']), activities: false } }),
    );

    expect(digest).toContain('Pizza | 1x | 1200 kcal each');
    expect(digest).toMatch(/only for days .*\n.*\nnone/);
    expect(digest).not.toContain('Activities');
  });
});
