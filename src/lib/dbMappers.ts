/**
 * Maps DB hook types to app types used by engines.
 */
import type { Product, Order, ImportOrder } from '@/types';
import type { DBProduct } from '@/hooks/useProducts';
import type { DBOrder } from '@/hooks/useOrders';
import type { DBQuotation } from '@/hooks/useQuotations';
import type { DBCustomer } from '@/hooks/useCustomers';

export function mapDBProduct(p: DBProduct): Product {
  return {
    id: p.id,
    sku: p.sku,
    name: p.name,
    category: p.category as Product['category'],
    brand: p.brand,
    model: p.model,
    description: p.description,
    image: p.image ?? undefined,
    listPrice: p.list_price,
    minPrice: p.min_price,
    cost: p.cost,
    currency: p.currency,
    deliveryDays: p.delivery_days,
    supplier: p.supplier,
    warranty: p.warranty,
    active: p.active,
    stock: p.stock ?? {},
    inTransit: p.in_transit,
  };
}

export function mapDBOrder(o: DBOrder): Order {
  return {
    id: o.id,
    folio: o.folio,
    customerId: o.customer_id ?? '',
    customerName: o.customer_name,
    vendorName: o.vendor_name,
    items: Array.isArray(o.items) ? o.items.map((i: any) => ({
      productName: i.productName ?? i.product_name ?? '',
      qty: i.qty ?? 0,
      unitPrice: i.unitPrice ?? i.unit_price ?? 0,
    })) : [],
    total: o.total,
    advance: o.advance,
    balance: o.balance,
    status: o.status as Order['status'],
    warehouse: o.warehouse,
    promiseDate: o.promise_date ?? '',
    createdAt: o.created_at,
    orderType: o.order_type as Order['orderType'],
    quotationFolio: o.quotation_folio ?? undefined,
    scheduledDeliveryDate: o.scheduled_delivery_date ?? undefined,
    deliveryNotes: o.delivery_notes ?? undefined,
    reserveDeadline: o.reserve_deadline ?? undefined,
  };
}

export interface MappedQuotation {
  id: string;
  folio: string;
  customerId: string;
  customerName: string;
  vendorId: string;
  vendorName: string;
  items: { productId?: string; productName: string; qty: number; unitPrice: number; discount: number }[];
  subtotal: number;
  tax: number;
  total: number;
  status: string;
  validUntil: string;
  createdAt: string;
}

export function mapDBQuotation(q: DBQuotation): MappedQuotation {
  return {
    id: q.id,
    folio: q.folio,
    customerId: q.customer_id ?? '',
    customerName: q.customer_name,
    vendorId: q.vendor_id ?? '',
    vendorName: q.vendor_name,
    items: Array.isArray(q.items) ? q.items.map((i: any) => ({
      productId: i.productId ?? i.product_id,
      productName: i.productName ?? i.product_name ?? '',
      qty: i.qty ?? 0,
      unitPrice: i.unitPrice ?? i.unit_price ?? 0,
      discount: i.discount ?? 0,
    })) : [],
    subtotal: q.subtotal,
    tax: q.tax,
    total: q.total,
    status: q.status,
    validUntil: q.valid_until,
    createdAt: q.created_at,
  };
}

export interface MappedCustomer {
  id: string;
  name: string;
  type: string;
  city: string;
  state: string;
  phone: string;
  email: string | null;
  priority: string;
}

export function mapDBCustomer(c: DBCustomer): MappedCustomer {
  return {
    id: c.id,
    name: c.name,
    type: c.type,
    city: c.city,
    state: c.state,
    phone: c.phone,
    email: c.email,
    priority: c.priority,
  };
}
