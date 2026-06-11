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

    it('should include holiday_overtime in overtime calculations', () => {
      const employee = createEmployee({ basic_salary: 2080 }); // 10 OMR/hour
      const timesheets: TimesheetRecord[] = [
        { employee_id: 'emp-1', date: '2025-05-01', day_type: 'holiday_overtime', hours_worked: 0, overtime_hours: 4 },
        { employee_id: 'emp-1', date: '2025-05-02', day_type: 'holiday_overtime', hours_worked: 0, overtime_hours: 5 },
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

      // 9 hours holiday OT at 10 OMR/hour = 90 OMR
      expect(result.overtimeHours).toBe(9);
      expect(result.overtimePay).toBeCloseTo(90, 2);
    });

    it('should combine working_day OT and holiday_overtime OT', () => {
      const employee = createEmployee({ basic_salary: 3120 }); // 15 OMR/hour (3120/208)
      const timesheets: TimesheetRecord[] = [
        { employee_id: 'emp-1', date: '2025-05-01', day_type: 'working_day', hours_worked: 8, overtime_hours: 2 },
        { employee_id: 'emp-1', date: '2025-05-02', day_type: 'holiday_overtime', hours_worked: 0, overtime_hours: 4 },
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

      // Total OT: 2 + 4 = 6 hours at 15 OMR/hour = 90 OMR
      expect(result.overtimeHours).toBe(6);
      expect(result.overtimePay).toBeCloseTo(90, 2);
    });

    it('should not count hours_worked for holiday_overtime in gross salary', () => {
      const employee = createEmployee({ basic_salary: 2080 }); // 10 OMR/hour
      const timesheets: TimesheetRecord[] = [
        { employee_id: 'emp-1', date: '2025-05-01', day_type: 'holiday_overtime', hours_worked: 0, overtime_hours: 8 },
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

      // Gross salary should be basic + allowances only (no regular pay for holiday_overtime)
      // Basic: 2080 + housing: 300 + transport: 150 = 2530
      expect(result.grossSalary).toBe(2530);
      // Only OT pay added separately
      expect(result.overtimePay).toBeCloseTo(80, 2); // 8 * 10 = 80
      // Net = gross + OT - deductions
      expect(result.netSalary).toBeCloseTo(2530 + 80 - result.totalDeductions, 2);
    });

    it('should handle working_holiday (legacy) same as holiday_overtime', () => {
      const employee = createEmployee({ basic_salary: 2080 });
      const timesheets: TimesheetRecord[] = [
        { employee_id: 'emp-1', date: '2025-05-01', day_type: 'working_holiday', hours_worked: 0, overtime_hours: 8 },
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

      // working_holiday also contributes only OT, no regular hours
      expect(result.overtimeHours).toBe(8);
      expect(result.overtimePay).toBeCloseTo(80, 2);
    });

    it('should not count absent days in working days', () => {
      const employee = createEmployee();
      const timesheets: TimesheetRecord[] = [
        { employee_id: 'emp-1', date: '2025-05-01', day_type: 'working_day', hours_worked: 8, overtime_hours: 0 },
        { employee_id: 'emp-1', date: '2025-05-02', day_type: 'absent', hours_worked: 0, overtime_hours: 0 },
        { employee_id: 'emp-1', date: '2025-05-03', day_type: 'holiday_overtime', hours_worked: 0, overtime_hours: 4 },
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

      expect(result.absentDays).toBe(1);
      expect(result.overtimeHours).toBe(4);
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
      // Daily rate = (1500+300+150)/31 = 62.903
      expect(result.absenceDeduction).toBe(125.806);
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
      // Old rate monthly total: 1000+200+100 = 1300
      //  14 days × 1300 / 31 = 587.097
      // New rate monthly total: 1500+300+150 = 1950
      //  17 days × 1950 / 31 = 1069.355
      // Total = 587.097 + 1069.355 = 1656.452
      expect(result.basicSalary + result.housingAllowance + result.transportAllowance).toBeCloseTo(1656, 0);
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

    it('should not double-deduct leaves that fall before the employee rejoining date', () => {
      const employee = createEmployee({
        basic_salary: 310,
        housing_allowance: 0,
        transport_allowance: 0,
        food_allowance: 80,
        rejoin_date: '2026-05-14',
        nationality: 'INDIAN',
      });
      const leaveType = createLeaveType({
        id: 'unpaid-lt',
        name: 'Unpaid Leave',
        is_paid: false,
        max_days: 90,
      });
      const leave: Leave = {
        id: 'leave-1',
        employee_id: 'emp-1',
        leave_type_id: 'unpaid-lt',
        start_date: '2026-05-01',
        end_date: '2026-05-13',
        days: 13,
        status: 'approved',
        settlement_status: 'none',
        company_id: 'comp-1',
        created_at: '2026-05-01',
        updated_at: '2026-05-01',
        notes: '',
        return_date: '2026-05-14',
      };

      const input: PayrollInput = {
        employee,
        attendanceRecords: [],
        timesheetRecords: [],
        leaveRecords: [leave],
        leaveTypes: [leaveType],
        activeLoan: null,
        loanRepayment: null,
        workingDaysInMonth: 26,
        month: 5,
        year: 2026,
      };

      const result = calculateEmployeePayroll(input);

      // Rejoined on May 14th, so worked 18 days out of 31 days in May
      // Basic salary: 310 * (18 / 31) = 180.00
      expect(result.basicSalary).toBeCloseTo(180.00, 2);
      // Food Allowance: 80 * (18 / 31) = 46.45
      expect(result.foodAllowance).toBeCloseTo(46.45, 2);
      // Leave deduction for the unpaid leave BEFORE the rejoin date should be 0 (since it is already pro-rated out)
      expect(result.leaveDeduction).toBe(0);
      // Net should be 180 + 46.45 = 226.45 (no double deductions)
      expect(result.netSalary).toBeCloseTo(226.45, 2);
    });

    it('should calculate days worked before and after leave if the leave falls within the month', () => {
      const employee = createEmployee({
        basic_salary: 100,
        housing_allowance: 0,
        transport_allowance: 0,
        food_allowance: 0,
        rejoin_date: '2026-06-15',
        nationality: 'INDIAN', // Keep simple (no SPF)
      });
      const leaveType = createLeaveType({
        id: 'unpaid-lt',
        name: 'Unpaid Leave',
        is_paid: false,
        max_days: 90,
      });
      const leave: Leave = {
        id: 'leave-1',
        employee_id: 'emp-1',
        leave_type_id: 'unpaid-lt',
        start_date: '2026-06-05',
        end_date: '2026-06-14',
        days: 10,
        status: 'approved',
        settlement_status: 'none',
        company_id: 'comp-1',
        created_at: '2026-06-01',
        updated_at: '2026-06-01',
        notes: '',
        return_date: '2026-06-15',
      };

      const input: PayrollInput = {
        employee,
        attendanceRecords: [],
        timesheetRecords: [],
        leaveRecords: [leave],
        leaveTypes: [leaveType],
        activeLoan: null,
        loanRepayment: null,
        workingDaysInMonth: 26,
        month: 6,
        year: 2026,
      };

      const result = calculateEmployeePayroll(input);

      // June has 30 days. Worked June 1-4 (4 days) and June 15-30 (16 days) = 20 days.
      // Basic salary before leave deduction is full: 100
      expect(result.basicSalary).toBe(100);
      // Unpaid leave deduction: 10 days * (100 / 30) = 33.333
      expect(result.leaveDeduction).toBeCloseTo(33.333, 3);
      // Net salary: 100 - 33.333 = 66.667
      expect(result.netSalary).toBeCloseTo(66.667, 3);
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
