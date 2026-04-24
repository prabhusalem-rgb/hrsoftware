'use client';

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import React, { useState } from 'react';

/**
 * QueryProvider wraps the application in a TanStack Query context.
 * It ensures a single instance of QueryClient is created and shared
 * across the entire application for caching and synchronization.
 */
export function QueryProvider({ children }: { children: React.ReactNode }) {
  // Using useState to ensure QueryClient is only created once in the whole app life
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            // Standard defaults for HR-Payroll apps:
            // - Refresh data on focus (tab change) to ensure user sees latest state
            // - 1 minute stale time to prevent excessive re-fetching
            staleTime: 60 * 1000,
            refetchOnWindowFocus: true,
            retry: 1, // Only retry once to avoid excessive loading on failures
          },
        },
      })
  );

  return (
    <QueryClientProvider client={queryClient}>
      {children}
    </QueryClientProvider>
  );
}
