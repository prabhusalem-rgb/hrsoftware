// Mock for @supabase/supabase-js
import { vi } from 'vitest';

const mockSupabaseClient = vi.fn(() => ({
  auth: {
    signInWithPassword: vi.fn().mockResolvedValue({ data: { user: { id: 'auth-user-123', email: 'test@example.com' } }, error: null }),
    signUp: vi.fn().mockResolvedValue({ data: { user: { id: 'new-user-123' } }, error: null }),
    signOut: vi.fn().mockResolvedValue({ error: null }),
    getUser: vi.fn().mockResolvedValue({ data: { user: { id: 'auth-user-123' } }, error: null }),
    getSession: vi.fn().mockResolvedValue({ data: { session: { user: { id: 'auth-user-123' } } }, error: null }),
    resetPasswordForEmail: vi.fn().mockResolvedValue({ data: {}, error: null }),
    verifyOtp: vi.fn().mockResolvedValue({ data: {}, error: null }),
    confirmSignUp: vi.fn().mockResolvedValue({ data: {}, error: null }),
    refreshSession: vi.fn().mockResolvedValue({ data: { session: {} }, error: null }),
    updateUser: vi.fn().mockResolvedValue({ data: { user: {} }, error: null }),
  },
  from: vi.fn().mockReturnValue({
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    neq: vi.fn().mockReturnThis(),
    gt: vi.fn().mockReturnThis(),
    gte: vi.fn().mockReturnThis(),
    lt: vi.fn().mockReturnThis(),
    lte: vi.fn().mockReturnThis(),
    like: vi.fn().mockReturnThis(),
    ilike: vi.fn().mockReturnThis(),
    is: vi.fn().mockReturnThis(),
    in: vi.fn().mockReturnThis(),
    order: vi.fn().mockReturnThis(),
    limit: vi.fn().mockReturnThis(),
    offset: vi.fn().mockReturnThis(),
    range: vi.fn().mockReturnThis(),
    count: vi.fn().mockReturnThis(),
    single: vi.fn().mockImplementation(() => ({ data: {}, error: null })),
    maybeSingle: vi.fn().mockImplementation(() => ({ data: null, error: null })),
    insert: vi.fn().mockResolvedValue({ data: [{}], error: null }),
    update: vi.fn().mockResolvedValue({ data: [{}], error: null }),
    delete: vi.fn().mockResolvedValue({ data: [{}], error: null }),
    upsert: vi.fn().mockResolvedValue({ data: [{}], error: null }),
    execute: vi.fn().mockResolvedValue({ data: null, error: null }),
  }),
  rpc: vi.fn().mockResolvedValue({ data: null, error: null }),
  channel: vi.fn().mockReturnValue({
    on: vi.fn().mockReturnThis(),
    subscribe: vi.fn().mockReturnThis(),
    unsubscribe: vi.fn(),
  }),
  storage: {
    from: vi.fn().mockReturnValue({
      upload: vi.fn().mockResolvedValue({ data: { path: 'file.jpg' }, error: null }),
      download: vi.fn().mockResolvedValue({ data: new Blob(), error: null }),
      getPublicUrl: vi.fn().mockReturnValue({ publicURL: 'https://bucket.supabase.co/file.jpg' }),
      list: vi.fn().mockResolvedValue({ data: [], error: null }),
      remove: vi.fn().mockResolvedValue({ data: [], error: null }),
    }),
  },
}));

// createBrowserClient mock (used in client.ts)
export const createBrowserClient = mockSupabaseClient;

// createClient mock (used in server.ts and admin.ts)
export const createClient = mockSupabaseClient;

// Named export for module import
export { mockSupabaseClient as createClient as default };
