import { Employee, Attendance, Loan, LoanRepayment, SalaryRevision, Leave, LeaveType } from '@/types';
import { calculateOvertimePay, type OvertimeRate } from './overtime';

export interface PayrollInput {
  employee: Employee;
  attendanceRecords: Attendance[];  // absent/overtime records for the month
  leaveRecords: Leave[];            // All approved leaves for the year so far
  leaveTypes: LeaveType[];          // Available leave types with payment tiers
  activeLoan: Loan | null;
  loanRepayment: LoanRepayment | null;
  workingDaysInMonth: number;
  month: number;
  year: number;
  revisions?: SalaryRevision[];
  manualOtherAllowance?: number;
  manualOtherDeduction?: number;
}

export interface PayrollOutput {
  employeeId: string;
  basicSalary: number;
  housingAllowance: number;
  transportAllowance: number;
  foodAllowance: number;
  specialAllowance: number;
  siteAllowance: number;
  otherAllowance: number;
  overtimeHours: number;
  overtimePay: number;
  grossSalary: number;
  absentDays: number;
  absenceDeduction: number;
  leaveDeduction: number;           // New: Tiered leave deductions
  loanDeduction: number;
  otherDeduction: number;
  totalDeductions: number;
  socialSecurityDeduction: number;
  pasiCompanyShare: number;
  netSalary: number;
}

/**
 * Calculate monthly payroll for a single employee.
 */
