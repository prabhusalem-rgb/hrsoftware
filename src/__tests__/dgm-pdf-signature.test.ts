import { describe, it, expect } from 'vitest';
import React from 'react';
import { LeaveRequestPDF } from '@/components/hr/LeaveRequestPDF';
import { LeaveSettlementPDF } from '@/components/payroll/LeaveSettlementPDF';
import { SettlementStatementPDF } from '@/components/payroll/settlement/SettlementStatementPDF';
import { ContractRenewalPDF } from '@/components/hr/ContractRenewalPDF';

describe('DGM Signature PDF Space - Bright Flowers Trading LLC Only', () => {
  const brightFlowersCompany: any = {
    id: 'bf-uuid',
    name_en: 'BRIGHT FLOWERS TRADING LLC',
    name_ar: 'برايت فلاورز للتجارة ش.م.م',
    cr_number: '1234567',
    address: 'Muscat, Sultanate of Oman',
    bank_name: 'Bank Muscat',
    bank_account: '123456789',
    iban: 'OM1234567890123456789012',
  };

  const otherCompany: any = {
    id: 'other-uuid',
    name_en: 'AL ZAHRA TECHNOLOGY LLC',
    name_ar: 'الزهراء للتكنولوجيا',
    cr_number: '7654321',
    address: 'Muscat, Sultanate of Oman',
    bank_name: 'Bank Muscat',
    bank_account: '987654321',
    iban: 'OM9876543210987654321098',
  };

  const sampleEmployee: any = {
    id: 'emp-1',
    emp_code: 'EMP001',
    name_en: 'John Doe',
    department: 'Operations',
    designation: 'Technician',
    join_date: '2023-01-01',
    basic_salary: 500,
    housing_allowance: 100,
    transport_allowance: 50,
    gross_salary: 650,
  };

  describe('ContractRenewalPDF', () => {
    it('should render DGM Signature only for Bright Flowers Trading LLC', () => {
      const renewalData: any = {
        renewal_period_years: 2,
        basic_salary: 500,
        housing_allowance: 100,
        transport_allowance: 50,
        food_allowance: 0,
        special_allowance: 0,
        site_allowance: 0,
        other_allowance: 0,
        gross_salary: 650,
        employee_signed_at: '2026-01-01T00:00:00Z',
        manager_approved_at: '2026-01-02T00:00:00Z',
        hr_signed_at: '2026-01-03T00:00:00Z',
      };

      const bfElement = ContractRenewalPDF({
        company: brightFlowersCompany,
        employee: sampleEmployee,
        renewalData,
      });

      // Flatten React elements to inspect text content
      const bfJson = JSON.stringify(bfElement);
      expect(bfJson).toContain('DGM Signature:');

      const otherElement = ContractRenewalPDF({
        company: otherCompany,
        employee: sampleEmployee,
        renewalData,
      });
      const otherJson = JSON.stringify(otherElement);
      expect(otherJson).not.toContain('DGM Signature:');
    });
  });

  describe('LeaveSettlementPDF', () => {
    it('should render DGM Approval only for Bright Flowers Trading LLC', () => {
      const settlementData: any = {
        leave_from: '2026-06-01',
        leave_to: '2026-06-30',
        days_in_month: 30,
        leave_days: 30,
        working_days: 30,
        last_salary_month: '2026-05',
        settlement_date: '2026-05-31',
        earnings: [{ label: 'Basic Salary', full: 500, actual: 500 }],
        deductions: [],
        net_pay: 500,
      };

      const bfElement = LeaveSettlementPDF({
        company: brightFlowersCompany,
        employee: sampleEmployee,
        settlementData,
      });
      const bfJson = JSON.stringify(bfElement);
      expect(bfJson).toContain('DGM Approval');

      const otherElement = LeaveSettlementPDF({
        company: otherCompany,
        employee: sampleEmployee,
        settlementData,
      });
      const otherJson = JSON.stringify(otherElement);
      expect(otherJson).not.toContain('DGM Approval');
    });
  });

  describe('SettlementStatementPDF (Final Settlement)', () => {
    it('should render DGM Approval only for Bright Flowers Trading LLC', () => {
      const data: any = {
        company: brightFlowersCompany,
        employee: sampleEmployee,
        settlement: {
          settlement_date: '2026-06-30',
          reason: 'resignation',
          notice_served: true,
          eosb_amount: 1500,
          leave_encashment: 200,
          leave_days: 10,
          air_ticket_qty: 1,
          final_month_salary: 500,
          loan_deduction: 0,
          other_deduction: 0,
          other_deductions: [],
          other_additions: [],
          additional_payments: 0,
          final_total: 2200,
          processed_at: '2026-06-30',
          processed_by_name: 'HR Admin',
          reference_number: 'SET-001',
        },
      };

      const bfElement = SettlementStatementPDF({ data });
      const bfJson = JSON.stringify(bfElement);
      expect(bfJson).toContain('DGM Approval');

      const otherElement = SettlementStatementPDF({
        data: {
          ...data,
          company: otherCompany,
        },
      });
      const otherJson = JSON.stringify(otherElement);
      expect(otherJson).not.toContain('DGM Approval');
    });
  });

  describe('LeaveRequestPDF', () => {
    it('should render DGM section only for Bright Flowers Trading LLC', () => {
      const leaveRequest: any = {
        id: 'lr-1',
        employee_id: sampleEmployee.id,
        leave_type: 'Annual Leave',
        start_date: '2026-07-01',
        end_date: '2026-07-15',
        sector: 'International',
        status: 'pending',
        employee: sampleEmployee,
        company: brightFlowersCompany,
      };

      const bfElement = LeaveRequestPDF({
        leaveRequest: {
          ...leaveRequest,
          company: brightFlowersCompany,
        },
      });
      const bfJson = JSON.stringify(bfElement);
      expect(bfJson).toContain('DGM');
      expect(bfJson).toContain('Signature / Stamp');

      const otherElement = LeaveRequestPDF({
        leaveRequest: {
          ...leaveRequest,
          company: otherCompany,
        },
      });
      const otherJson = JSON.stringify(otherElement);
      expect(otherJson).not.toContain('Signature / Stamp');
    });
  });
});
