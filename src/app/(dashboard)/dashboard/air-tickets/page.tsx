'use client';

import { useState, useEffect } from 'react';
import { useAirTickets } from '@/hooks/queries/useAirTickets';
import { useAirTicketMutations } from '@/hooks/queries/useAirTicketMutations';
import { AirTicketBookingWizard } from '@/components/air-tickets/AirTicketBookingWizard';
import { AirTicketHistory } from '@/components/air-tickets/AirTicketHistory';
import { AirTicketBalanceCard } from '@/components/air-tickets/AirTicketBalanceCard';
import { AirTicketCurrentYear } from '@/components/air-tickets/AirTicketCurrentYear';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { format } from 'date-fns';
import { Plane, Plus, RefreshCw, User, Ticket, Trash2, AlertTriangle, Search, X } from 'lucide-react';
import { Combobox, ComboboxContent, ComboboxField, ComboboxInput, ComboboxItem, ComboboxTrigger, ComboboxValue } from '@/components/ui/combobox';
import { Label } from '@/components/ui/label';
import { useCompany } from '@/components/providers/CompanyProvider';
import { useEmployees } from '@/hooks/queries/useEmployees';
import { Skeleton } from '@/components/ui/skeleton';
import { createClient } from '@/lib/supabase/client';
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

type FilterStatus = 'all' | 'requested' | 'issued' | 'used' | 'cancelled';

interface UserProfile {
  role: string;
  employee_id: string | null;
  company_id: string | null;
}

