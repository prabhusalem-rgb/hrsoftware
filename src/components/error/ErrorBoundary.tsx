'use client';

import { Component, ErrorInfo, ReactNode } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { AlertTriangle, RefreshCw } from 'lucide-react';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

/**
 * Global Error Boundary
 * Catches rendering errors in child components and logs them
 * to the exceptions table via the /api/client-error endpoint.
 */
export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public async componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    // Log the error to our exceptions table via API
    try {
      const errorInfoString = errorInfo.componentStack || 'No stack trace';

      const payload = {
        error_type: 'frontend_error',
        error_code: `FE_${error.name || 'Error'}`,
        message: error.message,
        stack_trace: `${error.stack}\n\nComponent Stack:\n${errorInfoString}`,
        route: typeof window !== 'undefined' ? window.location.pathname : 'unknown',
        method: 'CLIENT',
        severity: error.message.includes('critical') || error.message.includes('fatal') ? 'critical' : 'high',
        context: {
          component_stack: errorInfo.componentStack,
          user_agent: typeof navigator !== 'undefined' ? navigator.userAgent : undefined,
          url: typeof window !== 'undefined' ? window.location.href : undefined,
        },
      };

      // Use sendBeacon for reliability (works even on page unload)
      if (navigator.sendBeacon) {
        const blob = new Blob([JSON.stringify(payload)], { type: 'application/json' });
        navigator.sendBeacon('/api/client-error', blob);
      } else {
        await fetch('/api/client-error', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
          keepalive: true,
        });
      }
    } catch (loggingError) {
      console.error('Failed to log caught error:', loggingError);
    }

    // Show error toast
    toast.error('An unexpected error occurred. The issue has been logged.');
  }

  private handleReset = () => {
    this.setState({ hasError: false, error: null });
    window.location.reload();
  };

  public render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      return (
        <div className="flex flex-col items-center justify-center min-h-[400px] p-8 text-center">
          <div className="rounded-full bg-destructive/10 p-4 mb-4">
            <AlertTriangle className="h-12 w-12 text-destructive" />
          </div>
          <h2 className="text-2xl font-bold mb-2">Something went wrong</h2>
          <p className="text-muted-foreground mb-6 max-w-md">
            An unexpected error occurred. The incident has been logged and our team will investigate.
          </p>
          {this.state.error && (
            <details className="mb-6 text-left w-full max-w-md">
              <summary className="cursor-pointer text-sm text-muted-foreground hover:text-foreground">
                Error details
              </summary>
              <pre className="mt-2 p-4 bg-muted rounded-md text-xs overflow-auto max-h-[200px]">
                {this.state.error.message}
              </pre>
            </details>
          )}
          <Button onClick={this.handleReset} size="lg">
            <RefreshCw className="h-4 w-4 mr-2" />
            Reload Page
          </Button>
        </div>
      );
    }

    return this.props.children;
  }
}
