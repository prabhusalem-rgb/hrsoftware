'use server';

import { getAdminClient } from '@/lib/supabase/admin';
import { revalidatePath } from 'next/cache';
import { format, parseISO, eachDayOfInterval } from 'date-fns';

function getAdmin() {
  const admin = getAdminClient();
  if (!admin) {
    throw new Error('Database admin client initialization failed.');
  }
  return admin;
}

export interface HolidayRecord {
  id: string;
  company_id: string;
  date: string;
  name: string;
  holiday_type: 'public' | 'company' | 'restricted';
  is_paid: boolean;
  created_at: string;
  updated_at: string;
}

/**
 * 1. Fetch holidays for a company and optional year
 */
export async function getCompanyHolidays(companyId: string, year?: number): Promise<{ success: boolean; holidays?: HolidayRecord[]; error?: string }> {
  try {
    if (!companyId) return { success: false, error: 'Company ID is required' };
    const admin = getAdmin();

    let query = admin
      .from('company_holidays')
      .select('*')
      .eq('company_id', companyId)
      .order('date', { ascending: true });

    if (year) {
      const startStr = `${year}-01-01`;
      const endStr = `${year}-12-31`;
      query = query.gte('date', startStr).lte('date', endStr);
    }

    const { data, error } = await query;
    if (error) {
      console.error('[getCompanyHolidays] Error:', error);
      return { success: false, error: error.message };
    }

    return { success: true, holidays: (data || []) as HolidayRecord[] };
  } catch (err: any) {
    console.error('[getCompanyHolidays] Exception:', err);
    return { success: false, error: err.message || 'Failed to fetch company holidays' };
  }
}

/**
 * 2. Declare a new holiday (Single day or Date Range)
 */
export async function declareHoliday(payload: {
  companyId: string;
  name: string;
  holidayType: 'public' | 'company' | 'restricted';
  isPaid: boolean;
  mode: 'single' | 'range';
  date?: string;
  startDate?: string;
  endDate?: string;
}): Promise<{ success: boolean; message?: string; count?: number; error?: string }> {
  try {
    const { companyId, name, holidayType, isPaid, mode, date, startDate, endDate } = payload;
    if (!companyId) return { success: false, error: 'Company is required' };
    if (!name || !name.trim()) return { success: false, error: 'Holiday name is required' };

    const admin = getAdmin();
    const cleanName = name.trim();

    if (mode === 'single') {
      if (!date) return { success: false, error: 'Date is required for single holiday' };

      // Check if already declared on this date
      const { data: existing } = await admin
        .from('company_holidays')
        .select('id, name')
        .eq('company_id', companyId)
        .eq('date', date)
        .maybeSingle();

      if (existing) {
        return { success: false, error: `A holiday ("${existing.name}") is already declared on ${date}.` };
      }

      const { error: insertError } = await admin.from('company_holidays').insert({
        company_id: companyId,
        date,
        name: cleanName,
        holiday_type: holidayType,
        is_paid: isPaid,
      });

      if (insertError) {
        return { success: false, error: insertError.message };
      }

      revalidatePath('/dashboard/holidays');
      revalidatePath('/dashboard/attendance');
      revalidatePath('/dashboard/attendance-reports');
      revalidatePath('/portal');

      return { success: true, message: `Declared "${cleanName}" on ${date} successfully.`, count: 1 };
    } else {
      // Date Range mode
      if (!startDate || !endDate) {
        return { success: false, error: 'Start date and End date are required for date range' };
      }

      const start = parseISO(startDate);
      const end = parseISO(endDate);

      if (isNaN(start.getTime()) || isNaN(end.getTime()) || start > end) {
        return { success: false, error: 'Invalid date range: End date must be on or after start date.' };
      }

      const daysInRange = eachDayOfInterval({ start, end });
      const dateStrings = daysInRange.map(d => format(d, 'yyyy-MM-dd'));

      // Check for already existing holidays in this range
      const { data: existing } = await admin
        .from('company_holidays')
        .select('date, name')
        .eq('company_id', companyId)
        .in('date', dateStrings);

      const existingDates = new Set((existing || []).map(e => e.date));
      const datesToInsert = dateStrings.filter(d => !existingDates.has(d));

      if (datesToInsert.length === 0) {
        return {
          success: false,
          error: `All dates in the selected range (${startDate} to ${endDate}) already have holidays declared.`
        };
      }

      const rows = datesToInsert.map(d => ({
        company_id: companyId,
        date: d,
        name: cleanName,
        holiday_type: holidayType,
        is_paid: isPaid,
      }));

      const { error: insertError } = await admin.from('company_holidays').insert(rows);
      if (insertError) {
        return { success: false, error: insertError.message };
      }

      revalidatePath('/dashboard/holidays');
      revalidatePath('/dashboard/attendance');
      revalidatePath('/dashboard/attendance-reports');
      revalidatePath('/portal');

      const skippedCount = existingDates.size;
      const message = skippedCount > 0
        ? `Declared ${rows.length} holiday day(s) for "${cleanName}". (${skippedCount} day(s) skipped as already declared)`
        : `Declared ${rows.length} holiday day(s) for "${cleanName}" (${startDate} to ${endDate}) successfully.`;

      return { success: true, message, count: rows.length };
    }
  } catch (err: any) {
    console.error('[declareHoliday] Exception:', err);
    return { success: false, error: err.message || 'Failed to declare holiday' };
  }
}

