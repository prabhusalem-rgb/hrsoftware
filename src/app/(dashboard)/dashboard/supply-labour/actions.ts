'use server';

import { revalidatePath } from 'next/cache';
import { requireModulePermission } from '@/lib/auth/server-permissions';
import { supplyLabourSchema, type SupplyLabourInput, type SupplyLabourFormData } from '@/lib/validations/schemas';
import { Employee } from '@/types';

/**
 * Fetch all supply labour workers for a company.
 */
export async function getSupplyLabourWorkers(targetCompanyId?: string, supplierFilter?: string) {
  const { profile, supabase } = await requireModulePermission('attendance', 'read', targetCompanyId);
  const companyId = targetCompanyId || profile.company_id;

  if (!companyId) {
    throw new Error('Company ID is required to fetch supply labour workers.');
  }

  let query = supabase
    .from('employees')
    .select(`
      id,
      company_id,
      emp_code,
      name_en,
      civil_id,
      id_type,
      contact_phone,
      emergency_contact_phone,
      supplier_name,
      category,
      basic_salary,
      gross_salary,
      bank_name,
      bank_iban,
      status,
      department,
      designation,
      join_date,
      created_at,
      updated_at
    `)
    .eq('company_id', companyId)
    .eq('category', 'SUPPLY_LABOUR')
    .order('name_en');

  if (supplierFilter && supplierFilter !== 'all') {
    query = query.eq('supplier_name', supplierFilter);
  }

  const { data, error } = await query;
  if (error) {
    console.error('[getSupplyLabourWorkers] Database error:', error);
    throw new Error(error.message);
  }

  return (data || []) as unknown as Employee[];
}

/**
 * Get distinct list of active suppliers for filtering.
 */
export async function getSuppliersList(targetCompanyId?: string) {
  const { profile, supabase } = await requireModulePermission('attendance', 'read', targetCompanyId);
  const companyId = targetCompanyId || profile.company_id;

  if (!companyId) return [];

  const { data, error } = await supabase
    .from('employees')
    .select('supplier_name')
    .eq('company_id', companyId)
    .eq('category', 'SUPPLY_LABOUR')
    .not('supplier_name', 'is', null)
    .neq('supplier_name', '');

  if (error) {
    console.error('[getSuppliersList] Error:', error);
    return [];
  }

  const suppliers = Array.from(new Set((data || []).map((row: any) => row.supplier_name?.trim()).filter(Boolean)));
  return suppliers.sort();
}

/**
 * Generate next sequential supply labour code: SL-001, SL-002, etc.
 */
async function generateNextSupplyLabourCode(supabase: any, companyId: string): Promise<string> {
  const { data } = await supabase
    .from('employees')
    .select('emp_code')
    .eq('company_id', companyId)
    .eq('category', 'SUPPLY_LABOUR');

  const existingCodes = (data || []).map((e: any) => e.emp_code || '');
  const slNumbers = existingCodes
    .map((code: string) => {
      const match = code.match(/SL-(\d+)/i);
      return match ? parseInt(match[1], 10) : 0;
    })
    .filter((n: number) => !isNaN(n) && n > 0);

  const nextNumber = slNumbers.length > 0 ? Math.max(...slNumbers) + 1 : 1;
  return `SL-${String(nextNumber).padStart(3, '0')}`;
}

/**
 * Create a new supply labour worker record.
 */
export async function createSupplyLabourWorker(formData: SupplyLabourInput) {
  const validated = supplyLabourSchema.parse(formData);
  const { profile, supabase } = await requireModulePermission('attendance', 'create', validated.company_id);

  // Generate sequential code if not provided
  let empCode = validated.emp_code?.trim();
  if (!empCode) {
    empCode = await generateNextSupplyLabourCode(supabase, validated.company_id);
  }

  // Check for duplicate emp_code in company
  const { data: existingCode } = await supabase
    .from('employees')
    .select('id')
    .eq('company_id', validated.company_id)
    .eq('emp_code', empCode)
    .maybeSingle();

  if (existingCode) {
    throw new Error(`Worker code ${empCode} already exists in this company.`);
  }

  // Insert payload
  const insertPayload = {
    company_id: validated.company_id,
    emp_code: empCode,
    name_en: validated.name_en.trim(),
    id_type: 'civil_id',
    civil_id: validated.civil_id.trim(),
    contact_phone: validated.contact_phone.trim(),
    emergency_contact_phone: validated.contact_phone.trim(),
    supplier_name: validated.supplier_name?.trim() || '',
    category: 'SUPPLY_LABOUR',
    basic_salary: Number(validated.gross_salary),
    gross_salary: Number(validated.gross_salary),
    housing_allowance: 0,
    transport_allowance: 0,
    food_allowance: 0,
    special_allowance: 0,
    site_allowance: 0,
    other_allowance: 0,
    bank_name: validated.bank_name?.trim() || '',
    bank_iban: validated.bank_iban?.trim() || '',
    status: validated.status || 'active',
    department: validated.department?.trim() || 'Operations',
    designation: validated.designation?.trim() || 'Supply Labour',
    join_date: new Date().toISOString().split('T')[0],
    nationality: 'INDIAN', // Default nationality placeholder for non-Omani supply labour
  };

  const { data, error } = await supabase
    .from('employees')
    .insert(insertPayload)
    .select()
    .single();

  if (error) {
    console.error('[createSupplyLabourWorker] Insert error:', error);
    throw new Error(error.message);
  }

  revalidatePath('/dashboard/supply-labour');
  revalidatePath('/dashboard/timesheets');
  return data;
}

