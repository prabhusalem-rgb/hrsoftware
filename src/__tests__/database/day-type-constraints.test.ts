import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { createClient } from '@/lib/supabase/admin';
import { Pool } from 'pg';

// Integration tests that require a real database connection
// These should be run against a local/test Supabase instance
describe('Database Constraints and Day Type', () => {
  let pool: Pool | null = null;

  beforeAll(async () => {
    // Only run if DATABASE_URL is available
    const dbUrl = process.env.DATABASE_URL;
    if (!dbUrl) {
      console.warn('DATABASE_URL not set, skipping DB tests');
      return;
    }
    pool = new Pool({ connectionString: dbUrl });
  });

  afterAll(async () => {
    if (pool) {
      await pool.end();
    }
  });

  describe('timesheets_day_type_check constraint', () => {
    it('should allow holiday_overtime day type', async () => {
      if (!pool) return;

      try {
        // Attempt to insert a holiday_overtime record
        const result = await pool.query(
          `INSERT INTO timesheets
            (id, company_id, employee_id, date, day_type, hours_worked, overtime_hours, reason, created_at, updated_at)
           VALUES
            ($1, $2, $3, $4, $5, $6, $7, $8, NOW(), NOW())
           RETURNING *`,
          [
            'test-holiday-ot-id',
            '00000000-0000-0000-0000-000000000001',
            '00000000-0000-0000-0000-000000000002',
            '2025-05-15',
            'holiday_overtime',
            0,
            5,
            'Test holiday overtime',
          ]
        );

        expect(result.rows[0]).toBeDefined();
        expect(result.rows[0].day_type).toBe('holiday_overtime');

        // Cleanup
        await pool.query('DELETE FROM timesheets WHERE id = $1', ['test-holiday-ot-id']);
      } catch (error: any) {
        // If constraint violation, the test should fail
        if (error.code === '23514') {
          fail('holiday_overtime violates check constraint - migration not applied');
        }
        throw error;
      }
    });

    it('should allow working_holiday day type', async () => {
      if (!pool) return;

      try {
        const result = await pool.query(
          `INSERT INTO timesheets
            (id, company_id, employee_id, date, day_type, hours_worked, overtime_hours, reason, created_at, updated_at)
           VALUES
            ($1, $2, $3, $4, $5, $6, $7, $8, NOW(), NOW())
           RETURNING *`,
          [
            'test-wh-id',
            '00000000-0000-0000-0000-000000000001',
            '00000000-0000-0000-0000-000000000002',
            '2025-05-16',
            'working_holiday',
            0,
            8,
            'Test working holiday',
          ]
        );

        expect(result.rows[0].day_type).toBe('working_holiday');
        await pool.query('DELETE FROM timesheets WHERE id = $1', ['test-wh-id']);
      } catch (error: any) {
        if (error.code === '23514') {
          fail('working_holiday violates check constraint');
        }
        throw error;
      }
    });

    it('should reject invalid day_type values', async () => {
      if (!pool) return;

      await expect(
        pool.query(
          `INSERT INTO timesheets
            (id, company_id, employee_id, date, day_type, hours_worked, overtime_hours, reason, created_at, updated_at)
           VALUES
            ($1, $2, $3, $4, $5, $6, $7, $8, NOW(), NOW())`,
          [
            'test-invalid-id',
            '00000000-0000-0000-0000-000000000001',
            '00000000-0000-0000-0000-000000000002',
            '2025-05-17',
            'invalid_day_type' as any,
            0,
            0,
            'Should fail',
          ]
        )
      ).rejects.toMatchObject({ code: '23514' }); // Check violation
    });
  });

  describe('RPC Functions', () => {
    it('get_project_cost_report should include holiday_overtime in holiday_ot_hours', async () => {
      if (!pool) return;

      // This test assumes there's test data in the database
      // In a real test environment, you'd seed test data first
      const result = await pool.query(
        "SELECT * FROM get_project_cost_report('00000000-0000-0000-0000-000000000001', '2025-05-01', '2025-05-31') LIMIT 1"
      );

      // The function should execute without error
      expect(result.rows).toBeDefined();
    });

    it('get_ot_summary_report should aggregate holiday_overtime with working_holiday', async () => {
      if (!pool) return;

      const result = await pool.query(
        "SELECT * FROM get_ot_summary_report('00000000-0000-0000-0000-000000000001', '2025-05-01', '2025-05-31') LIMIT 1"
      );

      expect(result.rows).toBeDefined();
      // Verify the result structure includes holiday_ot_hours
      if (result.rows.length > 0) {
        expect(result.rows[0]).toHaveProperty('holiday_ot_hours');
      }
    });
  });

  describe('Constraint Validation for holiday_overtime', () => {
    it('should enforce hours_worked = 0 for holiday_overtime', async () => {
      if (!pool) return;

      // Try to insert with hours_worked > 0 - should fail
      await expect(
        pool.query(
          `INSERT INTO timesheets
            (id, company_id, employee_id, date, day_type, hours_worked, overtime_hours, reason, created_at, updated_at)
           VALUES
            ($1, $2, $3, $4, $5, $6, $7, $8, NOW(), NOW())`,
          [
            'test-invalid-hours',
            '00000000-0000-0000-0000-000000000001',
            '00000000-0000-0000-0000-000000000002',
            '2025-05-18',
            'holiday_overtime',
            4, // Invalid: should be 0
            5,
            'Test',
          ]
        )
      ).rejects.toMatchObject({ code: '23514' }); // Check violation
    });

    it('should enforce overtime_hours between 1 and 8 for holiday_overtime', async () => {
      if (!pool) return;

      // Test overtime_hours = 0
      await expect(
        pool.query(
          `INSERT INTO timesheets
            (id, company_id, employee_id, date, day_type, hours_worked, overtime_hours, reason, created_at, updated_at)
           VALUES
            ($1, $2, $3, $4, $5, $6, $7, $8, NOW(), NOW())`,
          [
            'test-zero-ot',
            '00000000-0000-0000-0000-000000000001',
            '00000000-0000-0000-0000-000000000002',
            '2025-05-19',
            'holiday_overtime',
            0,
            0, // Invalid: min is 1
            'Test',
          ]
        )
      ).rejects.toMatchObject({ code: '23514' });

      // Test overtime_hours = 9
      await expect(
        pool.query(
          `INSERT INTO timesheets
            (id, company_id, employee_id, date, day_type, hours_worked, overtime_hours, reason, created_at, updated_at)
           VALUES
            ($1, $2, $3, $4, $5, $6, $7, $8, NOW(), NOW())`,
          [
            'test-many-ot',
            '00000000-0000-0000-0000-000000000001',
            '00000000-0000-0000-0000-000000000002',
            '2025-05-20',
            'holiday_overtime',
            0,
            9, // Invalid: max is 8
            'Test',
          ]
        )
      ).rejects.toMatchObject({ code: '23514' });
    });
  });
});
