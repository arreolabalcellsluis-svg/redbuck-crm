// Customer Classification Engine
// Automatically classifies contacts based on order history

export type ContactType = 'prospecto' | 'cliente';
export type ClientLevel = 'nuevo' | 'recurrente';
export type ClientValue = 'vip' | 'medio' | 'bajo';

export interface CustomerClassification {
  contactType: ContactType;
  clientLevel: ClientLevel | null; // null if prospecto
  clientValue: ClientValue | null; // null if prospecto
  totalOrders: number;
  totalPurchased: number;
  lastOrderDate: string | null;
}

export interface ValueThresholds {
  vipMin: number;
  medioMin: number;
}

const DEFAULT_THRESHOLDS: ValueThresholds = {
  vipMin: 100000,
  medioMin: 20000,
};

export function classifyCustomer(
  customerId: string,
  orders: { customer_id: string | null; total: number; status: string; created_at: string }[],
  thresholds: ValueThresholds = DEFAULT_THRESHOLDS,
): CustomerClassification {
  const custOrders = orders.filter(o => o.customer_id === customerId && o.status !== 'cancelado');
  const totalOrders = custOrders.length;
  const totalPurchased = custOrders.reduce((s, o) => s + Number(o.total), 0);
  const lastOrderDate = custOrders.length > 0
    ? custOrders.sort((a, b) => b.created_at.localeCompare(a.created_at))[0].created_at.split('T')[0]
    : null;

  if (totalOrders === 0) {
    return { contactType: 'prospecto', clientLevel: null, clientValue: null, totalOrders: 0, totalPurchased: 0, lastOrderDate: null };
  }

  const clientLevel: ClientLevel = totalOrders === 1 ? 'nuevo' : 'recurrente';
  const clientValue: ClientValue = totalPurchased >= thresholds.vipMin
    ? 'vip'
    : totalPurchased >= thresholds.medioMin
    ? 'medio'
    : 'bajo';

  return { contactType: 'cliente', clientLevel, clientValue, totalOrders, totalPurchased, lastOrderDate };
}

export function classifyAllCustomers(
  customers: { id: string }[],
  orders: { customer_id: string | null; total: number; status: string; created_at: string }[],
  thresholds?: ValueThresholds,
): Map<string, CustomerClassification> {
  const map = new Map<string, CustomerClassification>();
  for (const c of customers) {
    map.set(c.id, classifyCustomer(c.id, orders, thresholds));
  }
  return map;
}
