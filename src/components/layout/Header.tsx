'use client';

import { usePathname } from 'next/navigation';
import { useRouter } from 'next/navigation';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import Link from 'next/link';
import { LogOut, Settings } from 'lucide-react';
import { toast } from 'sonner';
import { useCompany } from '@/components/providers/CompanyProvider';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useState, useEffect } from 'react';

function getBreadcrumb(pathname: string): string {
  const segments = pathname.split('/').filter(Boolean);
  if (segments.length <= 1) return 'Dashboard';
  const last = segments[segments.length - 1];
  return last
    .split('-')
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ');
}

export function Header() {
  const pathname = usePathname();
  const router = useRouter();
  const title = getBreadcrumb(pathname);
  const { activeCompanyId, setActiveCompanyId, availableCompanies, profile, loading } = useCompany();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const getInitials = (name: string) => {
    if (!name) return '??';
    return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
  };

  // Show skeleton while loading profile
  const displayName = profile?.full_name || (loading ? 'Loading...' : 'User');
  const displayRole = profile?.role?.replace('_', ' ').replace(/\b\w/g, (l: string) => l.toUpperCase()) || (loading ? 'Loading...' : 'Staff');

  const handleSignOut = async () => {
    try {
      const response = await fetch('/api/auth/signout', {
        method: 'POST',
      });

      if (response.ok) {
        toast.success('Signed out successfully');
      }
      // Force redirect to login
      window.location.href = '/login';
    } catch (err) {
      console.error('Signout error:', err);
      window.location.href = '/login';
    }
  };

  return (
    <header className="sticky top-0 z-30 flex items-center gap-4 h-16 px-6 bg-background/80 backdrop-blur-xl border-b border-border">
      {/* Page title */}
      <div className="flex-1 pl-10 lg:pl-0 flex items-center gap-4">
        <h2 className="text-lg font-semibold tracking-tight">{title}</h2>
      </div>

      {/* Company Switcher */}
      <div className="hidden sm:block">
        <Select value={activeCompanyId} onValueChange={(v) => v && setActiveCompanyId(v)}>
          <SelectTrigger className="w-[200px] h-9 bg-muted/50 border-0 focus:ring-primary/20">
            <SelectValue placeholder="Select company">
              {availableCompanies.find(c => c.id.trim() === activeCompanyId?.trim())?.name_en || activeCompanyId || 'Select company'}
            </SelectValue>
          </SelectTrigger>
          <SelectContent align="end">
            {availableCompanies.map((c) => (
              <SelectItem key={c.id} value={c.id}>
                {c.name_en || c.id}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* User menu */}
      <DropdownMenu>
        <DropdownMenuTrigger>
          <div className="flex items-center gap-2 px-2 py-1.5 rounded-md hover:bg-accent transition-colors cursor-pointer">
            <Avatar className="w-8 h-8">
              <AvatarFallback className="bg-primary text-primary-foreground text-xs font-bold">
                {getInitials(displayName)}
              </AvatarFallback>
            </Avatar>
            <span className="hidden sm:inline text-sm font-medium">{displayName}</span>
          </div>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-48">
          <DropdownMenuGroup>
            <DropdownMenuLabel>{displayRole}</DropdownMenuLabel>
          </DropdownMenuGroup>
          <DropdownMenuSeparator />
          <DropdownMenuItem>
            <Link href="/dashboard/settings" className="w-full flex items-center gap-2">
              <Settings className="w-4 h-4" />
              Settings
            </Link>
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem className="text-destructive focus:text-destructive" onClick={handleSignOut}>
            <LogOut className="w-4 h-4 mr-2" />
            Sign Out
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </header>
  );
}
