'use client';

import { useState, useEffect, useMemo } from 'react';
import { useCompany } from '@/components/providers/CompanyProvider';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command';
import {
  Combobox,
  ComboboxContent,
  ComboboxField,
  ComboboxInput,
  ComboboxItem,
  ComboboxTrigger,
} from '@/components/ui/combobox';
import { CalendarIcon, Copy, Link as LinkIcon, Plus, RefreshCw, Search, Download, Edit, Trash2, FileSpreadsheet, FileDown, Clock, TrendingUp, Users, User, X } from 'lucide-react';
import { toast } from 'sonner';
import { format, isWithinInterval, parseISO } from 'date-fns';
import {
  getTimesheets,
  getTimesheetStats,
  createTimesheet,
  updateTimesheet,
  deleteTimesheet,
  getProjects,
  createProject,
  updateProject,
  deleteProject,
  getActiveTimesheetLink,
  generateTimesheetLink,
  revokeTimesheetLink,
  exportTimesheetsCSV,
} from './actions';
import { useTimesheets, useProjects, useTimesheetStats } from '@/hooks/queries/useTimesheets';
import { useEmployees } from '@/hooks/queries/useEmployees';
import type { Timesheet, Project, DayType } from '@/types';
import { DayTypeLabels } from '@/lib/validations/schemas';

const dayTypeColors: Record<string, string> = {
  working_day: 'bg-emerald-100 text-emerald-700 border-emerald-200',
  working_holiday: 'bg-amber-100 text-amber-700 border-amber-200',
  absent: 'bg-red-100 text-red-700 border-red-200',
};

