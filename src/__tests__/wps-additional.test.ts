import { describe, it, expect } from 'vitest';
import {
  calculateExportAmounts,
  generateWPSSIF,
  generateWPSFileName,
  isValidEmployee,
  validateWPSData,
  type PayrollRunType,
} from '@/lib/calculations/wps';
import type { PayrollItem, Employee, Company } from '@/types';

// Helper to create a minimal payroll item
function createPayrollItem(overrides: Partial<PayrollItem> = {}): PayrollItem {
  return {
    id: 'pi-1',
    payroll_run_id: 'pr-1',
    employee_id: 'emp-1',
    basic_salary: 1000,
    housing_allowance: 200,
    transport_allowance: 150,
    food_allowance: 0,
    special_allowance: 0,
    site_allowance: 0,
    other_allowance: 0,
    overtime_hours: 0,
    overtime_pay: 0,
    gross_salary: 1350,
    absent_days: 0,
    absence_deduction: 0,
    loan_deduction: 0,
    other_deduction: 0,
    total_deductions: 0,
    social_security_deduction: 0,
    pasi_company_share: 0,
    leave_deduction: 0,
    net_salary: 1350,
    eosb_amount: 0,
    leave_encashment: 0,
    air_ticket_balance: 0,
    final_total: 0,
    payout_status: 'pending',
    paid_amount: null,
    ...overrides,
  };
}

// Helper to create a minimal employee for WPS
function createEmployee(overrides: Partial<Employee> = {}): Employee {
  return {
    id: 'emp-1',
    emp_code: '001',
    name_en: 'Ahmed Al Balushi',
    email: 'ahmed@company.com',
    basic_salary: 1000,
    housing_allowance: 200,
    transport_allowance: 150,
    food_allowance: 0,
    special_allowance: 0,
    site_allowance: 0,
    other_allowance: 0,
    join_date: '2024-01-01',
    nationality: 'OMANI',
    category: 'OMANI_INDIRECT_STAFF',
    status: 'active',
    company_id: 'comp-1',
    id_type: 'civil_id',
    civil_id: '12345678',
    bank_iban: 'OM12BMCT000000001234567890',
    bank_bic: 'BMCTOMRX',
    ...overrides,
  };
}

