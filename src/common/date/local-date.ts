export type LocalDateString = string;

export const LOCAL_DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

const MS_PER_DAY = 86_400_000;
const MIDDAY_HOUR = 12;

const partFormatters = new Map<string, Intl.DateTimeFormat>();

const getPartFormatter = (timeZone: string): Intl.DateTimeFormat => {
  const cached = partFormatters.get(timeZone);
  if (cached) {
    return cached;
  }

  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone,
    hour12: false,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });

  partFormatters.set(timeZone, formatter);
  return formatter;
};

interface ZonedParts {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  second: number;
}

const getZonedParts = (instant: Date, timeZone: string): ZonedParts => {
  const parts = getPartFormatter(timeZone).formatToParts(instant);
  const read = (type: Intl.DateTimeFormatPartTypes): number =>
    Number.parseInt(parts.find((part) => part.type === type)?.value ?? '0', 10);

  const hour = read('hour');

  return {
    year: read('year'),
    month: read('month'),
    day: read('day'),
    hour: hour === 24 ? 0 : hour,
    minute: read('minute'),
    second: read('second'),
  };
};

const pad = (value: number, length = 2): string => String(value).padStart(length, '0');

export const isValidTimeZone = (timeZone: string): boolean => {
  try {
    new Intl.DateTimeFormat('en-US', { timeZone });
    return true;
  } catch {
    return false;
  }
};

export const isValidLocalDate = (value: string): boolean => {
  if (!LOCAL_DATE_PATTERN.test(value)) {
    return false;
  }

  const parsed = new Date(`${value}T00:00:00.000Z`);
  return !Number.isNaN(parsed.getTime()) && toLocalDateString(parsed) === value;
};

export const toLocalDateString = (utcMidnight: Date): LocalDateString =>
  `${pad(utcMidnight.getUTCFullYear(), 4)}-${pad(utcMidnight.getUTCMonth() + 1)}-${pad(utcMidnight.getUTCDate())}`;

export const toLocalDateInTimeZone = (instant: Date, timeZone: string): LocalDateString => {
  const { year, month, day } = getZonedParts(instant, timeZone);
  return `${pad(year, 4)}-${pad(month)}-${pad(day)}`;
};

export const parseLocalDate = (value: LocalDateString): Date => new Date(`${value}T00:00:00.000Z`);

export const todayInTimeZone = (timeZone: string, now = new Date()): LocalDateString =>
  toLocalDateInTimeZone(now, timeZone);

export const addLocalDays = (value: LocalDateString, days: number): LocalDateString =>
  toLocalDateString(new Date(parseLocalDate(value).getTime() + days * MS_PER_DAY));

export const differenceInLocalDays = (from: LocalDateString, to: LocalDateString): number =>
  Math.round((parseLocalDate(to).getTime() - parseLocalDate(from).getTime()) / MS_PER_DAY);

export const enumerateLocalDates = (
  from: LocalDateString,
  to: LocalDateString,
): LocalDateString[] => {
  const total = differenceInLocalDays(from, to);
  if (total < 0) {
    return [];
  }

  return Array.from({ length: total + 1 }, (_, index) => addLocalDays(from, index));
};

const getTimeZoneOffsetMs = (instant: Date, timeZone: string): number => {
  const { year, month, day, hour, minute, second } = getZonedParts(instant, timeZone);
  const asIfUtc = Date.UTC(
    year,
    month - 1,
    day,
    hour,
    minute,
    second,
    instant.getUTCMilliseconds(),
  );
  return asIfUtc - instant.getTime();
};

export const zonedTimeToInstant = (
  localDate: LocalDateString,
  timeZone: string,
  hour = 0,
  minute = 0,
): Date => {
  const [year, month, day] = localDate.split('-').map((part) => Number.parseInt(part, 10));
  const naiveUtc = Date.UTC(year, month - 1, day, hour, minute, 0, 0);
  const firstGuess = naiveUtc - getTimeZoneOffsetMs(new Date(naiveUtc), timeZone);
  const correction = getTimeZoneOffsetMs(new Date(firstGuess), timeZone);

  return new Date(naiveUtc - correction);
};

export const instantForLocalDate = (
  localDate: LocalDateString,
  timeZone: string,
  now = new Date(),
): Date =>
  todayInTimeZone(timeZone, now) === localDate
    ? now
    : zonedTimeToInstant(localDate, timeZone, MIDDAY_HOUR);
