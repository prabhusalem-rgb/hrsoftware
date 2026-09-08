import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest, NextResponse } from 'next/server';
import { SupabaseMockClient } from '@/__mocks__/supabase';

// Mock dependencies
vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn(),
}));

// Create a mock admin client using SupabaseMockClient
const mockAdminClient = new SupabaseMockClient();

// Initialize with admin profile
mockAdminClient.addMockData('profiles', [
  { id: 'admin-123', role: 'super_admin', company_id: null },
]);

vi.mock('@/lib/supabase/admin', () => ({
  supabaseAdmin: {
    auth: {
      admin: {
        createUser: vi.fn(),
        updateUserById: vi.fn(),
        deleteUser: vi.fn(),
      },
    },
    from: vi.fn().mockImplementation((table: string) => {
      return mockAdminClient.from(table);
    }),
  },
}));

describe('Users API', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Reset profiles to have admin user
    mockAdminClient.addMockData('profiles', [
      { id: 'admin-123', role: 'super_admin', company_id: null },
    ]);
  });

  describe('POST /api/users', () => {
    it('should return 400 if required fields missing', async () => {
      const { POST: POSTHandler } = await import('@/app/api/users/route');
      const { createClient } = await import('@/lib/supabase/server');
      const mockSupabase = {
        auth: { getUser: vi.fn().mockResolvedValue({ data: { user: { id: 'user-123' } } }) },
      };
      (createClient as any).mockResolvedValue(mockSupabase);

      const req = new NextRequest('http://localhost:3000/api/users', {
        method: 'POST',
        body: JSON.stringify({}),
      });

      const response = await POSTHandler(req);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBe('User ID and full name are required');
    });

    it('should reject non-super-admin users', async () => {
      const { POST: POSTHandler } = await import('@/app/api/users/route');
      const { createClient } = await import('@/lib/supabase/server');
      const { supabaseAdmin } = await import('@/lib/supabase/admin');

      const mockSupabase = {
        auth: { getUser: vi.fn().mockResolvedValue({ data: { user: { id: 'user-123', user_metadata: { role: 'employee' } } } }) },
      };
      (createClient as any).mockResolvedValue(mockSupabase);

      // Override profiles: user-123 has role employee (not super_admin)
      mockAdminClient.addMockData('profiles', [
        { id: 'user-123', role: 'employee', company_id: null },
      ]);

      const req = new NextRequest('http://localhost:3000/api/users', {
        method: 'POST',
        body: JSON.stringify({ userId: 'newuser', full_name: 'New User' }),
      });

      const response = await POSTHandler(req);
      const data = await response.json();

      expect(response.status).toBe(403);
      expect(data.error).toBe('Only Super Admins can create new users');
    });

    it('should create user successfully for super admin', async () => {
      const { POST: POSTHandler } = await import('@/app/api/users/route');
      const { createClient } = await import('@/lib/supabase/server');
      const { supabaseAdmin } = await import('@/lib/supabase/admin');

      const mockSupabase = {
        auth: { getUser: vi.fn().mockResolvedValue({ data: { user: { id: 'admin-123', user_metadata: { role: 'super_admin' } } } }) },
      };
      (createClient as any).mockResolvedValue(mockSupabase);

      const mockUserData = { user: { id: 'new-user-id', email: 'newuser@hr.system' } };
      (supabaseAdmin.auth.admin.createUser as any).mockResolvedValue({ data: mockUserData, error: null });

      const req = new NextRequest('http://localhost:3000/api/users', {
        method: 'POST',
        body: JSON.stringify({
          userId: 'newuser',
          full_name: 'New User',
          role: 'admin',
          company_id: 'comp-1',
        }),
      });

      const response = await POSTHandler(req);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.user).toBeDefined();
    });

    it('should normalize company_id - "all" becomes null', async () => {
      const { POST: POSTHandler } = await import('@/app/api/users/route');
      const { createClient } = await import('@/lib/supabase/server');
      const { supabaseAdmin } = await import('@/lib/supabase/admin');

      const mockSupabase = {
        auth: { getUser: vi.fn().mockResolvedValue({ data: { user: { id: 'admin-123', user_metadata: { role: 'super_admin' } } } }) },
      };
      (createClient as any).mockResolvedValue(mockSupabase);

      const mockUserData = { user: { id: 'new-user-id', email: 'newuser@hr.system' } };
      (supabaseAdmin.auth.admin.createUser as any).mockResolvedValue({ data: mockUserData, error: null });

      // Get the profiles builder to capture upsert call
      let capturedUpsertValues: any = null;
      const originalFrom = mockAdminClient.from.bind(mockAdminClient);
      mockAdminClient.from = vi.fn().mockImplementation((table: string) => {
        const builder = originalFrom(table);
        if (table === 'profiles') {
          const originalUpsert = builder.upsert.bind(builder);
          builder.upsert = (values: any, options?: any) => {
            capturedUpsertValues = values;
            return originalUpsert(values, options);
          };
        }
        return builder;
      });

      const req = new NextRequest('http://localhost:3000/api/users', {
        method: 'POST',
        body: JSON.stringify({
          userId: 'newuser',
          full_name: 'New Name',
          company_id: 'all',
        }),
      });

      await POSTHandler(req);

      // Check that upsert was called with company_id: null
      expect(capturedUpsertValues).toBeDefined();
      expect(capturedUpsertValues.company_id).toBeNull();
    });

    it('should generate random password if not provided', async () => {
      const { POST: POSTHandler } = await import('@/app/api/users/route');
      const { createClient } = await import('@/lib/supabase/server');
      const { supabaseAdmin } = await import('@/lib/supabase/admin');

      const mockSupabase = {
        auth: { getUser: vi.fn().mockResolvedValue({ data: { user: { id: 'admin-123', user_metadata: { role: 'super_admin' } } } }) },
      };
      (createClient as any).mockResolvedValue(mockSupabase);

      (supabaseAdmin.auth.admin.createUser as any).mockResolvedValue({
        data: { user: { id: 'new-user-id' } },
        error: null,
      });

      const req = new NextRequest('http://localhost:3000/api/users', {
        method: 'POST',
        body: JSON.stringify({ userId: 'newuser', full_name: 'New User' }), // No password
      });

      const response = await POSTHandler(req);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.generatedPassword).toBeDefined();
      expect(typeof data.generatedPassword).toBe('string');
      expect(data.generatedPassword.length).toBeGreaterThan(8);
    });
  });

  describe('PUT /api/users', () => {
    it('should return 400 if id is missing', async () => {
      const { PUT: PUTHandler } = await import('@/app/api/users/route');
      const req = new NextRequest('http://localhost:3000/api/users', {
        method: 'PUT',
        body: JSON.stringify({ full_name: 'Updated Name' }),
      });

      const response = await PUTHandler(req);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBe('User ID is required');
    });

    it('should handle password reset action', async () => {
      const { PUT: PUTHandler } = await import('@/app/api/users/route');
      const { createClient } = await import('@/lib/supabase/server');
      const { supabaseAdmin } = await import('@/lib/supabase/admin');

      const mockSupabase = {
        auth: { getUser: vi.fn().mockResolvedValue({ data: { user: { id: 'admin-123', user_metadata: { role: 'super_admin' } } } }) },
      };
      (createClient as any).mockResolvedValue(mockSupabase);

      (supabaseAdmin.auth.admin.updateUserById as any).mockResolvedValue({ error: null });

      const req = new NextRequest('http://localhost:3000/api/users', {
        method: 'PUT',
        body: JSON.stringify({ id: 'user-123', action: 'reset_password' }),
      });

      const response = await PUTHandler(req);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.newPassword).toBeDefined();
    });

    it('should update user profile', async () => {
      const { PUT: PUTHandler } = await import('@/app/api/users/route');
      const { createClient } = await import('@/lib/supabase/server');
      const { supabaseAdmin } = await import('@/lib/supabase/admin');

      const mockSupabase = {
        auth: { getUser: vi.fn().mockResolvedValue({ data: { user: { id: 'admin-123', user_metadata: { role: 'super_admin' } } } }) },
      };
      (createClient as any).mockResolvedValue(mockSupabase);

      // Add the target user profile to mock data
      mockAdminClient.addMockData('profiles', [
        { id: 'admin-123', role: 'super_admin', company_id: null },
        { id: 'user-123', role: 'employee', company_id: 'comp-old' },
      ]);

      let capturedUpdateData: any = null;
      const originalFrom = mockAdminClient.from.bind(mockAdminClient);
      mockAdminClient.from = vi.fn().mockImplementation((table: string) => {
        const builder = originalFrom(table);
        if (table === 'profiles') {
          const originalUpdate = builder.update.bind(builder);
          builder.update = (values: any) => {
            capturedUpdateData = values;
            return originalUpdate(values);
          };
        }
        return builder;
      });

      const req = new NextRequest('http://localhost:3000/api/users', {
        method: 'PUT',
        body: JSON.stringify({
          id: 'user-123',
          full_name: 'Updated Name',
          role: 'admin',
          company_id: 'comp-1',
        }),
      });

      const response = await PUTHandler(req);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(capturedUpdateData).toEqual({
        full_name: 'Updated Name',
        role: 'admin',
        company_id: 'comp-1',
        updated_at: expect.any(String),
      });
    });

    it('should update password when provided', async () => {
      const { PUT: PUTHandler } = await import('@/app/api/users/route');
      const { createClient } = await import('@/lib/supabase/server');
      const { supabaseAdmin } = await import('@/lib/supabase/admin');

      const mockSupabase = {
        auth: { getUser: vi.fn().mockResolvedValue({ data: { user: { id: 'admin-123', user_metadata: { role: 'super_admin' } } } }) },
      };
      (createClient as any).mockResolvedValue(mockSupabase);

      (supabaseAdmin.auth.admin.updateUserById as any).mockResolvedValue({ error: null });

      const req = new NextRequest('http://localhost:3000/api/users', {
        method: 'PUT',
        body: JSON.stringify({
          id: 'user-123',
          password: 'NewPassword123!',
        }),
      });

      await PUTHandler(req);

      expect(supabaseAdmin.auth.admin.updateUserById).toHaveBeenCalledWith('user-123', expect.objectContaining({
        password: 'NewPassword123!',
      }));
    });
  });

  describe('DELETE /api/users', () => {
    it('should return 400 if id is missing', async () => {
      const { DELETE: DELETEHandler } = await import('@/app/api/users/route');
      const req = new NextRequest('http://localhost:3000/api/users?id=', {
        method: 'DELETE',
      });

      const response = await DELETEHandler(req);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBe('User ID is required');
    });

    it('should delete user successfully for super admin', async () => {
      const { DELETE: DELETEHandler } = await import('@/app/api/users/route');
      const { createClient } = await import('@/lib/supabase/server');
      const { supabaseAdmin } = await import('@/lib/supabase/admin');

      const mockSupabase = {
        auth: { getUser: vi.fn().mockResolvedValue({ data: { user: { id: 'admin-123', user_metadata: { role: 'super_admin' } } } }) },
      };
      (createClient as any).mockResolvedValue(mockSupabase);

      // Add target user profile
      mockAdminClient.addMockData('profiles', [
        { id: 'admin-123', role: 'super_admin', company_id: null },
        { id: 'user-123', role: 'employee', company_id: 'comp-1' },
      ]);

      (supabaseAdmin.auth.admin.deleteUser as any).mockResolvedValue({ error: null });

      const req = new NextRequest('http://localhost:3000/api/users?id=user-123', {
        method: 'DELETE',
      });

      const response = await DELETEHandler(req);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
    });

    it('should reject non-super-admin delete attempt', async () => {
      const { DELETE: DELETEHandler } = await import('@/app/api/users/route');
      const { createClient } = await import('@/lib/supabase/server');
      const mockSupabase = {
        auth: { getUser: vi.fn().mockResolvedValue({ data: { user: { id: 'user-123', user_metadata: { role: 'employee' } } } }) },
      };
      (createClient as any).mockResolvedValue(mockSupabase);

      const req = new NextRequest('http://localhost:3000/api/users?id=user-456', {
        method: 'DELETE',
      });

      const response = await DELETEHandler(req);
      const data = await response.json();

      expect(response.status).toBe(403);
      expect(data.error).toBe('Only Super Admins can delete users');
    });
  });
});
