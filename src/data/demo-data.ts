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
  { id: 'p1', sku: 'RB-ELV-4P01', name: 'Elevador 4 Postes 4 Ton', category: 'elevadores', brand: 'Redbuck', model: 'RB-4P4000', description: 'Elevador de 4 postes con capacidad de 4 toneladas, ideal para alineación y servicio general', listPrice: 89000, minPrice: 79000, cost: 52000, currency: 'MXN', deliveryDays: 5, supplier: 'Guangzhou Lift Co.', warranty: '2 años', active: true, stock: { w1: 3, w2: 1, w3: 2 }, inTransit: 5 },
  { id: 'p2', sku: 'RB-ELV-2P01', name: 'Elevador 2 Postes 4.5 Ton', category: 'elevadores', brand: 'Redbuck', model: 'RB-2P4500', description: 'Elevador de 2 postes asimétrico, capacidad 4.5 toneladas', listPrice: 75000, minPrice: 67000, cost: 44000, currency: 'MXN', deliveryDays: 5, supplier: 'Guangzhou Lift Co.', warranty: '2 años', active: true, stock: { w1: 4, w2: 2, w3: 1 }, inTransit: 3 },
  { id: 'p3', sku: 'RB-ELV-TIJ01', name: 'Elevador Tijera 3 Ton', category: 'elevadores', brand: 'Redbuck', model: 'RB-TJ3000', description: 'Elevador de tijera empotrable, 3 toneladas', listPrice: 65000, minPrice: 58000, cost: 38000, currency: 'MXN', deliveryDays: 7, supplier: 'Guangzhou Lift Co.', warranty: '2 años', active: true, stock: { w1: 2, w2: 0, w3: 1 }, inTransit: 4 },
  { id: 'p4', sku: 'RB-BAL-001', name: 'Balanceadora Automática', category: 'balanceadoras', brand: 'Redbuck', model: 'RB-BAL-A40', description: 'Balanceadora automática con pantalla digital, rines 10-24"', listPrice: 42000, minPrice: 37000, cost: 22000, currency: 'MXN', deliveryDays: 3, supplier: 'Zhongshan Auto Equipment', warranty: '1 año', active: true, stock: { w1: 6, w2: 3, w3: 4 }, inTransit: 8 },
  { id: 'p5', sku: 'RB-BAL-002', name: 'Balanceadora Semiautomática', category: 'balanceadoras', brand: 'Redbuck', model: 'RB-BAL-S30', description: 'Balanceadora semiautomática económica', listPrice: 28000, minPrice: 24000, cost: 14500, currency: 'MXN', deliveryDays: 3, supplier: 'Zhongshan Auto Equipment', warranty: '1 año', active: true, stock: { w1: 8, w2: 5, w3: 3 }, inTransit: 0 },
  { id: 'p6', sku: 'RB-DES-001', name: 'Desmontadora Automática 24"', category: 'desmontadoras', brand: 'Redbuck', model: 'RB-DES-A24', description: 'Desmontadora automática con brazo basculante, hasta 24"', listPrice: 55000, minPrice: 48000, cost: 29000, currency: 'MXN', deliveryDays: 3, supplier: 'Zhongshan Auto Equipment', warranty: '1 año', active: true, stock: { w1: 5, w2: 2, w3: 3 }, inTransit: 6 },
  { id: 'p7', sku: 'RB-DES-002', name: 'Desmontadora Semiautomática', category: 'desmontadoras', brand: 'Redbuck', model: 'RB-DES-S20', description: 'Desmontadora semiautomática económica hasta 20"', listPrice: 32000, minPrice: 28000, cost: 16500, currency: 'MXN', deliveryDays: 3, supplier: 'Zhongshan Auto Equipment', warranty: '1 año', active: true, stock: { w1: 7, w2: 4, w3: 2 }, inTransit: 0 },
  { id: 'p8', sku: 'RB-ALI-3D01', name: 'Alineadora 3D', category: 'alineadoras', brand: 'Redbuck', model: 'RB-ALI-3D', description: 'Sistema de alineación 3D con cámaras HD y base de datos', listPrice: 185000, minPrice: 165000, cost: 98000, currency: 'MXN', deliveryDays: 10, supplier: 'Shenzhen Alignment Tech', warranty: '2 años', active: true, stock: { w1: 1, w2: 0, w3: 1 }, inTransit: 2 },
  { id: 'p9', sku: 'RB-ALI-CCD1', name: 'Alineadora CCD', category: 'alineadoras', brand: 'Redbuck', model: 'RB-ALI-CCD', description: 'Alineadora con sensores CCD, económica y precisa', listPrice: 95000, minPrice: 85000, cost: 52000, currency: 'MXN', deliveryDays: 7, supplier: 'Shenzhen Alignment Tech', warranty: '1 año', active: true, stock: { w1: 2, w2: 1, w3: 0 }, inTransit: 0 },
  { id: 'p10', sku: 'RB-HID-PR01', name: 'Prensa Hidráulica 20 Ton', category: 'hidraulico', brand: 'Redbuck', model: 'RB-PH20', description: 'Prensa hidráulica de piso, 20 toneladas', listPrice: 18000, minPrice: 15500, cost: 8500, currency: 'MXN', deliveryDays: 3, supplier: 'Nacional - Herramientas MX', warranty: '1 año', active: true, stock: { w1: 4, w2: 3, w3: 2 }, inTransit: 0 },
  { id: 'p11', sku: 'RB-HID-PR02', name: 'Prensa Hidráulica 50 Ton', category: 'hidraulico', brand: 'Redbuck', model: 'RB-PH50', description: 'Prensa hidráulica de piso, 50 toneladas', listPrice: 35000, minPrice: 30000, cost: 18000, currency: 'MXN', deliveryDays: 5, supplier: 'Nacional - Herramientas MX', warranty: '1 año', active: true, stock: { w1: 2, w2: 1, w3: 1 }, inTransit: 0 },
  { id: 'p12', sku: 'RB-HID-GAT01', name: 'Gato Hidráulico Patin 3 Ton', category: 'hidraulico', brand: 'Redbuck', model: 'RB-GP3', description: 'Gato de patín profesional, 3 toneladas', listPrice: 8500, minPrice: 7200, cost: 4200, currency: 'MXN', deliveryDays: 2, supplier: 'Nacional - Herramientas MX', warranty: '6 meses', active: true, stock: { w1: 12, w2: 8, w3: 6 }, inTransit: 0 },
  { id: 'p13', sku: 'RB-LUB-001', name: 'Sistema de Lubricación Neumático', category: 'lubricacion', brand: 'Redbuck', model: 'RB-LUB-N1', description: 'Sistema completo de lubricación neumático para taller', listPrice: 22000, minPrice: 19000, cost: 11500, currency: 'MXN', deliveryDays: 5, supplier: 'Nacional - Herramientas MX', warranty: '1 año', active: true, stock: { w1: 3, w2: 2, w3: 1 }, inTransit: 0 },
  { id: 'p14', sku: 'RB-AIR-COM01', name: 'Compresor 5 HP 235L', category: 'aire', brand: 'Redbuck', model: 'RB-C5-235', description: 'Compresor de aire 5 HP, tanque 235 litros', listPrice: 25000, minPrice: 22000, cost: 13000, currency: 'MXN', deliveryDays: 3, supplier: 'Nacional - Herramientas MX', warranty: '1 año', active: true, stock: { w1: 5, w2: 3, w3: 2 }, inTransit: 0 },
  { id: 'p15', sku: 'RB-AIR-COM02', name: 'Compresor 10 HP 500L', category: 'aire', brand: 'Redbuck', model: 'RB-C10-500', description: 'Compresor industrial 10 HP, tanque 500 litros', listPrice: 48000, minPrice: 42000, cost: 26000, currency: 'MXN', deliveryDays: 5, supplier: 'Nacional - Herramientas MX', warranty: '1 año', active: true, stock: { w1: 2, w2: 1, w3: 1 }, inTransit: 0 },
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

