// ============================================================
// Settlement Mutations — React Query Hooks
// Final Settlement Redesign — Phase 2
// ============================================================

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import type {
  CreateSettlementRequest,
  BatchSettlementConfig,
  SettlementReversalRequest,
  CreateSettlementResponse,
  BatchSettlementResult,
  SettlementReversalResult,
} from '@/types';

// Keys
const SETTLEMENT_KEY = 'settlements';
const SETTLEMENT_HISTORY_KEY = 'settlement_history';

// ============================================================
// Hook: useCreateSettlement
// Purpose: Create a single final settlement
// ============================================================
export function useCreateSettlement(companyId?: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: CreateSettlementRequest) => {
      const response = await fetch('/api/settlement', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to create settlement');
      }

      return response.json() as Promise<CreateSettlementResponse>;
    },

    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: [SETTLEMENT_HISTORY_KEY] });
      if (companyId) {
        queryClient.invalidateQueries({ queryKey: ['employees', companyId] });
      }
      toast.success('Settlement processed successfully', {
        description: `Net payout: ${data.netTotal.toFixed(3)} OMR`,
        action: {
          label: 'Download PDF',
          onClick: () => {
            window.open(data.pdfUrl, '_blank');
          },
        },
      });
    },

    onError: (error: Error) => {
      toast.error('Settlement failed', {
        description: error.message,
      });
    },
  });
}

// ============================================================
// Hook: useBatchSettlement
// Purpose: Process multiple settlements in one batch
// ============================================================
export function useBatchSettlement() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: BatchSettlementConfig) => {
      const response = await fetch('/api/settlement/batch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Batch settlement failed');
      }

      return response.json() as Promise<BatchSettlementResult>;
    },

    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: [SETTLEMENT_HISTORY_KEY] });
      queryClient.invalidateQueries({ queryKey: ['employees'] });

      toast.success(
        `Batch completed: ${data.successful}/${data.totalItems} settled successfully`
      );

      if (data.failed > 0) {
        toast.warning(`${data.failed} employees failed`, {
          description: 'Check the results for details',
        });
      }
    },

    onError: (error: Error) => {
      toast.error('Batch settlement failed', {
        description: error.message,
      });
    },
  });
}

// ============================================================
// Hook: useReverseSettlement
// Purpose: Reverse/void a settlement within allowed window
// ============================================================
export function useReverseSettlement() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      settlementId,
      reason,
      notes,
    }: {
      settlementId: string;
      reason: string;
      notes?: string;
    }) => {
      const response = await fetch(`/api/settlement/${settlementId}/reverse`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reason, notes }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to reverse settlement');
      }

      return response.json() as Promise<SettlementReversalResult>;
    },

    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [SETTLEMENT_HISTORY_KEY] });
      queryClient.invalidateQueries({ queryKey: ['employees'] });

      toast.success('Settlement reversed', {
        description: 'Employee status restored to active',
      });
    },

    onError: (error: Error) => {
      toast.error('Reversal failed', {
        description: error.message,
      });
    },
  });
}

// ============================================================
// Hook: useSettlementHistory
// Purpose: Fetch settlement history for an employee or company
// ============================================================
export function useSettlementHistory(params?: {
  employeeId?: string;
  page?: number;
  limit?: number;
}) {
  const queryParams = new URLSearchParams();
  if (params?.employeeId) queryParams.set('employeeId', params.employeeId);
  if (params?.page) queryParams.set('page', params.page.toString());
  if (params?.limit) queryParams.set('limit', params.limit.toString());

  const queryKey = [
    SETTLEMENT_HISTORY_KEY,
    Object.fromEntries(queryParams.entries()),
  ];

  return {
    queryKey,
    fetchFn: async () => {
      const response = await fetch(
        `/api/settlement?${queryParams.toString()}`
      );
      if (!response.ok) {
        throw new Error('Failed to fetch settlement history');
      }
      return response.json();
    },
  };
}

// ============================================================
// Hook: useSettlementPDF
// Purpose: Download/stream settlement PDF
// ============================================================
export function useSettlementPDF() {
  return {
    download: (settlementId: string, download: boolean = true) => {
      const url = `/api/settlement/${settlementId}/pdf?download=${download}`;
      window.open(url, '_blank');
    },
    preview: (settlementId: string) => {
      const url = `/api/settlement/${settlementId}/pdf`;
      return url;
    },
  };
}

// ============================================================
// Type exports
// ============================================================
export type {
  CreateSettlementRequest,
  BatchSettlementConfig,
  SettlementReversalRequest,
};