describe('calculateExportAmounts', () => {
  it('should return null when fullNet <= 0', () => {
    const item = createPayrollItem({ net_salary: 0 });
    const result = calculateExportAmounts(item, 'monthly' as PayrollRunType);
    expect(result).toBeNull();
  });

  it('should return null when fully paid (status paid and paid >= fullNet)', () => {
    const item = createPayrollItem({ payout_status: 'paid', paid_amount: 1500, net_salary: 1000 });
    const result = calculateExportAmounts(item, 'monthly' as PayrollRunType);
    expect(result).toBeNull();
  });

  it('should calculate with overrideAmount', () => {
    const item = createPayrollItem({ net_salary: 1000, paid_amount: 0 });
    const result = calculateExportAmounts(item, 'monthly' as PayrollRunType, 500);
    expect(result).not.toBeNull();
    expect(result!.effectiveNet).toBe(500);
    const ratio = 0.5;
    expect(result!.scaledBasic).toBeCloseTo(1350 * ratio);
    expect(result!.scaledDeductions).toBeCloseTo(0);
    expect(result!.scaledSocialSecurity).toBeCloseTo(0);
  });

  it('should calculate standard monthly payroll', () => {
    const item = createPayrollItem();
    const result = calculateExportAmounts(item, 'monthly' as PayrollRunType);
    expect(result).not.toBeNull();
    expect(result!.effectiveNet).toBe(1350);
    expect(result!.scaledBasic).toBe(1350);
    expect(result!.scaledExtraIncome).toBe(0);
    expect(result!.scaledDeductions).toBe(0);
    expect(result!.scaledSocialSecurity).toBe(0);
    expect(result!.workingDays).toBe(30);
    expect(result!.notes).toBe('');
  });

  it('should include LOAN note when loan_deduction > 0', () => {
    const item = createPayrollItem({ loan_deduction: 100 });
    const result = calculateExportAmounts(item, 'monthly' as PayrollRunType);
    expect(result!.notes).toBe('LOAN');
  });

  it('should include SICK note when leave_deduction > 0', () => {
    const item = createPayrollItem({ leave_deduction: 50 });
    const result = calculateExportAmounts(item, 'monthly' as PayrollRunType);
    expect(result!.notes).toBe('SICK');
  });

  it('should include both LOAN and SICK when both present', () => {
    const item = createPayrollItem({ loan_deduction: 100, leave_deduction: 50 });
    const result = calculateExportAmounts(item, 'monthly' as PayrollRunType);
    expect(result!.notes).toBe('LOAN SICK');
  });

  it('should handle final_settlement with derived basic', () => {
    // For final_settlement, calculateExportAmounts uses item.final_total as fullNet
    const item = createPayrollItem({
      final_total: 2000,
      total_deductions: 200,
      social_security_deduction: 100,
    });
    const result = calculateExportAmounts(item, 'final_settlement' as PayrollRunType);
    expect(result).not.toBeNull();
    expect(result!.effectiveNet).toBe(2000);
    expect(result!.scaledDeductions).toBe(100);
    expect(result!.scaledSocialSecurity).toBe(100);
    // scaledBasic = effectiveNet + scaledDeductions + scaledSocialSecurity
    expect(result!.scaledBasic).toBe(2200);
    expect(result!.scaledExtraIncome).toBe(0);
    expect(result!.notes).toBe('FINAL');
  });

  it('should handle leave_settlement with notes', () => {
    const item = createPayrollItem({
      net_salary: 1500,
      total_deductions: 150,
      social_security_deduction: 50,
    });
    const result = calculateExportAmounts(item, 'leave_settlement' as PayrollRunType);
    expect(result).not.toBeNull();
    expect(result!.notes).toBe('LEAVE');
    expect(result!.scaledBasic).toBeCloseTo(1500 + (150 - 50) + 50); // 1650
  });

  it('should handle partial payment (paid but not fully)', () => {
    const item = createPayrollItem({
      payout_status: 'paid',
      paid_amount: 500,
      net_salary: 1000,
    });
    const result = calculateExportAmounts(item, 'monthly' as PayrollRunType);
    expect(result).not.toBeNull();
    expect(result!.effectiveNet).toBe(500);
    const ratio = 0.5;
    expect(result!.scaledBasic).toBeCloseTo(1350 * ratio);
  });
});