export const demoOpportunities: Opportunity[] = [
  { id: 'o1', customerId: 'c1', customerName: 'Taller Los Reyes', vendorId: 'u3', vendorName: 'Roberto Juárez', products: ['Elevador 4 Postes', 'Alineadora 3D'], estimatedAmount: 274000, probability: 75, stage: 'negociacion', estimatedCloseDate: '2026-03-20', nextActivity: 'Visita demo', createdAt: '2025-12-01' },
  { id: 'o2', customerId: 'c2', customerName: 'Llantamax', vendorId: 'u4', vendorName: 'Miguel Torres', products: ['Balanceadora Automática', 'Desmontadora Automática'], estimatedAmount: 97000, probability: 90, stage: 'cotizacion_enviada', estimatedCloseDate: '2026-03-15', nextActivity: 'Seguimiento cotización', createdAt: '2025-12-10' },
  { id: 'o3', customerId: 'c5', customerName: 'Grupo Llantas Express', vendorId: 'u6', vendorName: 'Fernando Ruiz', products: ['Elevador 2 Postes', 'Balanceadora', 'Desmontadora', 'Compresor'], estimatedAmount: 200000, probability: 50, stage: 'diagnostico', estimatedCloseDate: '2026-04-10', nextActivity: 'Diagnóstico de taller', createdAt: '2026-01-05' },
  { id: 'o4', customerId: 'c8', customerName: 'AutoAgencia Premium', vendorId: 'u3', vendorName: 'Roberto Juárez', products: ['Alineadora 3D', 'Elevador Tijera'], estimatedAmount: 250000, probability: 60, stage: 'seguimiento', estimatedCloseDate: '2026-04-01', createdAt: '2026-01-10' },
  { id: 'o5', customerId: 'c4', customerName: 'Servicio Automotriz Juárez', vendorId: 'u5', vendorName: 'Alejandra Vega', products: ['Prensa Hidráulica 20T', 'Compresor 5HP'], estimatedAmount: 43000, probability: 85, stage: 'cierre_ganado', estimatedCloseDate: '2026-02-28', createdAt: '2025-11-15' },
  { id: 'o6', customerId: 'c12', customerName: 'Distribuidora Bajío', vendorId: 'u4', vendorName: 'Miguel Torres', products: ['5x Balanceadora', '5x Desmontadora'], estimatedAmount: 435000, probability: 40, stage: 'calificado', estimatedCloseDate: '2026-05-01', createdAt: '2026-02-01' },
  { id: 'o7', customerId: 'c6', customerName: 'Transportes García', vendorId: 'u5', vendorName: 'Alejandra Vega', products: ['Gato Patín 3T x5'], estimatedAmount: 42500, probability: 70, stage: 'contactado', estimatedCloseDate: '2026-03-30', createdAt: '2026-02-15' },
];

