import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { logGlobalError, flushLogs } from '@/lib/error-handlers';

describe('Error Handlers', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should batch logs and send via sendBeacon', async () => {
    const mockSendBeacon = vi.fn().mockReturnValue(true);
    // @ts-ignore - mock navigator
    global.navigator = {
      sendBeacon: mockSendBeacon,
    };

    // Trigger two errors
    logGlobalError(new Error('Test error 1'), 'error');
    logGlobalError(new Error('Test error 2'), 'unhandledrejection');

    // Wait for debounce
    await new Promise(resolve => setTimeout(resolve, 100));

    // Manually flush for testing
    await flushLogs();

    expect(mockSendBeacon).toHaveBeenCalled();
  });

  it('should handle fetch fallback when sendBeacon unavailable', async () => {
    const mockFetch = vi.fn().mockResolvedValue({ ok: true });
    global.fetch = mockFetch;
    // @ts-ignore - mock navigator without sendBeacon
    global.navigator = {};

    logGlobalError(new Error('Test error'), 'error');
    await new Promise(resolve => setTimeout(resolve, 100));
    await flushLogs();

    expect(mockFetch).toHaveBeenCalledWith(
      '/api/client-error',
      expect.objectContaining({
        method: 'POST',
      })
    );
  });

  it('should include error details in payload', async () => {
    const mockSendBeacon = vi.fn();
    // @ts-ignore
    global.navigator = { sendBeacon: mockSendBeacon };

    const testError = new Error('Specific error message');
    testError.stack = 'Error: Specific error message\n    at Test';

    logGlobalError(testError, 'error');
    await new Promise(resolve => setTimeout(resolve, 100));
    await flushLogs();

    const sentData = JSON.parse(mockSendBeacon.mock.calls[0][1]);
    expect(sentData.message).toBe('Specific error message');
    expect(sentData.error_type).toBe('unhandled_error');
    expect(sentData.severity).toBe('high');
  });

  it('should handle string errors', async () => {
    const mockSendBeacon = vi.fn();
    // @ts-ignore
    global.navigator = { sendBeacon: mockSendBeacon };

    logGlobalError('String error message', 'unhandledrejection');
    await new Promise(resolve => setTimeout(resolve, 100));
    await flushLogs();

    const sentData = JSON.parse(mockSendBeacon.mock.calls[0][1]);
    expect(sentData.message).toBe('String error message');
    expect(sentData.error_type).toBe('unhandled_promise');
  });
});
