'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';
import {
  LayoutDashboard,
  Users,
  UserCircle,
  CalendarDays,
  Wallet,
  Plane,
  ClipboardCheck,
  Calculator,
  BarChart3,
  Settings,
  LogOut,
  ChevronLeft,
  Menu,
  UserPlus,
  Landmark,
  Database,
  Flower,
  Shield,
  Bug,
  Clock,
  FileSpreadsheet
} from 'lucide-react';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { useCompany } from '@/components/providers/CompanyProvider';

export function Sidebar({ collapsed, onToggle }: { collapsed: boolean; onToggle: () => void }) {
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);
  const { profile, activeCompany } = useCompany();
  const isSuperAdmin = profile?.role === 'super_admin';

  const navItems = [
    { label: 'Dashboard', href: '/dashboard', icon: LayoutDashboard },
    ...(isSuperAdmin ? [
      { label: 'Companies', href: '/dashboard/companies', icon: Flower },
      { label: 'Users', href: '/dashboard/users', icon: Users },
    ] : []),
    { label: 'Employees', href: '/dashboard/employees', icon: UserCircle },
    { label: 'Onboarding', href: '/dashboard/onboarding', icon: UserPlus },
    { label: 'Contract Renewals', href: '/dashboard/contract-renewal', icon: ClipboardCheck },
    { type: 'separator' as const, label: 'HR Operations' },
    { label: 'Leave Management', href: '/dashboard/leaves', icon: CalendarDays },
    { label: 'Loan Management', href: '/dashboard/loans', icon: Wallet },
    { label: 'Air Tickets', href: '/dashboard/air-tickets', icon: Plane },
    { label: 'Attendance', href: '/dashboard/attendance', icon: ClipboardCheck },
    { label: 'Timesheets', href: '/dashboard/timesheets', icon: Clock },
    { type: 'separator' as const, label: 'Payroll & Finance' },
    { label: 'Payroll', href: '/dashboard/payroll', icon: Calculator },
    { label: 'Salary Payouts', href: '/dashboard/payroll/payouts', icon: Landmark },
    { type: 'separator' as const, label: 'Analytics' },
    { label: 'Reports', href: '/dashboard/reports', icon: BarChart3 },
    { label: 'Timesheet Reports', href: '/dashboard/timesheets/reports', icon: FileSpreadsheet },
    ...(isSuperAdmin ? [
      { type: 'separator' as const, label: 'Audit & Compliance' },
      { label: 'Audit Logs', href: '/dashboard/audit-logs', icon: Shield },
      { label: 'Exceptions', href: '/dashboard/audit-exceptions', icon: Bug },
    ] : []),
    { type: 'separator' as const, label: 'System' },
    { label: 'Settings', href: '/dashboard/settings', icon: Settings },
    { label: 'About', href: '/dashboard/about', icon: Database },
  ];

  return (
    <>
      {/* Mobile toggle */}
      <Button
        variant="ghost"
        size="icon"
        className="fixed top-3 left-3 z-50 lg:hidden"
        onClick={() => setMobileOpen(!mobileOpen)}
      >
        <Menu className="w-5 h-5" />
      </Button>

      {/* Mobile overlay */}
      {mobileOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-40 lg:hidden"
          onClick={() => setMobileOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside
        className={cn(
          'fixed top-0 left-0 z-40 h-screen bg-sidebar text-sidebar-foreground border-r border-sidebar-border transition-all duration-300 flex flex-col',
          collapsed ? 'w-[68px]' : 'w-64',
          mobileOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'
        )}
      >
        {/* Logo / Company Identity */}
        <div className="flex items-center gap-3 px-4 h-16 border-b border-sidebar-border shrink-0">
          {activeCompany?.logo_url ? (
            <div className="flex items-center justify-center w-9 h-9 rounded-lg bg-background border border-sidebar-border shrink-0 overflow-hidden shadow-sm">
              <img src={activeCompany.logo_url} alt="Logo" className="w-full h-full object-contain p-1" />
            </div>
          ) : (
            <div className="flex items-center justify-center w-9 h-9 rounded-lg bg-sidebar-accent text-sidebar-accent-foreground shrink-0 shadow-sm">
              <Database className="w-5 h-5" />
            </div>
          )}
          {!collapsed && (
            <div className="animate-fade-in group truncate">
              <h1 className="font-bold text-xs leading-tight text-sidebar-foreground truncate uppercase tracking-wider">
                HR &amp; Payroll System
              </h1>
            </div>
          )}
        </div>

        {/* Navigation */}
        <ScrollArea className="flex-1 min-h-0">
          <nav className="space-y-0.5 px-2 py-3">
            {navItems.map((item, i) => {
              if ('type' in item && item.type === 'separator') {
                return (
                  <div key={i} className="pt-4 pb-1 px-2">
                    {!collapsed && (
                      <p className="text-[10px] font-semibold uppercase tracking-wider text-sidebar-foreground/40 truncate">
                        {item.label}
                      </p>
                    )}
                    {collapsed && <Separator className="bg-sidebar-border" />}
                  </div>
                );
              }

              if (!('href' in item)) return null;
              const Icon = item.icon;
              const isActive = pathname === item.href ||
                (item.href !== '/dashboard' && pathname.startsWith(item.href));

              return (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={() => setMobileOpen(false)}
                  className={cn(
                    'flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-200 group',
                    isActive
                      ? 'bg-sidebar-accent text-sidebar-accent-foreground shadow-sm'
                      : 'text-sidebar-foreground/70 hover:text-sidebar-foreground hover:bg-sidebar-accent/50'
                  )}
                >
                  <Icon className={cn('w-[18px] h-[18px] shrink-0', isActive && 'text-sidebar-primary')} />
                  {!collapsed && <span className="truncate">{item.label}</span>}
                  {isActive && !collapsed && (
                    <div className="ml-auto w-1.5 h-1.5 rounded-full bg-sidebar-primary" />
                  )}
                </Link>
              );
            })}
          </nav>
        </ScrollArea>

        {/* Footer */}
        <div className="border-t border-sidebar-border p-2 shrink-0 space-y-1">
          <button
            onClick={onToggle}
            className="hidden lg:flex items-center gap-3 w-full px-3 py-2 rounded-lg text-sm text-sidebar-foreground/60 hover:text-sidebar-foreground hover:bg-sidebar-accent/50 transition-colors"
          >
            <ChevronLeft className={cn('w-[18px] h-[18px] transition-transform', collapsed && 'rotate-180')} />
            {!collapsed && <span>Collapse</span>}
          </button>
          <Link
            href="/login"
            className="flex items-center gap-3 px-3 py-2 rounded-lg text-sm text-sidebar-foreground/60 hover:text-destructive hover:bg-destructive/10 transition-colors"
          >
            <LogOut className="w-[18px] h-[18px]" />
            {!collapsed && <span>Sign Out</span>}
          </Link>
        </div>
      </aside>
    </>
  );
}
