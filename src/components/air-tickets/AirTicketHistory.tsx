'use client';

import { useMemo, useState } from 'react';
import { useAirTickets } from '@/hooks/queries/useAirTickets';
import { useAirTicketBalance } from '@/hooks/queries/useAirTicketBalance';
import { useAirTicketMutations } from '@/hooks/queries/useAirTicketMutations';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { format, parseISO } from 'date-fns';
import { Plane, TrendingUp, TrendingDown, AlertCircle, CheckCircle, XCircle, Clock, Calendar, Ticket, RefreshCw, Calculator, Trash2 } from 'lucide-react';
import { Employee } from '@/types';
import { calculateYearlyBreakdown } from '@/lib/calculations/air_ticket';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';

interface AirTicketHistoryProps {
  employeeId?: string;
  employeeName?: string;
}

type HistoryEntry = {
  id: string;
  date: string;
  type: 'opening' | 'accrual' | 'requested' | 'issued' | 'used' | 'cancelled';
  description: string;
  change: number;
  balanceAfter: number;
  ticketNumber?: string;
  ticketId?: string; // For delete action
  metadata?: Record<string, unknown>;
};

export function AirTicketHistory({ employeeId, employeeName }: AirTicketHistoryProps) {
  const { data: tickets = [], isLoading, error } = useAirTickets(employeeId);
  const { data: balance, isLoading: balanceLoading } = useAirTicketBalance(employeeId ?? undefined);
  const { deleteTicket } = useAirTicketMutations();

  // State for delete confirmation dialog
  const [deleteTarget, setDeleteTarget] = useState<{ id: string; ticketNumber: string | null } | null>(null);

  const history: HistoryEntry[] = useMemo(() => {
    if (isLoading || balanceLoading) return [];
    if (!employeeId) return [];

    const entries: HistoryEntry[] = [];
    let runningBalance = 0;

    // 1. Add opening balance entry if exists
    if (balance?.openingTickets && balance.openingTickets > 0) {
      runningBalance += balance.openingTickets;
      entries.push({
        id: 'opening-balance',
        date: balance.joinDate || new Date().toISOString(),
        type: 'opening',
        description: `Opening balance (migrated from previous system)`,
        change: balance.openingTickets,
        balanceAfter: runningBalance,
        metadata: { source: 'migration', joinDate: balance.joinDate },
      });
    }

    // 2. Generate yearly accrual entries from join date to current
    if (balance?.joinDate) {
      const yearlyData = calculateYearlyBreakdown(
        balance.joinDate,
        balance.airTicketCycle || 12,
        balance.openingTickets || 0,
        tickets
      );

      yearlyData.byYear.forEach((yearData) => {
        const yearStart = new Date(yearData.year, 0, 1);
        runningBalance += yearData.ticketsEarned || 0;
        entries.push({
          id: `accrual-${yearData.year}`,
          date: yearStart.toISOString(),
          type: 'accrual',
          description: `Accrued for year ${yearData.year} (${yearData.monthsInYear} months worked, ${(yearData.ticketsEarned || 0).toFixed(2)} tickets)`,
          change: yearData.ticketsEarned || 0,
          balanceAfter: runningBalance,
          metadata: { year: yearData.year, monthsWorked: yearData.monthsInYear, cycleMonths: balance.airTicketCycle },
        });
      });
    } else {
      entries.push({
        id: 'no-join-date',
        date: new Date().toISOString(),
        type: 'opening',
        description: 'Join date not configured — accruals cannot be calculated',
        change: 0,
        balanceAfter: runningBalance,
      });
    }

    // 3. Add ticket transactions
    const sortedTickets = [...tickets].sort((a, b) =>
      new Date(a.created_at || 0).getTime() - new Date(b.created_at || 0).getTime()
    );

    sortedTickets.forEach(ticket => {
      let type: HistoryEntry['type'] = 'requested';
      let change = 0;
      let description = '';
      const displayDate = ticket.issued_at || ticket.requested_at || ticket.created_at;

      switch (ticket.status) {
        case 'requested':
          type = 'requested';
          description = `Ticket requested — ${ticket.destination || 'travel request'}${ticket.purpose ? ` (${ticket.purpose.replace('_', ' ')})` : ''}`;
          break;
        case 'issued':
          type = 'issued';
          change = -1;
          description = `Ticket issued${ticket.ticket_number ? `: ${ticket.ticket_number}` : ''} — ${ticket.destination || 'N/A'}`;
          runningBalance += change;
          break;
        case 'used':
          type = 'used';
          description = `Travel completed — ${ticket.destination || 'N/A'}`;
          break;
        case 'cancelled':
          type = 'cancelled';
          if (ticket.ticket_number) {
            change = 1;
            description = `Ticket cancelled — balance restored: ${ticket.ticket_number}`;
            runningBalance += change;
          } else {
            description = `Request cancelled: ${ticket.rejection_reason || 'No reason provided'}`;
          }
          break;
        default:
          return;
      }

      entries.push({
        id: ticket.id,
        ticketId: ticket.id,
        date: displayDate,
        type,
        description,
        change,
        balanceAfter: runningBalance,
        ticketNumber: ticket.ticket_number,
        metadata: { purpose: ticket.purpose, destination: ticket.destination, status: ticket.status },
      });
    });

    entries.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    return entries;
  }, [tickets, balance, employeeId, isLoading, balanceLoading]);

  const getTypeIcon = (type: HistoryEntry['type']) => {
    switch (type) {
      case 'opening': return <RefreshCw className="w-4 h-4 text-slate-500" />;
      case 'accrual': return <Calculator className="w-4 h-4 text-blue-500" />;
      case 'requested': return <Clock className="w-4 h-4 text-yellow-500" />;
      case 'issued': return <CheckCircle className="w-4 h-4 text-purple-500" />;
      case 'used': return <Plane className="w-4 h-4 text-green-500" />;
      case 'cancelled': return <XCircle className="w-4 h-4 text-red-500" />;
      default: return <AlertCircle className="w-4 h-4 text-gray-500" />;
    }
  };

  const getTypeBadgeVariant = (type: HistoryEntry['type']) => {
    switch (type) {
      case 'opening': return 'secondary' as const;
      case 'accrual': return 'outline' as const;
      case 'requested': return 'secondary' as const;
      case 'issued': return 'default' as const;
      case 'used': return 'outline' as const;
      case 'cancelled': return 'destructive' as const;
      default: return 'secondary' as const;
    }
  };

  const getTypeLabel = (type: HistoryEntry['type']) => {
    switch (type) {
      case 'opening': return 'Opening';
      case 'accrual': return 'Accrual';
      case 'requested': return 'Requested';
      case 'issued': return 'Issued';
      case 'used': return 'Used';
      case 'cancelled': return 'Cancelled';
      default: return type;
    }
  };

  const handleDelete = (entry: HistoryEntry) => {
    if (entry.ticketId && entry.type === 'used') {
      setDeleteTarget({ id: entry.ticketId, ticketNumber: entry.ticketNumber || null });
    }
  };

  const confirmDelete = () => {
    if (deleteTarget) {
      deleteTicket.mutate(deleteTarget.id, {
        onSuccess: () => setDeleteTarget(null),
        onError: () => setDeleteTarget(null),
      });
    }
  };

  if (isLoading || balanceLoading) {
    return <Card><CardContent><p className="py-8 text-center">Loading history...</p></CardContent></Card>;
  }

  if (error) {
    return (
      <Card>
        <CardContent>
          <p className="py-8 text-center text-red-600">
            Error loading history: {(error as Error).message}
          </p>
        </CardContent>
      </Card>
    );
  }

  if (!balance?.joinDate) {
    return (
      <Card>
        <CardContent>
          <p className="py-8 text-center text-muted-foreground">
            Employee data incomplete. Please ensure join date and air ticket cycle are configured.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle>Air Ticket Ledger</CardTitle>
          <CardDescription>
            Complete history of air ticket accruals and transactions
          </CardDescription>
        </CardHeader>
        <CardContent>
          {history.length === 0 ? (
            <p className="text-center text-muted-foreground py-8">
              No ticket history yet. Tickets accrue based on tenure.
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Details</TableHead>
                  <TableHead>Ticket #</TableHead>
                  <TableHead className="text-right">Change</TableHead>
                  <TableHead className="text-right">Balance After</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {history.map((entry) => (
                  <TableRow key={entry.id}>
                    <TableCell className="text-sm">
                      {format(new Date(entry.date), 'dd MMM yyyy')}
                    </TableCell>
                    <TableCell>
                      <Badge variant={getTypeBadgeVariant(entry.type)} className="capitalize">
                        <span className="flex items-center gap-1">
                          {getTypeIcon(entry.type)}
                          {getTypeLabel(entry.type)}
                        </span>
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <span className="capitalize">{entry.description}</span>
                    </TableCell>
                    <TableCell className="font-mono text-sm">
                      {entry.ticketNumber ? (
                        <code className="bg-slate-100 px-2 py-1 rounded text-xs">
                          {entry.ticketNumber}
                        </code>
                      ) : '—'}
                    </TableCell>
                    <TableCell className={`text-right font-medium ${entry.change < 0 ? 'text-red-600' : entry.change > 0 ? 'text-green-600' : 'text-gray-500'}`}>
                      {entry.change !== 0 ? (entry.change > 0 ? '+' : '') + entry.change : '—'}
                    </TableCell>
                    <TableCell className="text-right font-mono font-medium">
                      {(entry.balanceAfter || 0).toFixed(2)}
                    </TableCell>
                    <TableCell className="text-right">
                      {entry.type === 'used' && entry.ticketId && (
                        <Button
                          size="sm"
                          variant="ghost"
                          className="text-red-600 hover:text-red-700 hover:bg-red-50"
                          onClick={() => handleDelete(entry)}
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={!!deleteTarget} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <XCircle className="w-5 h-5 text-red-600" />
              Delete Used Ticket?
            </AlertDialogTitle>
            <AlertDialogDescription>
              <div className="space-y-2">
                <p>
                  You are about to delete a <strong>used</strong> air ticket record.
                  This action permanently removes the record from the system and cannot be undone.
                </p>
                {deleteTarget?.ticketNumber && (
                  <p className="font-mono bg-slate-100 px-2 py-1 rounded inline-block">
                    Ticket: {deleteTarget.ticketNumber}
                  </p>
                )}
                <p className="text-sm text-amber-600 bg-amber-50 p-2 rounded border border-amber-200">
                  <strong>Warning:</strong> Deleting a used ticket will affect historical records and may impact audit trails.
                  This should only be done for data correction purposes.
                </p>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmDelete}
              className="bg-red-600 hover:bg-red-700 text-white"
            >
              Yes, Delete Permanently
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
