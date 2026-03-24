/**
 * Export individual import order to PDF and Excel
 */
import type { ImportOrder } from '@/types';
import { IMPORT_STATUS_LABELS } from '@/types';
import * as XLSX from 'xlsx';
import { saveAs } from 'file-saver';
import { getCompanyLogoUrl } from '@/hooks/useCompanyLogo';

const fmtUSD = (n: number) =>
  new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 2 }).format(n);

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
  return { subtotalGastos, ivaGastos, ivaProducto, ivaTotal, totalImportacion, costoPorContenedor, costoPorCbm, costoPorKg };
}

// ─── PDF ────────────────────────────────────────────────────────────

export function exportImportPdf(imp: ImportOrder) {
  const fin = calcFinancials(imp);
  const expenses = expenseRows(imp.expenses);
  const logoUrl = getCompanyLogoUrl();
  const pw = window.open('', '_blank');
  if (!pw) return;

  const today = new Date().toLocaleDateString('es-MX', { day: '2-digit', month: 'long', year: 'numeric' });

  const productsHtml = imp.items.map((it: any) => `
    <tr>
      <td>${it.sku || '—'}</td>
      <td>${it.productName}</td>
      <td style="text-align:right">${it.qty}</td>
      <td style="text-align:right">${fmtUSD(it.unitCost)}</td>
      <td style="text-align:right">${fmtUSD(it.qty * it.unitCost)}</td>
      <td style="text-align:right">${it.cbm || '—'}</td>
      <td style="text-align:right">${it.peso || '—'}</td>
    </tr>`).join('');

  let currentGroup = '';
  const expensesHtml = expenses.map(e => {
    let groupRow = '';
    if (e.grupo !== currentGroup) {
      currentGroup = e.grupo;
      groupRow = `<tr><td colspan="2" style="background:#f0f0f0;font-weight:700;padding:6px 10px;font-size:10px;text-transform:uppercase;letter-spacing:0.5px;">${e.grupo}</td></tr>`;
    }
    return groupRow + `<tr><td style="padding-left:20px">${e.concepto}</td><td style="text-align:right">${fmtUSD(e.monto)}</td></tr>`;
  }).join('');

  const summaryRows = [
    ['Valor pedido China (FOB)', fmtUSD(imp.totalCost)],
    ['Subtotal gastos importación', fmtUSD(fin.subtotalGastos)],
    ['IVA gastos importación (16%)', fmtUSD(fin.ivaGastos)],
    ['IVA producto (16%)', fmtUSD(fin.ivaProducto)],
    ['IVA total', fmtUSD(fin.ivaTotal)],
  ].map(([l, v]) => `<tr><td>${l}</td><td style="text-align:right">${v}</td></tr>`).join('');

  const metricsHtml = [
    ['Costo por contenedor', fmtUSD(fin.costoPorContenedor)],
    ['Costo por CBM', fmtUSD(fin.costoPorCbm)],
    ['Costo por kg', fmtUSD(fin.costoPorKg)],
  ].map(([l, v]) => `
    <div style="background:#f5f5f5;padding:12px 16px;border-radius:8px;text-align:center;flex:1;">
      <div style="font-size:9px;color:#666;text-transform:uppercase;letter-spacing:0.5px;">${l}</div>
      <div style="font-size:15px;font-weight:700;margin-top:4px;">${v}</div>
    </div>`).join('');

  pw.document.write(`<!DOCTYPE html><html><head><title>Importación ${imp.orderNumber}</title>
<style>
*{margin:0;padding:0;box-sizing:border-box}
body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;padding:30px;color:#1a1a1a;font-size:11px}
.header{display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:20px;border-bottom:3px solid #c41e2a;padding-bottom:12px}
.brand{font-size:18px;font-weight:800;color:#c41e2a;letter-spacing:1px}
.logo{max-height:50px;object-fit:contain}
h2{font-size:13px;font-weight:700;margin:18px 0 8px;color:#c41e2a;text-transform:uppercase;letter-spacing:0.5px;border-bottom:1px solid #e0e0e0;padding-bottom:4px}
table{width:100%;border-collapse:collapse;margin-bottom:12px}
th{background:#1a1a1a;color:#fff;font-size:9px;text-transform:uppercase;letter-spacing:0.5px;padding:6px 10px;text-align:left}
td{padding:5px 10px;border-bottom:1px solid #eee;font-size:10px}
.total-row{background:#c41e2a;color:#fff;font-weight:700}
.total-row td{padding:8px 10px;font-size:12px}
.info-grid{display:grid;grid-template-columns:1fr 1fr 1fr;gap:8px;margin-bottom:16px}
.info-item{background:#f9f9f9;padding:8px 12px;border-radius:6px}
.info-label{font-size:9px;color:#888;text-transform:uppercase}
.info-value{font-size:11px;font-weight:600;margin-top:2px}
.metrics{display:flex;gap:10px;margin-top:8px}
.footer{margin-top:24px;border-top:1px solid #ddd;padding-top:8px;font-size:9px;color:#888;text-align:center}
@media print{body{padding:15px}@page{margin:10mm}}
</style></head><body>
<div class="header">
  <div>
    ${logoUrl ? `<img src="${logoUrl}" class="logo" />` : '<div class="brand">REDBUCK</div>'}
    <div style="font-size:10px;color:#666;margin-top:4px">Reporte de Importación</div>
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
  <thead><tr><th>SKU</th><th>Producto</th><th style="text-align:right">Qty</th><th style="text-align:right">Costo Unit.</th><th style="text-align:right">Costo Total</th><th style="text-align:right">CBM</th><th style="text-align:right">Peso</th></tr></thead>
  <tbody>${productsHtml}
    <tr class="total-row"><td colspan="4">TOTAL FOB</td><td style="text-align:right">${fmtUSD(imp.totalCost)}</td><td></td><td></td></tr>
  </tbody>
</table>

<h2>Gastos Desglosados</h2>
<table>
  <thead><tr><th>Concepto</th><th style="text-align:right">Monto (USD)</th></tr></thead>
  <tbody>${expensesHtml}
    <tr class="total-row"><td>SUBTOTAL GASTOS</td><td style="text-align:right">${fmtUSD(fin.subtotalGastos)}</td></tr>
  </tbody>
</table>

<h2>Resumen Financiero</h2>
<table>
  <tbody>${summaryRows}
    <tr class="total-row"><td>TOTAL IMPORTACIÓN</td><td style="text-align:right">${fmtUSD(fin.totalImportacion)}</td></tr>
  </tbody>
</table>

<h2>Métricas</h2>
<div class="metrics">${metricsHtml}</div>

<div class="footer">Generado el ${today} · REDBUCK ERP</div>
</body></html>`);

  pw.document.close();
  setTimeout(() => { pw.print(); }, 500);
}

