// Core types for REDBUCK ERP CRM

export type UserRole = 'director' | 'gerencia_comercial' | 'vendedor' | 'administracion' | 'compras' | 'almacen' | 'tecnico';

export interface User {
  id: string;
  name: string;
  email: string;
  phone?: string;
  whatsapp?: string;
  role: UserRole;
  avatar?: string;
  active: boolean;
  seriesPrefix?: string;
  seriesStart?: number;
  seriesCurrent?: number;
  commissionRate?: number; // porcentaje de comisión (e.g. 5 = 5%)
}

export type CustomerType = 'taller_mecanico' | 'llantera' | 'suspension_frenos' | 'agencia' | 'flotilla' | 'transportista' | 'vulcanizadora' | 'particular' | 'distribuidor';

export type LeadSource = 'facebook' | 'whatsapp' | 'llamada' | 'recomendacion' | 'sitio_web' | 'visita_sucursal' | 'expos' | 'campaña' | 'organico' | 'otro';

export type PipelineStage = 'prospecto_nuevo' | 'contactado' | 'calificado' | 'diagnostico' | 'cotizacion_enviada' | 'seguimiento' | 'negociacion' | 'cierre_ganado' | 'cierre_perdido' | 'postventa';

export interface Customer {
  id: string;
  name: string;
  tradeName?: string;
  rfc?: string;
  type: CustomerType;
  phone: string;
  whatsapp?: string;
  email?: string;
  city: string;
  state: string;
  vendorId: string;
  source: LeadSource;
  priority: 'alta' | 'media' | 'baja';
  createdAt: string;
}

export interface Opportunity {
  id: string;
  customerId: string;
  customerName: string;
  vendorId: string;
  vendorName: string;
  products: string[];
  estimatedAmount: number;
  probability: number;
  stage: PipelineStage;
  estimatedCloseDate: string;
  nextActivity?: string;
  createdAt: string;
}

export type ProductCategory = 'elevadores' | 'balanceadoras' | 'desmontadoras' | 'alineadoras' | 'hidraulico' | 'lubricacion' | 'aire' | 'otros';

export interface Product {
  id: string;
  sku: string;
  name: string;
  category: ProductCategory;
  brand: string;
  model: string;
  description: string;
  image?: string;
  listPrice: number;
  minPrice: number;
  cost: number;
  currency: 'MXN' | 'USD';
  deliveryDays: number;
  supplier: string;
  warranty: string;
  active: boolean;
  stock: Record<string, number>;
  inTransit: number;
}

export interface SparePart {
  id: string;
  sku: string;
  name: string;
  productId: string;
  productName: string;
  cost: number;
  price: number;
  stock: number;
  minStock: number;
  warehouse: string;
  active: boolean;
  image?: string;
}

export type QuotationStatus = 'borrador' | 'enviada' | 'vista' | 'seguimiento' | 'aceptada' | 'rechazada' | 'vencida';

export interface QuotationItem {
  productId?: string;
  productName: string;
  productImage?: string;
  sku?: string;
  qty: number;
  unitPrice: number;
  discount: number;
}

export interface Quotation {
  id: string;
  folio: string;
  customerId: string;
  customerName: string;
  customerPhone?: string;
  customerWhatsapp?: string;
  vendorId?: string;
  vendorName: string;
  vendorPhone?: string;
  vendorEmail?: string;
  items: QuotationItem[];
  subtotal: number;
  tax: number;
  total: number;
  status: QuotationStatus;
  validUntil: string;
  createdAt: string;
}

export interface CompanyInfo {
  razonSocial: string;
  nombreComercial: string;
  direccion: string;
  telefono: string;
  correo: string;
  rfc: string;
}

export interface SalesConditions {
  text: string;
}

export interface WhatsAppTemplate {
  message: string;
}

export type OrderStatus = 'nuevo' | 'por_confirmar' | 'confirmado' | 'confirmado_anticipo' | 'apartado' | 'entrega_programada' | 'en_bodega' | 'surtido_parcial' | 'surtido_total' | 'en_reparto' | 'en_entrega' | 'entregado' | 'cancelado';

export type OrderType = 'directo' | 'anticipo' | 'apartado' | 'entrega_futura';

export interface Order {
  id: string;
  folio: string;
  customerId: string;
  customerName: string;
  vendorName: string;
  items: { productName: string; qty: number; unitPrice: number }[];
  total: number;
  advance: number;
  balance: number;
  status: OrderStatus;
  warehouse: string;
  promiseDate: string;
  createdAt: string;
  orderType?: OrderType;
  quotationFolio?: string;
  scheduledDeliveryDate?: string;
  deliveryNotes?: string;
  reserveDeadline?: string;
}

