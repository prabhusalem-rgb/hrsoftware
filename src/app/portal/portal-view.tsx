'use client';

import { useState, useTransition, useMemo } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { Progress } from '@/components/ui/progress';
import { Separator } from '@/components/ui/separator';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { FileUpload } from '@/components/ui/file-upload';
import { DatePickerInput } from '@/components/ui/date-picker-input';
import {
  CalendarDays,
  Clock,
  UserCheck,
  Plane,
  Stethoscope,
  LogOut,
  ChevronLeft,
  ChevronRight,
  Plus,
  CheckCircle2,
  AlertCircle,
  Clock4,
  XCircle,
  FileText,
  Building2,
  Calendar,
  Phone,
  Briefcase,
  IdCard,
  Layers,
  Info,
  ExternalLink,
  Loader2,
  ArrowRight,
  TrendingUp,
  LayoutDashboard,
  Filter,
  Check,
  Search
} from 'lucide-react';
import { portalLogout, submitPortalLeaveRequest, getEmployeePortalData } from './actions';
import { format, differenceInCalendarDays, parseISO } from 'date-fns';
import { toast } from 'sonner';
import Link from 'next/link';

interface PortalViewProps {
  initialData: any;
  companyId: string;
  employeeId: string;
  isStaff: boolean;
  staffRole?: string | null;
  staffName?: string | null;
  allCompanyEmployees?: Array<{ id: string; name_en: string; emp_code: string; designation?: string }>;
}

