import {
  User, Customer, Product, Opportunity, Quotation, Order,
  ImportOrder, ServiceOrder, AccountReceivable, Supplier, Warehouse, SparePart,
  CompanyInfo, SalesConditions, WhatsAppTemplate
} from '@/types';

export const demoUsers: User[] = [
  { id: 'u1', name: 'Carlos Mendoza', email: 'carlos@redbuck.mx', phone: '81-1000-0001', whatsapp: '5218110000001', role: 'director', active: true },
  { id: 'u2', name: 'Laura Ríos', email: 'laura@redbuck.mx', phone: '81-1000-0002', whatsapp: '5218110000002', role: 'gerencia_comercial', active: true },
  { id: 'u3', name: 'Roberto Juárez', email: 'roberto@redbuck.mx', phone: '81-1000-0003', whatsapp: '5218110000003', role: 'vendedor', active: true, seriesPrefix: 'V1', seriesStart: 1000, seriesCurrent: 1003, commissionRate: 5 },
  { id: 'u4', name: 'Miguel Torres', email: 'miguel@redbuck.mx', phone: '81-1000-0004', whatsapp: '5218110000004', role: 'vendedor', active: true, seriesPrefix: 'V2', seriesStart: 2000, seriesCurrent: 2002, commissionRate: 5 },
  { id: 'u5', name: 'Alejandra Vega', email: 'ale@redbuck.mx', phone: '81-1000-0005', whatsapp: '5218110000005', role: 'vendedor', active: true, seriesPrefix: 'V3', seriesStart: 3000, seriesCurrent: 3001, commissionRate: 5 },
  { id: 'u6', name: 'Fernando Ruiz', email: 'fernando@redbuck.mx', phone: '81-1000-0006', whatsapp: '5218110000006', role: 'vendedor', active: true, seriesPrefix: 'V4', seriesStart: 4000, seriesCurrent: 4001, commissionRate: 5 },
  { id: 'u7', name: 'Diana Castillo', email: 'diana@redbuck.mx', phone: '81-1000-0007', whatsapp: '5218110000007', role: 'vendedor', active: true, seriesPrefix: 'V5', seriesStart: 5000, seriesCurrent: 5000, commissionRate: 5 },
  { id: 'u8', name: 'Patricia López', email: 'patricia@redbuck.mx', phone: '81-1000-0008', role: 'administracion', active: true },
  { id: 'u9', name: 'Héctor Morales', email: 'hector@redbuck.mx', phone: '81-1000-0009', role: 'compras', active: true },
  { id: 'u10', name: 'Ramón Flores', email: 'ramon@redbuck.mx', phone: '81-1000-0010', role: 'almacen', active: true },
  { id: 'u11', name: 'Jorge Pérez', email: 'jorge@redbuck.mx', phone: '81-1000-0011', role: 'tecnico', active: true },
];

export const demoWarehouses: Warehouse[] = [
  { id: 'w1', name: 'Bodega Principal', hasExhibition: true, location: 'Monterrey, NL' },
  { id: 'w2', name: 'Bodega Sur', hasExhibition: false, location: 'Guadalajara, JAL' },
  { id: 'w3', name: 'Bodega CDMX', hasExhibition: false, location: 'CDMX' },
];

