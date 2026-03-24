/**
 * Export individual import order to PDF and Excel
 * Includes: general data, products, detailed expenses, financial summary,
 * metrics, and full landed-cost costing per product.
 */
import type { ImportOrder } from '@/types';
import { IMPORT_STATUS_LABELS } from '@/types';
import {
  calculateImportCosting,
  DEFAULT_COSTING_PARAMS,
  type CostingParams,
} from '@/lib/importCostingEngine';
import * as XLSX from 'xlsx';
import { saveAs } from 'file-saver';
import { getCompanyLogoUrl } from '@/hooks/useCompanyLogo';

const fmtUSD = (n: number) =>
  new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 2 }).format(n);
const fmtPct = (n: number) => `${(n * 100).toFixed(1)}%`;

// ─── Shared helpers ─────────────────────────────────────────────────

function expenseRows(exp: ImportOrder['expenses']) {
  return [
    { concepto: 'Flete local China', monto: exp.fleteLocalChina, grupo: 'Logística Internacional' },
    { concepto: 'Flete internacional marítimo', monto: exp.fleteInternacionalMaritimo, grupo: 'Logística Internacional' },
    { concepto: 'IGI', monto: exp.igi, grupo: 'Aduana e Impuestos' },
    { concepto: 'DTA', monto: exp.dta, grupo: 'Aduana e Impuestos' },
    { concepto: 'Prevalidación', monto: exp.prevalidacion, grupo: 'Aduana e Impuestos' },
    { concepto: 'Gastos locales naviera', monto: exp.gastosLocalesNaviera, grupo: 'Puerto / Naviera' },
    { concepto: 'Maniobras puerto', monto: exp.maniobrasPuerto, grupo: 'Puerto / Naviera' },
    { concepto: 'Seguro', monto: exp.seguro, grupo: 'Servicios' },
    { concepto: 'Honorarios despacho aduanal', monto: exp.honorariosDespachoAduanal, grupo: 'Servicios' },
    { concepto: 'Comercializadora', monto: exp.comercializadora, grupo: 'Servicios' },
    { concepto: 'Flete terrestre GDL', monto: exp.fleteTerrestreGdl, grupo: 'Logística Nacional' },
  ];
}

function calcFinancials(imp: ImportOrder) {
  const subtotalGastos = Object.values(imp.expenses).reduce((s, v) => s + (Number(v) || 0), 0);
  const ivaGastos = subtotalGastos * 0.16;
  const ivaProducto = imp.totalCost * 0.16;
  const ivaTotal = ivaGastos + ivaProducto;
  const totalImportacion = imp.totalCost + subtotalGastos + ivaTotal;
  const costoPorContenedor = imp.numeroContenedores > 0 ? totalImportacion / imp.numeroContenedores : 0;
  const costoPorCbm = imp.volumenTotalCbm > 0 ? totalImportacion / imp.volumenTotalCbm : 0;
  const costoPorKg = imp.pesoTotalKg > 0 ? totalImportacion / imp.pesoTotalKg : 0;
  const totalQty = imp.items.reduce((s: number, it: any) => s + (it.qty || 0), 0);
  const costoPorProducto = totalQty > 0 ? totalImportacion / totalQty : 0;
  return { subtotalGastos, ivaGastos, ivaProducto, ivaTotal, totalImportacion, costoPorContenedor, costoPorCbm, costoPorKg, costoPorProducto };
}

function buildCostingData(imp: ImportOrder, params: CostingParams = DEFAULT_COSTING_PARAMS) {
  const importExpenses = (imp.freightCost || 0) + (imp.customsCost || 0);
  const costingItems = imp.items.map((it: any) => ({
    productName: it.productName || '',
    qty: it.qty || 0,
    unitCost: it.unitCost || 0,
  }));
  const costing = calculateImportCosting(costingItems, importExpenses, params);

  return costing.items.map(it => {
    const unitLandedSinIva = it.unitLanded / (1 + params.ivaRate);
    const precioSinIva = unitLandedSinIva * params.markupFactor;
    const precioConIva = precioSinIva * (1 + params.ivaRate);
    const comision = precioSinIva * params.commissionRate;
    const admin = precioSinIva * params.adminRate;
    const netMargin = precioSinIva - unitLandedSinIva - comision - admin;
    const marginPct = precioSinIva > 0 ? netMargin / precioSinIva : 0;
    return { ...it, unitLandedSinIva, precioSinIva, precioConIva, comision, admin, netMargin, marginPct };
  });
}