export function calculateEmployeePayroll(input: PayrollInput): PayrollOutput {
  const { 
    employee, attendanceRecords, leaveRecords, leaveTypes,
    activeLoan, loanRepayment, workingDaysInMonth, month, year, revisions = [],
    manualOtherAllowance, manualOtherDeduction
  } = input;

  // --- Segments for Pro-Rata Earnings ---
  const daysInMonth = new Date(year, month, 0).getDate();
  const sortedRevisions = revisions
    .filter(r => {
      const revDate = new Date(r.effective_date);
      return revDate.getMonth() + 1 === month && revDate.getFullYear() === year;
    })
    .sort((a, b) => new Date(a.effective_date).getTime() - new Date(b.effective_date).getTime());

  // --- Handle Rejoining Date (Pro-rata Salary) ---
  const rejoinDate = employee.rejoin_date ? new Date(employee.rejoin_date) : null;
  const isRejoiningThisMonth = rejoinDate &&
                               !isNaN(rejoinDate.getTime()) &&
                               rejoinDate.getMonth() + 1 === month &&
                               rejoinDate.getFullYear() === year;

  // --- Handle Joining Date (Pro-rata Salary for new employees) ---
  const joinDate = employee.join_date ? new Date(employee.join_date) : null;
  const isJoiningThisMonth = joinDate &&
                             !isNaN(joinDate.getTime()) &&
                             joinDate.getMonth() + 1 === month &&
                             joinDate.getFullYear() === year;

  // Determine the effective start day for salary calculation
  // If rejoining this month, count from rejoin_date; if joining this month, count from join_date
  const effectiveStartDay = isRejoiningThisMonth ? rejoinDate!.getDate()
                            : isJoiningThisMonth ? joinDate!.getDate()
                            : 1;

  let basicSalary = 0;
  let housingAllowance = 0;
  let transportAllowance = 0;
  let foodAllowance = 0;
  let specialAllowance = 0;
  let siteAllowance = 0;
  let otherAllowance = 0;

  if (sortedRevisions.length === 0) {
    const fullBasic = Number(employee.basic_salary);
    const fullHousing = Number(employee.housing_allowance);
    const fullTransport = Number(employee.transport_allowance);
    const fullFood = Number(employee.food_allowance || 0);
    const fullSpecial = Number(employee.special_allowance || 0);
    const fullSite = Number(employee.site_allowance || 0);
    const fullOther = Number(employee.other_allowance);

    if (isRejoiningThisMonth || isJoiningThisMonth) {
      const startDay = effectiveStartDay;
      const endDay = daysInMonth;
      const workedDays = getCalendarDaysInRange(year, month, startDay, endDay);
      const ratio = Math.min(1.0, workedDays / 30.0);

      basicSalary = fullBasic * ratio;
      housingAllowance = fullHousing * ratio;
      transportAllowance = fullTransport * ratio;
      foodAllowance = fullFood * ratio;
      specialAllowance = fullSpecial * ratio;
      siteAllowance = fullSite * ratio;
      otherAllowance = manualOtherAllowance !== undefined ? manualOtherAllowance : fullOther * ratio;
    } else {
      basicSalary = fullBasic;
      housingAllowance = fullHousing;
      transportAllowance = fullTransport;
      foodAllowance = fullFood;
      specialAllowance = fullSpecial;
      siteAllowance = fullSite;
      otherAllowance = manualOtherAllowance !== undefined ? manualOtherAllowance : fullOther;
    }
  } else {
    let currentStartDay = effectiveStartDay;
    let lastUsedRev: any = null;
    let lastPreRejoinRev: any = null;

    for (let i = 0; i < sortedRevisions.length; i++) {
      const rev = sortedRevisions[i];
      const revDate = new Date(rev.effective_date);
      const revDay = revDate.getDate();

      // Track the most recent revision that occurred before rejoin (for fallback)
      if (isRejoiningThisMonth && revDay < effectiveStartDay) {
        lastPreRejoinRev = rev;  // Keep overwriting; last one wins
        continue;
      }

      const nextRev = sortedRevisions[i + 1];
      let endDay = nextRev ? new Date(nextRev.effective_date).getDate() - 1 : daysInMonth;

      let segmentStart = currentStartDay;
      let usePreviousRates = false;

      if ((isRejoiningThisMonth || isJoiningThisMonth) && currentStartDay < revDay) {
        // Rejoin/join date is before this revision: apply previous rates from start date to day before revision
        segmentStart = currentStartDay;
        endDay = revDay - 1;
        usePreviousRates = true;
      }

      if (segmentStart > endDay) {
        currentStartDay = endDay + 1;
        continue;
      }

      const segmentWorkingDays = getCalendarDaysInRange(year, month, segmentStart, endDay);
      const ratio = segmentWorkingDays / 30.0;

      if (usePreviousRates) {
        basicSalary += Number(rev.previous_basic) * ratio;
        housingAllowance += Number(rev.previous_housing) * ratio;
        transportAllowance += Number(rev.previous_transport) * ratio;
        foodAllowance += Number(rev.previous_food || 0) * ratio;
        specialAllowance += Number(rev.previous_special || 0) * ratio;
        siteAllowance += Number(rev.previous_site || 0) * ratio;
        otherAllowance += (manualOtherAllowance !== undefined ? manualOtherAllowance / 30.0 * segmentWorkingDays : Number(rev.previous_other) * ratio);

        // Now handle the "after revision" segment with new rates
        const afterStart = revDay;
        const afterEnd = nextRev ? new Date(nextRev.effective_date).getDate() - 1 : daysInMonth;
        if (afterStart <= afterEnd) {
          const afterWorkingDays = getCalendarDaysInRange(year, month, afterStart, afterEnd);
          const afterRatio = afterWorkingDays / 30.0;

          basicSalary += Number(rev.new_basic) * afterRatio;
          housingAllowance += Number(rev.new_housing) * afterRatio;
          transportAllowance += Number(rev.new_transport) * afterRatio;
          foodAllowance += Number(rev.new_food || 0) * afterRatio;
          specialAllowance += Number(rev.new_special || 0) * afterRatio;
          siteAllowance += Number(rev.new_site || 0) * afterRatio;
          otherAllowance += (manualOtherAllowance !== undefined ? manualOtherAllowance / 30.0 * afterWorkingDays : Number(rev.new_other) * afterRatio);
        }
        // Move currentStartDay past this revision's coverage and continue to next revision
        currentStartDay = afterEnd + 1;
        lastUsedRev = rev;
        // Continue loop for any further revisions (no break)
      } else {
        // Normal segment (revision effective date is on or before currentStartDay)
        basicSalary += Number(rev.new_basic) * ratio;
        housingAllowance += Number(rev.new_housing) * ratio;
        transportAllowance += Number(rev.new_transport) * ratio;
        foodAllowance += Number(rev.new_food || 0) * ratio;
        specialAllowance += Number(rev.new_special || 0) * ratio;
        siteAllowance += Number(rev.new_site || 0) * ratio;
        otherAllowance += (manualOtherAllowance !== undefined ? manualOtherAllowance / 30.0 * segmentWorkingDays : Number(rev.new_other) * ratio);
        currentStartDay = endDay + 1;
        lastUsedRev = rev;
      }
    }

    // Handle remaining days after last processed revision
    if ((isRejoiningThisMonth || isJoiningThisMonth) && currentStartDay <= daysInMonth) {
      const remainingWorkingDays = getCalendarDaysInRange(year, month, currentStartDay, daysInMonth);
      const remainingRatio = remainingWorkingDays / 30.0;

      // Use the last revision we actually applied, or fall back to the last pre-rejoin revision
      const applicableRev = lastUsedRev || lastPreRejoinRev;
      if (applicableRev) {
        basicSalary += Number(applicableRev.new_basic) * remainingRatio;
        housingAllowance += Number(applicableRev.new_housing) * remainingRatio;
        transportAllowance += Number(applicableRev.new_transport) * remainingRatio;
        foodAllowance += Number(applicableRev.new_food || 0) * remainingRatio;
        specialAllowance += Number(applicableRev.new_special || 0) * remainingRatio;
        siteAllowance += Number(applicableRev.new_site || 0) * remainingRatio;
        otherAllowance += (manualOtherAllowance !== undefined ? manualOtherAllowance / 30.0 * remainingWorkingDays : Number(applicableRev.new_other) * remainingRatio);
      }
    }
  }

  // --- Overtime ---
  let overtimeHours = 0;
  let overtimePay = 0;
  for (const record of attendanceRecords) {
    if (record.overtime_hours > 0 && record.overtime_type !== 'none') {
      overtimeHours += Number(record.overtime_hours);
      overtimePay += calculateOvertimePay(basicSalary, Number(record.overtime_hours), record.overtime_type as OvertimeRate);
    }
  }

  // --- Gross Earnings ---
  const grossSalary = basicSalary + housingAllowance + transportAllowance + foodAllowance + specialAllowance + siteAllowance + otherAllowance + overtimePay;

  // --- Daily Rates for Deductions ---
  // We use gross fixed allowances + basic for deductions as per common practice
  const fixedGrossPerMonth = basicSalary + housingAllowance + transportAllowance + foodAllowance + specialAllowance + siteAllowance + otherAllowance;
  const dailyRate = fixedGrossPerMonth / 30.0;

  // --- Absent Days Deduction ---
  const absentDays = attendanceRecords.filter(r => r.status === 'absent').length;
  const absenceDeduction = Math.round(dailyRate * absentDays * 1000) / 1000;

  // --- Leave Tiered Deductions ---
  // Handles Sick Leave tiers (e.g., 21 days @ 100%, then 75%, etc.)
  const leaveDeduction = calculateLeaveDeductions(
    employee.id,
    dailyRate,
    leaveRecords,
    leaveTypes,
    month,
    year
  );

  // --- Loan Deduction ---
  let loanDeduction = 0;
  if (activeLoan && loanRepayment && !loanRepayment.is_held) {
    loanDeduction = Number(loanRepayment.amount);
  }

  // --- Other Deductions ---
  const otherDeduction = manualOtherDeduction !== undefined ? manualOtherDeduction : 0;

  // --- Social Protection Fund (SPF) - Replacing PASI (2024 Law) ---
  let socialSecurityDeduction = 0;
  let pasiCompanyShare = 0;

  const nationality = employee.nationality?.toUpperCase();
  const isOmani = nationality === "OMAN" || nationality === "OMN" || nationality === "OMANI" ||
                  employee.category === 'OMANI_DIRECT_STAFF' || employee.category === 'OMANI_INDIRECT_STAFF';

  if (isOmani) {
    // Current SPF (Social Protection Fund) Law:
    // Base: Basic + Housing (Capped at 3000 OMR)
    // Employee share: 8.0% total (7.5% Pension + 0.5% Job Security)
    // Employer share: 13.5% total (11% Pension + 1% Work Injury + 1% Maternity + 0.5% Job Security)
    const pasiBase = Math.min(3000, basicSalary + housingAllowance);
    socialSecurityDeduction = Math.round(pasiBase * 0.08 * 1000) / 1000;
    pasiCompanyShare = Math.round(pasiBase * 0.135 * 1000) / 1000;
  }

  // --- Total Deductions ---
  const totalDeductions = absenceDeduction + leaveDeduction + loanDeduction + otherDeduction + socialSecurityDeduction;

  // --- Net Salary ---
  // Guard against NaN from any component (e.g., if employee salary data is incomplete)
  const rawNet = grossSalary - totalDeductions;
  const netSalary = isNaN(rawNet) ? 0 : Math.max(0, Math.round(rawNet * 1000) / 1000);

  return {
    employeeId: employee.id,
    basicSalary: Math.round(basicSalary * 1000) / 1000,
    housingAllowance: Math.round(housingAllowance * 1000) / 1000,
    transportAllowance: Math.round(transportAllowance * 1000) / 1000,
    foodAllowance: Math.round(foodAllowance * 1000) / 1000,
    specialAllowance: Math.round(specialAllowance * 1000) / 1000,
    siteAllowance: Math.round(siteAllowance * 1000) / 1000,
    otherAllowance: Math.round(otherAllowance * 1000) / 1000,
    overtimeHours: Math.round(overtimeHours * 10) / 10,
    overtimePay: Math.round(overtimePay * 1000) / 1000,
    grossSalary: Math.round(grossSalary * 1000) / 1000,
    absentDays,
    absenceDeduction,
    leaveDeduction,
    loanDeduction: Math.round(loanDeduction * 1000) / 1000,
    otherDeduction: Math.round(otherDeduction * 1000) / 1000,
    totalDeductions: Math.round(totalDeductions * 1000) / 1000,
    socialSecurityDeduction,
    pasiCompanyShare,
    netSalary: Math.max(0, netSalary),
  };
}

