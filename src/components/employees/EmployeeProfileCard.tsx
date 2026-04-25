'use client';

import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Calendar, User, Briefcase, Building, CreditCard, ArrowUpRight, Plane, Ticket } from 'lucide-react';
import { Employee, EmployeeStatus } from '@/types';
import { differenceInMonths, format } from 'date-fns';
import { AirTicketDashboard } from '@/components/payroll/AirTicketDashboard';
import { useState, memo } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';

// Format IBAN with spaces for readability: OMXXBMCTXXXXXXXXXX -> OMXX BMCT XXXXXXXX XXXX
const formatIban = (iban: string) => {
  if (!iban) return 'Not set';
  const cleaned = iban.replace(/\s/g, '');
  // Insert space every 4 characters for readability
  return cleaned.replace(/(.{4})/g, '$1 ').trim();
};

interface EmployeeProfileCardProps {
  employee: Employee;
  onEdit: () => void;
  onHistory: () => void;
  onJoiningReport: () => void;
  onRejoin?: () => void;
  currentLeaveBalance?: number;
}

const statusLabels: Record<EmployeeStatus, string> = {
  active: 'Active',
  on_leave: 'On Leave',
  leave_settled: 'Leave Settled',
  terminated: 'Terminated',
  final_settled: 'Final Settled',
  probation: 'Probation',
  offer_sent: 'Offer Sent',
};

const statusColors: Record<EmployeeStatus, string> = {
  active: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400',
  on_leave: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',
  leave_settled: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
  terminated: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
  final_settled: 'bg-gray-100 text-gray-700 dark:bg-gray-900/30 dark:text-gray-400',
  probation: 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400',
  offer_sent: 'bg-cyan-100 text-cyan-700 dark:bg-cyan-900/30 dark:text-cyan-400',
};

const categoryLabels: Record<string, string> = {
  OMANI_DIRECT_STAFF: 'Omani Direct Staff',
  OMANI_INDIRECT_STAFF: 'Omani In-Direct Staff',
  DIRECT_STAFF: 'Direct Staff',
  INDIRECT_STAFF: 'In-Direct Staff',
};