export const demoProducts: Product[] = [
  { id: 'p1', sku: 'RB-ELV-4P01', name: 'Elevador 4 Postes 4 Ton', category: 'elevadores', brand: 'Redbuck', model: 'RB-4P4000', description: 'Elevador de 4 postes con capacidad de 4 toneladas, ideal para alineación y servicio general', listPrice: 4450, minPrice: 3950, cost: 2600, currency: 'USD', deliveryDays: 5, supplier: 'Guangzhou Lift Co.', warranty: '2 años', active: true, stock: { w1: 3, w2: 1, w3: 2 }, inTransit: 5 },
  { id: 'p2', sku: 'RB-ELV-2P01', name: 'Elevador 2 Postes 4.5 Ton', category: 'elevadores', brand: 'Redbuck', model: 'RB-2P4500', description: 'Elevador de 2 postes asimétrico, capacidad 4.5 toneladas', listPrice: 3750, minPrice: 3350, cost: 2200, currency: 'USD', deliveryDays: 5, supplier: 'Guangzhou Lift Co.', warranty: '2 años', active: true, stock: { w1: 4, w2: 2, w3: 1 }, inTransit: 3 },
  { id: 'p3', sku: 'RB-ELV-TIJ01', name: 'Elevador Tijera 3 Ton', category: 'elevadores', brand: 'Redbuck', model: 'RB-TJ3000', description: 'Elevador de tijera empotrable, 3 toneladas', listPrice: 3250, minPrice: 2900, cost: 1900, currency: 'USD', deliveryDays: 7, supplier: 'Guangzhou Lift Co.', warranty: '2 años', active: true, stock: { w1: 2, w2: 0, w3: 1 }, inTransit: 4 },
  { id: 'p4', sku: 'RB-BAL-001', name: 'Balanceadora Automática', category: 'balanceadoras', brand: 'Redbuck', model: 'RB-BAL-A40', description: 'Balanceadora automática con pantalla digital, rines 10-24"', listPrice: 2100, minPrice: 1850, cost: 1100, currency: 'USD', deliveryDays: 3, supplier: 'Zhongshan Auto Equipment', warranty: '1 año', active: true, stock: { w1: 6, w2: 3, w3: 4 }, inTransit: 8 },
  { id: 'p5', sku: 'RB-BAL-002', name: 'Balanceadora Semiautomática', category: 'balanceadoras', brand: 'Redbuck', model: 'RB-BAL-S30', description: 'Balanceadora semiautomática económica', listPrice: 1400, minPrice: 1200, cost: 725, currency: 'USD', deliveryDays: 3, supplier: 'Zhongshan Auto Equipment', warranty: '1 año', active: true, stock: { w1: 8, w2: 5, w3: 3 }, inTransit: 0 },
  { id: 'p6', sku: 'RB-DES-001', name: 'Desmontadora Automática 24"', category: 'desmontadoras', brand: 'Redbuck', model: 'RB-DES-A24', description: 'Desmontadora automática con brazo basculante, hasta 24"', listPrice: 2750, minPrice: 2400, cost: 1450, currency: 'USD', deliveryDays: 3, supplier: 'Zhongshan Auto Equipment', warranty: '1 año', active: true, stock: { w1: 5, w2: 2, w3: 3 }, inTransit: 6 },
  { id: 'p7', sku: 'RB-DES-002', name: 'Desmontadora Semiautomática', category: 'desmontadoras', brand: 'Redbuck', model: 'RB-DES-S20', description: 'Desmontadora semiautomática económica hasta 20"', listPrice: 1600, minPrice: 1400, cost: 825, currency: 'USD', deliveryDays: 3, supplier: 'Zhongshan Auto Equipment', warranty: '1 año', active: true, stock: { w1: 7, w2: 4, w3: 2 }, inTransit: 0 },
  { id: 'p8', sku: 'RB-ALI-3D01', name: 'Alineadora 3D', category: 'alineadoras', brand: 'Redbuck', model: 'RB-ALI-3D', description: 'Sistema de alineación 3D con cámaras HD y base de datos', listPrice: 9250, minPrice: 8250, cost: 4900, currency: 'USD', deliveryDays: 10, supplier: 'Shenzhen Alignment Tech', warranty: '2 años', active: true, stock: { w1: 1, w2: 0, w3: 1 }, inTransit: 2 },
  { id: 'p9', sku: 'RB-ALI-CCD1', name: 'Alineadora CCD', category: 'alineadoras', brand: 'Redbuck', model: 'RB-ALI-CCD', description: 'Alineadora con sensores CCD, económica y precisa', listPrice: 4750, minPrice: 4250, cost: 2600, currency: 'USD', deliveryDays: 7, supplier: 'Shenzhen Alignment Tech', warranty: '1 año', active: true, stock: { w1: 2, w2: 1, w3: 0 }, inTransit: 0 },
  { id: 'p10', sku: 'RB-HID-PR01', name: 'Prensa Hidráulica 20 Ton', category: 'hidraulico', brand: 'Redbuck', model: 'RB-PH20', description: 'Prensa hidráulica de piso, 20 toneladas', listPrice: 900, minPrice: 775, cost: 425, currency: 'USD', deliveryDays: 3, supplier: 'Nacional - Herramientas MX', warranty: '1 año', active: true, stock: { w1: 4, w2: 3, w3: 2 }, inTransit: 0 },
  { id: 'p11', sku: 'RB-HID-PR02', name: 'Prensa Hidráulica 50 Ton', category: 'hidraulico', brand: 'Redbuck', model: 'RB-PH50', description: 'Prensa hidráulica de piso, 50 toneladas', listPrice: 1750, minPrice: 1500, cost: 900, currency: 'USD', deliveryDays: 5, supplier: 'Nacional - Herramientas MX', warranty: '1 año', active: true, stock: { w1: 2, w2: 1, w3: 1 }, inTransit: 0 },
  { id: 'p12', sku: 'RB-HID-GAT01', name: 'Gato Hidráulico Patin 3 Ton', category: 'hidraulico', brand: 'Redbuck', model: 'RB-GP3', description: 'Gato de patín profesional, 3 toneladas', listPrice: 425, minPrice: 360, cost: 210, currency: 'USD', deliveryDays: 2, supplier: 'Nacional - Herramientas MX', warranty: '6 meses', active: true, stock: { w1: 12, w2: 8, w3: 6 }, inTransit: 0 },
  { id: 'p13', sku: 'RB-LUB-001', name: 'Sistema de Lubricación Neumático', category: 'lubricacion', brand: 'Redbuck', model: 'RB-LUB-N1', description: 'Sistema completo de lubricación neumático para taller', listPrice: 1100, minPrice: 950, cost: 575, currency: 'USD', deliveryDays: 5, supplier: 'Nacional - Herramientas MX', warranty: '1 año', active: true, stock: { w1: 3, w2: 2, w3: 1 }, inTransit: 0 },
  { id: 'p14', sku: 'RB-AIR-COM01', name: 'Compresor 5 HP 235L', category: 'aire', brand: 'Redbuck', model: 'RB-C5-235', description: 'Compresor de aire 5 HP, tanque 235 litros', listPrice: 1250, minPrice: 1100, cost: 650, currency: 'USD', deliveryDays: 3, supplier: 'Nacional - Herramientas MX', warranty: '1 año', active: true, stock: { w1: 5, w2: 3, w3: 2 }, inTransit: 0 },
  { id: 'p15', sku: 'RB-AIR-COM02', name: 'Compresor 10 HP 500L', category: 'aire', brand: 'Redbuck', model: 'RB-C10-500', description: 'Compresor industrial 10 HP, tanque 500 litros', listPrice: 2400, minPrice: 2100, cost: 1300, currency: 'USD', deliveryDays: 5, supplier: 'Nacional - Herramientas MX', warranty: '1 año', active: true, stock: { w1: 2, w2: 1, w3: 1 }, inTransit: 0 },
];

