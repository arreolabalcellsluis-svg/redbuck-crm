import { UserRole } from '@/types';

// Modules completely blocked for vendedor role
const VENDEDOR_BLOCKED_PATHS = [
  '/compras',
  '/historial-compras',
  '/proveedores',
  '/productos',
  '/configuracion',
  '/pedidos',
  '/historial-pedidos',
  '/ejecutivo',
  '/reportes-ejecutivos',
  '/importaciones',
  '/planeacion',
  '/comisiones',
  '/servicio',
];

export function isPathBlockedForRole(path: string, role: UserRole): boolean {
  if (role !== 'vendedor') return false;
  return VENDEDOR_BLOCKED_PATHS.some(blocked => path === blocked || path.startsWith(blocked + '/'));
}

export function getNavItemsForRole(
  navItems: Array<{ label: string; path: string; icon: any }>,
  role: UserRole
) {
  if (role !== 'vendedor') return navItems;
  return navItems.filter(item => !isPathBlockedForRole(item.path, role));
}

// Demo vendor ID used when currentRole is 'vendedor'
// In production, this should come from user profile mapping
export const DEMO_VENDEDOR_ID = 'u3';