export const demoQuotations: Quotation[] = [
  { id: 'q1', folio: 'V1-1001', customerId: 'c1', customerName: 'Taller Los Reyes', customerPhone: '811-234-5678', vendorId: 'u3', vendorName: 'Roberto Juárez', vendorPhone: '81-1000-0003', vendorEmail: 'roberto@redbuck.mx', items: [{ productId: 'p1', productName: 'Elevador 4 Postes 4 Ton', productImage: '/products/elevador-4-postes.jpg', sku: 'RB-ELV-4P01', qty: 1, unitPrice: 85000, discount: 5 }, { productId: 'p8', productName: 'Alineadora 3D', productImage: '/products/alineadora-3d.jpg', sku: 'RB-ALI-3D01', qty: 1, unitPrice: 175000, discount: 5 }], subtotal: 247000, tax: 39520, total: 286520, status: 'enviada', validUntil: '2026-03-25', createdAt: '2026-02-20' },
  { id: 'q2', folio: 'V2-2001', customerId: 'c2', customerName: 'Llantamax', customerPhone: '333-456-7890', vendorId: 'u4', vendorName: 'Miguel Torres', vendorPhone: '81-1000-0004', vendorEmail: 'miguel@redbuck.mx', items: [{ productId: 'p4', productName: 'Balanceadora Automática', productImage: '/products/balanceadora-auto.jpg', sku: 'RB-BAL-001', qty: 1, unitPrice: 40000, discount: 3 }, { productId: 'p6', productName: 'Desmontadora Automática 24"', productImage: '/products/desmontadora-auto.jpg', sku: 'RB-DES-001', qty: 1, unitPrice: 52000, discount: 3 }], subtotal: 89240, tax: 14278, total: 103518, status: 'seguimiento', validUntil: '2026-03-20', createdAt: '2026-02-15' },
  { id: 'q3', folio: 'V4-4001', customerId: 'c5', customerName: 'Grupo Llantas Express', customerPhone: '55-4567-8901', vendorId: 'u6', vendorName: 'Fernando Ruiz', vendorPhone: '81-1000-0006', vendorEmail: 'fernando@redbuck.mx', items: [{ productId: 'p2', productName: 'Elevador 2 Postes 4.5 Ton', productImage: '/products/elevador-2-postes.jpg', sku: 'RB-ELV-2P01', qty: 2, unitPrice: 72000, discount: 5 }], subtotal: 136800, tax: 21888, total: 158688, status: 'borrador', validUntil: '2026-04-05', createdAt: '2026-03-01' },
  { id: 'q4', folio: 'V3-3001', customerId: 'c4', customerName: 'Servicio Automotriz Juárez', customerPhone: '656-345-6789', vendorId: 'u5', vendorName: 'Alejandra Vega', vendorPhone: '81-1000-0005', vendorEmail: 'ale@redbuck.mx', items: [{ productId: 'p10', productName: 'Prensa Hidráulica 20 Ton', productImage: '/products/prensa-hidraulica.jpg', sku: 'RB-HID-PR01', qty: 1, unitPrice: 17000, discount: 0 }, { productId: 'p14', productName: 'Compresor 5 HP 235L', productImage: '/products/compresor.jpg', sku: 'RB-AIR-COM01', qty: 1, unitPrice: 24000, discount: 0 }], subtotal: 41000, tax: 6560, total: 47560, status: 'aceptada', validUntil: '2026-03-10', createdAt: '2026-02-10' },
];

