'use client';

import React, { useEffect, useState, useCallback, useRef } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { SignaturePad } from '@/components/hr/SignaturePad';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import {
  ArrowLeft,
  FileText,
  Download,
  CheckCircle2,
  User,
  Calendar,
  Building2,
  Clock,
  ShieldCheck,
  Signature as SignatureIcon,
  Printer,
  Eye,
  FileDown,
  XCircle,
  UserCheck,
  Users,
  Trash2
} from 'lucide-react';
import { format } from 'date-fns';
// PDF imports are handled dynamically in generatePreview to reduce initial bundle size
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
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
import { useCompany } from '@/components/providers/CompanyProvider';

export default function ContractRenewalDetailsPage() {
  const { id } = useParams();
  const router = useRouter();
  const { profile } = useCompany();
  const [loading, setLoading] = useState(true);
  const [renewal, setRenewal] = useState<any>(null);
  const [processing, setProcessing] = useState(false);
  const [showPdfPreview, setShowPdfPreview] = useState(false);
  const [pdfBlobUrl, setPdfBlobUrl] = useState<string | null>(null);
  const [isGeneratingPdf, setIsGeneratingPdf] = useState(false);
  const [showManagerSignature, setShowManagerSignature] = useState(false);
  const [showSupervisorSignature, setShowSupervisorSignature] = useState(false);
  const [showHRSignature, setShowHRSignature] = useState(false);
  const [showRejectDialog, setShowRejectDialog] = useState(false);
  const [rejectionReason, setRejectionReason] = useState('');
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const pdfBlobUrlRef = useRef<string | null>(null);

  const isSuperAdmin = profile?.role === 'super_admin';

  useEffect(() => {
    fetchRenewal();
    return () => {
      // Cleanup PDF blob URL to prevent memory leak
      if (pdfBlobUrlRef.current) {
        URL.revokeObjectURL(pdfBlobUrlRef.current);
      }
    };
  }, [id]);

  const fetchRenewal = async () => {
    try {
      const res = await fetch('/api/contract-renewal');
      if (!res.ok) throw new Error('Failed to fetch renewal details');
      const data = await res.json();
      const item = data.items.find((r: any) => r.id === id);
      if (!item) throw new Error('Renewal not found');
      setRenewal(item);
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleSupervisorApprove = async (comments?: string) => {
    setProcessing(true);
    try {
      const res = await fetch(`/api/contract-renewal/${id}/approve`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'supervisor_approve',
          comments: comments || '',
        }),
      });

      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || 'Failed to approve');
      }

      toast.success('Supervisor approval recorded');
      setShowSupervisorSignature(false);
      fetchRenewal();
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setProcessing(false);
    }
  };

  const handleManagerSign = async (signatureDataUrl: string) => {
    setProcessing(true);
    try {
      const res = await fetch(`/api/contract-renewal/${id}/approve`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'manager_sign',
          signature_data_url: signatureDataUrl,
        }),
      });

      if (!res.ok) throw new Error('Failed to save manager signature');

      toast.success('Manager signature saved successfully');
      setShowManagerSignature(false);
      fetchRenewal();
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setProcessing(false);
    }
  };

  const handleHRApprove = async (signatureDataUrl: string) => {
    setProcessing(true);
    try {
      const res = await fetch(`/api/contract-renewal/${id}/approve`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'hr_approve',
          signature_data_url: signatureDataUrl,
        }),
      });

      if (!res.ok) throw new Error('Failed to approve contract');

      toast.success('Contract approved and signed successfully');
      setShowHRSignature(false);
      fetchRenewal();
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setProcessing(false);
    }
  };

  const handleReject = async () => {
    if (!rejectionReason.trim()) {
      toast.error('Please provide a rejection reason');
      return;
    }
    setProcessing(true);
    try {
      const res = await fetch(`/api/contract-renewal/${id}/approve`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'reject',
          rejection_reason: rejectionReason,
        }),
      });

      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || 'Failed to reject contract');
      }

      toast.success('Contract rejected');
      setShowRejectDialog(false);
      setRejectionReason('');
      fetchRenewal();
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setProcessing(false);
    }
  };

  const handleDelete = async () => {
    setDeleting(true);
    try {
      const res = await fetch(`/api/contract-renewal?id=${id}`, {
        method: 'DELETE',
      });

      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || 'Failed to delete');
      }

      toast.success('Contract renewal deleted');
      router.push('/dashboard/contract-renewal');
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setDeleting(false);
      setDeleteDialogOpen(false);
    }
  };

  const generatePreview = useCallback(async () => {
    if (!renewal) return;
    setIsGeneratingPdf(true);
    try {
      const [{ pdf }, { ContractRenewalPDF }] = await Promise.all([
        import('@react-pdf/renderer'),
        import('@/components/hr/ContractRenewalPDF')
      ]);

      const doc = (
        <ContractRenewalPDF
          company={renewal.company}
          employee={renewal.employee}
          renewalData={renewal}
        />
      );
      const blob = await pdf(doc).toBlob();
      // Revoke previous URL if exists
      if (pdfBlobUrlRef.current) {
        URL.revokeObjectURL(pdfBlobUrlRef.current);
      }
      const url = URL.createObjectURL(blob);
      pdfBlobUrlRef.current = url;
      setPdfBlobUrl(url);
      setShowPdfPreview(true);
    } catch (err) {
      console.error('Failed to generate PDF:', err);
      toast.error('Failed to generate PDF preview');
    } finally {
      setIsGeneratingPdf(false);
    }
  }, [renewal]);

  const downloadPdf = useCallback(async () => {
    if (!pdfBlobUrl) await generatePreview();
    if (pdfBlobUrl) {
      const link = document.createElement('a');
      link.href = pdfBlobUrl;
      link.download = `contract-renewal-${renewal.employee?.emp_code}.pdf`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    }
  }, [pdfBlobUrl, generatePreview, renewal]);

  if (loading) return <div className="p-20 text-center text-slate-500">Loading...</div>;
  if (!renewal) return <div className="p-20 text-center text-red-500">Renewal not found</div>;

  const canSupervisorApprove = renewal.status === 'pending' && renewal.supervisor_id;
  const canManagerSign = renewal.status === 'supervisor_approved' || (renewal.status === 'signed' && !renewal.manager_approved_at);
  const canHRApprove = (renewal.status === 'manager_approved' || renewal.status === 'signed') && !renewal.hr_signed_at;
  const canReject = ['pending', 'signed', 'supervisor_approved', 'manager_approved'].includes(renewal.status);

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="sm" onClick={() => router.push('/dashboard/contract-renewal')}>
          <ArrowLeft className="w-4 h-4 mr-2" />
          Back to List
        </Button>
        <h1 className="text-3xl font-bold tracking-tight">Renewal Details</h1>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="md:col-span-2 space-y-6">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle>Contract Renewal Form</CardTitle>
                <CardDescription>Status and signature tracking</CardDescription>
              </div>
              <div className="flex gap-2 flex-wrap">
                <Button variant="outline" onClick={generatePreview} disabled={isGeneratingPdf}>
                  {isGeneratingPdf ? (
                    <div className="w-4 h-4 border-2 border-slate-900 border-t-transparent rounded-full animate-spin mr-2" />
                  ) : (
                    <Eye className="w-4 h-4 mr-2" />
                  )}
                  Preview
                </Button>

                {canSupervisorApprove && (
                  <Button onClick={() => setShowSupervisorSignature(true)} variant="secondary">
                    <UserCheck className="w-4 h-4 mr-2" />
                    Supervisor Approve
                  </Button>
                )}

                {canManagerSign && (
                  <Button onClick={() => setShowManagerSignature(true)} variant="secondary">
                    <SignatureIcon className="w-4 h-4 mr-2" />
                    Manager Sign
                  </Button>
                )}

                {canHRApprove && (
                  <Button onClick={() => setShowHRSignature(true)} variant="secondary" disabled={processing}>
                    <SignatureIcon className="w-4 h-4 mr-2" />
                    HR Sign & Approve
                  </Button>
                )}

                {canReject && (
                  <Button onClick={() => setShowRejectDialog(true)} variant="destructive" disabled={processing}>
                    <XCircle className="w-4 h-4 mr-2" />
                    Reject
                  </Button>
                )}

                {(renewal.status === 'hr_approved' || renewal.signed_pdf_url) && (
                  <Button variant="outline" onClick={downloadPdf}>
                    <Download className="w-4 h-4 mr-2" />
                    Download PDF
                  </Button>
                )}

                {isSuperAdmin && (
                  <Button
                    variant="outline"
                    onClick={() => setDeleteDialogOpen(true)}
                    className="text-red-600 hover:text-red-700 hover:bg-red-50"
                    disabled={processing}
                  >
                    <Trash2 className="w-4 h-4 mr-2" />
                    Delete
                  </Button>
                )}
              </div>
            </CardHeader>
            <CardContent className="space-y-8">
              {/* Status Stepper */}
              <div className="flex items-center justify-between border-b pb-8 overflow-x-auto">
                {/* Initiated */}
                <div className="flex flex-col items-center gap-2 min-w-[80px]">
                  <div className={`w-10 h-10 rounded-full flex items-center justify-center ${renewal.created_at ? 'bg-green-100 text-green-600' : 'bg-slate-100 text-slate-400'}`}>
                    <FileText className="w-5 h-5" />
                  </div>
                  <span className="text-xs font-medium text-center">Initiated</span>
                </div>
                <div className="flex-1 h-px bg-slate-200 mx-2 min-w-[20px]" />

                {/* Supervisor Approved */}
                <div className="flex flex-col items-center gap-2 min-w-[80px]">
                  <div className={`w-10 h-10 rounded-full flex items-center justify-center ${renewal.supervisor_approved_at ? 'bg-green-100 text-green-600' : 'bg-slate-100 text-slate-400'}`}>
                    <UserCheck className="w-5 h-5" />
                  </div>
                  <span className="text-xs font-medium text-center">Supervisor</span>
                </div>
                <div className="flex-1 h-px bg-slate-200 mx-2 min-w-[20px]" />

                {/* Employee Signed */}
                <div className="flex flex-col items-center gap-2 min-w-[80px]">
                  <div className={`w-10 h-10 rounded-full flex items-center justify-center ${renewal.employee_signed_at ? 'bg-green-100 text-green-600' : 'bg-slate-100 text-slate-400'}`}>
                    <SignatureIcon className="w-5 h-5" />
                  </div>
                  <span className="text-xs font-medium text-center">Employee Signed</span>
                </div>
                <div className="flex-1 h-px bg-slate-200 mx-2 min-w-[20px]" />

                {/* Manager Approved */}
                <div className="flex flex-col items-center gap-2 min-w-[80px]">
                  <div className={`w-10 h-10 rounded-full flex items-center justify-center ${renewal.manager_approved_at ? 'bg-green-100 text-green-600' : 'bg-slate-100 text-slate-400'}`}>
                    <Users className="w-5 h-5" />
                  </div>
                  <span className="text-xs font-medium text-center">Manager</span>
                </div>
                <div className="flex-1 h-px bg-slate-200 mx-2 min-w-[20px]" />

                {/* HR Approved */}
                <div className="flex flex-col items-center gap-2 min-w-[80px]">
                  <div className={`w-10 h-10 rounded-full flex items-center justify-center ${renewal.hr_approved_at ? 'bg-green-100 text-green-600' : 'bg-slate-100 text-slate-400'}`}>
                    <ShieldCheck className="w-5 h-5" />
                  </div>
                  <span className="text-xs font-medium text-center">HR Approved</span>
                </div>
              </div>

              {/* Employee & Company Summary */}
              <div className="grid grid-cols-2 gap-8">
                <div className="space-y-4">
                  <h3 className="text-sm font-bold uppercase tracking-wider text-slate-400">Employee Details</h3>
                  <div className="space-y-2">
                    <div className="flex items-center gap-3">
                      <User className="w-4 h-4 text-slate-400" />
                      <span className="font-medium">{renewal.employee?.name_en}</span>
                    </div>
                    <div className="text-sm text-slate-500 pl-7">{renewal.employee?.designation}</div>
                    <div className="text-sm text-slate-500 pl-7">ID: {renewal.employee?.emp_code}</div>
                  </div>
                </div>
                <div className="space-y-4">
                  <h3 className="text-sm font-bold uppercase tracking-wider text-slate-400">Contract Terms</h3>
                  <div className="space-y-2">
                    <div className="flex items-center gap-3">
                      <Calendar className="w-4 h-4 text-slate-400" />
                      <span className="font-medium">{renewal.renewal_period_years} Years Renewal</span>
                    </div>
                    <div className="text-sm text-slate-500 pl-7">New Gross: {renewal.gross_salary.toFixed(3)} OMR</div>
                    {renewal.expires_at && (
                      <div className="text-sm text-slate-500 pl-7">
                        Expires: {format(new Date(renewal.expires_at), 'dd MMM yyyy')}
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Signature Previews */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {renewal.employee_signature_url && (
                  <div className="p-4 border rounded-lg bg-slate-50">
                    <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-4">Employee Signature</h3>
                    <img src={renewal.employee_signature_url} alt="Signature" className="h-20 object-contain" />
                    <div className="mt-2 text-[10px] text-slate-400">
                      Signed on {format(new Date(renewal.employee_signed_at), 'dd MMM yyyy HH:mm')}
                    </div>
                    {renewal.employee_signature_ip && (
                      <div className="text-[10px] text-slate-400">
                        IP: {renewal.employee_signature_ip}
                      </div>
                    )}
                  </div>
                )}

                {renewal.manager_signature_url && (
                  <div className="p-4 border rounded-lg bg-slate-50">
                    <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-4">Manager Signature</h3>
                    <img src={renewal.manager_signature_url} alt="Signature" className="h-20 object-contain" />
                    <div className="mt-2 text-[10px] text-slate-400">
                      Signed on {format(new Date(renewal.manager_approved_at), 'dd MMM yyyy HH:mm')}
                    </div>
                  </div>
                )}
              </div>

              {/* Supervisor Signature Section */}
              {showSupervisorSignature && (
                <div className="p-6 border-2 border-primary border-dashed rounded-xl bg-primary/5 space-y-4 animate-in fade-in slide-in-from-top-4 duration-300">
                  <div className="flex justify-between items-center">
                    <h3 className="text-sm font-bold text-primary flex items-center gap-2">
                      <UserCheck className="w-4 h-4" />
                      Supervisor Approval
                    </h3>
                    <Button variant="ghost" size="sm" onClick={() => setShowSupervisorSignature(false)} className="text-slate-500">
                      Cancel
                    </Button>
                  </div>
                  <p className="text-xs text-slate-600">
                    As the immediate supervisor, please provide your approval for this contract renewal.
                    Comments are optional.
                  </p>
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Comments (optional)</label>
                    <textarea
                      className="w-full p-2 border rounded-md text-sm"
                      rows={3}
                      placeholder="Add any comments..."
                      onChange={(e) => {
                        // Store temporarily, will be sent on approve
                        (window as any).__supervisorComments = e.target.value;
                      }}
                    />
                  </div>
                  <div className="flex gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => {
                        handleSupervisorApprove((window as any).__supervisorComments);
                      }}
                      disabled={processing}
                    >
                      Approve Without Signature
                    </Button>
                  </div>
                </div>
              )}

              {/* Manager Signature Pad Section */}
              {showManagerSignature && (
                <div className="p-6 border-2 border-primary border-dashed rounded-xl bg-primary/5 space-y-4 animate-in fade-in slide-in-from-top-4 duration-300">
                  <div className="flex justify-between items-center">
                    <h3 className="text-sm font-bold text-primary flex items-center gap-2">
                      <SignatureIcon className="w-4 h-4" />
                      Manager / HOD Digital Signature
                    </h3>
                    <Button variant="ghost" size="sm" onClick={() => setShowManagerSignature(false)} className="text-slate-500">
                      Cancel
                    </Button>
                  </div>
                  <p className="text-xs text-slate-600">
                    As HOD/Project Manager, please sign below to approve this contract renewal.
                  </p>
                  <SignaturePad
                    onSave={handleManagerSign}
                    placeholder="Sign as Manager / HOD"
                  />
                </div>
              )}

              {/* HR Signature Pad Section */}
              {showHRSignature && (
                <div className="p-6 border-2 border-emerald-500 border-dashed rounded-xl bg-emerald-50 space-y-4 animate-in fade-in slide-in-from-top-4 duration-300">
                  <div className="flex justify-between items-center">
                    <h3 className="text-sm font-bold text-emerald-700 flex items-center gap-2">
                      <ShieldCheck className="w-4 h-4" />
                      HR Department Final Approval & Signature
                    </h3>
                    <Button variant="ghost" size="sm" onClick={() => setShowHRSignature(false)} className="text-slate-500">
                      Cancel
                    </Button>
                  </div>
                  <p className="text-xs text-slate-600">
                    As HR, please sign below to grant final approval on this contract renewal.
                  </p>
                  <SignaturePad
                    onSave={handleHRApprove}
                    placeholder="Sign as HR Representative"
                  />
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          <Card className="bg-slate-900 text-white border-none">
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <Clock className="w-4 h-4" />
                Next Steps
              </CardTitle>
            </CardHeader>
            <CardContent className="text-sm text-slate-300 space-y-4">
              {renewal.status === 'pending' && (
                <p>Waiting for supervisor approval or employee signature (depending on workflow).</p>
              )}
              {renewal.status === 'supervisor_approved' && (
                <p>Supervisor has approved. Waiting for employee to sign the contract.</p>
              )}
              {renewal.status === 'signed' && (
                <p>Employee has signed. Awaiting manager and HR approvals.</p>
              )}
              {renewal.status === 'manager_approved' && (
                <p>Manager has approved. Awaiting final HR approval.</p>
              )}
              {renewal.status === 'hr_approved' && (
                <p>Contract renewal completed. The new terms are now in effect.</p>
              )}
              {renewal.status === 'rejected' && (
                <p className="text-red-300">This renewal has been rejected. {renewal.rejection_reason ? `Reason: ${renewal.rejection_reason}` : ''}</p>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Audit Log</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex gap-3">
                <div className="w-2 h-2 rounded-full bg-green-500 mt-1.5" />
                <div className="space-y-1">
                  <p className="text-sm font-medium">Request Created</p>
                  <p className="text-xs text-slate-500">{format(new Date(renewal.created_at), 'dd MMM yyyy HH:mm')}</p>
                </div>
              </div>
              {renewal.supervisor_approved_at && (
                <div className="flex gap-3">
                  <div className="w-2 h-2 rounded-full bg-blue-500 mt-1.5" />
                  <div className="space-y-1">
                    <p className="text-sm font-medium">Supervisor Approved</p>
                    <p className="text-xs text-slate-500">{format(new Date(renewal.supervisor_approved_at), 'dd MMM yyyy HH:mm')}</p>
                  </div>
                </div>
              )}
              {renewal.employee_signed_at && (
                <div className="flex gap-3">
                  <div className="w-2 h-2 rounded-full bg-blue-500 mt-1.5" />
                  <div className="space-y-1">
                    <p className="text-sm font-medium">Employee Signed</p>
                    <p className="text-xs text-slate-500">{format(new Date(renewal.employee_signed_at), 'dd MMM yyyy HH:mm')}</p>
                  </div>
                </div>
              )}
              {renewal.manager_approved_at && (
                <div className="flex gap-3">
                  <div className="w-2 h-2 rounded-full bg-purple-500 mt-1.5" />
                  <div className="space-y-1">
                    <p className="text-sm font-medium">Manager Approved</p>
                    <p className="text-xs text-slate-500">{format(new Date(renewal.manager_approved_at), 'dd MMM yyyy HH:mm')}</p>
                  </div>
                </div>
              )}
              {renewal.hr_approved_at && (
                <div className="flex gap-3">
                  <div className="w-2 h-2 rounded-full bg-green-500 mt-1.5" />
                  <div className="space-y-1">
                    <p className="text-sm font-medium">Final HR Approval</p>
                    <p className="text-xs text-slate-500">{format(new Date(renewal.hr_approved_at), 'dd MMM yyyy HH:mm')}</p>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      {/* PDF Preview Dialog */}
      <Dialog open={showPdfPreview} onOpenChange={setShowPdfPreview}>
        <DialogContent className="max-w-5xl h-[90vh] p-0 overflow-hidden bg-slate-900 border-none">
          <DialogHeader className="p-6 bg-slate-900 text-white flex flex-row items-center justify-between space-y-0 border-b border-white/10">
            <div>
              <DialogTitle>Document Preview</DialogTitle>
              <DialogDescription className="text-slate-400">Contract Renewal Form for {renewal.employee?.name_en}</DialogDescription>
            </div>
            <div className="flex gap-2">
              <Button onClick={downloadPdf} variant="secondary" size="sm">
                <FileDown className="w-4 h-4 mr-2" />
                Download
              </Button>
              <Button onClick={() => pdfBlobUrl && window.open(pdfBlobUrl, '_blank')} variant="outline" size="sm" className="text-white border-white/20 hover:bg-white/10">
                <Printer className="w-4 h-4 mr-2" />
                Print
              </Button>
            </div>
          </DialogHeader>
          <div className="flex-1 w-full h-full bg-slate-800">
            {pdfBlobUrl ? (
              <iframe src={pdfBlobUrl} className="w-full h-full border-none" title="PDF Preview" />
            ) : (
              <div className="flex items-center justify-center h-full text-white">
                Generating preview...
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Reject Confirmation Dialog */}
      <AlertDialog open={showRejectDialog} onOpenChange={setShowRejectDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Reject Contract Renewal</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to reject this contract renewal? This action cannot be undone.
              Please provide a reason for rejection.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="py-4">
            <label className="text-sm font-medium mb-2 block">Rejection Reason *</label>
            <textarea
              className="w-full p-2 border rounded-md text-sm"
              rows={3}
              placeholder="Explain why this renewal is being rejected..."
              value={rejectionReason}
              onChange={(e) => setRejectionReason(e.target.value)}
            />
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleReject}
              disabled={processing || !rejectionReason.trim()}
              className="bg-red-600 hover:bg-red-700"
            >
              {processing ? 'Rejecting...' : 'Reject Renewal'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Contract Renewal?</AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone. The contract renewal record and any associated signatures will be permanently removed.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              disabled={deleting}
              className="bg-red-600 hover:bg-red-700"
            >
              {deleting ? 'Deleting...' : 'Delete'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