export default function AirTicketsPage() {
  const { activeCompanyId } = useCompany();
  const { data: employees = [] } = useEmployees({ companyId: activeCompanyId });
  const { data: tickets = [], isLoading, refetch } = useAirTickets(undefined, activeCompanyId);
  const { issueTicket, markAsUsed, cancelTicket, deleteTicket } = useAirTicketMutations();

  const [filterStatus, setFilterStatus] = useState<FilterStatus>('all');
  const [showWizard, setShowWizard] = useState(false);
  const [wizardEmployeeId, setWizardEmployeeId] = useState<string>('');
  const [selectedTicket, setSelectedTicket] = useState<string>('');
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [profileLoading, setProfileLoading] = useState(true);
  const [selectedEmployeeId, setSelectedEmployeeId] = useState<string | null>(null);
  const [employeeSearchQuery, setEmployeeSearchQuery] = useState('');
  const [deleteTarget, setDeleteTarget] = useState<{ id: string; ticketNumber: string | null } | null>(null);
  useEffect(() => {
    const fetchProfile = async () => {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        const { data } = await supabase
          .from('profiles')
          .select('role, employee_id, company_id')
          .eq('id', user.id)
          .single();
        if (data) {
          setUserProfile(data);
        }
      }
      setProfileLoading(false);
    };
    fetchProfile();
  }, []);

  const currentUserEmployee = employees.find(e => e.id === userProfile?.employee_id);
  const allowedRoles = ['super_admin', 'company_admin', 'hr', 'finance'];
  const isHR = userProfile ? allowedRoles.includes(userProfile.role) : false;

  // Determine which employee to show details for
  const activeEmployeeId = isHR ? selectedEmployeeId : currentUserEmployee?.id || null;

  // Filtered tickets based on active employee selection and status filter
  const filteredTickets = tickets.filter(t => {
    if (activeEmployeeId && t.employee_id !== activeEmployeeId) {
      return false;
    }
    if (filterStatus === 'all') return true;
    return t.status === filterStatus;
  });

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'entitled':
        return <Badge variant="secondary" className="bg-blue-50 text-blue-700">Available</Badge>;
      case 'requested':
        return <Badge variant="secondary" className="bg-yellow-50 text-yellow-700">Pending Approval</Badge>;
      case 'issued':
        return <Badge variant="secondary" className="bg-purple-50 text-purple-600">Issued</Badge>;
      case 'used':
        return <Badge variant="secondary" className="bg-green-50 text-green-700">Used</Badge>;
      case 'cancelled':
        return <Badge variant="destructive">Cancelled</Badge>;
      default:
        return <Badge>{status}</Badge>;
    }
  };

  const openWizardForEmployee = (empId?: string) => {
    setWizardEmployeeId(empId || currentUserEmployee?.id || '');
    setShowWizard(true);
  };

  const handleWizardClose = () => {
    setShowWizard(false);
    setWizardEmployeeId('');
  };

  const selectedEmployee = employees.find(e => e.id === activeEmployeeId);

  if (profileLoading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">Air Ticket Management</h1>
            <p className="text-muted-foreground">Loading...</p>
          </div>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          {[1,2,3,4].map(i => <Skeleton key={i} className="h-24" />)}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Air Ticket Management</h1>
          <p className="text-muted-foreground">
            Track and manage employee air ticket entitlements and requests
          </p>
        </div>
        <div className="flex gap-2">
          {isHR && (
            <Button onClick={() => openWizardForEmployee()}>
              <Plus className="w-4 h-4 mr-2" />
              New Request (HR)
            </Button>
          )}
          {currentUserEmployee && (
            <Button variant="outline" onClick={() => openWizardForEmployee(currentUserEmployee.id)}>
              <Plane className="w-4 h-4 mr-2" />
              My Tickets
            </Button>
          )}
        </div>
      </div>

      {/* Employee Selector (HR only) */}
      {isHR && (
        <div className="max-w-md">
          <Combobox
            value={selectedEmployeeId || ''}
            onValueChange={(value) => setSelectedEmployeeId(value || null)}
            itemToStringLabel={(itemValue) => {
              const emp = employees.find(e => e.id === itemValue);
              return emp ? `${emp.name_en} (${emp.emp_code})` : '';
            }}
          >
            <ComboboxField className="relative">
              <div className="absolute left-3 top-1/2 -translate-y-1/2 z-10 pointer-events-none">
                <Search className="h-4 w-4 text-gray-400" />
              </div>
              <ComboboxInput
                id="employee-select"
                placeholder="Search employee..."
                className="pl-10"
                onChange={(e) => setEmployeeSearchQuery(e.target.value)}
              />
              <ComboboxTrigger hasValue={!!selectedEmployeeId} onClear={() => {
                setSelectedEmployeeId(null);
                setEmployeeSearchQuery('');
              }}>
              </ComboboxTrigger>
            </ComboboxField>
            <ComboboxContent>
              <div className="py-2">
                {employees
                  .filter(emp => {
                    const query = employeeSearchQuery || '';
                    if (!query.trim()) return true;
                    const search = query.toLowerCase();
                    return (
                      (emp.name_en || '').toLowerCase().includes(search) ||
                      (emp.emp_code || '').toLowerCase().includes(search)
                    );
                  })
                  .map(emp => (
                    <ComboboxItem key={emp.id} value={emp.id} className="flex items-center gap-3">
                      <div className="h-8 w-8 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-white text-xs font-medium">
                        {emp.name_en?.charAt(0) || '?'}
                      </div>
                      <div className="flex flex-col">
                        <span className="font-medium">{emp.name_en}</span>
                        <span className="text-xs text-gray-500">{emp.emp_code}</span>
                      </div>
                    </ComboboxItem>
                  ))
                }
                {employees.length === 0 && (
                  <div className="px-3 py-8 text-center text-gray-500">
                    <User className="h-8 w-8 mx-auto mb-2 text-gray-300" />
                    <p className="text-sm">No employees found</p>
                  </div>
                )}
              </div>
            </ComboboxContent>
          </Combobox>
        </div>
      )}

      {/* Balance Card - shows for selected employee or current user */}
      {(selectedEmployee || currentUserEmployee) && (
        <AirTicketBalanceCard
          employeeId={(selectedEmployee || currentUserEmployee)!.id}
          employeeName={(selectedEmployee || currentUserEmployee)!.name_en}
        />
      )}

      {/* Stats - filtered by active employee selection */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Total Records</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{filteredTickets.length}</p>
            {activeEmployeeId && <p className="text-xs text-muted-foreground">for selected employee</p>}
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Pending Approval</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold text-yellow-600">
              {filteredTickets.filter(t => t.status === 'requested').length}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Issued / Booked</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold text-purple-600">
              {filteredTickets.filter(t => t.status === 'issued').length}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Used</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold text-green-600">
              {filteredTickets.filter(t => t.status === 'used').length}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Tabs: Table View | History | Current Year */}
      <Tabs defaultValue="table" className="space-y-4">
        <TabsList>
          <TabsTrigger value="table">Ticket Records</TabsTrigger>
          <TabsTrigger value="history">History Ledger</TabsTrigger>
          <TabsTrigger value="current-year">Current Year</TabsTrigger>
        </TabsList>

        <TabsContent value="table">
          {/* Filters */}
          <div className="flex gap-2 mb-4">
            {(['all', 'requested', 'issued', 'used', 'cancelled'] as FilterStatus[]).map((status) => (
              <Button
                key={status}
                variant={filterStatus === status ? 'default' : 'outline'}
                size="sm"
                onClick={() => setFilterStatus(status)}
              >
                {status === 'all' ? 'All' : status.charAt(0).toUpperCase() + status.slice(1)}
              </Button>
            ))}
            <Button variant="ghost" size="sm" onClick={() => refetch()}>
              <RefreshCw className="w-4 h-4 mr-2" />
              Refresh
            </Button>
          </div>

          {/* Tickets Table */}
          <Card>
            <CardHeader>
              <CardTitle>Ticket Records</CardTitle>
              <CardDescription>
                {activeEmployeeId
                  ? `All air ticket records for ${selectedEmployee?.name_en || 'selected employee'}`
                  : 'All air ticket requests and their current status'}
              </CardDescription>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <p className="text-center text-muted-foreground py-8">Loading...</p>
              ) : filteredTickets.length === 0 ? (
                <p className="text-center text-muted-foreground py-8">No tickets found.</p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Employee</TableHead>
                      <TableHead>Purpose</TableHead>
                      <TableHead>Destination</TableHead>
                      <TableHead>Requested</TableHead>
                      <TableHead>Ticket #</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredTickets.map((ticket) => (
                      <TableRow key={ticket.id}>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <User className="w-4 h-4 text-muted-foreground" />
                            <div>
                              <p className="font-medium">{ticket.employee?.name_en || 'Unknown'}</p>
                              <p className="text-xs text-muted-foreground">{ticket.employee?.emp_code}</p>
                            </div>
                          </div>
                        </TableCell>
                        <TableCell className="capitalize">{ticket.purpose || '—'}</TableCell>
                        <TableCell>{ticket.destination || '—'}</TableCell>
                        <TableCell className="text-sm">
                          {ticket.created_at ? format(new Date(ticket.created_at), 'dd MMM yyyy') : '—'}
                        </TableCell>
                        <TableCell>
                          {ticket.ticket_number ? (
                            <code className="text-xs bg-slate-100 px-2 py-1 rounded">
                              {ticket.ticket_number}
                            </code>
                          ) : '—'}
                        </TableCell>
                        <TableCell>{getStatusBadge(ticket.status)}</TableCell>
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-1">
                            {ticket.status === 'requested' && (
                              <>
                                <Button
                                  size="sm"
                                  variant="default"
                                  onClick={() => issueTicket.mutate({ id: ticket.id, flightDetails: 'Issued' })}
                                >
                                  Issue
                                </Button>
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
                            {ticket.status === 'used' && isHR && (
                              <Button
                                size="sm"
                                variant="ghost"
                                className="text-red-600 hover:text-red-700 hover:bg-red-50"
                                onClick={() => setDeleteTarget({ id: ticket.id, ticketNumber: ticket.ticket_number || null })}
                              >
                                <Trash2 className="w-4 h-4" />
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
        </TabsContent>

        <TabsContent value="history">
          {activeEmployeeId ? (
            <AirTicketHistory
              employeeId={activeEmployeeId}
              employeeName={selectedEmployee?.name_en || currentUserEmployee?.name_en || ''}
            />
          ) : (
            <Card>
              <CardContent className="py-8 text-center text-muted-foreground">
                {isHR
                  ? 'Please select an employee to view their ticket history.'
                  : 'No employee profile linked to view history'}
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="current-year">
          {activeEmployeeId ? (
            <AirTicketCurrentYear
              employeeId={activeEmployeeId}
              employeeName={selectedEmployee?.name_en || currentUserEmployee?.name_en || ''}
            />
          ) : (
            <Card>
              <CardContent className="py-8 text-center text-muted-foreground">
                {isHR
                  ? 'Please select an employee to view their current year accrual.'
                  : 'No employee profile linked to view current year data'}
              </CardContent>
            </Card>
          )}
        </TabsContent>
      </Tabs>

      {/* Booking Wizard Modal */}
      {showWizard && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-3xl max-h-[90vh] overflow-y-auto">
            <div className="p-6">
              <AirTicketBookingWizard
                employeeId={wizardEmployeeId}
                onSuccess={() => {
                  setShowWizard(false);
                  refetch();
                }}
                onCancel={handleWizardClose}
              />
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={!!deleteTarget} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-red-600" />
              Delete Used Ticket?
            </AlertDialogTitle>
            <AlertDialogDescription className="space-y-2">
              <div>
                You are about to delete a <strong>used</strong> air ticket record.
                This action permanently removes the record from the system and cannot be undone.
              </div>
              {deleteTarget?.ticketNumber && (
                <div className="font-mono bg-slate-100 px-2 py-1 rounded inline-block">
                  Ticket: {deleteTarget.ticketNumber}
                </div>
              )}
              <div className="text-sm text-amber-600 bg-amber-50 p-2 rounded border border-amber-200">
                <strong>Warning:</strong> Deleting a used ticket will affect historical records and may impact audit trails.
                This should only be done for data correction purposes.
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (deleteTarget) {
                  deleteTicket.mutate(deleteTarget.id, {
                    onSuccess: () => setDeleteTarget(null),
                    onError: () => setDeleteTarget(null),
                  });
                }
              }}
              className="bg-red-600 hover:bg-red-700 text-white"
            >
              Yes, Delete Permanently
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
