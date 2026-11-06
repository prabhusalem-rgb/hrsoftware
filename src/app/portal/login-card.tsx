'use client';

import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { UserCheck, ShieldCheck, ArrowRight, Loader2, Building2, CalendarDays, Clock, FileText } from 'lucide-react';
import { portalLogin } from './actions';
import { toast } from 'sonner';

interface LoginCardProps {
  companies: Array<{ id: string; name_en: string; logo_url?: string | null }>;
  initialCompanyId?: string | null;
  onLoginSuccess?: () => void;
}

export function LoginCard({ companies, initialCompanyId, onLoginSuccess }: LoginCardProps) {
  const [companyId, setCompanyId] = useState<string>(
    initialCompanyId || (companies.length > 0 ? companies[0].id : '')
  );
  const [identifier, setIdentifier] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!companyId) {
      setError('Please select your company');
      return;
    }

    if (!identifier.trim()) {
      setError('Please enter your Employee Code or Civil ID');
      return;
    }

    setLoading(true);
    try {
      const res = await portalLogin(companyId, identifier.trim());
      if (res.error) {
        setError(res.error);
        toast.error(res.error);
        setLoading(false);
      } else {
        toast.success(`Welcome back, ${res.employee?.name_en || 'Employee'}!`);
        if (onLoginSuccess) {
          onLoginSuccess();
        } else {
          window.location.reload();
        }
      }
    } catch (err: any) {
      setError(err.message || 'Login failed. Please try again.');
      toast.error('Connection failed. Please check network.');
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 via-indigo-50/30 to-blue-50/50 p-4 sm:p-6 lg:p-8">
      {/* Decorative backdrop blobs */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-40 -right-40 w-96 h-96 rounded-full bg-blue-100/50 blur-3xl" />
        <div className="absolute -bottom-40 -left-40 w-96 h-96 rounded-full bg-indigo-100/50 blur-3xl" />
      </div>

      <div className="w-full max-w-lg relative animate-in fade-in-50 zoom-in-95 duration-300">
        <div className="text-center mb-8 space-y-2">
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-indigo-100/80 text-indigo-700 text-xs font-bold uppercase tracking-wider">
            <UserCheck className="w-3.5 h-3.5" />
            Employee Self-Service Portal
          </div>
          <h1 className="text-3xl sm:text-4xl font-black text-slate-900 tracking-tight">
            Employee Portal
          </h1>
          <p className="text-slate-500 text-sm max-w-sm mx-auto">
            View your daily attendance, leave balances, availed history, and submit leave applications.
          </p>
        </div>

        <Card className="border-0 shadow-2xl shadow-indigo-100/70 rounded-[2rem] bg-white/95 backdrop-blur overflow-hidden">
          <div className="h-2 w-full bg-gradient-to-r from-blue-600 via-indigo-600 to-indigo-500" />
          
          <CardHeader className="pb-4 pt-8 px-8">
            <CardTitle className="text-xl font-bold text-slate-900">Sign In to Your Portal</CardTitle>
            <CardDescription className="text-slate-500 text-sm">
              Enter your Company and Employee Code or Civil ID to access your records.
            </CardDescription>
          </CardHeader>

          <CardContent className="px-8 pb-8 pt-2">
            <form onSubmit={handleSubmit} className="space-y-5">
              {/* Company Selection */}
              <div className="space-y-1.5">
                <Label htmlFor="company" className="text-xs font-bold uppercase tracking-wider text-slate-700 flex items-center gap-1.5">
                  <Building2 className="w-3.5 h-3.5 text-indigo-600" />
                  Company
                </Label>
                <Select value={companyId} onValueChange={(val) => setCompanyId(val || '')}>
                  <SelectTrigger id="company" className="h-12 rounded-xl bg-slate-50 border-slate-200 text-slate-900 font-medium">
                    <SelectValue placeholder="Select your company..." />
                  </SelectTrigger>
                  <SelectContent className="rounded-xl">
                    {companies.map(c => (
                      <SelectItem key={c.id} value={c.id} className="py-2.5 font-medium">
                        {c.name_en}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Employee Identifier */}
              <div className="space-y-1.5">
                <Label htmlFor="identifier" className="text-xs font-bold uppercase tracking-wider text-slate-700 flex items-center gap-1.5">
                  <UserCheck className="w-3.5 h-3.5 text-indigo-600" />
                  Employee Code / Civil ID / Passport
                </Label>
                <Input
                  id="identifier"
                  type="text"
                  placeholder="e.g. 101 or 12345678"
                  value={identifier}
                  onChange={(e) => setIdentifier(e.target.value)}
                  className="h-12 rounded-xl bg-slate-50 border-slate-200 font-medium text-slate-900 placeholder:text-slate-400"
                  autoFocus
                  required
                />
                <p className="text-[11px] text-slate-400">
                  Tip: You can use your assigned Employee Code (e.g. 101) or Civil ID card number.
                </p>
              </div>

              {error && (
                <div className="p-3.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs font-medium flex items-center gap-2">
                  <span className="w-1.5 h-1.5 rounded-full bg-rose-500 flex-shrink-0" />
                  {error}
                </div>
              )}

              <Button
                type="submit"
                disabled={loading}
                className="w-full h-12 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-sm shadow-lg shadow-indigo-200 transition-all gap-2"
              >
                {loading ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Verifying Identity...
                  </>
                ) : (
                  <>
                    Access My Portal
                    <ArrowRight className="w-4 h-4" />
                  </>
                )}
              </Button>
            </form>

            {/* Portal Capabilities Overview */}
            <div className="mt-8 pt-6 border-t border-slate-100 grid grid-cols-3 gap-3 text-center">
              <div className="space-y-1">
                <div className="w-8 h-8 rounded-lg bg-blue-50 text-blue-600 mx-auto flex items-center justify-center">
                  <Clock className="w-4 h-4" />
                </div>
                <div className="text-[11px] font-bold text-slate-700">Daily Attendance</div>
                <div className="text-[10px] text-slate-400">View OT &amp; hours</div>
              </div>
              <div className="space-y-1">
                <div className="w-8 h-8 rounded-lg bg-emerald-50 text-emerald-600 mx-auto flex items-center justify-center">
                  <CalendarDays className="w-4 h-4" />
                </div>
                <div className="text-[11px] font-bold text-slate-700">Leave Balances</div>
                <div className="text-[10px] text-slate-400">Annual &amp; availed</div>
              </div>
              <div className="space-y-1">
                <div className="w-8 h-8 rounded-lg bg-indigo-50 text-indigo-600 mx-auto flex items-center justify-center">
                  <FileText className="w-4 h-4" />
                </div>
                <div className="text-[11px] font-bold text-slate-700">Apply Leaves</div>
                <div className="text-[10px] text-slate-400">Annual &amp; Sick</div>
              </div>
            </div>
          </CardContent>
        </Card>

        <div className="mt-6 text-center text-xs text-slate-400 flex items-center justify-center gap-1.5">
          <ShieldCheck className="w-3.5 h-3.5" />
          Secured by HR Software • Powered by Oman Labour Law Compliance
        </div>
      </div>
    </div>
  );
}