export const demoOrders: Order[] = [
  { id: 'or1', folio: 'PED-2026-001', customerId: 'c4', customerName: 'Servicio Automotriz Juárez', vendorName: 'Alejandra Vega', items: [{ productName: 'Prensa Hidráulica 20 Ton', qty: 1, unitPrice: 17000 }, { productName: 'Compresor 5 HP 235L', qty: 1, unitPrice: 24000 }], total: 47560, advance: 23780, balance: 23780, status: 'confirmado', warehouse: 'Bodega Principal', promiseDate: '2026-03-15', createdAt: '2026-02-12' },
  { id: 'or2', folio: 'PED-2026-002', customerId: 'c1', customerName: 'Taller Los Reyes', vendorName: 'Roberto Juárez', items: [{ productName: 'Balanceadora Semiautomática', qty: 2, unitPrice: 26000 }], total: 60320, advance: 60320, balance: 0, status: 'entregado', warehouse: 'Bodega Principal', promiseDate: '2026-02-28', createdAt: '2026-02-01' },
  { id: 'or3', folio: 'PED-2026-003', customerId: 'c2', customerName: 'Llantamax', vendorName: 'Miguel Torres', items: [{ productName: 'Desmontadora Semiautomática', qty: 1, unitPrice: 30000 }], total: 34800, advance: 17400, balance: 17400, status: 'en_entrega', warehouse: 'Bodega Sur', promiseDate: '2026-03-10', createdAt: '2026-02-20' },
  { id: 'or4', folio: 'PED-2026-004', customerId: 'c10', customerName: 'Taller Hernández', vendorName: 'Fernando Ruiz', items: [{ productName: 'Gato Hidráulico Patin 3 Ton', qty: 3, unitPrice: 8000 }], total: 27840, advance: 0, balance: 27840, status: 'nuevo', warehouse: 'Bodega CDMX', promiseDate: '2026-03-20', createdAt: '2026-03-04' },
];

export const demoImports: ImportOrder[] = [
  {
    id: 'imp1', orderNumber: 'IMP-2026-001', supplier: 'Guangzhou Lift Co.', country: 'China',
    departurePort: 'Guangzhou', arrivalPort: 'Manzanillo', currency: 'USD', exchangeRate: 17.2,
    purchaseDate: '2025-12-15', estimatedDeparture: '2026-01-20', estimatedArrival: '2026-03-25',
    status: 'transito_maritimo',
    items: [{ productName: 'Elevador 4 Postes 4 Ton', qty: 5, unitCost: 3020 }, { productName: 'Elevador 2 Postes 4.5 Ton', qty: 3, unitCost: 2560 }],
    totalCost: 22780, freightCost: 4500, customsCost: 3200, totalLanded: 30480, daysInTransit: 45,
  },
  {
    id: 'imp2', orderNumber: 'IMP-2026-002', supplier: 'Zhongshan Auto Equipment', country: 'China',
    departurePort: 'Shenzhen', arrivalPort: 'Manzanillo', currency: 'USD', exchangeRate: 17.2,
    purchaseDate: '2026-01-10', estimatedDeparture: '2026-02-15', estimatedArrival: '2026-04-10',
    status: 'embarcado',
    items: [{ productName: 'Balanceadora Automática', qty: 8, unitCost: 1280 }, { productName: 'Desmontadora Automática 24"', qty: 6, unitCost: 1685 }],
    totalCost: 20350, freightCost: 3800, customsCost: 2800, totalLanded: 26950, daysInTransit: 19,
  },
  {
    id: 'imp3', orderNumber: 'IMP-2026-003', supplier: 'Shenzhen Alignment Tech', country: 'China',
    departurePort: 'Shenzhen', arrivalPort: 'Lázaro Cárdenas', currency: 'USD', exchangeRate: 17.2,
    purchaseDate: '2026-02-01', estimatedDeparture: '2026-03-01', estimatedArrival: '2026-04-25',
    status: 'produccion',
    items: [{ productName: 'Alineadora 3D', qty: 2, unitCost: 5700 }, { productName: 'Elevador Tijera 3 Ton', qty: 4, unitCost: 2210 }],
    totalCost: 20240, freightCost: 3500, customsCost: 2600, totalLanded: 26340, daysInTransit: 0,
  },
];

