/**
 * Full Report Export — generates comprehensive PDF/Excel with all on-screen data
 * KPIs, summary cards, charts data, detail tables — everything the user sees.
 */

import { getCompanyLogoUrl } from '@/hooks/useCompanyLogo';

const fmt = (n: number) =>
  new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN', maximumFractionDigits: 0 }).format(n);

// ─── Types ──────────────────────────────────────────────────────
export interface KpiItem {
  label: string;
  value: string | number;
  sub?: string;
  color?: 'primary' | 'success' | 'warning' | 'destructive' | 'info';
}

export interface TableSection {
  title: string;
  headers: string[];
  rows: (string | number)[][];
  totalsRow?: (string | number)[];
}

export interface FullReportConfig {
  title: string;
  subtitle?: string;
  filename: string;
  kpis?: KpiItem[];
  sections: TableSection[];
}

// ─── Color map ─────────────────────────────────────────────────
const COLOR_MAP: Record<string, string> = {
  primary: '#c41e2a',
  success: '#16a34a',
  warning: '#d97706',
  destructive: '#dc2626',
  info: '#2563eb',
};

// ─── EXCEL ──────────────────────────────────────────────────────
export function exportFullExcel(config: FullReportConfig) {
  import('xlsx').then(XLSX => {
    const wb = XLSX.utils.book_new();

    // Sheet 1: KPIs summary (if provided)
    if (config.kpis && config.kpis.length > 0) {
      const kpiRows = config.kpis.map(k => ({
        Indicador: k.label,
        Valor: k.value,
        ...(k.sub ? { Detalle: k.sub } : {}),
      }));
      kpiRows.unshift({ Indicador: 'Reporte', Valor: config.title } as any);
      if (config.subtitle) kpiRows.splice(1, 0, { Indicador: 'Periodo', Valor: config.subtitle } as any);
      kpiRows.splice(config.subtitle ? 2 : 1, 0, { Indicador: 'Generado', Valor: new Date().toLocaleString('es-MX') } as any);
      XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(kpiRows), 'Resumen KPIs');
    }

    // One sheet per section
    config.sections.forEach((section, idx) => {
      const sheetData: Record<string, any>[] = section.rows.map(row => {
        const obj: Record<string, any> = {};
        section.headers.forEach((h, i) => { obj[h] = row[i]; });
        return obj;
      });
      if (section.totalsRow) {
        const totObj: Record<string, any> = {};
        section.headers.forEach((h, i) => { totObj[h] = section.totalsRow![i] ?? ''; });
        sheetData.push(totObj);
      }
      // Limit sheet name to 31 chars
      const sheetName = section.title.substring(0, 31);
      XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(sheetData), sheetName);
    });

    XLSX.writeFile(wb, `${config.filename}.xlsx`);
  });
}

// ─── PDF ────────────────────────────────────────────────────────
export function exportFullPdf(config: FullReportConfig) {
  const printWindow = window.open('', '_blank');
  if (!printWindow) return;

  // KPI cards
  const kpiHtml = config.kpis && config.kpis.length > 0 ? `
    <div style="display:flex;gap:10px;margin-bottom:20px;flex-wrap:wrap;">
      ${config.kpis.map(k => {
        const borderColor = COLOR_MAP[k.color || 'primary'] || '#c41e2a';
        return `
        <div style="background:#f8f8f8;padding:10px 16px;border-radius:8px;text-align:center;min-width:100px;flex:1;border-left:3px solid ${borderColor};">
          <div style="font-size:9px;color:#666;text-transform:uppercase;letter-spacing:0.5px;">${k.label}</div>
          <div style="font-size:14px;font-weight:700;margin-top:3px;color:${borderColor};">${k.value}</div>
          ${k.sub ? `<div style="font-size:9px;color:#888;margin-top:1px;">${k.sub}</div>` : ''}
        </div>`;
      }).join('')}
    </div>
  ` : '';

  // Build sections
  const sectionsHtml = config.sections.map(section => {
    const headerCells = section.headers.map(h =>
      `<th style="text-align:${h === section.headers[0] ? 'left' : 'right'};font-size:8px;padding:4px 6px;background:#f0f0f0;border-bottom:2px solid #ddd;text-transform:uppercase;letter-spacing:0.3px;">${h}</th>`
    ).join('');

    const bodyRows = section.rows.map(row =>
      `<tr>${row.map((cell, i) =>
        `<td style="font-size:10px;padding:4px 6px;border-bottom:1px solid #eee;text-align:${i === 0 ? 'left' : 'right'};">${cell}</td>`
      ).join('')}</tr>`
    ).join('');

    const totalsHtml = section.totalsRow ? `
      <tr style="background:#f0f0f0;font-weight:700;">
        ${section.totalsRow.map((cell, i) =>
          `<td style="font-size:10px;padding:5px 6px;border-top:2px solid #ccc;text-align:${i === 0 ? 'left' : 'right'};">${cell}</td>`
        ).join('')}
      </tr>
    ` : '';

    return `
      <div style="margin-top:20px;page-break-inside:avoid;">
        <h3 style="font-size:12px;font-weight:700;margin-bottom:8px;border-bottom:1px solid #ddd;padding-bottom:4px;">${section.title}</h3>
        <table style="width:100%;border-collapse:collapse;">
          <thead><tr>${headerCells}</tr></thead>
          <tbody>${bodyRows}${totalsHtml}</tbody>
        </table>
      </div>
    `;
  }).join('');

  printWindow.document.write(`
    <!DOCTYPE html>
    <html>
    <head>
      <title>${config.filename}</title>
      <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; padding: 24px; color: #1a1a1a; font-size: 11px; }
        .header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 20px; border-bottom: 3px solid #c41e2a; padding-bottom: 12px; }
        .brand { font-size: 18px; font-weight: 800; color: #c41e2a; letter-spacing: 1px; }
        .brand-sub { font-size: 9px; color: #666; letter-spacing: 2px; }
        .footer { margin-top: 30px; padding-top: 10px; border-top: 1px solid #ddd; font-size: 9px; color: #999; display: flex; justify-content: space-between; }
        @media print { body { padding: 12px; } @page { size: landscape; margin: 8mm; } }
      </style>
    </head>
    <body>
      <div class="header">
        <div style="display:flex;align-items:center;gap:12px;">
          <img src="${getCompanyLogoUrl()}" alt="Logo" style="height:36px;max-width:120px;object-fit:contain;" onerror="this.style.display='none'" />
          <div>
            <div class="brand">REDBUCK EQUIPMENT</div>
            <div class="brand-sub">ERP · CRM · SISTEMA INTEGRAL</div>
          </div>
        </div>
        <div style="text-align:right;">
          <div style="font-size:15px;font-weight:700;">${config.title}</div>
          ${config.subtitle ? `<div style="font-size:10px;color:#666;">${config.subtitle}</div>` : ''}
          <div style="font-size:9px;color:#999;margin-top:2px;">Generado: ${new Date().toLocaleString('es-MX')}</div>
        </div>
      </div>
      ${kpiHtml}
      ${sectionsHtml}
      <div class="footer">
        <span>REDBUCK EQUIPMENT — Reporte confidencial</span>
        <span>${new Date().toLocaleString('es-MX')}</span>
      </div>
      <script>setTimeout(() => { window.print(); }, 500);</script>
    </body>
    </html>
  `);
  printWindow.document.close();
}