/**
 * Update an existing supply labour worker.
 */
export async function updateSupplyLabourWorker(
  id: string,
  formData: Partial<SupplyLabourInput>
) {
  const { profile, supabase } = await requireModulePermission('attendance', 'update');

  const { data: existing, error: fetchErr } = await supabase
    .from('employees')
    .select('id, company_id, category')
    .eq('id', id)
    .single();

  if (fetchErr || !existing) {
    throw new Error('Supply labour worker not found.');
  }

  if (profile.role !== 'super_admin' && profile.company_id && existing.company_id !== profile.company_id) {
    throw new Error('Unauthorized to modify worker for another company.');
  }

  const updatePayload: Record<string, any> = {};
  if (formData.name_en !== undefined) updatePayload.name_en = formData.name_en.trim();
  if (formData.civil_id !== undefined) updatePayload.civil_id = formData.civil_id.trim();
  if (formData.contact_phone !== undefined) {
    updatePayload.contact_phone = formData.contact_phone.trim();
    updatePayload.emergency_contact_phone = formData.contact_phone.trim();
  }
  if (formData.supplier_name !== undefined) updatePayload.supplier_name = formData.supplier_name.trim();
  if (formData.bank_name !== undefined) updatePayload.bank_name = formData.bank_name.trim();
  if (formData.bank_iban !== undefined) updatePayload.bank_iban = formData.bank_iban.trim();
  if (formData.status !== undefined) updatePayload.status = formData.status;
  if (formData.gross_salary !== undefined) {
    const salary = Number(formData.gross_salary);
    updatePayload.basic_salary = salary;
    updatePayload.gross_salary = salary;
  }
  if (formData.designation !== undefined) updatePayload.designation = formData.designation.trim();

  const { data, error } = await supabase
    .from('employees')
    .update(updatePayload)
    .eq('id', id)
    .select()
    .single();

  if (error) {
    console.error('[updateSupplyLabourWorker] Update error:', error);
    throw new Error(error.message);
  }

  revalidatePath('/dashboard/supply-labour');
  revalidatePath('/dashboard/timesheets');
  return data;
}

/**
 * Delete or terminate a supply labour worker.
 */
export async function deleteSupplyLabourWorker(id: string) {
  const { profile, supabase } = await requireModulePermission('attendance', 'delete');

  const { data: existing, error: fetchErr } = await supabase
    .from('employees')
    .select('id, company_id')
    .eq('id', id)
    .single();

  if (fetchErr || !existing) throw new Error('Worker not found.');

  if (profile.role !== 'super_admin' && profile.company_id && existing.company_id !== profile.company_id) {
    throw new Error('Unauthorized to delete worker for another company.');
  }

  // Check if timesheets reference this worker
  const { count } = await supabase
    .from('timesheets')
    .select('id', { count: 'exact', head: true })
    .eq('employee_id', id);

  if (count && count > 0) {
    // If timesheets exist, soft-inactivate instead of destroying historical records
    const { error: updateErr } = await supabase
      .from('employees')
      .update({ status: 'terminated' })
      .eq('id', id);

    if (updateErr) throw new Error(updateErr.message);
    revalidatePath('/dashboard/supply-labour');
    return { inactivated: true, message: `Worker has ${count} timesheet entries. Status set to Terminated/Inactive.` };
  }

  const { error: deleteErr } = await supabase
    .from('employees')
    .delete()
    .eq('id', id);

  if (deleteErr) throw new Error(deleteErr.message);

  revalidatePath('/dashboard/supply-labour');
  revalidatePath('/dashboard/timesheets');
  return { deleted: true };
}
