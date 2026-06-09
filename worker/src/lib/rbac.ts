// Role-based access control. Roles carry a JSON array of permission keys;
// "*" grants everything. Permissions are configurable per role by admins.

export const ALL_PERMISSIONS = [
  '*',
  'dashboard.view',
  'intelligence.view',
  'reports.view',
  'projects.view',
  'projects.manage',
  'customers.manage',
  'sessions.create',
  'sessions.view_own',
  'sessions.view_all',
  'catalog.manage',
  'users.view',
  'users.manage',
  'roles.manage',
  'audit.view',
] as const;

export type Permission = (typeof ALL_PERMISSIONS)[number];

export function hasPermission(rolePermissions: string[], required: Permission): boolean {
  return rolePermissions.includes('*') || rolePermissions.includes(required);
}

export function parsePermissions(json: string): string[] {
  try {
    const arr = JSON.parse(json);
    return Array.isArray(arr) ? arr.filter((p) => typeof p === 'string') : [];
  } catch {
    return [];
  }
}
