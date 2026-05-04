// ============================================================
// API Route: GET/POST /api/settlement/templates
// Purpose: List and create settlement templates
// ============================================================

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { validateRequest } from '@/lib/auth/validate-request';
import { z } from 'zod';
import type { SettlementTemplateFormData } from '@/types/settlement';

// Response helpers
function jsonSuccess<T>(data: T) {
  return NextResponse.json(data);
}

function jsonError(message: string, status: number = 400) {
  return NextResponse.json({ error: message }, { status });
}

// Validation schema
const templateCreateSchema = z.object({
  name: z.string().min(1).max(100),
  description: z.string().max(500).optional().default(''),
  config: z.object({
    terminationDate: z.string().optional(),
    reason: z.enum(['resignation', 'termination', 'contract_expiry', 'death', 'retirement', 'mutual_agreement']).optional(),
    noticeServed: z.boolean().optional().default(true),
    additionalPayments: z.number().min(0).optional().default(0),
    additionalDeductions: z.number().min(0).optional().default(0),
    notes: z.string().optional().default(''),
  }),
  is_default: z.boolean().optional().default(false),
});

// ------------------------------------------------------------
// GET /api/settlement/templates
// List all templates for the user's company
// ------------------------------------------------------------
export async function GET(request: NextRequest) {
  try {
    const { validateRequest } = await import('@/lib/auth/validate-request');
    const { request: authRequest } = await validateRequest();
    if (!authRequest) {
      return jsonError('Unauthorized', 401);
    }

    const supabase = (await createClient())!;

    // Fetch user's profile to get company_id
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('company_id')
      .eq('id', authRequest.userId)
      .single();

    if (profileError || !profile?.company_id) {
      return jsonError('Company not found for user', 404);
    }

    // Fetch templates for this company
    const { data: templates, error: templatesError } = await supabase
      .from('settlement_templates')
      .select('*')
      .eq('company_id', profile.company_id)
      .order('is_default', { ascending: false })
      .order('created_at', { ascending: false });

    if (templatesError) {
      console.error('Templates fetch error:', templatesError);
      return jsonError('Failed to fetch templates', 500);
    }

    return jsonSuccess(templates || []);
  } catch (error) {
    console.error('Templates list error:', error);
    return jsonError('Internal server error', 500);
  }
}

// ------------------------------------------------------------
// POST /api/settlement/templates
// Create a new settlement template
// ------------------------------------------------------------
export async function POST(request: NextRequest) {
  try {
    const { validateRequest } = await import('@/lib/auth/validate-request');
    const { request: authRequest } = await validateRequest();
    if (!authRequest) {
      return jsonError('Unauthorized', 401);
    }

    const supabase = (await createClient())!;

    // Fetch user's profile to get company_id and role
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('company_id, role')
      .eq('id', authRequest.userId)
      .single();

    if (profileError || !profile?.company_id) {
      return jsonError('Company not found for user', 404);
    }

    // Parse and validate request body
    const body = await request.json();
    const parsed = templateCreateSchema.safeParse(body);

    if (!parsed.success) {
      return jsonError(
        parsed.error.issues?.[0]?.message || 'Invalid template data',
        400
      );
    }

    const { name, description, config, is_default } = parsed.data;

    // If setting as default, unset any existing default for this company
    if (is_default) {
      const { error: unsetError } = await supabase
        .from('settlement_templates')
        .update({ is_default: false })
        .eq('company_id', profile.company_id);

      if (unsetError) {
        console.error('Unset default error:', unsetError);
      }
    }

    // Create template
    const { data: template, error: createError } = await supabase
      .from('settlement_templates')
      .insert({
        company_id: profile.company_id,
        name,
        description: description || '',
        config: {
          terminationDate: config.terminationDate,
          reason: config.reason,
          noticeServed: config.noticeServed,
          additionalPayments: config.additionalPayments,
          additionalDeductions: config.additionalDeductions,
          notes: config.notes,
        },
        is_default: is_default || false,
        created_by: authRequest.userId,
      })
      .select()
      .single();

    if (createError) {
      console.error('Template creation error:', createError);
      return jsonError('Failed to create template', 500);
    }

    return NextResponse.json(template, { status: 201 });
  } catch (error) {
    console.error('Template creation error:', error);
    return jsonError('Internal server error', 500);
  }
}
