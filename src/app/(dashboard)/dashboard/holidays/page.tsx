'use client';

import { useState, useEffect, useMemo, useTransition } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
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
import { DatePickerInput } from '@/components/ui/date-picker-input';
import { useCompany } from '@/components/providers/CompanyProvider';
import {
  PartyPopper,
  CalendarDays,
  Plus,
  Sparkles,
  Pencil,
  Trash2,
  Search,
  Filter,
  CheckCircle2,
  Calendar,
  Clock,
  Building2,
  ListFilter,
  LayoutGrid,
  List,
  AlertCircle,
  Download,
  Check,
  ChevronRight,
  Loader2,
  Sun,
  ShieldCheck
} from 'lucide-react';
import { toast } from 'sonner';
import { format, parseISO, differenceInCalendarDays } from 'date-fns';
import {
  getCompanyHolidays,
  declareHoliday,
  updateHoliday,
  deleteHoliday,
  importStandardHolidays,
  HolidayRecord,
} from './actions';
import { STANDARD_HOLIDAYS_BY_YEAR, StandardHolidayTemplate } from './standard-holidays';

export default function HolidaysManagementPage() {
  const { activeCompanyId, activeCompany, availableCompanies, setActiveCompanyId } = useCompany();

  // Filters & State
  const currentYear = new Date().getFullYear();
  const [selectedYear, setSelectedYear] = useState<number>(currentYear);
  const [viewMode, setViewMode] = useState<'list' | 'calendar'>('list');
  const [filterType, setFilterType] = useState<'all' | 'public' | 'company' | 'restricted'>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');

  // Data State
  const [holidays, setHolidays] = useState<HolidayRecord[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [isPending, startTransition] = useTransition();

  // Declare Holiday Modal State
  const [isDeclareOpen, setIsDeclareOpen] = useState<boolean>(false);
  const [declareName, setDeclareName] = useState<string>('');
  const [declareMode, setDeclareMode] = useState<'single' | 'range'>('single');
  const [declareDate, setDeclareDate] = useState<string>('');
  const [declareStartDate, setDeclareStartDate] = useState<string>('');
  const [declareEndDate, setDeclareEndDate] = useState<string>('');
  const [declareType, setDeclareType] = useState<'public' | 'company' | 'restricted'>('public');
  const [declareIsPaid, setDeclareIsPaid] = useState<boolean>(true);
  const [submittingDeclare, setSubmittingDeclare] = useState<boolean>(false);

  // Edit Holiday Modal State
  const [editingHoliday, setEditingHoliday] = useState<HolidayRecord | null>(null);
  const [editName, setEditName] = useState<string>('');
  const [editDate, setEditDate] = useState<string>('');
  const [editType, setEditType] = useState<'public' | 'company' | 'restricted'>('public');
  const [editIsPaid, setEditIsPaid] = useState<boolean>(true);
  const [submittingEdit, setSubmittingEdit] = useState<boolean>(false);

  // Delete Holiday Alert State
  const [deletingHoliday, setDeletingHoliday] = useState<HolidayRecord | null>(null);
  const [submittingDelete, setSubmittingDelete] = useState<boolean>(false);

  // Import Standard Holidays Modal State
  const [isImportOpen, setIsImportOpen] = useState<boolean>(false);
  const [selectedStandardHolidays, setSelectedStandardHolidays] = useState<StandardHolidayTemplate[]>([]);
  const [submittingImport, setSubmittingImport] = useState<boolean>(false);

  // Load holidays whenever activeCompanyId or selectedYear changes
  const loadHolidays = async () => {
    if (!activeCompanyId) return;
    setLoading(true);
    try {
      const res = await getCompanyHolidays(activeCompanyId, selectedYear);
      if (res.success && res.holidays) {
        setHolidays(res.holidays);
      } else if (res.error) {
        toast.error(res.error);
      }
    } catch (err: any) {
      toast.error('Failed to load holidays');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadHolidays();
  }, [activeCompanyId, selectedYear]);

  // Filtered Holidays
  const filteredHolidays = useMemo(() => {
    return holidays.filter(h => {
      const matchesType = filterType === 'all' || h.holiday_type === filterType;
      const matchesSearch = !searchQuery.trim() || h.name.toLowerCase().includes(searchQuery.toLowerCase().trim());
      return matchesType && matchesSearch;
    });
  }, [holidays, filterType, searchQuery]);

  // KPI Calculations
  const stats = useMemo(() => {
    const total = holidays.length;
    const publicCount = holidays.filter(h => h.holiday_type === 'public').length;
    const companyCount = holidays.filter(h => h.holiday_type === 'company').length;
    const paidCount = holidays.filter(h => h.is_paid).length;
    const unpaidCount = total - paidCount;

    // Find next upcoming holiday from today
    const todayStr = format(new Date(), 'yyyy-MM-dd');
    const upcoming = holidays
      .filter(h => h.date >= todayStr)
      .sort((a, b) => a.date.localeCompare(b.date))[0] || null;

    let countdownText = 'No upcoming holidays';
    if (upcoming) {
      const diff = differenceInCalendarDays(parseISO(upcoming.date), new Date());
      if (diff === 0) countdownText = 'Today!';
      else if (diff === 1) countdownText = 'Tomorrow';
      else countdownText = `In ${diff} days`;
    }

    return {
      total,
      publicCount,
      companyCount,
      paidCount,
      unpaidCount,
      upcoming,
      countdownText,
    };
  }, [holidays]);

  // Open Declare Modal Reset
  const handleOpenDeclare = () => {
    setDeclareName('');
    setDeclareMode('single');
    setDeclareDate('');
    setDeclareStartDate('');
    setDeclareEndDate('');
    setDeclareType('public');
    setDeclareIsPaid(true);
    setIsDeclareOpen(true);
  };

  // Submit Declare Holiday
  const handleDeclareSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeCompanyId) {
      toast.error('Please select a company first');
      return;
    }

    if (!declareName.trim()) {
      toast.error('Holiday name is required');
      return;
    }

    if (declareMode === 'single' && !declareDate) {
      toast.error('Please select a holiday date');
      return;
    }

    if (declareMode === 'range' && (!declareStartDate || !declareEndDate)) {
      toast.error('Please select both start date and end date');
      return;
    }

    setSubmittingDeclare(true);
    try {
      const res = await declareHoliday({
        companyId: activeCompanyId,
        name: declareName,
        holidayType: declareType,
        isPaid: declareIsPaid,
        mode: declareMode,
        date: declareDate,
        startDate: declareStartDate,
        endDate: declareEndDate,
      });

      if (!res.success) {
        toast.error(res.error || 'Failed to declare holiday');
      } else {
        toast.success(res.message || 'Holiday declared successfully!');
        setIsDeclareOpen(false);
        loadHolidays();
      }
    } catch (err: any) {
      toast.error(err.message || 'An error occurred while declaring holiday');
    } finally {
      setSubmittingDeclare(false);
    }
  };

  // Open Edit Modal
  const handleOpenEdit = (holiday: HolidayRecord) => {
    setEditingHoliday(holiday);
    setEditName(holiday.name);
    setEditDate(holiday.date);
    setEditType(holiday.holiday_type);
    setEditIsPaid(holiday.is_paid);
  };

  // Submit Edit Holiday
  const handleEditSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingHoliday) return;

    if (!editName.trim()) {
      toast.error('Holiday name is required');
      return;
    }
    if (!editDate) {
      toast.error('Holiday date is required');
      return;
    }

    setSubmittingEdit(true);
    try {
      const res = await updateHoliday(editingHoliday.id, {
        name: editName,
        date: editDate,
        holidayType: editType,
        isPaid: editIsPaid,
      });

      if (!res.success) {
        toast.error(res.error || 'Failed to update holiday');
      } else {
        toast.success(res.message || 'Holiday updated successfully!');
        setEditingHoliday(null);
        loadHolidays();
      }
    } catch (err: any) {
      toast.error(err.message || 'An error occurred while updating holiday');
    } finally {
      setSubmittingEdit(false);
    }
  };

  // Submit Delete Holiday
  const handleDeleteSubmit = async () => {
    if (!deletingHoliday) return;
    setSubmittingDelete(true);
    try {
      const res = await deleteHoliday(deletingHoliday.id);
      if (!res.success) {
        toast.error(res.error || 'Failed to delete holiday');
      } else {
        toast.success(res.message || 'Holiday deleted successfully');
        setDeletingHoliday(null);
        loadHolidays();
      }
    } catch (err: any) {
      toast.error(err.message || 'An error occurred while deleting holiday');
    } finally {
      setSubmittingDelete(false);
    }
  };

  // Open Import Standard Holidays Modal
  const handleOpenImport = () => {
    const templates = STANDARD_HOLIDAYS_BY_YEAR[selectedYear] || [];
    setSelectedStandardHolidays(templates);
    setIsImportOpen(true);
  };

  // Toggle selection for standard holidays import
  const handleToggleImportItem = (item: StandardHolidayTemplate) => {
    if (selectedStandardHolidays.some(h => h.date === item.date)) {
      setSelectedStandardHolidays(selectedStandardHolidays.filter(h => h.date !== item.date));
    } else {
      setSelectedStandardHolidays([...selectedStandardHolidays, item]);
    }
  };

  // Submit Import Standard Holidays
  const handleImportSubmit = async () => {
    if (!activeCompanyId) {
      toast.error('Please select a company');
      return;
    }
    if (selectedStandardHolidays.length === 0) {
      toast.error('Please select at least one holiday to import');
      return;
    }

    setSubmittingImport(true);
    try {
      const res = await importStandardHolidays(activeCompanyId, selectedYear, selectedStandardHolidays);
      if (!res.success) {
        toast.error(res.error || 'Failed to import standard holidays');
      } else {
        toast.success(res.message || 'Public holidays imported successfully!');
        setIsImportOpen(false);
        loadHolidays();
      }
    } catch (err: any) {
      toast.error(err.message || 'An error occurred while importing holidays');
    } finally {
      setSubmittingImport(false);
    }
  };

  // Group holidays by month for Calendar / Month View
  const holidaysByMonth = useMemo(() => {
    const months = Array.from({ length: 12 }, (_, i) => {
      const monthNum = i + 1;
      const monthPrefix = `${selectedYear}-${String(monthNum).padStart(2, '0')}`;
      const monthHolidays = holidays.filter(h => h.date.startsWith(monthPrefix));
      const monthName = format(new Date(selectedYear, i, 1), 'MMMM');
      return {
        monthNum,
        monthName,
        holidays: monthHolidays,
      };
    });
    return months;
  }, [holidays, selectedYear]);

  return (
    <div className="space-y-6 p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto">
      {/* 1. Header Section */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-2xl bg-amber-500/10 text-amber-600 flex items-center justify-center font-bold">
              <PartyPopper className="w-5 h-5" />
            </div>
            <div>
              <h1 className="text-2xl font-black text-slate-900 tracking-tight">Holiday Management</h1>
              <p className="text-xs sm:text-sm text-slate-500 font-medium">
                Declare, manage, and automate public and company holidays for attendance &amp; payroll.
              </p>
            </div>
          </div>
        </div>

        {/* Company & Year Selectors & Action Buttons */}
        <div className="flex flex-wrap items-center gap-2.5">
          {availableCompanies.length > 1 && (
            <div className="w-48">
              <Select value={activeCompanyId} onValueChange={(val) => { if (val) setActiveCompanyId(val); }}>
                <SelectTrigger className="h-10 rounded-xl font-bold text-xs bg-white border-slate-200">
                  <SelectValue placeholder="Select Company">
                    {availableCompanies.find(c => c.id === activeCompanyId)?.name_en || 'Select Company'}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {availableCompanies.map(c => (
                    <SelectItem key={c.id} value={c.id} className="text-xs">
                      {c.name_en}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          <div className="w-28">
            <Select value={String(selectedYear)} onValueChange={(val) => { if (val) setSelectedYear(Number(val)); }}>
              <SelectTrigger className="h-10 rounded-xl font-bold text-xs bg-white border-slate-200">
                <SelectValue placeholder="Year" />
              </SelectTrigger>
              <SelectContent>
                {[2024, 2025, 2026, 2027, 2028].map(yr => (
                  <SelectItem key={yr} value={String(yr)} className="text-xs font-bold">
                    {yr}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <Button
            variant="outline"
            onClick={handleOpenImport}
            className="h-10 rounded-xl font-bold text-xs gap-1.5 border-amber-200 text-amber-800 bg-amber-50 hover:bg-amber-100 hover:text-amber-900 transition-colors"
          >
            <Sparkles className="w-3.5 h-3.5 text-amber-600" />
            <span>Pre-populate Public Holidays</span>
          </Button>

          <Button
            onClick={handleOpenDeclare}
            className="h-10 px-4 rounded-xl font-bold text-xs gap-1.5 bg-indigo-600 hover:bg-indigo-700 text-white shadow-md shadow-indigo-100"
          >
            <Plus className="w-4 h-4" />
            <span>Declare Holiday</span>
          </Button>
        </div>
      </div>

      {/* 2. KPI / Summary Metric Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Card 1: Total Holidays */}
        <Card className="border-0 shadow-sm rounded-2xl bg-white overflow-hidden relative group hover:shadow-md transition-all">
          <div className="h-1.5 w-full bg-indigo-600" />
          <CardContent className="p-5 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-400">Total Holidays</span>
              <div className="w-8 h-8 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center">
                <CalendarDays className="w-4 h-4" />
              </div>
            </div>
            <div>
              <div className="text-3xl font-black text-slate-900 tracking-tight">
                {stats.total} <span className="text-xs font-bold text-slate-400">Days in {selectedYear}</span>
              </div>
              <p className="text-[11px] text-slate-400 font-medium mt-1">
                {stats.paidCount} Paid • {stats.unpaidCount} Unpaid
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Card 2: Public Holidays */}
        <Card className="border-0 shadow-sm rounded-2xl bg-white overflow-hidden relative group hover:shadow-md transition-all">
          <div className="h-1.5 w-full bg-amber-500" />
          <CardContent className="p-5 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-400">Public Holidays</span>
              <div className="w-8 h-8 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center">
                <Sun className="w-4 h-4" />
              </div>
            </div>
            <div>
              <div className="text-3xl font-black text-amber-600 tracking-tight">
                {stats.publicCount} <span className="text-xs font-bold text-slate-400">Days</span>
              </div>
              <p className="text-[11px] text-slate-400 font-medium mt-1">
                National gazetted &amp; religious holidays
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Card 3: Company Observances */}
        <Card className="border-0 shadow-sm rounded-2xl bg-white overflow-hidden relative group hover:shadow-md transition-all">
          <div className="h-1.5 w-full bg-blue-500" />
          <CardContent className="p-5 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-400">Company Holidays</span>
              <div className="w-8 h-8 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center">
                <Building2 className="w-4 h-4" />
              </div>
            </div>
            <div>
              <div className="text-3xl font-black text-blue-600 tracking-tight">
                {stats.companyCount} <span className="text-xs font-bold text-slate-400">Days</span>
              </div>
              <p className="text-[11px] text-slate-400 font-medium mt-1">
                Organization-specific paid rest days
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Card 4: Upcoming Next Holiday */}
        <Card className="border-0 shadow-sm rounded-2xl bg-white overflow-hidden relative group hover:shadow-md transition-all">
          <div className="h-1.5 w-full bg-emerald-500" />
          <CardContent className="p-5 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-400">Next Upcoming</span>
              <div className="w-8 h-8 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
                <Clock className="w-4 h-4" />
              </div>
            </div>
            <div>
              {stats.upcoming ? (
                <>
                  <div className="text-lg font-black text-slate-900 truncate">
                    {stats.upcoming.name}
                  </div>
                  <div className="flex items-center gap-2 mt-1">
                    <span className="text-xs font-bold text-emerald-600">
                      {format(parseISO(stats.upcoming.date), 'dd MMM yyyy')}
                    </span>
                    <Badge className="bg-emerald-100 text-emerald-800 border-0 text-[10px] font-extrabold px-1.5 py-0.2">
                      {stats.countdownText}
                    </Badge>
                  </div>
                </>
              ) : (
                <>
                  <div className="text-base font-bold text-slate-400 mt-1">No upcoming holidays</div>
                  <p className="text-[11px] text-slate-400 mt-1">All declared holidays for {selectedYear} have passed</p>
                </>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* 3. Controls & Filter Bar */}
      <Card className="border-0 shadow-sm rounded-2xl bg-white p-4">
        <div className="flex flex-col md:flex-row items-center justify-between gap-3">
          {/* Search Input */}
          <div className="relative w-full md:w-80">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <Input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search holidays by name..."
              className="pl-9 h-9 rounded-xl text-xs bg-slate-50 border-slate-200"
            />
          </div>

          {/* Type Filter Buttons */}
          <div className="flex items-center gap-1.5 overflow-x-auto w-full md:w-auto pb-1 md:pb-0">
            {[
              { id: 'all', label: 'All Holidays' },
              { id: 'public', label: 'Public' },
              { id: 'company', label: 'Company' },
              { id: 'restricted', label: 'Restricted' },
            ].map(f => (
              <button
                key={f.id}
                onClick={() => setFilterType(f.id as any)}
                className={`text-xs font-bold px-3 py-1.5 rounded-xl transition-all whitespace-nowrap ${
                  filterType === f.id
                    ? 'bg-slate-900 text-white shadow-sm'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                {f.label}
              </button>
            ))}
          </div>

          {/* View Toggle (List vs Calendar) */}
          <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl">
            <button
              onClick={() => setViewMode('list')}
              className={`p-1.5 rounded-lg text-xs font-bold flex items-center gap-1 transition-all ${
                viewMode === 'list' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-900'
              }`}
              title="Table List View"
            >
              <List className="w-4 h-4" />
              <span className="hidden sm:inline">List</span>
            </button>
            <button
              onClick={() => setViewMode('calendar')}
              className={`p-1.5 rounded-lg text-xs font-bold flex items-center gap-1 transition-all ${
                viewMode === 'calendar' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-900'
              }`}
              title="Month Grid View"
            >
              <LayoutGrid className="w-4 h-4" />
              <span className="hidden sm:inline">Months</span>
            </button>
          </div>
        </div>
      </Card>

      {/* 4. Main Content: List View or Month Grid View */}
      {loading ? (
        <Card className="border-0 shadow-sm rounded-2xl bg-white p-12 text-center">
          <Loader2 className="w-8 h-8 animate-spin text-indigo-600 mx-auto mb-3" />
          <p className="text-sm font-bold text-slate-600">Loading holidays for {selectedYear}...</p>
        </Card>
      ) : filteredHolidays.length === 0 ? (
        <Card className="border-0 shadow-sm rounded-2xl bg-white p-12 text-center">
          <div className="w-16 h-16 rounded-3xl bg-amber-50 text-amber-600 flex items-center justify-center mx-auto mb-4">
            <PartyPopper className="w-8 h-8" />
          </div>
          <h3 className="text-lg font-black text-slate-900">No Holidays Declared for {selectedYear}</h3>
          <p className="text-xs text-slate-500 max-w-md mx-auto mt-1 mb-6">
            There are currently no holidays declared for this company in {selectedYear}. You can manually declare custom holidays or quickly pre-populate standard public holidays.
          </p>
          <div className="flex items-center justify-center gap-3">
            <Button
              variant="outline"
              onClick={handleOpenImport}
              className="rounded-xl font-bold text-xs gap-1.5 border-amber-300 text-amber-800 bg-amber-50"
            >
              <Sparkles className="w-3.5 h-3.5" />
              Pre-populate Public Holidays
            </Button>
            <Button
              onClick={handleOpenDeclare}
              className="rounded-xl font-bold text-xs gap-1.5 bg-indigo-600 text-white"
            >
              <Plus className="w-4 h-4" />
              Declare Holiday
            </Button>
          </div>
        </Card>
      ) : viewMode === 'list' ? (
        /* TABLE LIST VIEW */
        <Card className="border-0 shadow-sm rounded-2xl bg-white overflow-hidden">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader className="bg-slate-50/80">
                <TableRow className="border-slate-100">
                  <TableHead className="font-bold text-xs text-slate-600">Date &amp; Day</TableHead>
                  <TableHead className="font-bold text-xs text-slate-600">Holiday Name</TableHead>
                  <TableHead className="font-bold text-xs text-slate-600">Type</TableHead>
                  <TableHead className="font-bold text-xs text-slate-600">Pay Status</TableHead>
                  <TableHead className="font-bold text-xs text-slate-600 text-right pr-6">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredHolidays.map((h) => {
                  const dateObj = parseISO(h.date);
                  const isPast = h.date < format(new Date(), 'yyyy-MM-dd');
                  return (
                    <TableRow key={h.id} className="border-slate-100 hover:bg-slate-50/50">
                      <TableCell className="font-bold text-slate-900 text-xs sm:text-sm py-3.5">
                        <div className="flex items-center gap-2">
                          <span className={isPast ? 'text-slate-500' : 'text-slate-900'}>
                            {format(dateObj, 'dd MMMM yyyy')}
                          </span>
                          <span className="text-xs text-slate-400 font-medium">
                            • {format(dateObj, 'EEEE')}
                          </span>
                        </div>
                      </TableCell>
                      <TableCell className="font-bold text-slate-900 text-xs sm:text-sm">
                        <div className="flex items-center gap-2">
                          <span>{h.name}</span>
                          {!isPast && (
                            <span className="text-[10px] font-bold text-indigo-600 bg-indigo-50 px-1.5 py-0.5 rounded">
                              Upcoming
                            </span>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        {h.holiday_type === 'public' && (
                          <Badge className="bg-amber-100 text-amber-800 border-0 text-xs font-bold">
                            Public Holiday
                          </Badge>
                        )}
                        {h.holiday_type === 'company' && (
                          <Badge className="bg-blue-100 text-blue-800 border-0 text-xs font-bold">
                            Company Holiday
                          </Badge>
                        )}
                        {h.holiday_type === 'restricted' && (
                          <Badge className="bg-purple-100 text-purple-800 border-0 text-xs font-bold">
                            Restricted / Optional
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell>
                        {h.is_paid ? (
                          <Badge className="bg-emerald-100 text-emerald-800 border-0 text-xs font-bold">
                            Paid Holiday
                          </Badge>
                        ) : (
                          <Badge className="bg-rose-100 text-rose-800 border-0 text-xs font-bold">
                            Unpaid
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell className="text-right pr-6">
                        <div className="flex items-center justify-end gap-1">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleOpenEdit(h)}
                            className="h-8 w-8 p-0 rounded-lg text-slate-600 hover:text-indigo-600 hover:bg-indigo-50"
                            title="Edit Holiday"
                          >
                            <Pencil className="w-3.5 h-3.5" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setDeletingHoliday(h)}
                            className="h-8 w-8 p-0 rounded-lg text-slate-600 hover:text-rose-600 hover:bg-rose-50"
                            title="Delete Holiday"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        </Card>
      ) : (
        /* MONTH GRID VIEW */
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {holidaysByMonth.map(m => (
            <Card key={m.monthNum} className="border-0 shadow-sm rounded-2xl bg-white overflow-hidden p-5 space-y-3">
              <div className="flex items-center justify-between border-b border-slate-100 pb-2.5">
                <h3 className="font-black text-slate-900 text-base flex items-center gap-2">
                  <Calendar className="w-4 h-4 text-indigo-600" />
                  {m.monthName} {selectedYear}
                </h3>
                <span className="text-xs font-extrabold text-slate-400">
                  {m.holidays.length} {m.holidays.length === 1 ? 'Day' : 'Days'}
                </span>
              </div>

              {m.holidays.length === 0 ? (
                <p className="text-xs text-slate-400 py-4 text-center font-medium">No holidays in this month</p>
              ) : (
                <div className="space-y-2">
                  {m.holidays.map(h => (
                    <div
                      key={h.id}
                      className="p-2.5 rounded-xl bg-slate-50 hover:bg-slate-100/80 transition-colors border border-slate-100 flex items-center justify-between"
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        <div className="w-9 h-9 rounded-xl bg-white border border-slate-200 text-center flex flex-col items-center justify-center font-black flex-shrink-0">
                          <span className="text-[10px] text-slate-400 uppercase leading-none">
                            {format(parseISO(h.date), 'EEE')}
                          </span>
                          <span className="text-xs text-slate-900 leading-none mt-0.5">
                            {parseISO(h.date).getDate()}
                          </span>
                        </div>
                        <div className="min-w-0">
                          <h4 className="text-xs font-bold text-slate-900 truncate">{h.name}</h4>
                          <div className="flex items-center gap-1.5 mt-0.5">
                            <span className="text-[10px] font-bold text-amber-700 capitalize">
                              {h.holiday_type}
                            </span>
                            <span className="text-slate-300">•</span>
                            <span className="text-[10px] font-bold text-emerald-700">
                              {h.is_paid ? 'Paid' : 'Unpaid'}
                            </span>
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-1 flex-shrink-0">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleOpenEdit(h)}
                          className="h-7 w-7 p-0 rounded-lg text-slate-500 hover:text-indigo-600 hover:bg-white"
                        >
                          <Pencil className="w-3 h-3" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setDeletingHoliday(h)}
                          className="h-7 w-7 p-0 rounded-lg text-slate-500 hover:text-rose-600 hover:bg-white"
                        >
                          <Trash2 className="w-3 h-3" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </Card>
          ))}
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL 1: DECLARE HOLIDAY                                                  */}
      {/* ========================================================================= */}
      <Dialog open={isDeclareOpen} onOpenChange={setIsDeclareOpen}>
        <DialogContent className="max-w-md rounded-3xl p-6 bg-white">
          <DialogHeader>
            <div className="w-10 h-10 rounded-2xl bg-indigo-50 text-indigo-600 flex items-center justify-center mb-2 font-bold">
              <PartyPopper className="w-5 h-5" />
            </div>
            <DialogTitle className="text-lg font-black text-slate-900">
              Declare Holiday
            </DialogTitle>
            <DialogDescription className="text-xs text-slate-500">
              Declare a new public or company holiday for attendance tracking and payroll processing.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleDeclareSubmit} className="space-y-4 pt-2">
            {/* Holiday Name */}
            <div className="space-y-1.5">
              <Label className="text-xs font-bold text-slate-700">Holiday Name *</Label>
              <Input
                value={declareName}
                onChange={(e) => setDeclareName(e.target.value)}
                placeholder="e.g. Eid Al Fitr, UAE National Day, Company Anniversary"
                className="h-10 rounded-xl text-xs"
                required
              />
            </div>

            {/* Date Mode: Single Day vs Date Range */}
            <div className="space-y-1.5">
              <Label className="text-xs font-bold text-slate-700">Duration Mode</Label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setDeclareMode('single')}
                  className={`h-9 rounded-xl text-xs font-bold border transition-all ${
                    declareMode === 'single'
                      ? 'bg-indigo-50 border-indigo-300 text-indigo-700 shadow-sm'
                      : 'border-slate-200 text-slate-600 hover:bg-slate-50'
                  }`}
                >
                  Single Day
                </button>
                <button
                  type="button"
                  onClick={() => setDeclareMode('range')}
                  className={`h-9 rounded-xl text-xs font-bold border transition-all ${
                    declareMode === 'range'
                      ? 'bg-indigo-50 border-indigo-300 text-indigo-700 shadow-sm'
                      : 'border-slate-200 text-slate-600 hover:bg-slate-50'
                  }`}
                >
                  Multi-Day Range
                </button>
              </div>
            </div>

            {/* Date Selection */}
            {declareMode === 'single' ? (
              <div className="space-y-1.5">
                <Label className="text-xs font-bold text-slate-700">Holiday Date *</Label>
                <DatePickerInput
                  value={declareDate}
                  onChange={(e) => setDeclareDate(e.target.value)}
                  placeholder="Select holiday date"
                  className="h-10 rounded-xl text-xs"
                />
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label className="text-xs font-bold text-slate-700">Start Date *</Label>
                  <DatePickerInput
                    value={declareStartDate}
                    onChange={(e) => setDeclareStartDate(e.target.value)}
                    placeholder="Start date"
                    className="h-10 rounded-xl text-xs"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs font-bold text-slate-700">End Date *</Label>
                  <DatePickerInput
                    value={declareEndDate}
                    onChange={(e) => setDeclareEndDate(e.target.value)}
                    placeholder="End date"
                    className="h-10 rounded-xl text-xs"
                  />
                </div>
              </div>
            )}

            {/* Holiday Type */}
            <div className="space-y-1.5">
              <Label className="text-xs font-bold text-slate-700">Holiday Type</Label>
              <Select value={declareType} onValueChange={(val: any) => setDeclareType(val)}>
                <SelectTrigger className="h-10 rounded-xl text-xs font-medium">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="public" className="text-xs">
                    Public / National Holiday
                  </SelectItem>
                  <SelectItem value="company" className="text-xs">
                    Company Observance Holiday
                  </SelectItem>
                  <SelectItem value="restricted" className="text-xs">
                    Restricted / Optional Holiday
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Paid Status */}
            <div className="flex items-center gap-2 pt-1">
              <Checkbox
                id="declare-is-paid"
                checked={declareIsPaid}
                onCheckedChange={(checked) => setDeclareIsPaid(Boolean(checked))}
              />
              <Label htmlFor="declare-is-paid" className="text-xs font-bold text-slate-700 cursor-pointer">
                Paid Holiday (exempt from salary deduction)
              </Label>
            </div>

            <DialogFooter className="pt-4 flex gap-2 sm:justify-end">
              <Button
                type="button"
                variant="outline"
                onClick={() => setIsDeclareOpen(false)}
                className="h-10 rounded-xl font-bold text-xs"
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={submittingDeclare}
                className="h-10 rounded-xl font-bold text-xs bg-indigo-600 hover:bg-indigo-700 text-white"
              >
                {submittingDeclare ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin mr-1.5" />
                    Declaring...
                  </>
                ) : (
                  'Declare Holiday'
                )}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* ========================================================================= */}
      {/* MODAL 2: EDIT HOLIDAY                                                     */}
      {/* ========================================================================= */}
      <Dialog open={!!editingHoliday} onOpenChange={() => setEditingHoliday(null)}>
        <DialogContent className="max-w-md rounded-3xl p-6 bg-white">
          <DialogHeader>
            <DialogTitle className="text-lg font-black text-slate-900">
              Edit Holiday
            </DialogTitle>
            <DialogDescription className="text-xs text-slate-500">
              Update holiday details for {editingHoliday?.name}.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleEditSubmit} className="space-y-4 pt-2">
            <div className="space-y-1.5">
              <Label className="text-xs font-bold text-slate-700">Holiday Name *</Label>
              <Input
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
                className="h-10 rounded-xl text-xs"
                required
              />
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-bold text-slate-700">Date *</Label>
              <DatePickerInput
                value={editDate}
                onChange={(e) => setEditDate(e.target.value)}
                className="h-10 rounded-xl text-xs"
              />
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-bold text-slate-700">Holiday Type</Label>
              <Select value={editType} onValueChange={(val: any) => setEditType(val)}>
                <SelectTrigger className="h-10 rounded-xl text-xs font-medium">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="public" className="text-xs">
                    Public / National Holiday
                  </SelectItem>
                  <SelectItem value="company" className="text-xs">
                    Company Observance Holiday
                  </SelectItem>
                  <SelectItem value="restricted" className="text-xs">
                    Restricted / Optional Holiday
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="flex items-center gap-2 pt-1">
              <Checkbox
                id="edit-is-paid"
                checked={editIsPaid}
                onCheckedChange={(checked) => setEditIsPaid(Boolean(checked))}
              />
              <Label htmlFor="edit-is-paid" className="text-xs font-bold text-slate-700 cursor-pointer">
                Paid Holiday
              </Label>
            </div>

            <DialogFooter className="pt-4 flex gap-2 sm:justify-end">
              <Button
                type="button"
                variant="outline"
                onClick={() => setEditingHoliday(null)}
                className="h-10 rounded-xl font-bold text-xs"
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={submittingEdit}
                className="h-10 rounded-xl font-bold text-xs bg-indigo-600 hover:bg-indigo-700 text-white"
              >
                {submittingEdit ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin mr-1.5" />
                    Saving...
                  </>
                ) : (
                  'Save Changes'
                )}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* ========================================================================= */}
      {/* MODAL 3: PRE-POPULATE / IMPORT STANDARD PUBLIC HOLIDAYS                  */}
      {/* ========================================================================= */}
      <Dialog open={isImportOpen} onOpenChange={setIsImportOpen}>
        <DialogContent className="max-w-xl rounded-3xl p-6 bg-white">
          <DialogHeader>
            <div className="w-10 h-10 rounded-2xl bg-amber-50 text-amber-600 flex items-center justify-center mb-2 font-bold">
              <Sparkles className="w-5 h-5" />
            </div>
            <DialogTitle className="text-lg font-black text-slate-900">
              Pre-populate Public Holidays ({selectedYear})
            </DialogTitle>
            <DialogDescription className="text-xs text-slate-500">
              Select standard national gazetted and Islamic holidays to automatically declare for {selectedYear}. Already declared dates will be skipped.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 pt-2">
            <div className="flex items-center justify-between border-b border-slate-100 pb-2">
              <span className="text-xs font-bold text-slate-600">
                {selectedStandardHolidays.length} of {(STANDARD_HOLIDAYS_BY_YEAR[selectedYear] || []).length} holidays selected
              </span>
              <div className="flex items-center gap-2">
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => setSelectedStandardHolidays(STANDARD_HOLIDAYS_BY_YEAR[selectedYear] || [])}
                  className="h-7 text-xs font-bold text-indigo-600 hover:bg-indigo-50"
                >
                  Select All
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => setSelectedStandardHolidays([])}
                  className="h-7 text-xs font-bold text-slate-500 hover:bg-slate-100"
                >
                  Deselect All
                </Button>
              </div>
            </div>

            <div className="max-h-72 overflow-y-auto space-y-2 pr-1">
              {(STANDARD_HOLIDAYS_BY_YEAR[selectedYear] || []).map((item) => {
                const isSelected = selectedStandardHolidays.some(h => h.date === item.date);
                const isAlreadyDeclared = holidays.some(h => h.date === item.date);

                return (
                  <div
                    key={item.date}
                    onClick={() => { if (!isAlreadyDeclared) handleToggleImportItem(item); }}
                    className={`p-3 rounded-xl border transition-all flex items-center justify-between ${
                      isAlreadyDeclared
                        ? 'bg-slate-50 border-slate-200 opacity-60 cursor-not-allowed'
                        : isSelected
                        ? 'bg-amber-50/60 border-amber-300 cursor-pointer shadow-sm'
                        : 'bg-white border-slate-200 hover:border-slate-300 cursor-pointer'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <Checkbox
                        checked={isSelected}
                        disabled={isAlreadyDeclared}
                        onCheckedChange={() => handleToggleImportItem(item)}
                      />
                      <div>
                        <h4 className="text-xs font-bold text-slate-900">{item.name}</h4>
                        <p className="text-[11px] text-slate-500">
                          {format(parseISO(item.date), 'EEEE, dd MMMM yyyy')}
                        </p>
                      </div>
                    </div>

                    <div>
                      {isAlreadyDeclared ? (
                        <Badge className="bg-slate-200 text-slate-600 border-0 text-[10px] font-bold">
                          Already Declared
                        </Badge>
                      ) : (
                        <Badge className="bg-amber-100 text-amber-800 border-0 text-[10px] font-bold">
                          Public
                        </Badge>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>

            <DialogFooter className="pt-4 flex gap-2 sm:justify-end">
              <Button
                type="button"
                variant="outline"
                onClick={() => setIsImportOpen(false)}
                className="h-10 rounded-xl font-bold text-xs"
              >
                Cancel
              </Button>
              <Button
                type="button"
                onClick={handleImportSubmit}
                disabled={submittingImport || selectedStandardHolidays.length === 0}
                className="h-10 rounded-xl font-bold text-xs bg-amber-600 hover:bg-amber-700 text-white"
              >
                {submittingImport ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin mr-1.5" />
                    Importing...
                  </>
                ) : (
                  `Import ${selectedStandardHolidays.length} Holidays`
                )}
              </Button>
            </DialogFooter>
          </div>
        </DialogContent>
      </Dialog>

      {/* ========================================================================= */}
      {/* ALERT 4: DELETE CONFIRMATION                                              */}
      {/* ========================================================================= */}
      <AlertDialog open={!!deletingHoliday} onOpenChange={() => setDeletingHoliday(null)}>
        <AlertDialogContent className="rounded-3xl p-6 bg-white max-w-md">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-base font-black text-slate-900 flex items-center gap-2">
              <AlertCircle className="w-5 h-5 text-rose-600" />
              Remove Declared Holiday?
            </AlertDialogTitle>
            <AlertDialogDescription className="text-xs text-slate-600 pt-1">
              Are you sure you want to remove <strong>&ldquo;{deletingHoliday?.name}&rdquo;</strong> on{' '}
              {deletingHoliday && format(parseISO(deletingHoliday.date), 'dd MMMM yyyy')}? This will update attendance calculations accordingly.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="pt-4 gap-2">
            <AlertDialogCancel className="h-9 rounded-xl font-bold text-xs">
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteSubmit}
              disabled={submittingDelete}
              className="h-9 rounded-xl font-bold text-xs bg-rose-600 hover:bg-rose-700 text-white"
            >
              {submittingDelete ? 'Deleting...' : 'Yes, Remove Holiday'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

