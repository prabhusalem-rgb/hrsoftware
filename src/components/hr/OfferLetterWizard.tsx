'use client';

import { useState, useEffect, useRef } from 'react';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Calculator, User, ChevronRight, Printer, FileText, BadgeCheck, Plus, Minus, FileDown } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { useCompany } from '@/components/providers/CompanyProvider';
import { OfferLetterStatement } from './OfferLetterStatement';
import { OfferLetterPDF } from './OfferLetterPDF';
import { toast } from 'sonner';
import { EmployeeFormData, Nationality } from '@/types';
import { pdf } from '@react-pdf/renderer';
import { createClient } from '@/lib/supabase/client';

interface OfferLetterWizardProps {
  isOpen: boolean;
  onClose: () => void;
  onCreate?: (data: EmployeeFormData) => Promise<unknown>;
}

// Helper: fetch next sequential employee code from database for the current company
async function getNextEmployeeCode(companyId: string): Promise<string> {
  try {
    const { createClient } = await import('@/lib/supabase/client');
    const supabase = createClient();

    // Use RPC to get per-company next code (handles RLS correctly with SECURITY DEFINER)
    const { data, error } = await supabase
      .rpc('preview_next_employee_code', { p_company_id: companyId });

    if (error) {
      console.error('Error calling preview_next_employee_code:', error);
      // Fallback: manual calculation filtered by company
      const { data: empCodes, error: fallbackErr } = await supabase
        .from('employees')
        .select('emp_code')
        .eq('company_id', companyId)
        .not('emp_code', 'is', null);
      if (fallbackErr) {
        console.error('Fallback query error:', fallbackErr);
        return '1';
      }
      const numericCodes = (empCodes || [])
        .map((emp: { emp_code: unknown }) => emp.emp_code)
        .filter((code: unknown): code is string => typeof code === 'string' && /^\d+$/.test(code))
        .map((code: string) => parseInt(code, 10));
      const max = numericCodes.length > 0 ? Math.max(...numericCodes) : 0;
      return String(max + 1);
    }

    return data || '1';
  } catch (err) {
    console.error('Error generating employee code:', err);
    return '1';
  }
}

