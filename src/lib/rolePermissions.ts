import { UserRole } from '@/types';
import { demoUsers } from '@/data/demo-data';

// Modules completely blocked for vendedor role
const VENDEDOR_BLOCKED_PATHS = [
  '/compras',
  '/historial-compras',
  '/proveedores',
  '/productos',
  '/refacciones',
  '/configuracion',
  '/pedidos',
  '/historial-pedidos',
  '/ejecutivo',
  '/financiero',
  '/reportes-ejecutivos',
  '/importaciones',
  '/planeacion',
  '/servicio',
  '/gastos',
  '/activos',
  '/cuentas-pagar',
  '/facturacion',
  '/simulador-comisiones',
  '/reportes/simulador-financiero',
  '/crm/reabasto',
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

// Get the demo vendor's full name
export function getVendorName(vendorId: string): string {
  return demoUsers.find(u => u.id === vendorId)?.name ?? '';
}

export const DEMO_VENDEDOR_NAME = getVendorName(DEMO_VENDEDOR_ID);
