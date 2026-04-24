// ============================================================
// API Route: PATCH/DELETE /api/settlement/templates/[id]
// Purpose: Update or delete a settlement template
// ============================================================

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { validateRequest } from '@/lib/auth/validate-request';
import { z } from 'zod';

// Response helpers
function jsonSuccess<T>(data: T) {
  return NextResponse.json(data);
}

function jsonError(message: string, status: number = 400) {
  return NextResponse.json({ error: message }, { status });
}

// Validation schema for updates (all fields optional)
const templateUpdateSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  description: z.string().max(500).optional(),
  config: z.object({
    terminationDate: z.string().optional(),
    reason: z.enum(['resignation', 'termination', 'contract_expiry', 'death', 'retirement', 'mutual_agreement']).optional(),
    noticeServed: z.boolean().optional(),
    additionalPayments: z.number().min(0).optional(),
    additionalDeductions: z.number().min(0).optional(),
    notes: z.string().optional(),
  }).optional(),
  is_default: z.boolean().optional(),
});

// ------------------------------------------------------------
// PATCH /api/settlement/templates/[id]
// Update a template
// ------------------------------------------------------------
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const { validateRequest } = await import('@/lib/auth/validate-request');
    const { request: authRequest } = await validateRequest();
    if (!authRequest) {
      return jsonError('Unauthorized', 401);
    }

    const supabase = (await createClient())!;

    // Fetch template to verify ownership
    const { data: existing, error: fetchError } = await supabase
      .from('settlement_templates')
      .select('*')
      .eq('id', id)
      .single();

    if (fetchError || !existing) {
      return jsonError('Template not found', 404);
    }

    // Verify user belongs to same company
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('company_id, role')
      .eq('id', authRequest.userId)
      .single();

    if (profileError || !profile || profile.company_id !== existing.company_id) {
      return jsonError('Insufficient permissions', 403);
    }

    // Parse request body
    const body = await request.json();
    const parsed = templateUpdateSchema.safeParse(body);

    if (!parsed.success) {
      return jsonError(
        parsed.error.issues?.[0]?.message || 'Invalid update data',
        400
      );
    }

    const updates: Record<string, unknown> = { updated_at: new Date().toISOString() };

    if (parsed.data.name !== undefined) updates.name = parsed.data.name;
    if (parsed.data.description !== undefined) updates.description = parsed.data.description;
    if (parsed.data.is_default !== undefined) updates.is_default = parsed.data.is_default;

    if (parsed.data.config) {
      const newConfig = { ...(existing.config as Record<string, unknown>) };
      if (parsed.data.config.terminationDate !== undefined) newConfig.terminationDate = parsed.data.config.terminationDate;
      if (parsed.data.config.reason !== undefined) newConfig.reason = parsed.data.config.reason;
      if (parsed.data.config.noticeServed !== undefined) newConfig.noticeServed = parsed.data.config.noticeServed;
      if (parsed.data.config.additionalPayments !== undefined) newConfig.additionalPayments = parsed.data.config.additionalPayments;
      if (parsed.data.config.additionalDeductions !== undefined) newConfig.additionalDeductions = parsed.data.config.additionalDeductions;
      if (parsed.data.config.notes !== undefined) newConfig.notes = parsed.data.config.notes;
      updates.config = newConfig;
    }

    // If setting as default, unset other defaults for this company
    if (parsed.data.is_default) {
      const { error: unsetError } = await supabase
        .from('settlement_templates')
        .update({ is_default: false })
        .eq('company_id', existing.company_id)
        .neq('id', id);

      if (unsetError) {
        console.error('Unset default error:', unsetError);
      }
    }

    // Update template
    const { data: updated, error: updateError } = await supabase
      .from('settlement_templates')
      .update(updates)
      .eq('id', id)
      .select()
      .single();

    if (updateError) {
      console.error('Template update error:', updateError);
      return jsonError('Failed to update template', 500);
    }

    return jsonSuccess(updated);
  } catch (error) {
    console.error('Template update error:', error);
    return jsonError('Internal server error', 500);
  }
}

// ------------------------------------------------------------
// DELETE /api/settlement/templates/[id]
// Delete a template
// ------------------------------------------------------------
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const { validateRequest } = await import('@/lib/auth/validate-request');
    const { request: authRequest } = await validateRequest();
    if (!authRequest) {
      return jsonError('Unauthorized', 401);
    }

    const supabase = (await createClient())!;

    // Fetch template to verify ownership
    const { data: existing, error: fetchError } = await supabase
      .from('settlement_templates')
      .select('company_id')
      .eq('id', id)
      .single();

    if (fetchError || !existing) {
      return jsonError('Template not found', 404);
    }

    // Verify user belongs to same company
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('company_id')
      .eq('id', authRequest.userId)
      .single();

    if (profileError || !profile || profile.company_id !== existing.company_id) {
      return jsonError('Insufficient permissions', 403);
    }

    // Delete template
    const { error: deleteError } = await supabase
      .from('settlement_templates')
      .delete()
      .eq('id', id);

    if (deleteError) {
      console.error('Template delete error:', deleteError);
      return jsonError('Failed to delete template', 500);
    }

    return jsonSuccess({ deleted: true });
  } catch (error) {
    console.error('Template delete error:', error);
    return jsonError('Internal server error', 500);
  }
}
