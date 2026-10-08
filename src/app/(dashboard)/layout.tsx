'use client';

import { Sidebar } from '@/components/layout/Sidebar';
import { Header } from '@/components/layout/Header';
import { useState, useEffect, useMemo } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { useCompany } from '@/components/providers/CompanyProvider';
import { ShieldAlert } from 'lucide-react';
import { buttonVariants } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import Link from 'next/link';

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const pathname = usePathname();
  const router = useRouter();
  const { profile, loading, hasPermission } = useCompany();

  const isSuperAdmin = profile?.role === 'super_admin';
  const isViewer = profile?.role === 'viewer';

  // Check if viewer or current role has permission to access the current pathname
  const accessDeniedInfo = useMemo(() => {
    if (loading || !profile) return null;
    if (isSuperAdmin) return null;

    if (isViewer) {
      // Allowed paths for viewer: timesheets and timesheet sub-routes only
      const isViewerAllowed = pathname.startsWith('/dashboard/timesheets');

      if (!isViewerAllowed) {
        return {
          title: 'Access Restricted',
          message: 'Your role (Viewer) has permission to access the Timesheets module only. Other modules are hidden.',
          redirectHref: '/dashboard/timesheets',
          redirectLabel: 'Go to Timesheets',
        };
      }
      return null;
    }

    // Role-based permissions for other roles
    if (
      (pathname.startsWith('/dashboard/employees') ||
       pathname.startsWith('/dashboard/onboarding') ||
       pathname.startsWith('/dashboard/contract-renewal')) &&
      !hasPermission('employees', 'read')
    ) {
      return {
        title: 'Access Restricted',
        message: 'You do not have permission to view the Employees module.',
        redirectHref: '/dashboard',
        redirectLabel: 'Go to Dashboard',
      };
    }

    if (
      (pathname.startsWith('/dashboard/leaves') ||
       pathname.startsWith('/dashboard/leave-requests') ||
       pathname.startsWith('/dashboard/air-tickets')) &&
      !hasPermission('leaves', 'read')
    ) {
      return {
        title: 'Access Restricted',
        message: 'You do not have permission to view the Leaves module.',
        redirectHref: '/dashboard',
        redirectLabel: 'Go to Dashboard',
      };
    }

    if (pathname.startsWith('/dashboard/loans') && !hasPermission('loans', 'read')) {
      return {
        title: 'Access Restricted',
        message: 'You do not have permission to view the Loans module.',
        redirectHref: '/dashboard',
        redirectLabel: 'Go to Dashboard',
      };
    }

    if (
      (pathname.startsWith('/dashboard/payroll') || pathname.startsWith('/dashboard/settlement')) &&
      !hasPermission('payroll', 'read')
    ) {
      return {
        title: 'Access Restricted',
        message: 'You do not have permission to view the Payroll module.',
        redirectHref: '/dashboard',
        redirectLabel: 'Go to Dashboard',
      };
    }

    if (
      pathname === '/dashboard/reports' &&
      !hasPermission('reports', 'read')
    ) {
      return {
        title: 'Access Restricted',
        message: 'You do not have permission to view the Reports module.',
        redirectHref: '/dashboard',
        redirectLabel: 'Go to Dashboard',
      };
    }

    if (
      (pathname.startsWith('/dashboard/companies') || pathname.startsWith('/dashboard/users')) &&
      !isSuperAdmin
    ) {
      return {
        title: 'Super Admin Access Required',
        message: 'Only Super Admins can access Companies and Users management.',
        redirectHref: '/dashboard',
        redirectLabel: 'Go to Dashboard',
      };
    }

    if (
      (pathname.startsWith('/dashboard/audit-logs') || pathname.startsWith('/dashboard/audit-exceptions')) &&
      !isSuperAdmin
    ) {
      return {
        title: 'Audit Access Restricted',
        message: 'Only Super Admins can access Audit Logs and Exceptions.',
        redirectHref: '/dashboard',
        redirectLabel: 'Go to Dashboard',
      };
    }

    if (pathname.startsWith('/dashboard/settings') && !hasPermission('settings', 'read')) {
      return {
        title: 'Settings Access Restricted',
        message: 'You do not have permission to view Settings.',
        redirectHref: '/dashboard',
        redirectLabel: 'Go to Dashboard',
      };
    }

    return null;
  }, [loading, profile, isSuperAdmin, isViewer, pathname, hasPermission]);

  // If a viewer visits root /dashboard or /dashboard/attendance, smoothly redirect to /dashboard/timesheets
  useEffect(() => {
    if (!loading && isViewer && (pathname === '/dashboard' || pathname.startsWith('/dashboard/attendance'))) {
      router.replace('/dashboard/timesheets');
    }
  }, [loading, isViewer, pathname, router]);

  return (
    <div className="min-h-screen bg-background">
      <Sidebar collapsed={sidebarCollapsed} onToggle={() => setSidebarCollapsed(!sidebarCollapsed)} />
      {/* Main content — offset by sidebar width */}
      <div className={
        sidebarCollapsed
          ? 'lg:pl-[68px] flex flex-col min-h-screen transition-all duration-300'
          : 'lg:pl-64 flex flex-col min-h-screen transition-all duration-300'
      }>
        <Header />
        <main className="flex-1 p-6">
          {accessDeniedInfo ? (
            <div className="flex flex-col items-center justify-center min-h-[50vh] text-center p-6 bg-card border rounded-2xl shadow-sm">
              <div className="w-16 h-16 bg-amber-100 dark:bg-amber-900/30 text-amber-600 rounded-2xl flex items-center justify-center mb-4 shadow-inner">
                <ShieldAlert className="w-8 h-8" />
              </div>
              <h2 className="text-2xl font-bold tracking-tight mb-2">{accessDeniedInfo.title}</h2>
              <p className="text-muted-foreground text-sm max-w-md mb-6">{accessDeniedInfo.message}</p>
              <Link
                href={accessDeniedInfo.redirectHref}
                className={cn(buttonVariants({ size: 'lg' }), 'rounded-xl shadow-md')}
              >
                {accessDeniedInfo.redirectLabel}
              </Link>
            </div>
          ) : (
            children
          )}
        </main>
      </div>
    </div>
  );
}
