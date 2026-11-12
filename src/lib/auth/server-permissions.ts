import { getAdminClient } from '@/lib/supabase/admin';
import { createClient } from '@/lib/supabase/server';
import { validateRequest } from '@/lib/auth/validate-request';
import { evaluateModulePermission, type PermissionAction } from '@/lib/auth/permissions';

/**
 * Verify the caller is authenticated, authorized for the requested module action
 * (according to system_settings.role_permissions or role defaults), and allowed
 * to access targetCompanyId.
 */
export async function requireModulePermission(
  moduleId: string,
  action: PermissionAction,
  targetCompanyId?: string | null
) {
  const { request } = await validateRequest();
  if (!request?.profile) {
    throw new Error('Unauthorized');
  }

  const supabase = getAdminClient() || (await createClient());
  if (!supabase) {
    throw new Error('Database client not available');
  }

  let rolePermissions: Record<string, Record<string, string[]>> | null = null;
  try {
    const { data: settings } = await (supabase.from('system_settings') as any)
      .select('role_permissions')
      .eq('id', 'global')
      .maybeSingle();
    rolePermissions = settings?.role_permissions || null;
  } catch (err) {
    console.warn('[requireModulePermission] Failed to load system_settings:', err);
  }

  const allowed = evaluateModulePermission(
    request.profile.role,
    moduleId,
    action,
    rolePermissions
  );
  if (!allowed) {
    throw new Error('Insufficient permissions');
  }

  if (
    targetCompanyId &&
    request.profile.role !== 'super_admin' &&
    request.profile.company_id !== null &&
    request.profile.company_id !== targetCompanyId
  ) {
    throw new Error('You do not have permission to access this company');
  }

  return {
    request,
    profile: request.profile,
    supabase,
  };
}
