export type PermissionAction = 'read' | 'create' | 'update' | 'delete';

/**
 * Evaluate whether a role has permission to perform an action on a module,
 * checking configured role_permissions from system_settings first, then
 * falling back to role-specific defaults.
 */
export function evaluateModulePermission(
  role: string | null | undefined,
  moduleId: string,
  action: PermissionAction = 'read',
  rolePermissions?: Record<string, Record<string, string[]>> | null
): boolean {
  if (!role) return false;
  if (role === 'super_admin') return true;

  const rolePerms = rolePermissions?.[role];
  if (rolePerms && rolePerms[moduleId]) {
    const actions = rolePerms[moduleId];
    return Array.isArray(actions) && actions.includes(action);
  }

  if (role === 'viewer') {
    return moduleId === 'attendance' && action === 'read';
  }
  if (role === 'foreman') {
    return moduleId === 'attendance';
  }
  if (role === 'company_admin') {
    return moduleId !== 'users' || action === 'read';
  }
  if (role === 'hr') {
    return ['employees', 'attendance', 'leaves', 'reports'].includes(moduleId);
  }
  if (role === 'finance') {
    return ['payroll', 'loans', 'reports', 'attendance'].includes(moduleId);
  }
  if (role === 'operations') {
    return ['attendance', 'leaves', 'reports'].includes(moduleId);
  }

  return false;
}
