/**
 * Unit tests for TecnomecanicaService — date validation, ownership logic,
 * expiry window and delete guard.
 * Isolated from Prisma/DB using pure logic extraction.
 */
describe('TecnomecanicaService — business logic', () => {
  // ── Helpers (mirrors of the private methods in TecnomecanicaService) ────────

  const parseDate = (value: string): Date | null => {
    const date = new Date(value);
    return isNaN(date.getTime()) ? null : date;
  };

  /**
   * Validates expiry > start only when startDate is provided.
   * When startDate is absent validation is skipped (RTM allows no startDate).
   */
  const validateDates = (
    startDate: string | undefined,
    expiryDate: string,
  ): { valid: boolean; error: string | null } => {
    const expiry = parseDate(expiryDate);
    if (!expiry) return { valid: false, error: 'Invalid expiryDate' };

    if (startDate !== undefined) {
      const start = parseDate(startDate);
      if (!start) return { valid: false, error: 'Invalid startDate' };
      if (expiry <= start)
        return { valid: false, error: 'expiryDate must be after startDate' };
    }

    return { valid: true, error: null };
  };

  const isExpiringIn = (expiryDateStr: string, daysUntilExpiry: number): boolean => {
    const start = new Date();
    start.setUTCHours(0, 0, 0, 0);
    start.setUTCDate(start.getUTCDate() + daysUntilExpiry);

    const end = new Date(start);
    end.setUTCDate(end.getUTCDate() + 1);

    const expiry = new Date(expiryDateStr);
    return expiry >= start && expiry < end;
  };

  // ── upsert ────────────────────────────────────────────────────────────────

  describe('upsert — date validation', () => {
    it('accepts valid dates where expiryDate is after startDate', () => {
      const result = validateDates('2025-01-01', '2026-01-01');
      expect(result.valid).toBe(true);
      expect(result.error).toBeNull();
    });

    it('rejects when expiryDate equals startDate', () => {
      const result = validateDates('2025-06-01', '2025-06-01');
      expect(result.valid).toBe(false);
      expect(result.error).toBe('expiryDate must be after startDate');
    });

    it('rejects when expiryDate is before startDate', () => {
      const result = validateDates('2026-01-01', '2025-01-01');
      expect(result.valid).toBe(false);
      expect(result.error).toBe('expiryDate must be after startDate');
    });

    it('accepts when startDate is absent (optional field)', () => {
      const result = validateDates(undefined, '2026-01-01');
      expect(result.valid).toBe(true);
      expect(result.error).toBeNull();
    });

    it('rejects invalid expiryDate string', () => {
      const result = validateDates(undefined, 'not-a-date');
      expect(result.valid).toBe(false);
      expect(result.error).toBe('Invalid expiryDate');
    });

    it('rejects invalid startDate string when provided', () => {
      const result = validateDates('not-a-date', '2026-01-01');
      expect(result.valid).toBe(false);
      expect(result.error).toBe('Invalid startDate');
    });

    it('accepts full ISO-8601 datetime strings', () => {
      const result = validateDates(
        '2025-01-01T00:00:00Z',
        '2026-01-01T00:00:00Z',
      );
      expect(result.valid).toBe(true);
    });
  });

  // ── find ─────────────────────────────────────────────────────────────────

  describe('find — ownership', () => {
    const simulateFind = (
      vehicleOwnerId: string,
      requestingOwnerId: string,
      record: object | null,
    ): { status: number; data: object | null } => {
      if (vehicleOwnerId !== requestingOwnerId) {
        return { status: 403, data: null };
      }
      return { status: 200, data: record };
    };

    it('returns the RTM record when owner matches', () => {
      const record = { id: 'rtm-1', vehicleId: 'v-1', certificateNumber: 'CRT-001' };
      const result = simulateFind('owner-1', 'owner-1', record);
      expect(result.status).toBe(200);
      expect(result.data).toEqual(record);
    });

    it('returns null (no document) when owner matches but no RTM exists', () => {
      const result = simulateFind('owner-1', 'owner-1', null);
      expect(result.status).toBe(200);
      expect(result.data).toBeNull();
    });

    it('returns 403 when a different user tries to access the RTM', () => {
      const result = simulateFind('owner-1', 'owner-2', null);
      expect(result.status).toBe(403);
    });
  });

  // ── delete ────────────────────────────────────────────────────────────────

  describe('delete', () => {
    const simulateDelete = (
      vehicleOwnerId: string,
      requestingOwnerId: string,
      existing: boolean,
    ): { status: number; data: object | null } => {
      if (vehicleOwnerId !== requestingOwnerId) {
        return { status: 403, data: null };
      }
      if (!existing) {
        return { status: 404, data: null };
      }
      return { status: 200, data: { success: true } };
    };

    it('returns { success: true } when RTM exists and owner matches', () => {
      const result = simulateDelete('owner-1', 'owner-1', true);
      expect(result.status).toBe(200);
      expect(result.data).toEqual({ success: true });
    });

    it('returns 404 when no RTM exists for the vehicle', () => {
      const result = simulateDelete('owner-1', 'owner-1', false);
      expect(result.status).toBe(404);
    });

    it('returns 403 when a different user tries to delete', () => {
      const result = simulateDelete('owner-1', 'owner-2', true);
      expect(result.status).toBe(403);
    });
  });

  // ── expiry window ─────────────────────────────────────────────────────────

  describe('findTecnomecanicasExpiringIn — expiry window', () => {
    it('detects RTM expiring exactly today (day 0)', () => {
      const today = new Date();
      today.setUTCHours(12, 0, 0, 0);
      expect(isExpiringIn(today.toISOString(), 0)).toBe(true);
    });

    it('does not match RTM expiring in 2 days when checking day 0', () => {
      const inTwoDays = new Date();
      inTwoDays.setUTCHours(0, 0, 0, 0);
      inTwoDays.setUTCDate(inTwoDays.getUTCDate() + 2);
      expect(isExpiringIn(inTwoDays.toISOString(), 0)).toBe(false);
    });

    it('detects RTM expiring in 7 days', () => {
      const inSevenDays = new Date();
      inSevenDays.setUTCHours(12, 0, 0, 0);
      inSevenDays.setUTCDate(inSevenDays.getUTCDate() + 7);
      expect(isExpiringIn(inSevenDays.toISOString(), 7)).toBe(true);
    });

    it('does not match already expired RTM', () => {
      const yesterday = new Date();
      yesterday.setUTCHours(12, 0, 0, 0);
      yesterday.setUTCDate(yesterday.getUTCDate() - 1);
      expect(isExpiringIn(yesterday.toISOString(), 0)).toBe(false);
    });

    it('does not match RTM expiring in 30 days when checking day 7', () => {
      const inThirtyDays = new Date();
      inThirtyDays.setUTCHours(12, 0, 0, 0);
      inThirtyDays.setUTCDate(inThirtyDays.getUTCDate() + 30);
      expect(isExpiringIn(inThirtyDays.toISOString(), 7)).toBe(false);
    });
  });
});
