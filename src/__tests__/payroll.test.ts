import { describe, it, expect } from 'vitest';
import {
  calculateEmployeePayroll,
  getWorkingDaysInMonth,
  getWorkingDaysInRange,
  getCalendarDaysInRange,
  type PayrollInput,
  type PayrollOutput,
  type TimesheetRecord,
} from '@/lib/calculations/payroll';
import type { Employee, Attendance, Leave, LeaveType, Loan, LoanRepayment, SalaryRevision } from '@/types';

// Helper to create test employee
function createEmployee(overrides: Partial<Employee> = {}): Employee {
  return {
    id: 'emp-1',
    emp_code: '001',
    name_en: 'Ahmed Al Balushi',
    email: 'ahmed@company.com',
    basic_salary: 1500,
    housing_allowance: 300,
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
    rejoin_date: null,
    ...overrides,
  };
}

// Helper to create leave type
function createLeaveType(overrides: Partial<LeaveType> = {}): LeaveType {
  return {
    id: 'lt-1',
    name: 'Annual Leave',
    is_paid: true,
    max_days: 30,
    payment_tiers: [],
    ...overrides,
  };
}

describe('Payroll Calculations', () => {
  describe('calculateEmployeePayroll', () => {
    it('should calculate basic payroll without special conditions', () => {
      const employee = createEmployee();
      const input: PayrollInput = {
        employee,
        attendanceRecords: [],
        timesheetRecords: [],
        leaveRecords: [],
        leaveTypes: [],
        activeLoan: null,
        loanRepayment: null,
        workingDaysInMonth: 26,
        month: 5,
        year: 2025,
      };

      const result = calculateEmployeePayroll(input);

      // Basic salary should be full
      expect(result.basicSalary).toBe(1500);
      // Housing, transport should be full
      expect(result.housingAllowance).toBe(300);
      expect(result.transportAllowance).toBe(150);
      // Gross (without OT) = 1500 + 300 + 150 = 1950
      expect(result.grossSalary).toBe(1950);
      // No OT
      expect(result.overtimeHours).toBe(0);
      expect(result.overtimePay).toBe(0);
      // No deductions
      expect(result.absentDays).toBe(0);
      expect(result.absenceDeduction).toBe(0);
      // Omani = social security (SPF) applies
      expect(result.socialSecurityDeduction).toBeGreaterThan(0);
      // Net should equal gross minus deductions
      expect(result.netSalary).toBeGreaterThan(0);
    });

    it('should calculate overtime from timesheets', () => {
      const employee = createEmployee({ basic_salary: 2080 }); // 10 OMR/hour (2080/208)
      const timesheets: TimesheetRecord[] = [
        { employee_id: 'emp-1', date: '2025-05-01', day_type: 'working_day', hours_worked: 8, overtime_hours: 2 },
        { employee_id: 'emp-1', date: '2025-05-02', day_type: 'working_day', hours_worked: 8, overtime_hours: 3 },
      ];

      const input: PayrollInput = {
        employee,
        attendanceRecords: [],
        timesheetRecords: timesheets,
        leaveRecords: [],
        leaveTypes: [],
        activeLoan: null,
        loanRepayment: null,
        workingDaysInMonth: 26,
        month: 5,
        year: 2025,
      };

      const result = calculateEmployeePayroll(input);

      // 5 hours OT at 10 OMR/hour = 50 OMR
      expect(result.overtimeHours).toBe(5);
      expect(result.overtimePay).toBeCloseTo(50, 2);
    });

    it('should calculate absence deduction', () => {
      const employee = createEmployee();
      const timesheets: TimesheetRecord[] = [
        { employee_id: 'emp-1', date: '2025-05-01', day_type: 'absent', hours_worked: 0, overtime_hours: 0 },
        { employee_id: 'emp-1', date: '2025-05-02', day_type: 'absent', hours_worked: 0, overtime_hours: 0 },
      ];

      const input: PayrollInput = {
        employee,
        attendanceRecords: [],
        timesheetRecords: timesheets,
        leaveRecords: [],
        leaveTypes: [],
        activeLoan: null,
        loanRepayment: null,
        workingDaysInMonth: 26,
        month: 5,
        year: 2025,
      };

      const result = calculateEmployeePayroll(input);

      expect(result.absentDays).toBe(2);
      // Daily rate = (1500+300+150)/30 = 65
      expect(result.absenceDeduction).toBe(130);
    });

    it('should apply salary revisions correctly', () => {
      const employee = createEmployee({ basic_salary: 1000, housing_allowance: 200, transport_allowance: 100 });
      const revisions: SalaryRevision[] = [
        {
          id: 'rev-1',
          employee_id: 'emp-1',
          effective_date: '2025-05-15',
          previous_basic: 1000,
          new_basic: 1500,
          previous_housing: 200,
          new_housing: 300,
          previous_transport: 100,
          new_transport: 150,
          previous_food: 0,
          new_food: 0,
          previous_special: 0,
          new_special: 0,
          previous_site: 0,
          new_site: 0,
          previous_other: 0,
          new_other: 0,
          created_at: '2025-05-01',
        },
      ];

      const input: PayrollInput = {
        employee,
        attendanceRecords: [],
        timesheetRecords: [],
        leaveRecords: [],
        leaveTypes: [],
        activeLoan: null,
        loanRepayment: null,
        workingDaysInMonth: 26,
        month: 5,
        year: 2025,
        revisions,
      };

      const result = calculateEmployeePayroll(input);

      // May has 31 days. First 14 days at old rate, days 15-31 at new rate
      // Old rate monthly total: 1000+200+100 = 1300, daily = 1300/30 = 43.333...
      //  14 days × 43.333... = 606.667
      // New rate monthly total: 1500+300+150 = 1950, daily = 1950/30 = 65
      //  17 days × 65 = 1105
      // Total = 606.667 + 1105 = 1711.667
      expect(result.basicSalary + result.housingAllowance + result.transportAllowance).toBeCloseTo(1712, 0);
    });

    it('should apply pro-rata for joining during month', () => {
      const employee = createEmployee({ join_date: '2025-05-15' });
      const input: PayrollInput = {
        employee,
        attendanceRecords: [],
        timesheetRecords: [],
        leaveRecords: [],
        leaveTypes: [],
        activeLoan: null,
        loanRepayment: null,
        workingDaysInMonth: 26,
        month: 5,
        year: 2025,
      };

      const result = calculateEmployeePayroll(input);

      // Joined May 15, so worked 17 days out of 31
      // Pro-rated salary should be less than full
      const fullMonthly = 1500 + 300 + 150;
      expect(result.basicSalary + result.housingAllowance + result.transportAllowance).toBeLessThan(fullMonthly);
    });

    it('should apply loan deduction when active', () => {
      const employee = createEmployee();
      const loan: Loan = { id: 'loan-1', employee_id: 'emp-1', principal: 5000, annual_rate: 10, tenure_months: 12, disbursement_date: '2025-01-01', status: 'active' };
      const repayment: LoanRepayment = { id: 'rep-1', loan_id: 'loan-1', installment_no: 3, due_date: '2025-05-01', amount: 450, is_held: false };

      const input: PayrollInput = {
        employee,
        attendanceRecords: [],
        timesheetRecords: [],
        leaveRecords: [],
        leaveTypes: [],
        activeLoan: loan,
        loanRepayment: repayment,
        workingDaysInMonth: 26,
        month: 5,
        year: 2025,
      };

      const result = calculateEmployeePayroll(input);

      expect(result.loanDeduction).toBe(450);
    });

    it('should skip loan deduction if repayment is held', () => {
      const employee = createEmployee();
      const loan: Loan = { id: 'loan-1', employee_id: 'emp-1', principal: 5000, annual_rate: 10, tenure_months: 12, disbursement_date: '2025-01-01', status: 'active' };
      const repayment: LoanRepayment = { id: 'rep-1', loan_id: 'loan-1', installment_no: 3, due_date: '2025-05-01', amount: 450, is_held: true };

      const input: PayrollInput = {
        employee,
        attendanceRecords: [],
        timesheetRecords: [],
        leaveRecords: [],
        leaveTypes: [],
        activeLoan: loan,
        loanRepayment: repayment,
        workingDaysInMonth: 26,
        month: 5,
        year: 2025,
      };

      const result = calculateEmployeePayroll(input);

      expect(result.loanDeduction).toBe(0);
    });

    it('should apply manual other allowance/deduction', () => {
      const employee = createEmployee();
      const input: PayrollInput = {
        employee,
        attendanceRecords: [],
        timesheetRecords: [],
        leaveRecords: [],
        leaveTypes: [],
        activeLoan: null,
        loanRepayment: null,
        workingDaysInMonth: 26,
        month: 5,
        year: 2025,
        manualOtherAllowance: 200,
        manualOtherDeduction: 100,
      };

      const result = calculateEmployeePayroll(input);

      expect(result.otherAllowance).toBe(200);
      expect(result.otherDeduction).toBe(100);
    });
  });

  describe('getWorkingDaysInMonth', () => {
    it('should return approximately 26 working days for standard month', () => {
      const days = getWorkingDaysInMonth(2025, 5); // May 2025
      // May 2025 has 31 days, 8-9 weekend days = ~22-23 working days
      expect(days).toBeGreaterThan(20);
      expect(days).toBeLessThan(28);
    });

    it('should handle February correctly', () => {
      const days = getWorkingDaysInMonth(2025, 2); // Feb 2025
      expect(days).toBeGreaterThan(0);
      expect(days).toBeLessThan(25);
    });
  });

  describe('getWorkingDaysInRange', () => {
    it('should exclude Friday and Saturday (Oman weekends)', () => {
      // May 1-7, 2025: Thu(1), Fri(2), Sat(3), Sun(4), Mon(5), Tue(6), Wed(7)
      // Working days: Thu, Sun, Mon, Tue, Wed = 5 days
      const days = getWorkingDaysInRange(2025, 5, 1, 7);
      expect(days).toBe(5);
    });
  });

  describe('getCalendarDaysInRange', () => {
    it('should count all calendar days inclusive', () => {
      expect(getCalendarDaysInRange(2025, 5, 1, 10)).toBe(10);
      expect(getCalendarDaysInRange(2025, 5, 15, 15)).toBe(1);
    });

    it('should return 0 for invalid range', () => {
      expect(getCalendarDaysInRange(2025, 5, 10, 5)).toBe(0);
    });
  });
});
