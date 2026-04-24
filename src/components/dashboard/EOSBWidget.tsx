'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useQuery } from '@tanstack/react-query';
import { createClient } from '@/lib/supabase/client';
import { ShieldCheck, AlertTriangle, TrendingUp, Users, Loader2 } from 'lucide-react';
import { useCompany } from '@/components/providers/CompanyProvider';
import { toast } from 'sonner';

export function EOSBWidget() {
  const { activeCompanyId } = useCompany();

  const { data, isLoading, error } = useQuery({
    queryKey: ['dashboard_eosb_liability', activeCompanyId],
    queryFn: async () => {
      if (!activeCompanyId) return null;

      const supabase = createClient();

      // Call the RPC function we created
      const { data, error } = await supabase.rpc(
        'calculate_company_eosb_liability',
        { p_company_id: activeCompanyId, p_as_of_date: new Date().toISOString().split('T')[0] }
      );

      if (error) throw new Error(error.message || 'Failed to fetch EOSB liability');

      const total = (data || []).reduce((sum: number, row: any) => sum + (row.accrued_eosb || 0), 0);

      return {
        employees: data || [],
        total: Math.round(total * 1000) / 1000,
        count: data?.length || 0
      };
    },
    enabled: !!activeCompanyId
  });

  if (isLoading) {
    return (
      <Card>
        <CardContent className="pt-6">
          <div className="flex items-center justify-center h-32">
            <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
          </div>
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card>
        <CardContent className="pt-6">
          <div className="flex items-center justify-between mb-2">
            <CardTitle className="text-sm font-semibold">EOSB Liability</CardTitle>
            <ShieldCheck className="w-4 h-4 text-muted-foreground" />
          </div>
          <div className="text-xs text-red-500 bg-red-50 p-2 rounded border border-red-200">
            Unable to load liability data
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between pb-3">
        <CardTitle className="text-sm font-semibold">EOSB Liability</CardTitle>
        <ShieldCheck className="w-4 h-4 text-muted-foreground" />
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Summary Stats */}
        <div className="grid grid-cols-2 gap-3">
          <div className="p-3 rounded-xl bg-amber-50 border border-amber-100">
            <div className="flex items-center gap-1.5 mb-1">
              <Users className="w-3.5 h-3.5 text-amber-600" />
              <p className="text-[10px] font-semibold text-amber-700 uppercase tracking-wide">Employees</p>
            </div>
            <p className="text-xl font-black text-amber-700">{data?.count || 0}</p>
          </div>
          <div className="p-3 rounded-xl bg-blue-50 border border-blue-100">
            <div className="flex items-center gap-1.5 mb-1">
              <TrendingUp className="w-3.5 h-3.5 text-blue-600" />
              <p className="text-[10px] font-semibold text-blue-700 uppercase tracking-wide">Total Liability</p>
            </div>
            <p className="text-lg font-black text-blue-700 font-mono">
              {data?.total?.toFixed(0) || '0'}
            </p>
            <p className="text-[9px] text-blue-600">OMR</p>
          </div>
        </div>

        {/* High-liability alert */}
        {data && data.total > 50000 && (
          <div className="p-2.5 rounded-lg bg-amber-50 border border-amber-200 flex items-start gap-2">
            <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
            <p className="text-xs text-amber-800">
              Total EOSB liability exceeds 50,000 OMR. Consider provisioning for financial statements.
            </p>
          </div>
        )}

        {/* Top 3 highest liability */}
        <div className="pt-2 border-t">
          <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">
            Highest Liabilities
          </p>
          <div className="space-y-2">
            {(data?.employees || [])
              .sort((a: any, b: any) => (b.accrued_eosb || 0) - (a.accrued_eosb || 0))
              .slice(0, 3)
              .map((emp: any, idx: number) => (
                <div key={emp.employee_id} className="flex items-center justify-between text-xs">
                  <div className="flex items-center gap-2">
                    <span className="w-5 h-5 rounded-full bg-slate-100 flex items-center justify-center text-[10px] font-bold text-slate-600">
                      {idx + 1}
                    </span>
                    <span className="text-slate-700 truncate max-w-[120px]">{emp.employee_name}</span>
                  </div>
                  <span className="font-mono font-bold text-slate-900">
                    {emp.accrued_eosb?.toFixed(0) || 0} OMR
                  </span>
                </div>
              ))}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
