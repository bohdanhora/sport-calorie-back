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
const THINKING_PATTERN = /<think>[\s\S]*?<\/think>/gi;
const FENCE_PATTERN = /```(?:json)?\s*([\s\S]*?)```/i;

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

const sliceFirstObject = (text: string): string | null => {
  const start = text.indexOf('{');

  if (start < 0) {
    return null;
  }

  let depth = 0;
  let inString = false;
  let escaped = false;

  for (let index = start; index < text.length; index += 1) {
    const character = text[index];

    if (escaped) {
      escaped = false;
    } else if (inString) {
      if (character === '\\') {
        escaped = true;
      } else if (character === '"') {
        inString = false;
      }
    } else if (character === '"') {
      inString = true;
    } else if (character === '{') {
      depth += 1;
    } else if (character === '}') {
      depth -= 1;

      if (depth === 0) {
        return text.slice(start, index + 1);
      }
    }
  }

  return null;
};

export const extractJsonObject = (raw: string): string => {
  const spoken = raw.replace(THINKING_PATTERN, '');
  const fenced = FENCE_PATTERN.exec(spoken);
  const text = (fenced ? fenced[1] : spoken).trim();

  return sliceFirstObject(text) ?? text;
};

export const parseNutritionPayload = (raw: string): ParsedNutrition => {
  let payload: unknown;

  try {
    payload = JSON.parse(extractJsonObject(raw));
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
