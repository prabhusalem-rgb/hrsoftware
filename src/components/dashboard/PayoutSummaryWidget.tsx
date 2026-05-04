'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { useQuery } from '@tanstack/react-query';
import { createClient } from '@/lib/supabase/client';
import {
  Landmark,
  Lock,
  Clock,
  CheckCircle,
  AlertCircle,
  ChevronRight,
  Loader2
} from 'lucide-react';
import { useCompany } from '@/components/providers/CompanyProvider';
import { format, parseISO, isAfter } from 'date-fns';
import Link from 'next/link';

export function PayoutSummaryWidget() {
  const { activeCompanyId } = useCompany();

  const { data: runs, isLoading } = useQuery({
    queryKey: ['dashboard_payout_summary', activeCompanyId],
    queryFn: async () => {
      if (!activeCompanyId) return null;

      const supabase = createClient();

      // Get last 3 completed payout runs
      const { data, error } = await supabase
        .from('payout_runs')
        .select(`
          *,
          payroll_run:payroll_runs(
            id,
            month,
            year,
            type
          ),
          items:payout_items(
            id,
            payout_status,
            paid_amount
          )
        `)
        .eq('company_id', activeCompanyId)
        .order('payout_date', { ascending: false })
        .limit(3);

      if (error) throw new Error(error.message || 'Failed to fetch payout summary');
      return data;
    },
    enabled: !!activeCompanyId
  });

  const summaryStats = runs?.reduce((acc: any, run: any) => {
    acc.totalPaid += (run.items || []).filter((i: any) => i.payout_status === 'paid')
      .reduce((s: number, i: any) => s + (i.paid_amount || 0), 0);
    acc.totalHeld += (run.items || []).filter((i: any) => i.payout_status === 'held').length;
    acc.totalRuns += 1;
    return acc;
  }, { totalPaid: 0, totalHeld: 0, totalRuns: 0 });

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'paid': return 'text-emerald-600 bg-emerald-100';
      case 'held': return 'text-red-600 bg-red-100';
      case 'pending': return 'text-gray-600 bg-gray-100';
      case 'processing': return 'text-amber-600 bg-amber-100';
      case 'failed': return 'text-orange-600 bg-orange-100';
      default: return 'text-gray-600 bg-gray-100';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'paid': return CheckCircle;
      case 'held': return Lock;
      case 'pending': return Clock;
      case 'processing': return Loader2;
      case 'failed': return AlertCircle;
      default: return Clock;
    }
  };

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

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between pb-3">
        <CardTitle className="text-sm font-semibold">Payout Summary</CardTitle>
        <Landmark className="w-4 h-4 text-muted-foreground" />
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Stats */}
        <div className="grid grid-cols-3 gap-3">
          <div className="text-center">
            <p className="text-2xl font-black text-slate-900">{summaryStats?.totalRuns || 0}</p>
            <p className="text-xs text-slate-500 mt-0.5">Runs</p>
          </div>
          <div className="text-center">
            <p className="text-xl font-black text-emerald-600">
              {summaryStats?.totalPaid?.toFixed(0) || 0}
            </p>
            <p className="text-xs text-slate-500 mt-0.5">Paid</p>
          </div>
          <div className="text-center">
            <p className="text-xl font-black text-red-600">
              {summaryStats?.totalHeld || 0}
            </p>
            <p className="text-xs text-slate-500 mt-0.5">Held</p>
          </div>
        </div>

        {/* Recent Runs */}
        {runs && runs.length > 0 ? (
          <div className="space-y-2 pt-3 border-t">
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Recent Payout Runs</p>
            {runs.slice(0, 3).map((run: any) => {
              const paidCount = (run.items || []).filter((i: any) => i.payout_status === 'paid').length;
              const heldCount = (run.items || []).filter((i: any) => i.payout_status === 'held').length;
              const pendingCount = (run.items || []).filter((i: any) => i.payout_status === 'pending').length;
              const isOverdue = isAfter(new Date(), new Date(run.payout_date));

              return (
                <div
                  key={run.id}
                  className={`p-2.5 rounded-lg border transition-colors ${
                    isOverdue && run.status === 'scheduled' ? 'border-amber-200 bg-amber-50/50' : 'border-slate-100 bg-white'
                  }`}
                >
                  <div className="flex items-start justify-between mb-1.5">
                    <div>
                      <p className="text-sm font-semibold text-slate-900">
                        {run.payroll_run?.type?.split('_')[0] || 'Payroll'} —{' '}
                        {format(new Date(run.payroll_run?.year || 2026, (run.payroll_run?.month || 1) - 1), 'MMMM yyyy')}
                      </p>
                      <p className="text-xs text-slate-500">
                        Payout Due: {format(parseISO(run.payout_date), 'MMM dd, yyyy')}
                        {isOverdue && run.status === 'scheduled' && (
                          <span className="ml-1 text-amber-600 text-[10px] font-bold uppercase">(Overdue)</span>
                        )}
                      </p>
                    </div>
                    <Badge className={`text-[10px] px-1.5 py-0.5 ${getStatusColor(run.status)}`}>
                      {run.status}
                    </Badge>
                  </div>

                  <div className="flex items-center gap-3 text-xs">
                    <span className="flex items-center gap-1 text-emerald-600">
                      <CheckCircle className="w-3 h-3" /> {paidCount}
                    </span>
                    <span className="flex items-center gap-1 text-red-600">
                      <Lock className="w-3 h-3" /> {heldCount}
                    </span>
                    <span className="flex items-center gap-1 text-slate-500">
                      <Clock className="w-3 h-3" /> {pendingCount}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="text-center py-4 text-slate-400">
            <Landmark className="w-8 h-8 mx-auto mb-2 opacity-50" />
            <p className="text-xs">No payout runs yet</p>
          </div>
        )}

        {/* Quick Action */}
        <Link href="/dashboard/payroll/payouts" className="block">
          <Button variant="outline" size="sm" className="w-full gap-1 text-xs">
            Manage Payouts <ChevronRight className="w-3 h-3" />
          </Button>
        </Link>
      </CardContent>
    </Card>
  );
}
