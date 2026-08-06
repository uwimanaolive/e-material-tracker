/** Map API role slug to app base path */
export function getRoleBasePath(role) {
  switch (role) {
    case 'specialist':
      return '/head';
    case 'procurement':
      return '/inventory';
    case 'super_admin':
      return '/admin';
    default:
      return `/${role}`;
  }
}

/** Normalize role for nav/config lookup */
export function getRoleKey(role) {
  if (role === 'specialist') return 'head';
  if (role === 'procurement') return 'inventory';
  return role;
}
