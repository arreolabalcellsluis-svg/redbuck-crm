/**
 * PDF Export utility using browser print API
 * Generates a printable HTML document and triggers download
 */

import { getCompanyLogoUrl } from '@/hooks/useCompanyLogo';

const fmt = (n: number) => new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN', maximumFractionDigits: 0 }).format(n);

interface PdfExportOptions {
  title: string;
  subtitle?: string;
  filename: string;
  headers: string[];
  rows: (string | number)[][];
  summary?: { label: string; value: string }[];
}

export function exportToPdf({ title, subtitle, filename, headers, rows, summary }: PdfExportOptions) {
  const printWindow = window.open('', '_blank');
  if (!printWindow) return;

  const summaryHtml = summary ? `
    <div style="display:flex;gap:16px;margin-bottom:20px;flex-wrap:wrap;">
      ${summary.map(s => `
        <div style="background:#f5f5f5;padding:12px 20px;border-radius:8px;text-align:center;min-width:120px;">
          <div style="font-size:10px;color:#666;text-transform:uppercase;">${s.label}</div>
          <div style="font-size:16px;font-weight:700;margin-top:4px;">${s.value}</div>
        </div>
      `).join('')}
    </div>
  ` : '';

  const tableHtml = `
    <table>
      <thead><tr>${headers.map(h => `<th>${h}</th>`).join('')}</tr></thead>
      <tbody>${rows.map(row => `<tr>${row.map(cell => `<td>${cell}</td>`).join('')}</tr>`).join('')}</tbody>
    </table>
  `;

  printWindow.document.write(`
    <!DOCTYPE html>
    <html>
    <head>
      <title>${filename}</title>
      <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; padding: 30px; color: #1a1a1a; font-size: 11px; }
        .header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 20px; border-bottom: 3px solid #c41e2a; padding-bottom: 12px; }
        .brand { font-size: 18px; font-weight: 800; color: #c41e2a; letter-spacing: 1px; }
        .brand-sub { font-size: 9px; color: #666; letter-spacing: 2px; }
        .report-title { font-size: 16px; font-weight: 700; }
        .report-sub { font-size: 10px; color: #666; margin-top: 2px; }
        table { width: 100%; border-collapse: collapse; margin-top: 8px; }
        th { background: #f0f0f0; font-weight: 600; text-align: left; padding: 6px 8px; font-size: 9px; text-transform: uppercase; letter-spacing: 0.5px; border-bottom: 2px solid #ddd; }
        td { padding: 5px 8px; border-bottom: 1px solid #eee; font-size: 10px; }
        tr:nth-child(even) { background: #fafafa; }
        .footer { margin-top: 30px; padding-top: 10px; border-top: 1px solid #ddd; font-size: 9px; color: #999; display: flex; justify-content: space-between; }
        @media print { body { padding: 15px; } .no-print { display: none; } }
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
          <div class="report-title">${title}</div>
          <div class="report-sub">${subtitle || `Generado: ${new Date().toLocaleDateString('es-MX')}`}</div>
        </div>
      </div>
      ${summaryHtml}
      ${tableHtml}
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
