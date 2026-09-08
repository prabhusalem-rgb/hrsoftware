import { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { mockSupabaseClient } from '@/__mocks__';
import { resetMockSupabase } from '@/__mocks__';

/**
 * Create a mock NextRequest with JSON body
 */
export function createMockRequest(body: unknown): NextRequest {
  const req = new NextRequest('http://localhost:3000/test', {
    method: 'POST',
    body: JSON.stringify(body),
    headers: {
      'Content-Type': 'application/json',
    },
  });
  return req;
}

/**
 * Create a mock NextRequest with query params
 */
export function createMockGetRequest(query: Record<string, string>): NextRequest {
  const url = new URL('http://localhost:3000/test');
  Object.entries(query).forEach(([key, value]) => url.searchParams.set(key, value));

  const req = new NextRequest(url, {
    method: 'GET',
  });
  return req;
}

/**
 * Helper to mock the Supabase server client
 * This replaces the real createClient() from @/lib/supabase/server
 */
export function mockCreateClient() {
  return mockSupabaseClient;
}

/**
 * Reset all mock data between tests
 */
export function resetMocks() {
  // Reset the global mock client
  const freshClient = resetMockSupabase();
  // Note: In a real test, you'd need to replace the module
  // For now, we rely on reinitializing the mock data in each test
}

/**
 * Assert response helpers
 */
export function expectJsonResponse<T>(response: NextResponse, expectedStatus: number, expectedData?: Partial<T>) {
  expect(response.status).toBe(expectedStatus);

  if (expectedData) {
    const body = response.json() as Promise<T>;
    // We need to handle the async nature
    return body.then(data => {
      Object.entries(expectedData).forEach(([key, value]) => {
        expect(data[key]).toBe(value);
      });
      return data;
    });
  }

  return response.json();
}

/**
 * Create mock user session
 */
export function createMockUserSession(userId: string = 'user-123', role: string = 'admin') {
  return {
    user: {
      id: userId,
      email: 'test@example.com',
      user_metadata: { role },
    },
    profile: {
      id: userId,
      full_name: 'Test User',
      role,
      company_id: 'comp-1',
    },
  };
}