/**
 * Calculates tiered deductions for leaves taken within the current month.
 */
function calculateLeaveDeductions(employeeId: string, dailyRate: number, leaveRecords: Leave[], leaveTypes: LeaveType[], month: number, year: number): number {
  let totalDeduction = 0;
  const currentMonthStart = new Date(Date.UTC(year, month - 1, 1));
  const currentMonthEnd = new Date(Date.UTC(year, month, 0, 23, 59, 59, 999));

  // We need to count days from the beginning of the year to correctly identify tiers
  // Sort leaves by date
  const sortedLeaves = [...leaveRecords].sort((a, b) => new Date(a.start_date).getTime() - new Date(b.start_date).getTime());

  // Map to track cumulative days per leave type
  const cumulativeDaysPerType: Record<string, number> = {};

  for (const leave of sortedLeaves) {
    if (leave.status !== 'approved' || leave.employee_id !== employeeId) continue;
    
    const type = leaveTypes.find(t => t.id === leave.leave_type_id);
    if (!type) continue;

    const leaveStart = new Date(leave.start_date);
    const leaveEnd = new Date(leave.end_date);
    
    // Iterate through every day of this leave
    const cursor = new Date(leaveStart);
    while (cursor <= leaveEnd) {
      if (cursor.getFullYear() === year) {
        // Increment global counter for this type
        cumulativeDaysPerType[type.id] = (cumulativeDaysPerType[type.id] || 0) + 1;
        const currentNthDay = cumulativeDaysPerType[type.id];

        // Is this day inside the month being processed?
        if (cursor >= currentMonthStart && cursor <= currentMonthEnd) {
          // Determine percentage for this specific day
          let percentage = type.is_paid ? 1.0 : 0.0;
          
          if (type.payment_tiers && type.payment_tiers.length > 0) {
            const tier = type.payment_tiers.find(t => currentNthDay >= t.min_day && currentNthDay <= t.max_day);
            if (tier) {
              percentage = tier.percentage;
            } else if (currentNthDay > type.max_days) {
              percentage = 0.0; // Over-limit is usually unpaid
            }
          }

          // Deduction is the unpaid portion of the daily rate
          totalDeduction += dailyRate * (1 - percentage);
        }
      }
      cursor.setDate(cursor.getDate() + 1);
    }
  }

  return Math.round(totalDeduction * 1000) / 1000;
}

/**
 * Get working days in a month (approx 26 for Oman — excludes Fri/Sat)
 */
export function getWorkingDaysInMonth(year: number, month: number): number {
  const daysInMonth = new Date(year, month, 0).getDate();
  return getWorkingDaysInRange(year, month, 1, daysInMonth);
}

/**
 * Get working days in a specific range of a month (Excludes Fri/Sat for Oman)
 */
export function getWorkingDaysInRange(year: number, month: number, startDay: number, endDay: number): number {
  let workingDays = 0;
  for (let day = startDay; day <= endDay; day++) {
    const date = new Date(year, month - 1, day);
    const dayOfWeek = date.getDay();
    // Oman: Friday (5) and Saturday (6) are weekends
    if (dayOfWeek !== 5 && dayOfWeek !== 6) {
      workingDays++;
    }
  }
  return workingDays;
}
/**
 * Get calendar days in a specific range of a month
 */
export function getCalendarDaysInRange(year: number, month: number, startDay: number, endDay: number): number {
  return Math.max(0, endDay - startDay + 1);
}

