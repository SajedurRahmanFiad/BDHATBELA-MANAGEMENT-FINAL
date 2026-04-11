import { db } from '../../db';
import type { PermissionKey } from '../../types';
import { hasAdminAccess } from '../../types';
import { useAuth } from '../contexts/AuthProvider';
import { getRolePermissions, roleHasPermission } from '../utils/permissions';
import { usePermissionsSettings } from './useQueries';

export function useRolePermissions() {
  const { user, profile } = useAuth();
  const activeUser = profile || user || db.currentUser;
  const { data: permissionsSettings } = usePermissionsSettings();
  const fallbackSettings = permissionsSettings || db.settings.permissions;
  const role = String(activeUser?.role || '');
  const rolePermissions = getRolePermissions(fallbackSettings, role);
  const isAdminAccessUser = hasAdminAccess(role);

  const can = (permissionKey: PermissionKey): boolean => {
    return roleHasPermission(role, permissionKey, fallbackSettings);
  };

  return {
    permissionsSettings: fallbackSettings,
    role,
    rolePermissions,
    isAdminAccessUser,
    can,
    canViewAdminDashboard: can('dashboard.viewAdmin'),
    canViewEmployeeDashboard: can('dashboard.viewEmployee'),
  };
}
