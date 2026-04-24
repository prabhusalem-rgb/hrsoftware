'use client';

// ============================================================
// Dashboard Home — Stats overview with key metrics cards,
// recent payroll activity, and quick-action buttons.
// ============================================================

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Building2, Users, UserCircle, CalendarDays, Wallet,
  Calculator, TrendingUp, ArrowUpRight, Clock, FileSpreadsheet,
  ShieldAlert, AlertTriangle, Info,
  Loader2,
  UserPlus,
  Landmark,
  ShieldCheck,
  Plane
} from 'lucide-react';
import Link from 'next/link';
import { useCompany } from '@/components/providers/CompanyProvider';
import { useDashboardStats } from '@/hooks/queries/useDashboardStats';
import { useEmployeeMutations } from '@/hooks/queries/useEmployeeMutations';
import { PayoutSummaryWidget } from '@/components/dashboard/PayoutSummaryWidget';
import { OfferLetterWizard } from '@/components/hr/OfferLetterWizard';
import { useState } from 'react';
import { toast } from 'sonner';
import { Employee } from '@/types';
import { format } from 'date-fns';

export default function DashboardPage() {
  const { activeCompanyId } = useCompany();
  const { data: dashboardData, isLoading, error } = useDashboardStats(activeCompanyId);
  const { createEmployee } = useEmployeeMutations(activeCompanyId);
  const [offerWizardOpen, setOfferWizardOpen] = useState(false);

  console.log('[DashboardPage] render - activeCompanyId:', activeCompanyId, 'isLoading:', isLoading, 'error:', error);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  const result = dashboardData;

  const stats = [
    {
      label: 'Total Employees',
      value: result?.totalEmployees || 0,
      icon: UserCircle,
      href: '/dashboard/employees',
      color: 'text-emerald-600 bg-emerald-100 dark:bg-emerald-900/30 dark:text-emerald-400',
      change: null,
    },
    {
      label: 'Active Employees',
      value: result?.activeEmployees || 0,
      icon: Users,
      href: '/dashboard/employees',
      color: 'text-violet-600 bg-violet-100 dark:bg-violet-900/30 dark:text-violet-400',
      change: null,
    },
    {
      label: 'Pending Leaves',
      value: result?.pendingLeaves || 0,
      icon: CalendarDays,
      href: '/dashboard/leaves',
      color: 'text-amber-600 bg-amber-100 dark:bg-amber-900/30 dark:text-amber-400',
      change: (result?.pendingLeaves || 0) > 0 ? 'Needs review' : null,
    },
    {
      label: 'Active Loans',
      value: result?.activeLoans || 0,
      icon: Wallet,
      href: '/dashboard/loans',
      color: 'text-rose-600 bg-rose-100 dark:bg-rose-900/30 dark:text-rose-400',
      change: null,
    },
    {
      label: 'Air Ticket Requests',
      value: result?.pendingAirTickets || 0,
      icon: Plane,
      href: '/dashboard/air-tickets',
      color: 'text-blue-600 bg-blue-100 dark:bg-blue-900/30 dark:text-blue-400',
      change: (result?.pendingAirTickets || 0) > 0 ? 'Pending approval' : null,
    },
    {
      label: 'Payroll This Month',
      value: `${(result?.totalPayrollThisMonth || 0).toFixed(3)} OMR`,
      icon: Calculator,
      href: '/dashboard/payroll',
      color: 'text-cyan-600 bg-cyan-100 dark:bg-cyan-900/30 dark:text-cyan-400',
      change: null,
    },
  ];


  return (
    <div className="space-y-8 animate-fade-in">
      {/* Welcome */}
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Welcome back, Admin</h1>
        <p className="text-muted-foreground mt-1">
          Here&apos;s an overview of your HR &amp; Payroll system.
        </p>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {stats.map((stat, i) => {
          const Icon = stat.icon;
          return (
            <Link key={stat.label} href={stat.href}>
              <Card className="group hover:shadow-lg hover:shadow-black/5 transition-all duration-300 hover:-translate-y-0.5 cursor-pointer border-0 shadow-sm">
                <CardContent className="p-5">
                  <div className="flex items-start justify-between">
                    <div>
                      <p className="text-sm font-medium text-muted-foreground">{stat.label}</p>
                      <p className="text-2xl font-bold mt-1 tracking-tight">{stat.value}</p>
                      {stat.change && (
                        <p className="text-xs text-muted-foreground mt-1 flex items-center gap-1">
                          <TrendingUp className="w-3 h-3" />
                          {stat.change}
                        </p>
                      )}
                    </div>
                    <div className={`p-2.5 rounded-xl ${stat.color} transition-transform group-hover:scale-110`}>
                      <Icon className="w-5 h-5" />
                    </div>
                  </div>
                </CardContent>
              </Card>
            </Link>
          );
        })}
      </div>

      {/* Payout Summary Widget */}
      <div className="grid grid-cols-1 gap-6">
        <PayoutSummaryWidget />
      </div>

      {/* Quick Actions + Recent Activity */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Quick Actions */}
        <Card className="border-0 shadow-sm">
          <CardHeader>
            <CardTitle className="text-base">Quick Actions</CardTitle>
          </CardHeader>
          <CardContent className="grid grid-cols-2 gap-3">
            <Link href="/dashboard/employees" className="flex flex-col items-center gap-2 h-auto py-4 border rounded-md hover:bg-accent transition-colors">
              <UserCircle className="w-5 h-5 text-primary" />
              <span className="text-xs font-medium">Add Employee</span>
            </Link>
            <Link href="/dashboard/payroll" className="flex flex-col items-center gap-2 h-auto py-4 border rounded-md hover:bg-accent transition-colors">
              <Calculator className="w-5 h-5 text-primary" />
              <span className="text-xs font-medium">Run Payroll</span>
            </Link>
            <Link href="/dashboard/leaves" className="flex flex-col items-center gap-2 h-auto py-4 border rounded-md hover:bg-accent transition-colors">
              <CalendarDays className="w-5 h-5 text-primary" />
              <span className="text-xs font-medium">Manage Leaves</span>
            </Link>
            <Link href="/dashboard/air-tickets" className="flex flex-col items-center gap-2 h-auto py-4 border rounded-md hover:bg-accent transition-colors">
              <Plane className="w-5 h-5 text-primary" />
              <span className="text-xs font-medium">Air Tickets</span>
            </Link>
            <button onClick={() => setOfferWizardOpen(true)} className="flex flex-col items-center gap-2 h-auto py-4 border rounded-md hover:bg-accent transition-colors w-full">
              <FileSpreadsheet className="w-5 h-5 text-indigo-600" />
              <span className="text-xs font-medium text-indigo-600 font-black">Offer Architect</span>
            </button>
            <Link href="/dashboard/onboarding" className="flex flex-col items-center gap-2 h-auto py-4 border rounded-md hover:bg-accent transition-colors w-full bg-slate-50 border-slate-200">
              <UserPlus className="w-5 h-5 text-primary" />
              <span className="text-xs font-black text-primary">Onboarding Board</span>
            </Link>
          </CardContent>
        </Card>
        
        <OfferLetterWizard
          isOpen={offerWizardOpen}
          onClose={() => setOfferWizardOpen(false)}
          onCreate={createEmployee.mutateAsync}
        />

        {/* Recent Payroll Runs */}
        <Card className="border-0 shadow-sm">
          <CardHeader>
            <CardTitle className="text-base text-emerald-950 dark:text-emerald-50 font-black">Recent Payroll Records</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {result?.recentPayrollRuns.map((run) => (
              <div
                key={run.id}
                className="flex items-center justify-between p-3 rounded-2xl bg-slate-50 dark:bg-slate-900/50 hover:bg-slate-100 dark:hover:bg-slate-900 transition-colors border border-slate-100 dark:border-slate-800"
              >
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-xl bg-primary/10">
                    <Calculator className="w-4 h-4 text-primary" />
                  </div>
                  <div>
                    <p className="text-xs font-black text-slate-900 dark:text-slate-100 uppercase tracking-tight">
                      {run.type === 'monthly' ? 'Standard Monthly' : run.type}
                    </p>
                    <p className="text-[10px] text-slate-500 font-bold">
                      {format(new Date(run.year, run.month - 1), 'MMMM yyyy')} • {run.total_employees} Personnel
                    </p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-sm font-black font-mono">{Number(run.total_amount).toFixed(3)} OMR</p>
                  <Badge
                    variant={run.status === 'exported' ? 'default' : 'secondary'}
                    className="text-[8px] mt-1 font-black uppercase tracking-widest px-2"
                  >
                    {run.status}
                  </Badge>
                </div>
              </div>
            ))}
            {(!result?.recentPayrollRuns || result.recentPayrollRuns.length === 0) && (
              <p className="text-sm text-muted-foreground text-center py-6 italic font-medium">
                Initial system synchronization pending...
              </p>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Compliance Radar — Critical Task 4 */}
      <div className="grid grid-cols-1 gap-6">
        <Card className="border-0 shadow-sm overflow-hidden bg-slate-950 text-white rounded-[2rem]">
          <div className="bg-gradient-to-r from-red-600/20 to-amber-600/20 p-6 flex items-center justify-between border-b border-white/5">
            <div>
              <CardTitle className="text-lg font-black flex items-center gap-2 uppercase tracking-widest italic">
                <ShieldAlert className="w-5 h-5 text-red-500" />
                Compliance Radar
              </CardTitle>
              <p className="text-[10px] text-white/50 font-bold uppercase tracking-tight mt-1">Expatriate Document Risk Assessment</p>
            </div>
            <Badge className="bg-red-500 text-white font-black px-4 py-1.5 rounded-full text-[9px] uppercase tracking-widest shadow-xl shadow-red-500/20 animate-pulse">
              {result?.expiringDocs.filter(d => d.days_left <= 15).length} Critical
            </Badge>
          </div>
          <CardContent className="p-8">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {result?.expiringDocs.length === 0 ? (
                <div className="col-span-full py-12 text-center space-y-3">
                   <div className="h-12 w-12 rounded-full bg-emerald-500/10 flex items-center justify-center mx-auto">
                      <TrendingUp className="w-6 h-6 text-emerald-500" />
                   </div>
                   <p className="text-sm font-black text-white/40 uppercase tracking-widest">All Document Metadata Secured</p>
                </div>
              ) : (
                result?.expiringDocs.map((doc, idx) => (
                  <div key={idx} className="group p-5 rounded-[1.5rem] bg-white/5 hover:bg-white/10 border border-white/5 transition-all relative overflow-hidden">
                    <div className={`absolute top-0 right-0 h-1 rounded-bl-lg w-20 ${doc.days_left <= 15 ? 'bg-red-500' : 'bg-amber-500'}`} />
                    <div className="flex items-center gap-4 mb-4">
                      <div className={`h-11 w-11 rounded-xl flex items-center justify-center shrink-0 ${doc.days_left <= 15 ? 'bg-red-500/10 text-red-500' : 'bg-amber-500/10 text-amber-500'}`}>
                        {doc.days_left <= 15 ? <ShieldAlert className="w-6 h-6 outline-none" /> : <AlertTriangle className="w-6 h-6" />}
                      </div>
                      <div>
                        <h4 className="font-black text-sm tracking-tight group-hover:text-primary transition-colors">{doc.employee_name}</h4>
                        <p className="text-[10px] font-black text-white/40 uppercase tracking-widest">{doc.doc_type} Expiration</p>
                      </div>
                    </div>
                    
                    <div className="flex items-end justify-between mt-auto">
                      <div>
                        <p className="text-[9px] font-black text-white/30 uppercase mb-1">Expiry Date</p>
                        <p className="text-xs font-mono font-bold">{doc.expiry_date}</p>
                      </div>
                      <div className="text-right">
                        <p className="text-[9px] font-black text-white/30 uppercase mb-1">Time Left</p>
                        <p className={`text-sm font-black italic ${doc.days_left <= 15 ? 'text-red-400' : 'text-amber-400'}`}>{doc.days_left} Days</p>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
