import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  sendSettlementConfirmationEmail,
  sendUserWelcomeEmail,
  sendContractRenewalRequestEmail,
  sendContractSignedNotificationEmail,
  sendContractApprovedEmail,
} from '@/lib/utils/email';

// Mock fetch globally
const mockFetch = vi.fn();
global.fetch = mockFetch;

// Mock environment variables
const originalEnv = process.env;

beforeEach(() => {
  vi.clearAllMocks();
  // Reset environment
  process.env = { ...originalEnv };
});

describe('Email Utilities', () => {
  describe('sendSettlementConfirmationEmail', () => {
    it('should not send email when Resend API key is not configured', async () => {
      process.env.RESEND_API_KEY = undefined;
      process.env.NEXT_PUBLIC_APP_URL = 'http://localhost:3000';

      await sendSettlementConfirmationEmail({
        employeeName: 'Ahmed Al Balushi',
        employeeCode: 'EMP001',
        settlementDate: '2025-05-01',
        netTotal: 1500.500,
        pdfUrl: '/settlements/123',
        processedByName: 'Admin User',
        reason: 'resignation',
      });

      expect(mockFetch).not.toHaveBeenCalled();
    });

    it('should call Resend API with correct payload when configured', async () => {
      process.env.RESEND_API_KEY = 'test-api-key';
      process.env.RESEND_FROM_EMAIL = 'noreply@company.com';
      process.env.NEXT_PUBLIC_APP_URL = 'http://localhost:3000';

      mockFetch.mockResolvedValueOnce({ ok: true });

      await sendSettlementConfirmationEmail({
        employeeName: 'Ahmed Al Balushi',
        employeeCode: 'EMP001',
        settlementDate: '2025-05-01',
        netTotal: 1500.500,
        pdfUrl: '/settlements/123',
        processedByName: 'Admin User',
        reason: 'resignation',
        toEmail: 'ahmed@example.com',
      });

      expect(mockFetch).toHaveBeenCalledWith(
        'https://api.resend.com/emails',
        expect.objectContaining({
          method: 'POST',
          headers: expect.objectContaining({
            Authorization: 'Bearer test-api-key',
            'Content-Type': 'application/json',
          }),
        })
      );

      const callArgs = mockFetch.mock.calls[0][1];
      const body = JSON.parse(callArgs.body);
      expect(body.to).toEqual(['ahmed@example.com']);
      expect(body.subject).toContain('Ahmed Al Balushi');
      expect(body.html).toContain('1500.500 OMR');
      expect(body.html).toContain('View / Download PDF');
    });

    it('should handle API errors gracefully', async () => {
      process.env.RESEND_API_KEY = 'test-api-key';
      process.env.NEXT_PUBLIC_APP_URL = 'http://localhost:3000';

      mockFetch.mockResolvedValueOnce({ ok: false, status: 400, json: () => ({ error: 'Invalid email' }) });

      // Should not throw
      await sendSettlementConfirmationEmail({
        employeeName: 'Test',
        employeeCode: 'T001',
        settlementDate: '2025-05-01',
        netTotal: 100,
        pdfUrl: '/test',
        processedByName: 'Admin',
        reason: 'termination',
      });

      expect(mockFetch).toHaveBeenCalled();
    });

    it('should use default recipient when toEmail not provided', async () => {
      process.env.RESEND_API_KEY = 'test-api-key';
      process.env.NEXT_PUBLIC_APP_URL = 'http://localhost:3000';

      mockFetch.mockResolvedValueOnce({ ok: true });

      await sendSettlementConfirmationEmail({
        employeeName: 'Test',
        employeeCode: 'T001',
        settlementDate: '2025-05-01',
        netTotal: 100,
        pdfUrl: '/test',
        processedByName: 'Admin',
        reason: 'termination',
      });

      const callArgs = mockFetch.mock.calls[0][1];
      const body = JSON.parse(callArgs.body);
      expect(body.to).toEqual(['hr@company.com']);
    });
  });

  describe('sendUserWelcomeEmail', () => {
    it('should not send when API key missing', async () => {
      process.env.RESEND_API_KEY = undefined;
      process.env.NEXT_PUBLIC_APP_URL = 'http://localhost:3000';

      await sendUserWelcomeEmail('newuser@company.com', 'TempPass123!', 'New User');

      expect(mockFetch).not.toHaveBeenCalled();
    });

    it('should send welcome email with credentials', async () => {
      process.env.RESEND_API_KEY = 'test-key';
      process.env.NEXT_PUBLIC_APP_URL = 'http://localhost:3000';

      mockFetch.mockResolvedValueOnce({ ok: true });

      await sendUserWelcomeEmail('newuser@company.com', 'TempPass123!', 'New User');

      expect(mockFetch).toHaveBeenCalled();

      const callArgs = mockFetch.mock.calls[0][1];
      const body = JSON.parse(callArgs.body);
      expect(body.to).toEqual(['newuser@company.com']);
      expect(body.subject).toContain('Welcome');
      expect(body.html).toContain('TempPass123!');
      expect(body.html).toContain('New User');
    });
  });

  describe('sendContractRenewalRequestEmail', () => {
    it('should send renewal request email', async () => {
      process.env.RESEND_API_KEY = 'test-key';
      process.env.NEXT_PUBLIC_APP_URL = 'http://localhost:3000';

      mockFetch.mockResolvedValueOnce({ ok: true });

      await sendContractRenewalRequestEmail({
        employeeName: 'Ahmed',
        employeeCode: 'EMP001',
        renewalId: 'renew-123',
        signingLink: 'http://localhost:3000/sign/abc',
        grossSalary: 1500,
        renewalPeriodYears: 2,
        initiatedByName: 'HR Admin',
      });

      expect(mockFetch).toHaveBeenCalled();

      const callArgs = mockFetch.mock.calls[0][1];
      const body = JSON.parse(callArgs.body);
      expect(body.subject).toContain('Contract Renewal Request');
      expect(body.html).toContain('1500.000 OMR');
      expect(body.html).toContain('Sign Contract Renewal');
    });
  });

  describe('sendContractSignedNotificationEmail', () => {
    it('should notify HR when employee signs', async () => {
      process.env.RESEND_API_KEY = 'test-key';
      process.env.NEXT_PUBLIC_APP_URL = 'http://localhost:3000';

      mockFetch.mockResolvedValueOnce({ ok: true });

      await sendContractSignedNotificationEmail({
        employeeName: 'Ahmed',
        employeeCode: 'EMP001',
        renewalId: 'renew-123',
      });

      expect(mockFetch).toHaveBeenCalled();

      const callArgs = mockFetch.mock.calls[0][1];
      const body = JSON.parse(callArgs.body);
      expect(body.subject).toContain('Contract Signed');
      expect(body.html).toContain('employee has signed');
    });

    it('should skip sending when no API key', async () => {
      process.env.RESEND_API_KEY = undefined;

      await sendContractSignedNotificationEmail({
        employeeName: 'Ahmed',
        employeeCode: 'EMP001',
        renewalId: 'renew-123',
      });

      expect(mockFetch).not.toHaveBeenCalled();
    });
  });

  describe('sendContractApprovedEmail', () => {
    it('should send approval notification', async () => {
      process.env.RESEND_API_KEY = 'test-key';
      process.env.NEXT_PUBLIC_APP_URL = 'http://localhost:3000';

      mockFetch.mockResolvedValueOnce({ ok: true });

      await sendContractApprovedEmail({
        employeeName: 'Ahmed',
        employeeCode: 'EMP001',
        renewalPeriodYears: 2,
        grossSalary: 1500,
      });

      expect(mockFetch).toHaveBeenCalled();

      const callArgs = mockFetch.mock.calls[0][1];
      const body = JSON.parse(callArgs.body);
      expect(body.subject).toContain('Contract Renewal Approved');
      expect(body.html).toContain('Congratulations');
      expect(body.html).toContain('1500.000 OMR');
    });
  });
});
