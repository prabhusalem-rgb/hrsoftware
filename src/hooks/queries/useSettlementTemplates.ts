// ============================================================
// useSettlementTemplates — Settlement Template Query & Mutation Hooks
// Final Settlement Redesign — Phase 3
// ============================================================

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import type { SettlementTemplate, SettlementTemplateFormData } from '@/types/settlement';

const SETTLEMENT_TEMPLATES_KEY = 'settlement_templates';

// ------------------------------------------------------------
// Hook: useSettlementTemplates
// Purpose: Fetch all templates for the user's company
// ------------------------------------------------------------
export function useSettlementTemplates() {
  return useQuery<SettlementTemplate[]>({
    queryKey: [SETTLEMENT_TEMPLATES_KEY],
    queryFn: async () => {
      const response = await fetch('/api/settlement/templates');
      if (!response.ok) {
        throw new Error('Failed to fetch templates');
      }
      return response.json();
    },
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
}

// ------------------------------------------------------------
// Hook: useCreateSettlementTemplate
// Purpose: Save current config as a new template
// ------------------------------------------------------------
export function useCreateSettlementTemplate() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: SettlementTemplateFormData) => {
      const response = await fetch('/api/settlement/templates', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to create template');
      }

      return response.json();
    },

    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [SETTLEMENT_TEMPLATES_KEY] });
      toast.success('Template saved successfully');
    },

    onError: (error: Error) => {
      toast.error('Failed to save template', {
        description: error.message,
      });
    },
  });
}

// ------------------------------------------------------------
// Hook: useUpdateSettlementTemplate
// Purpose: Update an existing template
// ------------------------------------------------------------
export function useUpdateSettlementTemplate() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      id,
      data,
    }: {
      id: string;
      data: Partial<SettlementTemplateFormData>;
    }) => {
      const response = await fetch(`/api/settlement/templates/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to update template');
      }

      return response.json();
    },

    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [SETTLEMENT_TEMPLATES_KEY] });
      toast.success('Template updated successfully');
    },

    onError: (error: Error) => {
      toast.error('Failed to update template', {
        description: error.message,
      });
    },
  });
}

// ------------------------------------------------------------
// Hook: useDeleteSettlementTemplate
// Purpose: Delete a template
// ------------------------------------------------------------
export function useDeleteSettlementTemplate() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const response = await fetch(`/api/settlement/templates/${id}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to delete template');
      }

      return response.json();
    },

    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [SETTLEMENT_TEMPLATES_KEY] });
      toast.success('Template deleted successfully');
    },

    onError: (error: Error) => {
      toast.error('Failed to delete template', {
        description: error.message,
      });
    },
  });
}

export default useSettlementTemplates;
