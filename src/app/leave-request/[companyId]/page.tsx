import { getLeaveRequestFormData } from './actions';
import { LeaveForm } from './leave-form';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Plane, ShieldCheck } from 'lucide-react';

export const metadata = {
  title: 'Public Leave Request | HR Software',
  description: 'Submit your leave request professionally with digital signature.',
};

export default async function LeaveRequestPublicPage({ 
  params 
}: { 
  params: Promise<{ companyId: string }> 
}) {
  const { companyId } = await params;
  const data = await getLeaveRequestFormData(companyId);

  if ('error' in data || !data) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-[#F8FAFC] p-4">
        <Card className="w-full max-w-md border-0 shadow-2xl rounded-3xl overflow-hidden">
          <div className="h-2 bg-red-500 w-full" />
          <CardHeader className="text-center pt-8">
            <div className="mx-auto w-16 h-16 bg-red-50 rounded-full flex items-center justify-center mb-4">
              <ShieldCheck className="w-8 h-8 text-red-500" />
            </div>
            <CardTitle className="text-2xl font-black text-slate-900">Access Denied</CardTitle>
            <CardDescription className="text-slate-500 mt-2">
              {data?.error || 'The link you followed is invalid or has expired.'}
            </CardDescription>
          </CardHeader>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#F8FAFC] py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-5xl mx-auto">
        <div className="text-center mb-10 space-y-2">
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-indigo-50 text-indigo-600 text-sm font-bold tracking-wide uppercase">
            <Plane className="w-4 h-4" />
            Digital Leave Application
          </div>
          <h1 className="text-4xl font-black text-slate-900 tracking-tight">
            {data.companyName}
          </h1>
          <p className="text-slate-500 text-lg">
            Please fill in your vacation details and authorize with your signature.
          </p>
        </div>

        <Card className="border-0 shadow-2xl shadow-indigo-100/50 rounded-[2.5rem] overflow-hidden bg-white">
          <CardHeader className="pb-2 px-8 pt-8">
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-2xl font-bold text-slate-900">Leave Request Form</CardTitle>
                <CardDescription className="text-slate-500">
                  Complete all sections to avoid delays in approval.
                </CardDescription>
              </div>
              <div className="hidden md:block">
                <div className="w-12 h-12 rounded-2xl bg-indigo-600 flex items-center justify-center shadow-lg shadow-indigo-200">
                  <FileText className="w-6 h-6 text-white" />
                </div>
              </div>
            </div>
          </CardHeader>
          <CardContent className="p-8">
            <LeaveForm
              companyId={data.companyId}
              employees={data.employees}
            />
          </CardContent>
        </Card>

        <div className="mt-12 text-center text-slate-400 text-sm flex items-center justify-center gap-2">
          <ShieldCheck className="w-4 h-4" />
          Secure digital submission powered by HR Software
        </div>
      </div>
    </div>
  );
}

import { FileText } from 'lucide-react';
