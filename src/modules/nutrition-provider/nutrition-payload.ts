import { FoodUnit } from '@prisma/client';

import { round } from '../../domain';

export interface ParsedNutrition {
  name: string;
  amount: number;
  unit: FoodUnit;
  energyKcal: number;
  proteinG: number | null;
  carbsG: number | null;
  fatG: number | null;
}

export class UnusableProviderAnswerError extends Error {
  constructor(reason: string) {
    super(reason);
    this.name = 'UnusableProviderAnswerError';
  }
}

const MAX_NAME_LENGTH = 120;
const MAX_AMOUNT = 10_000;
const MAX_ENERGY_KCAL = 10_000;
const MAX_MACRO_GRAMS = 1000;
const FENCE_PATTERN = /^```(?:json)?\s*([\s\S]*?)\s*```$/;

const readNumber = (value: unknown): number | null => {
  const parsed = typeof value === 'string' ? Number.parseFloat(value) : value;

  return typeof parsed === 'number' && Number.isFinite(parsed) ? parsed : null;
};

const readOptionalMacro = (value: unknown): number | null => {
  const parsed = readNumber(value);

  if (parsed === null || parsed < 0 || parsed > MAX_MACRO_GRAMS) {
    return null;
  }

  return round(parsed, 1);
};

const readUnit = (value: unknown): FoodUnit => {
  const candidate = typeof value === 'string' ? value.trim().toUpperCase() : '';

  return candidate in FoodUnit ? (candidate as FoodUnit) : FoodUnit.GRAM;
};

export const stripCodeFence = (raw: string): string => {
  const trimmed = raw.trim();
  const fenced = FENCE_PATTERN.exec(trimmed);

  return fenced ? fenced[1] : trimmed;
};

export const parseNutritionPayload = (raw: string): ParsedNutrition => {
  let payload: unknown;

  try {
    payload = JSON.parse(stripCodeFence(raw));
  } catch {
    throw new UnusableProviderAnswerError('The answer was not valid JSON');
  }

  if (typeof payload !== 'object' || payload === null) {
    throw new UnusableProviderAnswerError('The answer was not an object');
  }

  const record = payload as Record<string, unknown>;
  const name = typeof record.name === 'string' ? record.name.trim().slice(0, MAX_NAME_LENGTH) : '';

  if (!name) {
    throw new UnusableProviderAnswerError('The answer had no food name');
  }

  const amount = readNumber(record.amount);
  const energyKcal = readNumber(record.energyKcal);

  if (amount === null || amount <= 0 || amount > MAX_AMOUNT) {
    throw new UnusableProviderAnswerError('The answer had no usable amount');
  }

  if (energyKcal === null || energyKcal < 0 || energyKcal > MAX_ENERGY_KCAL) {
    throw new UnusableProviderAnswerError('The answer had no usable calorie value');
  }

  return {
    name,
    amount: round(amount, 2),
    unit: readUnit(record.unit),
    energyKcal: round(energyKcal),
    proteinG: readOptionalMacro(record.proteinG),
    carbsG: readOptionalMacro(record.carbsG),
    fatG: readOptionalMacro(record.fatG),
  };
};

export const normaliseQuery = (text: string): string =>
  text.trim().toLowerCase().replace(/\s+/g, ' ').slice(0, 200);
