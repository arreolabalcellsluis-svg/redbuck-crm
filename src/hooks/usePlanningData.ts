import { useMemo } from 'react';
import { useProducts, type DBProduct } from '@/hooks/useProducts';
import { useOrders, type DBOrder } from '@/hooks/useOrders';
import { useQuotations, type DBQuotation } from '@/hooks/useQuotations';
import { useImportOrders } from '@/hooks/useImportOrders';
import { analyzeProducts, getPlanningSummary, type PlanningDataInput, type ProductAnalysis } from '@/lib/planningEngine';
import type { Product, Order, Quotation, ImportOrder } from '@/types';

function dbProductToProduct(p: DBProduct): Product {
  return {
    id: p.id, sku: p.sku, name: p.name,
    category: p.category as Product['category'],
    brand: p.brand, model: p.model, description: p.description,
    image: p.image ?? undefined,
    listPrice: p.list_price, minPrice: p.min_price, cost: p.cost,
    currency: p.currency, deliveryDays: p.delivery_days,
    supplier: p.supplier, warranty: p.warranty, active: p.active,
    stock: p.stock, inTransit: p.in_transit,
  };
}

function dbOrderToOrder(o: DBOrder): Order {
  return {
    id: o.id, folio: o.folio,
    customerId: o.customer_id ?? '',
    customerName: o.customer_name,
    vendorName: o.vendor_name,
    items: Array.isArray(o.items) ? o.items.map((i: any) => ({
      productName: i.productName || i.product_name || '',
      qty: i.qty || i.cantidad || 0,
      unitPrice: i.unitPrice || i.unit_price || i.precio_unitario || 0,
      cost: i.cost || i.costo || 0,
    })) : [],
    total: o.total, advance: o.advance, balance: o.balance,
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

function dbQuotationToQuotation(q: DBQuotation): Quotation {
  return {
    id: q.id, folio: q.folio,
    customerId: q.customer_id ?? '',
    customerName: q.customer_name,
    customerPhone: q.customer_phone ?? undefined,
    customerWhatsapp: q.customer_whatsapp ?? undefined,
    vendorId: q.vendor_id ?? undefined,
    vendorName: q.vendor_name,
    vendorPhone: q.vendor_phone ?? undefined,
    vendorEmail: q.vendor_email ?? undefined,
    items: Array.isArray(q.items) ? q.items.map((i: any) => ({
      productId: i.productId || i.product_id || '',
      productName: i.productName || i.product_name || '',
      sku: i.sku || '',
      qty: i.qty || i.cantidad || 0,
      unitPrice: i.unitPrice || i.unit_price || 0,
      discount: i.discount || i.descuento || 0,
    })) : [],
    subtotal: q.subtotal, tax: q.tax, total: q.total,
    status: q.status as Quotation['status'],
    validUntil: q.valid_until,
    createdAt: q.created_at,
  };
}

/**
 * Shared hook that provides planning analyses from real DB data.
 * Use across PlanningPage, report pages, and financial simulator.
 */
export function usePlanningData() {
  const { data: dbProducts = [] } = useProducts();
  const { data: dbOrders = [] } = useOrders();
  const { data: dbQuotations = [] } = useQuotations();
  const { data: dbImports = [] } = useImportOrders();

  const products = useMemo(() => dbProducts.map(dbProductToProduct), [dbProducts]);
  const orders = useMemo(() => dbOrders.map(dbOrderToOrder), [dbOrders]);
  const quotations = useMemo(() => dbQuotations.map(dbQuotationToQuotation), [dbQuotations]);

  const planningInput: PlanningDataInput = useMemo(() => ({
    products, orders, quotations, imports: dbImports,
  }), [products, orders, quotations, dbImports]);

  const analyses = useMemo(() => analyzeProducts(planningInput), [planningInput]);
  const summary = useMemo(() => getPlanningSummary(analyses), [analyses]);

  return { analyses, summary, products, orders, quotations, imports: dbImports };
}
