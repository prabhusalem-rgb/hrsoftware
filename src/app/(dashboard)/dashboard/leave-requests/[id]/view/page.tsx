'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { format, parseISO } from 'date-fns';
import { createClient } from '@/lib/supabase/client';
import type { LeaveRequest, Employee, UserRole, Company } from '@/types';
import { getLeaveRequestForView } from './actions';
import {
  ArrowLeft,
  User,
  Calendar,
  FileText,
  MapPin,
  Plane,
  CheckCircle2,
  XCircle,
  UserCheck,
  Hash,
  PenLine,
  Download,
  Building,
  AlertCircle
} from 'lucide-react';
import { SignaturePad } from '@/components/hr/SignaturePad';
import { toast } from 'sonner';
import { downloadLeaveRequestPDF } from '@/lib/pdf-utils';

export default function LeaveReviewPage() {
  const params = useParams();
  const router = useRouter();
  const supabase = createClient();

  const [leaveRequest, setLeaveRequest] = useState<(LeaveRequest & { employee: Employee; company: Company }) | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [userRole, setUserRole] = useState<UserRole | null>(null);
  const [userId, setUserId] = useState<string | null>(null);
  const [authError, setAuthError] = useState(false);
  const [leaveBalance, setLeaveBalance] = useState<number | null>(null);

  // Approval form state
  const [remarks, setRemarks] = useState('');
  const [signatureData, setSignatureData] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const id = params.id as string;

  useEffect(() => {
    async function fetchData() {
      setLoading(true);
      setError(null);
      setAuthError(false);

      try {
        // Get current user
        const { data: { user }, error: authError } = await supabase.auth.getUser();

        if (authError || !user) {
          setAuthError(true);
          setLoading(false);
          return;
        }

        setUserId(user.id);

        // Get user profile
        const { data: profile, error: profileError } = await supabase
          .from('profiles')
          .select('role')
          .eq('id', user.id)
          .single();

        if (profileError || !profile) {
          setError('User profile not found');
          setLoading(false);
          return;
        }

        setUserRole(profile.role as UserRole);

        // Fetch leave request with admin client via server action (bypasses RLS join issues)
        console.log('[LeaveReview] Fetching leave request with id:', id);
        const result = await getLeaveRequestForView(id);

        if (result.error) {
          console.error('[LeaveReview] Error:', result.error);
          setError(result.error === 'Leave request not found' ? 'Leave request not found' : `Failed to load: ${result.error}`);
          setLoading(false);
          return;
        }

        if (!result.data) {
          console.warn('[LeaveReview] No data returned');
          setError('Leave request not found');
          setLoading(false);
          return;
        }

        setLeaveRequest(result.data);

        // Fetch annual leave balance if applicable
        if (result.data.leave_type === 'Annual Leave') {
          const currentYear = new Date().getFullYear();
          const { data: balancesData } = await supabase
            .from('leave_balances')
            .select(`
              balance,
              leave_types:leave_type_id (name)
            `)
            .eq('employee_id', result.data.employee_id)
            .eq('year', currentYear);

          if (balancesData && balancesData.length > 0) {
            // Find the balance entry for Annual Leave
            const annualBalance = (balancesData as Array<{ balance: number; leave_types: { name: string } | null }>).find(
              (b) => b.leave_types?.name === 'Annual Leave'
            );
            if (annualBalance) {
              setLeaveBalance(annualBalance.balance);
            }
          }
        }

        // Check access: authorized roles OR the employee themselves
        const canAccess = profile.role === 'super_admin' ||
          profile.role === 'company_admin' ||
          profile.role === 'hr' ||
          profile.role === 'finance' ||
          profile.role === 'operations' ||
          result.data.employee_id === user.id;

        if (!canAccess) {
          setError('access_denied');
          setLoading(false);
          return;
        }
      } catch (err: any) {
        console.error('Fetch error:', err);
        setError(err.message || 'Failed to load leave request');
      } finally {
        setLoading(false);
      }
    }

    if (id) {
      fetchData();
    }
  }, [id]);

  const getStatusBadge = (status: string) => {
    const variants: Record<string, 'default' | 'secondary' | 'destructive' | 'outline'> = {
      pending: 'secondary',
      hr_approved: 'default',
      ops_approved: 'outline',
      gm_approved: 'default',
      rejected: 'destructive',
    };
    const labels: Record<string, string> = {
      pending: 'Pending',
      hr_approved: 'HR Approved',
      ops_approved: 'Ops Approved',
      gm_approved: 'GM Approved',
      rejected: 'Rejected',
    };
    return <Badge variant={variants[status] || 'secondary'}>{labels[status] || status}</Badge>;
  };

  const canApprove = (): { action: 'hr' | 'ops' | 'gm' | null } => {
    if (!userRole || !leaveRequest) return { action: null };

    if (leaveRequest.status === 'pending' && ['hr', 'super_admin', 'company_admin'].includes(userRole)) {
      return { action: 'hr' };
    }
    if (leaveRequest.status === 'hr_approved' && ['operations', 'super_admin', 'company_admin'].includes(userRole)) {
      return { action: 'ops' };
    }
    if (leaveRequest.status === 'ops_approved' && ['super_admin', 'company_admin'].includes(userRole)) {
      return { action: 'gm' };
    }
    return { action: null };
  };

  const canReject = (): boolean => {
    if (!userRole || !leaveRequest) return false;
    if (leaveRequest.status === 'pending' && ['hr', 'super_admin', 'company_admin'].includes(userRole)) return true;
    if (leaveRequest.status === 'hr_approved' && ['operations', 'super_admin', 'company_admin'].includes(userRole)) return true;
    if (leaveRequest.status === 'ops_approved' && ['super_admin', 'company_admin'].includes(userRole)) return true;
    return false;
  };

  const handleApprove = async () => {
    if (!signatureData) {
      toast.error('Please provide your signature');
      return;
    }

    setIsSubmitting(true);
    try {
      const action = canApprove().action;
      if (!action) {
        toast.error('You are not authorized to approve this request');
        return;
      }

      // Upload signature
      const signatureFileName = `${action}_signature_${leaveRequest!.id}_${Date.now()}.png`;
      const signatureBuffer = Buffer.from(
        signatureData.replace(/^data:image\/\w+;base64,/, ''),
        'base64'
      );

      const { error: uploadError } = await supabase.storage
        .from('leave-signatures')
        .upload(signatureFileName, signatureBuffer, {
          contentType: 'image/png',
          upsert: true,
        });

      if (uploadError) throw uploadError;

      const { data: publicUrlData } = supabase.storage
        .from('leave-signatures')
        .getPublicUrl(signatureFileName);

      // Update leave request
      const updateData: any = {
        status: `${action}_approved`,
        [`${action}_id`]: userId,
        [`${action}_signature_url`]: publicUrlData.publicUrl,
        [`${action}_remarks`]: remarks || null,
        [`${action}_approved_at`]: new Date().toISOString(),
      };

      const { error: updateError } = await supabase
        .from('leave_requests')
        .update(updateData)
        .eq('id', id);

      if (updateError) throw updateError;

      toast.success(`Leave request ${action}-approved successfully`);
      router.refresh();
    } catch (err: any) {
      toast.error(err.message || 'Failed to approve');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleReject = async () => {
    if (!remarks?.trim()) {
      toast.error('Please provide remarks for rejection');
      return;
    }

    setIsSubmitting(true);
    try {
      const { error } = await supabase
        .from('leave_requests')
        .update({ status: 'rejected' })
        .eq('id', id);

      if (error) throw error;

      toast.success('Leave request rejected');
      router.refresh();
    } catch (err: any) {
      toast.error(err.message || 'Failed to reject');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDownloadPDF = async () => {
    if (!leaveRequest?.employee || !leaveRequest?.company) {
      toast.error('Leave request data not available');
      return;
    }

    try {
      const fileName = `leave-request-${leaveRequest.employee.emp_code}-${format(parseISO(leaveRequest.created_at), 'yyyy-MM-dd')}.pdf`;
      await downloadLeaveRequestPDF({
        leaveRequest: leaveRequest as any,
        fileName,
        showLogo: true,
        primaryColor: '#1e3a5f'
      });
      toast.success('PDF downloaded successfully');
    } catch (err: any) {
      toast.error(err.message || 'Failed to download PDF');
    }
  };

  const renderSignature = (url: string | null, name: string, date: string | null) => {
    if (!url) {
      return <p className="text-sm text-slate-400">Not signed</p>;
    }
    return (
      <div className="space-y-2">
        <div className="relative h-20 w-48 border rounded-lg overflow-hidden bg-slate-50">
          <img
            src={url}
            alt={`${name} signature`}
            className="w-full h-full object-contain"
            onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
          />
        </div>
        <p className="text-xs text-slate-500">
          Signed by {name} {date ? `on ${format(parseISO(date), 'dd/MM/yyyy, HH:mm')}` : ''}
        </p>
      </div>
    );
  };

  const approvalAction = canApprove();

  // Loading state
  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-slate-50">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary" />
      </div>
    );
  }

  // Auth error
  if (authError) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-slate-50">
        <Card className="w-full max-w-md border-0 shadow-lg rounded-3xl">
          <CardHeader className="text-center pt-8">
            <div className="mx-auto w-16 h-16 bg-amber-50 rounded-full flex items-center justify-center mb-4">
              <AlertCircle className="w-8 h-8 text-amber-500" />
            </div>
            <CardTitle className="text-2xl font-bold text-slate-900">Authentication Required</CardTitle>
            <CardDescription className="mt-2">
              Please log in to view leave requests.
            </CardDescription>
            <Button onClick={() => router.push('/login')} className="mt-6 rounded-xl">
              Go to Login
            </Button>
          </CardHeader>
        </Card>
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-slate-50">
        <Card className="w-full max-w-md border-0 shadow-lg rounded-3xl">
          <CardHeader className="text-center pt-8">
            <div className="mx-auto w-16 h-16 bg-red-50 rounded-full flex items-center justify-center mb-4">
              <XCircle className="w-8 h-8 text-red-500" />
            </div>
            <CardTitle className="text-2xl font-bold text-slate-900">
              {error === 'access_denied' ? 'Access Denied' : error === 'Leave request not found' ? 'Not Found' : 'Error'}
            </CardTitle>
            <CardDescription className="mt-2">
              {error === 'access_denied'
                ? 'You do not have permission to view this leave request.'
                : error === 'Leave request not found'
                ? 'The requested leave request could not be found. It may have been deleted or the ID is invalid.'
                : error || 'Leave request could not be loaded.'}
            </CardDescription>
            {error && error !== 'access_denied' && error !== 'Leave request not found' && (
              <div className="mt-4 p-3 bg-slate-100 rounded-lg text-left">
                <p className="text-xs text-slate-600 font-mono break-all">{error}</p>
              </div>
            )}
            <Button onClick={() => router.back()} className="mt-6 rounded-xl">
              <ArrowLeft className="w-4 h-4 mr-2" />
              Go Back
            </Button>
          </CardHeader>
        </Card>
      </div>
    );
  }

  if (!leaveRequest) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-slate-50">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary" />
      </div>
    );
  }

  const startDate = parseISO(leaveRequest.start_date);
  const endDate = parseISO(leaveRequest.end_date);
  const days = getInclusiveDays(leaveRequest.start_date, leaveRequest.end_date);

  return (
    <div className="min-h-screen bg-slate-50 py-8 px-4">
      <div className="max-w-4xl mx-auto space-y-6">
        {/* Back button */}
        <Button variant="ghost" onClick={() => router.back()} className="mb-4">
          <ArrowLeft className="w-4 h-4 mr-2" />
          Back to Leave Requests
        </Button>

        {/* Header */}
        <Card className="border-0 shadow-lg rounded-3xl overflow-hidden">
          <div className="h-2 bg-gradient-to-r from-indigo-500 to-purple-600" />
          <CardHeader className="pb-4">
            <div className="flex items-start justify-between">
              <div>
                <CardTitle className="text-2xl font-bold text-slate-900">Leave Request Review</CardTitle>
                <CardDescription className="mt-1">
                  Submitted on {format(parseISO(leaveRequest.created_at), 'dd/MM/yyyy, HH:mm')}
                </CardDescription>
              </div>
              <div className="flex items-center gap-3">
                {getStatusBadge(leaveRequest.status)}
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleDownloadPDF}
                  className="gap-2 rounded-xl"
                >
                  <Download className="w-4 h-4" />
                  Download PDF
                </Button>
              </div>
            </div>
          </CardHeader>
        </Card>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Left Column - Employee & Leave Details */}
          <div className="space-y-6">
            {/* Employee Information */}
            <Card className="border-0 shadow-sm rounded-2xl">
              <CardHeader className="pb-3">
                <CardTitle className="text-lg font-bold flex items-center gap-2">
                  <User className="w-5 h-5 text-indigo-600" />
                  Employee Information
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center gap-4">
                  <Avatar className="h-16 w-16 border-2 border-slate-100">
                    <AvatarFallback className="bg-indigo-100 text-indigo-700 font-bold text-lg">
                      {leaveRequest.employee?.name_en?.charAt(0) || 'E'}
                    </AvatarFallback>
                  </Avatar>
                  <div>
                    <h3 className="font-bold text-lg text-slate-900">{leaveRequest.employee?.name_en}</h3>
                    <p className="text-sm text-slate-500">{leaveRequest.employee?.designation}</p>
                    <p className="text-sm text-slate-500">{leaveRequest.employee?.department}</p>
                  </div>
                </div>
                <div className="pt-2 space-y-2 text-sm">
                  <div className="flex items-center gap-2">
                    <Hash className="w-4 h-4 text-slate-400" />
                    <span className="text-slate-600">Emp Code:</span>
                    <span className="font-mono font-medium">{leaveRequest.employee?.emp_code}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Building className="w-4 h-4 text-slate-400" />
                    <span className="text-slate-600">Company:</span>
                    <span className="font-medium">{leaveRequest.company?.name_en}</span>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Leave Details */}
            <Card className="border-0 shadow-sm rounded-2xl">
              <CardHeader className="pb-3">
                <CardTitle className="text-lg font-bold flex items-center gap-2">
                  <FileText className="w-5 h-5 text-indigo-600" />
                  Leave Details
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-xs text-slate-500 uppercase tracking-wider mb-1">Leave Type</p>
                    <Badge variant="outline" className="text-sm font-bold">{leaveRequest.leave_type}</Badge>
                  </div>
                  <div>
                    <p className="text-xs text-slate-500 uppercase tracking-wider mb-1">Total Days</p>
                    <p className="text-2xl font-black text-indigo-600">{days}</p>
                  </div>
                </div>

                <div className="pt-2 space-y-3">
                  <div className="flex items-start gap-3">
                    <Calendar className="w-5 h-5 text-slate-400 mt-0.5" />
                    <div>
                      <p className="text-sm text-slate-600">Period</p>
                      <p className="font-medium">
                        {format(startDate, 'dd/MM/yyyy')} → {format(endDate, 'dd/MM/yyyy')}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-start gap-3">
                    <MapPin className="w-5 h-5 text-slate-400 mt-0.5" />
                    <div>
                      <p className="text-sm text-slate-600">Destination Sector</p>
                      <p className="font-medium flex items-center gap-2">
                        <Plane className="w-3 h-3" />
                        {leaveRequest.sector}
                      </p>
                    </div>
                  </div>
                </div>

                {leaveRequest.leave_type === 'Annual Leave' && leaveBalance !== null && (
                  <div className="pt-2 border-t">
                    <p className="text-sm text-slate-600 mb-2">Current Annual Leave Balance</p>
                    <div className="bg-blue-50 rounded-lg p-3 border border-blue-100">
                      <p className="text-sm">
                        <span className="font-medium text-blue-700">{leaveBalance}</span> days available
                      </p>
                    </div>
                  </div>
                )}

                {leaveRequest.leave_type === 'Annual Leave' && (
                  <div className="pt-2 border-t">
                    <p className="text-sm text-slate-600 mb-2">Balance Impact</p>
                    <div className="bg-amber-50 rounded-lg p-3 border border-amber-100">
                      <p className="text-sm">
                        <span className="font-medium">{days}</span> days will be deducted from the employee's annual leave balance upon settlement.
                      </p>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Right Column - Signatures & Actions */}
          <div className="space-y-6">
            {/* Employee Signature */}
            <Card className="border-0 shadow-sm rounded-2xl">
              <CardHeader className="pb-3">
                <CardTitle className="text-lg font-bold flex items-center gap-2">
                  <CheckCircle2 className="w-5 h-5 text-emerald-600" />
                  Employee Authorization
                </CardTitle>
              </CardHeader>
              <CardContent>
                {renderSignature(
                  leaveRequest.employee_signature_url,
                  leaveRequest.employee?.name_en || 'Employee',
                  leaveRequest.employee_signed_at
                )}
              </CardContent>
            </Card>

            {/* HR Approval */}
            <Card className="border-0 shadow-sm rounded-2xl">
              <CardHeader className="pb-3">
                <CardTitle className="text-lg font-bold flex items-center gap-2">
                  <UserCheck className="w-5 h-5 text-blue-600" />
                  HR Approval
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-slate-600">Status</span>
                  {leaveRequest.hr_id ? (
                    <Badge variant="default" className="bg-blue-100 text-blue-700">Approved</Badge>
                  ) : (
                    <Badge variant="secondary">Pending</Badge>
                  )}
                </div>
                {leaveRequest.hr_approved_at && (
                  <p className="text-xs text-slate-500">
                    Approved on {format(parseISO(leaveRequest.hr_approved_at), 'dd/MM/yyyy, HH:mm')}
                  </p>
                )}
                {leaveRequest.hr_remarks && (
                  <div className="pt-2">
                    <p className="text-sm text-slate-600 mb-1">Remarks</p>
                    <p className="text-sm bg-slate-50 p-3 rounded-lg">{leaveRequest.hr_remarks}</p>
                  </div>
                )}
                {renderSignature(leaveRequest.hr_signature_url, 'HR Manager', leaveRequest.hr_approved_at)}
              </CardContent>
            </Card>

            {/* Operations Approval */}
            <Card className="border-0 shadow-sm rounded-2xl">
              <CardHeader className="pb-3">
                <CardTitle className="text-lg font-bold flex items-center gap-2">
                  <UserCheck className="w-5 h-5 text-purple-600" />
                  Operations Approval
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-slate-600">Status</span>
                  {leaveRequest.ops_id ? (
                    <Badge variant="outline" className="bg-purple-50 text-purple-700 border-purple-200">Approved</Badge>
                  ) : (
                    <Badge variant="secondary">Pending</Badge>
                  )}
                </div>
                {leaveRequest.ops_approved_at && (
                  <p className="text-xs text-slate-500">
                    Approved on {format(parseISO(leaveRequest.ops_approved_at), 'dd/MM/yyyy, HH:mm')}
                  </p>
                )}
                {leaveRequest.ops_remarks && (
                  <div className="pt-2">
                    <p className="text-sm text-slate-600 mb-1">Remarks</p>
                    <p className="text-sm bg-slate-50 p-3 rounded-lg">{leaveRequest.ops_remarks}</p>
                  </div>
                )}
                {renderSignature(leaveRequest.ops_signature_url, 'Operations Manager', leaveRequest.ops_approved_at)}
              </CardContent>
            </Card>

            {/* GM Approval */}
            <Card className="border-0 shadow-sm rounded-2xl">
              <CardHeader className="pb-3">
                <CardTitle className="text-lg font-bold flex items-center gap-2">
                  <UserCheck className="w-5 h-5 text-emerald-600" />
                  GM/CEO Approval
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-slate-600">Status</span>
                  {leaveRequest.gm_id ? (
                    <Badge variant="default" className="bg-emerald-100 text-emerald-700">Approved</Badge>
                  ) : (
                    <Badge variant="secondary">Pending</Badge>
                  )}
                </div>
                {leaveRequest.gm_approved_at && (
                  <p className="text-xs text-slate-500">
                    Approved on {format(parseISO(leaveRequest.gm_approved_at), 'dd/MM/yyyy, HH:mm')}
                  </p>
                )}
                {leaveRequest.gm_remarks && (
                  <div className="pt-2">
                    <p className="text-sm text-slate-600 mb-1">Remarks</p>
                    <p className="text-sm bg-slate-50 p-3 rounded-lg">{leaveRequest.gm_remarks}</p>
                  </div>
                )}
                {renderSignature(leaveRequest.gm_signature_url, 'GM/CEO', leaveRequest.gm_approved_at)}
              </CardContent>
            </Card>
          </div>
        </div>

        {/* Settlement Info */}
        {leaveRequest.leave_settlement_id && (
          <Card className="border-0 shadow-sm rounded-2xl border-emerald-200">
            <CardHeader className="pb-3">
              <CardTitle className="text-lg font-bold flex items-center gap-2 text-emerald-700">
                <CheckCircle2 className="w-5 h-5" />
                Leave Settled
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-slate-600">
                This leave has been settled. Settlement ID: {leaveRequest.leave_settlement_id}
              </p>
            </CardContent>
          </Card>
        )}

        {/* Approval Actions */}
        {(approvalAction.action || canReject()) && (
          <Card className="border-0 shadow-lg rounded-2xl border-2 border-indigo-100">
            <CardHeader>
              <CardTitle className="text-lg font-bold flex items-center gap-2">
                <PenLine className="w-5 h-5 text-indigo-600" />
                {approvalAction.action === 'hr' ? 'HR Approval' :
                 approvalAction.action === 'ops' ? 'Operations Approval' :
                 approvalAction.action === 'gm' ? 'GM/CEO Approval' : 'Take Action'}
              </CardTitle>
              <CardDescription>
                {approvalAction.action === 'hr' && 'Approve or reject this leave request as HR Manager.'}
                {approvalAction.action === 'ops' && 'Review and approve/reject as Operations Manager.'}
                {approvalAction.action === 'gm' && 'Final approval as GM/CEO.'}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="remarks">Remarks {canReject() && '(required for rejection)'}</Label>
                <Textarea
                  id="remarks"
                  placeholder={approvalAction.action === 'hr' ? "Enter HR remarks..." :
                              approvalAction.action === 'ops' ? "Enter Operations remarks..." :
                              "Enter GM/CEO remarks..."}
                  value={remarks}
                  onChange={(e) => setRemarks(e.target.value)}
                  rows={3}
                  className="resize-none"
                />
              </div>

              <div className="space-y-2">
                <Label>Your Signature</Label>
                <div className="bg-slate-50 rounded-xl p-4 border-2 border-dashed border-slate-200">
                  <SignaturePad
                    onSave={(data) => setSignatureData(data)}
                    onClear={() => setSignatureData(null)}
                    placeholder="Sign above to authorize"
                    height="h-56"
                  />
                </div>
                {signatureData && (
                  <p className="text-xs text-emerald-600 flex items-center gap-1">
                    <CheckCircle2 className="w-3 h-3" /> Signature captured
                  </p>
                )}
              </div>

              <div className="flex gap-3 pt-2">
                {approvalAction.action && (
                  <Button
                    onClick={handleApprove}
                    disabled={isSubmitting || !signatureData}
                    className="flex-1 rounded-xl bg-emerald-600 hover:bg-emerald-700"
                  >
                    {isSubmitting ? 'Processing...' : (
                      <> <CheckCircle2 className="w-4 h-4 mr-2" /> Approve</>
                    )}
                  </Button>
                )}
                {canReject() && (
                  <Button
                    onClick={handleReject}
                    disabled={isSubmitting || !remarks?.trim()}
                    variant="destructive"
                    className="flex-1 rounded-xl"
                  >
                    <XCircle className="w-4 h-4 mr-2" />
                    Reject
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Bottom navigation */}
        <div className="flex justify-end">
          <Button variant="outline" onClick={() => router.back()} className="rounded-xl">
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back
          </Button>
        </div>
      </div>
    </div>
  );
}

// Helper function for inclusive day count using UTC to avoid timezone issues
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
