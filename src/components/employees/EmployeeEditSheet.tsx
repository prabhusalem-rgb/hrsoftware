'use client';

import { useState, useEffect, useMemo } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription, SheetFooter } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { toast } from 'sonner';
import { Employee, EmployeeStatus, EmployeeCategory, IdType, Nationality, EmployeeFormData } from '@/types';
import { employeeSchema } from '@/lib/validations/schemas';
import { Sparkles, X as XIcon, Upload, Calendar } from 'lucide-react';

const employeeFormSchema = employeeSchema;
type EmployeeFormValues = z.infer<typeof employeeFormSchema>;

interface EmployeeEditSheetProps {
  isOpen: boolean;
  onClose: () => void;
  employee?: Employee | null;
  companyId: string;
  onCreate: (data: EmployeeFormData) => Promise<unknown>;
  onUpdate: (params: { id: string; updates: Partial<EmployeeFormData> }) => Promise<unknown>;
}

const categoryLabels: Record<EmployeeCategory, string> = {
  OMANI_DIRECT_STAFF: 'Omani Direct Staff',
  OMANI_INDIRECT_STAFF: 'Omani In-Direct Staff',
  DIRECT_STAFF: 'Direct Staff',
  INDIRECT_STAFF: 'In-Direct Staff',
};

const genderLabels: Record<string, string> = {
  male: 'Male',
  female: 'Female',
  other: 'Other',
};

const religionLabels: Record<string, string> = {
  muslim: 'Muslim',
  'non-muslim': 'Non-Muslim',
  other: 'Other',
};

const nationalityLabels: Record<string, string> = {
  OMANI: 'Omani',
  INDIAN: 'Indian',
  BANGALADESHI: 'Bangladeshi',
  PAKISTANI: 'Pakistani',
  SUDAN: 'Sudanese',
  JODAN: 'Jordanian',
  SYRIA: 'Syrian',
  YEMANI: 'Yemeni',
  EGYPT: 'Egyptian',
  PHLIPPHINES: 'Filipino',
  NEPALI: 'Nepali',
};

const familyStatusLabels: Record<string, string> = {
  single: 'Single (No Family)',
  family: 'Family (With Dependents)',
};

const emptyForm: EmployeeFormValues = {
  company_id: '',
  emp_code: '',
  name_en: '',
  email: '',
  id_type: 'civil_id',
  civil_id: '',
  passport_no: '',
  passport_expiry: '',
  passport_issue_date: '',
  visa_no: '',
  visa_type: '',
  visa_issue_date: '',
  visa_expiry: '',
  nationality: 'OMANI',
  gender: 'female',
  religion: 'muslim',
  family_status: '',
  category: 'INDIRECT_STAFF',
  department: '',
  designation: '',
  join_date: '',
  basic_salary: 0,
  housing_allowance: 0,
  transport_allowance: 0,
  food_allowance: 0,
  special_allowance: 0,
  site_allowance: 0,
  other_allowance: 0,
  bank_name: 'Bank Muscat',
  bank_bic: 'BMCTOMRX',
  bank_iban: '',
  status: 'active',
  onboarding_status: '',
  last_offer_sent_at: '',
  offer_accepted_at: '',
  opening_leave_balance: 0,
  opening_air_tickets: 0,
  air_ticket_cycle: 12,
  emergency_contact_name: '',
  emergency_contact_phone: '',
  home_country_address: '',
  reporting_to: '',
  avatar_url: null,
  is_salary_held: false,
  salary_hold_reason: '',
};

