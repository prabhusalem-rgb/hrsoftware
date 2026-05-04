import { useQuery } from '@tanstack/react-query';
import { calculateAirTicketBalance, getCurrentYearEarned } from '@/lib/calculations/air_ticket';
import { AirTicket } from '@/types';
import { createClient } from '@/lib/supabase/client';

export interface TicketBalanceData {
  accrued: number;
  used: number;
  issued: number;
  available: number;
  joinDate: string;
  airTicketCycle: number;
  openingTickets: number;
  currentYearEarned?: number;
}

export function useAirTicketBalance(employeeId: string | undefined | null) {
  return useQuery<TicketBalanceData>({
    queryKey: ['air-ticket-balance', employeeId],
    queryFn: async (): Promise<TicketBalanceData> => {
      if (!employeeId) {
        return {
          accrued: 0,
          used: 0,
          issued: 0,
          available: 0,
          joinDate: '',
          airTicketCycle: 12,
          openingTickets: 0,
        };
      }

      const supabase = createClient();

      // Fetch employee
      const { data: employee, error: empError } = await supabase
        .from('employees')
        .select('join_date, air_ticket_cycle, opening_air_tickets')
        .eq('id', employeeId)
        .single();

      if (empError || !employee) {
        throw new Error('Employee not found');
      }

      // Fetch all air tickets for the employee
      const { data: tickets, error: ticketsError } = await supabase
        .from('air_tickets')
        .select('status, created_at, issued_at, used_at')
        .eq('employee_id', employeeId);

      if (ticketsError) {
        throw new Error('Failed to fetch tickets');
      }

      const balance = calculateAirTicketBalance(
        employee.join_date,
        new Date().toISOString().split('T')[0],
        employee.opening_air_tickets || 0,
        (tickets || []) as AirTicket[],
        employee.air_ticket_cycle || 12
      );

      // Calculate current year earned
      const currentYearEarned = getCurrentYearEarned(
        employee.join_date,
        new Date().toISOString().split('T')[0],
        employee.air_ticket_cycle || 12,
        employee.opening_air_tickets || 0
      );

      return {
        accrued: balance.accrued,
        used: balance.used,
        issued: balance.issued,
        available: balance.available,
        joinDate: employee.join_date,
        airTicketCycle: employee.air_ticket_cycle || 12,
        openingTickets: employee.opening_air_tickets || 0,
        currentYearEarned,
      };
    },
    enabled: !!employeeId,
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
}
