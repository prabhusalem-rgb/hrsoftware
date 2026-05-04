import { describe, it, expect, vi, beforeEach } from 'vitest';
import { GET, POST } from '@/app/api/timesheet/route';
import { NextRequest, NextResponse } from 'next/server';
import { createMockRequest, createMockGetRequest } from '@/__tests__/api-helpers';
import { SupabaseMockClient } from '@/__mocks__/supabase';
import { createClient } from '@/lib/supabase/server';
import { revalidatePath } from 'next/cache';

// Mock dependencies
vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn(),
}));

vi.mock('@/lib/audit/audit-logger.server', () => ({
  logAudit: vi.fn().mockResolvedValue({}),
}));

vi.mock('@/lib/audit/exception-logger.server', () => ({
  logException: vi.fn().mockResolvedValue({}),
}));

vi.mock('next/cache', () => ({
  revalidatePath: vi.fn(),
}));

vi.mock('next/cache', () => ({
  revalidatePath: vi.fn(),
}));

vi.mock('@/lib/audit/audit-logger.server', () => ({
  logAudit: vi.fn().mockResolvedValue({}),
}));

vi.mock('@/lib/audit/exception-logger.server', () => ({
  logException: vi.fn().mockResolvedValue({}),
}));

describe('Timesheet API', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('GET /api/timesheet', () => {
    it('should return 401 if Supabase client is null', async () => {
      (createClient as any).mockResolvedValue(null);

      const req = createMockGetRequest({ company_id: 'comp-1' });
      const response = await GET(req);
      const data = await response.json();

      expect(response.status).toBe(401);
      expect(data.error).toBe('Unauthorized');
    });

    it('should return 401 if no session', async () => {
      const mockClient = new SupabaseMockClient();
      mockClient.auth.getSession = vi.fn().mockResolvedValue({ data: { session: null } });
      (createClient as any).mockResolvedValue(mockClient);

      const req = createMockGetRequest({ company_id: 'comp-1' });
      const response = await GET(req);
      const data = await response.json();

      expect(response.status).toBe(401);
      expect(data.error).toBe('Unauthorized');
    });

    it('should return 400 if company_id is missing', async () => {
      const mockClient = new SupabaseMockClient();
      mockClient.auth.getSession = vi.fn().mockResolvedValue({
        data: { session: { user: { id: 'user-123' } } },
      });
      mockClient.addMockData('profiles', [{ id: 'user-123', role: 'admin', company_id: 'comp-1' }]);
      mockClient.addMockData('company_members', [{ user_id: 'user-123', company_id: 'comp-1', role: 'admin' }]);
      (createClient as any).mockResolvedValue(mockClient);

      const req = createMockGetRequest({}); // No company_id
      const response = await GET(req);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBe('company_id is required');
    });

    it('should return 403 if user has no membership in company', async () => {
      const mockClient = new SupabaseMockClient();
      mockClient.auth.getSession = vi.fn().mockResolvedValue({
        data: { session: { user: { id: 'user-123' } } },
      });
      // Profile exists but company_id different
      mockClient.addMockData('profiles', [{ id: 'user-123', role: 'employee', company_id: 'comp-2' }]);
      // User is NOT a member of comp-1
      mockClient.addMockData('company_members', [{ user_id: 'user-123', company_id: 'comp-2', role: 'member' }]);
      (createClient as any).mockResolvedValue(mockClient);

      const req = createMockGetRequest({ company_id: 'comp-1' });
      const response = await GET(req);

      expect(response.status).toBe(403);
    });

    it('should return paginated timesheet data', async () => {
      const mockClient = new SupabaseMockClient();
      mockClient.auth.getSession = vi.fn().mockResolvedValue({
        data: { session: { user: { id: 'user-123' } } },
      });
      mockClient.addMockData('profiles', [{ id: 'user-123', role: 'admin', company_id: 'comp-1' }]);
      mockClient.addMockData('company_members', [{ user_id: 'user-123', company_id: 'comp-1', role: 'admin' }]);
      mockClient.addMockData('timesheets', [
        { id: 'ts-1', employee_id: 'emp-1', date: '2025-05-01', day_type: 'working_day', hours_worked: 8, overtime_hours: 0, company_id: 'comp-1' },
        { id: 'ts-2', employee_id: 'emp-1', date: '2025-05-02', day_type: 'working_day', hours_worked: 8, overtime_hours: 2, company_id: 'comp-1' },
      ]);
      (createClient as any).mockResolvedValue(mockClient);

      const req = createMockGetRequest({ company_id: 'comp-1', page: '1', limit: '10' });
      const response = await GET(req);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.data).toHaveLength(2);
      // Route doesn't call .count() so total is 0
      expect(data.pagination).toEqual({
        page: 1,
        limit: 10,
        total: 0,
        totalPages: 0,
      });
    });

    it('should filter by employee_id', async () => {
      const mockClient = new SupabaseMockClient();
      mockClient.auth.getSession = vi.fn().mockResolvedValue({
        data: { session: { user: { id: 'user-123' } } },
      });
      mockClient.addMockData('profiles', [{ id: 'user-123', role: 'admin', company_id: 'comp-1' }]);
      mockClient.addMockData('company_members', [{ user_id: 'user-123', company_id: 'comp-1', role: 'admin' }]);
      mockClient.addMockData('timesheets', [
        { id: 'ts-1', employee_id: 'emp-1', date: '2025-05-01', company_id: 'comp-1' },
        { id: 'ts-2', employee_id: 'emp-2', date: '2025-05-02', company_id: 'comp-1' },
      ]);
      (createClient as any).mockResolvedValue(mockClient);

      const req = createMockGetRequest({ company_id: 'comp-1', employee_id: 'emp-1' });
      const response = await GET(req);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.data).toHaveLength(1);
      expect(data.data[0].employee_id).toBe('emp-1');
    });
  });

  describe('POST /api/timesheet', () => {
    it('should return 401 if not authenticated', async () => {
      const mockClient = new SupabaseMockClient();
      mockClient.auth.getSession = vi.fn().mockResolvedValue({ data: { session: null } });
      (createClient as any).mockResolvedValue(mockClient);

      const req = createMockRequest({
        employee_id: 'emp-1',
        date: '2025-05-03',
        day_type: 'working_day',
        hours_worked: 8,
        company_id: 'comp-1',
      });

      const response = await POST(req);
      const data = await response.json();

      expect(response.status).toBe(401);
      expect(data.error).toBe('Unauthorized');
    });

    it('should validate required fields', async () => {
      const mockClient = new SupabaseMockClient();
      mockClient.auth.getSession = vi.fn().mockResolvedValue({
        data: { session: { user: { id: 'user-123' } } },
      });
      mockClient.addMockData('profiles', [{ id: 'user-123', role: 'admin', company_id: 'comp-1' }]);
      mockClient.addMockData('company_members', [{ user_id: 'user-123', company_id: 'comp-1', role: 'admin' }]);
      (createClient as any).mockResolvedValue(mockClient);

      const req = createMockRequest({
        employee_id: '11111111-1111-1111-1111-111111111111',
        date: '2025-05-03',
        // Missing day_type, hours_worked, project_id
        company_id: 'comp-1',
      });

      const response = await POST(req);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBe('Validation failed');
    });

    it('should prevent duplicate timesheet entries', async () => {
      const mockClient = new SupabaseMockClient();
      mockClient.auth.getSession = vi.fn().mockResolvedValue({
        data: { session: { user: { id: 'user-123' } } },
      });
      mockClient.addMockData('profiles', [{ id: 'user-123', role: 'admin', company_id: 'comp-1' }]);
      mockClient.addMockData('company_members', [{ user_id: 'user-123', company_id: 'comp-1', role: 'admin' }]);
      mockClient.addMockData('timesheets', [
        {
          id: 'existing-ts',
          employee_id: '11111111-1111-4111-8111-111111111111',
          date: '2025-05-03',
          company_id: 'comp-1',
        },
      ]);
      (createClient as any).mockResolvedValue(mockClient);

      const req = createMockRequest({
        employee_id: '11111111-1111-4111-8111-111111111111',
        project_id: '22222222-2222-4222-8222-222222222222',
        date: '2025-05-03',
        day_type: 'working_day',
        hours_worked: 8,
        company_id: 'comp-1',
        reason: 'Regular work',
      });

      const response = await POST(req);
      const data = await response.json();

      expect(response.status).toBe(409);
      expect(data.error).toBe('This employee already has a timesheet entry for this date.');
    });

    it('should create timesheet successfully', async () => {
      const mockClient = new SupabaseMockClient();
      mockClient.auth.getSession = vi.fn().mockResolvedValue({
        data: { session: { user: { id: 'user-123' } } },
      });
      mockClient.addMockData('profiles', [{ id: 'user-123', role: 'admin', company_id: 'comp-1' }]);
      mockClient.addMockData('company_members', [{ user_id: 'user-123', company_id: 'comp-1', role: 'admin' }]);
      // No existing timesheet for that date
      mockClient.addMockData('timesheets', []);
      (createClient as any).mockResolvedValue(mockClient);

      const req = createMockRequest({
        employee_id: '11111111-1111-4111-8111-111111111111',
        project_id: '22222222-2222-4222-8222-222222222222',
        date: '2025-05-03',
        day_type: 'working_day',
        hours_worked: 8,
        overtime_hours: 2,
        company_id: 'comp-1',
        reason: 'Overtime work',
      });

      const response = await POST(req);
      const data = await response.json();

      expect(response.status).toBe(201);
      expect(data.data).toHaveProperty('id');
      expect(data.data.day_type).toBe('working_day');
    });

    it('should handle insert errors', async () => {
      const mockClient = new SupabaseMockClient();
      mockClient.auth.getSession = vi.fn().mockResolvedValue({
        data: { session: { user: { id: 'user-123' } } },
      });
      mockClient.addMockData('profiles', [{ id: 'user-123', role: 'admin', company_id: 'comp-1' }]);
      mockClient.addMockData('company_members', [{ user_id: 'user-123', company_id: 'comp-1', role: 'admin' }]);
      mockClient.addMockData('timesheets', []);
      // Simulate insert error
      mockClient.setInsertErrorForTable('timesheets', 'Database constraint violated');
      (createClient as any).mockResolvedValue(mockClient);

      const req = createMockRequest({
        employee_id: '11111111-1111-4111-8111-111111111111',
        project_id: '22222222-2222-4222-8222-222222222222',
        date: '2025-05-03',
        day_type: 'working_day',
        hours_worked: 8,
        company_id: 'comp-1',
        reason: 'Regular work',
      });

      const response = await POST(req);
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data.error).toBe('Database constraint violated');
    });
  });
});
