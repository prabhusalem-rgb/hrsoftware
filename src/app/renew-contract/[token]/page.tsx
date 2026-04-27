'use client';

import React, { useEffect, useState, useRef } from 'react';
import { useParams } from 'next/navigation';
import { SignaturePad } from '@/components/hr/SignaturePad';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { FileText, Building2, User, Calendar, ShieldCheck, AlertTriangle } from 'lucide-react';

export default function RenewContractPage() {
  const { token } = useParams();
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [data, setData] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  useEffect(() => {
    const fetchData = async () => {
      abortControllerRef.current = new AbortController();
      try {
        const res = await fetch(`/api/contract-renewal/${token}`, {
          signal: abortControllerRef.current.signal,
        });
        if (!res.ok) {
          const json = await res.json().catch(() => ({}));
          throw new Error(json.error || 'Contract not found or link expired');
        }
        const json = await res.json();
        setData(json);
      } catch (err: any) {
        if (err.name !== 'AbortError') {
          setError(err.message);
          toast.error(err.message);
        }
      } finally {
        if (!abortControllerRef.current?.signal.aborted) {
          setLoading(false);
        }
      }
    };
    fetchData();

    return () => {
      abortControllerRef.current?.abort();
    };
  }, [token]);

  const handleSign = async (signatureDataUrl: string) => {
    setSubmitting(true);
    try {
      const res = await fetch(`/api/contract-renewal/${token}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ signature_data_url: signatureDataUrl }),
      });

      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || 'Failed to submit signature');
      }

      toast.success('Contract signed successfully!');
      setData((prev: any) => ({ ...prev, status: 'signed' }));
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
        <Card className="w-full max-w-2xl">
          <CardHeader>
            <Skeleton className="h-8 w-3/4 mb-2" />
            <Skeleton className="h-4 w-1/2" />
          </CardHeader>
          <CardContent className="space-y-4">
            <Skeleton className="h-32 w-full" />
            <Skeleton className="h-32 w-full" />
          </CardContent>
        </Card>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
        <Card className="w-full max-w-md text-center py-12">
          <CardContent>
            <div className="w-16 h-16 bg-red-100 text-red-600 rounded-full flex items-center justify-center mx-auto mb-4">
              <FileText className="w-8 h-8" />
            </div>
            <h1 className="text-xl font-bold text-slate-900 mb-2">Invalid or Expired Link</h1>
            <p className="text-slate-500">
              {error}
              <br /><br />
              Please contact your HR department for assistance.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
        <Card className="w-full max-w-md text-center py-12">
          <CardContent>
            <div className="w-16 h-16 bg-slate-100 text-slate-600 rounded-full flex items-center justify-center mx-auto mb-4">
              <FileText className="w-8 h-8" />
            </div>
            <h1 className="text-xl font-bold text-slate-900 mb-2">Loading...</h1>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (data.status !== 'pending') {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
        <Card className="w-full max-w-md text-center py-12">
          <CardContent>
            <div className="w-16 h-16 bg-green-100 text-green-600 rounded-full flex items-center justify-center mx-auto mb-4">
              <ShieldCheck className="w-8 h-8" />
            </div>
            <h1 className="text-xl font-bold text-slate-900 mb-2">Contract Already Signed</h1>
            <p className="text-slate-500 mb-6">
              You have already signed this contract renewal. It is currently being processed by HR.
            </p>
            <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200 py-1 px-3">
              Status: {data.status.replace('_', ' ').toUpperCase()}
            </Badge>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Check expiry warning
  const expiresAt = data.expires_at ? new Date(data.expires_at) : null;
  const expiringSoon = expiresAt && expiresAt < new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

  return (
    <div className="min-h-screen bg-slate-100 py-8 px-4 sm:px-6">
      <div className="max-w-2xl mx-auto space-y-6">
        {/* Header/Company Branding */}
        <div className="text-center space-y-2">
          <div className="inline-flex items-center justify-center p-3 bg-white rounded-xl shadow-sm mb-2">
            <Building2 className="w-8 h-8 text-slate-900" />
          </div>
          <h1 className="text-2xl font-bold text-slate-900">{data.company.name_en}</h1>
          <p className="text-slate-500 text-sm">{data.company.address}</p>
        </div>

        {/* Expiry warning */}
        {expiringSoon && (
          <Card className="border-amber-200 bg-amber-50">
            <CardContent className="pt-6 flex items-start gap-3">
              <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
              <div className="text-sm text-amber-800">
                <p className="font-semibold">Link Expiring Soon</p>
                <p className="text-amber-700">
                  This signing link will expire on {expiresAt.toLocaleDateString()}.
                  Please complete your signature before then.
                </p>
              </div>
            </CardContent>
          </Card>
        )}

        <Card className="border-none shadow-xl overflow-hidden">
          <div className="h-2 bg-slate-900 w-full" />
          <CardHeader className="bg-white border-bottom border-slate-100">
            <CardTitle className="text-xl flex items-center gap-2">
              <FileText className="w-5 h-5 text-slate-900" />
              Contract Renewal Form
            </CardTitle>
            <CardDescription>
              Please review your details and sign at the bottom to renew your contract.
            </CardDescription>
          </CardHeader>

          <CardContent className="p-0">
            <div className="divide-y divide-slate-100">
              {/* Employee Info */}
              <div className="p-6 grid grid-cols-1 sm:grid-cols-2 gap-6 bg-slate-50/50">
                <div className="space-y-1">
                  <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Employee Name</span>
                  <div className="flex items-center gap-2 font-medium text-slate-900">
                    <User className="w-4 h-4 text-slate-400" />
                    {data.employee.name_en}
                  </div>
                </div>
                <div className="space-y-1">
                  <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Employee ID</span>
                  <div className="font-medium text-slate-900">{data.employee.emp_code}</div>
                </div>
                <div className="space-y-1">
                  <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Designation</span>
                  <div className="font-medium text-slate-900">{data.employee.designation}</div>
                </div>
                <div className="space-y-1">
                  <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Joining Date</span>
                  <div className="flex items-center gap-2 font-medium text-slate-900">
                    <Calendar className="w-4 h-4 text-slate-400" />
                    {new Date(data.employee.join_date).toLocaleDateString()}
                  </div>
                </div>
              </div>

              {/* Salary Breakdown */}
              <div className="p-6 space-y-4">
                <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wider">Salary Breakdown</h3>
                <div className="space-y-2">
                  <div className="flex justify-between items-center text-sm">
                    <span className="text-slate-600">Basic Salary</span>
                    <span className="font-mono font-bold text-slate-900">{data.basic_salary.toFixed(3)} OMR</span>
                  </div>
                  <div className="flex justify-between items-center text-sm">
                    <span className="text-slate-600">Total Allowances</span>
                    <span className="font-mono font-bold text-slate-900">
                      {(data.gross_salary - data.basic_salary).toFixed(3)} OMR
                    </span>
                  </div>
                  <div className="pt-2 border-t border-slate-100 flex justify-between items-center">
                    <span className="font-bold text-slate-900">Gross Monthly Pay</span>
                    <span className="font-mono text-lg font-bold text-slate-900">{data.gross_salary.toFixed(3)} OMR</span>
                  </div>
                </div>
              </div>

              {/* Declaration */}
              <div className="p-6 bg-blue-50/50">
                <h3 className="text-sm font-bold text-blue-900 uppercase tracking-wider mb-2">Declaration</h3>
                <p className="text-slate-700 italic text-sm leading-relaxed">
                  {"I hereby agree and I am willing to work at "}
                  <span className="font-bold text-slate-900">{data.company.name_en}</span>
                  {" and therefore I am requesting you to kindly renew my contract for a further period of "}
                  <span className="font-bold text-slate-900">{data.renewal_period_years} years</span>
                  {"."}
                </p>
              </div>

              {/* Signature Area */}
              <div className="p-6 space-y-4 bg-white">
                <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wider mb-2">Digital Signature</h3>
                <p className="text-xs text-slate-500 mb-4">
                  Please use your finger or a stylus to sign inside the box below.
                  <br />
                  <span className="text-amber-600 font-medium">
                    Your IP address will be recorded for security purposes.
                  </span>
                </p>

                <SignaturePad
                  onSave={handleSign}
                  placeholder="Sign here to confirm renewal"
                />

                {submitting && (
                  <div className="fixed inset-0 bg-slate-900/20 backdrop-blur-sm flex items-center justify-center z-50">
                    <div className="bg-white p-6 rounded-xl shadow-xl flex items-center gap-4">
                      <div className="w-6 h-6 border-2 border-slate-900 border-t-transparent rounded-full animate-spin" />
                      <span className="font-bold text-slate-900">Saving your signature...</span>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Footer info */}
        <p className="text-center text-xs text-slate-400 pb-8">
          This is a secure digital document. Your signature, IP address, and timestamp will be recorded upon submission.
        </p>
      </div>
    </div>
  );
}
