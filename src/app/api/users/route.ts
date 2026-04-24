import { supabaseAdmin } from '@/lib/supabase/admin';
import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';

// Helper to generate a random temporary password
function generateTempPassword(length = 12) {
  const charset = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%^&*";
  let password = "";
  for (let i = 0; i < length; i++) {
    password += charset.charAt(Math.floor(Math.random() * charset.length));
  }
  return password;
}

// Helper: verify current user is super_admin using Admin API (bypasses RLS entirely)
async function verifySuperAdmin(supabase: any): Promise<boolean> {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return false;

    // Use admin client to read the profile (bypasses any RLS issues)
    const { data: profile } = await supabaseAdmin
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single();

    if (profile?.role === 'super_admin') return true;

    // Fallback: check JWT metadata (set during user creation)
    const role = user.user_metadata?.role ?? user.app_metadata?.role;
    return role === 'super_admin';
  } catch {
    return false;
  }
}

export async function POST(request: Request) {
  try {
    // Read body ONCE — request.json() can only be called once per request
    const body = await request.json();
    const { userId, full_name, role, company_id, password: manualPassword } = body;

    if (!userId || !full_name) {
      return NextResponse.json({ error: 'User ID and full name are required' }, { status: 400 });
    }

    // 1. Verify current user is Super Admin
    const supabase = await createClient();
    const isSuperAdmin = await verifySuperAdmin(supabase);
    if (!isSuperAdmin) {
      return NextResponse.json({ error: 'Only Super Admins can create new users' }, { status: 403 });
    }

    // 2. Use provided password or generate one
    const password = (manualPassword && manualPassword.trim()) ? manualPassword.trim() : generateTempPassword();

    // 3. Normalize company_id — 'all' or empty = null (Global Access)
    const normalizedCompanyId = (!company_id || company_id === 'all' || company_id === '') ? null : company_id;

    // 4. Map User ID to internal email
    const email = userId.includes('@') ? userId : `${userId.trim().toLowerCase()}@hr.system`;

    // 5. Create user via Admin API
    const { data: userData, error: createError } = await supabaseAdmin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { 
        full_name, 
        role: role || 'viewer', 
        company_id: normalizedCompanyId,
        username: userId.trim().toLowerCase()
      }
    });

    if (createError) {
      return NextResponse.json({ error: createError.message }, { status: 500 });
    }

    // 6. Upsert the profile directly (trigger may lag behind)
    if (userData?.user) {
      await supabaseAdmin.from('profiles').upsert({
        id: userData.user.id,
        email,
        full_name,
        role: role || 'viewer',
        company_id: normalizedCompanyId,
        username: userId.trim().toLowerCase(),
        is_active: true,
      }, { onConflict: 'id' });
    }

    return NextResponse.json({ 
      success: true, 
      user: userData.user, 
      generatedPassword: password
    });
  } catch (err: any) {
    console.error('USER_CREATE_ERROR:', err);
    return NextResponse.json({ error: err.message || 'Internal server error' }, { status: 500 });
  }
}

export async function PUT(request: Request) {
  try {
    // Read body ONCE
    const body = await request.json();
    const { id, userId, full_name, role, company_id, is_active, action, password } = body;

    if (!id) {
       return NextResponse.json({ error: 'User ID is required' }, { status: 400 });
    }

    // 1. Verify Authorization using admin client (bypasses RLS)
    const supabase = await createClient();
    const isSuperAdmin = await verifySuperAdmin(supabase);
    if (!isSuperAdmin) {
      return NextResponse.json({ error: 'Unauthorized — Super Admin only' }, { status: 403 });
    }

    // Special Action: Auto Password Reset
    if (action === 'reset_password') {
      const newPassword = generateTempPassword();
      const { error: resetError } = await supabaseAdmin.auth.admin.updateUserById(id, {
        password: newPassword
      });
      
      if (resetError) return NextResponse.json({ error: resetError.message }, { status: 500 });
      
      return NextResponse.json({ success: true, newPassword });
    }

    // 2. Normalize company_id
    const normalizedCompanyId = (!company_id || company_id === 'all' || company_id === '') ? null : company_id;

    // 3. Manual Password Update (only if non-empty)
    if (password && password.trim() !== '') {
      const { error: pwError } = await supabaseAdmin.auth.admin.updateUserById(id, {
        password: password.trim()
      });
      if (pwError) return NextResponse.json({ error: pwError.message }, { status: 500 });
    }

    // 4. Update Profile (via admin to bypass any RLS issues)
    const profileUpdate: any = { updated_at: new Date().toISOString() };
    if (full_name !== undefined) profileUpdate.full_name = full_name;
    if (role !== undefined) profileUpdate.role = role;
    if (company_id !== undefined) profileUpdate.company_id = normalizedCompanyId;
    if (is_active !== undefined) profileUpdate.is_active = is_active;
    if (userId !== undefined) profileUpdate.username = userId.trim().toLowerCase();

    const { error: profileError } = await supabaseAdmin
      .from('profiles')
      .update(profileUpdate)
      .eq('id', id);

    if (profileError) {
      return NextResponse.json({ error: profileError.message }, { status: 500 });
    }

    // 5. Sync to Auth metadata so JWT is up-to-date
    const authUpdate: any = { user_metadata: {} };
    if (userId) {
      const newEmail = userId.includes('@') ? userId : `${userId.trim().toLowerCase()}@hr.system`;
      authUpdate.email = newEmail;
      authUpdate.user_metadata.username = userId.trim().toLowerCase();
    }
    if (full_name) authUpdate.user_metadata.full_name = full_name;
    if (role) authUpdate.user_metadata.role = role;
    if (company_id !== undefined) authUpdate.user_metadata.company_id = normalizedCompanyId;

    const { error: authError } = await supabaseAdmin.auth.admin.updateUserById(id, authUpdate);
    if (authError) {
      console.warn('AUTH_UPDATE_WARNING:', authError.message);
    }

    return NextResponse.json({ success: true });
  } catch (err: any) {
    console.error('USER_UPDATE_ERROR:', err);
    return NextResponse.json({ error: err.message || 'Internal server error' }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) {
       return NextResponse.json({ error: 'User ID is required' }, { status: 400 });
    }

    // 1. Verify Authorization
    const supabase = await createClient();
    const isSuperAdmin = await verifySuperAdmin(supabase);
    if (!isSuperAdmin) {
      return NextResponse.json({ error: 'Only Super Admins can delete users' }, { status: 403 });
    }

    // 2. Delete profile first
    const { error: profileError } = await supabaseAdmin
      .from('profiles')
      .delete()
      .eq('id', id);

    if (profileError) {
      console.warn('PROFILE_DELETE_WARNING:', profileError.message);
    }

    // 3. Delete auth user (permanent)
    const { error: authError } = await supabaseAdmin.auth.admin.deleteUser(id);
    if (authError) {
      return NextResponse.json({ error: authError.message }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (err: any) {
    console.error('USER_DELETE_ERROR:', err);
    return NextResponse.json({ error: err.message || 'Internal server error' }, { status: 500 });
  }
}
