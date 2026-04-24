'use client';

import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Landmark, Calendar, User, ChevronRight, ShieldCheck, CreditCard, FileSignature } from 'lucide-react';
import { useEmployeeMutations } from '@/hooks/queries/useEmployeeMutations';
import { toast } from 'sonner';
import { Employee } from '@/types';

interface RegistrationWizardProps {
  isOpen: boolean;
  onClose: () => void;
  employee: Employee | null;
  onUpdate?: (params: { id: string; updates: Partial<Employee> }) => Promise<unknown>;
  onSuccess?: (employeeId: string, updates: Partial<Employee>) => void;
}

export function RegistrationWizard({ isOpen, onClose, employee, onUpdate, onSuccess }: RegistrationWizardProps) {
  const [step, setStep] = useState(1);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [form, setForm] = useState({
    passport_expiry: '',
    visa_no: '',
    visa_expiry: '',
    bank_name: '',
    bank_bic: '',
    bank_iban: '',
    department: employee?.department || '',
  });

  const handleNext = () => setStep(step + 1);
  const handleBack = () => setStep(step - 1);

  const handleFinalize = async () => {
    if (!employee) return;
    setIsSubmitting(true);

    try {
      const updates = {
        ...form,
        onboarding_status: 'joined' as const,
        status: 'active' as const,
        join_date: new Date().toISOString().split('T')[0], // Confirming current join date
      };

      if (onUpdate) {
        await onUpdate({ id: employee.id, updates });
      } else {
        // Fallback (should not happen with proper parent)
        toast.error('Update handler not provided');
        return;
      }

      onSuccess?.(employee.id, updates);
      toast.success(`${employee.name_en} registered and active successfully.`);
      onClose();
    } catch (error) {
      console.error('Registration failed:', error);
      let errMessage = 'Unknown error';
      if (error instanceof Error) {
        errMessage = error.message;
      } else if (typeof error === 'object' && error !== null && 'message' in error) {
        errMessage = (error as { message?: string }).message || errMessage;
      } else if (typeof error === 'string') {
        errMessage = error;
      }
      toast.error(`Failed to complete registration: ${errMessage}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!employee) return null;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-5xl rounded-[2.5rem] p-0 overflow-hidden border-0 shadow-2xl bg-white dark:bg-slate-950">
        <div className="flex h-[600px]">
          {/* Sidebar */}
          <div className="w-[280px] bg-slate-950 p-10 flex flex-col justify-between relative overflow-hidden">
            <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-emerald-500 to-cyan-500 animate-pulse" />
            <div className="space-y-8 relative z-10">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-2xl bg-emerald-500 flex items-center justify-center shadow-lg shadow-emerald-500/20">
                   <ShieldCheck className="w-5 h-5 text-white" />
                </div>
                <h2 className="text-xl font-black text-white italic tracking-widest uppercase leading-tight">Labor<br/>Registry</h2>
              </div>

              <div className="space-y-6 mt-12">
                {[
                  { s: 1, t: 'Travel Logic', d: 'Passport & Visa', i: Calendar },
                  { s: 2, t: 'Financial Bridge', d: 'Bank Accounts', i: CreditCard },
                  { s: 3, t: 'Affiliation', d: 'Department/Role', i: User },
                ].map((item) => (
                  <div key={item.s} className={`flex gap-4 items-start transition-all duration-300 ${step === item.s ? 'opacity-100' : 'opacity-30'}`}>
                    <div className={`mt-1 p-2 rounded-xl h-9 w-9 flex items-center justify-center shrink-0 ${step === item.s ? 'bg-emerald-500 text-white' : 'bg-slate-800 text-slate-500'}`}>
                       <item.i className="w-4 h-4" />
                    </div>
                    <div>
                      <p className="text-[10px] font-black uppercase text-white tracking-widest">{item.t}</p>
                      <p className="text-[9px] text-slate-400 font-bold uppercase tracking-tighter">{item.d}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="p-6 bg-white/5 rounded-3xl border border-white/5">
              <p className="text-[8px] font-black text-slate-500 uppercase tracking-widest mb-1">Subject Meta</p>
              <p className="text-[10px] font-bold text-white uppercase">{employee.name_en}</p>
              <p className="text-[9px] text-slate-400 font-bold uppercase tracking-tighter">{employee.emp_code}</p>
            </div>
          </div>

          {/* Form Content */}
          <div className="flex-1 p-12 flex flex-col relative bg-slate-50">
             <div className="flex-1 overflow-y-auto pr-2 custom-scrollbar space-y-8">
               {step === 1 && (
                 <div className="space-y-6 animate-in slide-in-from-right-4 duration-500">
                    <div className="space-y-4">
                       <h3 className="text-xl font-black text-slate-900 border-l-4 border-emerald-500 pl-4 uppercase tracking-tight italic">Immigration Records</h3>
                       <p className="text-xs text-slate-500 font-medium italic">Capture validity metrics for official residency.</p>
                    </div>

                    <div className="grid grid-cols-1 gap-6">
                      <div className="space-y-2">
                        <Label className="text-[10px] font-black uppercase text-slate-400">Passport Expiry Date</Label>
                        <Input type="date" value={form.passport_expiry} onChange={e => setForm({...form, passport_expiry: e.target.value})} className="h-12 rounded-2xl border-2 font-mono font-bold" />
                      </div>
                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <Label className="text-[10px] font-black uppercase text-slate-400">Official Visa Number</Label>
                          <Input placeholder="e.g. 1234/2024" value={form.visa_no} onChange={e => setForm({...form, visa_no: e.target.value})} className="h-12 rounded-2xl border-2 font-mono" />
                        </div>
                        <div className="space-y-2">
                          <Label className="text-[10px] font-black uppercase text-slate-400">Visa Expiry Date</Label>
                          <Input type="date" value={form.visa_expiry} onChange={e => setForm({...form, visa_expiry: e.target.value})} className="h-12 rounded-2xl border-2 font-mono" />
                        </div>
                      </div>
                    </div>
                 </div>
               )}

               {step === 2 && (
                 <div className="space-y-6 animate-in slide-in-from-right-4 duration-500">
                    <div className="space-y-4">
                       <h3 className="text-xl font-black text-slate-900 border-l-4 border-emerald-500 pl-4 uppercase tracking-tight italic">WPS Connectivity</h3>
                       <p className="text-xs text-slate-500 font-medium italic">Banking details required for the Omani Wage Protection System.</p>
                    </div>

                    <div className="space-y-6">
                      <div className="space-y-2">
                        <Label className="text-[10px] font-black uppercase text-slate-400">Bank Name (Oman)</Label>
                        <Input placeholder="e.g. Bank Muscat" value={form.bank_name} onChange={e => setForm({...form, bank_name: e.target.value})} className="h-12 rounded-2xl border-2 font-bold" />
                      </div>
                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <Label className="text-[10px] font-black uppercase text-slate-400">BIC / SWIFT Code</Label>
                          <Input placeholder="e.g. BMUSOMRX" value={form.bank_bic} onChange={e => setForm({...form, bank_bic: e.target.value})} className="h-12 rounded-2xl border-2 font-mono uppercase" />
                        </div>
                        <div className="space-y-2">
                          <Label className="text-[10px] font-black uppercase text-slate-400">IBAN Number</Label>
                          <Input placeholder="OM..." value={form.bank_iban} onChange={e => setForm({...form, bank_iban: e.target.value})} className="h-12 rounded-2xl border-2 font-mono uppercase" />
                        </div>
                      </div>
                    </div>
                 </div>
               )}

               {step === 3 && (
                 <div className="space-y-6 animate-in slide-in-from-right-4 duration-500">
                    <div className="space-y-4">
                       <h3 className="text-xl font-black text-slate-900 border-l-4 border-emerald-500 pl-4 uppercase tracking-tight italic">Final Affiliation</h3>
                       <p className="text-xs text-slate-500 font-medium italic">Assign the subject to their functional department.</p>
                    </div>

                    <div className="space-y-6">
                      <div className="space-y-2">
                        <Label className="text-[10px] font-black uppercase text-slate-400">Work Unit / Department</Label>
                        <Input value={form.department} onChange={e => setForm({...form, department: e.target.value})} className="h-12 rounded-2xl border-2 font-black uppercase tracking-tight" />
                      </div>

                      <div className="p-8 rounded-[2rem] bg-emerald-500 text-white shadow-2xl shadow-emerald-500/20 text-center space-y-4 group">
                          <div className="h-16 w-16 rounded-3xl bg-white/20 flex items-center justify-center mx-auto group-hover:scale-110 transition-transform">
                             <FileSignature className="w-8 h-8" />
                          </div>
                          <p className="text-xs font-black uppercase tracking-widest italic">Registration Ready</p>
                          <p className="text-[10px] opacity-80 leading-relaxed max-w-[200px] mx-auto uppercase font-bold">This will initialize the active service period for the employee.</p>
                      </div>
                    </div>
                 </div>
               )}
             </div>

             <div className="mt-auto pt-8 border-t border-slate-200 flex items-center justify-between">
                <Button variant="ghost" onClick={step === 1 ? onClose : handleBack} className="rounded-2xl px-8 font-black text-slate-400 hover:text-slate-900 uppercase text-[10px] tracking-widest">
                  {step === 1 ? 'Cancel Entry' : 'Previous Factor'}
                </Button>
                <Button 
                  onClick={step === 3 ? handleFinalize : handleNext} 
                  disabled={isSubmitting}
                  className="rounded-2xl h-12 bg-emerald-500 text-white font-black px-10 gap-2 hover:bg-emerald-600 transition-all shadow-xl shadow-emerald-500/20"
                >
                  {isSubmitting ? 'Finalizing Registry...' : step === 3 ? 'Confirm & Join' : 'Next Metric'} <ChevronRight className="w-4 h-4" />
                </Button>
             </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
