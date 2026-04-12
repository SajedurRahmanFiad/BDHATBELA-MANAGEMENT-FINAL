import { db } from '../../db';
import type { PermissionKey } from '../../types';
import { hasAdminAccess } from '../../types';
import { useAuth } from '../contexts/AuthProvider';
import { createBlankPermissionMap, getRolePermissions, hasScopedPermission, permissionMapHasAnyPermission, roleHasPermission } from '../utils/permissions';
import { usePermissionsSettings } from './useQueries';

export function useRolePermissions() {
  const { user, profile } = useAuth();
  const activeUser = profile || user || db.currentUser;
  const role = String(activeUser?.role || '');
  const isAdminAccessUser = hasAdminAccess(role);
  const { data: permissionsSettings } = usePermissionsSettings(!!activeUser);
  const permissionsReady = !activeUser || isAdminAccessUser || !!permissionsSettings;
  const authoritativeSettings = permissionsReady ? permissionsSettings : null;
  const rolePermissions = permissionsReady
    ? getRolePermissions(authoritativeSettings, role)
    : createBlankPermissionMap();

  const can = (permissionKey: PermissionKey): boolean => {
    if (!permissionsReady) {
      return false;
    }

    return roleHasPermission(role, permissionKey, authoritativeSettings);
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
    permissionsSettings: authoritativeSettings,
    permissionsReady,
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
