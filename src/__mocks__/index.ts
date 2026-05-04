import { SupabaseMockClient, defaultMockData } from './supabase';

// Create a singleton mock client that can be imported anywhere
export const mockSupabaseClient = new SupabaseMockClient(defaultMockData);

// Export factory for fresh instances
export { createMockSupabaseClient } from './supabase';

// Helper function to reset mock state between tests
export function resetMockSupabase() {
  const freshClient = new SupabaseMockClient(defaultMockData);
  return freshClient;
}
