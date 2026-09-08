import { getAdminClient } from '@/lib/supabase/admin';
import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { employee_id, effective_date, new_basic, new_housing, new_transport, new_food, new_special, new_site, new_other, reason, notes, approved_by } = body;

    if (!employee_id || !effective_date || !approved_by) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    const supabase = getAdminClient();
    if (!supabase) {
      return NextResponse.json({ error: 'Admin client not configured' }, { status: 500 });
    }

    // Fetch employee current salaries
    const { data: employee, error: empError } = await supabase
      .from('employees')
      .select('*')
      .eq('id', employee_id)
      .single();

    if (empError || !employee) {
      return NextResponse.json({ error: 'Employee not found' }, { status: 404 });
    }

    // Insert revision (admin bypasses RLS)
    const { data: revision, error: insertError } = await supabase
      .from('salary_revisions')
      .insert([{
        employee_id,
        effective_date,
        previous_basic: employee.basic_salary,
        new_basic,
        previous_housing: employee.housing_allowance,
        new_housing,
        previous_transport: employee.transport_allowance,
        new_transport,
        previous_food: employee.food_allowance || 0,
        new_food,
        previous_special: employee.special_allowance || 0,
        new_special,
        previous_site: employee.site_allowance || 0,
        new_site,
        previous_other: employee.other_allowance,
        new_other,
        reason,
        notes: notes || null,
        approved_by,
      }])
      .select()
      .single();

    if (insertError) {
      console.error('API insert error:', insertError);
      return NextResponse.json(
        { error: insertError.message, details: insertError },
        { status: 400 }
      );
    }

    // Update employee salary if effective date is today or past
    const effDate = new Date(effective_date);
    const today = new Date();
    if (effDate <= today) {
      await supabase
        .from('employees')
        .update({
          basic_salary: new_basic,
          housing_allowance: new_housing,
          transport_allowance: new_transport,
          food_allowance: new_food,
          special_allowance: new_special,
          site_allowance: new_site,
          other_allowance: new_other,
        })
        .eq('id', employee_id);
    }

    return NextResponse.json({ success: true, revision });
  } catch (error: any) {
    console.error('create-revision API error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to create salary revision' },
      { status: 500 }
    );
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json({ error: 'Revision ID is required' }, { status: 400 });
    }

    const supabase = getAdminClient();
    if (!supabase) {
      return NextResponse.json({ error: 'Admin client not configured' }, { status: 500 });
    }

    // Delete the revision
    const { error: deleteError } = await supabase
      .from('salary_revisions')
      .delete()
      .eq('id', id);

    if (deleteError) {
      console.error('Delete revision error:', deleteError);
      return NextResponse.json(
        { error: deleteError.message },
        { status: 400 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('delete-revision API error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to delete salary revision' },
      { status: 500 }
    );
  }
}
