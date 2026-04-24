/**
 * Global Error Handlers
 * Captures unhandled errors and unhandled promise rejections
 * and logs them to the exceptions table via fetch.
 */

// Debounce to avoid spamming the server
let pendingLog: { type: string; error: any; ts: number }[] = [];
let logTimeout: NodeJS.Timeout | null = null;

async function logGlobalError(error: Error | string | Event, type: 'unhandledrejection' | 'error') {
  const message = error instanceof Error ? error.message : String(error);
  const stack = error instanceof Error ? error.stack : undefined;

  const payload = {
    error_type: type === 'unhandledrejection' ? 'unhandled_promise' : 'unhandled_error',
    message,
    stack_trace: stack,
    route: typeof window !== 'undefined' ? window.location.pathname : 'unknown',
    method: 'CLIENT_GLOBAL',
    severity: 'high' as const,
    context: {
      type,
      user_agent: typeof navigator !== 'undefined' ? navigator.userAgent : undefined,
      url: typeof window !== 'undefined' ? window.location.href : undefined,
      timestamp: new Date().toISOString(),
    },
  };

  pendingLog.push({ type, error: payload, ts: Date.now() });

  // Debounce - batch logs every 2 seconds
  if (logTimeout) clearTimeout(logTimeout);
  logTimeout = setTimeout(flushLogs, 2000);
}

async function flushLogs() {
  if (pendingLog.length === 0) return;

  const logs = [...pendingLog];
  pendingLog = [];

  // Send logs to our logging endpoint
  // Note: We use navigator.sendBeacon for reliability, but fallback to fetch
  for (const log of logs) {
    try {
      const blob = new Blob([JSON.stringify(log.error)], { type: 'application/json' });

      if (navigator.sendBeacon) {
        navigator.sendBeacon('/api/client-error', log.error);
      } else {
        await fetch('/api/client-error', {
          method: 'POST',
          body: blob,
          headers: { 'Content-Type': 'application/json' },
          keepalive: true,
        });
      }
    } catch {
      // Silent fail - we don't want logging to break anything
    }
  }
}

// Register global handlers
if (typeof window !== 'undefined') {
  window.addEventListener('error', (event) => {
    logGlobalError(event.error || event.message, 'error');
  });

  window.addEventListener('unhandledrejection', (event) => {
    logGlobalError(event.reason, 'unhandledrejection');
  });

  // Also handle resource loading errors
  window.addEventListener('load', () => {
    setTimeout(() => {
      // Log any errors that occurred during page load
      const errors = performance.getEntriesByType('resource')
        .filter((r) => (r as any).name && (r as any).name.includes('error'));

      if (errors.length > 0) {
        console.warn('Resource loading errors detected:', errors);
      }
    }, 1000);
  });
}