export default function TimesheetsDashboard() {
  const { activeCompanyId, profile } = useCompany();

  // State
  const [activeTab, setActiveTab] = useState<'submissions' | 'projects' | 'reports-link'>('submissions');
  const [link, setLink] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  // Filter state
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [employeeSearchOpen, setEmployeeSearchOpen] = useState(false);
  const [selectedEmployeeId, setSelectedEmployeeId] = useState<string | null>(null);
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null);
  const [selectedDayType, setSelectedDayType] = useState<string | null>('all');
  const [searchQuery, setSearchQuery] = useState('');

  // Modal state
  const [dialogOpen, setDialogOpen] = useState(false);
  const [projectDialogOpen, setProjectDialogOpen] = useState(false);
  const [editingTimesheet, setEditingTimesheet] = useState<Timesheet | null>(null);
  const [editingProject, setEditingProject] = useState<Project | null>(null);

  // Form state
  const [form, setForm] = useState({
    employee_id: '',
    project_id: '',
    date: '',
    day_type: 'working_day' as DayType,
    hours_worked: 8,
    overtime_hours: 0,
    reason: '',
  });
  const [formEmployeeSearchQuery, setFormEmployeeSearchQuery] = useState('');
  const [formEmployeeId, setFormEmployeeId] = useState<string>('');
  const [projectForm, setProjectForm] = useState({ name: '', description: '', email: '', status: 'active' as 'active' | 'completed' | 'on_hold' });

  const employeesQuery = useEmployees({ companyId: activeCompanyId || '', statuses: ['active'] });
  const timesheetsQuery = useTimesheets({
    companyId: activeCompanyId || '',
    employeeId: selectedEmployeeId || undefined,
    projectId: selectedProjectId || undefined,
    dayType: selectedDayType === 'all' || selectedDayType === null ? undefined : (selectedDayType as 'working_day' | 'working_holiday' | 'absent'),
    dateFrom: dateFrom || undefined,
    dateTo: dateTo || undefined,
  });
  const projectsQuery = useProjects(activeCompanyId || '');
  const statsQuery = useTimesheetStats(activeCompanyId || '');

  // Derived data
  const employees = useMemo(() => {
    return employeesQuery.data || [];
  }, [employeesQuery.data]);

  const timesheets = timesheetsQuery.data || [];
  const projects = projectsQuery.data || [];
  const stats = statsQuery.data;

  // Load link on mount
  useEffect(() => {
    if (activeCompanyId) {
      loadLink();
      setLoading(false);
    }
  }, [activeCompanyId]);

  const loadLink = async () => {
    try {
      const linkData = await getActiveTimesheetLink(activeCompanyId!);
      setLink(linkData);
    } catch (e) {
      console.error('Failed to load link:', e);
    }
  };

  const handleGenerateLink = async () => {
    try {
      const newLink = await generateTimesheetLink(activeCompanyId!);
      setLink(newLink);
      toast.success('New public link generated');
    } catch (e: any) {
      toast.error(e.message || 'Failed to generate link');
    }
  };

  const handleCopyLink = () => {
    if (!link) return;
    const url = `${window.location.origin}/timesheet/${link.token}`;
    navigator.clipboard.writeText(url);
    toast.success('Link copied to clipboard');
  };

  const handleRevokeLink = async () => {
    try {
      await revokeTimesheetLink(activeCompanyId!);
      setLink(null);
      toast.success('Link revoked');
    } catch (e: any) {
      toast.error(e.message || 'Failed to revoke link');
    }
  };

  // Filtered timesheets for search within table
  const filteredTimesheets = useMemo(() => {
    if (!searchQuery) return timesheets;
    const q = searchQuery.toLowerCase();
    return timesheets.filter((ts) => {
      const empName = ts.employees?.name_en?.toLowerCase() || '';
      const empCode = ts.employees?.emp_code?.toLowerCase() || '';
      const projName = ts.projects?.name?.toLowerCase() || '';
      const reason = ts.reason?.toLowerCase() || '';
      return empName.includes(q) || empCode.includes(q) || projName.includes(q) || reason.includes(q);
    });
  }, [timesheets, searchQuery]);

  // Modal handlers
  const openNewTimesheet = () => {
    setEditingTimesheet(null);
    setForm({
      employee_id: '',
      project_id: '',
      date: new Date().toISOString().split('T')[0],
      day_type: 'working_day',
      hours_worked: 8,
      overtime_hours: 0,
      reason: '',
    });
    setFormEmployeeId('');
    setFormEmployeeSearchQuery('');
    setDialogOpen(true);
  };

  const openEditTimesheet = (ts: Timesheet) => {
    setEditingTimesheet(ts);
    setForm({
      employee_id: ts.employee_id,
      project_id: ts.project_id || '',
      date: ts.date,
      day_type: ts.day_type,
      hours_worked: ts.day_type === 'absent' ? 0 : ts.hours_worked,
      overtime_hours: ts.overtime_hours || 0,
      reason: ts.reason || '',
    });
    setFormEmployeeId(ts.employee_id);
    setFormEmployeeSearchQuery('');
    setDialogOpen(true);
  };

  const handleSaveTimesheet = async () => {
    // Validation
    if (!formEmployeeId) {
      toast.error('Please select an employee');
      return;
    }
    if (!form.project_id) {
      toast.error('Please select a project');
      return;
    }
    if (!form.date) {
      toast.error('Please select a date');
      return;
    }

    const payload = {
      ...form,
      employee_id: formEmployeeId,
    };

    try {
      if (editingTimesheet) {
        await updateTimesheet(editingTimesheet.id, payload);
      } else {
        await createTimesheet(payload);
      }
      setDialogOpen(false);
    } catch (e: any) {
      toast.error(e.message);
    }
  };

  const handleDeleteTimesheet = async (id: string) => {
    if (!confirm('Delete this timesheet entry?')) return;
    try {
      await deleteTimesheet(id);
    } catch (e: any) {
      toast.error(e.message);
    }
  };

  // Project handlers
  const openNewProject = () => {
    setEditingProject(null);
    setProjectForm({ name: '', description: '', email: '', status: 'active' });
    setProjectDialogOpen(true);
  };

  const openEditProject = (proj: Project) => {
    setEditingProject(proj);
    setProjectForm({ name: proj.name, description: proj.description, email: proj.email || '', status: proj.status });
    setProjectDialogOpen(true);
  };

  const handleSaveProject = async () => {
    try {
      if (editingProject) {
        await updateProject(editingProject.id, {
          name: projectForm.name,
          description: projectForm.description,
          status: projectForm.status,
          email: projectForm.email
        });
      } else {
        await createProject(activeCompanyId!, projectForm.name, projectForm.description, projectForm.email);
      }
      setProjectDialogOpen(false);
    } catch (e: any) {
      toast.error(e.message);
    }
  };

  const handleDeleteProject = async (id: string) => {
    if (!confirm('Delete this project? Cannot delete if timesheets reference it.')) return;
    try {
      await deleteProject(id);
    } catch (e: any) {
      toast.error(e.message);
    }
  };

  // CSV Export
  const handleExportCSV = async () => {
    try {
      const csv = await exportTimesheetsCSV(activeCompanyId!, {
        employeeId: selectedEmployeeId || undefined,
        projectId: selectedProjectId || undefined,
        dayType: selectedDayType === 'all' || selectedDayType === null ? undefined : selectedDayType,
        dateFrom: dateFrom || undefined,
        dateTo: dateTo || undefined,
      });
      const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `timesheets-${format(new Date(), 'yyyy-MM-dd')}.csv`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success('Export completed');
    } catch (e: any) {
      toast.error(e.message || 'Export failed');
    }
  };

  if (loading) {
    return <div className="p-8 text-center text-muted-foreground animate-pulse">Loading Timesheets...</div>;
  }

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Timesheet Module</h1>
          <p className="text-muted-foreground text-sm">Manage projects, public links, and view timesheet entries</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => window.open('/dashboard/timesheets/reports', '_blank')} className="gap-2">
            <FileSpreadsheet className="w-4 h-4" /> View Reports
          </Button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 border-b">
        <button
          onClick={() => setActiveTab('submissions')}
          className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
            activeTab === 'submissions'
              ? 'border-primary text-primary'
              : 'border-transparent text-muted-foreground hover:text-foreground'
          }`}
        >
          Timesheet Entries
        </button>
        <button
          onClick={() => setActiveTab('projects')}
          className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
            activeTab === 'projects'
              ? 'border-primary text-primary'
              : 'border-transparent text-muted-foreground hover:text-foreground'
          }`}
        >
          Projects
        </button>
        <button
          onClick={() => setActiveTab('reports-link')}
          className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
            activeTab === 'reports-link'
              ? 'border-primary text-primary'
              : 'border-transparent text-muted-foreground hover:text-foreground'
          }`}
        >
          Public Link
        </button>
      </div>

      {/* ===== TIMESHEET ENTRIES TAB ===== */}
      {activeTab === 'submissions' && (
        <div className="space-y-4">
          {/* Summary Stats */}
          {stats && (
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
              <Card className="border-0 shadow-sm">
                <CardContent className="p-4">
                  <div className="flex items-center gap-2">
                    <FileDown className="w-4 h-4 text-blue-500" />
                    <div><p className="text-xs text-muted-foreground">Total Entries</p><p className="text-lg font-bold">{stats.totalEntries}</p></div>
                  </div>
                </CardContent>
              </Card>
              <Card className="border-0 shadow-sm">
                <CardContent className="p-4">
                  <div className="flex items-center gap-2">
                    <Clock className="w-4 h-4 text-emerald-500" />
                    <div><p className="text-xs text-muted-foreground">Total Hours</p><p className="text-lg font-bold">{stats.totalHours.toFixed(1)}h</p></div>
                  </div>
                </CardContent>
              </Card>
              <Card className="border-0 shadow-sm">
                <CardContent className="p-4">
                  <div className="flex items-center gap-2">
                    <TrendingUp className="w-4 h-4 text-amber-500" />
                    <div><p className="text-xs text-muted-foreground">Overtime</p><p className="text-lg font-bold">{stats.overtimeHours.toFixed(1)}h</p></div>
                  </div>
                </CardContent>
              </Card>
              <Card className="border-0 shadow-sm">
                <CardContent className="p-4">
                  <div className="flex items-center gap-2">
                    <Users className="w-4 h-4 text-purple-500" />
                    <div><p className="text-xs text-muted-foreground">Working Days</p><p className="text-lg font-bold">{stats.workingDays}</p></div>
                  </div>
                </CardContent>
              </Card>
              <Card className="border-0 shadow-sm">
                <CardContent className="p-4">
                  <div className="flex items-center gap-2">
                    <CalendarIcon className="w-4 h-4 text-cyan-500" />
                    <div><p className="text-xs text-muted-foreground">Holidays</p><p className="text-lg font-bold">{stats.workingHolidays}</p></div>
                  </div>
                </CardContent>
              </Card>
              <Card className="border-0 shadow-sm">
                <CardContent className="p-4">
                  <div className="flex items-center gap-2">
                    <FileDown className="w-4 h-4 text-red-500" />
                    <div><p className="text-xs text-muted-foreground">Absent</p><p className="text-lg font-bold">{stats.absentDays}</p></div>
                  </div>
                </CardContent>
              </Card>
            </div>
          )}

          {/* Filters */}
          <Card className="border-0 shadow-sm">
            <CardHeader className="pb-3 border-b">
              <div className="flex flex-col lg:flex-row lg:items-center gap-3">
                {/* Search */}
                <div className="relative flex-1 min-w-[200px]">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input
                    placeholder="Search employee name, code, project, reason..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-9"
                  />
                </div>

                {/* Date Range */}
                <div className="flex items-center gap-2">
                  <Label className="text-xs text-muted-foreground whitespace-nowrap">From:</Label>
                  <Input
                    type="date"
                    value={dateFrom}
                    onChange={(e) => setDateFrom(e.target.value)}
                    className="w-[140px]"
                  />
                </div>
                <div className="flex items-center gap-2">
                  <Label className="text-xs text-muted-foreground whitespace-nowrap">To:</Label>
                  <Input
                    type="date"
                    value={dateTo}
                    onChange={(e) => setDateTo(e.target.value)}
                    className="w-[140px]"
                  />
                </div>

                {/* Employee Filter */}
                <Popover open={employeeSearchOpen} onOpenChange={setEmployeeSearchOpen}>
                  <PopoverTrigger asChild>
                    <Button variant="outline" size="sm" className="h-9">
                      {selectedEmployeeId ? (
                        <>
                          {employees.find((e) => e.id === selectedEmployeeId)?.name_en}
                          <button
                            type="button"
                            onClick={(e) => { e.stopPropagation(); setSelectedEmployeeId(null); }}
                            className="ml-1 hover:text-red-500"
                          >
                            ×
                          </button>
                        </>
                      ) : (
                        'All Employees'
                      )}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-full max-w-[280px] p-0" align="start">
                    <Command>
                      <CommandInput placeholder="Search employee..." />
                      <CommandList>
                        <CommandEmpty>No employee found.</CommandEmpty>
                        <CommandGroup>
                          <CommandItem
                            value="all"
                            onSelect={() => { setSelectedEmployeeId(null); setEmployeeSearchOpen(false); }}
                          >
                            All Employees
                          </CommandItem>
                          {employees.map((emp) => (
                            <CommandItem
                              key={emp.id}
                              value={emp.name_en}
                              onSelect={() => { setSelectedEmployeeId(emp.id); setEmployeeSearchOpen(false); }}
                            >
                              {emp.name_en} ({emp.emp_code})
                            </CommandItem>
                          ))}
                        </CommandGroup>
                      </CommandList>
                    </Command>
                  </PopoverContent>
                </Popover>

                {/* Project Filter */}
                <Select
                  value={selectedProjectId || ''}
                  onValueChange={(v) => setSelectedProjectId(v || null)}
                >
                  <SelectTrigger className="w-[180px] h-9">
                    <SelectValue placeholder="All Projects" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="">All Projects</SelectItem>
                    {projects.map((p) => (
                      <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                {/* Day Type Filter */}
                <Select
                  value={selectedDayType}
                  onValueChange={(v) => setSelectedDayType(v)}
                >
                  <SelectTrigger className="w-[140px] h-9">
                    <SelectValue placeholder="All Types" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Types</SelectItem>
                    <SelectItem value="working_day">Working Day</SelectItem>
                    <SelectItem value="working_holiday">Working Holiday</SelectItem>
                    <SelectItem value="absent">Absent</SelectItem>
                  </SelectContent>
                </Select>

                {/* Clear Filters */}
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setDateFrom('');
                    setDateTo('');
                    setSelectedEmployeeId(null);
                    setSelectedProjectId(null);
                    setSelectedDayType('all');
                    setSearchQuery('');
                  }}
                  className="h-9"
                >
                  Clear
                </Button>

                {/* Export */}
                <Button variant="outline" size="sm" onClick={handleExportCSV} className="h-9 gap-2">
                  <Download className="w-4 h-4" /> Export CSV
                </Button>

                {/* Add New */}
                <Button size="sm" onClick={openNewTimesheet} className="h-9 gap-2">
                  <Plus className="w-4 h-4" /> Add Entry
                </Button>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              {timesheetsQuery.isLoading ? (
                <div className="p-12 text-center text-muted-foreground animate-pulse">Loading...</div>
              ) : filteredTimesheets.length === 0 ? (
                <div className="p-12 text-center text-muted-foreground">
                  <FileDown className="w-12 h-12 mx-auto mb-3 opacity-30" />
                  <p>No timesheets found</p>
                  <p className="text-sm">Try adjusting filters or add a new entry</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Date</TableHead>
                        <TableHead>Employee</TableHead>
                        <TableHead>Project</TableHead>
                        <TableHead>Day Type</TableHead>
                        <TableHead className="text-right">Regular</TableHead>
                        <TableHead className="text-right">OT</TableHead>
                        <TableHead>Reason</TableHead>
                        <TableHead className="text-right">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredTimesheets.map((ts) => (
                        <TableRow key={ts.id}>
                          <TableCell className="font-mono text-sm">{ts.date}</TableCell>
                          <TableCell>
                            <div className="flex flex-col">
                              <span className="font-medium text-sm">{ts.employees?.name_en || 'Unknown'}</span>
                              <span className="text-xs text-muted-foreground">{ts.employees?.emp_code}</span>
                            </div>
                          </TableCell>
                          <TableCell>{ts.projects?.name || '-'}</TableCell>
                          <TableCell>
                            <Badge
                              variant="outline"
                              className={`${dayTypeColors[ts.day_type]} border-0 text-xs font-medium`}
                            >
                              {DayTypeLabels[ts.day_type] || ts.day_type}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-right font-mono">{ts.hours_worked}</TableCell>
                          <TableCell className="text-right font-mono text-muted-foreground">
                            {Number(ts.overtime_hours || 0) > 0 ? ts.overtime_hours : '-'}
                          </TableCell>
                          <TableCell className="max-w-[200px] truncate text-xs text-muted-foreground">
                            {ts.reason || '-'}
                          </TableCell>
                          <TableCell className="text-right">
                            <div className="flex items-center justify-end gap-1">
                              <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openEditTimesheet(ts)}>
                                <Edit className="w-3.5 h-3.5" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8 text-destructive hover:text-destructive hover:bg-destructive/10"
                                onClick={() => handleDeleteTimesheet(ts.id)}
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      )}

      {/* ===== PROJECTS TAB ===== */}
      {activeTab === 'projects' && (
        <div className="space-y-4">
          <Card className="border-0 shadow-sm">
            <CardHeader className="pb-3 border-b">
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>Projects</CardTitle>
                  <CardDescription>Manage projects for timesheet assignments</CardDescription>
                </div>
                <Button onClick={openNewProject} className="gap-2">
                  <Plus className="w-4 h-4" /> Add Project
                </Button>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              {projectsQuery.isLoading ? (
                <div className="p-12 text-center text-muted-foreground animate-pulse">Loading...</div>
              ) : projects.length === 0 ? (
                <div className="p-12 text-center text-muted-foreground">
                  <p>No projects yet</p>
                  <Button onClick={openNewProject} variant="outline" className="mt-4">
                    Create your first project
                  </Button>
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Name</TableHead>
                      <TableHead>Description</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {projects.map((proj) => (
                      <TableRow key={proj.id}>
                        <TableCell className="font-medium">{proj.name}</TableCell>
                        <TableCell className="text-sm text-muted-foreground max-w-[300px] truncate">
                          {proj.description || '-'}
                        </TableCell>
                        <TableCell>
                          <Badge variant={proj.status === 'active' ? 'default' : 'secondary'}>
                            {proj.status}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex items-center justify-end gap-1">
                            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openEditProject(proj)}>
                              <Edit className="w-3.5 h-3.5" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8 text-destructive hover:text-destructive hover:bg-destructive/10"
                              onClick={() => handleDeleteProject(proj.id)}
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </div>
      )}

      {/* ===== PUBLIC LINK TAB ===== */}
      {activeTab === 'reports-link' && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Public Link Card - HR/Admin only */}
          {['super_admin', 'company_admin', 'hr'].includes(profile?.role || '') ? (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <LinkIcon className="w-5 h-5 text-blue-500" /> Public Submission Link
                </CardTitle>
                <CardDescription>
                  Generate a single public link for the company. Any user with the link can submit timesheets for any direct employee.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {link ? (
                  <div className="space-y-3">
                    <div className="p-3 bg-muted rounded-md">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-xs font-semibold text-muted-foreground">ACTIVE LINK</span>
                        <Badge variant="outline" className="text-xs">Active</Badge>
                      </div>
                      <div className="flex items-center gap-2 mb-2">
                        <span className="text-sm font-mono truncate">
                          {window.location.origin}/timesheet/{link.token}
                        </span>
                        <Button size="icon" variant="ghost" onClick={handleCopyLink}>
                          <Copy className="w-4 h-4" />
                        </Button>
                      </div>
                      <div className="text-xs text-muted-foreground">
                        <p>Company-wide link — any authenticated user at this company can use it</p>
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <Button variant="outline" className="flex-1 gap-2" onClick={handleGenerateLink}>
                        <RefreshCw className="w-4 h-4" /> Regenerate Token
                      </Button>
                      <Button variant="destructive" size="icon" onClick={handleRevokeLink} title="Revoke access">
                        Revoke
                      </Button>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      A new link will be generated. Previous links remain active.
                    </p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    <p className="text-sm text-muted-foreground">
                      Generate a new public submission link for this company. Any user with the link can submit timesheets.
                    </p>

                    <Button onClick={handleGenerateLink} className="gap-2 w-full">
                      <Plus className="w-4 h-4" /> Generate Public Link
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>
          ) : (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <LinkIcon className="w-5 h-5 text-blue-500" /> Public Submission Link
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground">
                  Only HR and administrators can generate public submission links.
                </p>
              </CardContent>
            </Card>
          )}

          {/* Usage Info Card */}
          <Card>
            <CardHeader>
              <CardTitle>How It Works</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm text-muted-foreground">
              <div className="flex items-start gap-3">
                <div className="w-6 h-6 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center text-xs font-bold shrink-0">1</div>
                <p>Generate a single public link for the company. Share it with authorized personnel.</p>
              </div>
              <div className="flex items-start gap-3">
                <div className="w-6 h-6 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center text-xs font-bold shrink-0">2</div>
                <p>Any user with the link can submit timesheets for any direct employee at the company.</p>
              </div>
              <div className="flex items-start gap-3">
                <div className="w-6 h-6 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center text-xs font-bold shrink-0">3</div>
                <p>Each employee can have one entry per day. Duplicate submissions are blocked.</p>
              </div>
              <div className="flex items-start gap-3">
                <div className="w-6 h-6 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center text-xs font-bold shrink-0">4</div>
                <p>Submissions appear instantly in this dashboard under "Timesheet Entries".</p>
              </div>
              <div className="flex items-start gap-3">
                <div className="w-6 h-6 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center text-xs font-bold shrink-0">5</div>
                <p>Use the "Timesheet Reports" page to analyze project costs, overtime, and absences.</p>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* ===== TIMESHEET EDIT MODAL ===== */}
      <Dialog open={dialogOpen} onOpenChange={(open) => {
        if (!open) {
          setFormEmployeeId('');
          setFormEmployeeSearchQuery('');
        }
        setDialogOpen(open);
      }}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>{editingTimesheet ? 'Edit Timesheet' : 'Add Timesheet Entry'}</DialogTitle>
            <DialogDescription>
              {editingTimesheet ? 'Update the timesheet details' : 'Record a new timesheet entry for an employee'}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            {/* Employee */}
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Employee *</Label>
              <Combobox
                value={formEmployeeId}
                onValueChange={(value) => {
                  setFormEmployeeId(value || '');
                  setFormEmployeeSearchQuery('');
                }}
                itemToStringLabel={(itemValue) => {
                  const emp = employees.find(e => e.id === itemValue);
                  return emp ? `${emp.name_en} (${emp.emp_code})` : '';
                }}
              >
                <ComboboxField className="relative">
                  <div className="absolute left-3 top-1/2 -translate-y-1/2 z-10 pointer-events-none">
                    <Search className="h-4 w-4 text-muted-foreground" />
                  </div>
                  <ComboboxInput
                    placeholder="Search employee by name or code..."
                    className="pl-10"
                    onChange={(e) => setFormEmployeeSearchQuery(e.target.value)}
                  />
                  <ComboboxTrigger hasValue={!!formEmployeeId} onClear={() => {
                    setFormEmployeeId('');
                    setFormEmployeeSearchQuery('');
                  }} />
                </ComboboxField>
                <ComboboxContent>
                  <div className="py-2">
                    {employees
                      .filter(emp => {
                        const query = formEmployeeSearchQuery || '';
                        if (!query.trim()) return true;
                        const search = query.toLowerCase();
                        return (
                          (emp.name_en || '').toLowerCase().includes(search) ||
                          (emp.emp_code || '').toLowerCase().includes(search)
                        );
                      })
                      .map(emp => (
                        <ComboboxItem key={emp.id} value={emp.id} className="flex items-center gap-3">
                          <div className="h-8 w-8 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-white text-xs font-medium shrink-0">
                            {emp.name_en?.charAt(0) || '?'}
                          </div>
                          <div className="flex flex-col min-w-0">
                            <span className="font-medium truncate">{emp.name_en}</span>
                            <span className="text-xs text-muted-foreground truncate">{emp.emp_code}</span>
                          </div>
                        </ComboboxItem>
                      ))}
                    {employees.length === 0 && (
                      <div className="px-3 py-8 text-center text-muted-foreground">
                        <User className="h-8 w-8 mx-auto mb-2 text-muted-foreground/50" />
                        <p className="text-sm">No employees found</p>
                      </div>
                    )}
                  </div>
                </ComboboxContent>
              </Combobox>
              {form.employee_id && !formEmployeeId && (
                <p className="text-xs text-muted-foreground mt-1">
                  Selected: {employees.find(e => e.id === form.employee_id)?.name_en || 'Unknown employee'}
                </p>
              )}
            </div>

            {/* Date */}
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Date *</Label>
              <Input
                type="date"
                value={form.date}
                onChange={(e) => setForm({ ...form, date: e.target.value })}
                max={new Date().toISOString().split('T')[0]}
              />
            </div>

            {/* Day Type */}
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Day Type *</Label>
              <div className="flex flex-wrap gap-4">
                {(['working_day', 'working_holiday', 'absent'] as DayType[]).map((dt) => (
                  <label key={dt} className="flex items-center space-x-2">
                    <input
                      type="radio"
                      name="day_type"
                      value={dt}
                      checked={form.day_type === dt}
                      onChange={() => {
                        const newForm = { ...form, day_type: dt };
                        if (dt === 'absent') {
                          newForm.hours_worked = 0;
                          newForm.overtime_hours = 0;
                        }
                        setForm(newForm);
                      }}
                      className="h-4 w-4 text-blue-600"
                    />
                    <span className="text-sm">{DayTypeLabels[dt]}</span>
                  </label>
                ))}
              </div>
            </div>

            {/* Hours & Project (if not absent) */}
            {form.day_type !== 'absent' && (
              <>
                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Regular Hours *</Label>
                  <div className="flex flex-wrap gap-4">
                    <label className="flex items-center space-x-2">
                      <input
                        type="radio"
                        name="hours_worked"
                        value="8"
                        checked={form.hours_worked === 8}
                        onChange={() => setForm({ ...form, hours_worked: 8 })}
                        className="h-4 w-4 text-blue-600"
                      />
                      <span className="text-sm">8 Hours (Full-day)</span>
                    </label>
                    <label className="flex items-center space-x-2">
                      <input
                        type="radio"
                        name="hours_worked"
                        value="4"
                        checked={form.hours_worked === 4}
                        onChange={() => setForm({ ...form, hours_worked: 4 })}
                        className="h-4 w-4 text-blue-600"
                      />
                      <span className="text-sm">4 Hours (Half-day)</span>
                    </label>
                    <label className="flex items-center space-x-2">
                      <input
                        type="radio"
                        name="hours_worked"
                        value="custom"
                        checked={typeof form.hours_worked === 'number' && form.hours_worked !== 8 && form.hours_worked !== 4}
                        onChange={() => setForm({ ...form, hours_worked: 0 })}
                        className="h-4 w-4 text-blue-600"
                      />
                      <span className="text-sm">Custom Regular</span>
                    </label>
                  </div>
                  {(typeof form.hours_worked === 'number' && form.hours_worked !== 8 && form.hours_worked !== 4) && (
                    <div className="mt-2">
                      <Input
                        type="number"
                        step="0.5"
                        min="0.5"
                        max="8"
                        value={form.hours_worked === 0 ? '' : form.hours_worked}
                        onChange={(e) => setForm({ ...form, hours_worked: parseFloat(e.target.value) || 0 })}
                        placeholder="Regular hours (max 8)"
                      />
                    </div>
                  )}
                </div>

                {/* Overtime Hours */}
                <div className="space-y-1.5 pt-3 border-t">
                  <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    Overtime Hours <span className="text-muted-foreground text-xs">(optional)</span>
                  </Label>
                  <Input
                    type="number"
                    step="0.5"
                    min="0"
                    max="16"
                    value={form.overtime_hours}
                    onChange={(e) => setForm({ ...form, overtime_hours: parseFloat(e.target.value) || 0 })}
                    placeholder="0"
                  />
                  <p className="text-xs text-muted-foreground">
                    Hours worked beyond regular shift. Reason is required if overtime is recorded.
                  </p>
                </div>

                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Project *</Label>
                  <select
                    value={form.project_id}
                    onChange={(e) => setForm({ ...form, project_id: e.target.value })}
                    className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                  >
                    <option value="">Select project</option>
                    {projects.map((p) => (
                      <option key={p.id} value={p.id}>{p.name}</option>
                    ))}
                  </select>
                </div>
              </>
            )}

            {/* Reason */}
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Reason / Justification
                {(form.day_type === 'absent' || form.overtime_hours > 0) && (
                  <span className="text-red-500 ml-1">*</span>
                )}
              </Label>
              <textarea
                rows={3}
                value={form.reason}
                onChange={(e) => setForm({ ...form, reason: e.target.value })}
                placeholder={
                  form.day_type === 'absent' || form.overtime_hours > 0
                    ? 'Reason required...'
                    : 'Optional notes...'
                }
                className="flex min-h-[80px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              />
            </div>
          </div>

          <DialogFooter className="flex flex-col-reverse sm:flex-row gap-2 sm:gap-0">
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
            <Button onClick={handleSaveTimesheet}>
              {editingTimesheet ? 'Update' : 'Create'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ===== PROJECT EDIT MODAL ===== */}
      <Dialog open={projectDialogOpen} onOpenChange={setProjectDialogOpen}>
        <DialogContent className="sm:max-w-[400px]">
          <DialogHeader>
            <DialogTitle>{editingProject ? 'Edit Project' : 'Add Project'}</DialogTitle>
            <DialogDescription>
              {editingProject ? 'Update project details' : 'Create a new project for timesheet assignments'}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="space-y-1.5">
              <Label>Name *</Label>
              <Input value={projectForm.name} onChange={(e) => setProjectForm({ ...projectForm, name: e.target.value })} />
            </div>
            <div className="space-y-1.5">
              <Label>Description</Label>
              <Input value={projectForm.description} onChange={(e) => setProjectForm({ ...projectForm, description: e.target.value })} />
            </div>
            <div className="space-y-1.5">
              <Label>Email (for daily reports)</Label>
              <Input
                type="email"
                placeholder="project-email@example.com"
                value={projectForm.email}
                onChange={(e) => setProjectForm({ ...projectForm, email: e.target.value })}
              />
              <p className="text-xs text-muted-foreground">
                Daily timesheet reports will be sent to this email at 11:59 PM
              </p>
            </div>
            <div className="space-y-1.5">
              <Label>Status</Label>
              <select
                value={projectForm.status}
                onChange={(e) => setProjectForm({ ...projectForm, status: e.target.value as any })}
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              >
                <option value="active">Active</option>
                <option value="on_hold">On Hold</option>
                <option value="completed">Completed</option>
              </select>
            </div>
          </div>

          <DialogFooter className="flex flex-col-reverse sm:flex-row gap-2 sm:gap-0">
            <Button variant="outline" onClick={() => setProjectDialogOpen(false)}>Cancel</Button>
            <Button onClick={handleSaveProject}>{editingProject ? 'Update' : 'Create'}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

    </div>
  );
}