/**
 * 3. Update an existing holiday
 */
export async function updateHoliday(
  id: string,
  payload: {
    name: string;
    holidayType: 'public' | 'company' | 'restricted';
    isPaid: boolean;
    date: string;
  }
): Promise<{ success: boolean; message?: string; error?: string }> {
  try {
    if (!id) return { success: false, error: 'Holiday ID is required' };
    if (!payload.name || !payload.name.trim()) return { success: false, error: 'Holiday name is required' };
    if (!payload.date) return { success: false, error: 'Date is required' };

    const admin = getAdmin();

    const { error: updateError } = await admin
      .from('company_holidays')
      .update({
        name: payload.name.trim(),
        holiday_type: payload.holidayType,
        is_paid: payload.isPaid,
        date: payload.date,
        updated_at: new Date().toISOString(),
      })
      .eq('id', id);

    if (updateError) {
      return { success: false, error: updateError.message };
    }

    revalidatePath('/dashboard/holidays');
    revalidatePath('/dashboard/attendance');
    revalidatePath('/dashboard/attendance-reports');
    revalidatePath('/portal');

    return { success: true, message: 'Holiday updated successfully.' };
  } catch (err: any) {
    console.error('[updateHoliday] Exception:', err);
    return { success: false, error: err.message || 'Failed to update holiday' };
  }
}

/**
 * 4. Delete a holiday
 */
export async function deleteHoliday(id: string): Promise<{ success: boolean; message?: string; error?: string }> {
  try {
    if (!id) return { success: false, error: 'Holiday ID is required' };
    const admin = getAdmin();

    const { error: deleteError } = await admin
      .from('company_holidays')
      .delete()
      .eq('id', id);

    if (deleteError) {
      return { success: false, error: deleteError.message };
    }

    revalidatePath('/dashboard/holidays');
    revalidatePath('/dashboard/attendance');
    revalidatePath('/dashboard/attendance-reports');
    revalidatePath('/portal');

    return { success: true, message: 'Holiday removed successfully.' };
  } catch (err: any) {
    console.error('[deleteHoliday] Exception:', err);
    return { success: false, error: err.message || 'Failed to delete holiday' };
  }
}

/**
 * 5. Import standard/pre-configured public holidays for a year
 */
export async function importStandardHolidays(
  companyId: string,
  year: number,
  holidaysList: Array<{ date: string; name: string; holiday_type: 'public' | 'company' | 'restricted'; is_paid: boolean }>
): Promise<{ success: boolean; importedCount: number; skippedCount: number; message?: string; error?: string }> {
  try {
    if (!companyId) return { success: false, importedCount: 0, skippedCount: 0, error: 'Company ID is required' };
    if (!holidaysList || holidaysList.length === 0) {
      return { success: false, importedCount: 0, skippedCount: 0, error: 'No holidays provided for import' };
    }

    const admin = getAdmin();

    // Fetch existing holidays for this company in that year
    const startStr = `${year}-01-01`;
    const endStr = `${year}-12-31`;
    const { data: existing } = await admin
      .from('company_holidays')
      .select('date')
      .eq('company_id', companyId)
      .gte('date', startStr)
      .lte('date', endStr);

    const existingDates = new Set((existing || []).map(e => e.date));

    const rowsToInsert = holidaysList
      .filter(h => !existingDates.has(h.date))
      .map(h => ({
        company_id: companyId,
        date: h.date,
        name: h.name.trim(),
        holiday_type: h.holiday_type || 'public',
        is_paid: h.is_paid ?? true,
      }));

    if (rowsToInsert.length === 0) {
      return {
        success: true,
        importedCount: 0,
        skippedCount: holidaysList.length,
        message: `All ${holidaysList.length} holidays are already declared for ${year}.`,
      };
    }

    const { error: insertError } = await admin.from('company_holidays').insert(rowsToInsert);
    if (insertError) {
      return { success: false, importedCount: 0, skippedCount: 0, error: insertError.message };
    }

    revalidatePath('/dashboard/holidays');
    revalidatePath('/dashboard/attendance');
    revalidatePath('/dashboard/attendance-reports');
    revalidatePath('/portal');

    return {
      success: true,
      importedCount: rowsToInsert.length,
      skippedCount: holidaysList.length - rowsToInsert.length,
      message: `Successfully imported ${rowsToInsert.length} public holiday(s) for ${year}. (${holidaysList.length - rowsToInsert.length} already existed and were skipped).`,
    };
  } catch (err: any) {
    console.error('[importStandardHolidays] Exception:', err);
    return { success: false, importedCount: 0, skippedCount: 0, error: err.message || 'Failed to import standard holidays' };
  }
}