// ─── Excel ──────────────────────────────────────────────────────────

export function exportImportExcel(imp: ImportOrder) {
  const fin = calcFinancials(imp);
  const wb = XLSX.utils.book_new();

  // Sheet 1: Resumen
  const resumenData = [
    ['REPORTE DE IMPORTACIÓN', '', ''],
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
    ['MÉTRICAS'],
    ['Costo por contenedor', fin.costoPorContenedor],
    ['Costo por CBM', fin.costoPorCbm],
    ['Costo por kg', fin.costoPorKg],
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

  // Sheet 3: Gastos
  const expRows = expenseRows(imp.expenses);
  const gastosHeaders = ['Grupo', 'Concepto', 'Monto (USD)'];
  const gastosData = expRows.map(e => [e.grupo, e.concepto, e.monto]);
  gastosData.push(['', 'SUBTOTAL GASTOS', fin.subtotalGastos]);
  gastosData.push(['', 'IVA GASTOS (16%)', fin.ivaGastos]);
  gastosData.push(['', 'IVA PRODUCTO (16%)', fin.ivaProducto]);
  gastosData.push(['', 'TOTAL IMPORTACIÓN', fin.totalImportacion]);
  const ws3 = XLSX.utils.aoa_to_sheet([gastosHeaders, ...gastosData]);
  ws3['!cols'] = [{ wch: 22 }, { wch: 30 }, { wch: 18 }];
  XLSX.utils.book_append_sheet(wb, ws3, 'Gastos');

  const buf = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
  const fileName = `IMPORTACION_${imp.orderNumber}_${imp.purchaseDate}.xlsx`;
  saveAs(new Blob([buf], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }), fileName);
}
