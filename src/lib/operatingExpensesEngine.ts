/**
 * REDBUCK – Operating Expenses Engine
 * Centralizes expense calculations, financial metrics, and break-even analysis.
 * Reuses dashboardMetrics and monthlySales from demo-data.
 */

import { dashboardMetrics, monthlySales } from '@/data/demo-data';

// ─── Types ──────────────────────────────────────────────────────
export type ExpenseCategory =
  | 'personal' | 'administracion' | 'ventas' | 'logistica'
  | 'importaciones' | 'financieros' | 'servicio_tecnico'
  | 'legales_contables' | 'otros';

export type ExpenseType = 'fijo' | 'variable';

export type ExpenseArea =
  | 'ventas' | 'administracion' | 'logistica' | 'operaciones'
  | 'direccion' | 'servicio_tecnico' | 'importaciones';

export interface OperatingExpense {
  id: string;
  fecha: string;
  categoria: ExpenseCategory;
  subcategoria: string;
  descripcion: string;
  monto: number;
  tipo: ExpenseType;
  area: ExpenseArea;
  notas?: string;
}

// ─── Category / Subcategory catalog ─────────────────────────────
export const EXPENSE_CATEGORIES: Record<ExpenseCategory, { label: string; subcategories: string[] }> = {
  personal: {
    label: 'Personal',
    subcategories: [
      'Sueldos administrativos', 'Sueldos vendedores', 'Sueldos técnicos',
      'Comisiones', 'Bonos', 'Seguridad social', 'Infonavit',
      'Impuestos de nómina', 'Prestaciones',
    ],
  },
  administracion: {
    label: 'Administración',
    subcategories: [
      'Renta oficina', 'Renta bodega', 'Luz', 'Agua', 'Internet',
      'Telefonía', 'Papelería', 'Limpieza', 'Software / licencias', 'Hosting',
    ],
  },
  ventas: {
    label: 'Ventas',
    subcategories: [
      'Publicidad Meta Ads', 'Publicidad Google Ads', 'Marketing',
      'Comisiones vendedores', 'Viáticos', 'Gasolina vendedores',
      'Comidas con clientes', 'Material promocional',
    ],
  },
  logistica: {
    label: 'Logística',
    subcategories: [
      'Transporte nacional', 'Paquetería', 'Gasolina reparto',
      'Mantenimiento vehículos', 'Seguro vehículos',
    ],
  },
  importaciones: {
    label: 'Importaciones',
    subcategories: [
      'Agente aduanal', 'Maniobras', 'Almacenaje', 'Transporte puerto-bodega',
    ],
  },
  financieros: {
    label: 'Financieros',
    subcategories: [
      'Comisiones bancarias', 'Intereses', 'Terminal bancaria',
    ],
  },
  servicio_tecnico: {
    label: 'Servicio técnico',
    subcategories: [
      'Gasolina técnicos', 'Viáticos técnicos', 'Refacciones servicio', 'Herramientas',
    ],
  },
  legales_contables: {
    label: 'Legales y contables',
    subcategories: ['Contador', 'Asesor fiscal', 'Abogados'],
  },
  otros: {
    label: 'Otros',
    subcategories: [
      'Seguros', 'Mantenimiento instalaciones', 'Seguridad', 'Depreciaciones',
    ],
  },
};

export const AREA_LABELS: Record<ExpenseArea, string> = {
  ventas: 'Ventas',
  administracion: 'Administración',
  logistica: 'Logística',
  operaciones: 'Operaciones',
  direccion: 'Dirección',
  servicio_tecnico: 'Servicio Técnico',
  importaciones: 'Importaciones',
};

export const TYPE_LABELS: Record<ExpenseType, string> = {
  fijo: 'Fijo',
  variable: 'Variable',
};

