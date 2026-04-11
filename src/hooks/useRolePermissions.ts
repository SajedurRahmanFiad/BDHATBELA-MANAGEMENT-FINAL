import { db } from '../../db';
import type { PermissionKey } from '../../types';
import { hasAdminAccess } from '../../types';
import { useAuth } from '../contexts/AuthProvider';
import { getRolePermissions, hasScopedPermission, permissionMapHasAnyPermission, roleHasPermission } from '../utils/permissions';
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

  const canAny = (permissionKeys: PermissionKey[]): boolean => {
    return permissionMapHasAnyPermission(rolePermissions, permissionKeys);
  };

  const canAccessRecord = (
    createdBy: string | null | undefined,
    ownPermissionKey: PermissionKey,
    anyPermissionKey: PermissionKey,
  ): boolean => {
    return hasScopedPermission(rolePermissions, activeUser?.id, createdBy, ownPermissionKey, anyPermissionKey);
  };

  return {
    permissionsSettings: fallbackSettings,
    role,
    userId: String(activeUser?.id || ''),
    rolePermissions,
    isAdminAccessUser,
    can,
    canAny,
    canAccessRecord,
    canViewAdminDashboard: can('dashboard.viewAdmin'),
    canViewEmployeeDashboard: can('dashboard.viewEmployee'),
  };
}
