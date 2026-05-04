import { useQuery } from '@tanstack/react-query';
import { AirTicket } from '@/types';

export function useAirTickets(employeeId?: string, companyId?: string) {
  return useQuery({
    queryKey: ['air-tickets', employeeId, companyId],
    queryFn: async (): Promise<AirTicket[]> => {
      const params = new URLSearchParams();
      if (employeeId) params.set('employee_id', employeeId);
      if (companyId) params.set('company_id', companyId);

      const response = await fetch(`/api/air-tickets?${params.toString()}`, {
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
      });

      if (!response.ok) {
        const error = await response.json().catch(() => ({ error: 'Failed to fetch' }));
        throw new Error(error.error || 'Failed to fetch air tickets');
      }

      const data = await response.json();
      return data.items as AirTicket[];
    },
  });
}