export const demoAccountsReceivable: AccountReceivable[] = [
  { id: 'ar1', customerId: 'c4', customerName: 'Servicio Automotriz Juárez', orderId: 'or1', orderFolio: 'PED-2026-001', total: 47560, paid: 23780, balance: 23780, dueDate: '2026-03-15', daysOverdue: 0, status: 'al_corriente' },
  { id: 'ar2', customerId: 'c2', customerName: 'Llantamax', orderId: 'or3', orderFolio: 'PED-2026-003', total: 34800, paid: 17400, balance: 17400, dueDate: '2026-03-10', daysOverdue: 0, status: 'por_vencer' },
  { id: 'ar3', customerId: 'c10', customerName: 'Taller Hernández', orderId: 'or4', orderFolio: 'PED-2026-004', total: 27840, paid: 0, balance: 27840, dueDate: '2026-03-20', daysOverdue: 0, status: 'al_corriente' },
  { id: 'ar4', customerId: 'c6', customerName: 'Transportes García', orderId: 'or-old1', orderFolio: 'PED-2025-045', total: 85000, paid: 42500, balance: 42500, dueDate: '2026-02-15', daysOverdue: 19, status: 'vencido' },
  { id: 'ar5', customerId: 'c7', customerName: 'Vulcanizadora El Rápido', orderId: 'or-old2', orderFolio: 'PED-2025-052', total: 32000, paid: 16000, balance: 16000, dueDate: '2026-02-28', daysOverdue: 6, status: 'vencido' },
];

export const demoServiceOrders: ServiceOrder[] = [
  { id: 'so1', folio: 'SRV-2026-001', customerId: 'c1', customerName: 'Taller Los Reyes', productName: 'Balanceadora Semiautomática', technicianName: 'Jorge Pérez', type: 'instalacion', scheduledDate: '2026-03-08', status: 'programado', description: 'Instalación y capacitación de 2 balanceadoras' },
  { id: 'so2', folio: 'SRV-2026-002', customerId: 'c3', customerName: 'Suspensiones del Norte', productName: 'Elevador 2 Postes', technicianName: 'Jorge Pérez', type: 'garantia', scheduledDate: '2026-03-10', status: 'pendiente', description: 'Revisión de fuga hidráulica en cilindro principal' },
  { id: 'so3', folio: 'SRV-2026-003', customerId: 'c5', customerName: 'Grupo Llantas Express', productName: 'Alineadora CCD', technicianName: 'Jorge Pérez', type: 'mantenimiento', scheduledDate: '2026-03-12', status: 'programado', description: 'Mantenimiento preventivo y calibración' },
];

export const demoSuppliers: Supplier[] = [
  { id: 's1', name: 'Guangzhou Lift Co.', country: 'China', contact: 'Wang Li', phone: '+86-20-8888-1234', email: 'wang@gzlift.cn', currency: 'USD', type: 'internacional' },
  { id: 's2', name: 'Zhongshan Auto Equipment', country: 'China', contact: 'Chen Wei', phone: '+86-760-8888-5678', email: 'chen@zsauto.cn', currency: 'USD', type: 'internacional' },
  { id: 's3', name: 'Shenzhen Alignment Tech', country: 'China', contact: 'Liu Ming', phone: '+86-755-8888-9012', email: 'liu@szalign.cn', currency: 'USD', type: 'internacional' },
  { id: 's4', name: 'Herramientas MX S.A. de C.V.', country: 'México', contact: 'Arturo Sánchez', phone: '81-1234-5678', email: 'arturo@herramientasmx.com', currency: 'MXN', type: 'nacional' },
  { id: 's5', name: 'Logística Global MX', country: 'México', contact: 'Sandra Reyes', phone: '33-2345-6789', email: 'sandra@logisticaglobal.mx', currency: 'MXN', type: 'logistica' },
  { id: 's6', name: 'Agencia Aduanal Torres', country: 'México', contact: 'Ing. Torres', phone: '314-345-6789', email: 'torres@aduanaltorres.mx', currency: 'MXN', type: 'aduana' },
];