// ─── Demo expenses ──────────────────────────────────────────────
export const demoExpenses: OperatingExpense[] = [
  { id: 'e1', fecha: '2025-03-01', categoria: 'personal', subcategoria: 'Sueldos administrativos', descripcion: 'Nómina quincenal admon', monto: 45000, tipo: 'fijo', area: 'administracion' },
  { id: 'e2', fecha: '2025-03-01', categoria: 'personal', subcategoria: 'Sueldos vendedores', descripcion: 'Nómina quincenal vendedores', monto: 62000, tipo: 'fijo', area: 'ventas' },
  { id: 'e3', fecha: '2025-03-01', categoria: 'personal', subcategoria: 'Sueldos técnicos', descripcion: 'Nómina quincenal técnicos', monto: 28000, tipo: 'fijo', area: 'servicio_tecnico' },
  { id: 'e4', fecha: '2025-03-01', categoria: 'personal', subcategoria: 'Seguridad social', descripcion: 'IMSS mensual', monto: 18500, tipo: 'fijo', area: 'administracion' },
  { id: 'e5', fecha: '2025-03-01', categoria: 'personal', subcategoria: 'Infonavit', descripcion: 'Aportación Infonavit', monto: 8200, tipo: 'fijo', area: 'administracion' },
  { id: 'e6', fecha: '2025-03-01', categoria: 'personal', subcategoria: 'Comisiones', descripcion: 'Comisiones vendedores marzo', monto: 35000, tipo: 'variable', area: 'ventas' },
  { id: 'e7', fecha: '2025-03-02', categoria: 'administracion', subcategoria: 'Renta oficina', descripcion: 'Renta oficina Mty', monto: 25000, tipo: 'fijo', area: 'administracion' },
  { id: 'e8', fecha: '2025-03-02', categoria: 'administracion', subcategoria: 'Renta bodega', descripcion: 'Renta bodega principal', monto: 35000, tipo: 'fijo', area: 'logistica' },
  { id: 'e9', fecha: '2025-03-03', categoria: 'administracion', subcategoria: 'Luz', descripcion: 'CFE oficina + bodega', monto: 12000, tipo: 'variable', area: 'administracion' },
  { id: 'e10', fecha: '2025-03-03', categoria: 'administracion', subcategoria: 'Internet', descripcion: 'Internet y telefonía', monto: 3500, tipo: 'fijo', area: 'administracion' },
  { id: 'e11', fecha: '2025-03-04', categoria: 'administracion', subcategoria: 'Software / licencias', descripcion: 'CRM, contabilidad, Office', monto: 4500, tipo: 'fijo', area: 'administracion' },
  { id: 'e12', fecha: '2025-03-05', categoria: 'ventas', subcategoria: 'Publicidad Meta Ads', descripcion: 'Campaña Meta marzo', monto: 15000, tipo: 'variable', area: 'ventas' },
  { id: 'e13', fecha: '2025-03-05', categoria: 'ventas', subcategoria: 'Publicidad Google Ads', descripcion: 'Google Ads marzo', monto: 8000, tipo: 'variable', area: 'ventas' },
  { id: 'e14', fecha: '2025-03-06', categoria: 'ventas', subcategoria: 'Gasolina vendedores', descripcion: 'Gasolina equipo ventas', monto: 6500, tipo: 'variable', area: 'ventas' },
  { id: 'e15', fecha: '2025-03-07', categoria: 'ventas', subcategoria: 'Viáticos', descripcion: 'Viáticos viaje GDL', monto: 4200, tipo: 'variable', area: 'ventas' },
  { id: 'e16', fecha: '2025-03-08', categoria: 'logistica', subcategoria: 'Transporte nacional', descripcion: 'Fletes entregas marzo', monto: 18000, tipo: 'variable', area: 'logistica' },
  { id: 'e17', fecha: '2025-03-08', categoria: 'logistica', subcategoria: 'Gasolina reparto', descripcion: 'Gasolina camionetas reparto', monto: 5500, tipo: 'variable', area: 'logistica' },
  { id: 'e18', fecha: '2025-03-09', categoria: 'logistica', subcategoria: 'Mantenimiento vehículos', descripcion: 'Servicio camioneta #2', monto: 3800, tipo: 'variable', area: 'logistica' },
  { id: 'e19', fecha: '2025-03-10', categoria: 'importaciones', subcategoria: 'Agente aduanal', descripcion: 'Honorarios agente aduanal', monto: 12000, tipo: 'variable', area: 'importaciones' },
  { id: 'e20', fecha: '2025-03-10', categoria: 'importaciones', subcategoria: 'Maniobras', descripcion: 'Maniobras contenedor', monto: 4500, tipo: 'variable', area: 'importaciones' },
  { id: 'e21', fecha: '2025-03-11', categoria: 'financieros', subcategoria: 'Comisiones bancarias', descripcion: 'Comisiones bancarias marzo', monto: 2800, tipo: 'variable', area: 'administracion' },
  { id: 'e22', fecha: '2025-03-11', categoria: 'financieros', subcategoria: 'Terminal bancaria', descripcion: 'Comisión terminal TPV', monto: 3200, tipo: 'variable', area: 'administracion' },
  { id: 'e23', fecha: '2025-03-12', categoria: 'servicio_tecnico', subcategoria: 'Gasolina técnicos', descripcion: 'Gasolina equipo técnico', monto: 3500, tipo: 'variable', area: 'servicio_tecnico' },
  { id: 'e24', fecha: '2025-03-12', categoria: 'servicio_tecnico', subcategoria: 'Refacciones servicio', descripcion: 'Refacciones garantías', monto: 5200, tipo: 'variable', area: 'servicio_tecnico' },
  { id: 'e25', fecha: '2025-03-13', categoria: 'legales_contables', subcategoria: 'Contador', descripcion: 'Honorarios contador', monto: 8000, tipo: 'fijo', area: 'administracion' },
  { id: 'e26', fecha: '2025-03-14', categoria: 'otros', subcategoria: 'Seguros', descripcion: 'Seguro mercancía + vehículos', monto: 6500, tipo: 'fijo', area: 'administracion' },
  { id: 'e27', fecha: '2025-03-15', categoria: 'personal', subcategoria: 'Sueldos administrativos', descripcion: 'Nómina 2da quincena admon', monto: 45000, tipo: 'fijo', area: 'administracion' },
  { id: 'e28', fecha: '2025-03-15', categoria: 'personal', subcategoria: 'Sueldos vendedores', descripcion: 'Nómina 2da quincena vendedores', monto: 62000, tipo: 'fijo', area: 'ventas' },
  { id: 'e29', fecha: '2025-03-15', categoria: 'personal', subcategoria: 'Sueldos técnicos', descripcion: 'Nómina 2da quincena técnicos', monto: 28000, tipo: 'fijo', area: 'servicio_tecnico' },
  { id: 'e30', fecha: '2025-03-16', categoria: 'administracion', subcategoria: 'Limpieza', descripcion: 'Servicio limpieza mensual', monto: 3000, tipo: 'fijo', area: 'administracion' },
];

