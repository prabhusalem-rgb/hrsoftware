'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import {
  UserPlus,
  FileText,
  ClipboardCheck,
  ChevronRight,
  Clock,
  CheckCircle2,
  LayoutDashboard,
  XCircle,
  Trash2
} from 'lucide-react';
import { useEmployees } from '@/hooks/queries/useEmployees';
import { useCompany } from '@/components/providers/CompanyProvider';
import dynamic from 'next/dynamic';
const OfferLetterWizard = dynamic(() => import('@/components/hr/OfferLetterWizard').then(mod => mod.OfferLetterWizard), { ssr: false });
const RegistrationWizard = dynamic(() => import('@/components/hr/RegistrationWizard').then(mod => mod.RegistrationWizard), { ssr: false });
import { useEmployeeMutations } from '@/hooks/queries/useEmployeeMutations';
import { toast } from 'sonner';
// import { OfferLetterWizard } from '@/components/hr/OfferLetterWizard';
// import { RegistrationWizard } from '@/components/hr/RegistrationWizard';
import { Employee, EmployeeFormData } from '@/types';

export default function OnboardingDashboard() {
  const { activeCompanyId } = useCompany();
  const { data: employeesData } = useEmployees({ companyId: activeCompanyId });
  const { createEmployee, updateEmployee, deleteEmployee } = useEmployeeMutations(activeCompanyId);
  const [offerWizardOpen, setOfferWizardOpen] = useState(false);
  const [registrationWizardOpen, setRegistrationWizardOpen] = useState(false);
  const [selectedEmp, setSelectedEmp] = useState<Employee | null>(null);

  const employees = employeesData || [];

  // Filter employees with onboarding status (excluding rejected)
  const onboardingPersonnel = employees.filter(emp =>
    emp.onboarding_status === 'offer_pending' ||
    emp.onboarding_status === 'ready_to_hire' ||
    (emp.onboarding_status === 'joined' && new Date(emp.join_date).getTime() > Date.now() - 30 * 24 * 60 * 60 * 1000)
  );

  const stats = {
    pending: onboardingPersonnel.filter(e => e.onboarding_status === 'offer_pending').length,
    ready: onboardingPersonnel.filter(e => e.onboarding_status === 'ready_to_hire').length,
    joined: onboardingPersonnel.filter(e => e.onboarding_status === 'joined').length,
  };

  return (
    <div className="space-y-8 animate-in fade-in duration-700">
      {/* High-Fidelity Premium Header */}
      <div className="relative group overflow-hidden rounded-[3rem] bg-slate-950 p-12 shadow-2xl flex flex-col md:flex-row justify-between items-start md:items-center gap-8 border border-white/5 transition-all hover:shadow-primary/5">
        <div className="absolute inset-0 bg-gradient-to-br from-primary/10 via-transparent to-emerald-500/5 opacity-50" />
        <div className="absolute -top-24 -right-24 w-96 h-96 bg-primary/20 rounded-full blur-[120px] animate-pulse pointer-events-none" />
        <div className="absolute -bottom-24 -left-24 w-96 h-96 bg-emerald-500/10 rounded-full blur-[120px] animate-pulse delay-700 pointer-events-none" />
        
        <div className="relative z-10 space-y-4">
          <div className="flex items-center gap-4">
             <div className="h-16 w-16 rounded-[2rem] bg-white/10 backdrop-blur-xl border border-white/10 flex items-center justify-center shadow-inner group-hover:scale-110 transition-transform duration-500">
                <UserPlus className="w-8 h-8 text-primary" />
             </div>
             <div>
                <h1 className="text-4xl font-black text-white italic tracking-tighter uppercase leading-none">
                  Personnel <span className="text-primary not-italic">Onboarding</span>
                </h1>
                <div className="flex items-center gap-2 mt-2">
                   <div className="h-1.5 w-1.5 rounded-full bg-primary animate-ping" />
                   <p className="text-xs font-black text-slate-400 uppercase tracking-widest leading-none">Lifecycle Architecture • Sultanate of Oman Compliance</p>
                </div>
             </div>
          </div>
          <p className="text-sm text-slate-400 font-medium max-w-lg leading-relaxed italic border-l-2 border-primary/20 pl-4">
            Managing the strategic transition of global talent into the Omani workforce through automated labor law compliance and real-time status orchestration.
          </p>
        </div>

        <div className="relative z-10 flex flex-col items-center gap-4">
          <Button 
            onClick={() => setOfferWizardOpen(true)}
            className="rounded-[2rem] h-16 px-10 bg-primary text-white font-black flex gap-3 shadow-2xl shadow-primary/30 hover:scale-105 active:scale-95 transition-all group/btn border-2 border-white/10"
          >
            <UserPlus className="w-6 h-6 group-hover/btn:rotate-12 transition-transform" /> 
            <span className="text-lg uppercase tracking-tight italic">Initiate Recruitment</span>
          </Button>
          <div className="flex items-center gap-2">
             <LayoutDashboard className="w-3 h-3 text-slate-500" />
             <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest">WPS Integrated System</p>
          </div>
        </div>
      </div>

      {/* Stats Overview */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {[
          { label: 'Offers Pending', value: stats.pending, icon: Clock, color: 'text-amber-600', bg: 'bg-amber-50' },
          { label: 'Ready to Register', value: stats.ready, icon: ClipboardCheck, color: 'text-blue-600', bg: 'bg-blue-50' },
          { label: 'Recently Joined', value: stats.joined, icon: CheckCircle2, color: 'text-emerald-600', bg: 'bg-emerald-50' },
        ].map((stat, i) => (
          <Card key={i} className="border-0 shadow-sm overflow-hidden group">
            <CardContent className="p-0">
              <div className="flex">
                <div className={`w-2 ${stat.bg.replace('50', '500')}`} />
                <div className="flex-1 p-6 flex flex-col justify-between">
                  <div className="flex justify-between items-start">
                    <div>
                      <p className="text-[10px] font-black uppercase text-slate-400 tracking-widest mb-1">{stat.label}</p>
                      <h3 className="text-3xl font-black tracking-tighter">{stat.value}</h3>
                    </div>
                    <div className={`p-3 rounded-2xl ${stat.bg} ${stat.color}`}>
                       <stat.icon className="w-6 h-6" />
                    </div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Main Tracking Board */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Column 1: Offer Stage */}
        <div className="space-y-4">
          <div className="flex items-center justify-between px-2">
            <h4 className="text-xs font-black uppercase tracking-widest text-slate-400 flex items-center gap-2">
              <FileText className="w-3 h-3" /> Offer Generation
            </h4>
            <Badge variant="outline" className="bg-white rounded-full font-black text-[10px]">{stats.pending}</Badge>
          </div>
          <div className="space-y-4">
            {onboardingPersonnel.filter(e => e.onboarding_status === 'offer_pending').map((person) => (
              <OnboardingCard
                key={person.id}
                person={person}
                step={1}
                onMove={() => handleMoveStatus(person, 'ready_to_hire')}
                onReject={() => handleRejectOffer(person)}
                onDelete={() => handleDeleteEmployee(person)}
              />
            ))}
            {stats.pending === 0 && <EmptyState text="No active offers in negotiation." />}
          </div>
        </div>

        {/* Column 2: Documentation Stage */}
        <div className="space-y-4">
          <div className="flex items-center justify-between px-2">
            <h4 className="text-xs font-black uppercase tracking-widest text-slate-400 flex items-center gap-2">
              <ClipboardCheck className="w-3 h-3" /> Hire Ready
            </h4>
            <Badge variant="outline" className="bg-white rounded-full font-black text-[10px]">{stats.ready}</Badge>
          </div>
          <div className="space-y-4">
            {onboardingPersonnel.filter(e => e.onboarding_status === 'ready_to_hire').map((person) => (
              <OnboardingCard
                key={person.id}
                person={person}
                step={2}
                onMove={() => handleMoveStatus(person, 'joined')}
                onDelete={() => handleDeleteEmployee(person)}
              />
            ))}
            {stats.ready === 0 && <EmptyState text="Waiting for accepted offers." />}
          </div>
        </div>

        {/* Column 3: Integration Stage */}
        <div className="space-y-4">
          <div className="flex items-center justify-between px-2">
            <h4 className="text-xs font-black uppercase tracking-widest text-slate-400 flex items-center gap-2">
              <CheckCircle2 className="w-3 h-3" /> Active Transition
            </h4>
            <Badge variant="outline" className="bg-white rounded-full font-black text-[10px]">{stats.joined}</Badge>
          </div>
          <div className="space-y-4">
            {onboardingPersonnel.filter(e => e.onboarding_status === 'joined').map((person) => (
              <OnboardingCard
                key={person.id}
                person={person}
                step={3}
                onDelete={() => handleDeleteEmployee(person)}
              />
            ))}
            {stats.joined === 0 && <EmptyState text="No recent onboardings." />}
          </div>
        </div>
      </div>

      <OfferLetterWizard
        isOpen={offerWizardOpen}
        onClose={() => setOfferWizardOpen(false)}
        onCreate={createEmployee.mutateAsync}
      />
      <RegistrationWizard
        isOpen={registrationWizardOpen}
        onClose={() => setRegistrationWizardOpen(false)}
        employee={selectedEmp}
        onUpdate={updateEmployee.mutateAsync}
        onSuccess={handleOnboardingSuccess}
      />
    </div>
  );

  function handleOnboardingSuccess(employeeId: string, updates: Partial<Employee>) {
    // No extra handling needed; mutation already updated the server
    // The employeesData will refresh via TanStack Query cache invalidation
  }

  async function handleMoveStatus(person: Employee, nextStatus: NonNullable<Employee['onboarding_status']>) {
    if (nextStatus === 'joined') {
      setSelectedEmp(person);
      setRegistrationWizardOpen(true);
      return;
    }

    const isAcceptance = nextStatus === 'ready_to_hire';
    const confirmMsg = isAcceptance
      ? `Mark ${person.name_en}'s offer as accepted? This will record today's date as the acceptance date.`
      : `Move ${person.name_en} to the next stage?`;

    if (!confirm(confirmMsg)) return;

    const updates: Partial<Employee> = { onboarding_status: nextStatus };
    if (isAcceptance) {
      updates.offer_accepted_at = new Date().toISOString().split('T')[0];
    }

    await updateEmployee.mutateAsync({
      id: person.id,
      updates
    });
    toast.success(`${person.name_en} ${isAcceptance ? 'offer accepted' : 'moved to Hire Ready'}`);
  }

  function handleRejectOffer(person: Employee) {
    const confirmMsg = `Are you sure you want to reject ${person.name_en}'s offer? This action cannot be undone.`;

    if (!confirm(confirmMsg)) return;

    const updates: Partial<Employee> = { onboarding_status: 'offer_rejected' as const };

    updateEmployee.mutateAsync({
      id: person.id,
      updates
    });
    toast.success(`${person.name_en}'s offer rejected`);
  }

  function handleDeleteEmployee(person: Employee) {
    const statusLabels: Record<string, string> = {
      offer_pending: 'Offer Pending',
      ready_to_hire: 'Ready to Hire',
      joined: 'Joined',
      offer_rejected: 'Offer Rejected'
    };
    const status = statusLabels[person.onboarding_status || ''] || person.onboarding_status;

    const confirmMsg = `Are you sure you want to permanently delete ${person.name_en}? This will remove all associated data and cannot be undone. Current status: ${status}.`;

    if (!confirm(confirmMsg)) return;

    deleteEmployee.mutateAsync(person.id, {
      onSuccess: () => {
        toast.success(`${person.name_en} deleted successfully`);
      },
      onError: (error: any) => {
        toast.error(`Failed to delete: ${error.message}`);
      }
    });
  }
}

function OnboardingCard({ person, step, onMove, onReject, onDelete }: { person: Employee; step: number; onMove?: () => void; onReject?: () => void; onDelete?: () => void }) {
  const progressValue = step === 1 ? 33 : step === 2 ? 66 : 100;
  const statusLabels = {
    1: { t: 'Offer Sent', s: 'Awaiting Acceptance', c: 'border-amber-100 bg-amber-50/30', action: 'Accept Offer' },
    2: { t: 'Offer Accepted', s: 'Registration Pending', c: 'border-blue-100 bg-blue-50/30', action: 'Initialize Registration' },
    3: { t: 'Employee Registered', s: 'Integration Complete', c: 'border-emerald-100 bg-emerald-50/30', action: null },
  };

  const label = statusLabels[step as keyof typeof statusLabels];

  return (
    <Card 
      onClick={onMove}
      className={`border-2 ${label.c} shadow-sm hover:shadow-md transition-all group overflow-hidden cursor-pointer active:scale-95`}
    >
      <CardContent className="p-5 space-y-4">
        <div className="flex items-start justify-between">
          <div className="flex gap-3">
             <div className="h-10 w-10 rounded-xl bg-white border flex items-center justify-center font-black text-xs text-primary shadow-sm group-hover:rotate-6 transition-transform">
                {person.name_en.charAt(0)}
             </div>
             <div>
               <p className="font-black text-slate-900 leading-tight uppercase text-sm tracking-tight">{person.name_en}</p>
               <p className="text-[10px] font-bold text-slate-400 uppercase tracking-tighter">{person.designation}</p>
             </div>
          </div>
          <div className="flex items-center gap-2">
            {onReject && step === 1 && (
              <button
                onClick={(e) => { e.stopPropagation(); onReject(); }}
                className="p-1.5 rounded-lg hover:bg-red-50 transition-colors opacity-0 group-hover:opacity-100"
                title="Reject offer"
              >
                <XCircle className="w-4 h-4 text-red-500" />
              </button>
            )}
            {onDelete && (
              <button
                onClick={(e) => { e.stopPropagation(); onDelete(); }}
                className="p-1.5 rounded-lg hover:bg-red-50 transition-colors opacity-0 group-hover:opacity-100"
                title="Delete employee"
              >
                <Trash2 className="w-4 h-4 text-red-600" />
              </button>
            )}
            {label.action && <ChevronRight className="w-4 h-4 text-slate-300 group-hover:text-primary transition-colors" />}
            {step === 3 && <CheckCircle2 className="w-4 h-4 text-emerald-500" />}
          </div>
        </div>

        <div className="space-y-1.5">
          <div className="flex justify-between text-[10px] font-black uppercase tracking-widest text-slate-400">
             <span>Onboarding Velocity</span>
             <span className="text-primary italic">{progressValue}%</span>
          </div>
          <Progress value={progressValue} className="h-1.5 bg-slate-200" />
        </div>

        <div className="flex items-center justify-between">
          <div className="flex flex-col gap-1 pt-1">
            <div className="flex items-center gap-2">
               <div className={`h-2 w-2 rounded-full ${step === 3 ? 'bg-emerald-500' : 'bg-amber-500 animate-pulse'}`} />
               <p className="text-[10px] font-bold text-slate-600 uppercase tracking-tight">{label.s}</p>
            </div>
            {step === 2 && person.offer_accepted_at && (
              <p className="text-[9px] font-mono text-blue-600">
                Accepted: {new Date(person.offer_accepted_at).toLocaleDateString()}
              </p>
            )}
          </div>
          {label.action && (
            <span className="text-[9px] font-black uppercase text-primary opacity-0 group-hover:opacity-100 transition-opacity">
              {label.action} &rarr;
            </span>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

function EmptyState({ text }: { text: string }) {
  return (
    <div className="border-2 border-dashed border-slate-200 rounded-[2rem] p-8 text-center bg-white/50">
      <p className="text-xs font-black text-slate-400 italic uppercase tracking-widest">{text}</p>
    </div>
  );
}
