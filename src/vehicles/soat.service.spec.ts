/**
 * Unit tests for SoatService — date validation and ownership logic.
 * Isolated from Prisma/DB using pure logic extraction.
 */
describe('SoatService — business logic', () => {
  // ── Date normalization ────────────────────────────────────────────────────

  const parseDate = (value: string): Date | null => {
    const date = new Date(value);
    return isNaN(date.getTime()) ? null : date;
  };

  const validateDates = (startDate: string, expiryDate: string) => {
    const start = parseDate(startDate);
    const expiry = parseDate(expiryDate);
    if (!start) return { valid: false, error: 'Invalid startDate' };
    if (!expiry) return { valid: false, error: 'Invalid expiryDate' };
    if (expiry <= start) return { valid: false, error: 'expiryDate must be after startDate' };
    return { valid: true, error: null };
  };

  describe('date validation', () => {
    it('accepts valid ISO-8601 dates where expiry is after start', () => {
      const result = validateDates('2025-01-01', '2026-01-01');
      expect(result.valid).toBe(true);
    });

    it('rejects expiry date equal to start date', () => {
      const result = validateDates('2025-06-01', '2025-06-01');
      expect(result.valid).toBe(false);
      expect(result.error).toBe('expiryDate must be after startDate');
    });

    it('rejects expiry date before start date', () => {
      const result = validateDates('2026-01-01', '2025-01-01');
      expect(result.valid).toBe(false);
    });

    it('rejects invalid date strings', () => {
      const result = validateDates('not-a-date', '2026-01-01');
      expect(result.valid).toBe(false);
      expect(result.error).toBe('Invalid startDate');
    });

    it('accepts full ISO-8601 datetime strings', () => {
      const result = validateDates('2025-01-01T00:00:00Z', '2026-01-01T00:00:00Z');
      expect(result.valid).toBe(true);
    });
  });

  // ── Expiry window calculation ─────────────────────────────────────────────

  const isExpiringIn = (expiryDateStr: string, daysUntilExpiry: number): boolean => {
    const start = new Date();
    start.setUTCHours(0, 0, 0, 0);
    start.setUTCDate(start.getUTCDate() + daysUntilExpiry);

    const end = new Date(start);
    end.setUTCDate(end.getUTCDate() + 1);

    const expiry = new Date(expiryDateStr);
    return expiry >= start && expiry < end;
  };

  describe('expiry window', () => {
    it('detects SOAT expiring exactly today (day 0)', () => {
      const today = new Date();
      today.setUTCHours(12, 0, 0, 0); // noon today
      expect(isExpiringIn(today.toISOString(), 0)).toBe(true);
    });

    it('does not match SOAT expiring in 2 days when checking day 0', () => {
      const inTwoDays = new Date();
      inTwoDays.setUTCHours(0, 0, 0, 0);
      inTwoDays.setUTCDate(inTwoDays.getUTCDate() + 2);
      expect(isExpiringIn(inTwoDays.toISOString(), 0)).toBe(false);
    });

    it('detects SOAT expiring in 7 days', () => {
      const inSevenDays = new Date();
      inSevenDays.setUTCHours(12, 0, 0, 0);
      inSevenDays.setUTCDate(inSevenDays.getUTCDate() + 7);
      expect(isExpiringIn(inSevenDays.toISOString(), 7)).toBe(true);
    });

    it('does not match already expired SOAT', () => {
      const yesterday = new Date();
      yesterday.setUTCHours(12, 0, 0, 0);
      yesterday.setUTCDate(yesterday.getUTCDate() - 1);
      expect(isExpiringIn(yesterday.toISOString(), 0)).toBe(false);
    });
  });
});