describe('generateWPSSIF', () => {
  it('should generate valid SIF content with one employee', () => {
    const company: Company = {
      id: 'comp-1',
      name: 'Test Company',
      cr_number: '123456',
      bank_account: 'OM12BMCT000000001234567890',
      iban: 'OM12BMCT000000001234567890',
    };
    const employee = createEmployee({
      name_en: 'Ahmed Al Balushi',
      emp_code: '001',
      bank_bic: 'BMCTOMRX',
      bank_iban: 'OM12BMCT000000001234567890',
    });
    const payrollItem = createPayrollItem({
      employee_id: employee.id,
      net_salary: 1000,
      basic_salary: 800,
      housing_allowance: 200,
      transport_allowance: 0,
      food_allowance: 0,
      special_allowance: 0,
      site_allowance: 0,
      other_allowance: 0,
      overtime_pay: 0,
      total_deductions: 0,
      social_security_deduction: 0,
      absent_days: 0,
    });

    const { sifContent, exportedAmounts } = generateWPSSIF(
      company,
      [employee],
      [payrollItem],
      2025,
      5,
      'monthly' as PayrollRunType
    );

    expect(exportedAmounts.get(payrollItem.id)).toBe(1000);
    const lines = sifContent.split('\n');
    expect(lines[0]).toContain('Employer CR-NO');
    expect(lines[1]).toContain('123456');
    expect(lines[1]).toContain('BMCT');
    expect(lines[1]).toContain('2025');
    expect(lines[1]).toContain('05');
    expect(lines[2]).toContain('Employee ID Type');
    // Employee data line
    expect(lines[3]).toContain('C');
    expect(lines[3]).toContain('12345678');
    expect(lines[3]).toContain('001');
    expect(lines[3]).toContain('AHMED AL BALUSHI');
    expect(lines[3]).toContain('BMCTOMRX');
    expect(lines[3]).toContain('30'); // working days
  });

  it('should throw when no valid employees after filtering', () => {
    const company: Company = {
      id: 'comp-1',
      name: 'Test Company',
      cr_number: '123456',
      bank_account: 'OM12BMCT000000001234567890',
      iban: 'OM12BMCT000000001234567890',
    };
    const invalidEmployee: Employee = createEmployee({ bank_iban: '' });
    expect(() =>
      generateWPSSIF(company, [invalidEmployee], [createPayrollItem()], 2025, 5, 'monthly' as PayrollRunType)
    ).toThrow('No valid employees to export after filtering');
  });
});

describe('generateWPSFileName', () => {
  it('should generate correct filename format', () => {
    const name = generateWPSFileName('123456', 'BMCT', new Date('2025-05-03'), 1);
    expect(name).toBe('SIF_123456_BMCT_20250503_001.csv');
  });

  it('should pad sequence number to three digits', () => {
    const name = generateWPSFileName('ABC', 'BMCT', undefined, 5);
    expect(name).toMatch(/^SIF_ABC_BMCT_\d{8}_005\.csv$/);
  });

  it('should sanitize CR number', () => {
    const name = generateWPSFileName('AB-123', 'BMCT');
    expect(name).toMatch(/^SIF_AB123_BMCT_\d{8}_001\.csv$/);
  });
});

describe('isValidEmployee', () => {
  it('should return true for valid employee', () => {
    const emp = createEmployee();
    expect(isValidEmployee(emp)).toBe(true);
  });

  it('should fail if IBAN missing', () => {
    const emp = createEmployee({ bank_iban: '' });
    expect(isValidEmployee(emp)).toBe(false);
  });

  it('should fail if civil_id starts with zero', () => {
    const emp = createEmployee({ civil_id: '01234567' });
    expect(isValidEmployee(emp)).toBe(false);
  });

  it('should fail if civil_id is non-numeric', () => {
    const emp = createEmployee({ civil_id: 'ABCDEFGH' });
    expect(isValidEmployee(emp)).toBe(false);
  });

  it('should fail if name is empty', () => {
    const emp = createEmployee({ name_en: '' });
    expect(isValidEmployee(emp)).toBe(false);
  });

  it('should fail if employee is null', () => {
    expect(isValidEmployee(null as any)).toBe(false);
  });

  it('should fail if IBAN contains only non-digits (empty after format)', () => {
    // formatEmployeeAccount returns '' for no digits, leading to length 0 -> invalid
    const emp = createEmployee({ bank_iban: 'NoDigits' });
    expect(isValidEmployee(emp)).toBe(false);
  });
});

