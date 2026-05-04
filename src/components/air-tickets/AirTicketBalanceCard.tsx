'use client';

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useAirTicketBalance } from '@/hooks/queries/useAirTicketBalance';
import { Ticket, TrendingDown, AlertCircle, Calendar, Clock } from 'lucide-react';
import { format, parseISO } from 'date-fns';
import { Skeleton } from '@/components/ui/skeleton';

interface AirTicketBalanceCardProps {
  employeeId: string;
  employeeName?: string;
  compact?: boolean; // Compact mode for embedding in other components
}

export function AirTicketBalanceCard({ employeeId, employeeName, compact = false }: AirTicketBalanceCardProps) {
  const { data: balance, isLoading, error } = useAirTicketBalance(employeeId);

  if (isLoading) {
    if (compact) {
      return <Skeleton className="h-12 w-32" />;
    }
    return (
      <Card>
        <CardContent className="pt-6">
          <div className="space-y-2">
            <Skeleton className="h-4 w-32" />
            <Skeleton className="h-8 w-24" />
          </div>
        </CardContent>
      </Card>
    );
  }

  if (error || !balance) {
    return (
      <Card className={compact ? '' : 'border-red-200'}>
        <CardContent className={compact ? 'py-2' : 'pt-6'}>
          <div className="flex items-center gap-2 text-red-600">
            <AlertCircle className="w-4 h-4" />
            <span className="text-sm">Unable to load balance</span>
          </div>
        </CardContent>
      </Card>
    );
  }

  // Format cycle display
  const cycleMonths = balance.airTicketCycle || 12;
  const cycleText = cycleMonths === 24 ? 'Every 24 months (2 years)' : 'Every 12 months (1 year)';
  const ticketsPerCycle = 2;

  if (compact) {
    return (
      <div className="flex items-center gap-3 p-2 bg-blue-50 rounded-lg">
        <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center">
          <Ticket className="w-4 h-4 text-blue-600" />
        </div>
        <div>
          <p className="text-xs text-muted-foreground">Air Ticket Balance</p>
          <p className="text-lg font-bold text-blue-600">{balance.available.toFixed(2)}</p>
        </div>
      </div>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Ticket className="w-5 h-5" />
              Air Ticket Entitlement
            </CardTitle>
            <CardDescription>
              Travel entitlement — non-monetary benefit
            </CardDescription>
          </div>
          <Badge variant="outline" className="bg-blue-50">
            Non-Monetary
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Balance Overview */}
        <div className="grid grid-cols-3 gap-4">
          <div className="space-y-1">
            <p className="text-sm text-muted-foreground">Accrued</p>
            <p className="text-2xl font-bold text-blue-600">{balance.accrued?.toFixed(2) || '0.00'}</p>
            <p className="text-xs text-muted-foreground">tickets earned</p>
          </div>
          <div className="space-y-1">
            <p className="text-sm text-muted-foreground">Issued / Used</p>
            <p className="text-2xl font-bold text-purple-600">-{(balance.issued || 0) + (balance.used || 0)}</p>
          </div>
          <div className="space-y-1">
            <p className="text-sm text-muted-foreground">Available</p>
            <p className="text-2xl font-bold text-green-600">{balance.available?.toFixed(2) || '0.00'}</p>
          </div>
        </div>

        {/* Entitlement Details */}
        <div className="space-y-4 pt-4 border-t">
          <h4 className="text-sm font-semibold">
            Entitlement Configuration
          </h4>

          <div className="grid grid-cols-2 gap-4 text-sm">
            <div className="flex items-start gap-2">
              <Calendar className="w-4 h-4 text-muted-foreground mt-0.5" />
              <div>
                <p className="text-muted-foreground">Join Date</p>
                <p className="font-medium">{balance.joinDate ? format(parseISO(balance.joinDate), 'dd MMM yyyy') : 'Not set'}</p>
              </div>
            </div>
            <div className="flex items-start gap-2">
              <Clock className="w-4 h-4 text-muted-foreground mt-0.5" />
              <div>
                <p className="text-muted-foreground">Eligibility Cycle</p>
                <p className="font-medium">{cycleText}</p>
                <p className="text-xs text-muted-foreground">({ticketsPerCycle} tickets per cycle)</p>
              </div>
            </div>
            <div className="flex items-start gap-2">
              <Ticket className="w-4 h-4 text-muted-foreground mt-0.5" />
              <div>
                <p className="text-muted-foreground">Opening Balance</p>
                <p className="font-medium">{balance.openingTickets ?? 0} tickets</p>
              </div>
            </div>
          </div>
        </div>

        {/* Tenure Info */}
        <div className="text-xs text-muted-foreground pt-2">
          <p>
            Air tickets accrue pro-rata based on tenure. Each eligibility cycle (12 or 24 months) earns 2 tickets.
            Used tickets are deducted from the available balance. Opening balance applies for migrated employees.
          </p>
        </div>
      </CardContent>
    </Card>
  );
}
