import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';
import { logAudit } from '@/lib/audit/audit-logger.server';
import { logException } from '@/lib/audit/exception-logger.server';

export async function PUT(request: Request) {
  try {
    const supabase = await createClient();
    if (!supabase) {
      return NextResponse.json({ error: 'Failed to initialize Supabase client' }, { status: 500 });
    }

    const { data: { user }, error: userError } = await supabase.auth.getUser();

    if (!user || userError) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { full_name, password } = body;

    // Get current profile for change tracking
    const { data: oldProfile } = await supabase
      .from('profiles')
      .select('full_name')
      .eq('id', user.id)
      .single();

    const changes: Array<{ field: string; oldValue: unknown; newValue: unknown }> = [];

    // 1. Update Password if provided
    if (password && password.trim() !== '') {
      const { error: pwError } = await supabase.auth.updateUser({
        password: password.trim()
      });

      if (pwError) {
        await logException({
          user_id: user.id,
          error_type: 'auth_error',
          message: `Password update failed: ${pwError.message}`,
          route: '/api/auth/update-profile',
          method: 'PUT',
          severity: 'high',
        }, supabase).catch(console.error);
        return NextResponse.json({ error: pwError.message }, { status: 500 });
      }

      changes.push({ field: 'password', oldValue: '***', newValue: '***' });
      await logAudit({
        user_id: user.id,
        entity_type: 'profile',
        entity_id: user.id,
        action: 'password_change',
        metadata: { route: '/api/auth/update-profile' },
      }, supabase).catch(console.error);
    }

    // 2. Update Full Name if provided
    if (full_name && full_name.trim() !== '') {
      const trimmedName = full_name.trim();

      // Update Auth metadata
      const { error: metaError } = await supabase.auth.updateUser({
        data: { full_name: trimmedName }
      });

      if (metaError) {
        console.warn('METADATA_UPDATE_WARNING:', metaError.message);
      }

      // Update Database profile
      const { error: profileError } = await supabase
        .from('profiles')
        .update({
          full_name: trimmedName,
          updated_at: new Date().toISOString()
        })
        .eq('id', user.id);

      if (profileError) {
        await logException({
          user_id: user.id,
          error_type: 'database_error',
          message: `Profile update failed: ${profileError.message}`,
          route: '/api/auth/update-profile',
          method: 'PUT',
          severity: 'medium',
        }, supabase).catch(console.error);
        return NextResponse.json({ error: profileError.message }, { status: 500 });
      }

      if (oldProfile && oldProfile.full_name !== trimmedName) {
        changes.push({ field: 'full_name', oldValue: oldProfile.full_name, newValue: trimmedName });
      }
    }

    // Log profile changes
    if (changes.length > 0) {
      await logAudit({
        user_id: user.id,
        entity_type: 'profile',
        entity_id: user.id,
        action: 'update',
        old_values: changes.reduce((acc, c) => ({ ...acc, [c.field]: c.oldValue }), {}),
        new_values: changes.reduce((acc, c) => ({ ...acc, [c.field]: c.newValue }), {}),
        metadata: { route: '/api/auth/update-profile' },
      }, supabase).catch(console.error);
    }

    return NextResponse.json({ success: true, message: 'Profile updated successfully' });
  } catch (err: any) {
    console.error('PROFILE_UPDATE_ERROR:', err);
    await logException({
      error_type: 'system_error',
      message: err.message || 'Profile update failed',
      stack_trace: err.stack,
      route: '/api/auth/update-profile',
      method: 'PUT',
      severity: 'high',
    }).catch(console.error);
    return NextResponse.json({ error: err.message || 'Internal server error' }, { status: 500 });
  }
}