function EmployeeProfileCardImpl({
  employee,
  onEdit,
  onHistory,
  onJoiningReport,
  onRejoin,
  currentLeaveBalance,
}: EmployeeProfileCardProps) {
  const [showAirTickets, setShowAirTickets] = useState(false);

  const getInitials = (name: string) => {
    return name
      .split(' ')
      .map((n) => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
  };

  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return 'Not set';
    try {
      return format(new Date(dateStr), 'MMM dd, yyyy');
    } catch {
      return dateStr;
    }
  };

  return (
    <Card className="rounded-2xl border-slate-200 dark:border-slate-800 shadow-lg w-full">
      <CardContent className="p-6">
        <div className="flex flex-col lg:flex-row gap-6">
          {/* Left: Avatar + Basic Info */}
          <div className="flex items-start gap-4 lg:w-1/4">
            <Avatar className="w-16 h-16 rounded-2xl border-2 border-slate-200 dark:border-slate-700">
              <AvatarFallback className="bg-emerald-100 text-emerald-700 text-lg font-black">
                {getInitials(employee.name_en)}
              </AvatarFallback>
            </Avatar>
            <div className="space-y-2 flex-1">
              <h3 className="text-lg font-bold text-slate-900 dark:text-slate-100">
                {employee.name_en}
              </h3>
              <div className="flex flex-wrap items-center gap-2">
                <Badge variant="outline" className="font-mono text-xs font-black bg-white">
                  {employee.emp_code}
                </Badge>
                <Badge className={`${statusColors[employee.status]} border-0 text-xs font-black uppercase`}>
                  {statusLabels[employee.status]}
                </Badge>
                <Badge variant="outline" className="text-xs font-medium">
                  {categoryLabels[employee.category]}
                </Badge>
              </div>
              <div className="flex flex-wrap gap-4 text-sm text-slate-600 dark:text-slate-300">
                <div className="flex items-center gap-1.5">
                  <Building className="w-4 h-4 text-slate-400" />
                  <span>{employee.department || 'No department'}</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <Briefcase className="w-4 h-4 text-slate-400" />
                  <span>{employee.designation || 'No designation'}</span>
                </div>
              </div>
            </div>
          </div>

          {/* Middle: Details Grid */}
          <div className="flex-1 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-x-4 gap-y-3">
            <div className="space-y-1">
              <p className="text-xs font-black uppercase tracking-wider text-slate-400">Nationality</p>
              <p className="text-sm font-bold text-slate-900 dark:text-slate-100">{employee.nationality}</p>
            </div>
            <div className="space-y-1">
              <p className="text-xs font-black uppercase tracking-wider text-slate-400">Gender</p>
              <p className="text-sm font-bold text-slate-900 dark:text-slate-100 capitalize">{employee.gender || 'Not set'}</p>
            </div>
            <div className="space-y-1">
              <p className="text-xs font-black uppercase tracking-wider text-slate-400">Religion</p>
              <p className="text-sm font-bold text-slate-900 dark:text-slate-100 capitalize">{employee.religion || 'Not set'}</p>
            </div>
            <div className="space-y-1">
              <p className="text-xs font-black uppercase tracking-wider text-slate-400">Accommodation</p>
              <p className="text-sm font-bold text-slate-900 dark:text-slate-100 capitalize">
                {employee.family_status ? (employee.family_status === 'single' ? 'Single' : 'Family') : 'Not set'}
              </p>
            </div>
            <div className="space-y-1">
              <p className="text-xs font-black uppercase tracking-wider text-slate-400">Join Date</p>
              <div className="flex items-center gap-1.5">
                <Calendar className="w-3.5 h-3.5 text-slate-400" />
                <p className="text-sm font-bold text-slate-900 dark:text-slate-100">
                  {formatDate(employee.join_date)}
                </p>
              </div>
            </div>
            <div className="space-y-1">
              <p className="text-xs font-black uppercase tracking-wider text-slate-400">ID Type</p>
              <p className="text-sm font-bold text-slate-900 dark:text-slate-100 capitalize">
                {employee.id_type === 'civil_id' ? 'Civil ID' : 'Passport'}
              </p>
            </div>
            <div className="space-y-1">
              <p className="text-xs font-black uppercase tracking-wider text-slate-400">Identification</p>
              <p className="text-sm font-mono font-bold text-slate-900 dark:text-slate-100">
                {employee.id_type === 'civil_id' ? employee.civil_id : employee.passport_no || 'Not set'}
              </p>
            </div>
            <div className="space-y-1 col-span-2 md:col-span-1">
              <p className="text-xs font-black uppercase tracking-wider text-slate-400">Banking</p>
              <div className="flex flex-col gap-1">
                <div className="flex items-center gap-1.5">
                  <Building className="w-3.5 h-3.5 text-slate-400" />
                  <p className="text-sm font-bold text-slate-900 dark:text-slate-100">{employee.bank_name || 'Not specified'}</p>
                </div>
                <div className="flex items-center gap-1.5 pl-5">
                  <CreditCard className="w-3.5 h-3.5 text-slate-400" />
                  <p className="text-xs font-mono text-slate-600 dark:text-slate-400">
                    {employee.bank_iban ? formatIban(employee.bank_iban) : 'IBAN not set'}
                  </p>
                </div>
              </div>
            </div>
            <div className="space-y-1 col-span-2 md:col-span-1">
              <p className="text-xs font-black uppercase tracking-wider text-slate-400">Passport/Visa</p>
              <div className="flex flex-col gap-0.5">
                <p className="text-xs text-slate-500">Exp: {formatDate(employee.passport_expiry)}</p>
                <p className="text-xs text-slate-500">Visa: {employee.visa_no || 'Not set'}</p>
              </div>
            </div>
            {/* Leave Balance Section */}
            <div className="space-y-1">
              <p className="text-xs font-black uppercase tracking-wider text-slate-400">Leave Balance</p>
              {currentLeaveBalance !== undefined ? (
                <div className="flex flex-col gap-1">
                  <p className={`text-sm font-bold ${currentLeaveBalance > 0 ? 'text-emerald-600' : 'text-slate-400'}`}>
                    {currentLeaveBalance.toFixed(1)} days
                  </p>
                  {currentLeaveBalance === 0 && (
                    <p className="text-[9px] font-black text-amber-600 uppercase tracking-tighter italic leading-none">
                      {differenceInMonths(new Date(), new Date(employee.join_date)) < 6
                        ? '6-Month eligibility pending'
                        : 'No balance remaining'}
                    </p>
                  )}
                </div>
              ) : (
                <div className="flex flex-col gap-1">
                  <p className="text-sm font-bold text-emerald-600">
                    {employee.opening_leave_balance || 0} days
                  </p>
                  {(employee.opening_leave_balance || 0) === 0 && (
                    <p className="text-[9px] font-black text-amber-600 uppercase tracking-tighter italic leading-none">
                      {differenceInMonths(new Date(), new Date(employee.join_date)) < 6
                        ? '6-Month eligibility pending'
                        : 'No balance remaining'}
                    </p>
                  )}
                </div>
              )}
            </div>

            {/* Air Ticket Section */}
            <div className="space-y-1">
              <p className="text-xs font-black uppercase tracking-wider text-slate-400">Air Ticket Entitlement</p>
              <div className="flex items-center justify-between gap-2">
                <div className="flex flex-col">
                  <p className="text-sm font-bold text-blue-600 dark:text-blue-400">
                    {employee.opening_air_tickets || 0} base
                  </p>
                  <p className="text-[10px] text-slate-500">
                    Cycle: {employee.air_ticket_cycle || 24} months
                  </p>
                </div>
                <Button
                  size="sm"
                  variant="outline"
                  className="h-7 text-xs"
                  onClick={() => setShowAirTickets(true)}
                >
                  <Plane className="w-3 h-3 mr-1" />
                  Manage
                </Button>
              </div>
            </div>
          </div>

          {/* Right: Action Buttons */}
          <div className="flex flex-col items-center gap-1.5 w-full max-w-[80px] sm:max-w-[100px] lg:max-w-[130px] self-center shrink-0">
            <Button
              onClick={onEdit}
              className="gap-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded-2xl px-1.5 font-black h-9 shadow-lg shadow-emerald-600/20 w-full text-[9px] justify-center"
            >
              <User className="w-3.5 h-3.5 shrink-0" /> <span className="hidden sm:inline">Edit</span>
            </Button>
            <Button
              variant="outline"
              onClick={onHistory}
              className="gap-1 rounded-2xl px-1.5 font-black h-9 border-2 w-full text-[9px] justify-center"
            >
              <ArrowUpRight className="w-3.5 h-3.5 shrink-0" />
              <span className="hidden sm:inline">Compensation</span>
            </Button>
            <Button
              variant="outline"
              onClick={onJoiningReport}
              className="gap-1 rounded-2xl px-1.5 font-black h-9 border-2 w-full text-[9px] justify-center"
            >
              <Calendar className="w-3.5 h-3.5 shrink-0" /> <span className="hidden sm:inline">Joining</span>
            </Button>
            {employee.status === 'on_leave' || employee.status === 'leave_settled' ? (
              <Button
                variant="outline"
                onClick={onRejoin}
                className="gap-1 rounded-2xl px-1.5 font-black h-9 border-2 border-emerald-200 text-emerald-700 hover:bg-emerald-50 w-full text-[9px] justify-center"
              >
                <User className="w-3.5 h-3.5 shrink-0" /> <span className="hidden sm:inline">Rejoin</span>
              </Button>
            ) : null}
          </div>
        </div>
      </CardContent>

      {/* Air Ticket Management Dialog */}
      <Dialog open={showAirTickets} onOpenChange={setShowAirTickets}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Plane className="w-5 h-5" />
              Air Ticket Management — {employee.name_en}
            </DialogTitle>
            <DialogDescription>
              View accrued air ticket balance and manage ticket requests. This is a non-monetary travel entitlement.
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <AirTicketDashboard
              employeeId={employee.id}
              employeeName={employee.name_en}
              joinDate={employee.join_date}
              openingTickets={employee.opening_air_tickets || 0}
              ticketCycle={employee.air_ticket_cycle || 12}
            />
          </div>
        </DialogContent>
      </Dialog>
    </Card>
  );
}

const MemoizedEmployeeProfileCard = memo(EmployeeProfileCardImpl);
export { MemoizedEmployeeProfileCard as EmployeeProfileCard };