describe('validateWPSData additional cases', () => {
  it('should fail if civilId starts with zero', () => {
    const data = {
      employeeId: 'emp-1',
      fullName: 'Test',
      civilId: '01234567',
      basicSalary: 1000,
      bankIban: 'OM12BMCT000000001234567890',
    };
    const result = validateWPSData(data);
    expect(result.isValid).toBe(false);
    expect(result.errors.some(e => e.field === 'civilId' && e.message.includes('cannot start with zero'))).toBe(true);
  });

  it('should fail if civilId exceeds 8 digits', () => {
    const data = {
      employeeId: 'emp-1',
      fullName: 'Test',
      civilId: '123456789',
      basicSalary: 1000,
      bankIban: 'OM12BMCT000000001234567890',
    };
    const result = validateWPSData(data);
    expect(result.isValid).toBe(false);
    expect(result.errors.some(e => e.field === 'civilId' && e.message.includes('cannot exceed 8 digits'))).toBe(true);
  });

  it('should fail if fullName is only whitespace', () => {
    const data = {
      employeeId: 'emp-1',
      fullName: '   ',
      civilId: '12345678',
      basicSalary: 1000,
      bankIban: 'OM12BMCT000000001234567890',
    };
    const result = validateWPSData(data);
    expect(result.isValid).toBe(false);
  });
});


