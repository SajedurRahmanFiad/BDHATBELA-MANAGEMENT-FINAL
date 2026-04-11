import {
  UserRole,
  type PermissionDefinition,
  type PermissionKey,
  type PermissionRoleConfig,
  type PermissionsSettings,
  type RolePermissionMap,
} from '../../types';

export const RESERVED_PERMISSION_ROLES = [UserRole.ADMIN, UserRole.DEVELOPER] as const;
export const BUILT_IN_PERMISSION_ROLES = [UserRole.EMPLOYEE, UserRole.EMPLOYEE1] as const;

export const PERMISSION_DEFINITIONS: PermissionDefinition[] = [
  {
    key: 'allPrivileges',
    label: 'All Privileges',
    description: 'Check every permission in this column at once.',
    section: 'Overview',
    isVirtual: true,
  },
  {
    key: 'dashboard.viewAdmin',
    label: 'Admin Dashboard',
    description: 'See the admin dashboard widgets, charts, and summaries.',
    section: 'Overview',
  },
  {
    key: 'dashboard.viewEmployee',
    label: 'Employee Dashboard',
    description: 'See the employee performance and wallet dashboard.',
    section: 'Overview',
  },
  {
    key: 'orders.view',
    label: 'View Orders',
    description: 'Open the orders list and order details.',
    section: 'Orders',
  },
  {
    key: 'orders.create',
    label: 'Create Orders',
    description: 'Create new orders.',
    section: 'Orders',
  },
  {
    key: 'orders.edit',
    label: 'Edit Orders',
    description: 'Edit existing orders.',
    section: 'Orders',
  },
  {
    key: 'orders.delete',
    label: 'Delete Orders',
    description: 'Archive or remove orders.',
    section: 'Orders',
  },
  {
    key: 'orders.cancel',
    label: 'Cancel Orders',
    description: 'Mark orders as cancelled.',
    section: 'Orders',
  },
  {
    key: 'orders.moveOnHoldToProcessing',
    label: 'Orders: On Hold to Processing',
    description: 'Move order status from On Hold to Processing.',
    section: 'Orders',
  },
  {
    key: 'orders.sendToCourier',
    label: 'Orders: Send to Courier',
    description: 'Submit orders to courier services.',
    section: 'Orders',
  },
  {
    key: 'orders.moveToPicked',
    label: 'Orders: Move to Picked',
    description: 'Mark courier orders as picked.',
    section: 'Orders',
  },
  {
    key: 'orders.markCompleted',
    label: 'Orders: Mark Completed',
    description: 'Finalize delivered orders.',
    section: 'Orders',
  },
  {
    key: 'orders.markReturned',
    label: 'Orders: Mark Returned',
    description: 'Finalize returned orders.',
    section: 'Orders',
  },
  {
    key: 'customers.view',
    label: 'View Customers',
    description: 'Open the customers list and customer profiles.',
    section: 'Customers',
  },
  {
    key: 'customers.create',
    label: 'Create Customers',
    description: 'Add new customers.',
    section: 'Customers',
  },
  {
    key: 'customers.edit',
    label: 'Edit Customers',
    description: 'Edit existing customer profiles.',
    section: 'Customers',
  },
  {
    key: 'customers.delete',
    label: 'Delete Customers',
    description: 'Archive customers.',
    section: 'Customers',
  },
  {
    key: 'bills.view',
    label: 'View Bills',
    description: 'Open the bills list and bill details.',
    section: 'Bills',
  },
  {
    key: 'bills.create',
    label: 'Create Bills',
    description: 'Create new purchase bills.',
    section: 'Bills',
  },
  {
    key: 'bills.edit',
    label: 'Edit Bills',
    description: 'Edit existing bills.',
    section: 'Bills',
  },
  {
    key: 'bills.delete',
    label: 'Delete Bills',
    description: 'Archive or remove bills.',
    section: 'Bills',
  },
  {
    key: 'bills.cancel',
    label: 'Cancel Bills',
    description: 'Cancel bills when needed.',
    section: 'Bills',
  },
  {
    key: 'bills.moveOnHoldToProcessing',
    label: 'Bills: On Hold to Processing',
    description: 'Move bill status from On Hold to Processing.',
    section: 'Bills',
  },
  {
    key: 'bills.markReceived',
    label: 'Bills: Mark Received',
    description: 'Mark incoming bills as received.',
    section: 'Bills',
  },
  {
    key: 'bills.markPaid',
    label: 'Bills: Mark Paid',
    description: 'Mark bills as paid.',
    section: 'Bills',
  },
  {
    key: 'transactions.view',
    label: 'View Transactions',
    description: 'Open the transaction list.',
    section: 'Transactions',
  },
  {
    key: 'transactions.create',
    label: 'Create Transactions',
    description: 'Record income and expense entries.',
    section: 'Transactions',
  },
  {
    key: 'transactions.edit',
    label: 'Edit Transactions',
    description: 'Edit existing transaction entries.',
    section: 'Transactions',
  },
  {
    key: 'transactions.delete',
    label: 'Delete Transactions',
    description: 'Archive transactions.',
    section: 'Transactions',
  },
  {
    key: 'vendors.view',
    label: 'View Vendors',
    description: 'Open the vendor list and vendor profiles.',
    section: 'Inventory & Banking',
  },
  {
    key: 'vendors.create',
    label: 'Create Vendors',
    description: 'Add new vendors.',
    section: 'Inventory & Banking',
  },
  {
    key: 'vendors.edit',
    label: 'Edit Vendors',
    description: 'Edit vendor profiles.',
    section: 'Inventory & Banking',
  },
  {
    key: 'vendors.delete',
    label: 'Delete Vendors',
    description: 'Archive vendors.',
    section: 'Inventory & Banking',
  },
  {
    key: 'products.view',
    label: 'View Products',
    description: 'Open the products list.',
    section: 'Inventory & Banking',
  },
  {
    key: 'products.create',
    label: 'Create Products',
    description: 'Add new products.',
    section: 'Inventory & Banking',
  },
  {
    key: 'products.edit',
    label: 'Edit Products',
    description: 'Edit products.',
    section: 'Inventory & Banking',
  },
  {
    key: 'products.delete',
    label: 'Delete Products',
    description: 'Archive products.',
    section: 'Inventory & Banking',
  },
  {
    key: 'accounts.view',
    label: 'View Accounts',
    description: 'Open banking accounts.',
    section: 'Inventory & Banking',
  },
  {
    key: 'accounts.create',
    label: 'Create Accounts',
    description: 'Add banking accounts.',
    section: 'Inventory & Banking',
  },
  {
    key: 'accounts.edit',
    label: 'Edit Accounts',
    description: 'Edit banking accounts.',
    section: 'Inventory & Banking',
  },
  {
    key: 'accounts.delete',
    label: 'Delete Accounts',
    description: 'Remove banking accounts.',
    section: 'Inventory & Banking',
  },
  {
    key: 'transfers.create',
    label: 'Create Transfers',
    description: 'Create balance transfers between accounts.',
    section: 'Inventory & Banking',
  },
  {
    key: 'reports.view',
    label: 'View Reports',
    description: 'Open reporting pages.',
    section: 'Other Modules',
  },
  {
    key: 'wallet.view',
    label: 'View Wallet',
    description: 'Open wallet balance and activity.',
    section: 'Other Modules',
  },
  {
    key: 'payroll.view',
    label: 'View Payroll',
    description: 'Open payroll and employee wallet summary pages.',
    section: 'Other Modules',
  },
  {
    key: 'recycleBin.view',
    label: 'View Recycle Bin',
    description: 'Open archived records.',
    section: 'Other Modules',
  },
  {
    key: 'users.view',
    label: 'View Users',
    description: 'Open the users and human resource pages.',
    section: 'Other Modules',
  },
];

