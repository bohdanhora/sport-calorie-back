import { FoodUnit } from '@prisma/client';

import {
  UnusableProviderAnswerError,
  extractJsonObject,
  normaliseQuery,
  parseNutritionPayload,
} from './nutrition-payload';

describe('parseNutritionPayload', () => {
  it('reads a well formed answer', () => {
    const raw = JSON.stringify({
      name: 'Chicken breast',
      amount: 200,
      unit: 'GRAM',
      energyKcal: 330,
      proteinG: 62,
      carbsG: 0,
      fatG: 7.2,
    });

    expect(parseNutritionPayload(raw)).toEqual({
      name: 'Chicken breast',
      amount: 200,
      unit: FoodUnit.GRAM,
      energyKcal: 330,
      proteinG: 62,
      carbsG: 0,
      fatG: 7.2,
    });
  });

  it('accepts numbers that arrived as strings', () => {
    const raw = JSON.stringify({ name: 'Rice', amount: '150', energyKcal: '195' });

    expect(parseNutritionPayload(raw)).toMatchObject({ amount: 150, energyKcal: 195 });
  });

  it('unwraps a fenced code block', () => {
    const raw = '```json\n{"name":"Egg","amount":1,"unit":"PIECE","energyKcal":78}\n```';

    expect(parseNutritionPayload(raw)).toMatchObject({ name: 'Egg', unit: FoodUnit.PIECE });
  });

  it('skips the reasoning a thinking model opens with', () => {
    const raw =
      '<think>The plate holds an egg, so about 78 kcal.</think>\n' +
      '{"name":"Egg","amount":1,"unit":"PIECE","energyKcal":78}';

    expect(parseNutritionPayload(raw)).toMatchObject({ name: 'Egg', energyKcal: 78 });
  });

  it('picks the object out of a chatty answer', () => {
    const raw =
      'Here is my estimate for the photo:\n' +
      '{"name":"Egg","amount":1,"unit":"PIECE","energyKcal":78}\n' +
      'Let me know if the portion looks different.';

    expect(parseNutritionPayload(raw)).toMatchObject({ name: 'Egg', energyKcal: 78 });
  });

  it('keeps a brace that only appears inside a string', () => {
    const raw = '{"name":"Rice {special}","amount":150,"energyKcal":195}';

    expect(parseNutritionPayload(raw)).toMatchObject({ name: 'Rice {special}' });
  });

  it('falls back to grams for an unknown unit', () => {
    const raw = JSON.stringify({ name: 'Soup', amount: 1, unit: 'bowl', energyKcal: 210 });

    expect(parseNutritionPayload(raw).unit).toBe(FoodUnit.GRAM);
  });

  it('drops macros that are missing or out of range', () => {
    const raw = JSON.stringify({
      name: 'Salad',
      amount: 150,
      energyKcal: 90,
      proteinG: -2,
      carbsG: 99_999,
      fatG: null,
    });

    expect(parseNutritionPayload(raw)).toMatchObject({
      proteinG: null,
      carbsG: null,
      fatG: null,
    });
  });

  it('rejects an answer that is not JSON', () => {
    expect(() => parseNutritionPayload('roughly 300 calories')).toThrow(
      UnusableProviderAnswerError,
    );
  });

  it('rejects an answer without a name', () => {
    expect(() => parseNutritionPayload('{"amount":100,"energyKcal":200}')).toThrow(
      UnusableProviderAnswerError,
    );
  });

  it('rejects an answer without usable numbers', () => {
    expect(() => parseNutritionPayload('{"name":"Soup","amount":0,"energyKcal":10}')).toThrow(
      UnusableProviderAnswerError,
    );
    expect(() => parseNutritionPayload('{"name":"Soup","amount":100}')).toThrow(
      UnusableProviderAnswerError,
    );
  });

  it('rejects implausible calorie values', () => {
    expect(() => parseNutritionPayload('{"name":"Soup","amount":100,"energyKcal":500000}')).toThrow(
      UnusableProviderAnswerError,
    );
  });
});

describe('extractJsonObject', () => {
  it('leaves plain JSON untouched', () => {
    expect(extractJsonObject('  {"a":1}  ')).toBe('{"a":1}');
  });

  it('stops at the end of the first object', () => {
    expect(extractJsonObject('note {"a":{"b":1}} and {"c":2}')).toBe('{"a":{"b":1}}');
  });

  it('gives back what it got when there is no object at all', () => {
    expect(extractJsonObject('roughly 300 calories')).toBe('roughly 300 calories');
  });
});

describe('normaliseQuery', () => {
  it('makes equivalent queries share a cache entry', () => {
    expect(normaliseQuery('  Chicken   BREAST 200 g ')).toBe('chicken breast 200 g');
  });
});
