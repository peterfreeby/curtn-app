import { ListDateWindow } from './listModel'

// Combined lists filter to a date window computed in New York wall-clock time.
// Curtn is NYC-first and theater is night-heavy, so "tonight" must run to the
// end of the local evening — a UTC "end of today" would cut off around 8pm EDT
// and drop most of the night. All windows are returned as a half-open UTC
// interval [start, end) suitable for a `date: { $gte: start, $lt: end }` query.

const TZ = 'America/New_York'

// Read the New-York wall-clock components of an instant.
function nyParts (date: Date) {
  const dtf = new Intl.DateTimeFormat('en-US', {
    timeZone: TZ,
    hourCycle: 'h23',
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit',
    weekday: 'short'
  })
  const map: Record<string, string> = {}
  for (const p of dtf.formatToParts(date)) map[p.type] = p.value
  const weekdayIndex: Record<string, number> = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 }
  return {
    year: Number(map.year),
    month: Number(map.month), // 1-12
    day: Number(map.day),
    hour: Number(map.hour),
    minute: Number(map.minute),
    second: Number(map.second),
    dow: weekdayIndex[map.weekday] // 0=Sun .. 6=Sat
  }
}

// How far New York is ahead of UTC (ms) at the given instant. Negative for EST/EDT.
function nyOffsetMs (date: Date): number {
  const p = nyParts(date)
  const asIfUtc = Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, p.second)
  return asIfUtc - date.getTime()
}

// Build the UTC instant for a New-York wall-clock date/time. The offset is
// resolved at the guessed instant; window boundaries sit at midnight, away from
// the 2am DST transition, so a single pass is exact.
function nyWallToUtc (year: number, month1to12: number, day: number, hour = 0, minute = 0, second = 0, ms = 0): Date {
  const guess = Date.UTC(year, month1to12 - 1, day, hour, minute, second, ms)
  const offset = nyOffsetMs(new Date(guess))
  return new Date(guess - offset)
}

// Add `n` calendar days to a New-York (year, month, day) triple, rolling over
// months/years correctly, and return the resulting triple.
function addDays (year: number, month1to12: number, day: number, n: number) {
  const carrier = new Date(Date.UTC(year, month1to12 - 1, day))
  carrier.setUTCDate(carrier.getUTCDate() + n)
  return {
    year: carrier.getUTCFullYear(),
    month: carrier.getUTCMonth() + 1,
    day: carrier.getUTCDate()
  }
}

// Midnight (00:00 NY) of the day that is `n` days from the given NY date.
function nyMidnightPlusDays (base: { year: number, month: number, day: number }, n: number): Date {
  const d = addDays(base.year, base.month, base.day, n)
  return nyWallToUtc(d.year, d.month, d.day, 0, 0, 0)
}

/**
 * Resolve a list's date window to a half-open UTC interval [start, end).
 * `now` is injectable so the logic is unit-testable against a fixed clock.
 */
export function computeDateWindow (window: ListDateWindow, now: Date = new Date()): { start: Date, end: Date } {
  const p = nyParts(now)
  const today = { year: p.year, month: p.month, day: p.day }

  switch (window) {
    case 'tonight':
      // Now through the end of tonight (start of tomorrow, NY).
      return { start: now, end: nyMidnightPlusDays(today, 1) }

    case 'tomorrow':
      return { start: nyMidnightPlusDays(today, 1), end: nyMidnightPlusDays(today, 2) }

    case 'this_week': {
      // Now through the end of Sunday (start of the coming Monday, NY).
      const daysToNextMonday = ((1 - p.dow + 7) % 7) || 7
      return { start: now, end: nyMidnightPlusDays(today, daysToNextMonday) }
    }

    case 'next_week': {
      const daysToNextMonday = ((1 - p.dow + 7) % 7) || 7
      return {
        start: nyMidnightPlusDays(today, daysToNextMonday),
        end: nyMidnightPlusDays(today, daysToNextMonday + 7)
      }
    }

    case 'this_weekend': {
      // Sat 00:00 → Mon 00:00. On Sunday the weekend's Saturday is yesterday, so
      // clamp the start to `now` (don't reach back into Saturday's past showings).
      const satOffset = p.dow === 0 ? -1 : (6 - p.dow + 7) % 7
      const saturdayStart = nyMidnightPlusDays(today, satOffset)
      const start = saturdayStart.getTime() < now.getTime() ? now : saturdayStart
      return { start, end: nyMidnightPlusDays(today, satOffset + 2) }
    }

    case 'this_month': {
      // Now through the start of the first day of next month (NY).
      const firstOfNextMonth = p.month === 12
        ? { year: p.year + 1, month: 1, day: 1 }
        : { year: p.year, month: p.month + 1, day: 1 }
      return {
        start: now,
        end: nyWallToUtc(firstOfNextMonth.year, firstOfNextMonth.month, firstOfNextMonth.day, 0, 0, 0)
      }
    }
  }
}
