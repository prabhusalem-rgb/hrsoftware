'use client';

import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { SignaturePad } from '@/components/hr/SignaturePad';
import { toast } from 'sonner';
import { Loader2, CheckCircle2, XCircle, Calendar, User, Plane } from 'lucide-react';
import { format, parseISO } from 'date-fns';
import { createClient } from '@/lib/supabase/client';
import { LeaveRequest, Employee } from '@/types';

export default function HRLeaveApprovalPage() {
  const params = useParams();
  const id = params.id as string;

  const [leaveRequest, setLeaveRequest] = useState<LeaveRequest | null>(null);
  const [employee, setEmployee] = useState<Employee | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [hrSignature, setHrSignature] = useState<string | null>(null);
  const [hrRemarks, setHrRemarks] = useState('');
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
            id, emp_code, name_en, designation, department
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
    if (!hrSignature) {
      toast.error('Please provide your signature');
      return;
    }

    setSubmitting(true);
    try {
      const response = await fetch(`/api/leave-requests/${id}/hr-approve`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          hr_remarks: hrRemarks || null,
          hr_signature_url: hrSignature,
        }),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || 'Failed to approve');
      }

      toast.success('Leave request approved successfully!');
      // Refetch to get complete data with relations
      await fetchLeaveRequest();
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  const handleReject = async () => {
    if (!hrRemarks.trim()) {
      toast.error('Please provide rejection remarks');
      return;
    }

    setSubmitting(true);
    try {
      const response = await fetch(`/api/leave-requests/${id}/hr-approve`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ hr_remarks: hrRemarks }),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || 'Failed to reject');
      }

      toast.success('Leave request rejected');
      // Refetch to get updated status
      await fetchLeaveRequest();
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

  const startDate = parseISO(leaveRequest.start_date);
  const endDate = parseISO(leaveRequest.end_date);
  const totalDays = getInclusiveDays(leaveRequest.start_date, leaveRequest.end_date);

  return (
    <div className="min-h-screen bg-slate-50 py-8 px-4">
      <div className="max-w-3xl mx-auto space-y-6">
        {/* Header */}
        <div className="text-center space-y-2">
          <h1 className="text-3xl font-bold text-slate-900">Leave Request Review</h1>
          <p className="text-slate-500">
            HR Approval — {leaveRequest.leave_type}
          </p>
        </div>

        {/* Status Badge */}
        <div className="flex justify-center">
          <Badge variant={
            leaveRequest.status === 'pending' ? 'default' :
            leaveRequest.status === 'hr_approved' ? 'default' :
            leaveRequest.status === 'gm_approved' ? 'default' :
            'destructive'
          } className="text-lg px-4 py-2">
            {leaveRequest.status.toUpperCase().replace('_', ' ')}
          </Badge>
        </div>

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
                <span>{format(parseISO(leaveRequest.start_date), 'dd MMM yyyy')}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">To</span>
                <span>{format(parseISO(leaveRequest.end_date), 'dd MMM yyyy')}</span>
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

        {/* Remarks & Signature */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <Card>
            <CardHeader>
              <CardTitle>HR Remarks</CardTitle>
              <CardDescription>Add any notes about this leave request</CardDescription>
            </CardHeader>
            <CardContent>
              <Textarea
                value={hrRemarks}
                onChange={(e) => setHrRemarks(e.target.value)}
                placeholder="Enter remarks (required for rejection)..."
                rows={4}
                className="resize-none"
              />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>HR Signature</CardTitle>
              <CardDescription>Sign to approve or reject this request</CardDescription>
            </CardHeader>
            <CardContent>
              <SignaturePad
                onSave={(data) => setHrSignature(data)}
                onClear={() => setHrSignature(null)}
                placeholder="Sign above using your finger or stylus"
                height="h-56"
              />
              {hrSignature && (
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
            disabled={submitting || leaveRequest.status !== 'pending'}
            className="gap-2"
          >
            {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <XCircle className="w-4 h-4" />}
            Reject
          </Button>
          <Button
            onClick={handleApprove}
            disabled={submitting || leaveRequest.status !== 'pending'}
            className="gap-2 bg-emerald-600 hover:bg-emerald-700"
          >
            {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
            Approve Leave Request
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
