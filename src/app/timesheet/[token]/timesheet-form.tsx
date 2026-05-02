'use client';

import { useState, useEffect } from 'react';
import { useForm, UseFormReturn } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { toast } from 'sonner';
import { submitTimesheet, type SubmitTimesheetResponse } from './actions';
import { timesheetSubmitSchema, type DayType } from '@/lib/validations/schemas';
import { type Timesheet, type Company } from '@/types';
import { downloadTimesheetConfirmationPDF } from '@/lib/pdf-utils';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Loader2, AlertCircle, Clock, Building2, User, Calendar as CalendarIcon, FileText, Search, X, Download } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Combobox,
  ComboboxContent,
  ComboboxField,
  ComboboxInput,
  ComboboxItem,
  ComboboxTrigger,
  ComboboxValue,
} from '@/components/ui/combobox';
import type { z } from 'zod';

// Form data includes token (not in base schema)
interface FormDataWithToken {
  employee_id: string;
  project_id: string;
  date: string;
  day_type: DayType;
  hours_worked: number;
  overtime_hours: number;
  reason: string;
  token: string;
}

interface TimesheetFormProps {
  token: string;
  employees: Array<{ id: string; name_en: string; emp_code: string }>;
  projects: Array<{ id: string; name: string }>;
}

export function TimesheetForm({ token, employees, projects }: TimesheetFormProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);
  const [pendingData, setPendingData] = useState<FormDataWithToken | null>(null);
  const [submittedTimesheet, setSubmittedTimesheet] = useState<Timesheet & {
    employees: { name_en: string; emp_code: string; basic_salary: number; gross_salary: number };
    projects: { name: string } | null;
  } | null>(null);
  const [submittedCompany, setSubmittedCompany] = useState<Company | null>(null);
  const [employeeSearchQuery, setEmployeeSearchQuery] = useState('');
  const [selectedEmployeeId, setSelectedEmployeeId] = useState<string>('');

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    formState: { errors },
  } = useForm<FormDataWithToken>({
    // @ts-expect-error - Zod v4 type inference compatibility with token field
    resolver: zodResolver(timesheetSubmitSchema),
    defaultValues: {
      token,
      date: new Date().toISOString().split('T')[0],
      day_type: 'working_day' as DayType,
      hours_worked: 8,
      overtime_hours: 0,
      reason: '',
      employee_id: '',
      project_id: '',
    },
  });

  const dayType = watch('day_type');
  const hoursWorked = watch('hours_worked');
  const overtimeHours = watch('overtime_hours');
  const requiresReason = dayType === 'absent' || (typeof overtimeHours === 'number' && overtimeHours > 0);
  const employeeId = watch('employee_id');

  // Auto-reset hours and set defaults based on day type
  useEffect(() => {
    if (dayType === 'absent') {
      setValue('hours_worked', 0);
      setValue('overtime_hours', 0);
      setValue('reason', '');
    } else if (dayType === 'working_holiday') {
      // Working holiday: all 8 hours are OT at 1× rate
      setValue('hours_worked', 0);
      setValue('overtime_hours', 8);
    } else {
      // working_day: default to 8 regular hours, 0 OT
      setValue('hours_worked', 8);
      setValue('overtime_hours', 0);
    }
  }, [dayType, setValue]);

  // Sync selected employee with form value
  useEffect(() => {
    setValue('employee_id', selectedEmployeeId);
  }, [selectedEmployeeId, setValue]);

  const onSubmit = async (data: unknown) => {
    // Prevent multiple dialogs
    if (showConfirmDialog) return;
    // Store data and show confirmation dialog
    setPendingData(data as FormDataWithToken);
    setShowConfirmDialog(true);
  };

  const handleConfirmSubmit = async () => {
    if (!pendingData) return;
    setIsSubmitting(true);
    try {
      const formData = new FormData();
      Object.entries(pendingData).forEach(([key, value]) => {
        if (value !== null && value !== undefined && value !== '') {
          formData.append(key, String(value));
        }
      });

      const result = await submitTimesheet(formData) as SubmitTimesheetResponse;
      if ('error' in result) {
        toast.error(result.error);
        setShowConfirmDialog(false);
        setPendingData(null);
      } else {
        // Store submitted data for PDF download
        setSubmittedTimesheet(result.timesheet as Timesheet & {
          employees: { name_en: string; emp_code: string; basic_salary: number; gross_salary: number };
          projects: { name: string } | null;
        });
        setSubmittedCompany(result.company as Company);
        toast.success('Timesheet submitted successfully!');
        // Keep dialog open to show success + download button
        setPendingData(null);
      }
    } catch (error) {
      console.error('[TimesheetForm] Submit error:', error);
      toast.error('An unexpected error occurred. Please try again.');
      setShowConfirmDialog(false);
      setPendingData(null);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDownloadPDF = async () => {
    if (!submittedTimesheet || !submittedCompany) return;
    try {
      await downloadTimesheetConfirmationPDF({
        timesheet: submittedTimesheet,
        company: submittedCompany,
        submissionToken: token
      });
    } catch (pdfErr) {
      console.error('[TimesheetForm] PDF download failed:', pdfErr);
      toast.error('Failed to download PDF. Please try again.');
    }
  };

  const handleCloseDialog = () => {
    setShowConfirmDialog(false);
    setPendingData(null);
    setSubmittedTimesheet(null);
    setSubmittedCompany(null);
    // Reset form but keep token and set date to today
    const today = new Date().toISOString().split('T')[0];
    setValue('date', today);
    setValue('day_type', 'working_day');
    setValue('hours_worked', 8);
    setValue('overtime_hours', 0);
    setValue('reason', '');
    setValue('employee_id', '');
    setValue('project_id', '');
    setSelectedEmployeeId('');
    setEmployeeSearchQuery('');
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
      {/* Hidden token field */}
      <input type="hidden" {...register('token')} />

      {/* Employee Selection */}
      <div className="space-y-2">
        <Label>
          Employee Name <span className="text-red-500">*</span>
        </Label>
        <Combobox
          value={selectedEmployeeId}
          onValueChange={(value) => {
            setSelectedEmployeeId(value || '');
            setEmployeeSearchQuery('');
          }}
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
              placeholder="Search employee by name or code..."
              className="pl-10"
              onChange={(e) => setEmployeeSearchQuery(e.target.value)}
            />
            <ComboboxTrigger hasValue={!!selectedEmployeeId} onClear={() => {
              setSelectedEmployeeId('');
              setEmployeeSearchQuery('');
            }} />
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
                ))}
              {employees.length === 0 && (
                <div className="px-3 py-8 text-center text-gray-500">
                  <User className="h-8 w-8 mx-auto mb-2 text-gray-300" />
                  <p className="text-sm">No employees found</p>
                </div>
              )}
            </div>
          </ComboboxContent>
        </Combobox>
        {errors.employee_id && (
          <p className="text-xs text-red-500 flex items-center gap-1">
            <AlertCircle className="w-3 h-3" /> {errors.employee_id.message}
          </p>
        )}
      </div>

      {/* Date */}
      <div className="space-y-2">
        <Label htmlFor="date">
          Date <span className="text-red-500">*</span>
        </Label>
        <Input
          type="date"
          max={new Date().toISOString().split('T')[0]}
          {...register('date')}
        />
        {errors.date && (
          <p className="text-xs text-red-500 flex items-center gap-1">
            <AlertCircle className="w-3 h-3" /> {errors.date.message}
          </p>
        )}
      </div>

      {/* Day Type */}
      <div className="space-y-3">
        <Label>
          Day Type <span className="text-red-500">*</span>
        </Label>
        <div className="flex flex-wrap gap-x-6 gap-y-3">
          <label className="flex items-center space-x-2 cursor-pointer">
            <input
              type="radio"
              {...register('day_type')}
              value="working_day"
              className="h-4 w-4 text-blue-600 focus:ring-blue-500"
            />
            <span className="text-sm">Working Day</span>
          </label>
          <label className="flex items-center space-x-2 cursor-pointer">
            <input
              type="radio"
              {...register('day_type')}
              value="working_holiday"
              className="h-4 w-4 text-blue-600 focus:ring-blue-500"
            />
            <span className="text-sm">Working Holiday</span>
          </label>
          <label className="flex items-center space-x-2 cursor-pointer">
            <input
              type="radio"
              {...register('day_type')}
              value="absent"
              className="h-4 w-4 text-blue-600 focus:ring-blue-500"
            />
            <span className="text-sm">Absent</span>
          </label>
        </div>
        {errors.day_type && (
          <p className="text-xs text-red-500 flex items-center gap-1">
            <AlertCircle className="w-3 h-3" /> {errors.day_type.message}
          </p>
        )}
      </div>

      {/* Hours section — varies by day type */}
      {dayType === 'working_day' && (
        <div className="space-y-4">
          <div className="space-y-3">
            <Label>
              Regular Hours <span className="text-red-500">*</span>
            </Label>
            <div className="flex flex-wrap gap-x-6 gap-y-3">
              <label className="flex items-center space-x-2 cursor-pointer">
                <input
                  type="radio"
                  {...register('hours_worked', { valueAsNumber: true })}
                  value={8}
                  className="h-4 w-4 text-blue-600 focus:ring-blue-500"
                />
                <span className="text-sm">8 Hours (Full-day)</span>
              </label>
              <label className="flex items-center space-x-2 cursor-pointer">
                <input
                  type="radio"
                  {...register('hours_worked', { valueAsNumber: true })}
                  value={4}
                  className="h-4 w-4 text-blue-600 focus:ring-blue-500"
                />
                <span className="text-sm">4 Hours (Half-day)</span>
              </label>
            </div>
            {errors.hours_worked && (
              <p className="text-xs text-red-500 flex items-center gap-1 mt-2">
                <AlertCircle className="w-3 h-3" /> {errors.hours_worked.message}
              </p>
            )}
          </div>

          {/* Overtime Hours — separate from regular hours */}
          <div className="pt-4 border-t">
            <Label htmlFor="overtime_hours">
              Overtime Hours {requiresReason && <span className="text-red-500">*</span>}
            </Label>
            <select
              {...register('overtime_hours', { valueAsNumber: true })}
              className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 mt-1"
            >
              <option value={0}>0 hours</option>
              <option value={1}>1 hour</option>
              <option value={2}>2 hours</option>
              <option value={3}>3 hours</option>
              <option value={4}>4 hours</option>
              <option value={5}>5 hours</option>
              <option value={6}>6 hours</option>
              <option value={7}>7 hours</option>
              <option value={8}>8 hours</option>
            </select>
            {errors.overtime_hours && (
              <p className="text-xs text-red-500 flex items-center gap-1 mt-1">
                <AlertCircle className="w-3 h-3" /> {errors.overtime_hours.message}
              </p>
            )}
            <p className="text-xs text-muted-foreground mt-1">
              Enter hours worked beyond regular shift. Reason is required if overtime is recorded.
            </p>
          </div>
        </div>
      )}

      {/* Working Holiday — all hours count as OT */}
      {dayType === 'working_holiday' && (
        <div className="space-y-4">
          {/* Overtime Hours — fixed at 8 hours, disabled dropdown */}
          <div>
            <Label htmlFor="overtime_hours">
              Overtime Hours
            </Label>
            <select
              {...register('overtime_hours', { valueAsNumber: true })}
              className="flex h-10 w-full rounded-md border border-input bg-muted px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 mt-1 cursor-not-allowed"
              disabled
              value={8}
            >
              <option value={0}>0 hours</option>
              <option value={1}>1 hour</option>
              <option value={2}>2 hours</option>
              <option value={3}>3 hours</option>
              <option value={4}>4 hours</option>
              <option value={5}>5 hours</option>
              <option value={6}>6 hours</option>
              <option value={7}>7 hours</option>
              <option value={8}>8 hours</option>
            </select>
            <input type="hidden" {...register('overtime_hours')} value={8} />
            {errors.overtime_hours && (
              <p className="text-xs text-red-500 flex items-center gap-1 mt-1">
                <AlertCircle className="w-3 h-3" /> {errors.overtime_hours.message}
              </p>
            )}
            <p className="text-xs text-muted-foreground mt-1">
              Fixed 8 hours. Reason is required.
            </p>
          </div>
        </div>
      )}

      {/* Project — required for all day types */}
      <div className="space-y-2">
        <Label htmlFor="project_id">
          Project Name <span className="text-red-500">*</span>
        </Label>
        <select
          {...register('project_id')}
          className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
          aria-label="Select project"
        >
          <option value="">Select active project</option>
          {projects.map((proj) => (
            <option key={proj.id} value={proj.id}>
              {proj.name}
            </option>
          ))}
        </select>
        {errors.project_id && (
          <p className="text-xs text-red-500 flex items-center gap-1">
            <AlertCircle className="w-3 h-3" /> {errors.project_id.message}
          </p>
        )}
      </div>

      {/* Reason / Justification — required for absent or overtime */}
      <div className="space-y-2">
        <Label htmlFor="reason">
          Reason / Justification
          {requiresReason && <span className="text-red-500"> *</span>}
        </Label>
        <Textarea
          id="reason"
          rows={3}
          placeholder={requiresReason ? 'Please provide a reason (required)...' : 'Optional notes...'}
          {...register('reason')}
        />
        {errors.reason && (
          <p className="text-xs text-red-500 flex items-center gap-1">
            <AlertCircle className="w-3 h-3" /> {errors.reason.message}
          </p>
        )}
        {requiresReason && !errors.reason && (
          <p className="text-xs text-muted-foreground">
            Reason is required for absences and overtime entries
          </p>
        )}
      </div>

      {/* Submit Button */}
      <Button type="submit" className="w-full" disabled={isSubmitting}>
        {isSubmitting ? (
          <>
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            Submitting...
          </>
        ) : (
          'Submit Timesheet'
        )}
      </Button>

      {/* Confirmation Dialog */}
      <Dialog open={showConfirmDialog} onOpenChange={handleCloseDialog}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>
              {submittedTimesheet ? 'Timesheet Submitted' : 'Confirm Timesheet Submission'}
            </DialogTitle>
            <DialogDescription>
              {submittedTimesheet
                ? 'Your timesheet has been recorded. You can download a confirmation PDF using the button below.'
                : 'Please review your timesheet details before submitting.'}
            </DialogDescription>
          </DialogHeader>

          {pendingData && (
            <div className="space-y-4">
              <Card>
                <CardContent className="pt-4 space-y-3">
                  <div className="flex items-center gap-2 text-sm">
                    <User className="h-4 w-4 text-muted-foreground" />
                    <span className="font-medium">Employee:</span>
                    <span className="text-muted-foreground">
                      {employees.find(e => e.id === pendingData.employee_id)?.emp_code} — {employees.find(e => e.id === pendingData.employee_id)?.name_en}
                    </span>
                  </div>

                  <div className="flex items-center gap-2 text-sm">
                    <CalendarIcon className="h-4 w-4 text-muted-foreground" />
                    <span className="font-medium">Date:</span>
                    <span className="text-muted-foreground">{pendingData.date}</span>
                  </div>

                  <div className="flex items-center gap-2 text-sm">
                    <FileText className="h-4 w-4 text-muted-foreground" />
                    <span className="font-medium">Day Type:</span>
                    <span className="text-muted-foreground capitalize">{pendingData.day_type.replace('_', ' ')}</span>
                  </div>

                  {pendingData.day_type === 'working_day' && (
                    <>
                      <div className="flex items-center gap-2 text-sm">
                        <Clock className="h-4 w-4 text-muted-foreground" />
                        <span className="font-medium">Regular Hours:</span>
                        <span className="text-muted-foreground">{pendingData.hours_worked} hrs</span>
                      </div>
                      {pendingData.overtime_hours > 0 && (
                        <div className="flex items-center gap-2 text-sm">
                          <Clock className="h-4 w-4 text-muted-foreground" />
                          <span className="font-medium">Overtime Hours:</span>
                          <span className="text-muted-foreground">{pendingData.overtime_hours} hrs</span>
                        </div>
                      )}
                    </>
                  )}

                  {pendingData.day_type === 'working_holiday' && (
                    <div className="flex items-center gap-2 text-sm">
                      <Clock className="h-4 w-4 text-muted-foreground" />
                      <span className="font-medium">Holiday Hours:</span>
                      <span className="text-muted-foreground">{pendingData.overtime_hours} hrs</span>
                    </div>
                  )}

                  {pendingData.day_type === 'absent' && (
                    <div className="flex items-center gap-2 text-sm text-red-600">
                      <AlertCircle className="h-4 w-4" />
                      <span>Absent — No hours worked</span>
                    </div>
                  )}

                  <div className="flex items-center gap-2 text-sm">
                    <Building2 className="h-4 w-4 text-muted-foreground" />
                    <span className="font-medium">Project:</span>
                    <span className="text-muted-foreground">
                      {projects.find(p => p.id === pendingData.project_id)?.name || 'Unknown'}
                    </span>
                  </div>

                  {pendingData.reason && (
                    <div className="text-sm">
                      <span className="font-medium">Reason:</span>
                      <p className="mt-1 p-2 bg-muted rounded text-muted-foreground">{pendingData.reason}</p>
                    </div>
                  )}
                </CardContent>
              </Card>

              <p className="text-xs text-muted-foreground text-center">
                By confirming, you certify this timesheet entry is accurate.
              </p>
            </div>
          )}

          {submittedTimesheet && (
            <div className="space-y-4">
              <Card>
                <CardContent className="pt-4 space-y-3">
                  <div className="flex items-center gap-2 text-sm">
                    <User className="h-4 w-4 text-muted-foreground" />
                    <span className="font-medium">Employee:</span>
                    <span className="text-muted-foreground">
                      {submittedTimesheet.employees.emp_code} — {submittedTimesheet.employees.name_en}
                    </span>
                  </div>

                  <div className="flex items-center gap-2 text-sm">
                    <CalendarIcon className="h-4 w-4 text-muted-foreground" />
                    <span className="font-medium">Date:</span>
                    <span className="text-muted-foreground">{submittedTimesheet.date}</span>
                  </div>

                  <div className="flex items-center gap-2 text-sm">
                    <FileText className="h-4 w-4 text-muted-foreground" />
                    <span className="font-medium">Day Type:</span>
                    <span className="text-muted-foreground capitalize">{submittedTimesheet.day_type.replace('_', ' ')}</span>
                  </div>

                  <div className="flex items-center gap-2 text-sm">
                    <Clock className="h-4 w-4 text-muted-foreground" />
                    <span className="font-medium">Regular Hours:</span>
                    <span className="text-muted-foreground">{submittedTimesheet.hours_worked} hrs</span>
                  </div>

                  {submittedTimesheet.overtime_hours > 0 && (
                    <div className="flex items-center gap-2 text-sm">
                      <Clock className="h-4 w-4 text-muted-foreground" />
                      <span className="font-medium">Overtime Hours:</span>
                      <span className="text-muted-foreground">{submittedTimesheet.overtime_hours} hrs</span>
                    </div>
                  )}

                  <div className="flex items-center gap-2 text-sm">
                    <Building2 className="h-4 w-4 text-muted-foreground" />
                    <span className="font-medium">Project:</span>
                    <span className="text-muted-foreground">
                      {submittedTimesheet.projects?.name || 'Not specified'}
                    </span>
                  </div>

                  {submittedTimesheet.reason && (
                    <div className="text-sm">
                      <span className="font-medium">Reason:</span>
                      <p className="mt-1 p-2 bg-muted rounded text-muted-foreground">{submittedTimesheet.reason}</p>
                    </div>
                  )}
                </CardContent>
              </Card>

              <p className="text-xs text-muted-foreground text-center">
                A confirmation receipt is available for download.
              </p>
            </div>
          )}

          <DialogFooter>
            {submittedTimesheet ? (
              <>
                <Button variant="outline" onClick={handleCloseDialog}>
                  Close
                </Button>
                <Button onClick={handleDownloadPDF} disabled={isSubmitting}>
                  <Download className="mr-2 h-4 w-4" />
                  Download PDF
                </Button>
              </>
            ) : (
              <>
                <Button variant="outline" onClick={() => setShowConfirmDialog(false)}>
                  Cancel
                </Button>
                <Button onClick={handleConfirmSubmit} disabled={isSubmitting}>
                  {isSubmitting ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Submitting...
                    </>
                  ) : (
                    'Confirm & Submit'
                  )}
                </Button>
              </>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </form>
  );
}
