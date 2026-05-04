import { Employee, LeaveType } from '@/types';

/**
 * Check if an employee is eligible for a given leave type
 * Returns { eligible: boolean; reason?: string }
 */
export function checkLeaveEligibility(employee: Employee | undefined, leaveType: LeaveType | undefined): { eligible: boolean; reason?: string } {
  if (!employee || !leaveType) {
    return { eligible: true }; // No restriction if data missing
  }

  const leaveName = leaveType.name.toLowerCase();

  // Maternity Leave: only for female employees
  if (leaveName.includes('maternity')) {
    if (employee.gender !== 'female') {
      return {
        eligible: false,
        reason: 'Maternity leave is only available for female employees'
      };
    }
  }

  // Hajj Leave: only for Muslim employees
  if (leaveName.includes('hajj')) {
    if (employee.religion !== 'muslim') {
      return {
        eligible: false,
        reason: 'Hajj leave is only available for Muslim employees'
      };
    }
  }

  return { eligible: true };
}
