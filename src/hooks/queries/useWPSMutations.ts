import { useMutation, useQueryClient } from '@tanstack/react-query';
import { createClient } from '@/lib/supabase/client';
import { toast } from 'sonner';
import type { WPSEXPORT } from '@/types';

interface WPSExportWithItems {
  exportData: any;
  item_ids?: string[];
  exported_amounts?: Record<string, number>;  // item_id -> amount mapping
}

export function useWPSMutations(companyId: string) {
  const queryClient = useQueryClient();
  const supabase = createClient();

  const createWPSExport = useMutation({
    mutationFn: async ({ exportData, item_ids, exported_amounts }: WPSExportWithItems) => {
      const { error } = await supabase.from('wps_exports').insert([exportData]);
      if (error) throw new Error(error.message || 'Failed to create WPS export');

      // Update payroll run status to 'exported'
      await supabase
        .from('payroll_runs')
        .update({ status: 'exported' })
        .eq('id', exportData.payroll_run_id);

      // Mark payroll items as 'paid' with the actual exported amount
      if (item_ids && item_ids.length > 0) {
        const updates = item_ids.map(id => {
          const paidAmount = exported_amounts?.[id] ?? null;
          return {
            id,
            payout_status: 'paid' as const,
            paid_amount: paidAmount,
            wps_export_override: null,
            payout_date: new Date().toISOString(),
          };
        });

        for (const update of updates) {
          const { error: itemError } = await supabase
            .from('payroll_items')
            .update({
              payout_status: update.payout_status,
              paid_amount: update.paid_amount,
              wps_export_override: update.wps_export_override,
              payout_date: update.payout_date,
            })
            .eq('id', update.id);

          if (itemError) {
            console.error(`Failed to update item ${update.id}:`, itemError);
          }
        }
      } else {
        await supabase
          .from('payroll_items')
          .update({ payout_status: 'paid', wps_export_override: null })
          .eq('payroll_run_id', exportData.payroll_run_id)
          .in('payout_status', ['pending', 'failed']);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['wps_exports', companyId] });
      queryClient.invalidateQueries({ queryKey: ['payroll_runs', companyId] });
      queryClient.invalidateQueries({ queryKey: ['payroll_items'] });
      toast.success('WPS export record saved');
    },
    onError: (err: any) => toast.error(err.message),
  });

  return { createWPSExport };
}