export function PortalView({
  initialData,
  companyId,
  employeeId: currentEmployeeId,
  isStaff,
  staffRole,
  staffName,
  allCompanyEmployees = [],
}: PortalViewProps) {
  const [data, setData] = useState(initialData);
  const [activeTab, setActiveTab] = useState<'attendance' | 'leaves' | 'apply'>('attendance');
  const [isPending, startTransition] = useTransition();

  // Selected Employee (for admin switching)
  const [selectedEmpId, setSelectedEmpId] = useState(currentEmployeeId);

  // Month navigation for Attendance
  const [selectedYear, setSelectedYear] = useState<number>(initialData.attendance.year);
  const [selectedMonth, setSelectedMonth] = useState<number>(initialData.attendance.month);

  // Attendance Day Detail Modal
  const [selectedDayDetail, setSelectedDayDetail] = useState<any | null>(null);
  const [attendanceFilter, setAttendanceFilter] = useState<'all' | 'present' | 'absent' | 'leave' | 'weekend' | 'overtime'>('all');

  // Leave Application Form State
  const [applyLeaveTypeId, setApplyLeaveTypeId] = useState<string>(
    initialData.annualLeaveType?.id || (initialData.leaveTypes.length > 0 ? initialData.leaveTypes[0].id : '')
  );
  const [applyStartDate, setApplyStartDate] = useState<string>('');
  const [applyEndDate, setApplyEndDate] = useState<string>('');
  const [isHalfDay, setIsHalfDay] = useState<boolean>(false);
  const [applyNotes, setApplyNotes] = useState<string>('');
  const [emergencyPhone, setEmergencyPhone] = useState<string>(initialData.employee?.emergency_contact_phone || '');
  const [attachmentUrl, setAttachmentUrl] = useState<string | null>(null);
  const [attachmentName, setAttachmentName] = useState<string | null>(null);
  const [submittingLeave, setSubmittingLeave] = useState<boolean>(false);

  const employee = data.employee;
  const annualBalance = data.annualBalance;
  const leaveRecords = data.leaveRecords || [];
  const attendance = data.attendance;
  const leaveTypes = data.leaveTypes || [];

  // Identify currently selected leave type for application
  const selectedLeaveTypeObj = useMemo(() => {
    return leaveTypes.find((lt: any) => lt.id === applyLeaveTypeId);
  }, [leaveTypes, applyLeaveTypeId]);

  const isApplyingAnnual = selectedLeaveTypeObj?.name?.toLowerCase().includes('annual');
  const isApplyingSick = selectedLeaveTypeObj?.name?.toLowerCase().includes('sick');

  // Calculate requested days
  const calculatedDays = useMemo(() => {
    if (!applyStartDate || !applyEndDate) return 0;
    if (isHalfDay) return 0.5;
    const s = new Date(applyStartDate);
    const e = new Date(applyEndDate);
    if (isNaN(s.getTime()) || isNaN(e.getTime()) || s > e) return 0;
    return differenceInCalendarDays(e, s) + 1;
  }, [applyStartDate, applyEndDate, isHalfDay]);

  // Overdraft validation for Annual Leave
  const annualMaxAllowed = (annualBalance?.balance || 0) + (annualBalance?.overdraftAllowed || 3.0);
  const isOverAnnualLimit = isApplyingAnnual && calculatedDays > annualMaxAllowed;

  // Refresh data for selected month/year or employee
  const refreshData = (empId = selectedEmpId, yr = selectedYear, mo = selectedMonth) => {
    startTransition(async () => {
      try {
        const res = await getEmployeePortalData(companyId, empId, yr, mo);
        if ('error' in res) {
          toast.error(res.error);
        } else {
          setData(res);
        }
      } catch (err: any) {
        toast.error('Failed to load updated portal data.');
      }
    });
  };

  // Month Navigation Handlers
  const handlePrevMonth = () => {
    let newMonth = selectedMonth - 1;
    let newYear = selectedYear;
    if (newMonth < 1) {
      newMonth = 12;
      newYear--;
    }
    setSelectedMonth(newMonth);
    setSelectedYear(newYear);
    refreshData(selectedEmpId, newYear, newMonth);
  };

  const handleNextMonth = () => {
    let newMonth = selectedMonth + 1;
    let newYear = selectedYear;
    if (newMonth > 12) {
      newMonth = 1;
      newYear++;
    }
    setSelectedMonth(newMonth);
    setSelectedYear(newYear);
    refreshData(selectedEmpId, newYear, newMonth);
  };

  const handleCurrentMonth = () => {
    const now = new Date();
    const yr = now.getFullYear();
    const mo = now.getMonth() + 1;
    setSelectedYear(yr);
    setSelectedMonth(mo);
    refreshData(selectedEmpId, yr, mo);
  };

  // Switch employee (for staff preview)
  const handleEmployeeSwitch = (newEmpId: string) => {
    setSelectedEmpId(newEmpId);
    refreshData(newEmpId, selectedYear, selectedMonth);
  };

  // Handle Logout
  const handleLogout = async () => {
    await portalLogout();
    toast.success('Signed out of Employee Portal');
    window.location.href = isStaff ? '/dashboard' : '/portal';
  };

  // Handle Leave Submission
  const handleSubmitLeave = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!applyStartDate || !applyEndDate) {
      toast.error('Please select both start date and end date');
      return;
    }

    if (calculatedDays <= 0) {
      toast.error('End date cannot be earlier than start date');
      return;
    }

    if (isOverAnnualLimit) {
      toast.error(
        `Cannot request ${calculatedDays} days. Maximum allowed for Annual Leave is ${annualMaxAllowed.toFixed(1)} days (${annualBalance.balance.toFixed(1)} balance + 3.0 overdraft).`
      );
      return;
    }

    setSubmittingLeave(true);
    try {
      const res = await submitPortalLeaveRequest({
        companyId,
        employeeId: selectedEmpId,
        leaveTypeId: applyLeaveTypeId,
        startDate: applyStartDate,
        endDate: applyEndDate,
        days: calculatedDays,
        notes: applyNotes,
        emergencyPhone,
        attachmentUrl,
        attachmentName,
      });

      if (res.error) {
        toast.error(res.error);
      } else {
        toast.success(res.message || 'Leave request submitted successfully!');
        // Reset form
        setApplyStartDate('');
        setApplyEndDate('');
        setIsHalfDay(false);
        setApplyNotes('');
        setAttachmentUrl(null);
        setAttachmentName(null);
        // Refresh data and switch to Leaves history tab
        refreshData();
        setActiveTab('leaves');
      }
    } catch (err: any) {
      toast.error(err.message || 'Failed to submit leave request');
    } finally {
      setSubmittingLeave(false);
    }
  };

  // Filter attendance days
  const filteredAttendanceDays = useMemo(() => {
    const days = attendance.days || [];
    if (attendanceFilter === 'all') return days;
    if (attendanceFilter === 'present') return days.filter((d: any) => d.status === 'present');
    if (attendanceFilter === 'absent') return days.filter((d: any) => d.status === 'absent');
    if (attendanceFilter === 'leave') return days.filter((d: any) => d.status === 'leave');
    if (attendanceFilter === 'weekend') return days.filter((d: any) => d.status === 'weekend');
    if (attendanceFilter === 'overtime') return days.filter((d: any) => d.overtimeHours > 0);
    return days;
  }, [attendance.days, attendanceFilter]);

  // Service length string
  const serviceDuration = useMemo(() => {
    if (!employee?.join_date) return '';
    const join = new Date(employee.join_date);
    const now = new Date();
    const months = (now.getFullYear() - join.getFullYear()) * 12 + (now.getMonth() - join.getMonth());
    if (months < 0) return 'Just joined';
    const yrs = Math.floor(months / 12);
    const remMonths = months % 12;
    if (yrs === 0) return `${remMonths} mos service`;
    return `${yrs} yr${yrs > 1 ? 's' : ''} ${remMonths} mo${remMonths !== 1 ? 's' : ''}`;
  }, [employee?.join_date]);

  // Balance progress percentage
  const balancePercentage = useMemo(() => {
    const total = (annualBalance?.entitled || 0) + (annualBalance?.carried_forward || 0);
    if (total <= 0) return 0;
    const remaining = Math.max(0, annualBalance?.balance || 0);
    return Math.min(100, Math.round((remaining / total) * 100));
  }, [annualBalance]);

  return (
    <div className="min-h-screen bg-[#F8FAFC] pb-16">
      {/* Top Navigation Bar */}
      <header className="sticky top-0 z-30 bg-white/95 backdrop-blur border-b border-slate-200/80 px-4 sm:px-6 lg:px-8 py-3.5 shadow-sm">
        <div className="max-w-7xl mx-auto flex flex-wrap items-center justify-between gap-3">
          {/* Company Branding */}
          <div className="flex items-center gap-3">
            {employee?.company?.logo_url ? (
              <img
                src={employee.company.logo_url}
                alt={employee.company.name_en}
                className="w-10 h-10 object-contain rounded-xl border border-slate-100 shadow-sm"
              />
            ) : (
              <div className="w-10 h-10 rounded-xl bg-indigo-600 text-white flex items-center justify-center font-bold shadow-md shadow-indigo-100">
                <Building2 className="w-5 h-5" />
              </div>
            )}
            <div>
              <div className="text-xs font-bold text-slate-400 uppercase tracking-widest leading-none">
                Employee Portal
              </div>
              <h2 className="text-base font-black text-slate-900 leading-tight">
                {employee?.company?.name_en || 'HR Software'}
              </h2>
            </div>
          </div>

          {/* Controls: Admin Preview Switcher & Actions */}
          <div className="flex items-center gap-2 sm:gap-3">
            {/* If Staff: Employee Selector for preview */}
            {isStaff && allCompanyEmployees.length > 0 && (
              <div className="flex items-center gap-2 bg-slate-100/80 rounded-xl p-1 px-2.5 border border-slate-200 text-xs">
                <span className="text-slate-500 font-bold hidden md:inline">Viewing As:</span>
                <Select value={selectedEmpId} onValueChange={(val) => { if (val) handleEmployeeSwitch(val); }}>
                  <SelectTrigger className="h-7 border-0 bg-transparent shadow-none font-bold text-slate-800 text-xs p-0 gap-1.5 focus:ring-0">
                    <SelectValue placeholder="Switch Employee..." />
                  </SelectTrigger>
                  <SelectContent className="max-h-72">
                    {allCompanyEmployees.map(emp => (
                      <SelectItem key={emp.id} value={emp.id} className="text-xs py-2">
                        {emp.name_en} ({emp.emp_code}) {emp.designation ? `• ${emp.designation}` : ''}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            {/* Back to Dashboard if staff user */}
            {isStaff && (
              <Link
                href="/dashboard"
                className="h-9 px-3 rounded-xl border border-slate-200 font-bold text-xs gap-1.5 inline-flex items-center text-slate-700 hover:bg-slate-50 transition-colors"
              >
                <LayoutDashboard className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Admin Dashboard</span>
              </Link>
            )}

            {/* Sign Out Button */}
            <Button
              variant="ghost"
              size="sm"
              onClick={handleLogout}
              className="h-9 rounded-xl text-slate-600 hover:text-rose-600 hover:bg-rose-50 font-bold text-xs gap-1.5"
            >
              <LogOut className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Exit Portal</span>
            </Button>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-6 space-y-6">
        {/* Loading Overlay */}
        {isPending && (
          <div className="fixed inset-0 bg-white/60 backdrop-blur-sm z-50 flex items-center justify-center">
            <div className="bg-white p-4 rounded-2xl shadow-xl flex items-center gap-3 border border-slate-200">
              <Loader2 className="w-6 h-6 animate-spin text-indigo-600" />
              <span className="text-sm font-bold text-slate-800">Updating employee records...</span>
            </div>
          </div>
        )}

        {/* 1. EMPLOYEE PROFILE HERO BANNER */}
        <div className="relative overflow-hidden rounded-[2rem] bg-gradient-to-br from-slate-900 via-indigo-950 to-blue-950 text-white shadow-xl shadow-slate-200/50 p-6 sm:p-8">
          {/* Subtle background circles */}
          <div className="absolute right-0 top-0 -mt-12 -mr-12 w-64 h-64 rounded-full bg-indigo-500/10 blur-2xl pointer-events-none" />
          <div className="absolute left-1/3 bottom-0 -mb-12 w-48 h-48 rounded-full bg-blue-500/10 blur-xl pointer-events-none" />

          <div className="relative flex flex-col md:flex-row md:items-center justify-between gap-6">
            <div className="flex items-start sm:items-center gap-4 sm:gap-5">
              {/* Avatar Initial Badge */}
              <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-2xl bg-gradient-to-tr from-blue-500 to-indigo-500 text-white flex items-center justify-center font-black text-2xl sm:text-3xl shadow-lg shadow-indigo-500/30 border border-white/20 flex-shrink-0">
                {employee?.name_en?.charAt(0) || 'E'}
              </div>

              <div className="space-y-1.5">
                <div className="flex flex-wrap items-center gap-2">
                  <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-white">
                    {employee?.name_en}
                  </h1>
                  {employee?.name_ar && (
                    <span className="text-slate-300 text-sm font-medium">
                      ({employee.name_ar})
                    </span>
                  )}
                  <Badge className="bg-emerald-500/20 text-emerald-300 border-emerald-500/30 uppercase text-[10px] font-bold tracking-wider px-2.5 py-0.5">
                    {employee?.status || 'Active'}
                  </Badge>
                </div>

                <div className="flex flex-wrap items-center gap-y-1 gap-x-4 text-xs sm:text-sm text-slate-300 font-medium">
                  <div className="flex items-center gap-1.5">
                    <IdCard className="w-3.5 h-3.5 text-indigo-400" />
                    <span className="text-white font-bold">Code: {employee?.emp_code}</span>
                  </div>
                  {employee?.designation && (
                    <div className="flex items-center gap-1.5">
                      <Briefcase className="w-3.5 h-3.5 text-blue-400" />
                      <span>{employee.designation}</span>
                    </div>
                  )}
                  {employee?.department && (
                    <div className="flex items-center gap-1.5">
                      <Layers className="w-3.5 h-3.5 text-indigo-400" />
                      <span>{employee.department}</span>
                    </div>
                  )}
                </div>

                <div className="flex flex-wrap items-center gap-x-4 text-xs text-slate-400 pt-0.5">
                  {employee?.civil_id && (
                    <span>Civil ID: <strong className="text-slate-200">{employee.civil_id}</strong></span>
                  )}
                  {employee?.join_date && (
                    <span>Joined: <strong className="text-slate-200">{format(new Date(employee.join_date), 'dd MMM yyyy')}</strong> ({serviceDuration})</span>
                  )}
                </div>
              </div>
            </div>

            {/* Quick Action: Apply For Leave Button */}
            <div className="flex-shrink-0 flex items-center gap-3">
              <Button
                onClick={() => setActiveTab('apply')}
                className="h-12 px-6 rounded-2xl bg-gradient-to-r from-blue-500 to-indigo-600 hover:from-blue-600 hover:to-indigo-700 text-white font-bold text-sm shadow-xl shadow-indigo-900/50 gap-2 transition-all transform active:scale-95"
              >
                <Plus className="w-4 h-4" />
                Apply for Leave
              </Button>
            </div>
          </div>
        </div>

        {/* 2. STATS & KPI METRIC CARDS */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Card 1: Annual Leave Balance */}
          <Card className="border-0 shadow-md shadow-slate-100 rounded-3xl bg-white overflow-hidden relative group hover:shadow-lg transition-all">
            <div className="h-1.5 w-full bg-blue-500" />
            <CardContent className="p-5 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold uppercase tracking-wider text-slate-400">
                  Annual Leave Balance
                </span>
                <div className="w-8 h-8 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center">
                  <CalendarDays className="w-4 h-4" />
                </div>
              </div>
              <div>
                <div className="text-3xl font-black text-slate-900 tracking-tight">
                  {Number(annualBalance?.balance || 0).toFixed(1)} <span className="text-sm font-bold text-slate-500">Days</span>
                </div>
                <p className="text-[11px] text-slate-400 font-medium mt-1">
                  {annualBalance?.entitled || 0} entitled • {annualBalance?.used || 0} availed
                </p>
              </div>
              <div className="space-y-1 pt-1">
                <Progress value={balancePercentage} className="h-2 bg-slate-100 rounded-full" />
                <div className="flex justify-between text-[10px] font-bold text-slate-400">
                  <span>{balancePercentage}% Remaining</span>
                  <span className="text-blue-600">+3.0d Overdraft</span>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Card 2: Availed Leave Days */}
          <Card className="border-0 shadow-md shadow-slate-100 rounded-3xl bg-white overflow-hidden relative group hover:shadow-lg transition-all">
            <div className="h-1.5 w-full bg-indigo-500" />
            <CardContent className="p-5 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold uppercase tracking-wider text-slate-400">
                  Total Availed Leaves
                </span>
                <div className="w-8 h-8 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center">
                  <Plane className="w-4 h-4" />
                </div>
              </div>
              <div>
                <div className="text-3xl font-black text-slate-900 tracking-tight">
                  {leaveRecords.filter((l: any) => l.status === 'approved').reduce((acc: number, curr: any) => acc + Number(curr.days || 0), 0).toFixed(1)}{' '}
                  <span className="text-sm font-bold text-slate-500">Days</span>
                </div>
                <p className="text-[11px] text-slate-400 font-medium mt-1">
                  Across {leaveRecords.filter((l: any) => l.status === 'approved').length} approved leave requests
                </p>
              </div>
              <div className="flex items-center gap-1.5 text-xs text-indigo-600 font-bold pt-2">
                <CheckCircle2 className="w-3.5 h-3.5" />
                <span>{leaveRecords.filter((l: any) => l.status === 'pending').length} Pending Approval</span>
              </div>
            </CardContent>
          </Card>

          {/* Card 3: Monthly Attendance */}
          <Card className="border-0 shadow-md shadow-slate-100 rounded-3xl bg-white overflow-hidden relative group hover:shadow-lg transition-all">
            <div className="h-1.5 w-full bg-emerald-500" />
            <CardContent className="p-5 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold uppercase tracking-wider text-slate-400">
                  Monthly Attendance
                </span>
                <div className="w-8 h-8 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
                  <UserCheck className="w-4 h-4" />
                </div>
              </div>
              <div>
                <div className="text-3xl font-black text-emerald-600 tracking-tight">
                  {attendance.presentCount} <span className="text-sm font-bold text-slate-500">/ {attendance.totalDays} Days</span>
                </div>
                <p className="text-[11px] text-slate-400 font-medium mt-1">
                  {format(new Date(selectedYear, selectedMonth - 1, 1), 'MMMM yyyy')} attendance rate
                </p>
              </div>
              <div className="flex items-center gap-3 text-xs pt-1 font-bold">
                <span className="text-rose-500">{attendance.absentCount} Absent</span>
                <span className="text-slate-300">•</span>
                <span className="text-blue-600">{attendance.leaveCount} On Leave</span>
              </div>
            </CardContent>
          </Card>

          {/* Card 4: Overtime Hours */}
          <Card className="border-0 shadow-md shadow-slate-100 rounded-3xl bg-white overflow-hidden relative group hover:shadow-lg transition-all">
            <div className="h-1.5 w-full bg-purple-500" />
            <CardContent className="p-5 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold uppercase tracking-wider text-slate-400">
                  Overtime (OT) Hours
                </span>
                <div className="w-8 h-8 rounded-xl bg-purple-50 text-purple-600 flex items-center justify-center">
                  <Clock className="w-4 h-4" />
                </div>
              </div>
              <div>
                <div className="text-3xl font-black text-purple-600 tracking-tight">
                  {Number(attendance.totalOtHours || 0).toFixed(1)} <span className="text-sm font-bold text-slate-500">Hours</span>
                </div>
                <p className="text-[11px] text-slate-400 font-medium mt-1">
                  Earned in {format(new Date(selectedYear, selectedMonth - 1, 1), 'MMMM yyyy')}
                </p>
              </div>
              <div className="flex items-center gap-1.5 text-xs text-purple-600 font-bold pt-2">
                <TrendingUp className="w-3.5 h-3.5" />
                <span>Recorded &amp; ready for payroll</span>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* 3. NAVIGATION TABS */}
        <div className="flex items-center gap-2 p-1.5 bg-slate-200/70 rounded-2xl max-w-md">
          <button
            onClick={() => setActiveTab('attendance')}
            className={`flex-1 flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl text-xs sm:text-sm font-bold transition-all ${
              activeTab === 'attendance'
                ? 'bg-white text-slate-900 shadow-sm shadow-slate-300'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Clock className="w-4 h-4" />
            Daily Attendance
          </button>
          <button
            onClick={() => setActiveTab('leaves')}
            className={`flex-1 flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl text-xs sm:text-sm font-bold transition-all ${
              activeTab === 'leaves'
                ? 'bg-white text-slate-900 shadow-sm shadow-slate-300'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <CalendarDays className="w-4 h-4" />
            Leave Details
          </button>
          <button
            onClick={() => setActiveTab('apply')}
            className={`flex-1 flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl text-xs sm:text-sm font-bold transition-all ${
              activeTab === 'apply'
                ? 'bg-white text-slate-900 shadow-sm shadow-slate-300'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Plus className="w-4 h-4 text-indigo-600" />
            Apply Leave
          </button>
        </div>

        {/* ========================================================================= */}
        {/* TAB 1: DAILY ATTENDANCE                                                  */}
        {/* ========================================================================= */}
        {activeTab === 'attendance' && (
          <div className="space-y-6 animate-in fade-in-50 duration-200">
            {/* Attendance Month Controller Card */}
            <Card className="border-0 shadow-md shadow-slate-100 rounded-3xl bg-white overflow-hidden">
              <CardContent className="p-6">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div>
                    <h3 className="text-xl font-bold text-slate-900 flex items-center gap-2">
                      <Clock className="w-5 h-5 text-indigo-600" />
                      Attendance Calendar &amp; Daily Log
                    </h3>
                    <p className="text-xs text-slate-500 mt-1">
                      In Oman, working days are marked Present by default. Exceptions, overtime, and leaves are highlighted below.
                    </p>
                  </div>

                  {/* Month Switcher Controls */}
                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="icon"
                      onClick={handlePrevMonth}
                      className="h-10 w-10 rounded-xl border-slate-200"
                      title="Previous Month"
                    >
                      <ChevronLeft className="w-4 h-4" />
                    </Button>
                    <div className="h-10 px-4 rounded-xl bg-slate-50 border border-slate-200 flex items-center justify-center font-bold text-slate-900 text-sm min-w-[160px]">
                      {format(new Date(selectedYear, selectedMonth - 1, 1), 'MMMM yyyy')}
                    </div>
                    <Button
                      variant="outline"
                      size="icon"
                      onClick={handleNextMonth}
                      className="h-10 w-10 rounded-xl border-slate-200"
                      title="Next Month"
                    >
                      <ChevronRight className="w-4 h-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={handleCurrentMonth}
                      className="h-10 px-3 rounded-xl text-indigo-600 font-bold text-xs hover:bg-indigo-50"
                    >
                      Today
                    </Button>
                  </div>
                </div>

                {/* Legend badges */}
                <div className="flex flex-wrap items-center gap-3 pt-6 border-t border-slate-100 mt-6 text-xs">
                  <span className="text-slate-400 font-bold text-[11px] uppercase tracking-wider">Legend:</span>
                  <div className="flex items-center gap-1.5">
                    <span className="w-3 h-3 rounded-md bg-emerald-500 inline-block" />
                    <span className="font-medium text-slate-700">Present</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className="w-3 h-3 rounded-md bg-rose-500 inline-block" />
                    <span className="font-medium text-slate-700">Absent</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className="w-3 h-3 rounded-md bg-blue-500 inline-block" />
                    <span className="font-medium text-slate-700">On Leave</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className="w-3 h-3 rounded-md bg-slate-300 inline-block" />
                    <span className="font-medium text-slate-700">Weekly Holiday (Friday)</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className="w-3 h-3 rounded-md bg-purple-500 inline-block" />
                    <span className="font-medium text-slate-700">Overtime Recorded</span>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* MONTHLY CALENDAR GRID */}
            <Card className="border-0 shadow-md shadow-slate-100 rounded-3xl bg-white overflow-hidden p-6">
              <div className="grid grid-cols-7 gap-2 sm:gap-3 text-center mb-3">
                {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((day, idx) => (
                  <div
                    key={day}
                    className={`text-xs font-black uppercase tracking-wider py-1.5 ${
                      idx === 5 ? 'text-amber-600' : 'text-slate-400'
                    }`}
                  >
                    {day}
                  </div>
                ))}
              </div>

              {/* Day cells */}
              <div className="grid grid-cols-7 gap-2 sm:gap-3">
                {/* Empty cells before start of month */}
                {Array.from({ length: new Date(selectedYear, selectedMonth - 1, 1).getDay() }).map((_, i) => (
                  <div key={`empty-${i}`} className="min-h-[75px] sm:min-h-[90px] rounded-2xl bg-slate-50/50 border border-transparent" />
                ))}

                {/* Actual day cells */}
                {attendance.days.map((day: any) => {
                  let bgClass = 'bg-slate-50 border-slate-200/80 hover:border-slate-300 text-slate-900';
                  let statusBadge = (
                    <span className="inline-flex items-center gap-1 text-[10px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-md">
                      Present
                    </span>
                  );

                  if (day.status === 'absent') {
                    bgClass = 'bg-rose-50/60 border-rose-200 hover:border-rose-300 text-rose-950';
                    statusBadge = (
                      <span className="inline-flex items-center gap-1 text-[10px] font-bold text-rose-700 bg-rose-100/70 px-2 py-0.5 rounded-md">
                        Absent
                      </span>
                    );
                  } else if (day.status === 'leave') {
                    bgClass = 'bg-blue-50/70 border-blue-200 hover:border-blue-300 text-blue-950';
                    statusBadge = (
                      <span className="inline-flex items-center gap-1 text-[10px] font-bold text-blue-700 bg-blue-100/70 px-1.5 py-0.5 rounded-md truncate max-w-full">
                        {day.label}
                      </span>
                    );
                  } else if (day.status === 'weekend') {
                    bgClass = 'bg-slate-100/70 border-slate-200 hover:border-slate-300 text-slate-600';
                    statusBadge = (
                      <span className="inline-flex items-center gap-1 text-[10px] font-bold text-slate-500 bg-slate-200/60 px-1.5 py-0.5 rounded-md">
                        Friday
                      </span>
                    );
                  }

                  return (
                    <div
                      key={day.date}
                      onClick={() => setSelectedDayDetail(day)}
                      className={`min-h-[75px] sm:min-h-[90px] p-2 sm:p-2.5 rounded-2xl border transition-all cursor-pointer flex flex-col justify-between hover:shadow-md ${bgClass}`}
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-sm sm:text-base font-black">{day.dayNum}</span>
                        {day.overtimeHours > 0 && (
                          <span className="text-[10px] font-black px-1.5 py-0.5 rounded-md bg-purple-100 text-purple-700 border border-purple-200">
                            +{day.overtimeHours}h OT
                          </span>
                        )}
                      </div>

                      <div className="mt-1 flex flex-col items-start gap-1">
                        {statusBadge}
                      </div>
                    </div>
                  );
                })}
              </div>
            </Card>

            {/* DAILY BREAKDOWN LIST & FILTER */}
            <Card className="border-0 shadow-md shadow-slate-100 rounded-3xl bg-white overflow-hidden">
              <CardHeader className="p-6 pb-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div>
                    <CardTitle className="text-base font-bold text-slate-900">
                      Day-by-Day Attendance Log
                    </CardTitle>
                    <CardDescription className="text-xs text-slate-500">
                      Detailed records for {format(new Date(selectedYear, selectedMonth - 1, 1), 'MMMM yyyy')}
                    </CardDescription>
                  </div>

                  {/* Filter chips */}
                  <div className="flex flex-wrap items-center gap-1.5">
                    {[
                      { id: 'all', label: 'All Days' },
                      { id: 'present', label: 'Present' },
                      { id: 'absent', label: 'Absent' },
                      { id: 'leave', label: 'Leaves' },
                      { id: 'weekend', label: 'Fridays' },
                      { id: 'overtime', label: 'Overtime' },
                    ].map(f => (
                      <button
                        key={f.id}
                        onClick={() => setAttendanceFilter(f.id as any)}
                        className={`text-xs font-bold px-3 py-1.5 rounded-xl transition-all ${
                          attendanceFilter === f.id
                            ? 'bg-indigo-600 text-white shadow-sm shadow-indigo-200'
                            : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                        }`}
                      >
                        {f.label}
                      </button>
                    ))}
                  </div>
                </div>
              </CardHeader>

              <CardContent className="p-0">
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader className="bg-slate-50/80">
                      <TableRow className="border-slate-100">
                        <TableHead className="font-bold text-xs text-slate-600">Date &amp; Day</TableHead>
                        <TableHead className="font-bold text-xs text-slate-600">Status</TableHead>
                        <TableHead className="font-bold text-xs text-slate-600">Working Hours</TableHead>
                        <TableHead className="font-bold text-xs text-slate-600">Overtime</TableHead>
                        <TableHead className="font-bold text-xs text-slate-600">Details / Reason</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredAttendanceDays.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={5} className="text-center py-8 text-slate-400 text-sm">
                            No attendance records matching this filter.
                          </TableCell>
                        </TableRow>
                      ) : (
                        filteredAttendanceDays.map((d: any) => (
                          <TableRow key={d.date} className="border-slate-100 hover:bg-slate-50/50">
                            <TableCell className="font-bold text-slate-900 text-xs sm:text-sm py-3">
                              {format(new Date(d.date), 'dd MMM yyyy')} • <span className="text-slate-400 font-medium">{d.dayOfWeek}</span>
                            </TableCell>
                            <TableCell>
                              {d.status === 'present' && (
                                <Badge className="bg-emerald-100 text-emerald-800 border-0 font-bold text-xs">
                                  Present
                                </Badge>
                              )}
                              {d.status === 'absent' && (
                                <Badge className="bg-rose-100 text-rose-800 border-0 font-bold text-xs">
                                  Absent
                                </Badge>
                              )}
                              {d.status === 'leave' && (
                                <Badge className="bg-blue-100 text-blue-800 border-0 font-bold text-xs">
                                  {d.label}
                                </Badge>
                              )}
                              {d.status === 'weekend' && (
                                <Badge className="bg-slate-100 text-slate-700 border-0 font-bold text-xs">
                                  Friday (Holiday)
                                </Badge>
                              )}
                            </TableCell>
                            <TableCell className="text-xs font-mono font-medium text-slate-700">
                              {d.status === 'present' ? '8.0 hrs' : d.status === 'weekend' ? '0.0 hrs' : '-'}
                            </TableCell>
                            <TableCell>
                              {d.overtimeHours > 0 ? (
                                <span className="inline-flex items-center gap-1 font-bold text-xs text-purple-700 bg-purple-50 px-2 py-0.5 rounded-lg border border-purple-200">
                                  +{d.overtimeHours} hrs ({d.overtimeType})
                                </span>
                              ) : (
                                <span className="text-slate-400 text-xs">-</span>
                              )}
                            </TableCell>
                            <TableCell className="text-xs text-slate-500 max-w-xs truncate">
                              {d.notes || d.projectName || (d.status === 'weekend' ? 'Weekly Rest Day' : 'Normal working day')}
                            </TableCell>
                          </TableRow>
                        ))
                      )}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {/* ========================================================================= */}
        {/* TAB 2: ANNUAL LEAVE & AVAILED DETAILS                                     */}
        {/* ========================================================================= */}
        {activeTab === 'leaves' && (
          <div className="space-y-6 animate-in fade-in-50 duration-200">
            {/* Annual Leave Detailed Breakdown Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
              {/* Card 1: Annual Leave Summary */}
              <Card className="md:col-span-2 border-0 shadow-md shadow-slate-100 rounded-3xl bg-white overflow-hidden p-6 space-y-5">
                <div className="flex items-center justify-between border-b border-slate-100 pb-4">
                  <div>
                    <h3 className="text-lg font-black text-slate-900 flex items-center gap-2">
                      <CalendarDays className="w-5 h-5 text-blue-600" />
                      Annual Leave Entitlement ({annualBalance?.year || selectedYear})
                    </h3>
                    <p className="text-xs text-slate-500 mt-0.5">
                      Accrued at 2.5 days per month of service (maximum 30.0 days per year under Oman Labour Law).
                    </p>
                  </div>
                  <Badge className="bg-blue-100 text-blue-700 border-0 text-xs font-bold px-3 py-1">
                    Annual Leave
                  </Badge>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-center">
                  <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-100">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block mb-1">
                      Entitled (This Year)
                    </span>
                    <span className="text-2xl font-black text-slate-900">
                      {Number(annualBalance?.entitled || 0).toFixed(1)}
                    </span>
                  </div>
                  <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-100">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block mb-1">
                      Carried Forward
                    </span>
                    <span className="text-2xl font-black text-slate-900">
                      {Number(annualBalance?.carried_forward || 0).toFixed(1)}
                    </span>
                  </div>
                  <div className="p-3.5 rounded-2xl bg-rose-50/70 border border-rose-100">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-rose-500 block mb-1">
                      Availed / Used
                    </span>
                    <span className="text-2xl font-black text-rose-600">
                      {Number(annualBalance?.used || 0).toFixed(1)}
                    </span>
                  </div>
                  <div className="p-3.5 rounded-2xl bg-blue-50/80 border border-blue-100">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-blue-600 block mb-1">
                      Remaining Balance
                    </span>
                    <span className="text-2xl font-black text-blue-700">
                      {Number(annualBalance?.balance || 0).toFixed(1)}
                    </span>
                  </div>
                </div>

                <div className="p-4 rounded-2xl bg-blue-50/50 border border-blue-100 text-xs text-blue-900 flex items-start gap-3">
                  <Info className="w-4 h-4 text-blue-600 flex-shrink-0 mt-0.5" />
                  <div className="space-y-1">
                    <p className="font-bold">Company Overdraft Allowance:</p>
                    <p className="text-blue-800 leading-relaxed">
                      You are permitted up to <strong>3.0 days overdraft</strong> for Annual Leave. The maximum leave you can request right now is{' '}
                      <strong>{annualMaxAllowed.toFixed(1)} days</strong>.
                    </p>
                  </div>
                </div>
              </Card>

              {/* Card 2: Sick Leave Rights & Protection Card */}
              <Card className="border-0 shadow-md shadow-slate-100 rounded-3xl bg-white overflow-hidden p-6 space-y-4">
                <div className="flex items-center gap-2 text-rose-600">
                  <Stethoscope className="w-5 h-5" />
                  <h4 className="text-base font-black text-slate-900">Sick Leave Protection</h4>
                </div>
                <p className="text-xs text-slate-500 leading-relaxed">
                  Under <strong>Oman Labour Law (Royal Decree 53/2023)</strong>, you are entitled to continuous or non-continuous sick leave up to 182 days per year:
                </p>

                <div className="space-y-2 text-xs">
                  <div className="flex items-center justify-between p-2 rounded-xl bg-emerald-50 text-emerald-900 font-medium">
                    <span>Days 1 to 21:</span>
                    <strong className="font-bold">100% Full Wage</strong>
                  </div>
                  <div className="flex items-center justify-between p-2 rounded-xl bg-amber-50 text-amber-900 font-medium">
                    <span>Days 22 to 35:</span>
                    <strong className="font-bold">75% Gross Wage</strong>
                  </div>
                  <div className="flex items-center justify-between p-2 rounded-xl bg-orange-50 text-orange-900 font-medium">
                    <span>Days 36 to 70:</span>
                    <strong className="font-bold">50% Gross Wage</strong>
                  </div>
                  <div className="flex items-center justify-between p-2 rounded-xl bg-rose-50 text-rose-900 font-medium">
                    <span>Days 71 to 182:</span>
                    <strong className="font-bold">25% Gross Wage</strong>
                  </div>
                </div>

                <p className="text-[11px] text-slate-400 italic">
                  *Official medical certificate is required for sick leave approval.
                </p>
              </Card>
            </div>

            {/* AVAILED LEAVES HISTORY TABLE */}
            <Card className="border-0 shadow-md shadow-slate-100 rounded-3xl bg-white overflow-hidden">
              <CardHeader className="p-6 pb-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div>
                    <CardTitle className="text-lg font-bold text-slate-900 flex items-center gap-2">
                      <Plane className="w-5 h-5 text-indigo-600" />
                      Availed Leave History &amp; Applications
                    </CardTitle>
                    <CardDescription className="text-xs text-slate-500">
                      Record of all your approved, pending, and past leave applications
                    </CardDescription>
                  </div>
                  <Button
                    onClick={() => setActiveTab('apply')}
                    className="h-10 px-4 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs gap-1.5 shadow-md shadow-indigo-100"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    New Request
                  </Button>
                </div>
              </CardHeader>

              <CardContent className="p-0">
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader className="bg-slate-50/80">
                      <TableRow className="border-slate-100">
                        <TableHead className="font-bold text-xs text-slate-600">Leave Type</TableHead>
                        <TableHead className="font-bold text-xs text-slate-600">Period &amp; Dates</TableHead>
                        <TableHead className="font-bold text-xs text-slate-600">Days</TableHead>
                        <TableHead className="font-bold text-xs text-slate-600">Approval Status</TableHead>
                        <TableHead className="font-bold text-xs text-slate-600">Settlement Status</TableHead>
                        <TableHead className="font-bold text-xs text-slate-600">Return Date</TableHead>
                        <TableHead className="font-bold text-xs text-slate-600">Notes / Attachment</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {leaveRecords.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={7} className="text-center py-12 text-slate-400 text-sm">
                            <CalendarDays className="w-8 h-8 text-slate-300 mx-auto mb-2" />
                            No leave requests found. You have not applied for any leave yet.
                          </TableCell>
                        </TableRow>
                      ) : (
                        leaveRecords.map((leave: any) => {
                          const isApprove = leave.status === 'approved';
                          const isPendingStatus = leave.status === 'pending';
                          const isReject = leave.status === 'rejected';

                          return (
                            <TableRow key={leave.id} className="border-slate-100 hover:bg-slate-50/50">
                              <TableCell className="font-bold text-slate-900 text-xs sm:text-sm py-4">
                                <Badge variant="outline" className="border-slate-200 text-slate-800 text-xs py-0.5 px-2.5 font-bold">
                                  {leave.leave_type_name}
                                </Badge>
                              </TableCell>
                              <TableCell className="text-xs sm:text-sm font-medium text-slate-900">
                                {format(new Date(leave.start_date), 'dd MMM yyyy')} — {format(new Date(leave.end_date), 'dd MMM yyyy')}
                              </TableCell>
                              <TableCell className="font-bold text-xs sm:text-sm text-slate-900">
                                {Number(leave.days).toFixed(1)} Days
                              </TableCell>
                              <TableCell>
                                {isApprove && (
                                  <Badge className="bg-emerald-100 text-emerald-800 border-0 font-bold text-xs gap-1">
                                    <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                                    Approved
                                  </Badge>
                                )}
                                {isPendingStatus && (
                                  <Badge className="bg-amber-100 text-amber-800 border-0 font-bold text-xs gap-1">
                                    <Clock4 className="w-3 h-3 text-amber-600" />
                                    Pending Review
                                  </Badge>
                                )}
                                {isReject && (
                                  <Badge className="bg-rose-100 text-rose-800 border-0 font-bold text-xs gap-1">
                                    <XCircle className="w-3 h-3 text-rose-600" />
                                    Rejected
                                  </Badge>
                                )}
                              </TableCell>
                              <TableCell>
                                {leave.settlement_status === 'settled' ? (
                                  <Badge className="bg-blue-100 text-blue-800 border-0 font-bold text-xs">
                                    Settled (Paid)
                                  </Badge>
                                ) : leave.settlement_status === 'pending' ? (
                                  <Badge className="bg-amber-100 text-amber-800 border-0 font-bold text-xs">
                                    Settlement Pending
                                  </Badge>
                                ) : (
                                  <span className="text-slate-400 text-xs">None</span>
                                )}
                              </TableCell>
                              <TableCell className="text-xs text-slate-600 font-medium">
                                {leave.return_date ? (
                                  <span className="text-emerald-700 font-bold">
                                    Rejoined {format(new Date(leave.return_date), 'dd/MM/yyyy')}
                                  </span>
                                ) : (
                                  <span className="text-slate-400">-</span>
                                )}
                              </TableCell>
                              <TableCell className="text-xs text-slate-600">
                                <div className="space-y-1">
                                  {leave.notes && <p className="max-w-xs truncate">{leave.notes}</p>}
                                  {leave.attachment_url && (
                                    <a
                                      href={leave.attachment_url}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      className="inline-flex items-center gap-1 text-xs text-indigo-600 hover:text-indigo-800 font-bold"
                                    >
                                      <FileText className="w-3.5 h-3.5" />
                                      {leave.attachment_name || 'View Document'}
                                      <ExternalLink className="w-3 h-3" />
                                    </a>
                                  )}
                                </div>
                              </TableCell>
                            </TableRow>
                          );
                        })
                      )}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {/* ========================================================================= */}
        {/* TAB 3: APPLY FOR LEAVE                                                   */}
        {/* ========================================================================= */}
        {activeTab === 'apply' && (
          <div className="max-w-3xl mx-auto animate-in fade-in-50 duration-200 space-y-6">
            <Card className="border-0 shadow-xl shadow-slate-100 rounded-[2rem] bg-white overflow-hidden">
              <div className="h-2 w-full bg-gradient-to-r from-blue-600 via-indigo-600 to-indigo-500" />
              
              <CardHeader className="p-6 sm:p-8 pb-4">
                <CardTitle className="text-2xl font-black text-slate-900 flex items-center gap-2.5">
                  <CalendarDays className="w-6 h-6 text-indigo-600" />
                  Leave Application Form
                </CardTitle>
                <CardDescription className="text-slate-500 text-sm">
                  Apply for Annual Leave or Sick Leave with instant balance checking and management approval.
                </CardDescription>
              </CardHeader>

              <CardContent className="p-6 sm:p-8 pt-2">
                <form onSubmit={handleSubmitLeave} className="space-y-6">
                  {/* 1. Leave Type Selector */}
                  <div className="space-y-2">
                    <Label className="text-xs font-bold uppercase tracking-wider text-slate-700">
                      Choose Leave Type *
                    </Label>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      {leaveTypes
                        .filter((lt: any) => {
                          const n = lt.name.toLowerCase();
                          return n.includes('annual') || n.includes('sick');
                        })
                        .map((lt: any) => {
                          const isSelected = applyLeaveTypeId === lt.id;
                          const isAnnual = lt.name.toLowerCase().includes('annual');

                          return (
                            <div
                              key={lt.id}
                              onClick={() => setApplyLeaveTypeId(lt.id)}
                              className={`p-4 rounded-2xl border-2 transition-all cursor-pointer flex items-start gap-3 ${
                                isSelected
                                  ? 'border-indigo-600 bg-indigo-50/50 shadow-md shadow-indigo-100'
                                  : 'border-slate-200 hover:border-slate-300 bg-white'
                              }`}
                            >
                              <div
                                className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${
                                  isSelected
                                    ? 'bg-indigo-600 text-white'
                                    : 'bg-slate-100 text-slate-600'
                                }`}
                              >
                                {isAnnual ? <Plane className="w-5 h-5" /> : <Stethoscope className="w-5 h-5" />}
                              </div>
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center justify-between">
                                  <h4 className="font-bold text-slate-900 text-sm">{lt.name}</h4>
                                  {isSelected && <Check className="w-4 h-4 text-indigo-600" />}
                                </div>
                                <p className="text-xs text-slate-500 mt-0.5">
                                  {isAnnual
                                    ? `${Number(annualBalance.balance || 0).toFixed(1)} days available`
                                    : 'Oman Labour Law tiered pay'}
                                </p>
                              </div>
                            </div>
                          );
                        })}
                    </div>
                  </div>

                  {/* Context Info Banner */}
                  {isApplyingAnnual && (
                    <div className="p-4 rounded-2xl bg-blue-50/70 border border-blue-200 text-xs text-blue-900 flex items-start gap-3">
                      <CalendarDays className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
                      <div className="space-y-1">
                        <div className="font-bold text-blue-950">
                          Annual Leave Available: {Number(annualBalance.balance || 0).toFixed(1)} Days
                        </div>
                        <p className="text-blue-800 leading-relaxed">
                          Your current balance is <strong>{annualBalance.balance.toFixed(1)} days</strong>. With the standard 3.0 days company overdraft, you can request up to <strong>{annualMaxAllowed.toFixed(1)} days</strong>.
                        </p>
                      </div>
                    </div>
                  )}

                  {isApplyingSick && (
                    <div className="p-4 rounded-2xl bg-amber-50 border border-amber-200 text-xs text-amber-900 flex items-start gap-3">
                      <Stethoscope className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
                      <div className="space-y-1">
                        <div className="font-bold text-amber-950">Sick Leave Protection (RD 53/2023)</div>
                        <p className="text-amber-800 leading-relaxed">
                          First 21 days paid at 100% full wage; days 22-35 paid at 75%. Please upload an official doctor/hospital medical certificate below.
                        </p>
                      </div>
                    </div>
                  )}

                  {/* 2. Date Selection Grid */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                      <Label htmlFor="start_date" className="text-xs font-bold uppercase tracking-wider text-slate-700">
                        Start Date *
                      </Label>
                      <DatePickerInput
                        id="start_date"
                        value={applyStartDate}
                        onChange={(e) => setApplyStartDate(e.target.value)}
                        placeholder="Select start date"
                        className="h-12 rounded-xl bg-slate-50 border-slate-200 font-medium"
                      />
                    </div>

                    <div className="space-y-1.5">
                      <Label htmlFor="end_date" className="text-xs font-bold uppercase tracking-wider text-slate-700">
                        End Date *
                      </Label>
                      <DatePickerInput
                        id="end_date"
                        value={applyEndDate}
                        onChange={(e) => setApplyEndDate(e.target.value)}
                        placeholder="Select end date"
                        className="h-12 rounded-xl bg-slate-50 border-slate-200 font-medium"
                      />
                    </div>
                  </div>

                  {/* Half-day toggle & Calculation summary */}
                  <div className="flex flex-wrap items-center justify-between gap-4 p-4 rounded-2xl bg-slate-50 border border-slate-200">
                    <div className="flex items-center space-x-2">
                      <Checkbox
                        id="halfDay"
                        checked={isHalfDay}
                        onCheckedChange={(checked) => setIsHalfDay(!!checked)}
                      />
                      <label
                        htmlFor="halfDay"
                        className="text-xs font-bold text-slate-700 cursor-pointer select-none"
                      >
                        Apply for Half Day (0.5 Day)
                      </label>
                    </div>

                    <div className="flex items-center gap-2">
                      <span className="text-xs text-slate-500 font-bold">Total Duration:</span>
                      <span className="text-base font-black text-indigo-700 bg-indigo-100 px-3 py-1 rounded-xl">
                        {calculatedDays.toFixed(1)} Days
                      </span>
                    </div>
                  </div>

                  {/* Over limit warning */}
                  {isOverAnnualLimit && (
                    <div className="p-3.5 rounded-2xl bg-rose-50 border border-rose-200 text-rose-700 text-xs font-medium flex items-center gap-2">
                      <AlertCircle className="w-4 h-4 text-rose-600 flex-shrink-0" />
                      <span>
                        Requested duration exceeds maximum allowed ({annualMaxAllowed.toFixed(1)} days including overdraft).
                      </span>
                    </div>
                  )}

                  {/* 3. Reason / Notes */}
                  <div className="space-y-1.5">
                    <Label htmlFor="reason" className="text-xs font-bold uppercase tracking-wider text-slate-700">
                      Reason / Destination / Notes *
                    </Label>
                    <Textarea
                      id="reason"
                      placeholder="e.g. Annual vacation to home country, medical recovery, personal reasons..."
                      value={applyNotes}
                      onChange={(e) => setApplyNotes(e.target.value)}
                      rows={3}
                      className="rounded-xl bg-slate-50 border-slate-200 font-medium"
                      required
                    />
                  </div>

                  {/* 4. Emergency Phone Number */}
                  <div className="space-y-1.5">
                    <Label htmlFor="phone" className="text-xs font-bold uppercase tracking-wider text-slate-700 flex items-center gap-1.5">
                      <Phone className="w-3.5 h-3.5 text-indigo-600" />
                      Contact Number During Leave
                    </Label>
                    <Input
                      id="phone"
                      type="text"
                      placeholder="e.g. +968 9123 4567"
                      value={emergencyPhone}
                      onChange={(e) => setEmergencyPhone(e.target.value)}
                      className="h-12 rounded-xl bg-slate-50 border-slate-200 font-medium"
                    />
                  </div>

                  {/* 5. Supporting Document Upload (Medical cert / ticket) */}
                  <div className="space-y-1.5">
                    <Label className="text-xs font-bold uppercase tracking-wider text-slate-700 flex items-center gap-1.5">
                      <FileText className="w-3.5 h-3.5 text-indigo-600" />
                      {isApplyingSick ? 'Medical Certificate (Doctor Prescription) *' : 'Supporting Document (Optional)'}
                    </Label>
                    <FileUpload
                      value={attachmentUrl}
                      fileName={attachmentName}
                      onChange={(url, name) => {
                        setAttachmentUrl(url);
                        setAttachmentName(name);
                      }}
                      onRemove={() => {
                        setAttachmentUrl(null);
                        setAttachmentName(null);
                      }}
                      label={isApplyingSick ? 'Upload Medical Certificate' : 'Upload Flight Ticket / Document'}
                      description="PDF, PNG, or JPG up to 10MB"
                      bucket="attachments"
                      folder="leave-attachments"
                    />
                  </div>

                  {/* Submit Button */}
                  <Button
                    type="submit"
                    disabled={submittingLeave || calculatedDays <= 0 || isOverAnnualLimit}
                    className="w-full h-12 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-sm shadow-xl shadow-indigo-200 transition-all gap-2"
                  >
                    {submittingLeave ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        Submitting Application...
                      </>
                    ) : (
                      <>
                        Submit Leave Application
                        <ArrowRight className="w-4 h-4" />
                      </>
                    )}
                  </Button>
                </form>
              </CardContent>
            </Card>
          </div>
        )}

        {/* 4. DAY DETAIL MODAL */}
        <Dialog open={!!selectedDayDetail} onOpenChange={() => setSelectedDayDetail(null)}>
          <DialogContent className="max-w-md rounded-3xl p-6">
            <DialogHeader>
              <DialogTitle className="text-lg font-black text-slate-900 flex items-center gap-2">
                <Clock className="w-5 h-5 text-indigo-600" />
                Attendance Details
              </DialogTitle>
              <DialogDescription className="text-xs text-slate-500">
                {selectedDayDetail?.date && format(new Date(selectedDayDetail.date), 'EEEE, MMMM dd, yyyy')}
              </DialogDescription>
            </DialogHeader>

            {selectedDayDetail && (
              <div className="space-y-4 pt-2 text-sm">
                <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-100 flex items-center justify-between">
                  <span className="text-xs text-slate-500 font-bold uppercase">Status</span>
                  <Badge
                    className={`font-bold text-xs ${
                      selectedDayDetail.status === 'present'
                        ? 'bg-emerald-100 text-emerald-800'
                        : selectedDayDetail.status === 'absent'
                        ? 'bg-rose-100 text-rose-800'
                        : selectedDayDetail.status === 'leave'
                        ? 'bg-blue-100 text-blue-800'
                        : 'bg-slate-100 text-slate-700'
                    } border-0`}
                  >
                    {selectedDayDetail.label}
                  </Badge>
                </div>

                <div className="grid grid-cols-2 gap-3 text-center">
                  <div className="p-3 rounded-2xl bg-slate-50 border border-slate-100">
                    <span className="text-[10px] text-slate-400 font-bold uppercase block mb-1">
                      Working Hours
                    </span>
                    <span className="text-lg font-black text-slate-800">
                      {selectedDayDetail.status === 'present' ? '8.0' : '0.0'} hrs
                    </span>
                  </div>
                  <div className="p-3 rounded-2xl bg-purple-50/70 border border-purple-100">
                    <span className="text-[10px] text-purple-600 font-bold uppercase block mb-1">
                      Overtime (OT)
                    </span>
                    <span className="text-lg font-black text-purple-700">
                      +{selectedDayDetail.overtimeHours} hrs
                    </span>
                  </div>
                </div>

                {selectedDayDetail.notes && (
                  <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-100 text-xs">
                    <span className="text-[10px] text-slate-400 font-bold uppercase block mb-1">Notes</span>
                    <p className="text-slate-700 font-medium">{selectedDayDetail.notes}</p>
                  </div>
                )}

                {selectedDayDetail.coveringLeave && (
                  <div className="p-3.5 rounded-2xl bg-blue-50 border border-blue-100 text-xs text-blue-900 space-y-1">
                    <span className="font-bold">Leave Request Attached:</span>
                    <p>{selectedDayDetail.coveringLeave.leave_type_name} ({selectedDayDetail.coveringLeave.status})</p>
                  </div>
                )}
              </div>
            )}

            <DialogFooter className="pt-2">
              <Button
                variant="outline"
                onClick={() => setSelectedDayDetail(null)}
                className="w-full rounded-xl"
              >
                Close
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </main>
    </div>
  );
}
