// Security & Authorization System for REDBUCK ERP
import { UserRole } from '@/types';

// ─── ADMIN PASSWORDS (demo) ─────────────────────────────────────────────────
// In production these would be hashed and stored server-side
const ADMIN_PASSWORDS: Record<string, string> = {
  director: 'redbuck2026',
  administracion: 'admin2026',
};

export function validateAdminPassword(password: string): { valid: boolean; role: string; userName: string } {
  if (password === ADMIN_PASSWORDS.director) {
    return { valid: true, role: 'director', userName: 'Carlos Mendoza (Director)' };
  }
  if (password === ADMIN_PASSWORDS.administracion) {
    return { valid: true, role: 'administracion', userName: 'Patricia López (Administración)' };
  }
  return { valid: false, role: '', userName: '' };
}

// ─── CRITICAL ACTIONS ────────────────────────────────────────────────────────
export type CriticalAction =
  | 'modify_inventory'
  | 'modify_price'
  | 'modify_cost'
  | 'delete_product'
  | 'delete_spare_part'
  | 'delete_order'
  | 'delete_quotation'
  | 'delete_customer'
  | 'delete_inventory_movement'
  | 'modify_payment'
  | 'delete_payment'
  | 'modify_receivable'
  | 'modify_payable';

export const CRITICAL_ACTION_LABELS: Record<CriticalAction, string> = {
  modify_inventory: 'Modificar inventario',
  modify_price: 'Modificar precio de producto',
  modify_cost: 'Modificar costo de producto',
  delete_product: 'Eliminar producto',
  delete_spare_part: 'Eliminar refacción',
  delete_order: 'Eliminar pedido',
  delete_quotation: 'Eliminar cotización',
  delete_customer: 'Eliminar cliente',
  delete_inventory_movement: 'Eliminar movimiento de inventario',
  modify_payment: 'Modificar pago registrado',
  delete_payment: 'Eliminar pago',
  modify_receivable: 'Modificar cuenta por cobrar',
  modify_payable: 'Modificar cuenta por pagar',
};

// ─── ROLE PERMISSIONS ────────────────────────────────────────────────────────
// Actions each role can perform WITHOUT needing 2nd-level auth
// Director can do everything; others have restricted sets

interface RolePermissions {
  canModifyInventory: boolean;
  canModifyPrices: boolean;
  canModifyCosts: boolean;
  canDeleteRecords: boolean;
  canModifyFinancials: boolean;
  canViewCosts: boolean;
  canCreateQuotations: boolean;
  canManageService: boolean;
  // If true, this role can self-authorize (no 2nd password needed)
  selfAuthorize: boolean;
}

export const ROLE_PERMISSIONS: Record<UserRole, RolePermissions> = {
  director: {
    canModifyInventory: true,
    canModifyPrices: true,
    canModifyCosts: true,
    canDeleteRecords: true,
    canModifyFinancials: true,
    canViewCosts: true,
    canCreateQuotations: true,
    canManageService: true,
    selfAuthorize: true,
  },
  gerencia_comercial: {
    canModifyInventory: false,
    canModifyPrices: false,
    canModifyCosts: false,
    canDeleteRecords: false,
    canModifyFinancials: false,
    canViewCosts: true,
    canCreateQuotations: true,
    canManageService: false,
    selfAuthorize: false,
  },
  vendedor: {
    canModifyInventory: false,
    canModifyPrices: false,
    canModifyCosts: false,
    canDeleteRecords: false,
    canModifyFinancials: false,
    canViewCosts: false,
    canCreateQuotations: true,
    canManageService: false,
    selfAuthorize: false,
  },
  administracion: {
    canModifyInventory: false,
    canModifyPrices: false,
    canModifyCosts: false,
    canDeleteRecords: false,
    canModifyFinancials: true,
    canViewCosts: true,
    canCreateQuotations: false,
    canManageService: false,
    selfAuthorize: false,
  },
  compras: {
    canModifyInventory: true,
    canModifyPrices: false,
    canModifyCosts: true,
    canDeleteRecords: false,
    canModifyFinancials: false,
    canViewCosts: true,
    canCreateQuotations: false,
    canManageService: false,
    selfAuthorize: false,
  },
  almacen: {
    canModifyInventory: true,
    canModifyPrices: false,
    canModifyCosts: false,
    canDeleteRecords: false,
    canModifyFinancials: false,
    canViewCosts: false,
    canCreateQuotations: false,
    canManageService: false,
    selfAuthorize: false,
  },
  tecnico: {
    canModifyInventory: false,
    canModifyPrices: false,
    canModifyCosts: false,
    canDeleteRecords: false,
    canModifyFinancials: false,
    canViewCosts: false,
    canCreateQuotations: false,
    canManageService: true,
    selfAuthorize: false,
  },
};

// Check if an action requires 2nd-level authorization for a given role
export function requiresAuthorization(role: UserRole, action: CriticalAction): boolean {
  const perms = ROLE_PERMISSIONS[role];
  if (perms.selfAuthorize) return false; // Director never needs 2nd auth

  switch (action) {
    case 'modify_inventory':
      return !perms.canModifyInventory;
    case 'modify_price':
      return !perms.canModifyPrices;
    case 'modify_cost':
      return !perms.canModifyCosts;
    case 'delete_product':
    case 'delete_spare_part':
    case 'delete_order':
    case 'delete_quotation':
    case 'delete_customer':
    case 'delete_inventory_movement':
      return true; // ALL deletions always require auth (except director)
    case 'modify_payment':
    case 'delete_payment':
    case 'modify_receivable':
    case 'modify_payable':
      return !perms.canModifyFinancials;
    default:
      return true;
  }
}

// Check if action is completely blocked for a role (even with auth it shouldn't proceed)
export function isActionBlocked(role: UserRole, action: CriticalAction): boolean {
  // No action is fully blocked — if they get admin password, they can proceed
  // This allows flexibility while maintaining the 2-level auth
  return false;
}
