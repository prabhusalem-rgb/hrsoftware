import { describe, it, expect, vi, beforeEach } from 'vitest';
import { loginSubmitter, logoutSubmitter, getSubmitterSession } from '@/app/timesheet/[token]/actions';
import { getAdminClient } from '@/lib/supabase/admin';
import { cookies } from 'next/headers';

vi.mock('@/lib/supabase/admin', () => ({
  getAdminClient: vi.fn(),
}));

vi.mock('next/headers', () => ({
  cookies: vi.fn(),
}));

describe('Public Timesheet Submitter Authentication', () => {
  const mockToken = 'valid-token-uuid-1234';
  const mockCompanyId = 'company-uuid-1111';

  const mockEmployee = {
    id: 'emp-uuid-2222',
    name_en: 'Ahmed Al-Harthy',
    emp_code: 'EMP-001',
    civil_id: '12345678',
    status: 'active',
    category: 'DIRECT_STAFF',
    company_id: mockCompanyId,
  };

  const mockTimesheetLink = {
    id: 'link-uuid-3333',
    token: mockToken,
    company_id: mockCompanyId,
    is_active: true,
    expires_at: new Date(Date.now() + 86400000).toISOString(),
  };

  let mockCookieStore: any;

  function createMockSupabase(overrides?: {
    linkData?: any;
    linkError?: any;
    employeesData?: any[];
    empError?: any;
    singleEmpData?: any;
  }) {
    const linkData = overrides && 'linkData' in overrides ? overrides.linkData : mockTimesheetLink;
    const linkError = overrides?.linkError || null;
    const employeesData = overrides && 'employeesData' in overrides ? overrides.employeesData : [mockEmployee];
    const empError = overrides?.empError || null;
    const singleEmpData = overrides && 'singleEmpData' in overrides ? overrides.singleEmpData : mockEmployee;

    return {
      from: vi.fn((table: string) => {
        if (table === 'timesheet_links') {
          const queryObj: any = {
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockReturnThis(),
            maybeSingle: vi.fn().mockResolvedValue({
              data: linkData,
              error: linkError,
            }),
          };
          return queryObj;
        }
        if (table === 'employees') {
          const queryObj: any = {
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockReturnThis(),
            maybeSingle: vi.fn().mockResolvedValue({
              data: singleEmpData,
              error: empError,
            }),
            then: (resolve: any) =>
              resolve({
                data: employeesData,
                error: empError,
              }),
          };
          return queryObj;
        }
        return {};
      }),
    };
  }

  beforeEach(() => {
    vi.clearAllMocks();

    mockCookieStore = {
      get: vi.fn(),
      set: vi.fn(),
      delete: vi.fn(),
    };
    (cookies as any).mockResolvedValue(mockCookieStore);
  });

  it('rejects login if token or credentials are empty', async () => {
    const res = await loginSubmitter('', 'EMP-001', '12345678');
    expect(res.success).toBe(false);
    expect(res.error).toBe('Employee ID and Civil ID are required.');

    const res2 = await loginSubmitter(mockToken, '', '12345678');
    expect(res2.success).toBe(false);
    expect(res2.error).toBe('Employee ID and Civil ID are required.');
  });

  it('rejects login if timesheet link is invalid or inactive', async () => {
    const mockAdmin = createMockSupabase({ linkData: null, linkError: { message: 'Link not found' } });
    (getAdminClient as any).mockReturnValue(mockAdmin);

    const res = await loginSubmitter(mockToken, 'EMP-001', '12345678');
    expect(res.success).toBe(false);
    expect(res.error).toBe('Invalid or inactive timesheet link.');
  });

  it('rejects login if employee does not exist in company', async () => {
    const mockAdmin = createMockSupabase({ employeesData: [mockEmployee] });
    (getAdminClient as any).mockReturnValue(mockAdmin);

    const res = await loginSubmitter(mockToken, 'UNKNOWN_EMP', '12345678');
    expect(res.success).toBe(false);
    expect(res.error).toMatch(/Employee not found/);
  });

  it('rejects login if no active employees found in company', async () => {
    const mockAdmin = createMockSupabase({ employeesData: [] });
    (getAdminClient as any).mockReturnValue(mockAdmin);

    const res = await loginSubmitter(mockToken, 'EMP-001', '12345678');
    expect(res.success).toBe(false);
    expect(res.error).toMatch(/No active employees found for this company/);
  });

  it('rejects login if Civil ID password does not match', async () => {
    const mockAdmin = createMockSupabase({ employeesData: [mockEmployee] });
    (getAdminClient as any).mockReturnValue(mockAdmin);

    const res = await loginSubmitter(mockToken, 'EMP-001', 'WRONG_CIVIL_ID');
    expect(res.success).toBe(false);
    expect(res.error).toMatch(/Incorrect password/);
  });

  it('logs in successfully and sets cookie when credentials are valid', async () => {
    const mockAdmin = createMockSupabase({ employeesData: [mockEmployee] });
    (getAdminClient as any).mockReturnValue(mockAdmin);

    const res = await loginSubmitter(mockToken, 'EMP-001', '12345678');
    expect(res.success).toBe(true);
    expect(res.submitter?.id).toBe(mockEmployee.id);
    expect(res.submitter?.emp_code).toBe(mockEmployee.emp_code);
    expect(res.submitter?.name_en).toBe(mockEmployee.name_en);

    // Verify cookie was set
    expect(mockCookieStore.set).toHaveBeenCalled();
    const [cookieName, cookieValue] = mockCookieStore.set.mock.calls[0];
    expect(cookieName).toBe(`ts_submitter_${mockToken}`);
    expect(cookieValue).toBeTruthy();
    const parsedCookie = JSON.parse(cookieValue);
    expect(parsedCookie.id).toBe(mockEmployee.id);
    expect(parsedCookie.company_id).toBe(mockCompanyId);
  });

  it('deletes submitter cookie on logout', async () => {
    const res = await logoutSubmitter(mockToken);
    expect(res.success).toBe(true);
    expect(mockCookieStore.delete).toHaveBeenCalledWith(`ts_submitter_${mockToken}`);
  });

  it('retrieves submitter session from valid cookie', async () => {
    const mockAdmin = createMockSupabase({ singleEmpData: mockEmployee });
    (getAdminClient as any).mockReturnValue(mockAdmin);

    const payload = {
      id: mockEmployee.id,
      name_en: mockEmployee.name_en,
      emp_code: mockEmployee.emp_code,
      company_id: mockCompanyId,
    };
    mockCookieStore.get.mockReturnValue({ value: JSON.stringify(payload) });

    const submitter = await getSubmitterSession(mockToken);
    expect(submitter).not.toBeNull();
    expect(submitter?.id).toBe(mockEmployee.id);
    expect(submitter?.name_en).toBe(mockEmployee.name_en);
    expect(submitter?.emp_code).toBe(mockEmployee.emp_code);
  });
});
