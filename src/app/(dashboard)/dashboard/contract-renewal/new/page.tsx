'use client';

import React, { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useCompany } from '@/components/providers/CompanyProvider';
import { useEmployees } from '@/hooks/queries/useEmployees';
import { toast } from 'sonner';
import {
  ArrowLeft,
  Search,
  UserPlus,
  ChevronRight,
  Calculator,
  User as UserIcon,
  Briefcase
} from 'lucide-react';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from '@/components/ui/select';
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

interface FormData {
  renewal_period_years: number;
  basic_salary: number;
  housing_allowance: number;
  transport_allowance: number;
  food_allowance: number;
  special_allowance: number;
  site_allowance: number;
  other_allowance: number;
}

export default function NewContractRenewalPage() {
  const router = useRouter();
  const { activeCompanyId } = useCompany();
  const { data: employeesData } = useEmployees({
    companyId: activeCompanyId || '',
    statuses: ['active', 'probation', 'on_leave']
  });

  const [loading, setLoading] = useState(false);
  const [employees, setEmployees] = useState<any[]>([]);
  const [selectedEmployeeId, setSelectedEmployeeId] = useState<string>('');
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);
  const [formData, setFormData] = useState<FormData>({
    renewal_period_years: 2,
    basic_salary: 0,
    housing_allowance: 0,
    transport_allowance: 0,
    food_allowance: 0,
    special_allowance: 0,
    site_allowance: 0,
    other_allowance: 0,
  });

  useEffect(() => {
    if (employeesData) {
      setEmployees(employeesData);
    }
  }, [employeesData]);

  const handleEmployeeChange = (id: string | null) => {
    if (!id) return;
    setSelectedEmployeeId(id);
    const emp = employees.find(e => e.id === id);
    if (emp) {
      setFormData(prev => ({
        ...prev,
        basic_salary: emp.basic_salary || 0,
        housing_allowance: emp.housing_allowance || 0,
        transport_allowance: emp.transport_allowance || 0,
        food_allowance: emp.food_allowance || 0,
        special_allowance: emp.special_allowance || 0,
        site_allowance: emp.site_allowance || 0,
        other_allowance: emp.other_allowance || 0,
      }));
    }
  };

  const handleInputChange = (field: keyof FormData, value: number) => {
    setFormData(prev => ({
      ...prev,
      [field]: value,
    }));
  };

  const validateForm = (): string | null => {
    if (!selectedEmployeeId) {
      return 'Please select an employee';
    }
    if (formData.renewal_period_years < 1) {
      return 'Renewal period must be at least 1 year';
    }
    if (formData.basic_salary < 0) {
      return 'Basic salary cannot be negative';
    }
    // Check for negative allowances
    const allowanceKeys: (keyof FormData)[] = ['housing_allowance', 'transport_allowance', 'food_allowance', 'special_allowance', 'site_allowance', 'other_allowance'];
    for (const key of allowanceKeys) {
      if (formData[key] < 0) {
        return `${key.replace('_', ' ')} cannot be negative`;
      }
    }
    return null;
  };

  const handleSubmit = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();
    const validationError = validateForm();
    if (validationError) {
      toast.error(validationError);
      return;
    }
    setShowConfirmDialog(true);
  }, [selectedEmployeeId, formData]);

  const confirmSubmit = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/contract-renewal', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          employee_id: selectedEmployeeId,
          ...formData,
        }),
      });

      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || 'Failed to create renewal request');
      }

      toast.success('Contract renewal request created successfully');
      router.push('/dashboard/contract-renewal');
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setLoading(false);
      setShowConfirmDialog(false);
    }
  };

  const totalGross = Object.entries(formData)
    .filter(([key]) => key.includes('salary') || key.includes('allowance'))
    .reduce((acc, [_, val]) => acc + (Number(val) || 0), 0);

  const selectedEmployee = employees.find(e => e.id === selectedEmployeeId);

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="sm" onClick={() => router.back()}>
          <ArrowLeft className="w-4 h-4 mr-2" />
          Back
        </Button>
        <h1 className="text-3xl font-bold tracking-tight">Initiate Contract Renewal</h1>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* Step 1: Select Employee */}
          <Card className="md:col-span-1 border-slate-200">
            <CardHeader className="pb-4">
              <div className="w-10 h-10 rounded-lg bg-slate-900 text-white flex items-center justify-center mb-2">
                <UserIcon className="w-5 h-5" />
              </div>
              <CardTitle className="text-lg">Step 1</CardTitle>
              <CardDescription>Select the employee for renewal.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
                <div className="space-y-2">
                <Label>Employee</Label>
                <Select onValueChange={handleEmployeeChange} value={selectedEmployeeId}>
                  <SelectTrigger className="w-full">
                    <SelectValue>
                      {selectedEmployee ? `${selectedEmployee.name_en} (${selectedEmployee.emp_code})` : 'Select employee...'}
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    {employees.map(emp => (
                      <SelectItem key={emp.id} value={emp.id}>
                        {emp.name_en} ({emp.emp_code})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {selectedEmployee && (
                <div className="p-4 bg-slate-50 rounded-lg space-y-2 border border-slate-100">
                  <div className="flex items-center gap-2 text-sm font-medium text-slate-900">
                    <Briefcase className="w-4 h-4 text-slate-400" />
                    {selectedEmployee.designation}
                  </div>
                  <div className="text-xs text-slate-500">
                    Dept: {selectedEmployee.department || 'N/A'}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Step 2: Salary Details */}
          <Card className="md:col-span-2 border-slate-200 shadow-sm">
            <CardHeader className="pb-4">
              <div className="w-10 h-10 rounded-lg bg-slate-900 text-white flex items-center justify-center mb-2">
                <Calculator className="w-5 h-5" />
              </div>
              <CardTitle className="text-lg">Step 2</CardTitle>
              <CardDescription>Configure salary breakdown for the new contract period.</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Renewal Period (Years) <span className="text-red-500">*</span></Label>
                  <Input
                    type="number"
                    min={1}
                    value={formData.renewal_period_years}
                    onChange={e => handleInputChange('renewal_period_years', parseInt(e.target.value) || 0)}
                  />
                  {formData.renewal_period_years < 1 && (
                    <p className="text-xs text-red-500">Must be at least 1 year</p>
                  )}
                </div>
                <div className="space-y-2">
                  <Label>Basic Salary (OMR) <span className="text-red-500">*</span></Label>
                  <Input
                    type="number"
                    step="0.001"
                    min={0}
                    value={formData.basic_salary}
                    onChange={e => handleInputChange('basic_salary', parseFloat(e.target.value) || 0)}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Housing Allowance (OMR)</Label>
                  <Input
                    type="number"
                    step="0.001"
                    min={0}
                    value={formData.housing_allowance}
                    onChange={e => handleInputChange('housing_allowance', parseFloat(e.target.value) || 0)}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Transport Allowance (OMR)</Label>
                  <Input
                    type="number"
                    step="0.001"
                    min={0}
                    value={formData.transport_allowance}
                    onChange={e => handleInputChange('transport_allowance', parseFloat(e.target.value) || 0)}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Food Allowance (OMR)</Label>
                  <Input
                    type="number"
                    step="0.001"
                    min={0}
                    value={formData.food_allowance}
                    onChange={e => handleInputChange('food_allowance', parseFloat(e.target.value) || 0)}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Special Allowance (OMR)</Label>
                  <Input
                    type="number"
                    step="0.001"
                    min={0}
                    value={formData.special_allowance}
                    onChange={e => handleInputChange('special_allowance', parseFloat(e.target.value) || 0)}
                  />
                </div>
              </div>

              <div className="mt-8 p-6 bg-slate-900 rounded-xl text-white flex justify-between items-center shadow-lg">
                <div>
                  <p className="text-slate-400 text-xs uppercase tracking-wider font-bold mb-1">New Monthly Gross</p>
                  <div className="text-3xl font-mono font-bold">{totalGross.toFixed(3)} <span className="text-sm font-normal">OMR</span></div>
                </div>
                <Button
                  type="submit"
                  disabled={loading || !selectedEmployeeId}
                  className="bg-white text-slate-900 hover:bg-slate-100 font-bold px-8 h-12"
                >
                  {loading ? 'Processing...' : 'Generate Secure Link'}
                  <ChevronRight className="w-4 h-4 ml-2" />
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </form>

      {/* Confirmation Dialog */}
      <AlertDialog open={showConfirmDialog} onOpenChange={setShowConfirmDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Create Contract Renewal Request?</AlertDialogTitle>
            <AlertDialogDescription>
              A secure signing link will be generated and sent to <strong>{selectedEmployee?.name_en}</strong> ({selectedEmployee?.email || 'no email on file'}) via email.
              The renewal details cannot be edited after creation.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="py-4 space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-slate-600">Employee:</span>
              <span className="font-medium">{selectedEmployee?.name_en}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-slate-600">Renewal Period:</span>
              <span className="font-medium">{formData.renewal_period_years} year(s)</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-slate-600">New Gross Salary:</span>
              <span className="font-medium">{totalGross.toFixed(3)} OMR</span>
            </div>
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={confirmSubmit} disabled={loading}>
              {loading ? 'Creating...' : 'Create Renewal Request'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
