'use client';

import { useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { AlertCircle, RefreshCw } from 'lucide-react';

export default function ErrorBoundary({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error('[AppError]', error);
  }, [error]);

  return (
    <div className="min-h-[60vh] flex items-center justify-center p-6">
      <div className="max-w-md w-full bg-card p-8 rounded-2xl border shadow-sm text-center space-y-4">
        <div className="w-14 h-14 bg-red-50 text-red-600 rounded-2xl flex items-center justify-center mx-auto shadow-inner">
          <AlertCircle className="w-7 h-7" />
        </div>
        <h2 className="text-xl font-bold text-foreground">Something went wrong</h2>
        <p className="text-sm text-muted-foreground">
          {error?.message || 'An error occurred while loading this page.'}
        </p>
        {error?.digest && (
          <p className="text-xs font-mono bg-muted p-2 rounded text-muted-foreground break-all">
            Digest: {error.digest}
          </p>
        )}
        <div className="pt-2 flex justify-center gap-3">
          <Button onClick={() => reset()} className="gap-2">
            <RefreshCw className="w-4 h-4" />
            Try Again
          </Button>
          <Button variant="outline" onClick={() => { if (typeof window !== 'undefined') window.location.href = '/dashboard'; }}>
            Go to Dashboard
          </Button>
        </div>
      </div>
    </div>
  );
}
