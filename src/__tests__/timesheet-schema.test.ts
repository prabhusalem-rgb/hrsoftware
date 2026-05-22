import { describe, it, expect } from 'vitest';
import { timesheetSubmitSchema, dayTypeEnum, DayTypeLabels } from '@/lib/validations/schemas';

describe('Timesheet Schema Validation', () => {
  const validBasePayload = {
    token: 'valid-token-123',
    employee_id: '550e8400-e29b-41d4-a716-446655440000',
    project_id: '660e8400-e29b-41d4-a716-446655440000',
    date: '2025-05-15',
    day_type: 'working_day' as DayType,
    hours_worked: 8,
    overtime_hours: 0,
    reason: '',
  };

  describe('dayTypeEnum', () => {
    it('should include all four day types', () => {
      expect(dayTypeEnum).toContain('working_day');
      expect(dayTypeEnum).toContain('working_holiday');
      expect(dayTypeEnum).toContain('holiday_overtime');
      expect(dayTypeEnum).toContain('absent');
    });

    it('should have exactly 4 values', () => {
      expect(dayTypeEnum).toHaveLength(4);
    });
  });

  describe('DayTypeLabels', () => {
    it('should have labels for all day types', () => {
      expect(DayTypeLabels.working_day).toBe('Working Day');
      expect(DayTypeLabels.working_holiday).toBe('Working Holiday');
      expect(DayTypeLabels.holiday_overtime).toBe('Holiday Overtime');
      expect(DayTypeLabels.absent).toBe('Absent');
    });
  });

  describe('working_day validation', () => {
    it('accepts valid working_day with 8 regular hours and no OT', () => {
      const payload = {
        ...validBasePayload,
        day_type: 'working_day',
        hours_worked: 8,
        overtime_hours: 0,
      };
      expect(() => timesheetSubmitSchema.parse(payload)).not.toThrow();
    });

    it('accepts working_day with 4 regular hours (half-day)', () => {
      const payload = {
        ...validBasePayload,
        day_type: 'working_day',
        hours_worked: 4,
        overtime_hours: 0,
      };
      expect(() => timesheetSubmitSchema.parse(payload)).not.toThrow();
    });

    it('accepts working_day with regular hours + overtime', () => {
      const payload = {
        ...validBasePayload,
        day_type: 'working_day',
        hours_worked: 8,
        overtime_hours: 3,
        reason: 'Extra work needed',
      };
      expect(() => timesheetSubmitSchema.parse(payload)).not.toThrow();
    });

    it('rejects working_day with hours_worked < 0.5', () => {
      const payload = {
        ...validBasePayload,
        day_type: 'working_day',
        hours_worked: 0.25,
      };
      const result = timesheetSubmitSchema.safeParse(payload);
      expect(result.success).toBe(false);
      // The schema refine catches this with a generic message
      expect(result.error?.issues[0].message).toBe('Invalid hours configuration for selected day type');
    });

    it('rejects working_day with hours_worked > 8', () => {
      const payload = {
        ...validBasePayload,
        day_type: 'working_day',
        hours_worked: 9,
      };
      const result = timesheetSubmitSchema.safeParse(payload);
      expect(result.success).toBe(false);
    });
  });

  describe('holiday_overtime validation', () => {
    it('accepts holiday_overtime with 1 hour OT', () => {
      const payload = {
        ...validBasePayload,
        day_type: 'holiday_overtime',
        hours_worked: 0,
        overtime_hours: 1,
        reason: 'Public holiday work',
      };
      expect(() => timesheetSubmitSchema.parse(payload)).not.toThrow();
    });

    it('accepts holiday_overtime with 8 hours OT', () => {
      const payload = {
        ...validBasePayload,
        day_type: 'holiday_overtime',
        hours_worked: 0,
        overtime_hours: 8,
        reason: 'Full holiday shift',
      };
      expect(() => timesheetSubmitSchema.parse(payload)).not.toThrow();
    });

    it('accepts all OT values from 1 to 8', () => {
      for (let i = 1; i <= 8; i++) {
        const payload = {
          ...validBasePayload,
          day_type: 'holiday_overtime',
          hours_worked: 0,
          overtime_hours: i,
          reason: `Holiday OT ${i}hrs`,
        };
        expect(() => timesheetSubmitSchema.parse(payload)).not.toThrow();
      }
    });

    it('rejects holiday_overtime with hours_worked > 0', () => {
      const payload = {
        ...validBasePayload,
        day_type: 'holiday_overtime',
        hours_worked: 4, // Should be 0
        overtime_hours: 4,
      };
      const result = timesheetSubmitSchema.safeParse(payload);
      expect(result.success).toBe(false);
    });

    it('rejects holiday_overtime with overtime_hours = 0', () => {
      const payload = {
        ...validBasePayload,
        day_type: 'holiday_overtime',
        hours_worked: 0,
        overtime_hours: 0,
      };
      const result = timesheetSubmitSchema.safeParse(payload);
      expect(result.success).toBe(false);
    });

    it('rejects holiday_overtime with overtime_hours > 8', () => {
      const payload = {
        ...validBasePayload,
        day_type: 'holiday_overtime',
        hours_worked: 0,
        overtime_hours: 9,
      };
      const result = timesheetSubmitSchema.safeParse(payload);
      expect(result.success).toBe(false);
    });

    it('requires reason for holiday_overtime (overtime > 0)', () => {
      const payload = {
        ...validBasePayload,
        day_type: 'holiday_overtime',
        hours_worked: 0,
        overtime_hours: 5,
        reason: '', // Empty reason
      };
      const result = timesheetSubmitSchema.safeParse(payload);
      expect(result.success).toBe(false);
      expect(result.error?.issues[0].message).toContain('Reason is required');
    });
  });

  describe('working_holiday validation (legacy)', () => {
    it('accepts working_holiday with exactly 8 OT hours', () => {
      const payload = {
        ...validBasePayload,
        day_type: 'working_holiday',
        hours_worked: 0,
        overtime_hours: 8,
        reason: 'Legacy holiday entry',
      };
      expect(() => timesheetSubmitSchema.parse(payload)).not.toThrow();
    });

    it('rejects working_holiday with OT hours not equal to 8', () => {
      const payload = {
        ...validBasePayload,
        day_type: 'working_holiday',
        hours_worked: 0,
        overtime_hours: 5,
      };
      const result = timesheetSubmitSchema.safeParse(payload);
      expect(result.success).toBe(false);
    });
  });

  describe('absent validation', () => {
    it('requires reason for absent', () => {
      const payload = {
        ...validBasePayload,
        day_type: 'absent',
        hours_worked: 0,
        overtime_hours: 0,
        reason: '',
      };
      const result = timesheetSubmitSchema.safeParse(payload);
      expect(result.success).toBe(false);
      expect(result.error?.issues[0].message).toContain('Reason is required');
    });

    it('rejects absent with hours_worked > 0', () => {
      const payload = {
        ...validBasePayload,
        day_type: 'absent',
        hours_worked: 4,
        overtime_hours: 0,
      };
      const result = timesheetSubmitSchema.safeParse(payload);
      expect(result.success).toBe(false);
    });

    it('requires reason for absent', () => {
      const payload = {
        ...validBasePayload,
        day_type: 'absent',
        hours_worked: 0,
        overtime_hours: 0,
        reason: '',
      };
      const result = timesheetSubmitSchema.safeParse(payload);
      expect(result.success).toBe(false);
      expect(result.error?.issues[0].message).toContain('Reason is required');
    });
  });

  describe('required fields', () => {
    it('requires token', () => {
      const payload = { ...validBasePayload, token: '' };
      const result = timesheetSubmitSchema.safeParse(payload);
      expect(result.success).toBe(false);
    });

    it('requires employee_id', () => {
      const payload = { ...validBasePayload, employee_id: '' };
      const result = timesheetSubmitSchema.safeParse(payload);
      expect(result.success).toBe(false);
    });

    it('requires date in YYYY-MM-DD format', () => {
      const payload = { ...validBasePayload, date: 'invalid-date' };
      const result = timesheetSubmitSchema.safeParse(payload);
      expect(result.success).toBe(false);
    });

    it('rejects future dates', () => {
      const futureDate = new Date();
      futureDate.setDate(futureDate.getDate() + 10);
      const payload = {
        ...validBasePayload,
        date: futureDate.toISOString().split('T')[0],
      };
      const result = timesheetSubmitSchema.safeParse(payload);
      expect(result.success).toBe(false);
    });

    it('requires project_id', () => {
      const payload = { ...validBasePayload, project_id: '' };
      const result = timesheetSubmitSchema.safeParse(payload);
      expect(result.success).toBe(false);
    });
  });

  describe('hours_worked constraints', () => {
    it('enforces maximum of 8 hours', () => {
      const payload = { ...validBasePayload, hours_worked: 10 };
      const result = timesheetSubmitSchema.safeParse(payload);
      expect(result.success).toBe(false);
    });

    it('enforces non-negative hours', () => {
      const payload = { ...validBasePayload, hours_worked: -1 };
      const result = timesheetSubmitSchema.safeParse(payload);
      expect(result.success).toBe(false);
    });
  });

  describe('overtime_hours constraints', () => {
    it('enforces maximum of 16 hours', () => {
      const payload = { ...validBasePayload, overtime_hours: 17 };
      const result = timesheetSubmitSchema.safeParse(payload);
      expect(result.success).toBe(false);
    });

    it('enforces non-negative overtime', () => {
      const payload = { ...validBasePayload, overtime_hours: -1 };
      const result = timesheetSubmitSchema.safeParse(payload);
      expect(result.success).toBe(false);
    });
  });

  describe('reason field', () => {
    it('accepts reason up to 500 characters', () => {
      const longReason = 'a'.repeat(500);
      const payload = {
        ...validBasePayload,
        day_type: 'holiday_overtime',
        hours_worked: 0,
        overtime_hours: 5,
        reason: longReason,
      };
      expect(() => timesheetSubmitSchema.parse(payload)).not.toThrow();
    });

    it('rejects reason exceeding 500 characters', () => {
      const longReason = 'a'.repeat(501);
      const payload = {
        ...validBasePayload,
        day_type: 'holiday_overtime',
        hours_worked: 0,
        overtime_hours: 5,
        reason: longReason,
      };
      const result = timesheetSubmitSchema.safeParse(payload);
      expect(result.success).toBe(false);
    });
  });

  describe('reason requirement refinement', () => {
    it('does NOT require reason for working_day with no OT', () => {
      const payload = {
        ...validBasePayload,
        day_type: 'working_day',
        hours_worked: 8,
        overtime_hours: 0,
        reason: '',
      };
      expect(() => timesheetSubmitSchema.parse(payload)).not.toThrow();
    });

    it('requires reason for working_day with OT > 0', () => {
      const payload = {
        ...validBasePayload,
        day_type: 'working_day',
        hours_worked: 8,
        overtime_hours: 2,
        reason: '',
      };
      const result = timesheetSubmitSchema.safeParse(payload);
      expect(result.success).toBe(false);
    });
  });
});
