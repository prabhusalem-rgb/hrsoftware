'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { loginSubmitter } from './actions';
import { Loader2, ShieldCheck, User, Lock, Eye, EyeOff, Building2, AlertCircle } from 'lucide-react';

interface SubmitterLoginCardProps {
  token: string;
  companyName: string;
  companyLogo?: string | null;
}

export function SubmitterLoginCard({ token, companyName, companyLogo }: SubmitterLoginCardProps) {
  const router = useRouter();
  const [identifier, setIdentifier] = useState('');
  const [civilIdPassword, setCivilIdPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    const trimmedId = identifier.trim();
    const trimmedPw = civilIdPassword.trim();

    if (!trimmedId) {
      setErrorMessage('Please enter your Employee Code or User ID.');
      return;
    }
    if (!trimmedPw) {
      setErrorMessage('Please enter your Civil ID as password.');
      return;
    }

    setIsLoading(true);
    try {
      const res = await loginSubmitter(token, trimmedId, trimmedPw);
      if (!res.success || !res.submitter) {
        setErrorMessage(res.error || 'Invalid credentials. Please verify your Employee Code and Civil ID.');
        toast.error(res.error || 'Verification failed');
        return;
      }

      toast.success(`Welcome, ${res.submitter.name_en}`);
      router.refresh();
      // In case router.refresh takes a moment, fallback reload
      setTimeout(() => {
        window.location.reload();
      }, 300);
    } catch (err: any) {
      console.error('[SubmitterLoginCard] Login error:', err);
      setErrorMessage(err?.message || 'An unexpected error occurred during verification.');
      toast.error('An unexpected error occurred. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Card className="w-full max-w-md shadow-lg border-muted/80">
      <CardHeader className="text-center space-y-3 pb-4">
        {/* Company Header / Logo */}
        <div className="flex justify-center">
          {companyLogo ? (
            <img
              src={companyLogo}
              alt={companyName}
              className="h-14 w-auto object-contain rounded-md p-1 border bg-white shadow-sm"
            />
          ) : (
            <div className="h-14 w-14 rounded-xl bg-primary/10 text-primary flex items-center justify-center font-bold text-xl border shadow-sm">
              <Building2 className="h-7 w-7" />
            </div>
          )}
        </div>

        <div>
          <CardTitle className="text-xl font-bold tracking-tight">
            Timesheet Submitter Login
          </CardTitle>
          <CardDescription className="text-xs text-muted-foreground mt-1">
            {companyName}
          </CardDescription>
        </div>

        <div className="bg-muted/60 rounded-md p-2.5 text-xs text-muted-foreground text-left flex items-start gap-2 border">
          <ShieldCheck className="h-4 w-4 text-primary shrink-0 mt-0.5" />
          <span>
            Please identify yourself to record who submitted this timesheet.
            Use your <strong>Employee Code</strong> as User ID and <strong>Civil ID</strong> as Password.
          </span>
        </div>
      </CardHeader>

      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          {errorMessage && (
            <div className="p-3 text-xs bg-destructive/10 border border-destructive/20 text-destructive rounded-md flex items-center gap-2">
              <AlertCircle className="h-4 w-4 shrink-0" />
              <span>{errorMessage}</span>
            </div>
          )}

          <div className="space-y-1.5">
            <Label htmlFor="identifier" className="text-xs font-semibold">
              Employee ID / Code
            </Label>
            <div className="relative">
              <User className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                id="identifier"
                type="text"
                autoComplete="username"
                value={identifier}
                onChange={(e) => setIdentifier(e.target.value)}
                placeholder="e.g. EMP-001"
                className="pl-9 text-sm"
                disabled={isLoading}
                autoFocus
              />
            </div>
            <p className="text-[11px] text-muted-foreground">
              Your company employee number or code.
            </p>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="civilIdPassword" className="text-xs font-semibold">
              Civil ID (Password)
            </Label>
            <div className="relative">
              <Lock className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                id="civilIdPassword"
                type={showPassword ? 'text' : 'password'}
                autoComplete="current-password"
                value={civilIdPassword}
                onChange={(e) => setCivilIdPassword(e.target.value)}
                placeholder="Enter Civil ID number"
                className="pl-9 pr-10 text-sm"
                disabled={isLoading}
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                tabIndex={-1}
                className="absolute right-3 top-2.5 text-muted-foreground hover:text-foreground"
                aria-label={showPassword ? 'Hide Civil ID' : 'Show Civil ID'}
              >
                {showPassword ? (
                  <EyeOff className="h-4 w-4" />
                ) : (
                  <Eye className="h-4 w-4" />
                )}
              </button>
            </div>
            <p className="text-[11px] text-muted-foreground">
              Used as a secure passcode to authenticate your identity.
            </p>
          </div>

          <Button
            type="submit"
            className="w-full mt-2"
            disabled={isLoading}
          >
            {isLoading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Verifying Credentials...
              </>
            ) : (
              'Verify & Continue'
            )}
          </Button>
        </form>
      </CardContent>

      <CardFooter className="pt-0 justify-center">
        <p className="text-[11px] text-muted-foreground text-center">
          Need help with your credentials? Contact your site supervisor or HR administrator.
        </p>
      </CardFooter>
    </Card>
  );
}
