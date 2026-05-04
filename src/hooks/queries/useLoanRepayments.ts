import { useQuery } from '@tanstack/react-query';
import { createClient } from '@/lib/supabase/client';
import { LoanRepayment } from '@/types';

// Type for loan schedule join
interface LoanScheduleWithLoan {
  id: string;
  loan_id: string;
  due_date: string;
  total_due: number;
  status: string;
  is_held: boolean;
  paid_amount: number | null;
  paid_date: string | null;
  created_at: string;
  loan: {
    id: string;
    employee_id: string;
    employee: {
      id: string;
      emp_code: string;
      name_en: string;
      company_id: string;
    };
  };
}

export function useLoanRepayments(companyId: string) {
  const supabase = createClient();

  return useQuery({
    queryKey: ['loan_repayments', companyId],
    queryFn: async (): Promise<LoanRepayment[]> => {
      if (!supabase || !companyId) {
        return [];
      }

      const { data, error } = await supabase
        .from('loan_schedule')
        .select(`
          id,
          loan_id,
          due_date,
          total_due,
          status,
          is_held,
          paid_amount,
          paid_date,
          created_at,
          loan:loan_id!inner(
            employee:employee_id!inner(
              id,
              emp_code,
              name_en,
              company_id
            )
          )
        `)
        .eq('loan.employee.company_id', companyId)
        .in('status', ['scheduled', 'pending'])
        .eq('is_held', false);

      if (error) throw new Error(error.message || 'Failed to fetch loan schedule');

      const scheduleData = data as LoanScheduleWithLoan[];

      return scheduleData.map(item => ({
        id: item.id,
        loan_id: item.loan_id,
        month: new Date(item.due_date).getMonth() + 1,
        year: new Date(item.due_date).getFullYear(),
        amount: item.total_due,
        is_held: item.is_held,
        paid_at: item.paid_date,
        created_at: item.created_at,
      }));
    },
    enabled: !!companyId,
  });
}
