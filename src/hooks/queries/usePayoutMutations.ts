import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import type { PayoutStatus, PayoutMethod } from '@/types';

interface HoldParams {
  itemIds: string[];
  reason: string;
}

interface MarkPaidParams {
  itemIds: string[];
  method: PayoutMethod;
  reference: string;
  paidAmounts?: Record<string, number>;
  notes?: string;
  payoutDate?: string;
}

interface MarkFailedParams {
  itemIds: string[];
  reason: string;
  notes?: string;
}

interface ReleaseParams {
  itemIds: string[];
}

interface SetWpsOverrideParams {
  itemIds: string[];
  overrideAmount: number;
}

export function usePayoutMutations(companyId: string) {
  const queryClient = useQueryClient();

  const batchHold = useMutation({
    mutationFn: async ({ itemIds, reason }: HoldParams) => {
      const response = await fetch('/api/payouts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          item_ids: itemIds,
          action: 'hold',
          hold_reason: reason,
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to hold items');
      }

      return response.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['payroll_items'] });
      queryClient.invalidateQueries({ queryKey: ['payout_items'] });
      toast.success('Hold placed successfully');
    },
    onError: (err: Error) => {
      toast.error(err.message);
    },
  });

  const batchRelease = useMutation({
    mutationFn: async ({ itemIds }: ReleaseParams) => {
      const response = await fetch('/api/payouts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          item_ids: itemIds,
          action: 'release',
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to release items');
      }

      return response.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['payroll_items'] });
      queryClient.invalidateQueries({ queryKey: ['payout_items'] });
      toast.success('Hold released successfully');
    },
    onError: (err: Error) => {
      toast.error(err.message);
    },
  });

  const markPaid = useMutation({
    mutationFn: async ({
      itemIds,
      method,
      reference,
      paidAmounts,
      notes,
      payoutDate,
    }: MarkPaidParams) => {
      const response = await fetch('/api/payouts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          item_ids: itemIds,
          action: 'mark_paid',
          payout_method: method,
          payout_reference: reference,
          paid_amount: paidAmounts,
          payout_date: payoutDate,
          notes,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        console.error('markPaid error response:', data);
        throw new Error(data.error || 'Failed to mark items as paid');
      }

      return data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['payroll_items'] });
      queryClient.invalidateQueries({ queryKey: ['payout_items'] });
      toast.success(`Marked ${data.updatedCount} item(s) as paid`);
    },
    onError: (err: Error) => {
      toast.error(err.message);
    },
  });

  const markFailed = useMutation({
    mutationFn: async ({ itemIds, reason, notes }: MarkFailedParams) => {
      const response = await fetch('/api/payouts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          item_ids: itemIds,
          action: 'mark_failed',
          hold_reason: reason,
          notes,
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to mark items as failed');
      }

      return response.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['payroll_items'] });
      queryClient.invalidateQueries({ queryKey: ['payout_items'] });
      toast.success(`Marked ${data.updatedCount} item(s) as failed`);
    },
    onError: (err: Error) => {
      toast.error(err.message);
    },
  });

  const batchProcess = useMutation({
    mutationFn: async ({ itemIds }: { itemIds: string[] }) => {
      const response = await fetch('/api/payouts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          item_ids: itemIds,
          action: 'process',
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to process items');
      }

      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['payroll_items'] });
      queryClient.invalidateQueries({ queryKey: ['payout_items'] });
      toast.success('Payout status updated to Processing');
    },
    onError: (err: Error) => {
      toast.error(err.message);
    },
  });

  const setWpsOverride = useMutation({
    mutationFn: async ({ itemIds, overrideAmount }: SetWpsOverrideParams) => {
      const response = await fetch('/api/payouts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          item_ids: itemIds,
          action: 'set_wps_override',
          wps_export_override: overrideAmount,
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to set WPS override');
      }

      return response.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['payroll_items'] });
      toast.success(`WPS export override set for ${data.updatedCount} item(s)`);
    },
    onError: (err: Error) => {
      toast.error(err.message);
    },
  });

  const resetPayout = useMutation({
    mutationFn: async ({ itemIds }: ReleaseParams) => {
      const response = await fetch('/api/payouts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          item_ids: itemIds,
          action: 'reset',
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to reset items');
      }

      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['payroll_items'] });
      queryClient.invalidateQueries({ queryKey: ['payout_items'] });
      toast.success('Payout reset to pending');
    },
    onError: (err: Error) => {
      toast.error(err.message);
    },
  });

  return {
    batchHold,
    batchRelease,
    markPaid,
    markFailed,
    batchProcess,
    setWpsOverride,
    resetPayout,
  };
}