export const demoCustomers: Customer[] = [
  { id: 'c1', name: 'Taller Automotriz Los Reyes', type: 'taller_mecanico', phone: '811-234-5678', city: 'Monterrey', state: 'Nuevo León', vendorId: 'u3', source: 'recomendacion', priority: 'alta', createdAt: '2024-08-15' },
  { id: 'c2', name: 'Llantamax S.A. de C.V.', type: 'llantera', phone: '333-456-7890', city: 'Guadalajara', state: 'Jalisco', vendorId: 'u4', source: 'facebook', priority: 'alta', createdAt: '2024-09-01' },
  { id: 'c3', name: 'Suspensiones del Norte', type: 'suspension_frenos', phone: '818-567-8901', city: 'San Nicolás', state: 'Nuevo León', vendorId: 'u3', source: 'expos', priority: 'media', createdAt: '2024-09-15' },
  { id: 'c4', name: 'Servicio Automotriz Juárez', type: 'taller_mecanico', phone: '656-345-6789', city: 'Ciudad Juárez', state: 'Chihuahua', vendorId: 'u5', source: 'whatsapp', priority: 'alta', createdAt: '2024-10-01' },
  { id: 'c5', name: 'Grupo Llantas Express', type: 'llantera', phone: '55-4567-8901', city: 'CDMX', state: 'CDMX', vendorId: 'u6', source: 'sitio_web', priority: 'alta', createdAt: '2024-10-10' },
  { id: 'c6', name: 'Transportes García Hnos', type: 'transportista', phone: '844-234-5678', city: 'Saltillo', state: 'Coahuila', vendorId: 'u5', source: 'llamada', priority: 'media', createdAt: '2024-10-20' },
  { id: 'c7', name: 'Vulcanizadora El Rápido', type: 'vulcanizadora', phone: '868-123-4567', city: 'Nuevo Laredo', state: 'Tamaulipas', vendorId: 'u7', source: 'recomendacion', priority: 'baja', createdAt: '2024-11-01' },
  { id: 'c8', name: 'AutoAgencia Premium', type: 'agencia', phone: '812-345-6789', city: 'San Pedro', state: 'Nuevo León', vendorId: 'u3', source: 'visita_sucursal', priority: 'alta', createdAt: '2024-11-05' },
  { id: 'c9', name: 'Flotillas del Pacífico', type: 'flotilla', phone: '669-234-5678', city: 'Mazatlán', state: 'Sinaloa', vendorId: 'u4', source: 'campaña', priority: 'media', createdAt: '2024-11-10' },
  { id: 'c10', name: 'Taller Mecánico Hernández', type: 'taller_mecanico', phone: '477-123-4567', city: 'León', state: 'Guanajuato', vendorId: 'u6', source: 'facebook', priority: 'media', createdAt: '2024-11-15' },
  { id: 'c11', name: 'Llantas y Servicios Morelos', type: 'llantera', phone: '777-234-5678', city: 'Cuernavaca', state: 'Morelos', vendorId: 'u7', source: 'organico', priority: 'baja', createdAt: '2024-11-20' },
  { id: 'c12', name: 'Distribuidora Automotriz del Bajío', type: 'distribuidor', phone: '442-345-6789', city: 'Querétaro', state: 'Querétaro', vendorId: 'u4', source: 'expos', priority: 'alta', createdAt: '2024-12-01' },
];