export function OfferLetterWizard({ isOpen, onClose, onCreate }: OfferLetterWizardProps) {
  const { activeCompany, activeCompanyId } = useCompany();
  const [step, setStep] = useState(1);
  const [showPreview, setShowPreview] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [pdfBlobUrl, setPdfBlobUrl] = useState<string | null>(null);
  const [isGeneratingPDF, setIsGeneratingPDF] = useState(false);
  const [previewError, setPreviewError] = useState<string | null>(null);
  const pdfBlobUrlRef = useRef<string | null>(null);

  const [form, setForm] = useState<{
    name: string;
    nationality: Nationality;
    passport_no: string;
    designation: string;
    basic_salary: number;
    housing_allowance: number;
    transport_allowance: number;
    other_allowance: number;
    probation_period: string;
    notice_period: string;
    join_date: string;
    air_ticket_frequency: string;
    additional_points: string[];
  }>({
    name: 'Candidate Full Name',
    nationality: 'INDIAN',
    passport_no: 'PASSPORT-001',
    designation: 'Engineer',
    basic_salary: 500,
    housing_allowance: 150,
    transport_allowance: 50,
    other_allowance: 0,
    probation_period: '3 Months',
    notice_period: '30 Days',
    join_date: '',
    air_ticket_frequency: 'Every Year',
    additional_points: [],
  });

  const [newPoint, setNewPoint] = useState('');

  // Reset all state when dialog opens
  useEffect(() => {
    if (isOpen) {
      setStep(1);
      setShowPreview(false);
      setIsSubmitting(false);
      setForm({
        name: 'Candidate Full Name',
        nationality: 'INDIAN',
        passport_no: 'PASSPORT-001',
        designation: 'Engineer',
        basic_salary: 500,
        housing_allowance: 150,
        transport_allowance: 50,
        other_allowance: 0,
        probation_period: '3 Months',
        notice_period: '30 Days',
        join_date: '',
        air_ticket_frequency: 'Every Year',
        additional_points: [],
      });
      setNewPoint('');
    }
  }, [isOpen]);

  const handleNumberInputFocus = (e: React.FocusEvent<HTMLInputElement>) => {
    e.target.select();
  };

  const handleNumberInputClick = (e: React.MouseEvent<HTMLInputElement>) => {
    // Also select on click to ensure clean entry
    e.currentTarget.select();
  };

  const handleNumberChange = (field: keyof typeof form, value: string) => {
    // Only allow valid decimal numbers
    if (value === '' || value === '.' || value === '-') {
      setForm({ ...form, [field]: 0 });
      return;
    }
    const num = parseFloat(value);
    setForm({ ...form, [field]: isNaN(num) ? 0 : num });
  };

  const handleNationalityChange = (value: string) => {
    // Cast to Nationality type - schema validation will catch invalid values on submit
    setForm({ ...form, nationality: value as Nationality });
  };

  const addPoint = () => {
    if (newPoint.trim()) {
      setForm({ ...form, additional_points: [...form.additional_points, newPoint.trim()] });
      setNewPoint('');
    }
  };

  const removePoint = (idx: number) => {
    setForm({ ...form, additional_points: form.additional_points.filter((_, i) => i !== idx) });
  };

  const handleExportPDF = async () => {
    if (!activeCompany) return;
    try {
      const doc = (
        <OfferLetterPDF
          company={activeCompany}
          candidate={form}
        />
      );
      const pdfBlob = await pdf(doc).toBlob();
      const url = URL.createObjectURL(pdfBlob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `offer-letter-${form.name.replace(/\s+/g, '-').toLowerCase()}-${new Date().toISOString().split('T')[0]}.pdf`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
      toast.success('Offer letter PDF downloaded successfully');
    } catch (error) {
      console.error('Failed to generate PDF:', error);
      toast.error('Failed to generate PDF');
    }
  };

  const handleQuickPrint = async () => {
    if (!activeCompany) return;
    try {
      const doc = (
        <OfferLetterPDF
          company={activeCompany}
          candidate={form}
        />
      );
      const pdfBlob = await pdf(doc).toBlob();
      const url = URL.createObjectURL(pdfBlob);
      window.open(url, '_blank');
      toast.success('Offer letter opened for printing');
    } catch (error) {
      console.error('Failed to generate PDF:', error);
      toast.error('Failed to generate PDF');
    }
  };

  // Generate PDF blob URL for preview when showPreview is true
  useEffect(() => {
    if (!showPreview || !activeCompany) {
      if (pdfBlobUrlRef.current) {
        URL.revokeObjectURL(pdfBlobUrlRef.current);
        pdfBlobUrlRef.current = null;
      }
      setPdfBlobUrl(null);
      setPreviewError(null);
      setIsGeneratingPDF(false);
      return;
    }

    let isMounted = true;
    setIsGeneratingPDF(true);
    setPreviewError(null);

    const generatePreview = async () => {
      try {
        // Revoke previous blob URL
        if (pdfBlobUrlRef.current) {
          URL.revokeObjectURL(pdfBlobUrlRef.current);
        }

        const doc = (
          <OfferLetterPDF
            company={activeCompany}
            candidate={form}
          />
        );

        const blob = await pdf(doc).toBlob();
        if (!isMounted) return;

        const url = URL.createObjectURL(blob);
        pdfBlobUrlRef.current = url;
        setPdfBlobUrl(url);
      } catch (err) {
        if (isMounted) {
          console.error('Failed to generate PDF preview:', err);
          setPreviewError('Failed to generate PDF preview');
        }
      } finally {
        if (isMounted) {
          setIsGeneratingPDF(false);
        }
      }
    };

    generatePreview();

    return () => {
      isMounted = false;
    };
  }, [showPreview, activeCompany, form]);

  // Cleanup blob URL on unmount
  useEffect(() => {
    return () => {
      if (pdfBlobUrlRef.current) {
        URL.revokeObjectURL(pdfBlobUrlRef.current);
      }
    };
  }, []);

  const handleNext = () => setStep(step + 1);
  const handleBack = () => setStep(step - 1);

  const handleFinalize = async () => {
    setIsSubmitting(true);
    try {
      // Generate a unique placeholder email from name with timestamp to avoid collisions
      const email = `${form.name.toLowerCase().replace(/\s+/g, '.')}-${Date.now()}@placeholder.invalid`;

      // Get next sequential employee code from database for this company
      const empCode = await getNextEmployeeCode(activeCompanyId!);

      const candidateData: EmployeeFormData = {
        company_id: activeCompanyId!,
        emp_code: empCode,
        name_en: form.name,
        email: email,
        id_type: 'passport',
        civil_id: '',
        passport_no: form.passport_no,
        passport_expiry: null,
        passport_issue_date: null,
        nationality: form.nationality,
        gender: 'male', // default, will be selected in actual form
        religion: 'muslim',
        category: 'INDIRECT_STAFF',
        department: 'Operations',
        designation: form.designation,
        join_date: form.join_date || new Date().toISOString().split('T')[0],
        basic_salary: form.basic_salary,
        housing_allowance: form.housing_allowance,
        transport_allowance: form.transport_allowance,
        food_allowance: 0,
        special_allowance: 0,
        site_allowance: 0,
        other_allowance: form.other_allowance,
        bank_name: '',
        bank_bic: '',
        bank_iban: '',
        status: 'offer_sent',
        onboarding_status: 'offer_pending',
        last_offer_sent_at: new Date().toISOString(),
        offer_accepted_at: null,
        visa_no: null,
        visa_type: null,
        visa_issue_date: null,
        visa_expiry: null,
        opening_leave_balance: 0,
        opening_air_tickets: 0,
        emergency_contact_name: '',
        emergency_contact_phone: '',
        home_country_address: '',
        reporting_to: '',
        avatar_url: null,
        is_salary_held: false,
        salary_hold_reason: null,
        salary_hold_at: null,
        air_ticket_cycle: 12,
        termination_date: null,
        leave_settlement_date: null,
        rejoin_date: null,
      };

      if (onCreate) {
        await onCreate(candidateData);
        toast.success(`Offer sent to ${form.name} successfully.`);
      } else {
        // Fallback if no custom provider - should not happen in normal flow
        toast.error('Offer creation handler not provided');
        return;
      }
      onClose();
    } catch (error) {
      console.error('Failed to finalize offer letter:', error);
      // Safely extract error message from any thrown value
      let errMessage = 'Unknown error';
      if (error instanceof Error) {
        errMessage = error.message;
      } else if (typeof error === 'object' && error !== null && 'message' in error) {
        errMessage = (error as { message?: string }).message || errMessage;
      } else if (typeof error === 'string') {
        errMessage = error;
      }
      toast.error(`Failed to finalize offer letter: ${errMessage}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-6xl rounded-[2.5rem] p-0 overflow-hidden border-0 shadow-2xl bg-white dark:bg-slate-950">
        <div className="flex h-[700px]">
          {/* Sidebar Stepper */}
          <div className="w-[300px] bg-slate-950 p-10 flex flex-col justify-between relative overflow-hidden">
            <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-primary to-emerald-500 animate-pulse" />
            <div className="space-y-8 relative z-10">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-2xl bg-primary flex items-center justify-center shadow-lg shadow-primary/20">
                   <FileText className="w-5 h-5 text-white" />
                </div>
                <h2 className="text-xl font-black text-white italic tracking-widest uppercase">Offer Architect</h2>
              </div>

              <div className="space-y-6 mt-12">
                {[
                  { s: 1, t: 'Candidate Meta', d: 'ID & Particulars', i: User },
                  { s: 2, t: 'Salary Architecture', d: 'OMR Components', i: Calculator },
                  { s: 3, t: 'Terms of Service', d: 'Notice & Probation', i: BadgeCheck },
                  { s: 4, t: 'Custom Clauses', d: 'Additional Points', i: Plus },
                ].map((item) => (
                  <div key={item.s} className={`flex gap-4 items-start transition-all duration-300 ${step === item.s ? 'opacity-100' : 'opacity-30'}`}>
                    <div className={`mt-1 p-2 rounded-xl h-9 w-9 flex items-center justify-center shrink-0 ${step === item.s ? 'bg-primary text-white' : 'bg-slate-800 text-slate-500'}`}>
                       <item.i className="w-4 h-4" />
                    </div>
                    <div>
                      <p className="text-[10px] font-black uppercase text-white tracking-widest">{item.t}</p>
                      <p className="text-[9px] text-slate-400 font-bold uppercase">{item.d}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="p-6 bg-white/5 rounded-3xl border border-white/5">
              <p className="text-[8px] font-black text-slate-500 uppercase tracking-widest mb-1">Compliance Engine</p>
              <p className="text-[9px] font-bold text-white leading-relaxed">System generating Omani Labor Law compliant legal offers.</p>
            </div>
          </div>

          {/* Form Content */}
          <div className="flex-1 p-12 flex flex-col relative bg-slate-50">
             <div className="flex-1 overflow-y-auto pr-4 custom-scrollbar space-y-8">
               {step === 1 && (
                 <div className="space-y-6 animate-in slide-in-from-right-4 duration-500">
                    <div className="grid grid-cols-1 gap-6">
                      <div className="space-y-2">
                        <Label className="text-[10px] font-black uppercase text-slate-400">Candidate&apos;s Full Legal Name</Label>
                        <Input value={form.name} onChange={e => setForm({...form, name: e.target.value})} className="h-12 rounded-2xl border-2 font-bold focus:border-primary transition-all" />
                      </div>
                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <Label className="text-[10px] font-black uppercase text-slate-400">Citizenship / Nationality</Label>
                          <Input value={form.nationality} onChange={e => handleNationalityChange(e.target.value)} className="h-12 rounded-2xl border-2" />
                        </div>
                        <div className="space-y-2">
                          <Label className="text-[10px] font-black uppercase text-slate-400">Passport Number</Label>
                          <Input value={form.passport_no} onChange={e => setForm({...form, passport_no: e.target.value})} className="h-12 rounded-2xl border-2 font-mono" />
                        </div>
                      </div>
                      <div className="space-y-2">
                        <Label className="text-[10px] font-black uppercase text-slate-400">Proposed Designation</Label>
                        <Input value={form.designation} onChange={e => setForm({...form, designation: e.target.value})} className="h-12 rounded-2xl border-2 font-black uppercase tracking-tight" />
                      </div>
                    </div>
                 </div>
               )}

               {step === 2 && (
                 <div className="space-y-6 animate-in slide-in-from-right-4 duration-500">
                    <div className="grid grid-cols-2 gap-6">
                      <div className="space-y-2">
                        <Label className="text-[10px] font-black uppercase text-slate-400">Basic Monthly OMR</Label>
                        <Input type="text" inputMode="decimal" value={form.basic_salary === 0 ? '' : String(form.basic_salary)} onChange={e => handleNumberChange('basic_salary', e.target.value)} onFocus={handleNumberInputFocus} onClick={handleNumberInputClick} className="h-12 rounded-2xl border-2 font-mono font-black" />
                      </div>
                      <div className="space-y-2">
                        <Label className="text-[10px] font-black uppercase text-slate-400">Housing Allowance</Label>
                        <Input type="text" inputMode="decimal" value={form.housing_allowance === 0 ? '' : String(form.housing_allowance)} onChange={e => handleNumberChange('housing_allowance', e.target.value)} onFocus={handleNumberInputFocus} onClick={handleNumberInputClick} className="h-12 rounded-2xl border-2 font-mono" />
                      </div>
                      <div className="space-y-2">
                        <Label className="text-[10px] font-black uppercase text-slate-400">Transport Allocation</Label>
                        <Input type="text" inputMode="decimal" value={form.transport_allowance === 0 ? '' : String(form.transport_allowance)} onChange={e => handleNumberChange('transport_allowance', e.target.value)} onFocus={handleNumberInputFocus} onClick={handleNumberInputClick} className="h-12 rounded-2xl border-2 font-mono" />
                      </div>
                      <div className="space-y-2">
                        <Label className="text-[10px] font-black uppercase text-slate-400">Other Benefits</Label>
                        <Input type="text" inputMode="decimal" value={form.other_allowance === 0 ? '' : String(form.other_allowance)} onChange={e => handleNumberChange('other_allowance', e.target.value)} onFocus={handleNumberInputFocus} onClick={handleNumberInputClick} className="h-12 rounded-2xl border-2 font-mono" />
                      </div>
                    </div>
                    <div className="p-6 rounded-3xl bg-slate-900 text-white shadow-xl">
                      <div className="flex justify-between items-center mb-2">
                        <p className="text-[10px] font-black uppercase opacity-40">Monthly Cumulative Gross</p>
                        <Badge className="bg-primary text-white border-0 font-black px-4 italic">OMR</Badge>
                      </div>
                      <p className="text-3xl font-black italic tracking-tighter">{(form.basic_salary + form.housing_allowance + form.transport_allowance).toFixed(3)}</p>
                    </div>
                 </div>
               )}

               {step === 3 && (
                 <div className="space-y-6 animate-in slide-in-from-right-4 duration-500">
                    <div className="grid grid-cols-2 gap-6">
                      <div className="space-y-2">
                        <Label className="text-[10px] font-black uppercase text-slate-400">Probation Duration</Label>
                        <Input value={form.probation_period} onChange={e => setForm({...form, probation_period: e.target.value})} className="h-12 rounded-2xl border-2" />
                      </div>
                      <div className="space-y-2">
                        <Label className="text-[10px] font-black uppercase text-slate-400">Resignation Notice</Label>
                        <Input value={form.notice_period} onChange={e => setForm({...form, notice_period: e.target.value})} className="h-12 rounded-2xl border-2" />
                      </div>
                      <div className="space-y-2 col-span-2">
                        <Label className="text-[10px] font-black uppercase text-slate-400">Air Ticket Frequency</Label>
                        <Select value={form.air_ticket_frequency} onValueChange={(v: string | null) => v && setForm(prev => ({...prev, air_ticket_frequency: v}))}>
                          <SelectTrigger className="h-12 rounded-2xl border-2 font-bold"><SelectValue /></SelectTrigger>
                          <SelectContent className="rounded-2xl shadow-xl">
                            <SelectItem value="Every Year">Standard (Every 1 Year of Service)</SelectItem>
                            <SelectItem value="Once in 2 Years">Direct Staff (Every 2 Years of Service)</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                 </div>
               )}

               {step === 4 && (
                 <div className="space-y-6 animate-in slide-in-from-right-4 duration-500">
                    <div className="space-y-4">
                      <Label className="text-[10px] font-black uppercase text-slate-400">Additional Terms & Conditions</Label>
                      <div className="flex gap-2">
                        <Input 
                          placeholder="e.g. Free Laptop for professional use" 
                          value={newPoint} 
                          onChange={e => setNewPoint(e.target.value)}
                          onKeyDown={e => e.key === 'Enter' && addPoint()}
                          className="h-12 rounded-2xl border-2" 
                        />
                        <Button onClick={addPoint} className="rounded-2xl h-12 w-12 bg-primary p-0">
                          <Plus className="w-5 h-5 text-white" />
                        </Button>
                      </div>
                      
                      <div className="space-y-2 mt-4 max-h-[300px] overflow-y-auto pr-2 custom-scrollbar">
                        {form.additional_points.map((point, idx) => (
                          <div key={idx} className="flex items-center justify-between p-4 bg-white rounded-2xl border-2 group hover:border-primary transition-all">
                            <p className="text-sm font-bold text-slate-700">{point}</p>
                            <Button variant="ghost" onClick={() => removePoint(idx)} className="h-8 w-8 p-0 text-slate-400 hover:text-red-500 rounded-xl">
                              <Minus className="w-4 h-4" />
                            </Button>
                          </div>
                        ))}
                        {form.additional_points.length === 0 && (
                          <p className="text-xs text-slate-400 italic text-center py-8">No custom clauses added to this offer yet.</p>
                        )}
                      </div>
                    </div>
                 </div>
               )}
             </div>

             <div className="mt-auto pt-8 border-t border-slate-200 flex items-center justify-between">
                <Button variant="ghost" onClick={step === 1 ? onClose : handleBack} className="rounded-2xl px-8 font-black text-slate-400 hover:text-slate-900">
                  {step === 1 ? 'Discard Draft' : 'Previous Logic'}
                </Button>
                <div className="flex gap-4">
                  <Button onClick={() => setShowPreview(true)} className="rounded-2xl h-12 bg-slate-900 text-white font-black px-6 gap-2 hover:bg-slate-800 transition-all border border-white/10 group shadow-lg shadow-black/5">
                    <Printer className="w-4 h-4 group-hover:scale-110 transition-transform" /> Preview Offer
                  </Button>
                  <Button 
                    onClick={step === 4 ? handleFinalize : handleNext} 
                    disabled={isSubmitting}
                    className="rounded-2xl h-12 bg-primary text-white font-black px-10 gap-2 hover:bg-primary/90 transition-all shadow-xl shadow-primary/20"
                  >
                    {isSubmitting ? 'Architecting...' : step === 4 ? 'Hire Subject' : 'Next Metric'} <ChevronRight className="w-4 h-4" />
                  </Button>
                </div>
             </div>
          </div>
        </div>

        {/* High-Fidelity Preview Modal */}
        {showPreview && (
          <div className="fixed inset-0 z-[150] bg-slate-950/98 backdrop-blur-xl flex flex-col items-center overflow-y-auto animate-in fade-in duration-500 print:bg-white print:p-0">
             {/* Sticky Action Header - Hidden on Print */}
             <div className="sticky top-0 w-full z-50 bg-slate-900/50 backdrop-blur-md border-b border-white/5 p-6 flex justify-between items-center print:hidden">
                <div className="flex items-center gap-4">
                  <div className="h-10 w-10 rounded-2xl bg-primary flex items-center justify-center shadow-lg shadow-primary/20">
                    <FileText className="w-5 h-5 text-white" />
                  </div>
                  <div>
                    <h3 className="text-sm font-black text-white uppercase tracking-widest">Document Preview</h3>
                    <p className="text-[10px] text-slate-400 font-bold uppercase tracking-tight">Omani Labor Law Compliant • v1.0</p>
                  </div>
                </div>
                <div className="flex gap-4">
                  <Button
                    onClick={handleExportPDF}
                    className="bg-primary hover:bg-primary/90 text-white font-black rounded-2xl h-11 px-8 gap-2 shadow-2xl shadow-primary/20 transition-all hover:scale-105 active:scale-95"
                  >
                    <FileDown className="w-4 h-4" /> Export as PDF
                  </Button>
                  <Button
                    onClick={handleQuickPrint}
                    variant="outline"
                    className="bg-white border-2 text-slate-900 font-black rounded-2xl h-11 px-8 gap-2 transition-all hover:bg-slate-50"
                  >
                    <Printer className="w-4 h-4" /> Quick Print
                  </Button>
                  <Button
                    onClick={() => setShowPreview(false)}
                    variant="ghost"
                    className="text-white hover:text-white/80 font-black uppercase text-[10px] tracking-widest px-8"
                  >
                    Close Preview
                  </Button>
                </div>
             </div>

             {/* Document Container */}
             <div className="flex-1 min-h-0 py-20 px-8 flex justify-center print:py-4 print:px-0">
                <div className="shadow-[0_40px_100px_-20px_rgba(0,0,0,0.5)] print:shadow-none bg-white rounded-[2rem] overflow-hidden print:rounded-none w-full max-w-[21cm]">
                   {activeCompany && (
                     isGeneratingPDF ? (
                       <div className="flex items-center justify-center h-96">
                         <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
                       </div>
                     ) : previewError ? (
                       <div className="flex items-center justify-center h-96 text-red-500">
                         {previewError}
                       </div>
                     ) : pdfBlobUrl ? (
                       <iframe
                         src={pdfBlobUrl}
                         width="100%"
                         height="100%"
                         style={{ border: 'none' }}
                         title="Offer Letter Preview"
                         className="flex-1"
                       />
                     ) : null
                   )}
                </div>
             </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
