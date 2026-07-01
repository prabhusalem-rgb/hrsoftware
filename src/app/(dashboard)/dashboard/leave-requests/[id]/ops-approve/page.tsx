'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { SignaturePad } from '@/components/hr/SignaturePad';
import { toast } from 'sonner';
import { Loader2, CheckCircle2, XCircle, Calendar, User, Plane, Building2 } from 'lucide-react';
import { format, parseISO } from 'date-fns';
import { createClient } from '@/lib/supabase/client';
import { LeaveRequest, Employee } from '@/types';

export default function OperationsLeaveApprovalPage() {
  const params = useParams();
  const router = useRouter();
  const id = params.id as string;

  const [leaveRequest, setLeaveRequest] = useState<LeaveRequest | null>(null);
  const [employee, setEmployee] = useState<Employee | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [opsSignature, setOpsSignature] = useState<string | null>(null);
  const [opsRemarks, setOpsRemarks] = useState('');
  const [approved, setApproved] = useState(false);
  const [leaveBalance, setLeaveBalance] = useState<{ balance: number; entitled: number; used: number } | null>(null);

  const supabase = createClient();

  useEffect(() => {
    fetchLeaveRequest();
  }, [id]);

  async function fetchLeaveRequest() {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('leave_requests')
        .select(`
          *,
          employee:employees!leave_requests_employee_id_fkey(
            id, emp_code, name_en, designation, department, basic_salary, gross_salary
          ),
          company:companies!leave_requests_company_id_fkey(id, name_en)
        `)
        .eq('id', id)
        .single();

      if (error || !data) {
        toast.error('Leave request not found');
        return;
      }

      setLeaveRequest(data as LeaveRequest);
      setEmployee(data.employee as Employee);

      // Fetch leave balance if Annual Leave
      if (data.leave_type === 'Annual Leave') {
        const currentYear = new Date().getFullYear();
        const { data: balances } = await supabase
          .from('leave_balances')
          .select('entitled, used, carried_forward, balance')
          .eq('employee_id', data.employee_id)
          .eq('year', currentYear)
          .maybeSingle();

        if (balances) {
          setLeaveBalance(balances);
        }
      }
    } catch (err) {
      console.error('Error fetching leave request:', err);
      toast.error('Failed to load leave request');
    } finally {
      setLoading(false);
    }
  }

  const handleApprove = async () => {
    if (!opsSignature) {
      toast.error('Please provide your signature');
      return;
    }

    setSubmitting(true);
    try {
      const response = await fetch(`/api/leave-requests/${id}/ops-approve`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ops_remarks: opsRemarks || null,
          ops_signature_url: opsSignature,
        }),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || 'Failed to approve');
      }

      setLeaveRequest(result);
      setApproved(true);
      toast.success('Leave request approved! Forwarding to GM/CEO for final approval.');
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  const handleReject = async () => {
    if (!opsRemarks.trim()) {
      toast.error('Please provide rejection remarks');
      return;
    }

    setSubmitting(true);
    try {
      const response = await fetch(`/api/leave-requests/${id}/ops-approve`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ops_remarks: opsRemarks }),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || 'Failed to reject');
      }

      toast.success('Leave request rejected');
      setLeaveRequest((prev) => prev ? { ...prev, status: 'rejected' } : null);
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="w-8 h-8 animate-spin" />
      </div>
    );
  }

  if (!leaveRequest || !employee) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <p className="text-red-500">Leave request not found</p>
      </div>
    );
  }

  // Only Operations Manager can approve (status must be hr_approved)
  const isPendingOps = leaveRequest.status === 'hr_approved';
  const isAlreadyOpsApproved = leaveRequest.status === 'ops_approved';

  const startDate = parseISO(leaveRequest.start_date);
  const endDate = parseISO(leaveRequest.end_date);
  const totalDays = getInclusiveDays(leaveRequest.start_date, leaveRequest.end_date);

  return (
    <div className="min-h-screen bg-slate-50 py-8 px-4">
      <div className="max-w-3xl mx-auto space-y-6">
        {/* Header */}
        <div className="text-center space-y-2">
          <h1 className="text-3xl font-bold text-slate-900">Operations Manager Review</h1>
          <p className="text-slate-500">
            Operations Approval — {leaveRequest.leave_type}
          </p>
        </div>

        {/* Status Badge */}
        <div className="flex justify-center">
          <Badge variant={
            leaveRequest.status === 'hr_approved' ? 'default' :
            leaveRequest.status === 'ops_approved' ? 'default' :
            leaveRequest.status === 'gm_approved' ? 'default' :
            'destructive'
          } className="text-lg px-4 py-2">
            {leaveRequest.status.toUpperCase().replace('_', ' ')}
          </Badge>
        </div>

        {/* Approval Flow Indicator */}
        <Card className="border-2 border-primary/20">
          <CardContent className="pt-6">
            <div className="flex items-center justify-center gap-4 flex-wrap">
              <div className="flex items-center gap-2 text-emerald-600">
                <CheckCircle2 className="w-5 h-5" />
                <span>HR Approved</span>
              </div>
              <div className="w-12 h-0.5 bg-slate-300" />
              <div className={`flex items-center gap-2 ${approved || isPendingOps ? 'text-emerald-600' : 'text-slate-400'}`}>
                <div className={`w-8 h-8 rounded-full flex items-center justify-center ${approved || isPendingOps ? 'bg-emerald-600 text-white' : 'bg-slate-200'}`}>
                  O
                </div>
                <span>Operations</span>
              </div>
              <div className="w-12 h-0.5 bg-slate-300" />
              <div className={`flex items-center gap-2 ${isAlreadyOpsApproved ? 'text-emerald-600' : 'text-slate-400'}`}>
                <div className={`w-8 h-8 rounded-full flex items-center justify-center ${isAlreadyOpsApproved ? 'bg-emerald-600 text-white' : 'bg-slate-200'}`}>
                  G
                </div>
                <span>GM/CEO</span>
              </div>
            </div>
            {leaveRequest.hr_remarks && (
              <p className="text-sm text-slate-500 text-center mt-3">
                HR Remarks: {leaveRequest.hr_remarks}
              </p>
            )}
          </CardContent>
        </Card>

        {/* Success Message after approval */}
        {approved && leaveRequest.status === 'ops_approved' && (
          <Card className="border-2 border-emerald-200 bg-emerald-50/50">
            <CardContent className="pt-6 text-center">
              <CheckCircle2 className="w-16 h-16 text-emerald-600 mx-auto mb-4" />
              <h3 className="text-xl font-bold text-emerald-800 mb-2">Operations Approval Complete!</h3>
              <p className="text-slate-600 mb-4">
                This leave request has been approved by Operations and is now with GM/CEO for final approval.
              </p>
              <Button
                onClick={() => router.push('/dashboard/leave-requests')}
                className="gap-2 bg-emerald-600 hover:bg-emerald-700"
              >
                Back to Leave Requests
              </Button>
            </CardContent>
          </Card>
        )}

        {/* Employee & Leave Details */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <User className="w-5 h-5" />
                Employee Details
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex justify-between">
                <span className="text-slate-500">Name</span>
                <span className="font-medium">{employee.name_en}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Emp Code</span>
                <span className="font-mono">{employee.emp_code}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Department</span>
                <span>{employee.department || '—'}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Designation</span>
                <span>{employee.designation || '—'}</span>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Calendar className="w-5 h-5" />
                Leave Details
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex justify-between">
                <span className="text-slate-500">Type</span>
                <span>{leaveRequest.leave_type}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">From</span>
                <span>{format(parseISO(leaveRequest.start_date), 'dd/MM/yyyy')}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">To</span>
                <span>{format(parseISO(leaveRequest.end_date), 'dd/MM/yyyy')}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Total Days</span>
                <span className="font-bold">{totalDays}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Sector</span>
                <span className="flex items-center gap-1">
                  <Plane className="w-4 h-4" />
                  {leaveRequest.sector}
                </span>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Leave Balance Card (only for Annual Leave) */}
        {leaveRequest.leave_type === 'Annual Leave' && leaveBalance && (
          <Card className="border-emerald-200 bg-emerald-50/50">
            <CardHeader>
              <CardTitle className="text-emerald-700">Annual Leave Balance</CardTitle>
              <CardDescription>Employee's current leave balance at time of request</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-3 gap-4 text-center">
                <div>
                  <p className="text-2xl font-bold text-emerald-700">{leaveBalance.balance}</p>
                  <p className="text-sm text-slate-500">Available Days</p>
                </div>
                <div>
                  <p className="text-2xl font-bold text-slate-600">{leaveBalance.entitled}</p>
                  <p className="text-sm text-slate-500">Entitled</p>
                </div>
                <div>
                  <p className="text-2xl font-bold text-slate-600">{leaveBalance.used}</p>
                  <p className="text-sm text-slate-500">Used</p>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Company Info */}
        {leaveRequest.company && (
          <Card className="border-primary/30">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-primary">
                <Building2 className="w-5 h-5" />
                Company
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="font-medium">{leaveRequest.company.name_en}</p>
            </CardContent>
          </Card>
        )}

        {/* HR Remarks */}
        {leaveRequest.hr_remarks && (
          <Card className="border-amber-200 bg-amber-50/30">
            <CardHeader>
              <CardTitle className="text-amber-700 text-lg">HR Remarks</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-slate-700">{leaveRequest.hr_remarks}</p>
            </CardContent>
          </Card>
        )}

        {/* Operations Remarks & Signature */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <Card>
            <CardHeader>
              <CardTitle>Operations Manager Remarks</CardTitle>
              <CardDescription>Add any notes about this leave request</CardDescription>
            </CardHeader>
            <CardContent>
              <Textarea
                value={opsRemarks}
                onChange={(e) => setOpsRemarks(e.target.value)}
                placeholder="Enter remarks..."
                rows={4}
                className="resize-none"
              />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Operations Manager Signature</CardTitle>
              <CardDescription>Sign to approve or reject this request</CardDescription>
            </CardHeader>
            <CardContent>
              <SignaturePad
                onSave={(data) => setOpsSignature(data)}
                onClear={() => setOpsSignature(null)}
                placeholder="Sign above using your finger or stylus"
                height="h-56"
              />
              {opsSignature && (
                <p className="text-sm text-emerald-600 mt-2 flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4" />
                  Signature captured
                </p>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Actions */}
        <div className="flex justify-between sticky bottom-4">
          <Button
            variant="outline"
            onClick={handleReject}
            disabled={submitting || !isPendingOps}
            className="gap-2"
          >
            {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <XCircle className="w-4 h-4" />}
            Reject
          </Button>
          <Button
            onClick={handleApprove}
            disabled={submitting || !isPendingOps}
            className="gap-2 bg-emerald-600 hover:bg-emerald-700"
          >
            {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
            Approve & Forward to GM/CEO
          </Button>
        </div>
      </div>
    </div>
  );
}

// Inclusive day count using UTC to avoid timezone issues
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
