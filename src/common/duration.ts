const UNIT_MULTIPLIERS: Record<string, number> = {
  s: 1000,
  m: 60_000,
  h: 3_600_000,
  d: 86_400_000,
};

export const parseDurationToMs = (value: string): number => {
  const match = /^(\d+)([smhd])$/.exec(value.trim());

  if (!match) {
    throw new Error(`Unsupported duration format: ${value}`);
  }

  return Number.parseInt(match[1], 10) * UNIT_MULTIPLIERS[match[2]];
};
