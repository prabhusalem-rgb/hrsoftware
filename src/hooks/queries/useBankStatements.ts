import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { createClient } from '@/lib/supabase/client';
import { toast } from 'sonner';
import type { BankStatement, BankTransaction } from '@/types';

export function useBankStatements(companyId: string) {
  const supabase = createClient();

  return useQuery({
    queryKey: ['bank_statements', companyId],
    queryFn: async (): Promise<BankStatement[]> => {
      if (!companyId) return [];

      const { data, error } = await supabase
        .from('bank_statements')
        .select(`
          *,
          uploaded_by_profile:uploaded_by(full_name, email)
        `)
        .order('statement_period_end', { ascending: false })
        .order('created_at', { ascending: false });

      if (error) throw new Error(error.message || 'Failed');
      return data as BankStatement[] || [];
    },
    enabled: !!companyId,
  });
}

export function useBankStatementMutations(companyId: string) {
  const queryClient = useQueryClient();
  const supabase = createClient();

  const uploadStatement = useMutation({
    mutationFn: async (statement: Omit<BankStatement, 'id' | 'created_at' | 'uploaded_by' | 'uploaded_at' | 'status'>) => {
      if (!supabase) throw new Error('Supabase not available');

      const { data, error } = await supabase
        .from('bank_statements')
        .insert([{ ...statement, status: 'pending' }])
        .select()
        .single();

      if (error) throw new Error(error.message || 'Failed to upload bank statement');
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['bank_statements', companyId] });
      toast.success('Bank statement uploaded');
    },
    onError: (err: any) => toast.error(err.message),
  });

  const importTransactions = useMutation({
    mutationFn: async ({
      statementId,
      transactions
    }: {
      statementId: string;
      transactions: Array<{
        transaction_date: string;
        value_date?: string;
        description: string;
        reference_number?: string;
        credit?: number;
        debit?: number;
        balance?: number;
      }>
    }) => {
      if (!supabase) throw new Error('Supabase not available');

      const formatted = transactions.map(t => ({
        ...t,
        bank_statement_id: statementId,
        transaction_type: t.credit && t.credit > 0 ? 'salary' : null,
        transaction_date: t.transaction_date,
        credit: t.credit || 0,
        debit: t.debit || 0
      }));

      const { error } = await supabase
        .from('bank_transactions')
        .insert(formatted);

      if (error) throw new Error(error.message || 'Failed to import transactions');

      // Update statement status
      await supabase
        .from('bank_statements')
        .update({ status: 'processing' })
        .eq('id', statementId);

      return { count: transactions.length };
    },
    onSuccess: (data) => {
      toast.success(`${data.count} transactions imported`);
    },
    onError: (err: any) => toast.error(err.message),
  });

  const reconcileStatement = useMutation({
    mutationFn: async ({
      statementId,
      tolerance = 0.001
    }: {
      statementId: string;
      tolerance?: number;
    }) => {
      if (!supabase) throw new Error('Supabase not available');

      const { data, error } = await supabase
        .from('bank_statements')
        .rpc('reconcile_bank_transaction', {
          p_bank_transaction_id: null,
          p_statement_id: statementId,
          p_tolerance: tolerance
        });

      if (error) throw new Error(error.message || 'Reconciliation failed');
      return data;
    },
    onSuccess: (data) => {
      toast.success(`Reconciled ${data.matched || 0} transactions`);
    },
    onError: (err: any) => toast.error(err.message),
  });

  const completeReconciliation = useMutation({
    mutationFn: async (statementId: string) => {
      if (!supabase) throw new Error('Supabase not available');

      const { error } = await supabase
        .from('bank_statements')
        .update({ status: 'completed' })
        .eq('id', statementId);

      if (error) throw new Error(error.message || 'Failed to complete reconciliation');
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['bank_statements', companyId] });
      toast.success('Reconciliation completed');
    },
    onError: (err: any) => toast.error(err.message),
  });

  return {
    uploadStatement,
    importTransactions,
    reconcileStatement,
    completeReconciliation
  };
}
