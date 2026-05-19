import { describe, it, expect, vi, beforeEach } from 'vitest';
import { POST } from '@/app/api/auth/login/route';
import { NextRequest, NextResponse } from 'next/server';

// Mock supabase and audit modules
vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn().mockResolvedValue({
    auth: {
      signInWithPassword: vi.fn(),
    },
  }),
}));

vi.mock('@/lib/audit/audit-logger.server', () => ({
  logAuthEvent: vi.fn().mockResolvedValue({}),
}));

vi.mock('@/lib/audit/exception-logger.server', () => ({
  logException: vi.fn().mockResolvedValue({}),
}));

describe('Auth Login API', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should return 400 if userId or password missing', async () => {
    const req = new NextRequest('http://localhost:3000/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ userId: '', password: '' }),
    });

    const response = await POST(req);
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.error).toBe('User ID and password are required');
  });

  it('should normalize user ID to email format', async () => {
    const { createClient } = await import('@/lib/supabase/server');
    const mockSupabase = {
      auth: { signInWithPassword: vi.fn().mockResolvedValue({ data: { user: { id: '123', email: 'test@hr.system' } }, error: null }) },
    };
    (createClient as any).mockResolvedValue(mockSupabase);

    const req = new NextRequest('http://localhost:3000/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ userId: 'TESTUSER', password: 'password123' }),
    });

    await POST(req);

    expect(mockSupabase.auth.signInWithPassword).toHaveBeenCalledWith({
      email: 'testuser@hr.system',
      password: 'password123',
    });
  });

  it('should accept email as userId', async () => {
    const { createClient } = await import('@/lib/supabase/server');
    const mockSupabase = {
      auth: { signInWithPassword: vi.fn().mockResolvedValue({ data: { user: { id: '123', email: 'user@example.com' } }, error: null }) },
    };
    (createClient as any).mockResolvedValue(mockSupabase);

    const req = new NextRequest('http://localhost:3000/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ userId: 'User@Example.COM', password: 'password123' }),
    });

    await POST(req);

    expect(mockSupabase.auth.signInWithPassword).toHaveBeenCalledWith({
      email: 'user@example.com',
      password: 'password123',
    });
  });

  it('should return 401 on authentication failure', async () => {
    const { createClient } = await import('@/lib/supabase/server');
    const mockSupabase = {
      auth: {
        signInWithPassword: vi.fn().mockResolvedValue({
          data: { user: null },
          error: { message: 'Invalid credentials', status: 401 },
        }),
      },
    };
    (createClient as any).mockResolvedValue(mockSupabase);

    const req = new NextRequest('http://localhost:3000/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ userId: 'test@example.com', password: 'wrong' }),
    });

    const response = await POST(req);
    const data = await response.json();

    expect(response.status).toBe(401);
    expect(data.error).toBe('Invalid credentials');
  });

  it('should return 200 with user data on successful login', async () => {
    const { createClient } = await import('@/lib/supabase/server');
    const mockUser = { id: 'user-123', email: 'test@example.com' };
    const mockSupabase = {
      auth: {
        signInWithPassword: vi.fn().mockResolvedValue({
          data: { user: mockUser },
          error: null,
        }),
      },
    };
    (createClient as any).mockResolvedValue(mockSupabase);

    const req = new NextRequest('http://localhost:3000/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ userId: 'test@example.com', password: 'correct' }),
    });

    const response = await POST(req);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.success).toBe(true);
    expect(data.user).toEqual(mockUser);
  });

  it('should handle Supabase client creation failure', async () => {
    const { createClient } = await import('@/lib/supabase/server');
    (createClient as any).mockResolvedValue(null);

    const req = new NextRequest('http://localhost:3000/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ userId: 'test', password: 'pass' }),
    });

    const response = await POST(req);
    const data = await response.json();

    expect(response.status).toBe(500);
    expect(data.error).toBe('Auth server not configured');
  });

  it('should handle unexpected errors', async () => {
    const { createClient } = await import('@/lib/supabase/server');
    (createClient as any).mockRejectedValue(new Error('Network error'));

    const req = new NextRequest('http://localhost:3000/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ userId: 'test', password: 'pass' }),
    });

    const response = await POST(req);
    const data = await response.json();

    expect(response.status).toBe(500);
    expect(data.error).toBe('Internal server error');
  });
});