export const STORED_PERMISSION_DEFINITIONS = PERMISSION_DEFINITIONS.filter(
  (definition): definition is PermissionDefinition & { key: PermissionKey } => !definition.isVirtual,
);

export const STORED_PERMISSION_KEYS = STORED_PERMISSION_DEFINITIONS.map((definition) => definition.key);

export function createBlankPermissionMap(): RolePermissionMap {
  return STORED_PERMISSION_KEYS.reduce((accumulator, key) => {
    accumulator[key] = false;
    return accumulator;
  }, {} as RolePermissionMap);
}

function createPermissionMap(enabledKeys: PermissionKey[]): RolePermissionMap {
  const next = createBlankPermissionMap();
  for (const key of enabledKeys) {
    next[key] = true;
  }
  return next;
}

export const DEFAULT_ROLE_PERMISSION_SETTINGS: PermissionsSettings = {
  roles: [
    {
      roleName: UserRole.EMPLOYEE,
      isCustom: false,
      permissions: createPermissionMap([
        'dashboard.viewEmployee',
        'orders.view',
        'orders.create',
        'orders.edit',
        'customers.view',
        'customers.create',
        'customers.edit',
        'products.view',
        'wallet.view',
      ]),
    },
    {
      roleName: UserRole.EMPLOYEE1,
      isCustom: false,
      permissions: createPermissionMap([
        'dashboard.viewEmployee',
        'orders.view',
        'orders.create',
        'orders.edit',
        'orders.moveOnHoldToProcessing',
        'customers.view',
        'customers.create',
        'customers.edit',
        'products.view',
        'wallet.view',
      ]),
    },
  ],
};

export function normalizeRoleName(value: string): string {
  return value.replace(/\s+/g, ' ').trim();
}

export function isReservedPermissionRole(roleName: string): boolean {
  return RESERVED_PERMISSION_ROLES.includes(normalizeRoleName(roleName) as (typeof RESERVED_PERMISSION_ROLES)[number]);
}

export function isBuiltInPermissionRole(roleName: string): boolean {
  return BUILT_IN_PERMISSION_ROLES.includes(normalizeRoleName(roleName) as (typeof BUILT_IN_PERMISSION_ROLES)[number]);
}

