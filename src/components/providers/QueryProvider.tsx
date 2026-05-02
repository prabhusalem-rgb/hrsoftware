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
            // Performance-optimized defaults:
            // - 5 minute stale time reduces unnecessary re-fetches
            // - 10 minute gcTime keeps unused data in memory
            staleTime: 5 * 60 * 1000,
            gcTime: 10 * 60 * 1000,
            // Don't refetch on focus for better offline experience
            refetchOnWindowFocus: false,
            // Don't refetch on reconnect to avoid sudden loading states
            refetchOnReconnect: false,
            // Retry failed queries once
            retry: 1,
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
