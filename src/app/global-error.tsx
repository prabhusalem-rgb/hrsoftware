'use client';

import { useEffect } from 'react';

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error('[GlobalError]', error);
  }, [error]);

  return (
    <html>
      <body className="min-h-screen flex items-center justify-center bg-slate-50 p-6 font-sans">
        <div className="max-w-md w-full bg-white p-8 rounded-2xl border shadow-lg text-center space-y-4">
          <div className="w-12 h-12 bg-red-100 text-red-600 rounded-xl flex items-center justify-center mx-auto text-xl font-bold">
            !
          </div>
          <h2 className="text-xl font-bold text-slate-900">Application Error</h2>
          <p className="text-sm text-slate-500">
            {error?.message || 'An unexpected error occurred during rendering.'}
          </p>
          {error?.digest && (
            <p className="text-xs font-mono bg-slate-100 p-2 rounded text-slate-600 break-all">
              Error Digest: {error.digest}
            </p>
          )}
          <div className="pt-2">
            <button
              onClick={() => reset()}
              className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-sm font-medium transition-colors"
            >
              Try Again
            </button>
          </div>
        </div>
      </body>
    </html>
  );
}
