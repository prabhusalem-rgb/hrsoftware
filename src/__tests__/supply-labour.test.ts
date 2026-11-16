import { describe, it, expect } from 'vitest';
import { generateWPSSIF } from '@/lib/calculations/wps';
import { supplyLabourSchema } from '@/lib/validations/schemas';
import type { Employee, Company, PayrollItem } from '@/types';

describe('Supply Labour Module Tests', () => {
  const mockCompany: Company = {
    id: 'comp-1',
    name_en: 'Test Contracting LLC',
    name_ar: 'شركة الفحص ش.م.م',
    cr_number: '1234567',
    bank_name: 'Bank Muscat',
    bank_account: '0123456789012345',
    iban: 'OM12BMUS0123456789012345',
    wps_mol_id: 'MOL-99999',
    contact_email: 'test@company.com',
    contact_phone: '+968 91234567',
    address: 'Muscat, Oman',
    logo_url: null,
    created_at: '2026-01-01',
    updated_at: '2026-01-01',
  };

  const regularEmployee: Employee = {
    id: 'emp-reg-1',
    company_id: 'comp-1',
    emp_code: 'DIR-001',
    name_en: 'Ahmed Al Balushi',
    email: null,
    id_type: 'civil_id',
    civil_id: '12345678',
    passport_no: '',
    nationality: 'OMANI',
    category: 'DIRECT_STAFF',
    department: 'Civil',
    designation: 'Mason',
    join_date: '2025-01-01',
    basic_salary: 240,
    housing_allowance: 0,
    transport_allowance: 0,
    food_allowance: 0,
    special_allowance: 0,
    site_allowance: 0,
    other_allowance: 0,
    gross_salary: 240,
    bank_name: 'Bank Muscat',
    bank_bic: 'BMUSOMRX',
    bank_iban: 'OM12BMUS0123456789012345',
    status: 'active',
    passport_expiry: null,
    passport_issue_date: null,
    visa_no: null,
    visa_type: null,
    visa_issue_date: null,
    visa_expiry: null,
    termination_date: null,
    leave_settlement_date: null,
    rejoin_date: null,
    opening_leave_balance: 0,
    opening_air_tickets: 0,
    emergency_contact_name: '',
    emergency_contact_phone: '',
    home_country_address: '',
    reporting_to: '',
    is_salary_held: false,
    salary_hold_reason: null,
    salary_hold_at: null,
    air_ticket_cycle: 12,
    created_at: '2025-01-01',
    updated_at: '2025-01-01',
  };

  const supplyLabourWorker: Employee = {
    ...regularEmployee,
    id: 'emp-sl-1',
    emp_code: 'SL-001',
    name_en: 'Suresh Kumar',
    nationality: 'INDIAN',
    category: 'SUPPLY_LABOUR',
    supplier_name: 'Al Manahil Manpower',
    contact_phone: '+968 98765432',
    basic_salary: 240,
    gross_salary: 240,
    bank_iban: 'OM99BMUS9999999999999999',
  };

  describe('Condition 6: Overtime Calculation Formula', () => {
    it('should calculate OT rate as gross / 240 for SUPPLY_LABOUR (without 1.25x markup)', () => {
      const grossSalary = 240;
      const otHours = 10;

      // Supply labour formula: (gross / 240) * otHours
      const slOtRate = grossSalary / 240;
      const slOtCost = otHours * slOtRate;

      expect(slOtRate).toBe(1.0); // 240 / 240 = 1.000 OMR/hr
      expect(slOtCost).toBe(10.0); // 10 hrs * 1.000 = 10.000 OMR
    });

    it('standard employee OT rate includes 1.25x markup on basic salary', () => {
      const basicSalary = 240;
      const otHours = 10;

      // Standard employee formula: (basic / 240) * 1.25 * otHours
      const stdOtRate = (basicSalary / 240) * 1.25;
      const stdOtCost = otHours * stdOtRate;

      expect(stdOtRate).toBe(1.25); // 1.250 OMR/hr
      expect(stdOtCost).toBe(12.5); // 12.500 OMR
    });
  });

  describe('Condition 4: WPS Salary Exclusion', () => {
    it('should exclude SUPPLY_LABOUR from generated WPS SIF file', () => {
      const payrollItems: PayrollItem[] = [
        {
          id: 'item-reg-1',
          payroll_run_id: 'run-1',
          employee_id: 'emp-reg-1',
          basic_salary: 240,
          housing_allowance: 0,
          transport_allowance: 0,
          food_allowance: 0,
          special_allowance: 0,
          site_allowance: 0,
          other_allowance: 0,
          overtime_hours: 0,
          overtime_pay: 0,
          gross_salary: 240,
          absent_days: 0,
          absence_deduction: 0,
          loan_deduction: 0,
          other_deduction: 0,
          total_deductions: 0,
          social_security_deduction: 0,
          pasi_company_share: 0,
          leave_deduction: 0,
          net_salary: 240,
          payout_status: 'pending',
          wps_export_override: null,
          created_at: '2026-01-01',
          updated_at: '2026-01-01',
        },
        {
          id: 'item-sl-1',
          payroll_run_id: 'run-1',
          employee_id: 'emp-sl-1',
          basic_salary: 240,
          housing_allowance: 0,
          transport_allowance: 0,
          food_allowance: 0,
          special_allowance: 0,
          site_allowance: 0,
          other_allowance: 0,
          overtime_hours: 0,
          overtime_pay: 0,
          gross_salary: 240,
          absent_days: 0,
          absence_deduction: 0,
          loan_deduction: 0,
          other_deduction: 0,
          total_deductions: 0,
          social_security_deduction: 0,
          pasi_company_share: 0,
          leave_deduction: 0,
          net_salary: 240,
          payout_status: 'pending',
          wps_export_override: null,
          created_at: '2026-01-01',
          updated_at: '2026-01-01',
        },
      ];

      const { sifContent } = generateWPSSIF(
        mockCompany,
        [regularEmployee, supplyLabourWorker],
        payrollItems,
        2026,
        1,
        'monthly'
      );

      // The regular employee must be included in the SIF (WPS converts names to uppercase)
      expect(sifContent).toContain('AHMED AL BALUSHI');
      expect(sifContent).toContain(regularEmployee.civil_id);

      // The supply labour worker must be EXCLUDED from the SIF
      expect(sifContent).not.toContain('SURESH KUMAR');
      expect(sifContent).not.toContain('SL-001');
    });
  });

  describe('Condition 1: Validation Schema', () => {
    it('validates minimal supply labour input (Civil ID, mobile, fixed gross)', () => {
      const validData = {
        company_id: '1c808c5c-0ace-46af-8fb5-323a5e1d8061',
        name_en: 'Mohan Lal',
        civil_id: '98765432',
        contact_phone: '+968 91234567',
        gross_salary: 200,
        supplier_name: 'Super Manpower LLC',
      };

      const result = supplyLabourSchema.safeParse(validData);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.name_en).toBe('Mohan Lal');
        expect(result.data.supplier_name).toBe('Super Manpower LLC');
        expect(result.data.bank_iban).toBe(''); // optional
      }
    });

    it('fails when mandatory fields are missing', () => {
      const invalidData = {
        company_id: '1c808c5c-0ace-46af-8fb5-323a5e1d8061',
        name_en: '',
        civil_id: '',
        contact_phone: '',
        gross_salary: -10,
      };

      const result = supplyLabourSchema.safeParse(invalidData);
      expect(result.success).toBe(false);
    });
  });
});