// ─── Calculation helpers ────────────────────────────────────────
const sum = (arr: number[]) => arr.reduce((a, b) => a + b, 0);

export interface ExpenseSummary {
  totalMensual: number;
  totalAnual: number;
  promedioMensual: number;
  gastoDiario: number;
  gastosFijos: number;
  gastosVariables: number;
  byCategory: { category: string; label: string; total: number; pct: number }[];
  byArea: { area: string; label: string; total: number; pct: number }[];
  byMonth: { month: string; total: number }[];
  top10: OperatingExpense[];
}

export interface FinancialMetrics {
  ventasMes: number;
  costoProductos: number;
  utilidadBruta: number;
  gastoOperativo: number;
  utilidadNeta: number;
  margenBruto: number;
  margenNeto: number;
  costoOperativoPorVenta: number;
  ratioGastoOperativo: number;
  puntoEquilibrio: number;
  gastoDiario: number;
  ventasNecesariasDiarias: number;
}

export function calculateExpenseSummary(expenses: OperatingExpense[]): ExpenseSummary {
  const totalMensual = sum(expenses.map(e => e.monto));
  const totalAnual = totalMensual * 12;
  const promedioMensual = totalMensual;
  const gastoDiario = totalMensual / 30;

  const gastosFijos = sum(expenses.filter(e => e.tipo === 'fijo').map(e => e.monto));
  const gastosVariables = sum(expenses.filter(e => e.tipo === 'variable').map(e => e.monto));

  // By category
  const catMap = new Map<string, number>();
  expenses.forEach(e => catMap.set(e.categoria, (catMap.get(e.categoria) || 0) + e.monto));
  const byCategory = Array.from(catMap.entries())
    .map(([category, total]) => ({
      category,
      label: EXPENSE_CATEGORIES[category as ExpenseCategory]?.label || category,
      total,
      pct: totalMensual > 0 ? (total / totalMensual) * 100 : 0,
    }))
    .sort((a, b) => b.total - a.total);

  // By area
  const areaMap = new Map<string, number>();
  expenses.forEach(e => areaMap.set(e.area, (areaMap.get(e.area) || 0) + e.monto));
  const byArea = Array.from(areaMap.entries())
    .map(([area, total]) => ({
      area,
      label: AREA_LABELS[area as ExpenseArea] || area,
      total,
      pct: totalMensual > 0 ? (total / totalMensual) * 100 : 0,
    }))
    .sort((a, b) => b.total - a.total);

  // By month (from monthlySales months as reference)
  const byMonth = monthlySales.slice(-6).map(m => ({
    month: m.month,
    total: totalMensual * (0.85 + Math.random() * 0.3), // simulated variation
  }));
  byMonth[byMonth.length - 1] = { month: byMonth[byMonth.length - 1].month, total: totalMensual };

  // Top 10
  const top10 = [...expenses].sort((a, b) => b.monto - a.monto).slice(0, 10);

  return { totalMensual, totalAnual, promedioMensual, gastoDiario, gastosFijos, gastosVariables, byCategory, byArea, byMonth, top10 };
}

