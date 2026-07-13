'use client';

import React, { useState, useEffect } from 'react';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { DatePickerInput } from '@/components/ui/date-picker-input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { EmployeePicker } from '@/components/employees/EmployeePicker';
import { AirportSelect } from '@/components/hr/AirportSelect';
import { SignaturePad } from '@/components/hr/SignaturePad';
import { submitLeaveRequest, getEmployeeLeaveBalance } from './actions';
import { toast } from 'sonner';
import { CheckCircle2, Loader2, Plane, Calendar, User, MapPin, FileText, Building2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';

const formSchema = z.object({
  employeeId: z.string().min(1, 'Please select your name'),
  leaveType: z.enum(['Annual Leave', 'Unpaid Leave']),
  startDate: z.string().min(1, 'Please select start date'),
  endDate: z.string().min(1, 'Please select end date'),
  sector: z.string().min(1, 'Please select sector'),
});

type FormValues = z.infer<typeof formSchema>;

interface LeaveFormProps {
  companyId: string;
  employees: any[];
}

// Inclusive day count using UTC
function getInclusiveDays(startDateStr: string, endDateStr: string): number {
  const parse = (s: string) => {
    const [y, m, d] = s.split('-').map(Number);
    return { y, m, d };
  };
  const s = parse(startDateStr);
  const e = parse(endDateStr);
  const startUtc = Date.UTC(s.y, s.m - 1, s.d);
  const endUtc = Date.UTC(e.y, e.m - 1, e.d);
  const msPerDay = 1000 * 60 * 60 * 24;
  const diff = Math.floor((endUtc - startUtc) / msPerDay) + 1;
  return diff >= 1 ? diff : 0;
}

export function LeaveForm({ companyId, employees }: LeaveFormProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [signatureData, setSignatureData] = useState<string | null>(null);
  const [leaveDays, setLeaveDays] = useState(0);
  const [annualLeaveBalance, setAnnualLeaveBalance] = useState<number | null>(null);

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    control,
    formState: { errors },
  } = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      leaveType: 'Annual Leave',
    },
  });

  const selectedEmployeeId = watch('employeeId');

  // Fetch annual leave balance when employee is selected
  useEffect(() => {
    async function fetchBalance() {
      if (!selectedEmployeeId) {
        setAnnualLeaveBalance(null);
        return;
      }

      try {
        const result = await getEmployeeLeaveBalance(companyId, selectedEmployeeId);
        if (result.error) {
          console.error('Failed to fetch balance:', result.error);
          setAnnualLeaveBalance(null);
        } else {
          setAnnualLeaveBalance(result.balance);
        }
      } catch (error) {
        console.error('Error fetching balance:', error);
        setAnnualLeaveBalance(null);
      }
    }

    fetchBalance();
  }, [selectedEmployeeId, companyId]);

  const startDate = watch('startDate');
  const endDate = watch('endDate');
  const leaveType = watch('leaveType');

  useEffect(() => {
    if (startDate && endDate) {
      const parse = (s: string) => {
        const [y, m, d] = s.split('-').map(Number);
        return { y, m, d };
      };
      const s = parse(startDate);
      const e = parse(endDate);
      const startUtc = Date.UTC(s.y, s.m - 1, s.d);
      const endUtc = Date.UTC(e.y, e.m - 1, e.d);
      const msPerDay = 1000 * 60 * 60 * 24;
      const diff = Math.floor((endUtc - startUtc) / msPerDay) + 1;
      setLeaveDays(diff >= 1 ? diff : 0);
    } else {
      setLeaveDays(0);
    }
  }, [startDate, endDate]);

  const onSubmit = async (values: FormValues) => {
    if (!signatureData) {
      toast.error('Please provide your signature');
      return;
    }

    // Check annual leave balance
    if (values.leaveType === 'Annual Leave') {
      if (annualLeaveBalance === null) {
        toast.error('Unable to verify leave balance. Please contact HR.');
        return;
      }
      if (leaveDays > annualLeaveBalance) {
        toast.error(
          `Insufficient leave balance. You have ${annualLeaveBalance} days available, but requested ${leaveDays} days.`
        );
        return;
      }
    }

    setIsSubmitting(true);
    try {
      const result = await submitLeaveRequest({
        ...values,
        companyId,
        days: leaveDays,
        signatureDataUrl: signatureData,
      });

      if (result.success) {
        setIsSuccess(true);
        toast.success('Leave request submitted successfully');
      } else {
        toast.error(result.error || 'Failed to submit request');
      }
    } catch (error) {
      toast.error('An unexpected error occurred');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isSuccess) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <div className="text-center space-y-8 max-w-md mx-auto p-8">
          <div className="w-24 h-24 bg-gradient-to-br from-emerald-100 to-emerald-50 rounded-full flex items-center justify-center mx-auto shadow-lg shadow-emerald-100">
            <CheckCircle2 className="w-12 h-12 text-emerald-600" />
          </div>
          <div className="space-y-3">
            <h2 className="text-3xl font-bold text-slate-900">Request Submitted!</h2>
            <p className="text-slate-500">
              Your leave request has been sent for HR approval. You will be notified once it's processed.
            </p>
          </div>
          <Button
            onClick={() => window.location.reload()}
            variant="outline"
            className="rounded-xl"
          >
            Submit Another Request
          </Button>
        </div>
      </div>
    );
  }

  const selectedEmployee = employees.find(e => e.id === watch('employeeId'));

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 to-slate-100 py-8 px-4">
      <div className="max-w-3xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <div className="space-y-2">
            <h1 className="text-3xl font-bold text-slate-900">Leave Request</h1>
            <p className="text-slate-500">Fill in the details below to submit your leave request</p>
          </div>
        </div>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
          {/* Employee Information Card */}
          <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6 space-y-4">
            <div className="flex items-center gap-3 pb-4 border-b border-slate-100">
              <div className="w-10 h-10 bg-indigo-100 rounded-lg flex items-center justify-center">
                <User className="w-5 h-5 text-indigo-600" />
              </div>
              <div>
                <h2 className="font-semibold text-slate-900">Employee Information</h2>
                <p className="text-sm text-slate-500">Select the employee requesting leave</p>
              </div>
            </div>

            <div className="space-y-2">
              <Label className="text-sm font-medium text-slate-700">Employee Name</Label>
              <EmployeePicker
                employees={employees}
                selectedId={watch('employeeId')}
                onSelect={(id) => setValue('employeeId', id, { shouldValidate: true })}
                className={errors.employeeId ? 'border-red-500 focus:ring-red-500' : ''}
              />
              {errors.employeeId && (
                <p className="text-sm text-red-500">{errors.employeeId.message}</p>
              )}
            </div>
          </div>

          {/* Leave Details Card */}
          <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6 space-y-4">
            <div className="flex items-center gap-3 pb-4 border-b border-slate-100">
              <div className="w-10 h-10 bg-emerald-100 rounded-lg flex items-center justify-center">
                <FileText className="w-5 h-5 text-emerald-600" />
              </div>
              <div>
                <h2 className="font-semibold text-slate-900">Leave Details</h2>
                <p className="text-sm text-slate-500">Specify the leave period and type</p>
              </div>
            </div>

            <div className="space-y-2">
              <Label className="text-sm font-medium text-slate-700">Leave Type</Label>
              <Select
                value={watch('leaveType')}
                onValueChange={(val) => setValue('leaveType', val as any)}
              >
                <SelectTrigger className="h-12 rounded-xl">
                  <SelectValue placeholder="Select leave type" />
                </SelectTrigger>
                <SelectContent className="rounded-xl">
                  <SelectItem value="Annual Leave">Annual Leave</SelectItem>
                  <SelectItem value="Unpaid Leave">Unpaid Leave</SelectItem>
                </SelectContent>
              </Select>
            </div>

             <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label className="text-sm font-medium text-slate-700">Start Date</Label>
                <Controller
                  control={control}
                  name="startDate"
                  render={({ field }) => (
                    <DatePickerInput
                      value={field.value}
                      onChange={(e) => field.onChange(e.target.value)}
                      className={cn("h-12 rounded-xl", errors.startDate && "border-red-500 focus:ring-red-500")}
                    />
                  )}
                />
                {errors.startDate && <p className="text-sm text-red-500">{errors.startDate.message}</p>}
              </div>
              <div className="space-y-2">
                <Label className="text-sm font-medium text-slate-700">End Date</Label>
                <Controller
                  control={control}
                  name="endDate"
                  render={({ field }) => (
                    <DatePickerInput
                      value={field.value}
                      onChange={(e) => field.onChange(e.target.value)}
                      className={cn("h-12 rounded-xl", errors.endDate && "border-red-500 focus:ring-red-500")}
                    />
                  )}
                />
                {errors.endDate && <p className="text-sm text-red-500">{errors.endDate.message}</p>}
              </div>
            </div>

            {startDate && endDate && leaveDays > 0 && (
              <div className="bg-gradient-to-r from-indigo-600 to-indigo-700 text-white p-5 rounded-xl shadow-lg shadow-indigo-100 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <Calendar className="w-5 h-5 opacity-90" />
                  <span className="font-medium">Total Leave Days</span>
                </div>
                <span className="text-3xl font-black">{leaveDays}</span>
              </div>
            )}

            {watch('leaveType') === 'Annual Leave' && annualLeaveBalance !== null && leaveDays > 0 && leaveDays > annualLeaveBalance && (
              <div className="bg-red-50 border border-red-200 text-red-800 p-4 rounded-xl flex items-start gap-3">
                <div className="w-5 h-5 bg-red-200 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
                  <span className="text-xs font-bold">!</span>
                </div>
                <p className="text-sm">
                  <span className="font-semibold">Insufficient leave balance.</span> You have{' '}
                  <span className="font-bold">{annualLeaveBalance}</span> days available, but requested{' '}
                  <span className="font-bold">{leaveDays}</span> days. Please adjust your dates or contact HR.
                </p>
              </div>
            )}

            {leaveType === 'Annual Leave' && leaveDays > 60 && (
              <div className="bg-amber-50 border border-amber-200 text-amber-800 p-4 rounded-xl flex items-start gap-3">
                <div className="w-5 h-5 bg-amber-200 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
                  <span className="text-xs font-bold">!</span>
                </div>
                <p className="text-sm">
                  Annual leave cannot exceed 60 days maximum. Please adjust your dates.
                </p>
              </div>
            )}
          </div>

          {/* Destination Card */}
          <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6 space-y-4">
            <div className="flex items-center gap-3 pb-4 border-b border-slate-100">
              <div className="w-10 h-10 bg-sky-100 rounded-lg flex items-center justify-center">
                <MapPin className="w-5 h-5 text-sky-600" />
              </div>
              <div>
                <h2 className="font-semibold text-slate-900">Destination</h2>
                <p className="text-sm text-slate-500">Select your destination sector</p>
              </div>
            </div>

            <div className="space-y-2">
              <Label className="text-sm font-medium text-slate-700">Destination Sector</Label>
              <AirportSelect
                value={watch('sector')}
                onChange={(val) => setValue('sector', val, { shouldValidate: true })}
                className={errors.sector ? 'border-red-500 focus:ring-red-500' : ''}
              />
              {errors.sector && (
                <p className="text-sm text-red-500">{errors.sector.message}</p>
              )}
            </div>
          </div>

          {/* Signature Card */}
          <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6 space-y-4">
            <div className="flex items-center gap-3 pb-4 border-b border-slate-100">
              <div className="w-10 h-10 bg-rose-100 rounded-lg flex items-center justify-center">
                <Plane className="w-5 h-5 text-rose-600" />
              </div>
              <div>
                <h2 className="font-semibold text-slate-900">Authorization</h2>
                <p className="text-sm text-slate-500">Sign to confirm your leave request</p>
              </div>
            </div>

            <div className="space-y-2">
              <Label className="text-sm font-medium text-slate-700">Your Signature</Label>
              <SignaturePad
                onSave={(data) => {
                  setSignatureData(data);
                  toast.success('Signature applied');
                }}
                onClear={() => setSignatureData(null)}
                placeholder="Sign above using your finger or stylus"
                height="h-56"
              />
              {!signatureData && (
                <p className="text-xs text-slate-500 text-center">
                  Your signature is required to submit this request
                </p>
              )}
            </div>
          </div>

          {/* Submit */}
          <div className="flex gap-4 pt-4">
            <Button
              type="submit"
              disabled={isSubmitting}
              className="flex-1 h-14 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-lg font-semibold shadow-lg shadow-indigo-100 transition-all active:scale-[0.98] disabled:opacity-50"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                  Submitting...
                </>
              ) : (
                <>
                  <Plane className="w-5 h-5 mr-2" />
                  Submit Leave Request
                </>
              )}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
