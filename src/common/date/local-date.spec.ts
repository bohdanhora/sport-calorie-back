import {
  addLocalDays,
  differenceInLocalDays,
  enumerateLocalDates,
  instantForLocalDate,
  isValidLocalDate,
  isValidTimeZone,
  toLocalDateInTimeZone,
  todayInTimeZone,
  zonedTimeToInstant,
} from './local-date';

describe('toLocalDateInTimeZone', () => {
  it('assigns a late-night entry to the local day, not the UTC day', () => {
    const instant = new Date('2026-03-01T22:30:00.000Z');

    expect(toLocalDateInTimeZone(instant, 'Europe/Kyiv')).toBe('2026-03-02');
    expect(toLocalDateInTimeZone(instant, 'UTC')).toBe('2026-03-01');
    expect(toLocalDateInTimeZone(instant, 'America/New_York')).toBe('2026-03-01');
  });

  it('assigns an early-morning entry west of UTC to the previous local day', () => {
    const instant = new Date('2026-03-02T03:00:00.000Z');

    expect(toLocalDateInTimeZone(instant, 'America/New_York')).toBe('2026-03-01');
    expect(toLocalDateInTimeZone(instant, 'Asia/Tokyo')).toBe('2026-03-02');
  });
});

describe('zonedTimeToInstant', () => {
  it('resolves local midday to the correct instant on standard time', () => {
    expect(zonedTimeToInstant('2026-01-15', 'Europe/Kyiv', 12).toISOString()).toBe(
      '2026-01-15T10:00:00.000Z',
    );
  });

  it('resolves local midday to the correct instant on daylight saving time', () => {
    expect(zonedTimeToInstant('2026-06-15', 'Europe/Kyiv', 12).toISOString()).toBe(
      '2026-06-15T09:00:00.000Z',
    );
  });

  it('round-trips back to the same local date', () => {
    const instant = zonedTimeToInstant('2026-06-15', 'Pacific/Auckland', 0);

    expect(toLocalDateInTimeZone(instant, 'Pacific/Auckland')).toBe('2026-06-15');
  });
});

describe('instantForLocalDate', () => {
  it('uses the current time when logging for today', () => {
    const now = new Date('2026-03-02T09:15:00.000Z');

    expect(instantForLocalDate('2026-03-02', 'Europe/Kyiv', now)).toEqual(now);
  });

  it('uses local midday when backfilling another day', () => {
    const now = new Date('2026-03-02T09:15:00.000Z');

    expect(instantForLocalDate('2026-02-27', 'Europe/Kyiv', now).toISOString()).toBe(
      '2026-02-27T10:00:00.000Z',
    );
  });
});

describe('local date arithmetic', () => {
  it('adds days across month boundaries', () => {
    expect(addLocalDays('2026-02-28', 1)).toBe('2026-03-01');
    expect(addLocalDays('2026-03-01', -1)).toBe('2026-02-28');
  });

  it('measures whole days between dates', () => {
    expect(differenceInLocalDays('2026-03-01', '2026-03-08')).toBe(7);
  });

  it('enumerates an inclusive range', () => {
    expect(enumerateLocalDates('2026-03-01', '2026-03-04')).toEqual([
      '2026-03-01',
      '2026-03-02',
      '2026-03-03',
      '2026-03-04',
    ]);
  });

  it('returns nothing for an inverted range', () => {
    expect(enumerateLocalDates('2026-03-04', '2026-03-01')).toEqual([]);
  });
});

describe('validation', () => {
  it('rejects dates that do not exist', () => {
    expect(isValidLocalDate('2026-02-30')).toBe(false);
    expect(isValidLocalDate('2026-2-3')).toBe(false);
    expect(isValidLocalDate('2026-02-28')).toBe(true);
  });

  it('recognises IANA timezones', () => {
    expect(isValidTimeZone('Europe/Kyiv')).toBe(true);
    expect(isValidTimeZone('Mars/Olympus')).toBe(false);
  });
});

describe('todayInTimeZone', () => {
  it('reads the calendar day of the given timezone', () => {
    expect(todayInTimeZone('Asia/Tokyo', new Date('2026-03-01T20:00:00.000Z'))).toBe('2026-03-02');
  });
});