// ─── PDF ────────────────────────────────────────────────────────────

export function exportImportPdf(imp: ImportOrder) {
  const fin = calcFinancials(imp);
  const expenses = expenseRows(imp.expenses);
  const costingRows = buildCostingData(imp);
  const logoUrl = getCompanyLogoUrl();
  const pw = window.open('', '_blank');
  if (!pw) return;

  const today = new Date().toLocaleDateString('es-MX', { day: '2-digit', month: 'long', year: 'numeric' });

  // Products table
  const productsHtml = imp.items.map((it: any) => `
    <tr>
      <td>${it.sku || '—'}</td>
      <td>${it.productName}</td>
      <td class="r">${it.qty}</td>
      <td class="r">${fmtUSD(it.unitCost)}</td>
      <td class="r">${fmtUSD(it.qty * it.unitCost)}</td>
      <td class="r">${it.cbm || '—'}</td>
      <td class="r">${it.peso || '—'}</td>
    </tr>`).join('');

  // Expenses grouped
  let currentGroup = '';
  const expensesHtml = expenses.map(e => {
    let groupRow = '';
    if (e.grupo !== currentGroup) {
      currentGroup = e.grupo;
      groupRow = `<tr><td colspan="2" style="background:#f0f0f0;font-weight:700;padding:6px 10px;font-size:10px;text-transform:uppercase;letter-spacing:0.5px;">${e.grupo}</td></tr>`;
    }
    return groupRow + `<tr><td style="padding-left:20px">${e.concepto}</td><td class="r">${fmtUSD(e.monto)}</td></tr>`;
  }).join('');

  // Financial summary rows
  const summaryRows = [
    ['Valor pedido China (FOB)', fmtUSD(imp.totalCost)],
    ['Subtotal gastos importación', fmtUSD(fin.subtotalGastos)],
    ['IVA gastos importación (16%)', fmtUSD(fin.ivaGastos)],
    ['IVA producto (16%)', fmtUSD(fin.ivaProducto)],
    ['IVA total', fmtUSD(fin.ivaTotal)],
  ].map(([l, v]) => `<tr><td>${l}</td><td class="r">${v}</td></tr>`).join('');

  // Metrics
  const metricsHtml = [
    ['Costo por contenedor', fmtUSD(fin.costoPorContenedor)],
    ['Costo por CBM', imp.volumenTotalCbm > 0 ? fmtUSD(fin.costoPorCbm) : 'N/A'],
    ['Costo por kg', imp.pesoTotalKg > 0 ? fmtUSD(fin.costoPorKg) : 'N/A'],
    ['Costo por producto (prom.)', fmtUSD(fin.costoPorProducto)],
  ].map(([l, v]) => `
    <div style="background:#f5f5f5;padding:12px 16px;border-radius:8px;text-align:center;flex:1;">
      <div style="font-size:9px;color:#666;text-transform:uppercase;letter-spacing:0.5px;">${l}</div>
      <div style="font-size:15px;font-weight:700;margin-top:4px;">${v}</div>
    </div>`).join('');

  // Costing table (Landed Cost)
  const costingHtml = costingRows.map(it => `
    <tr>
      <td>${it.productName}</td>
      <td class="r">${it.qty}</td>
      <td class="r">${fmtUSD(it.unitCost)}</td>
      <td class="r">${fmtUSD(it.subtotalFob)}</td>
      <td class="r">${fmtPct(it.fobShare)}</td>
      <td class="r">${fmtUSD(it.importExpenseAllocated)}</td>
      <td class="r">${fmtUSD(it.totalLanded)}</td>
      <td class="r" style="color:#c41e2a;font-weight:700">${fmtUSD(it.unitLandedSinIva)}</td>
      <td class="r">${fmtUSD(it.precioSinIva)}</td>
      <td class="r" style="font-weight:700">${fmtUSD(it.precioConIva)}</td>
      <td class="r">${fmtUSD(it.comision)}</td>
      <td class="r">${fmtUSD(it.admin)}</td>
      <td class="r" style="font-weight:700;color:${it.marginPct >= 0.2 ? '#16a34a' : it.marginPct >= 0.1 ? '#ca8a04' : '#dc2626'}">${fmtPct(it.marginPct)}</td>
    </tr>`).join('');

  pw.document.write(`<!DOCTYPE html><html><head><title>Importación ${imp.orderNumber}</title>
<style>
*{margin:0;padding:0;box-sizing:border-box}
body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;padding:30px;color:#1a1a1a;font-size:11px}
.header{display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:20px;border-bottom:3px solid #c41e2a;padding-bottom:12px}
.brand{font-size:18px;font-weight:800;color:#c41e2a;letter-spacing:1px}
.logo{max-height:50px;object-fit:contain}
h2{font-size:13px;font-weight:700;margin:18px 0 8px;color:#c41e2a;text-transform:uppercase;letter-spacing:0.5px;border-bottom:1px solid #e0e0e0;padding-bottom:4px}
table{width:100%;border-collapse:collapse;margin-bottom:12px}
th{background:#1a1a1a;color:#fff;font-size:8px;text-transform:uppercase;letter-spacing:0.5px;padding:5px 6px;text-align:left;white-space:nowrap}
td{padding:4px 6px;border-bottom:1px solid #eee;font-size:9px}
.r{text-align:right}
th.r{text-align:right}
.total-row{background:#c41e2a;color:#fff;font-weight:700}
.total-row td{padding:8px 10px;font-size:11px}
.info-grid{display:grid;grid-template-columns:1fr 1fr 1fr;gap:8px;margin-bottom:16px}
.info-item{background:#f9f9f9;padding:8px 12px;border-radius:6px}
.info-label{font-size:9px;color:#888;text-transform:uppercase}
.info-value{font-size:11px;font-weight:600;margin-top:2px}
.metrics{display:flex;gap:10px;margin-top:8px}
.footer{margin-top:24px;border-top:1px solid #ddd;padding-top:8px;font-size:9px;color:#888;text-align:center}
@media print{body{padding:15px}@page{margin:8mm;size:landscape}}
</style></head><body>
<div class="header">
  <div>
    ${logoUrl ? `<img src="${logoUrl}" class="logo" />` : '<div class="brand">REDBUCK</div>'}
    <div style="font-size:10px;color:#666;margin-top:4px">Reporte Completo de Importación</div>
  </div>
  <div style="text-align:right">
    <div style="font-size:16px;font-weight:800">${imp.orderNumber}</div>
    <div style="font-size:10px;color:#666">${IMPORT_STATUS_LABELS[imp.status] || imp.status}</div>
  </div>
</div>

<h2>Datos Generales</h2>
<div class="info-grid">
  <div class="info-item"><div class="info-label">Proveedor</div><div class="info-value">${imp.supplier}</div></div>
  <div class="info-item"><div class="info-label">País</div><div class="info-value">${imp.country}</div></div>
  <div class="info-item"><div class="info-label">Fecha compra</div><div class="info-value">${imp.purchaseDate}</div></div>
  <div class="info-item"><div class="info-label">Puerto salida</div><div class="info-value">${imp.departurePort || '—'}</div></div>
  <div class="info-item"><div class="info-label">Puerto llegada</div><div class="info-value">${imp.arrivalPort}</div></div>
  <div class="info-item"><div class="info-label">ETA</div><div class="info-value">${imp.estimatedArrival || '—'}</div></div>
  <div class="info-item"><div class="info-label">Tipo cambio</div><div class="info-value">${imp.exchangeRate}</div></div>
  <div class="info-item"><div class="info-label">Contenedores</div><div class="info-value">${imp.numeroContenedores}</div></div>
  <div class="info-item"><div class="info-label">Peso / Volumen</div><div class="info-value">${imp.pesoTotalKg} kg · ${imp.volumenTotalCbm} CBM</div></div>
</div>

<h2>Productos</h2>
<table>
  <thead><tr><th>SKU</th><th>Producto</th><th class="r">Qty</th><th class="r">Costo Unit.</th><th class="r">Costo Total</th><th class="r">CBM</th><th class="r">Peso</th></tr></thead>
  <tbody>${productsHtml}
    <tr class="total-row"><td colspan="4">TOTAL FOB</td><td class="r">${fmtUSD(imp.totalCost)}</td><td></td><td></td></tr>
  </tbody>
</table>

<h2>Gastos Detallados de Importación</h2>
<table>
  <thead><tr><th>Concepto</th><th class="r">Monto (USD)</th></tr></thead>
  <tbody>${expensesHtml}
    <tr class="total-row"><td>SUBTOTAL GASTOS</td><td class="r">${fmtUSD(fin.subtotalGastos)}</td></tr>
  </tbody>
</table>

<h2>Resumen Financiero</h2>
<table>
  <tbody>${summaryRows}
    <tr class="total-row"><td>TOTAL IMPORTACIÓN</td><td class="r">${fmtUSD(fin.totalImportacion)}</td></tr>
  </tbody>
</table>

<h2>Métricas de Análisis</h2>
<div class="metrics">${metricsHtml}</div>

<h2 style="margin-top:20px">Costeo de Importación — Landed Cost por Producto</h2>
<table>
  <thead><tr>
    <th>Producto</th><th class="r">Qty</th><th class="r">FOB unit</th><th class="r">Sub FOB</th>
    <th class="r">% FOB</th><th class="r">Gasto asig.</th><th class="r">Landed total</th>
    <th class="r">Landed unit</th><th class="r">Precio s/IVA</th><th class="r">Precio c/IVA</th>
    <th class="r">Comisión</th><th class="r">G. Admin</th><th class="r">Margen</th>
  </tr></thead>
  <tbody>${costingHtml}</tbody>
</table>

<div class="footer">Generado el ${today} · REDBUCK ERP</div>
</body></html>`);

  pw.document.close();
  setTimeout(() => { pw.print(); }, 500);
}