describe('Vacation employee handling in WPS', () => {
  it('should add 0.100 OMR for on_leave employee not in payroll and no settlement/rejoin', () => {
    const company: Company = {
      id: 'comp-1',
      name: 'Test Company',
      cr_number: '123456',
      bank_account: 'OM12BMCT000000001234567890',
      iban: 'OM12BMCT000000001234567890',
    };
    const vacationEmp = createEmployee({
      id: 'emp-vacation',
      emp_code: 'VAC01',
      name_en: 'Vacation Employee',
      status: 'on_leave',
      leave_settlement_date: null,
      rejoin_date: null,
    });
    const payrollItem = createPayrollItem({ employee_id: 'emp-regular' });
    const regularEmp = createEmployee({ id: 'emp-regular', emp_code: 'REG01' });

    const { sifContent, exportedAmounts } = generateWPSSIF(
      company,
      [vacationEmp, regularEmp],
      [payrollItem],
      2025,
      5,
      'monthly' as PayrollRunType
    );

    const vacationExportId = `vacation-${vacationEmp.id}`;
    expect(exportedAmounts.get(vacationExportId)).toBe(0.100);
    expect(exportedAmounts.get(payrollItem.id)).toBe(1350);
    expect(sifContent).toContain('VAC01');
    expect(sifContent).toContain('VACATION');
    expect(sifContent).toContain('0.100');
  });

  it('should NOT add 0.100 if leave_settlement_date is in same month', () => {
    const company: Company = {
      id: 'comp-1',
      name: 'Test Company',
      cr_number: '123456',
      bank_account: 'OM12BMCT000000001234567890',
      iban: 'OM12BMCT000000001234567890',
    };
    const vacationEmp = createEmployee({
      id: 'emp-vacation',
      status: 'on_leave',
      leave_settlement_date: '2025-05-15',
      rejoin_date: null,
    });
    const regularEmp = createEmployee({ id: 'emp-regular' });
    const payrollItem = createPayrollItem({ employee_id: 'emp-regular' });

    const { sifContent, exportedAmounts } = generateWPSSIF(
      company,
      [vacationEmp, regularEmp],
      [payrollItem],
      2025,
      5,
      'monthly' as PayrollRunType
    );

    const vacationExportId = `vacation-${vacationEmp.id}`;
    expect(exportedAmounts.has(vacationExportId)).toBe(false);
    expect(sifContent).not.toContain('VAC01');
  });

  it('should NOT add 0.100 if rejoin_date is in same month', () => {
    const company: Company = {
      id: 'comp-1',
      name: 'Test Company',
      cr_number: '123456',
      bank_account: 'OM12BMCT000000001234567890',
      iban: 'OM12BMCT000000001234567890',
    };
    const vacationEmp = createEmployee({
      id: 'emp-vacation',
      status: 'on_leave',
      leave_settlement_date: null,
      rejoin_date: '2025-05-10',
    });
    const regularEmp = createEmployee({ id: 'emp-regular' });
    const payrollItem = createPayrollItem({ employee_id: 'emp-regular' });

    const { sifContent, exportedAmounts } = generateWPSSIF(
      company,
      [vacationEmp, regularEmp],
      [payrollItem],
      2025,
      5,
      'monthly' as PayrollRunType
    );

    const vacationExportId = `vacation-${vacationEmp.id}`;
    expect(exportedAmounts.has(vacationExportId)).toBe(false);
  });

  it('should NOT add 0.100 if vacation employee already has payroll item', () => {
    const company: Company = {
      id: 'comp-1',
      name: 'Test Company',
      cr_number: '123456',
      bank_account: 'OM12BMCT000000001234567890',
      iban: 'OM12BMCT000000001234567890',
    };
    const vacationEmp = createEmployee({
      id: 'emp-vacation',
      status: 'on_leave',
      leave_settlement_date: null,
      rejoin_date: null,
    });
    const payrollItem = createPayrollItem({ employee_id: 'emp-vacation', net_salary: 500 });

    const { exportedAmounts } = generateWPSSIF(
      company,
      [vacationEmp],
      [payrollItem],
      2025,
      5,
      'monthly' as PayrollRunType
    );

    expect(exportedAmounts.get(payrollItem.id)).toBe(500);
    const vacationExportId = `vacation-${vacationEmp.id}`;
    expect(exportedAmounts.has(vacationExportId)).toBe(false);
  });

  it('should NOT add 0.100 for non-on_leave employees', () => {
    const company: Company = {
      id: 'comp-1',
      name: 'Test Company',
      cr_number: '123456',
      bank_account: 'OM12BMCT000000001234567890',
      iban: 'OM12BMCT000000001234567890',
    };
    const activeEmp = createEmployee({
      id: 'emp-active',
      status: 'active',
    });
    const payrollItem = createPayrollItem({ employee_id: 'emp-regular' });
    const regularEmp = createEmployee({ id: 'emp-regular' });

    const { sifContent, exportedAmounts } = generateWPSSIF(
      company,
      [activeEmp, regularEmp],
      [payrollItem],
      2025,
      5,
      'monthly' as PayrollRunType
    );

    expect(exportedAmounts.has(`vacation-${activeEmp.id}`)).toBe(false);
    expect(sifContent).not.toContain('ACTIV');
  });

  it('should add vacation amount with VACATION note', () => {
    const company: Company = {
      id: 'comp-1',
      name: 'Test Company',
      cr_number: '123456',
      bank_account: 'OM12BMCT000000001234567890',
      iban: 'OM12BMCT000000001234567890',
    };
    const vacationEmp = createEmployee({
      id: 'emp-vac1',
      status: 'on_leave',
      leave_settlement_date: null,
      rejoin_date: null,
    });

    const { sifContent } = generateWPSSIF(
      company,
      [vacationEmp],
      [],
      2025,
      5,
      'monthly' as PayrollRunType
    );

    const lines = sifContent.split('\n');
    const employeeLine = lines[3];
    expect(employeeLine).toContain('VACATION');
  });

  it('should add 0.100 OMR for leave_settled employee (settlement done before vacation)', () => {
    // Scenario: Leave settlement processed on May 10, employee on leave May 15 - July 13
    // June WPS export should include 0.100 OMR (settlement not in June, rejoin not in June)
    const company: Company = {
      id: 'comp-1',
      name: 'Test Company',
      cr_number: '123456',
      bank_account: 'OM12BMCT000000001234567890',
      iban: 'OM12BMCT000000001234567890',
    };
    const vacationEmp = createEmployee({
      id: 'emp-vacation',
      emp_code: 'VAC02',
      name_en: 'Vacation Employee Settled',
      status: 'leave_settled',           // Status after pre-vacation settlement
      leave_settlement_date: '2026-05-10', // Settlement processed in May
      rejoin_date: '2026-07-13',          // Rejoin in July
    });
    const regularEmp = createEmployee({ id: 'emp-regular', emp_code: 'REG01' });
    const payrollItem = createPayrollItem({ employee_id: 'emp-regular' });

    // Generate WPS for June 2026
    const { sifContent, exportedAmounts } = generateWPSSIF(
      company,
      [vacationEmp, regularEmp],
      [payrollItem],
      2026,
      6,  // June
      'monthly' as PayrollRunType
    );

    // Vacation employee should have 0.100 OMR entry
    const vacationExportId = `vacation-${vacationEmp.id}`;
    expect(exportedAmounts.get(vacationExportId)).toBe(0.100);
    expect(sifContent).toContain('VAC02');
    expect(sifContent).toContain('VACATION');
    expect(sifContent).toContain('0.100');
  });

  it('should NOT add 0.100 for leave_settled employee if leave_settlement_date is in same month', () => {
    // Settlement done in June, exporting June → skip 0.100
    const company: Company = {
      id: 'comp-1',
      name: 'Test Company',
      cr_number: '123456',
      bank_account: 'OM12BMCT000000001234567890',
      iban: 'OM12BMCT000000001234567890',
    };
    const vacationEmp = createEmployee({
      id: 'emp-vacation',
      emp_code: 'VAC03',
      name_en: 'Vacation Employee Settled',
      status: 'leave_settled',
      leave_settlement_date: '2026-06-10', // Settlement in June (same as export)
      rejoin_date: '2026-07-13',
    });
    const regularEmp = createEmployee({ id: 'emp-regular', emp_code: 'REG01' });
    const payrollItem = createPayrollItem({ employee_id: 'emp-regular' });

    const { exportedAmounts } = generateWPSSIF(
      company,
      [vacationEmp, regularEmp],
      [payrollItem],
      2026,
      6,  // June export
      'monthly' as PayrollRunType
    );

    const vacationExportId = `vacation-${vacationEmp.id}`;
    expect(exportedAmounts.get(vacationExportId)).toBeUndefined();
  });

  it('should NOT add 0.100 for leave_settled employee if rejoin_date is in same month', () => {
    // Rejoin in June, exporting June → skip 0.100
    const company: Company = {
      id: 'comp-1',
      name: 'Test Company',
      cr_number: '123456',
      bank_account: 'OM12BMCT000000001234567890',
      iban: 'OM12BMCT000000001234567890',
    };
    const vacationEmp = createEmployee({
      id: 'emp-vacation',
      emp_code: 'VAC04',
      name_en: 'Vacation Employee Settled',
      status: 'leave_settled',
      leave_settlement_date: '2026-05-10',
      rejoin_date: '2026-06-15', // Rejoin in June (same as export)
    });
    const regularEmp = createEmployee({ id: 'emp-regular', emp_code: 'REG01' });
    const payrollItem = createPayrollItem({ employee_id: 'emp-regular' });

    const { exportedAmounts } = generateWPSSIF(
      company,
      [vacationEmp, regularEmp],
      [payrollItem],
      2026,
      6,  // June export
      'monthly' as PayrollRunType
    );

    const vacationExportId = `vacation-${vacationEmp.id}`;
    expect(exportedAmounts.get(vacationExportId)).toBeUndefined();
  });

  it('should include vacation 0.100 in total amount calculation', () => {
    const company: Company = {
      id: 'comp-1',
      name: 'Test Company',
      cr_number: '123456',
      bank_account: 'OM12BMCT000000001234567890',
      iban: 'OM12BMCT000000001234567890',
    };
    const vacationEmp = createEmployee({
      id: 'emp-vac1',
      emp_code: 'VAC01',
      status: 'on_leave',
      leave_settlement_date: null,
      rejoin_date: null,
    });
    const { sifContent } = generateWPSSIF(
      company,
      [vacationEmp],
      [],
      2025,
      5,
      'monthly' as PayrollRunType
    );

    const lines = sifContent.split('\n');
    const headerData = lines[1].split(',');
    const totalSalaries = headerData[6];
    expect(totalSalaries).toBe('0.100');
  });
});