export type ImportStatus =
  | 'orden_enviada'
  | 'anticipo_pagado'
  | 'produccion'
  | 'flete_local_china'
  | 'puerto_china'
  | 'embarcado'
  | 'transito_maritimo'
  | 'puerto_mexico'
  | 'aduana'
  | 'liberado_aduana'
  | 'transito_local'
  | 'llego_bodega'
  | 'inventario_disponible';

export interface ImportOrder {
  id: string;
  orderNumber: string;
  supplier: string;
  country: string;
  departurePort: string;
  arrivalPort: string;
  currency: 'USD' | 'CNY';
  exchangeRate: number;
  purchaseDate: string;
  estimatedDeparture: string;
  estimatedArrival: string;
  status: ImportStatus;
  items: { productName: string; qty: number; unitCost: number }[];
  totalCost: number;
  freightCost: number;
  customsCost: number;
  totalLanded: number;
  daysInTransit: number;
}

export type ServiceType = 'instalacion' | 'garantia' | 'mantenimiento' | 'reparacion' | 'visita_tecnica' | 'capacitacion';
export type ServiceStatus = 'pendiente' | 'programado' | 'en_proceso' | 'terminado' | 'cancelado';

export interface ServiceOrder {
  id: string;
  folio: string;
  customerId: string;
  customerName: string;
  productName: string;
  technicianName: string;
  type: ServiceType;
  scheduledDate: string;
  status: ServiceStatus;
  description: string;
}

export interface AccountReceivable {
  id: string;
  customerId: string;
  customerName: string;
  orderId: string;
  orderFolio: string;
  total: number;
  paid: number;
  balance: number;
  dueDate: string;
  daysOverdue: number;
  status: 'al_corriente' | 'por_vencer' | 'vencido' | 'pago_parcial' | 'liquidado';
}

export interface Supplier {
  id: string;
  name: string;
  country: string;
  contact: string;
  phone: string;
  email: string;
  currency: 'MXN' | 'USD' | 'CNY';
  type: 'nacional' | 'internacional' | 'refacciones' | 'logistica' | 'aduana' | 'servicio';
}

export interface Warehouse {
  id: string;
  name: string;
  hasExhibition: boolean;
  location: string;
}

export const IMPORT_STATUS_LABELS: Record<ImportStatus, string> = {
  orden_enviada: 'Orden enviada',
  anticipo_pagado: 'Anticipo pagado',
  produccion: 'Producción',
  flete_local_china: 'Flete local China',
  puerto_china: 'Puerto China',
  embarcado: 'Embarcado',
  transito_maritimo: 'Tránsito marítimo',
  puerto_mexico: 'Puerto México',
  aduana: 'En aduana',
  liberado_aduana: 'Liberado aduana',
  transito_local: 'Tránsito local',
  llego_bodega: 'Llegó a bodega',
  inventario_disponible: 'Inventario disponible',
};

export const IMPORT_STATUS_ORDER: ImportStatus[] = [
  'orden_enviada', 'anticipo_pagado', 'produccion', 'flete_local_china',
  'puerto_china', 'embarcado', 'transito_maritimo', 'puerto_mexico',
  'aduana', 'liberado_aduana', 'transito_local', 'llego_bodega', 'inventario_disponible',
];

export const PIPELINE_LABELS: Record<PipelineStage, string> = {
  prospecto_nuevo: 'Prospecto nuevo',
  contactado: 'Contactado',
  calificado: 'Calificado',
  diagnostico: 'Diagnóstico',
  cotizacion_enviada: 'Cotización enviada',
  seguimiento: 'Seguimiento',
  negociacion: 'Negociación',
  cierre_ganado: 'Cierre ganado',
  cierre_perdido: 'Cierre perdido',
  postventa: 'Postventa',
};

export const CATEGORY_LABELS: Record<ProductCategory, string> = {
  elevadores: 'Elevadores / Rampas',
  balanceadoras: 'Balanceadoras',
  desmontadoras: 'Desmontadoras',
  alineadoras: 'Alineadoras',
  hidraulico: 'Equipo Hidráulico',
  lubricacion: 'Lubricación',
  aire: 'Aire',
  otros: 'Otros',
};

export const CUSTOMER_TYPE_LABELS: Record<CustomerType, string> = {
  taller_mecanico: 'Taller Mecánico',
  llantera: 'Llantera',
  suspension_frenos: 'Suspensión/Frenos',
  agencia: 'Agencia',
  flotilla: 'Flotilla',
  transportista: 'Transportista',
  vulcanizadora: 'Vulcanizadora',
  particular: 'Particular',
  distribuidor: 'Distribuidor',
};

export const ROLE_LABELS: Record<UserRole, string> = {
  director: 'Director / Super Admin',
  gerencia_comercial: 'Gerencia Comercial',
  vendedor: 'Vendedor',
  administracion: 'Administración / Cobranza',
  compras: 'Compras / Importaciones',
  almacen: 'Almacén / Inventarios',
  tecnico: 'Técnico / Postventa',
};
