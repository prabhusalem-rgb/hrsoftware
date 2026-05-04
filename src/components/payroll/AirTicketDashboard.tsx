// ============================================================
// Component: AirTicketDashboard
// Purpose: Employee air ticket management dashboard
// Shows accrued balance and ticket history/request flow
// ============================================================

'use client';

import { useState } from 'react';
import { useAirTickets } from '@/hooks/queries/useAirTickets';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { format } from 'date-fns';
import { Ticket, Plus, Calendar, Plane, CheckCircle, XCircle, Clock, AlertCircle } from 'lucide-react';
import { AirTicket } from '@/types';
import { useAirTicketMutations } from '@/hooks/queries/useAirTicketMutations';
import { toast } from 'sonner';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { calculateAirTicketBalance } from '@/lib/calculations/air_ticket';

interface AirTicketDashboardProps {
  employeeId: string;
  employeeName?: string;
  joinDate?: string;
  openingTickets?: number;
  ticketCycle?: number;
}

export function AirTicketDashboard({
  employeeId,
  employeeName = 'Employee',
  joinDate = '',
  openingTickets = 0,
  ticketCycle = 12,
}: AirTicketDashboardProps) {
  const { data: tickets = [], isLoading } = useAirTickets(employeeId);
  const { requestTicket, approveTicket, rejectTicket, issueTicket, markAsUsed, cancelTicket } = useAirTicketMutations();

  const [showRequestModal, setShowRequestModal] = useState(false);
  const [requestForm, setRequestForm] = useState<{
    purpose: string;
    destination: string;
    notes: string;
  }>({
    purpose: '',
    destination: '',
    notes: '',
  });

  // Calculate current accrued balance using the same logic as the balance hook
  const balance = calculateAirTicketBalance(
    joinDate || new Date().toISOString().split('T')[0],
    new Date().toISOString().split('T')[0],
    openingTickets,
    tickets,
    ticketCycle
  );
  const accruedBalance = balance.accrued;
  const usedCount = balance.used;
  const issuedCount = balance.issued;
  const availableBalance = balance.available;

  const handleRequestSubmit = async () => {
    if (!requestForm.purpose || !requestForm.destination) {
      toast.error('Purpose and destination are required');
      return;
    }

    try {
      await requestTicket.mutateAsync({
        employeeId,
        purpose: requestForm.purpose,
        destination: requestForm.destination,
        notes: requestForm.notes,
      });
      setShowRequestModal(false);
      setRequestForm({ purpose: '', destination: '', notes: '' });
    } catch (error) {
      // Error handled by mutation
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'entitled':
        return <Badge variant="secondary" className="bg-blue-50 text-blue-700">Available</Badge>;
      case 'requested':
        return <Badge variant="secondary" className="bg-yellow-50 text-yellow-700">Pending Approval</Badge>;
      case 'issued':
        return <Badge variant="secondary" className="bg-purple-50 text-purple-700">Issued</Badge>;
      case 'used':
        return <Badge variant="secondary" className="bg-green-50 text-green-700">Used</Badge>;
      case 'cancelled':
        return <Badge variant="destructive">Cancelled</Badge>;
      default:
        return <Badge>{status}</Badge>;
    }
  };

  return (
    <div className="space-y-6">
      {/* Balance Card */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Ticket className="w-5 h-5" />
            Air Ticket Entitlement
          </CardTitle>
          <CardDescription>
            Travel entitlement accrual — not a monetary benefit
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="space-y-1">
              <p className="text-sm text-muted-foreground">Accrued Balance</p>
              <p className="text-2xl font-bold text-blue-600">{accruedBalance.toFixed(2)}</p>
              <p className="text-xs text-muted-foreground">tickets earned</p>
            </div>
            <div className="space-y-1">
              <p className="text-sm text-muted-foreground">Used</p>
              <p className="text-2xl font-bold text-gray-600">{usedCount}</p>
            </div>
            <div className="space-y-1">
              <p className="text-sm text-muted-foreground">Issued (Booked)</p>
              <p className="text-2xl font-bold text-purple-600">{issuedCount}</p>
            </div>
            <div className="space-y-1">
              <p className="text-sm text-muted-foreground">Available to Request</p>
              <p className={`text-2xl font-bold ${availableBalance > 0 ? 'text-green-600' : 'text-red-600'}`}>
                {availableBalance.toFixed(2)}
              </p>
            </div>
          </div>

          {availableBalance > 0 && (
            <Button onClick={() => setShowRequestModal(true)} className="mt-4">
              <Plus className="w-4 h-4 mr-2" />
              Request Air Ticket
            </Button>
          )}
        </CardContent>
      </Card>

      {/* History Table */}
      <Card>
        <CardHeader>
          <CardTitle>Ticket History</CardTitle>
          <CardDescription>
            All air ticket records and their current status
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <p className="text-center text-muted-foreground py-8">Loading...</p>
          ) : tickets.length === 0 ? (
            <p className="text-center text-muted-foreground py-8">
              No air ticket records found.
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Purpose</TableHead>
                  <TableHead>Destination</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Flight Details</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {tickets.map((ticket) => (
                  <TableRow key={ticket.id}>
                    <TableCell className="text-sm">
                      {format(new Date(ticket.created_at), 'dd MMM yyyy')}
                    </TableCell>
                    <TableCell className="capitalize">{ticket.purpose || '—'}</TableCell>
                    <TableCell>{ticket.destination || '—'}</TableCell>
                    <TableCell>{getStatusBadge(ticket.status)}</TableCell>
                    <TableCell className="max-w-xs truncate text-sm text-muted-foreground">
                      {ticket.flight_details || '—'}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-1">
                        {ticket.status === 'requested' && (
                          <>
                            <Button
                              size="sm"
                              variant="default"
                              onClick={() => approveTicket.mutate({ id: ticket.id, notes: 'Approved' })}
                            >
                              Approve
                            </Button>
                            <Button
                              size="sm"
                              variant="destructive"
                              onClick={() => {
                                const reason = prompt('Enter rejection reason:');
                                if (reason) rejectTicket.mutate({ id: ticket.id, reason });
                              }}
                            >
                              Reject
                            </Button>
                          </>
                        )}
                        {ticket.status === 'issued' && (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => markAsUsed.mutate(ticket.id)}
                          >
                            Mark Used
                          </Button>
                        )}
                        {(ticket.status === 'requested' || ticket.status === 'issued') && (
                          <Button
                            size="sm"
                            variant="ghost"
                            className="text-red-600"
                            onClick={() => {
                              const reason = prompt('Enter cancellation reason:');
                              if (reason) cancelTicket.mutate({ id: ticket.id, reason });
                            }}
                          >
                            Cancel
                          </Button>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Request Modal */}
      <Dialog open={showRequestModal} onOpenChange={setShowRequestModal}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Request Air Ticket</DialogTitle>
            <DialogDescription>
              Submit a request for an air ticket entitlement. Available balance: {availableBalance.toFixed(2)} ticket(s)
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="purpose">Purpose of Travel *</Label>
              <Select value={requestForm.purpose} onValueChange={(v) => v && setRequestForm({ ...requestForm, purpose: v })}>
                <SelectTrigger>
                  <SelectValue placeholder="Select purpose" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="annual_leave">Annual Leave</SelectItem>
                  <SelectItem value="emergency">Emergency</SelectItem>
                  <SelectItem value="vacation">Vacation</SelectItem>
                  <SelectItem value="family_visit">Family Visit</SelectItem>
                  <SelectItem value="other">Other</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="destination">Destination *</Label>
              <Input
                id="destination"
                placeholder="e.g., Muscat, India, Philippines"
                value={requestForm.destination}
                onChange={(e) => setRequestForm({ ...requestForm, destination: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="notes">Additional Notes</Label>
              <Textarea
                id="notes"
                placeholder="Preferred travel dates, special requirements..."
                value={requestForm.notes}
                onChange={(e) => setRequestForm({ ...requestForm, notes: e.target.value })}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowRequestModal(false)}>Cancel</Button>
            <Button onClick={handleRequestSubmit}>Submit Request</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