export function calculateFinancialMetrics(expenses: OperatingExpense[]): FinancialMetrics {
  const ventasMes = dashboardMetrics.salesMonth;
  const margenBrutoPct = dashboardMetrics.grossMargin / 100;
  const costoProductos = ventasMes * (1 - margenBrutoPct);
  const utilidadBruta = ventasMes - costoProductos;
  const gastoOperativo = sum(expenses.map(e => e.monto));
  const utilidadNeta = utilidadBruta - gastoOperativo;
  const margenBruto = margenBrutoPct * 100;
  const margenNeto = ventasMes > 0 ? (utilidadNeta / ventasMes) * 100 : 0;

  // Number of sales this month (approximate from orders data)
  const numVentas = Math.round(ventasMes / dashboardMetrics.avgTicket) || 1;
  const costoOperativoPorVenta = gastoOperativo / numVentas;
  const ratioGastoOperativo = ventasMes > 0 ? (gastoOperativo / ventasMes) * 100 : 0;

  // Break-even: how much needs to sell to cover operating expenses
  const puntoEquilibrio = margenBrutoPct > 0 ? gastoOperativo / margenBrutoPct : 0;

  const gastoDiario = gastoOperativo / 30;
  const ventasNecesariasDiarias = puntoEquilibrio / 30;

  return {
    ventasMes, costoProductos, utilidadBruta, gastoOperativo, utilidadNeta,
    margenBruto, margenNeto, costoOperativoPorVenta, ratioGastoOperativo,
    puntoEquilibrio, gastoDiario, ventasNecesariasDiarias,
  };
}
