'use client';

import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { SignaturePad } from '@/components/hr/SignaturePad';
import { useLeaveRequestMutations } from '@/hooks/queries/useLeaveRequestMutations';
import { useAirTicketBalance } from '@/hooks/queries/useAirTicketBalance';
import { useLeaveBalances } from '@/hooks/queries/useLeaveBalances';
import { format } from 'date-fns';
import { 
  User, Calendar, MapPin, FileText, CheckCircle2, XCircle, 
  Plane, Briefcase, Info, AlertTriangle, Clock
} from 'lucide-react';
import { useCompany } from '@/components/providers/CompanyProvider';
import { toast } from 'sonner';
import { useRouter } from 'next/navigation';

interface LeaveRequestDetailsProps {
  request: any;
}

export function LeaveRequestDetails({ request }: LeaveRequestDetailsProps) {
  const router = useRouter();
  const { profile, activeCompanyId } = useCompany();
  const { approveRequest, rejectRequest } = useLeaveRequestMutations(activeCompanyId);
  const [remarks, setRemarks] = useState('');
  const [signatureData, setSignatureData] = useState<string | null>(null);
  
  const { data: ticketBalance } = useAirTicketBalance(request?.employee_id);
  const { data: leaveBalances = [] } = useLeaveBalances(
    activeCompanyId, 
    new Date(request?.start_date).getFullYear(), 
    request?.employee_id
  );

  const annualLeaveBalance = leaveBalances.find(b => 
    b.leave_type?.name.toLowerCase().includes('annual')
  );

  const isHR = profile?.role === 'hr' || profile?.role === 'super_admin' || profile?.role === 'company_admin';
  const isGM = profile?.role === 'company_admin' || profile?.role === 'super_admin';

  const canApproveHR = isHR && request.status === 'pending';
  const canApproveGM = isGM && request.status === 'hr_approved';

  const handleApprove = async () => {
    if (!signatureData) {
      toast.error('Please provide your signature');
      return;
    }

    const role = canApproveGM ? 'gm' : 'hr';
    await approveRequest.mutateAsync({
      id: request.id,
      role,
      signatureUrl: signatureData,
      remarks,
    });
  };

  const handleReject = async () => {
    if (!remarks) {
      toast.error('Please enter remarks for rejection');
      return;
    }
    await rejectRequest.mutateAsync({ id: request.id, remarks });
  };

  if (!request) return null;

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Request Details */}
        <div className="md:col-span-2 space-y-6">
          <Card className="border-0 shadow-sm overflow-hidden">
            <CardHeader className="bg-slate-50/50 border-b">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 bg-indigo-100 rounded-2xl flex items-center justify-center">
                    <User className="w-6 h-6 text-indigo-600" />
                  </div>
                  <div>
                    <CardTitle className="text-xl font-bold">{request.employee?.name_en}</CardTitle>
                    <CardDescription>{request.employee?.emp_code} • {request.employee?.designation}</CardDescription>
                  </div>
                </div>
                <Badge className={
                  request.status === 'pending' ? 'bg-amber-100 text-amber-700' :
                  request.status === 'hr_approved' ? 'bg-blue-100 text-blue-700' :
                  request.status === 'gm_approved' ? 'bg-emerald-100 text-emerald-700' :
                  'bg-red-100 text-red-700'
                }>
                  {request.status.replace('_', ' ')}
                </Badge>
              </div>
            </CardHeader>
            <CardContent className="p-8 space-y-8">
              <div className="grid grid-cols-2 gap-8">
                <div className="space-y-1">
                  <span className="text-xs font-black uppercase tracking-widest text-slate-400 flex items-center gap-1.5">
                    <Calendar className="w-3 h-3" /> Leave Type
                  </span>
                  <p className="text-lg font-bold text-slate-900">{request.leave_type}</p>
                </div>
                <div className="space-y-1">
                  <span className="text-xs font-black uppercase tracking-widest text-slate-400 flex items-center gap-1.5">
                    <Clock className="w-3 h-3" /> Duration
                  </span>
                  <p className="text-lg font-bold text-slate-900">{request.days} Days</p>
                  <p className="text-sm text-slate-500">
                    {format(new Date(request.start_date), 'dd/MM/yyyy')} — {format(new Date(request.end_date), 'dd/MM/yyyy')}
                  </p>
                </div>
                <div className="space-y-1 col-span-2">
                  <span className="text-xs font-black uppercase tracking-widest text-slate-400 flex items-center gap-1.5">
                    <MapPin className="w-3 h-3" /> Destination Sector
                  </span>
                  <p className="text-lg font-bold text-slate-900 flex items-center gap-2">
                    <Plane className="w-5 h-5 text-indigo-400" />
                    {request.sector}
                  </p>
                </div>
              </div>

              <div className="pt-6 border-t">
                <span className="text-xs font-black uppercase tracking-widest text-slate-400 block mb-4">Employee Signature</span>
                {request.employee_signature_url ? (
                  <div className="bg-slate-50 border-2 border-dashed border-slate-200 rounded-2xl p-4 flex flex-col items-center">
                    <img src={request.employee_signature_url} alt="Employee Signature" className="max-h-32 object-contain" />
                    <p className="text-[10px] text-slate-400 mt-2 font-mono">
                      Digitally signed on {format(new Date(request.employee_signed_at), 'dd/MM/yyyy HH:mm')}
                    </p>
                  </div>
                ) : (
                  <p className="text-amber-600 flex items-center gap-2 bg-amber-50 p-4 rounded-xl text-sm italic">
                    <AlertTriangle className="w-4 h-4" /> No signature provided
                  </p>
                )}
              </div>
            </CardContent>
          </Card>

          {/* HR Information (shown during approval) */}
          {isHR && request.leave_type === 'Annual Leave' && (
            <Card className="border-0 shadow-sm bg-indigo-600 text-white overflow-hidden">
              <CardHeader className="pb-2">
                <CardTitle className="text-lg flex items-center gap-2">
                  <Briefcase className="w-5 h-5 opacity-80" />
                  Leave Eligibility Check
                </CardTitle>
              </CardHeader>
              <CardContent className="p-6">
                <div className="grid grid-cols-2 gap-4">
                  <div className="bg-white/10 backdrop-blur-sm rounded-2xl p-4">
                    <p className="text-xs opacity-70 uppercase font-black tracking-widest mb-1">Available Annual Leave</p>
                    <p className="text-3xl font-black">{annualLeaveBalance?.balance?.toFixed(1) || '0.0'} <span className="text-sm font-normal opacity-70">Days</span></p>
                  </div>
                  <div className="bg-white/10 backdrop-blur-sm rounded-2xl p-4">
                    <p className="text-xs opacity-70 uppercase font-black tracking-widest mb-1">Available Air Tickets</p>
                    <p className="text-3xl font-black">{ticketBalance?.available?.toFixed(1) || '0.0'} <span className="text-sm font-normal opacity-70">Tickets</span></p>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Signatures Timeline */}
          {(request.hr_signature_url || request.gm_signature_url) && (
            <Card className="border-0 shadow-sm">
              <CardHeader>
                <CardTitle className="text-lg">Approvals history</CardTitle>
              </CardHeader>
              <CardContent className="space-y-6">
                {request.hr_signature_url && (
                  <div className="flex gap-4 p-4 bg-slate-50 rounded-2xl border border-slate-100">
                    <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center shrink-0">
                      <CheckCircle2 className="w-6 h-6 text-blue-600" />
                    </div>
                    <div className="space-y-3 flex-1">
                      <div>
                        <p className="font-bold text-slate-900">HR Approval</p>
                        <p className="text-xs text-slate-500">{format(new Date(request.hr_approved_at), 'dd/MM/yyyy HH:mm')}</p>
                      </div>
                      {request.hr_remarks && (
                        <p className="text-sm bg-white p-3 rounded-xl border border-slate-200 italic">"{request.hr_remarks}"</p>
                      )}
                      <img src={request.hr_signature_url} alt="HR Signature" className="h-16 object-contain border rounded-lg bg-white p-2" />
                    </div>
                  </div>
                )}
                {request.gm_signature_url && (
                  <div className="flex gap-4 p-4 bg-slate-50 rounded-2xl border border-slate-100">
                    <div className="w-10 h-10 bg-emerald-100 rounded-full flex items-center justify-center shrink-0">
                      <CheckCircle2 className="w-6 h-6 text-emerald-600" />
                    </div>
                    <div className="space-y-3 flex-1">
                      <div>
                        <p className="font-bold text-slate-900">GM/CEO Approval</p>
                        <p className="text-xs text-slate-500">{format(new Date(request.gm_approved_at), 'dd/MM/yyyy HH:mm')}</p>
                      </div>
                      {request.gm_remarks && (
                        <p className="text-sm bg-white p-3 rounded-xl border border-slate-200 italic">"{request.gm_remarks}"</p>
                      )}
                      <img src={request.gm_signature_url} alt="GM Signature" className="h-16 object-contain border rounded-lg bg-white p-2" />
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          )}
        </div>

        {/* Approval Actions */}
        <div className="space-y-6">
          {(canApproveHR || canApproveGM) ? (
            <Card className="border-0 shadow-lg border-t-4 border-indigo-600 sticky top-24">
              <CardHeader>
                <CardTitle className="text-lg">Approve Request</CardTitle>
                <CardDescription>Review the details and sign below to approve.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="space-y-2">
                  <Label>Remarks (Optional)</Label>
                  <Textarea 
                    placeholder="Enter any comments or conditions..." 
                    value={remarks}
                    onChange={(e) => setRemarks(e.target.value)}
                    className="min-h-[100px] rounded-xl border-2"
                  />
                </div>

                <div className="space-y-2">
                  <Label>Digital Signature</Label>
                  <SignaturePad
                    onSave={setSignatureData}
                    onClear={() => setSignatureData(null)}
                    placeholder="Sign here to authorize approval"
                    height="h-56"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3 pt-4">
                  <Button 
                    variant="outline" 
                    onClick={handleReject}
                    className="h-12 rounded-xl text-red-600 border-red-200 hover:bg-red-50"
                  >
                    <XCircle className="w-4 h-4 mr-2" /> Reject
                  </Button>
                  <Button 
                    onClick={handleApprove}
                    className="h-12 rounded-xl bg-indigo-600 text-white shadow-lg shadow-indigo-100"
                  >
                    <CheckCircle2 className="w-4 h-4 mr-2" /> Approve
                  </Button>
                </div>
              </CardContent>
            </Card>
          ) : (
            <Card className="border-0 shadow-sm bg-slate-50">
              <CardContent className="p-6 text-center space-y-4">
                <Info className="w-8 h-8 text-slate-400 mx-auto" />
                <h3 className="font-bold text-slate-900">Workflow Info</h3>
                <p className="text-sm text-slate-500">
                  {request.status === 'gm_approved' 
                    ? 'This request is fully approved and ready for settlement.' 
                    : request.status === 'hr_approved' 
                      ? 'Awaiting GM/CEO approval.' 
                      : request.status === 'rejected'
                        ? 'This request was rejected.'
                        : 'Approval workflow in progress.'}
                </p>
                {request.status === 'gm_approved' && (
                  <Button 
                    onClick={() => router.push(`/dashboard/settlement?employeeId=${request.employee_id}&leaveRequestId=${request.id}`)}
                    className="w-full h-12 rounded-xl bg-emerald-600 text-white shadow-lg shadow-emerald-100 flex items-center justify-center gap-2"
                  >
                    <Briefcase className="w-5 h-5" />
                    Process Settlement
                  </Button>
                )}
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