// ─── Excel ──────────────────────────────────────────────────────────

export function exportImportExcel(imp: ImportOrder) {
  const fin = calcFinancials(imp);
  const costingRows = buildCostingData(imp);
  const wb = XLSX.utils.book_new();

  // Sheet 1: Resumen
  const resumenData = [
    ['REPORTE COMPLETO DE IMPORTACIÓN', '', ''],
    [''],
    ['Orden', imp.orderNumber],
    ['Proveedor', imp.supplier],
    ['País', imp.country],
    ['Puerto salida', imp.departurePort],
    ['Puerto llegada', imp.arrivalPort],
    ['Fecha compra', imp.purchaseDate],
    ['Salida estimada', imp.estimatedDeparture],
    ['ETA llegada', imp.estimatedArrival],
    ['Tipo cambio', imp.exchangeRate],
    ['Estado', IMPORT_STATUS_LABELS[imp.status] || imp.status],
    ['Contenedores', imp.numeroContenedores],
    ['Peso total (kg)', imp.pesoTotalKg],
    ['Volumen total (CBM)', imp.volumenTotalCbm],
    [''],
    ['RESUMEN FINANCIERO'],
    ['Valor pedido China (FOB)', imp.totalCost],
    ['Subtotal gastos importación', fin.subtotalGastos],
    ['IVA gastos importación (16%)', fin.ivaGastos],
    ['IVA producto (16%)', fin.ivaProducto],
    ['IVA total', fin.ivaTotal],
    ['TOTAL IMPORTACIÓN', fin.totalImportacion],
    [''],
    ['MÉTRICAS DE ANÁLISIS'],
    ['Costo por contenedor', fin.costoPorContenedor],
    ['Costo por CBM', imp.volumenTotalCbm > 0 ? fin.costoPorCbm : 'N/A'],
    ['Costo por kg', imp.pesoTotalKg > 0 ? fin.costoPorKg : 'N/A'],
    ['Costo por producto (prom.)', fin.costoPorProducto],
  ];
  const ws1 = XLSX.utils.aoa_to_sheet(resumenData);
  ws1['!cols'] = [{ wch: 30 }, { wch: 20 }, { wch: 15 }];
  XLSX.utils.book_append_sheet(wb, ws1, 'Resumen');

  // Sheet 2: Productos
  const prodHeaders = ['SKU', 'Producto', 'Cantidad', 'Costo Unitario', 'Costo Total', 'CBM', 'Peso'];
  const prodRows = imp.items.map((it: any) => [
    it.sku || '', it.productName, it.qty, it.unitCost, it.qty * it.unitCost, it.cbm || 0, it.peso || 0,
  ]);
  prodRows.push(['', 'TOTAL', '', '', imp.totalCost, '', '']);
  const ws2 = XLSX.utils.aoa_to_sheet([prodHeaders, ...prodRows]);
  ws2['!cols'] = [{ wch: 15 }, { wch: 30 }, { wch: 10 }, { wch: 15 }, { wch: 15 }, { wch: 10 }, { wch: 10 }];
  XLSX.utils.book_append_sheet(wb, ws2, 'Productos');

  // Sheet 3: Gastos Detallados
  const expRows = expenseRows(imp.expenses);
  const gastosHeaders = ['Grupo', 'Concepto', 'Monto (USD)'];
  const gastosData = expRows.map(e => [e.grupo, e.concepto, e.monto]);
  gastosData.push(['', 'SUBTOTAL GASTOS', fin.subtotalGastos]);
  gastosData.push(['', 'IVA GASTOS (16%)', fin.ivaGastos]);
  gastosData.push(['', 'IVA PRODUCTO (16%)', fin.ivaProducto]);
  gastosData.push(['', 'IVA TOTAL', fin.ivaTotal]);
  gastosData.push(['', 'TOTAL IMPORTACIÓN', fin.totalImportacion]);
  const ws3 = XLSX.utils.aoa_to_sheet([gastosHeaders, ...gastosData]);
  ws3['!cols'] = [{ wch: 22 }, { wch: 30 }, { wch: 18 }];
  XLSX.utils.book_append_sheet(wb, ws3, 'Gastos');

  // Sheet 4: Costeo Landed Cost
  const costHeaders = [
    'Producto', 'Qty', 'FOB Unit', 'Subtotal FOB', '% FOB',
    'Gasto Asignado', 'Landed Total', 'Landed Unit (s/IVA)',
    'Precio s/IVA', 'Precio c/IVA', 'Comisión', 'Gasto Admin', 'Margen Neto', 'Margen %',
  ];
  const costData = costingRows.map(it => [
    it.productName, it.qty, it.unitCost, it.subtotalFob, it.fobShare,
    it.importExpenseAllocated, it.totalLanded, it.unitLandedSinIva,
    it.precioSinIva, it.precioConIva, it.comision, it.admin, it.netMargin, it.marginPct,
  ]);
  const ws4 = XLSX.utils.aoa_to_sheet([costHeaders, ...costData]);
  ws4['!cols'] = [
    { wch: 25 }, { wch: 8 }, { wch: 12 }, { wch: 14 }, { wch: 8 },
    { wch: 14 }, { wch: 14 }, { wch: 16 },
    { wch: 14 }, { wch: 14 }, { wch: 12 }, { wch: 12 }, { wch: 12 }, { wch: 10 },
  ];
  XLSX.utils.book_append_sheet(wb, ws4, 'Costeo Landed');

  const buf = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
  const fileName = `IMPORTACION_${imp.orderNumber}_${imp.purchaseDate}.xlsx`;
  saveAs(new Blob([buf], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }), fileName);
}
