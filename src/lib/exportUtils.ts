import * as XLSX from 'xlsx';
import JSZip from 'jszip';
import { saveAs } from 'file-saver';
import { Customer, Quotation, User } from '@/types';
import { numberToWords } from '@/lib/numberToWords';

const fmt = (n: number) => new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN', maximumFractionDigits: 2 }).format(n);

// ─── CRM EXCEL EXPORT ───────────────────────────────────────────────────────

export function exportCRMToExcel(
  customers: Customer[],
  users: User[],
  filename = 'CRM_Redbuck'
) {
  const resolveVendor = (vendorId: string) => {
    const u = users.find(usr => usr.id === vendorId);
    return u ? u.name : vendorId;
  };

  const data = customers.map(c => ({
    'Nombre / Razón Social': c.name,
    'Nombre Comercial': c.tradeName || '',
    'RFC': c.rfc || '',
    'Tipo de Cliente': c.type,
    'Teléfono': c.phone,
    'WhatsApp': c.whatsapp || c.phone,
    'Correo': c.email || '',
    'Ciudad': c.city,
    'Estado': c.state,
    'Vendedor Asignado': resolveVendor(c.vendorId),
    'Origen del Lead': c.source,
    'Prioridad': c.priority,
    'Fecha de Alta': c.createdAt,
  }));

  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.json_to_sheet(data);
  ws['!cols'] = Object.keys(data[0] || {}).map(() => ({ wch: 24 }));
  XLSX.utils.book_append_sheet(wb, ws, 'Clientes');

  const buf = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
  const blob = new Blob([buf], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
  saveAs(blob, `${filename}_${new Date().toISOString().split('T')[0]}.xlsx`);
}

// ─── QUOTATION ZIP EXPORT ────────────────────────────────────────────────────

function sanitizeFilename(s: string): string {
  return s.replace(/[^a-zA-Z0-9áéíóúñÁÉÍÓÚÑ\-_. ]/g, '').replace(/\s+/g, '-');
}

function quotationToText(q: Quotation): string {
  const lines: string[] = [];
  lines.push('═══════════════════════════════════════════════════');
  lines.push('           REDBUCK EQUIPMENT — COTIZACIÓN');
  lines.push('═══════════════════════════════════════════════════');
  lines.push('');
  lines.push(`Folio:     ${q.folio}`);
  lines.push(`Fecha:     ${q.createdAt}`);
  lines.push(`Vigencia:  ${q.validUntil}`);
  lines.push(`Estatus:   ${q.status}`);
  lines.push('');
  lines.push(`Cliente:   ${q.customerName}`);
  lines.push(`Teléfono:  ${q.customerPhone || 'N/A'}`);
  lines.push('');
  lines.push(`Vendedor:  ${q.vendorName}`);
  lines.push(`Tel:       ${q.vendorPhone || 'N/A'}`);
  lines.push(`Email:     ${q.vendorEmail || 'N/A'}`);
  lines.push('');
  lines.push('───────────────────────────────────────────────────');
  lines.push('PRODUCTOS');
  lines.push('───────────────────────────────────────────────────');

  q.items.forEach((item, idx) => {
    const lineTotal = item.qty * item.unitPrice * (1 - (item.discount || 0) / 100);
    lines.push(`${idx + 1}. ${item.productName}`);
    if (item.sku) lines.push(`   SKU: ${item.sku}`);
    lines.push(`   Cantidad: ${item.qty}   P. Unitario: ${fmt(item.unitPrice)}   Subtotal: ${fmt(lineTotal)}`);
    if (item.discount > 0) lines.push(`   Descuento: ${item.discount}%`);
    lines.push('');
  });

  lines.push('───────────────────────────────────────────────────');
  lines.push(`Subtotal:  ${fmt(q.subtotal)}`);
  lines.push(`IVA 16%:   ${fmt(q.tax)}`);
  lines.push(`TOTAL:     ${fmt(q.total)}`);
  lines.push('');
  lines.push(`IMPORTE CON LETRA: ${numberToWords(q.total)}`);
  lines.push('═══════════════════════════════════════════════════');

  return lines.join('\n');
}

function quotationToXlsxSheet(q: Quotation): XLSX.WorkSheet {
  const rows = q.items.map(item => {
    const lineTotal = item.qty * item.unitPrice * (1 - (item.discount || 0) / 100);
    return {
      'SKU': item.sku || '',
      'Producto': item.productName,
      'Cantidad': item.qty,
      'P. Unitario': item.unitPrice,
      'Descuento %': item.discount || 0,
      'Subtotal': lineTotal,
    };
  });

  // Add summary rows
  rows.push({ 'SKU': '', 'Producto': '', 'Cantidad': 0, 'P. Unitario': 0, 'Descuento %': 0, 'Subtotal': 0 });
  rows.push({ 'SKU': '', 'Producto': 'SUBTOTAL', 'Cantidad': 0, 'P. Unitario': 0, 'Descuento %': 0, 'Subtotal': q.subtotal });
  rows.push({ 'SKU': '', 'Producto': 'IVA 16%', 'Cantidad': 0, 'P. Unitario': 0, 'Descuento %': 0, 'Subtotal': q.tax });
  rows.push({ 'SKU': '', 'Producto': 'TOTAL', 'Cantidad': 0, 'P. Unitario': 0, 'Descuento %': 0, 'Subtotal': q.total });

  const ws = XLSX.utils.json_to_sheet(rows);
  ws['!cols'] = [{ wch: 16 }, { wch: 40 }, { wch: 10 }, { wch: 14 }, { wch: 12 }, { wch: 16 }];
  return ws;
}

export interface ZipExportFilters {
  dateFrom: string;
  dateTo: string;
  vendorId?: string;
  status?: string;
  customerId?: string;
}

export async function exportQuotationsZip(
  quotations: Quotation[],
  filters: ZipExportFilters
): Promise<{ count: number }> {
  // Apply filters
  let filtered = quotations;

  if (filters.dateFrom) {
    filtered = filtered.filter(q => q.createdAt >= filters.dateFrom);
  }
  if (filters.dateTo) {
    filtered = filtered.filter(q => q.createdAt <= filters.dateTo);
  }
  if (filters.vendorId) {
    filtered = filtered.filter(q => q.vendorId === filters.vendorId);
  }
  if (filters.status) {
    filtered = filtered.filter(q => q.status === filters.status);
  }
  if (filters.customerId) {
    filtered = filtered.filter(q => q.customerId === filters.customerId);
  }

  if (filtered.length === 0) {
    throw new Error('No hay cotizaciones que coincidan con los filtros seleccionados.');
  }

  const zip = new JSZip();

  // Add each quotation as both TXT and XLSX
  filtered.forEach(q => {
    const customerSlug = sanitizeFilename(q.customerName);
    const baseName = `${q.folio}_${customerSlug}_${q.createdAt}`;

    // Text version (readable, shareable)
    zip.file(`${baseName}.txt`, quotationToText(q));
  });

  // Also add a summary XLSX with all quotations
  const summaryData = filtered.map(q => ({
    'Folio': q.folio,
    'Cliente': q.customerName,
    'Vendedor': q.vendorName,
    'Subtotal': q.subtotal,
    'IVA': q.tax,
    'Total': q.total,
    'Estatus': q.status,
    'Fecha': q.createdAt,
    'Vigencia': q.validUntil,
  }));
  const wb = XLSX.utils.book_new();
  const summaryWs = XLSX.utils.json_to_sheet(summaryData);
  summaryWs['!cols'] = Object.keys(summaryData[0]).map(() => ({ wch: 20 }));
  XLSX.utils.book_append_sheet(wb, summaryWs, 'Resumen');

  // Add individual sheets per quotation
  filtered.forEach(q => {
    const sheetName = q.folio.substring(0, 31); // Excel 31 char limit
    XLSX.utils.book_append_sheet(wb, quotationToXlsxSheet(q), sheetName);
  });

  const xlsxBuf = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
  zip.file('Cotizaciones_Resumen.xlsx', xlsxBuf);

  const zipBlob = await zip.generateAsync({ type: 'blob' });
  const zipName = `Cotizaciones_${filters.dateFrom || 'inicio'}_a_${filters.dateTo || 'fin'}.zip`;
  saveAs(zipBlob, zipName);

  return { count: filtered.length };
}

// ─── QUOTATION EXCEL EXPORT (standalone, no ZIP) ─────────────────────────────

export function exportQuotationsExcel(
  quotations: Quotation[],
  filters: ZipExportFilters
): { count: number } {
  let filtered = quotations;
  if (filters.dateFrom) filtered = filtered.filter(q => q.createdAt >= filters.dateFrom);
  if (filters.dateTo) filtered = filtered.filter(q => q.createdAt <= filters.dateTo);
  if (filters.vendorId) filtered = filtered.filter(q => q.vendorId === filters.vendorId);
  if (filters.status) filtered = filtered.filter(q => q.status === filters.status);

  if (filtered.length === 0) {
    throw new Error('No hay cotizaciones que coincidan con los filtros seleccionados.');
  }

  const wb = XLSX.utils.book_new();

  // Sheet 1: Resumen
  const summaryData = filtered.map(q => ({
    'Folio': q.folio,
    'Cliente': q.customerName,
    'Teléfono': q.customerPhone || '',
    'Vendedor': q.vendorName,
    'Productos': q.items.map(i => `${i.productName} x${i.qty}`).join(', '),
    'Subtotal': q.subtotal,
    'IVA': q.tax,
    'Total': q.total,
    'Estatus': q.status,
    'Fecha': q.createdAt,
    'Vigencia': q.validUntil,
  }));
  const summaryWs = XLSX.utils.json_to_sheet(summaryData);
  summaryWs['!cols'] = [
    { wch: 14 }, { wch: 30 }, { wch: 16 }, { wch: 22 }, { wch: 50 },
    { wch: 14 }, { wch: 14 }, { wch: 14 }, { wch: 12 }, { wch: 12 }, { wch: 12 },
  ];
  XLSX.utils.book_append_sheet(wb, summaryWs, 'Resumen');

  // Sheet 2: Detalle de productos
  const detailRows: Record<string, unknown>[] = [];
  filtered.forEach(q => {
    q.items.forEach(item => {
      const lineTotal = item.qty * item.unitPrice * (1 - (item.discount || 0) / 100);
      detailRows.push({
        'Folio': q.folio,
        'Fecha': q.createdAt,
        'Cliente': q.customerName,
        'Vendedor': q.vendorName,
        'SKU': item.sku || '',
        'Producto': item.productName,
        'Cantidad': item.qty,
        'P. Unitario': item.unitPrice,
        'Descuento %': item.discount || 0,
        'Subtotal Línea': lineTotal,
        'Estatus': q.status,
      });
    });
  });
  const detailWs = XLSX.utils.json_to_sheet(detailRows);
  detailWs['!cols'] = [
    { wch: 14 }, { wch: 12 }, { wch: 28 }, { wch: 20 }, { wch: 16 },
    { wch: 36 }, { wch: 10 }, { wch: 14 }, { wch: 12 }, { wch: 14 }, { wch: 12 },
  ];
  XLSX.utils.book_append_sheet(wb, detailWs, 'Detalle Productos');

  const buf = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
  const blob = new Blob([buf], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
  const name = `Cotizaciones_${filters.dateFrom || 'inicio'}_a_${filters.dateTo || 'fin'}.xlsx`;
  saveAs(blob, name);

  return { count: filtered.length };
}