export function normalizeRolePermissionMap(
  value: Partial<Record<PermissionKey, unknown>> | undefined | null,
  fallback?: Partial<RolePermissionMap>,
): RolePermissionMap {
  const next = createBlankPermissionMap();
  for (const key of STORED_PERMISSION_KEYS) {
    const candidate = value?.[key];
    if (typeof candidate === 'boolean') {
      next[key] = candidate;
      continue;
    }
    next[key] = Boolean(fallback?.[key]);
  }
  return next;
}

export function getDefaultPermissionsForRole(roleName: string): RolePermissionMap {
  const normalizedRoleName = normalizeRoleName(roleName);
  const builtIn = DEFAULT_ROLE_PERMISSION_SETTINGS.roles.find((role) => role.roleName === normalizedRoleName);

  if (builtIn) {
    return normalizeRolePermissionMap(builtIn.permissions);
  }

  if (isReservedPermissionRole(normalizedRoleName)) {
    return STORED_PERMISSION_KEYS.reduce((accumulator, key) => {
      accumulator[key] = true;
      return accumulator;
    }, {} as RolePermissionMap);
  }

  return createBlankPermissionMap();
}

export function normalizePermissionRoleConfig(
  value: Partial<PermissionRoleConfig> | null | undefined,
): PermissionRoleConfig | null {
  const roleName = normalizeRoleName(String(value?.roleName || ''));
  if (!roleName || isReservedPermissionRole(roleName)) {
    return null;
  }

  return {
    roleName,
    isCustom: !isBuiltInPermissionRole(roleName),
    permissions: normalizeRolePermissionMap(value?.permissions, getDefaultPermissionsForRole(roleName)),
    createdAt: value?.createdAt ?? null,
    updatedAt: value?.updatedAt ?? null,
  };
}

export function normalizePermissionsSettings(value: Partial<PermissionsSettings> | null | undefined): PermissionsSettings {
  const mergedByRole = new Map<string, PermissionRoleConfig>();

  for (const role of DEFAULT_ROLE_PERMISSION_SETTINGS.roles) {
    mergedByRole.set(role.roleName, {
      ...role,
      permissions: normalizeRolePermissionMap(role.permissions),
    });
  }

  for (const candidate of value?.roles || []) {
    const normalizedRole = normalizePermissionRoleConfig(candidate);
    if (!normalizedRole) {
      continue;
    }

    const existing = mergedByRole.get(normalizedRole.roleName);
    mergedByRole.set(normalizedRole.roleName, {
      ...normalizedRole,
      isCustom: normalizedRole.isCustom,
      permissions: normalizeRolePermissionMap(
        normalizedRole.permissions,
        existing?.permissions || getDefaultPermissionsForRole(normalizedRole.roleName),
      ),
    });
  }

  const roles = Array.from(mergedByRole.values()).sort((left, right) => {
    if (left.isCustom !== right.isCustom) {
      return left.isCustom ? 1 : -1;
    }
    return left.roleName.localeCompare(right.roleName);
  });

  return { roles };
}

export function clonePermissionsSettings(value: Partial<PermissionsSettings> | null | undefined): PermissionsSettings {
  const normalized = normalizePermissionsSettings(value);
  return {
    roles: normalized.roles.map((role) => ({
      ...role,
      permissions: { ...role.permissions },
    })),
  };
}

export function getPermissionRoles(value: Partial<PermissionsSettings> | null | undefined): PermissionRoleConfig[] {
  return normalizePermissionsSettings(value).roles;
}

export function getRolePermissions(
  value: Partial<PermissionsSettings> | null | undefined,
  roleName: string | null | undefined,
): RolePermissionMap {
  const normalizedRoleName = normalizeRoleName(String(roleName || ''));
  if (!normalizedRoleName) {
    return createBlankPermissionMap();
  }

  if (isReservedPermissionRole(normalizedRoleName)) {
    return getDefaultPermissionsForRole(normalizedRoleName);
  }

  const settings = normalizePermissionsSettings(value);
  const role = settings.roles.find((candidate) => candidate.roleName === normalizedRoleName);
  return normalizeRolePermissionMap(role?.permissions, getDefaultPermissionsForRole(normalizedRoleName));
}

export function roleHasPermission(
  roleName: string | null | undefined,
  permissionKey: PermissionKey,
  value: Partial<PermissionsSettings> | null | undefined,
): boolean {
  const permissions = getRolePermissions(value, roleName);
  return Boolean(permissions[permissionKey]);
}

export function areAllPrivilegesEnabled(permissions: RolePermissionMap): boolean {
  return STORED_PERMISSION_KEYS.every((key) => Boolean(permissions[key]));
}

export function getAssignableUserRoles(
  value: Partial<PermissionsSettings> | null | undefined,
  options?: { includeDeveloper?: boolean },
): string[] {
  const roles = new Set<string>([
    UserRole.ADMIN,
    UserRole.EMPLOYEE,
    UserRole.EMPLOYEE1,
    ...getPermissionRoles(value)
      .filter((role) => role.isCustom)
      .map((role) => role.roleName),
  ]);

  if (options?.includeDeveloper) {
    roles.add(UserRole.DEVELOPER);
  }

  return Array.from(roles);
}