export function EmployeeEditSheet({
  isOpen,
  onClose,
  employee,
  companyId,
  onCreate,
  onUpdate,
}: EmployeeEditSheetProps) {
  const [activeTab, setActiveTab] = useState('personal');
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const [canSubmit, setCanSubmit] = useState(false);
  const [hasInitialized, setHasInitialized] = useState(false);

  const isEditing = !!employee;

  // Debug: log when sheet opens
  useEffect(() => {
    if (isOpen) {
      console.log('[EmployeeEditSheet] opened. companyId:', companyId, 'employeeCode:', employee?.emp_code);
    }
  }, [isOpen, companyId, employee]);

  const {
    register,
    handleSubmit,
    reset,
    setValue,
    watch,
    trigger,
    formState: { errors, isSubmitting, isValid },
  } = useForm({
    resolver: zodResolver(employeeFormSchema),
    defaultValues: emptyForm,
    mode: 'onChange',
    reValidateMode: 'onChange',
  });

  // Watch form values for gross calculation
  const formValues = watch();

  // Compute gross salary
  const grossSalary = useMemo(() => {
    return (
      Number(formValues.basic_salary || 0) +
      Number(formValues.housing_allowance || 0) +
      Number(formValues.transport_allowance || 0) +
      Number(formValues.food_allowance || 0) +
      Number(formValues.special_allowance || 0) +
      Number(formValues.site_allowance || 0) +
      Number(formValues.other_allowance || 0)
    );
  }, [
    formValues.basic_salary,
    formValues.housing_allowance,
    formValues.transport_allowance,
    formValues.food_allowance,
    formValues.special_allowance,
    formValues.site_allowance,
    formValues.other_allowance,
  ]);

  // Reset form when employee/company changes and trigger validation
  useEffect(() => {
    if (!isOpen) return;

    const initForm = async () => {
      setHasInitialized(false);
      if (employee) {
        setPhotoPreview(employee.avatar_url);

        // --- Legacy Data Mappers ---
        // Ensures form initializes with valid Enum values to avoid Zod validation failures

        const mapCategory = (cat: string | null): EmployeeCategory => {
          if (!cat) return 'INDIRECT_STAFF';
          const valid: EmployeeCategory[] = ['OMANI_DIRECT_STAFF', 'OMANI_INDIRECT_STAFF', 'DIRECT_STAFF', 'INDIRECT_STAFF'];
          if (valid.includes(cat as EmployeeCategory)) return cat as EmployeeCategory;
          
          // Legacy mapping
          if (cat === 'national') return 'OMANI_INDIRECT_STAFF';
          if (cat === 'expat' || cat === 'staff') return 'INDIRECT_STAFF';
          if (cat === 'direct_worker') return 'DIRECT_STAFF';
          return 'INDIRECT_STAFF';
        };

        const mapNationality = (nat: string | null): Nationality => {
          const upper = (nat || 'OMANI').toUpperCase();
          const valid: Nationality[] = ['OMANI', 'INDIAN', 'BANGALADESHI', 'PAKISTANI', 'SUDAN', 'JODAN', 'SYRIA', 'YEMANI', 'EGYPT', 'PHLIPPHINES', 'NEPALI'];
          if (valid.includes(upper as Nationality)) return upper as Nationality;
          return 'OMANI'; // Safe fallback
        };

        const mapGender = (gen: string | null): 'male' | 'female' | 'other' => {
          const low = (gen || 'female').toLowerCase();
          if (['male', 'female', 'other'].includes(low)) return low as 'male' | 'female' | 'other';
          return 'female';
        };

        const mapReligion = (rel: string | null): 'muslim' | 'non-muslim' | 'other' => {
          const low = (rel || 'muslim').toLowerCase();
          if (['muslim', 'non-muslim', 'other'].includes(low)) return low as 'muslim' | 'non-muslim' | 'other';
          return 'muslim';
        };

        const ensureString = (value: unknown, fallback: string = ''): string => {
          return typeof value === 'string' && value.trim() !== '' ? value : fallback;
        };

        reset({
          company_id: ensureString(employee.company_id, ''),
          emp_code: ensureString(employee.emp_code, ''),
          name_en: ensureString(employee.name_en, 'Unknown'),
          email: ensureString(employee.email, ''),
          id_type: employee.id_type || 'civil_id',
          civil_id: employee.civil_id ?? '',
          passport_no: employee.passport_no ?? '',
          passport_expiry: employee.passport_expiry ?? '',
          passport_issue_date: employee.passport_issue_date ?? '',
          visa_no: employee.visa_no ?? '',
          visa_type: employee.visa_type ?? '',
          visa_issue_date: employee.visa_issue_date ?? '',
          visa_expiry: employee.visa_expiry ?? '',
          nationality: mapNationality(employee.nationality),
          gender: mapGender(employee.gender || null),
          religion: mapReligion(employee.religion || null),
          family_status: (employee.family_status || '') as 'single' | 'family' | '',
          category: mapCategory(employee.category),
          department: employee.department ?? '',
          designation: employee.designation ?? '',
          join_date: ensureString(employee.join_date, new Date().toISOString().split('T')[0]),
          basic_salary: Number(employee.basic_salary) || 0,
          housing_allowance: Number(employee.housing_allowance) || 0,
          transport_allowance: Number(employee.transport_allowance) || 0,
          food_allowance: Number(employee.food_allowance) || 0,
          special_allowance: Number(employee.special_allowance) || 0,
          site_allowance: Number(employee.site_allowance) || 0,
          other_allowance: Number(employee.other_allowance) || 0,
          bank_name: employee.bank_name ?? '',
          bank_bic: employee.bank_bic ?? '',
          bank_iban: employee.bank_iban ?? '',
          status: employee.status || 'active',
          onboarding_status: employee.onboarding_status ?? '',
          last_offer_sent_at: employee.last_offer_sent_at ?? '',
          offer_accepted_at: employee.offer_accepted_at ?? '',
          opening_leave_balance: Number(employee.opening_leave_balance) || 0,
          opening_air_tickets: Number(employee.opening_air_tickets) || 0,
          emergency_contact_name: employee.emergency_contact_name ?? '',
          emergency_contact_phone: employee.emergency_contact_phone ?? '',
          home_country_address: employee.home_country_address ?? '',
          reporting_to: employee.reporting_to ?? '',
          avatar_url: employee.avatar_url ?? null,
          is_salary_held: Boolean(employee.is_salary_held),
          salary_hold_reason: employee.salary_hold_reason ?? '',
          air_ticket_cycle: Number(employee.air_ticket_cycle) || 12,
        });
        const valid = await trigger();
        if (!valid) {
          setCanSubmit(valid);
        } else {
          setCanSubmit(valid);
          setTimeout(() => setHasInitialized(true), 0);
        }
      } else {
        // Initialize create form
        console.log('[initForm] Creating new employee for companyId:', companyId);
        const nextCode = await generateNextEmpCode();
        console.log('[initForm] nextCode from generateNextEmpCode():', nextCode);
        reset({
          ...emptyForm,
          company_id: companyId,
          emp_code: nextCode,
        });
        const valid = await trigger();
        setCanSubmit(valid);
        if (valid) {
          setTimeout(() => setHasInitialized(true), 0);
        } else {
          setHasInitialized(true);
        }
      }
    };

    initForm();
  }, [isOpen, employee, companyId, reset, trigger, isValid]);

  // Keep canSubmit in sync with RHF's isValid state
  useEffect(() => {
    if (hasInitialized) {
      setCanSubmit(isValid);
    }
  }, [isValid, errors, hasInitialized]);

  // Auto-generate next employee code (sequential from max existing for company)
  const generateNextEmpCode = async (): Promise<string> => {
    try {
      console.log('[generateNextEmpCode] START - companyId prop:', companyId, '(type:', typeof companyId, ')');
      const { createClient } = await import('@/lib/supabase/client');
      const supabase = createClient();

      // First, check what employees exist for this company (debug)
      const { data: allEmps, error: allErr } = await supabase
        .from('employees')
        .select('emp_code, name_en, company_id')
        .eq('company_id', companyId);
      console.log('[generateNextEmpCode] Query used company_id:', companyId);
      console.log('[generateNextEmpCode] All employees result:', { count: allEmps?.length, error: allErr?.message, data: allEmps });

      // Use the database RPC to get the next code (same logic as trigger)
      const { data: nextCode, error: rpcErr } = await supabase
        .rpc('preview_next_employee_code', { p_company_id: companyId });

      console.log('[generateNextEmpCode] RPC result:', { nextCode, error: rpcErr });

      if (rpcErr) {
        console.error('[generateNextEmpCode] RPC failed, using fallback. Error:', rpcErr);
        // Fallback: manual calculation
        const { data: empCodesResult, error: fallbackErr } = await supabase
          .from('employees')
          .select('emp_code')
          .eq('company_id', companyId)
          .not('emp_code', 'is', null);
        console.log('[generateNextEmpCode] Fallback query used company_id:', companyId);
        console.log('[generateNextEmpCode] Fallback query result:', { count: empCodesResult?.length, error: fallbackErr, sample: empCodesResult?.slice(0, 5) });
        const numericCodes = (empCodesResult || [])
          .map((emp: { emp_code: unknown }) => emp.emp_code)
          .filter((code: unknown): code is string => typeof code === 'string' && /^\d+$/.test(code))
          .map((code: string) => parseInt(code, 10));
        const max = numericCodes.length > 0 ? Math.max(...numericCodes) : 0;
        const fallbackResult = String(max + 1);
        console.log('[generateNextEmpCode] Fallback numeric codes:', numericCodes, 'max:', max, 'result:', fallbackResult);
        return fallbackResult;
      }

      const result = nextCode || '1';
      console.log('[generateNextEmpCode] SUCCESS — returning RPC result:', result);
      return result;
    } catch (err) {
      console.error('[generateNextEmpCode] Exception:', err);
      return '1';
    }
  };

  const onSubmit = async (data: EmployeeFormValues) => {
    try {
      // Build API payload with explicit field mapping
      const formData: EmployeeFormData = {
        company_id: data.company_id,
        emp_code: data.emp_code,
        name_en: data.name_en,
        email: data.email || null,
        id_type: data.id_type,
        civil_id: data.civil_id || '',
        passport_no: data.passport_no || '',
        passport_expiry: data.passport_expiry || null,
        passport_issue_date: data.passport_issue_date || null,
        visa_no: data.visa_no || null,
        visa_type: data.visa_type || null,
        visa_issue_date: data.visa_issue_date || null,
        visa_expiry: data.visa_expiry || null,
        nationality: data.nationality,
        gender: data.gender,
        religion: data.religion,
        family_status: data.family_status === '' ? undefined : (data.family_status as 'single' | 'family' | undefined),
        category: data.category,
        department: data.department,
        designation: data.designation,
        join_date: data.join_date,
        basic_salary: data.basic_salary,
        housing_allowance: data.housing_allowance,
        transport_allowance: data.transport_allowance,
        food_allowance: data.food_allowance,
        special_allowance: data.special_allowance,
        site_allowance: data.site_allowance,
        other_allowance: data.other_allowance,
        bank_name: data.bank_name,
        bank_bic: data.bank_bic,
        bank_iban: data.bank_iban,
        status: data.status,
        onboarding_status: data.onboarding_status === '' ? undefined : data.onboarding_status,
        last_offer_sent_at: data.last_offer_sent_at || undefined,
        offer_accepted_at: data.offer_accepted_at || undefined,
        opening_leave_balance: data.opening_leave_balance,
        opening_air_tickets: data.opening_air_tickets,
        air_ticket_cycle: data.air_ticket_cycle,
        emergency_contact_name: data.emergency_contact_name,
        emergency_contact_phone: data.emergency_contact_phone,
        home_country_address: data.home_country_address,
        reporting_to: data.reporting_to,
        avatar_url: data.avatar_url || null,
        is_salary_held: data.is_salary_held,
        salary_hold_reason: data.salary_hold_reason || null,
        salary_hold_at: data.salary_hold_at || null,
        termination_date: null,
        leave_settlement_date: null,
        rejoin_date: null,
      };

      if (isEditing && employee) {
        await onUpdate({ id: employee.id, updates: formData });
        toast.success('Employee updated successfully');
      } else {
        await onCreate(formData);
        toast.success('Employee created successfully');
      }
      onClose();
    } catch (error) {
      console.error('Save error:', error);
      toast.error('Failed to save employee');
    }
  };

  // Check if button should be disabled - form must be valid and not submitting
  const isButtonDisabled = isSubmitting || !canSubmit;

  const handlePhotoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setPhotoPreview(reader.result as string);
        setValue('avatar_url', reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  return (
    <Sheet open={isOpen} onOpenChange={onClose}>
      <SheetContent
        className="w-[80vw] max-w-none overflow-y-auto p-6"
        style={{ width: '80vw', maxWidth: 'none' }}
      >
        <SheetHeader className="mb-6">
          <div className="flex items-center gap-2 mb-3">
            <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200">
              {isEditing ? 'Edit Employee' : 'New Employee'}
            </Badge>
            <Badge variant="outline" className="bg-emerald-50 text-emerald-700 border-emerald-200">
              {isEditing ? categoryLabels[employee?.category || 'staff'] : 'Staff'}
            </Badge>
          </div>
          <SheetTitle className="text-2xl font-bold">
            {isEditing ? `Edit ${employee?.name_en}` : 'Add New Employee'}
          </SheetTitle>
          <SheetDescription>
            {isEditing
              ? 'Update employee information and settings'
              : 'Enter the new employee details below'}
          </SheetDescription>
        </SheetHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
          {/* Photo & Gross Salary - Top Bar */}
          <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center p-4 bg-slate-50 rounded-xl border">
            {/* Photo Upload */}
            <div className="flex flex-col items-center gap-2 shrink-0">
              <div className="relative">
                <div className="w-20 h-20 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-white text-3xl font-bold overflow-hidden">
                  {photoPreview ? (
                    <img src={photoPreview} alt="Preview" className="w-full h-full object-cover" />
                  ) : (
                    <span>{formValues.name_en?.charAt(0)?.toUpperCase() || '?'}</span>
                  )}
                </div>
                <label className="absolute bottom-0 right-0 w-7 h-7 bg-blue-600 rounded-full flex items-center justify-center cursor-pointer hover:bg-blue-700 transition-colors border-2 border-white">
                  <Upload className="w-3.5 h-3.5 text-white" />
                  <input
                    type="file"
                    accept="image/*"
                    onChange={handlePhotoChange}
                    className="hidden"
                  />
                </label>
              </div>
              <span className="text-[10px] text-muted-foreground font-medium">Photo</span>
            </div>

            {/* Employee Code & Gross */}
            <div className="flex-1 grid grid-cols-1 sm:grid-cols-2 gap-4 w-full">
              <div className="space-y-1">
                <Label className="text-[10px] font-black uppercase text-slate-400">Employee Code</Label>
                <div className="relative">
                  <Input
                    {...register('emp_code')}
                    placeholder="Auto-generated"
                    className="font-mono font-bold h-10 rounded-xl bg-white"
                  />
                  {errors.emp_code && (
                    <p className="text-xs text-red-600 mt-1">{errors.emp_code.message}</p>
                  )}
                </div>
              </div>
              <div className="space-y-1">
                <Label className="text-[10px] font-black uppercase text-slate-400">Gross Monthly Salary</Label>
                <div className="h-10 rounded-xl bg-emerald-600 text-white flex items-center justify-between px-3 font-mono font-bold text-base">
                  <span>{grossSalary.toFixed(3)} OMR</span>
                  <Sparkles className="w-4 h-4 opacity-60" />
                </div>
              </div>
            </div>
          </div>

          {/* Tabs */}
          <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-3">
            <TabsList className="grid w-full grid-cols-4 rounded-xl bg-slate-100 p-1 flex-shrink-0 overflow-x-auto h-9">
              <TabsTrigger value="personal" className="rounded-lg text-xs whitespace-nowrap">Personal</TabsTrigger>
              <TabsTrigger value="employment" className="rounded-lg text-xs whitespace-nowrap">Employment</TabsTrigger>
              <TabsTrigger value="banking" className="rounded-lg text-xs whitespace-nowrap">Banking</TabsTrigger>
              <TabsTrigger value="additional" className="rounded-lg text-xs whitespace-nowrap">Additional</TabsTrigger>
            </TabsList>

            {/* Personal Information Tab */}
            <TabsContent value="personal" className="space-y-3 mt-3">
              <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-2 gap-x-4 gap-y-3">
                {/* English Name - full width on all screens */}
                <div className="space-y-1 sm:col-span-2">
                  <Label htmlFor="name_en" className="text-[10px] font-black uppercase text-slate-400">
                    Full Name (English) <span className="text-red-500">*</span>
                  </Label>
                  <Input
                    id="name_en"
                    {...register('name_en')}
                    placeholder="Enter full name"
                    className="h-10 rounded-xl"
                  />
                  {errors.name_en && (
                    <p className="text-xs text-red-600">{errors.name_en.message}</p>
                  )}
                </div>

                {/* Email */}
                <div className="space-y-1.5">
                  <Label htmlFor="email" className="text-xs font-black uppercase text-slate-400">
                    Email Address <span className="text-red-500">*</span>
                  </Label>
                  <Input
                    id="email"
                    type="email"
                    {...register('email')}
                    placeholder="employee@company.com"
                    className="h-11 rounded-xl"
                  />
                  {errors.email && (
                    <p className="text-xs text-red-600">{errors.email.message}</p>
                  )}
                </div>

                {/* ID Type */}
                <div className="space-y-1.5">
                  <Label className="text-xs font-black uppercase text-slate-400">
                    ID Type <span className="text-red-500">*</span>
                  </Label>
                  <Select
                    value={formValues.id_type}
                    onValueChange={(value) => setValue('id_type', value as IdType)}
                  >
                    <SelectTrigger className="h-11 rounded-xl">
                      <SelectValue placeholder="Select ID type" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="civil_id">Civil ID</SelectItem>
                      <SelectItem value="passport">Passport</SelectItem>
                    </SelectContent>
                  </Select>
                  {errors.id_type && (
                    <p className="text-xs text-red-600">{errors.id_type.message}</p>
                  )}
                </div>

                {/* Civil ID / Passport - full width */}
                <div className="space-y-1.5 sm:col-span-2">
                  <Label htmlFor="civil_id" className="text-xs font-black uppercase text-slate-400">
                    {formValues.id_type === 'civil_id' ? 'Civil ID Number' : 'Passport Number'}
                    <span className="text-red-500">*</span>
                  </Label>
                  <Input
                    id="civil_id"
                    {...register('civil_id')}
                    placeholder={formValues.id_type === 'civil_id' ? 'Enter Civil ID' : 'Enter Passport Number'}
                    className="h-11 rounded-xl font-mono"
                  />
                  {errors.civil_id && (
                    <p className="text-xs text-red-600">{errors.civil_id.message}</p>
                  )}
                </div>

                {/* Nationality */}
                <div className="space-y-1.5">
                  <Label htmlFor="nationality" className="text-xs font-black uppercase text-slate-400">
                    Nationality <span className="text-red-500">*</span>
                  </Label>
                  <Select
                    value={formValues.nationality}
                    onValueChange={(value) => setValue('nationality', value as Nationality)}
                  >
                    <SelectTrigger className="h-11 rounded-xl font-bold uppercase">
                      <SelectValue placeholder="Select nationality" />
                    </SelectTrigger>
                    <SelectContent>
                      {Object.entries(nationalityLabels).map(([value, label]) => (
                        <SelectItem key={value} value={value} className="uppercase">
                          {label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {errors.nationality && (
                    <p className="text-xs text-red-600">{errors.nationality.message}</p>
                  )}
                </div>

                {/* Gender */}
                <div className="space-y-1.5">
                  <Label className="text-xs font-black uppercase text-slate-400">Gender</Label>
                  <Select
                    value={formValues.gender}
                    onValueChange={(value) => setValue('gender', value as 'male' | 'female' | 'other')}
                  >
                    <SelectTrigger className="h-11 rounded-xl">
                      <SelectValue placeholder="Select gender" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="male">Male</SelectItem>
                      <SelectItem value="female">Female</SelectItem>
                      <SelectItem value="other">Other</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {/* Religion */}
                <div className="space-y-1.5">
                  <Label className="text-xs font-black uppercase text-slate-400">Religion</Label>
                  <Select
                    value={formValues.religion}
                    onValueChange={(value) => setValue('religion', value as 'muslim' | 'non-muslim' | 'other')}
                  >
                    <SelectTrigger className="h-11 rounded-xl">
                      <SelectValue placeholder="Select religion" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="muslim">Muslim</SelectItem>
                      <SelectItem value="non-muslim">Non-Muslim</SelectItem>
                      <SelectItem value="other">Other</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {/* Family Status */}
                <div className="space-y-1.5">
                  <Label className="text-xs font-black uppercase text-slate-400">Accommodation</Label>
                  <Select
                    value={formValues.family_status}
                    onValueChange={(value) => setValue('family_status', value as 'single' | 'family' | '')}
                  >
                    <SelectTrigger className="h-11 rounded-xl">
                      <SelectValue placeholder="Select status" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="single">Single (No Family)</SelectItem>
                      <SelectItem value="family">Family (With Dependents)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {/* Category */}
                <div className="space-y-1.5">
                  <Label className="text-xs font-black uppercase text-slate-400">
                    Category <span className="text-red-500">*</span>
                  </Label>
                  <Select
                    value={formValues.category}
                    onValueChange={(value) => setValue('category', value as EmployeeCategory)}
                  >
                    <SelectTrigger className="h-11 rounded-xl">
                      <SelectValue placeholder="Select category" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="OMANI_DIRECT_STAFF">Omani Direct Staff</SelectItem>
                      <SelectItem value="OMANI_INDIRECT_STAFF">Omani In-Direct Staff</SelectItem>
                      <SelectItem value="DIRECT_STAFF">Direct Staff</SelectItem>
                      <SelectItem value="INDIRECT_STAFF">In-Direct Staff</SelectItem>
                    </SelectContent>
                  </Select>
                  {errors.category && (
                    <p className="text-xs text-red-600">{errors.category.message}</p>
                  )}
                </div>

                {/* Department - full width */}
                <div className="space-y-1.5 sm:col-span-2">
                  <Label htmlFor="department" className="text-xs font-black uppercase text-slate-400">
                    Department
                  </Label>
                  <Input
                    id="department"
                    {...register('department')}
                    placeholder="e.g., Engineering"
                    className="h-11 rounded-xl"
                  />
                  {errors.department && (
                    <p className="text-xs text-red-600">{errors.department.message}</p>
                  )}
                </div>

                {/* Designation - full width */}
                <div className="space-y-1.5 sm:col-span-2">
                  <Label htmlFor="designation" className="text-xs font-black uppercase text-slate-400">
                    Designation / Job Title
                  </Label>
                  <Input
                    id="designation"
                    {...register('designation')}
                    placeholder="e.g., Senior Engineer"
                    className="h-11 rounded-xl"
                  />
                  {errors.designation && (
                    <p className="text-xs text-red-600">{errors.designation.message}</p>
                  )}
                </div>

                {/* Join Date */}
                <div className="space-y-1.5">
                  <Label htmlFor="join_date" className="text-xs font-black uppercase text-slate-400">
                    Join Date <span className="text-red-500">*</span>
                  </Label>
                  <Input
                    id="join_date"
                    type="date"
                    {...register('join_date')}
                    className="h-11 rounded-xl"
                  />
                  {errors.join_date && (
                    <p className="text-xs text-red-600">{errors.join_date.message}</p>
                  )}
                </div>
              </div>
            </TabsContent>

            {/* Employment & Salary Tab */}
            <TabsContent value="employment" className="space-y-4 mt-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-x-4 gap-y-3">
                {/* Basic Salary */}
                <div className="space-y-1.5">
                  <Label htmlFor="basic_salary" className="text-xs font-black uppercase text-slate-400">
                    Basic Salary (OMR) <span className="text-red-500">*</span>
                  </Label>
                  <Input
                    id="basic_salary"
                    type="number"
                    step="0.001"
                    {...register('basic_salary', { valueAsNumber: true })}
                    placeholder="0.000"
                    className="h-11 rounded-xl font-mono"
                  />
                  {errors.basic_salary && (
                    <p className="text-xs text-red-600">{errors.basic_salary.message}</p>
                  )}
                </div>

                {/* Housing Allowance */}
                <div className="space-y-1.5">
                  <Label htmlFor="housing_allowance" className="text-xs font-black uppercase text-slate-400">
                    Housing Allowance (OMR)
                  </Label>
                  <Input
                    id="housing_allowance"
                    type="number"
                    step="0.001"
                    {...register('housing_allowance', { valueAsNumber: true })}
                    placeholder="0.000"
                    className="h-11 rounded-xl font-mono"
                  />
                </div>

                {/* Transport Allowance */}
                <div className="space-y-1.5">
                  <Label htmlFor="transport_allowance" className="text-xs font-black uppercase text-slate-400">
                    Transport Allowance (OMR)
                  </Label>
                  <Input
                    id="transport_allowance"
                    type="number"
                    step="0.001"
                    {...register('transport_allowance', { valueAsNumber: true })}
                    placeholder="0.000"
                    className="h-11 rounded-xl font-mono"
                  />
                </div>

                {/* Food Allowance */}
                <div className="space-y-1.5">
                  <Label htmlFor="food_allowance" className="text-xs font-black uppercase text-slate-400">
                    Food Allowance (OMR)
                  </Label>
                  <Input
                    id="food_allowance"
                    type="number"
                    step="0.001"
                    {...register('food_allowance', { valueAsNumber: true })}
                    placeholder="0.000"
                    className="h-11 rounded-xl font-mono"
                  />
                </div>

                {/* Special Allowance */}
                <div className="space-y-1.5">
                  <Label htmlFor="special_allowance" className="text-xs font-black uppercase text-slate-400">
                    Special Allowance (OMR)
                  </Label>
                  <Input
                    id="special_allowance"
                    type="number"
                    step="0.001"
                    {...register('special_allowance', { valueAsNumber: true })}
                    placeholder="0.000"
                    className="h-11 rounded-xl font-mono"
                  />
                </div>

                {/* Site Allowance */}
                <div className="space-y-1.5">
                  <Label htmlFor="site_allowance" className="text-xs font-black uppercase text-slate-400">
                    Site Allowance (OMR)
                  </Label>
                  <Input
                    id="site_allowance"
                    type="number"
                    step="0.001"
                    {...register('site_allowance', { valueAsNumber: true })}
                    placeholder="0.000"
                    className="h-11 rounded-xl font-mono"
                  />
                </div>

                {/* Other Allowance */}
                <div className="space-y-1.5">
                  <Label htmlFor="other_allowance" className="text-xs font-black uppercase text-slate-400">
                    Other Allowance (OMR)
                  </Label>
                  <Input
                    id="other_allowance"
                    type="number"
                    step="0.001"
                    {...register('other_allowance', { valueAsNumber: true })}
                    placeholder="0.000"
                    className="h-11 rounded-xl font-mono"
                  />
                </div>

                {/* Employment Status */}
                <div className="space-y-1.5">
                  <Label className="text-xs font-black uppercase text-slate-400">
                    Employment Status <span className="text-red-500">*</span>
                  </Label>
                  <Select
                    value={formValues.status}
                    onValueChange={(value) => setValue('status', value as EmployeeStatus)}
                  >
                    <SelectTrigger className="h-11 rounded-xl">
                      <SelectValue placeholder="Select status" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="active">Active</SelectItem>
                      <SelectItem value="on_leave">On Leave</SelectItem>
                      <SelectItem value="probation">Probation</SelectItem>
                      <SelectItem value="leave_settled">Leave Settled</SelectItem>
                      <SelectItem value="terminated">Terminated</SelectItem>
                      <SelectItem value="final_settled">Final Settled</SelectItem>
                      <SelectItem value="offer_sent">Offer Sent</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {/* Opening Leave Balance */}
                <div className="space-y-1.5">
                  <Label htmlFor="opening_leave_balance" className="text-xs font-black uppercase text-slate-400">
                    Opening Leave Balance (days)
                  </Label>
                  <Input
                    id="opening_leave_balance"
                    type="number"
                    step="0.5"
                    {...register('opening_leave_balance', { valueAsNumber: true })}
                    placeholder="0"
                    className="h-11 rounded-xl font-mono"
                  />
                </div>

                {/* Opening Air Tickets */}
                <div className="space-y-1.5">
                  <Label htmlFor="opening_air_tickets" className="text-xs font-black uppercase text-slate-400">
                    Opening Air Ticket Balance
                  </Label>
                  <Input
                    id="opening_air_tickets"
                    type="number"
                    step="0.01"
                    {...register('opening_air_tickets', { valueAsNumber: true })}
                    placeholder="0"
                    className="h-11 rounded-xl font-mono"
                  />
                  <p className="text-[10px] text-muted-foreground">Migrated from previous system</p>
                </div>

                {/* Air Ticket Cycle */}
                <div className="space-y-1.5">
                  <Label htmlFor="air_ticket_cycle" className="text-xs font-black uppercase text-slate-400">
                    Air Ticket Cycle (months)
                  </Label>
                  <Select
                    value={String(formValues.air_ticket_cycle)}
                    onValueChange={(value) => setValue('air_ticket_cycle', Number(value))}
                  >
                    <SelectTrigger className="h-11 rounded-xl">
                      <SelectValue placeholder="Select cycle" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="12">12 months (Annual)</SelectItem>
                      <SelectItem value="24">24 months (Biennial)</SelectItem>
                    </SelectContent>
                  </Select>
                  <p className="text-[10px] text-muted-foreground">2 tickets per cycle</p>
                </div>
              </div>
            </TabsContent>

            {/* Banking & Documents Tab */}
            <TabsContent value="banking" className="space-y-4 mt-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-x-4 gap-y-3">
                {/* Bank Name - full width */}
                <div className="space-y-1.5 sm:col-span-2">
                  <Label htmlFor="bank_name" className="text-xs font-black uppercase text-slate-400">
                    Bank Name <span className="text-red-500">*</span>
                  </Label>
                  <Input
                    id="bank_name"
                    {...register('bank_name')}
                    placeholder="e.g., Bank Muscat"
                    className="h-11 rounded-xl"
                  />
                  {errors.bank_name && (
                    <p className="text-xs text-red-600">{errors.bank_name.message}</p>
                  )}
                </div>

                {/* Bank BIC */}
                <div className="space-y-1.5">
                  <Label htmlFor="bank_bic" className="text-xs font-black uppercase text-slate-400">
                    Bank BIC / SWIFT Code
                  </Label>
                  <Input
                    id="bank_bic"
                    {...register('bank_bic')}
                    placeholder="e.g., BMCTOMRX"
                    className="h-11 rounded-xl font-mono"
                  />
                </div>

                {/* Bank IBAN - full width */}
                <div className="space-y-1.5 sm:col-span-2">
                  <Label htmlFor="bank_iban" className="text-xs font-black uppercase text-slate-400">
                    IBAN <span className="text-red-500">*</span>
                  </Label>
                  <Input
                    id="bank_iban"
                    {...register('bank_iban')}
                    placeholder="OMXX BMCT XXXX XXXX XXXX XXXX"
                    className="h-11 rounded-xl font-mono"
                  />
                  {errors.bank_iban && (
                    <p className="text-xs text-red-600">{errors.bank_iban.message}</p>
                  )}
                </div>

                {/* Passport Expiry */}
                <div className="space-y-1.5">
                  <Label htmlFor="passport_expiry" className="text-xs font-black uppercase text-slate-400">
                    Passport Expiry Date
                  </Label>
                  <Input
                    id="passport_expiry"
                    type="date"
                    {...register('passport_expiry')}
                    className="h-11 rounded-xl"
                  />
                </div>

                {/* Passport Issue Date */}
                <div className="space-y-1.5">
                  <Label htmlFor="passport_issue_date" className="text-xs font-black uppercase text-slate-400">
                    Passport Issue Date
                  </Label>
                  <Input
                    id="passport_issue_date"
                    type="date"
                    {...register('passport_issue_date')}
                    className="h-11 rounded-xl"
                  />
                </div>

                {/* Visa Number */}
                <div className="space-y-1.5">
                  <Label htmlFor="visa_no" className="text-xs font-black uppercase text-slate-400">
                    Visa Number
                  </Label>
                  <Input
                    id="visa_no"
                    {...register('visa_no')}
                    placeholder="Visa reference number"
                    className="h-11 rounded-xl font-mono"
                  />
                </div>

                {/* Visa Type */}
                <div className="space-y-1.5">
                  <Label htmlFor="visa_type" className="text-xs font-black uppercase text-slate-400">
                    Visa Type
                  </Label>
                  <Input
                    id="visa_type"
                    {...register('visa_type')}
                    placeholder="e.g., Employment Visa"
                    className="h-11 rounded-xl"
                  />
                </div>

                {/* Visa Issue Date */}
                <div className="space-y-1.5">
                  <Label htmlFor="visa_issue_date" className="text-xs font-black uppercase text-slate-400">
                    Visa Issue Date
                  </Label>
                  <Input
                    id="visa_issue_date"
                    type="date"
                    {...register('visa_issue_date')}
                    className="h-11 rounded-xl"
                  />
                </div>

                {/* Visa Expiry */}
                <div className="space-y-1.5">
                  <Label htmlFor="visa_expiry" className="text-xs font-black uppercase text-slate-400">
                    Visa Expiry Date
                  </Label>
                  <Input
                    id="visa_expiry"
                    type="date"
                    {...register('visa_expiry')}
                    className="h-11 rounded-xl"
                  />
                </div>
              </div>
            </TabsContent>

            {/* Additional Info Tab */}
            <TabsContent value="additional" className="space-y-4 mt-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-x-4 gap-y-3">
                {/* Emergency Contact Name - full width */}
                <div className="space-y-1.5 sm:col-span-2">
                  <Label htmlFor="emergency_contact_name" className="text-xs font-black uppercase text-slate-400">
                    Emergency Contact Name
                  </Label>
                  <Input
                    id="emergency_contact_name"
                    {...register('emergency_contact_name')}
                    placeholder="Full name of emergency contact"
                    className="h-11 rounded-xl"
                  />
                </div>

                {/* Emergency Contact Phone */}
                <div className="space-y-1.5">
                  <Label htmlFor="emergency_contact_phone" className="text-xs font-black uppercase text-slate-400">
                    Emergency Contact Phone
                  </Label>
                  <Input
                    id="emergency_contact_phone"
                    {...register('emergency_contact_phone')}
                    placeholder="+968 XXXX XXXX"
                    className="h-11 rounded-xl"
                  />
                </div>

                {/* Home Country Address - full width */}
                <div className="space-y-1.5 sm:col-span-2">
                  <Label htmlFor="home_country_address" className="text-xs font-black uppercase text-slate-400">
                    Home Country Address
                  </Label>
                  <Input
                    id="home_country_address"
                    {...register('home_country_address')}
                    placeholder="Full address in home country"
                    className="h-11 rounded-xl"
                  />
                </div>

                {/* Reporting To - full width */}
                <div className="space-y-1.5 sm:col-span-2">
                  <Label htmlFor="reporting_to" className="text-xs font-black uppercase text-slate-400">
                    Reports To (Manager/Supervisor)
                  </Label>
                  <Input
                    id="reporting_to"
                    {...register('reporting_to')}
                    placeholder="Name of reporting manager"
                    className="h-11 rounded-xl"
                  />
                </div>

                {/* Onboarding Status */}
                <div className="space-y-1.5">
                  <Label className="text-xs font-black uppercase text-slate-400">Onboarding Status</Label>
                  <Select
                    value={formValues.onboarding_status ?? ''}
                    onValueChange={(value) => setValue('onboarding_status', value as any)}
                  >
                    <SelectTrigger className="h-11 rounded-xl">
                      <SelectValue placeholder="Select status" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="">Not Set</SelectItem>
                      <SelectItem value="offer_pending">Offer Pending</SelectItem>
                      <SelectItem value="ready_to_hire">Ready to Hire</SelectItem>
                      <SelectItem value="joined">Joined</SelectItem>
                      <SelectItem value="offer_rejected">Offer Rejected</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {/* Salary Hold Checkbox */}
                <div className="space-y-1.5">
                  <div className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      id="is_salary_held"
                      {...register('is_salary_held')}
                      className="w-4 h-4 rounded border-gray-300"
                    />
                    <Label htmlFor="is_salary_held" className="text-sm font-medium">
                      Hold Salary
                    </Label>
                  </div>
                  <p className="text-[10px] text-muted-foreground">
                    Check to place employee salary on hold
                  </p>
                </div>

                {/* Salary Hold Reason - full width, shown conditionally */}
                {formValues.is_salary_held && (
                  <div className="space-y-1.5 sm:col-span-2">
                    <Label htmlFor="salary_hold_reason" className="text-xs font-black uppercase text-slate-400">
                      Salary Hold Reason
                    </Label>
                    <Input
                      id="salary_hold_reason"
                      {...register('salary_hold_reason')}
                      placeholder="Reason for holding salary"
                      className="h-11 rounded-xl"
                    />
                  </div>
                )}
              </div>
            </TabsContent>
          </Tabs>

          {/* Footer */}
          <SheetFooter className="flex flex-col-reverse sm:flex-row gap-2 sm:gap-0 pt-3 border-t">
            <Button
              type="button"
              variant="ghost"
              onClick={onClose}
              className="w-full sm:w-auto font-bold text-slate-400 hover:text-slate-900"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={isButtonDisabled}
              className="w-full sm:w-auto bg-blue-600 hover:bg-blue-700 text-white font-bold px-8 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isSubmitting ? (
                'Saving...'
              ) : isEditing ? (
                'Commit Updates'
              ) : (
                'Create Employee'
              )}
            </Button>
          </SheetFooter>
        </form>
      </SheetContent>
    </Sheet>
  );
}
