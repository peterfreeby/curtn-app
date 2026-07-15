import { computeDateWindow } from '../dateWindows'

// Windows are computed in America/New_York, returned as half-open UTC [start, end).
// Midnight NY = 04:00Z under EDT (summer) and 05:00Z under EST (winter) — the
// summer/winter cases below exercise both so the DST offset can't silently drift.
describe('computeDateWindow', () => {
  describe('summer — Wed 2026-07-15 15:00 EDT (19:00Z), midnight NY = 04:00Z', () => {
    const now = new Date('2026-07-15T19:00:00Z')

    it('tonight runs from now to the start of tomorrow (NY)', () => {
      const { start, end } = computeDateWindow('tonight', now)
      expect(start.toISOString()).toBe('2026-07-15T19:00:00.000Z')
      expect(end.toISOString()).toBe('2026-07-16T04:00:00.000Z')
    })

    it('tomorrow is the whole of the next NY day', () => {
      const { start, end } = computeDateWindow('tomorrow', now)
      expect(start.toISOString()).toBe('2026-07-16T04:00:00.000Z')
      expect(end.toISOString()).toBe('2026-07-17T04:00:00.000Z')
    })

    it('this_week runs from now to the coming Monday 00:00 (NY)', () => {
      const { start, end } = computeDateWindow('this_week', now)
      expect(start.toISOString()).toBe('2026-07-15T19:00:00.000Z')
      expect(end.toISOString()).toBe('2026-07-20T04:00:00.000Z')
    })

    it('next_week is the following Mon→Mon (NY)', () => {
      const { start, end } = computeDateWindow('next_week', now)
      expect(start.toISOString()).toBe('2026-07-20T04:00:00.000Z')
      expect(end.toISOString()).toBe('2026-07-27T04:00:00.000Z')
    })

    it('this_weekend (midweek) is the coming Sat 00:00 → Mon 00:00 (NY)', () => {
      const { start, end } = computeDateWindow('this_weekend', now)
      expect(start.toISOString()).toBe('2026-07-18T04:00:00.000Z')
      expect(end.toISOString()).toBe('2026-07-20T04:00:00.000Z')
    })

    it('this_month runs from now to the first of next month (NY)', () => {
      const { start, end } = computeDateWindow('this_month', now)
      expect(start.toISOString()).toBe('2026-07-15T19:00:00.000Z')
      expect(end.toISOString()).toBe('2026-08-01T04:00:00.000Z')
    })
  })

  describe('winter/DST — Sun 2026-01-11 22:00 EST (2026-01-12 03:00Z), midnight NY = 05:00Z', () => {
    const now = new Date('2026-01-12T03:00:00Z')

    it('tonight ends at midnight NY using the EST offset', () => {
      const { end } = computeDateWindow('tonight', now)
      expect(end.toISOString()).toBe('2026-01-12T05:00:00.000Z')
    })

    it('this_weekend on Sunday night clamps start to now (no reaching back to Saturday)', () => {
      const { start, end } = computeDateWindow('this_weekend', now)
      expect(start.toISOString()).toBe('2026-01-12T03:00:00.000Z')
      expect(end.toISOString()).toBe('2026-01-12T05:00:00.000Z')
    })

    it('this_week on Sunday ends at the very next Monday (NY)', () => {
      const { end } = computeDateWindow('this_week', now)
      expect(end.toISOString()).toBe('2026-01-12T05:00:00.000Z')
    })
  })

  it('rolls this_month across a year boundary (December → January)', () => {
    const now = new Date('2026-12-20T17:00:00Z') // Dec 20 12:00 EST
    const { end } = computeDateWindow('this_month', now)
    expect(end.toISOString()).toBe('2027-01-01T05:00:00.000Z')
  })
})