export const demoOpportunities: Opportunity[] = [];

export const demoQuotations: Quotation[] = [];

export const demoOrders: Order[] = [];

export const demoImports: ImportOrder[] = [];

export const demoAccountsReceivable: AccountReceivable[] = [];

export const demoServiceOrders: ServiceOrder[] = [];

export const demoSpareParts: SparePart[] = [];

export const demoSuppliers: Supplier[] = [];

// Company info
export const demoCompanyInfo: CompanyInfo = {
  razonSocial: 'REDBUCK EQUIPMENT S.A. DE C.V.',
  nombreComercial: 'REDBUCK EQUIPMENT',
  direccion: 'Av. Industrial 1250, Col. Centro, Monterrey, N.L., C.P. 64000',
  telefono: '81-1234-5678',
  correo: 'ventas@redbuck.mx',
  rfc: 'RBE200101ABC',
};

export const demoSalesConditions: SalesConditions = {
  text: `• Precios sujetos a cambio sin previo aviso.\n• Vigencia de la cotización: 15 días.\n• Los precios incluyen IVA.\n• El tiempo de entrega está sujeto a disponibilidad.\n• La garantía aplica contra defectos de fabricación.\n• Instalación, flete o maniobras no incluidas salvo especificación expresa.\n• Anticipo mínimo del 50% para confirmar pedido.\n• Saldo restante contra entrega.`,
};

export const demoWhatsAppTemplate: WhatsAppTemplate = {
  message: 'Hola, te compartimos tu cotización de REDBUCK EQUIPMENT. Quedamos atentos a cualquier duda.',
};

// Summary metrics
export const dashboardMetrics = {
  salesMonth: 0,
  salesQuarter: 0,
  activeOpportunities: 0,
  quotationsSent: 0,
  closeRate: 0,
  avgTicket: 0,
  grossMargin: 0,
  overdueReceivables: 0,
  pendingCollection: 0,
  totalInventoryValue: 0,
  productsInTransit: 0,
  activeImports: 0,
  activeServiceOrders: 0,
  activeWarranties: 0,
};

export const salesByVendor: { name: string; sales: number }[] = [];

export const salesByCategory: { name: string; value: number }[] = [];

export const monthlySales: { month: string; sales: number }[] = [];
