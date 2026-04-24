import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';

const API_BASE = '/api/air-tickets';

export function useAirTicketMutations() {
  const queryClient = useQueryClient();

  const mutateAirTicket = async (endpoint: string, body: Record<string, unknown>) => {
    const res = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: 'Request failed' }));
      throw new Error(err.error || 'Request failed');
    }

    return res.json();
  };

  const requestTicket = useMutation({
    mutationFn: async (payload: { employeeId: string; purpose: string; destination: string; quantity?: number; notes?: string }) => {
      const res = await fetch(`${API_BASE}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          employeeId: payload.employeeId,
          purpose: payload.purpose,
          destination: payload.destination,
          quantity: payload.quantity || 1,
          notes: payload.notes,
        }),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: 'Failed to create request' }));
        throw new Error(err.error || 'Failed to create request');
      }

      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['air-tickets'] });
      queryClient.invalidateQueries({ queryKey: ['air-ticket-balance'] });
      toast.success('Air ticket request submitted');
    },
    onError: (error: any) => {
      toast.error(`Request failed: ${error.message}`);
    },
  });

  const approveTicket = useMutation({
    mutationFn: async ({ id, notes }: { id: string; notes?: string }) => {
      return mutateAirTicket(`${API_BASE}/${id}/issue`, {
        flightDetails: notes || 'Approved and issued',
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['air-tickets'] });
      queryClient.invalidateQueries({ queryKey: ['air-ticket-balance'] });
      toast.success('Air ticket approved and issued');
    },
    onError: (error: any) => {
      toast.error(`Approval failed: ${error.message}`);
    },
  });

  const rejectTicket = useMutation({
    mutationFn: async ({ id, reason }: { id: string; reason: string }) => {
      const res = await fetch(`${API_BASE}/${id}/reject`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ reason }),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: 'Rejection failed' }));
        throw new Error(err.error || 'Rejection failed');
      }

      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['air-tickets'] });
      queryClient.invalidateQueries({ queryKey: ['air-ticket-balance'] });
      toast.success('Air ticket rejected');
    },
    onError: (error: any) => {
      toast.error(`Rejection failed: ${error.message}`);
    },
  });

  const issueTicket = useMutation({
    mutationFn: async ({ id, flightDetails }: { id: string; flightDetails: string }) => {
      return mutateAirTicket(`${API_BASE}/${id}/issue`, { flightDetails });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['air-tickets'] });
      queryClient.invalidateQueries({ queryKey: ['air-ticket-balance'] });
      toast.success('Air ticket issued');
    },
    onError: (error: any) => {
      toast.error(`Issue failed: ${error.message}`);
    },
  });

  const markAsUsed = useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`${API_BASE}/${id}/use`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: 'Update failed' }));
        throw new Error(err.error || 'Update failed');
      }

      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['air-tickets'] });
      queryClient.invalidateQueries({ queryKey: ['air-ticket-balance'] });
      toast.success('Air ticket marked as used');
    },
    onError: (error: any) => {
      toast.error(`Update failed: ${error.message}`);
    },
  });

  const cancelTicket = useMutation({
    mutationFn: async ({ id, reason }: { id: string; reason: string }) => {
      return mutateAirTicket(`${API_BASE}/${id}/cancel`, { reason });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['air-tickets'] });
      queryClient.invalidateQueries({ queryKey: ['air-ticket-balance'] });
      toast.success('Air ticket cancelled');
    },
    onError: (error: any) => {
      toast.error(`Cancellation failed: ${error.message}`);
    },
  });

  const deleteTicket = useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`${API_BASE}/${id}`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: 'Delete failed' }));
        throw new Error(err.error || 'Delete failed');
      }

      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['air-tickets'] });
      queryClient.invalidateQueries({ queryKey: ['air-ticket-balance'] });
      toast.success('Air ticket record deleted');
    },
    onError: (error: any) => {
      toast.error(`Delete failed: ${error.message}`);
    },
  });

  return {
    requestTicket,
    approveTicket,
    rejectTicket,
    issueTicket,
    markAsUsed,
    cancelTicket,
    deleteTicket,
  };
}
