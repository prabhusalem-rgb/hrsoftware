'use client';

import { useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { AlertCircle, RefreshCw } from 'lucide-react';

export default function DashboardError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error('[DashboardError]', error);
  }, [error]);

  return (
    <div className="flex flex-col items-center justify-center min-h-[50vh] text-center p-6 bg-card border rounded-2xl shadow-sm">
      <div className="w-16 h-16 bg-red-100 text-red-600 rounded-2xl flex items-center justify-center mb-4 shadow-inner">
        <AlertCircle className="w-8 h-8" />
      </div>
      <h2 className="text-2xl font-bold tracking-tight mb-2">Error Loading Dashboard Page</h2>
      <p className="text-muted-foreground text-sm max-w-md mb-2">
        {error?.message || 'An error occurred while loading this section.'}
      </p>
      {error?.digest && (
        <p className="text-xs font-mono bg-muted px-3 py-1.5 rounded-lg text-muted-foreground mb-6">
          Digest: {error.digest}
        </p>
      )}
      <div className="flex items-center gap-3">
        <Button onClick={() => reset()} className="gap-2">
          <RefreshCw className="w-4 h-4" />
          Try Again
        </Button>
        <Button variant="outline" onClick={() => { if (typeof window !== 'undefined') window.location.href = '/dashboard'; }}>
          Return to Dashboard Home
        </Button>
      </div>
    </div>
  );
}