export const demoSpareParts: SparePart[] = [
  { id: 'sp1', sku: 'REF-ELV-CIL01', name: 'Cilindro hidráulico elevador', productId: 'p1', productName: 'Elevador 4 Postes', cost: 3500, price: 6800, stock: 4, minStock: 2, warehouse: 'Bodega Principal', active: true },
  { id: 'sp2', sku: 'REF-ELV-CAB01', name: 'Cable de acero elevador', productId: 'p2', productName: 'Elevador 2 Postes', cost: 1200, price: 2400, stock: 6, minStock: 3, warehouse: 'Bodega Principal', active: true },
  { id: 'sp3', sku: 'REF-BAL-SEN01', name: 'Sensor de balanceadora', productId: 'p4', productName: 'Balanceadora Automática', cost: 800, price: 1800, stock: 8, minStock: 4, warehouse: 'Bodega Principal', active: true },
  { id: 'sp4', sku: 'REF-DES-UÑA01', name: 'Uña desmontadora', productId: 'p6', productName: 'Desmontadora Automática', cost: 450, price: 950, stock: 12, minStock: 6, warehouse: 'Bodega Principal', active: true },
  { id: 'sp5', sku: 'REF-ALI-CAM01', name: 'Cámara alineadora 3D', productId: 'p8', productName: 'Alineadora 3D', cost: 8500, price: 15000, stock: 2, minStock: 1, warehouse: 'Bodega Principal', active: true },
  { id: 'sp6', sku: 'REF-ELV-SEL01', name: 'Sello hidráulico kit', productId: 'p1', productName: 'Elevador 4 Postes', cost: 280, price: 650, stock: 15, minStock: 5, warehouse: 'Bodega Principal', active: true },
  { id: 'sp7', sku: 'REF-BAL-PCB01', name: 'Tarjeta electrónica balanceadora', productId: 'p4', productName: 'Balanceadora Automática', cost: 2200, price: 4500, stock: 3, minStock: 2, warehouse: 'Bodega Principal', active: true },
  { id: 'sp8', sku: 'REF-COM-VAL01', name: 'Válvula check compresor', productId: 'p14', productName: 'Compresor 5 HP', cost: 350, price: 750, stock: 10, minStock: 5, warehouse: 'Bodega Principal', active: true },
];

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
  salesMonth: 1_245_000,
  salesQuarter: 3_780_000,
  activeOpportunities: 7,
  quotationsSent: 12,
  closeRate: 42,
  avgTicket: 68500,
  grossMargin: 38,
  overdueReceivables: 58500,
  pendingCollection: 109520,
  totalInventoryValue: 4_250_000,
  productsInTransit: 28,
  activeImports: 3,
  activeServiceOrders: 3,
  activeWarranties: 1,
};

export const salesByVendor = [
  { name: 'Roberto J.', sales: 380000 },
  { name: 'Miguel T.', sales: 310000 },
  { name: 'Alejandra V.', sales: 245000 },
  { name: 'Fernando R.', sales: 180000 },
  { name: 'Diana C.', sales: 130000 },
];

export const salesByCategory = [
  { name: 'Elevadores', value: 520000 },
  { name: 'Balanceadoras', value: 280000 },
  { name: 'Desmontadoras', value: 195000 },
  { name: 'Alineadoras', value: 185000 },
  { name: 'Hidráulico', value: 42000 },
  { name: 'Aire', value: 23000 },
];

export const monthlySales = [
  { month: 'Oct', sales: 980000 },
  { month: 'Nov', sales: 1120000 },
  { month: 'Dic', sales: 1450000 },
  { month: 'Ene', sales: 1080000 },
  { month: 'Feb', sales: 1350000 },
  { month: 'Mar', sales: 1245000 },
];
