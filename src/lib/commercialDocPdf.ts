import { getCompanyLogoUrl } from '@/hooks/useCompanyLogo';
import { DOC_TYPE_LABELS } from '@/hooks/useCommercialDocuments';

const fmt = (n: number) => new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN', maximumFractionDigits: 2 }).format(n);

interface DocData {
  docType: string;
  folio: string;
  date: string;
  customerName: string;
  customerContact: string;
  vendorName: string;
  vendorPhone: string;
  items: { name: string; qty: number; unitPrice: number; subtotal: number }[];
  subtotal: number;
  tax: number;
  total: number;
  notes: string;
  conditions: string;
  legalText: string;
}

async function toBase64(url: string): Promise<string | null> {
  try {
    const res = await fetch(url);
    if (!res.ok) return null;
    const blob = await res.blob();
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result as string);
      reader.onerror = () => resolve(null);
      reader.readAsDataURL(blob);
    });
  } catch {
    return null;
  }
}

export async function generateCommercialDocPdf(data: DocData): Promise<void> {
  const logoUrl = getCompanyLogoUrl();
  const logoBase64 = await toBase64(logoUrl);
  const docLabel = DOC_TYPE_LABELS[data.docType] || data.docType;

  const printWindow = window.open('', '_blank');
  if (!printWindow) return;

  const itemsRows = data.items.map((it, i) => `
    <tr>
      <td style="padding:8px 10px;border-bottom:1px solid #e5e7eb;text-align:center;color:#6b7280;font-size:13px;">${i + 1}</td>
      <td style="padding:8px 10px;border-bottom:1px solid #e5e7eb;font-size:13px;">${it.name}</td>
      <td style="padding:8px 10px;border-bottom:1px solid #e5e7eb;text-align:center;font-size:13px;">${it.qty}</td>
      <td style="padding:8px 10px;border-bottom:1px solid #e5e7eb;text-align:right;font-size:13px;">${fmt(it.unitPrice)}</td>
      <td style="padding:8px 10px;border-bottom:1px solid #e5e7eb;text-align:right;font-weight:600;font-size:13px;">${fmt(it.subtotal)}</td>
    </tr>
  `).join('');

  const html = `<!DOCTYPE html>
<html><head><meta charset="utf-8">
<title>${docLabel} ${data.folio}</title>
<style>
  @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap');
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body { font-family: 'Inter', sans-serif; background: #fff; color: #1a1a1a; padding: 0; }
  @page { size: letter; margin: 15mm 18mm; }
  @media print { body { padding: 0; } .no-print { display: none; } }
  .print-btn { position: fixed; top: 20px; right: 20px; padding: 10px 24px; background: #dc2626; color: #fff; border: none; border-radius: 8px; font-size: 14px; font-weight: 600; cursor: pointer; z-index: 999; }
  .print-btn:hover { background: #b91c1c; }
</style>
</head><body>
<button class="print-btn no-print" onclick="window.print()">Descargar PDF</button>

<div style="max-width:750px;margin:0 auto;padding:30px 0;">

  <!-- HEADER -->
  <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:24px;">
    <div style="display:flex;align-items:center;gap:14px;">
      ${logoBase64 ? `<img src="${logoBase64}" style="height:55px;object-fit:contain;" />` : ''}
      <div>
        <div style="font-size:18px;font-weight:700;color:#1a1a1a;">REDBUCK</div>
        <div style="font-size:11px;color:#6b7280;">CRM + ERP</div>
      </div>
    </div>
    <div style="text-align:right;">
      <div style="font-size:20px;font-weight:700;color:#dc2626;text-transform:uppercase;letter-spacing:1px;">${docLabel}</div>
      <div style="font-size:14px;font-weight:600;margin-top:4px;">Folio: ${data.folio}</div>
      <div style="font-size:12px;color:#6b7280;margin-top:2px;">Fecha: ${data.date}</div>
    </div>
  </div>

  <div style="height:3px;background:linear-gradient(to right,#dc2626,#f59e0b);border-radius:2px;margin-bottom:20px;"></div>

  <!-- CLIENT & VENDOR INFO -->
  <div style="display:flex;gap:20px;margin-bottom:20px;">
    <div style="flex:1;background:#f9fafb;border-radius:8px;padding:14px;">
      <div style="font-size:11px;font-weight:600;color:#6b7280;text-transform:uppercase;letter-spacing:0.5px;margin-bottom:6px;">Datos del cliente</div>
      <div style="font-size:14px;font-weight:600;">${data.customerName}</div>
      ${data.customerContact ? `<div style="font-size:12px;color:#6b7280;margin-top:2px;">${data.customerContact}</div>` : ''}
    </div>
    <div style="flex:1;background:#f9fafb;border-radius:8px;padding:14px;">
      <div style="font-size:11px;font-weight:600;color:#6b7280;text-transform:uppercase;letter-spacing:0.5px;margin-bottom:6px;">Vendedor</div>
      <div style="font-size:14px;font-weight:600;">${data.vendorName}</div>
      ${data.vendorPhone ? `<div style="font-size:12px;color:#6b7280;margin-top:2px;">Tel: ${data.vendorPhone}</div>` : ''}
    </div>
  </div>

  <!-- ITEMS TABLE -->
  <table style="width:100%;border-collapse:collapse;margin-bottom:20px;">
    <thead>
      <tr style="background:#1a1a1a;">
        <th style="padding:10px;color:#fff;font-size:11px;font-weight:600;text-transform:uppercase;letter-spacing:0.5px;text-align:center;width:40px;">#</th>
        <th style="padding:10px;color:#fff;font-size:11px;font-weight:600;text-transform:uppercase;letter-spacing:0.5px;text-align:left;">Producto</th>
        <th style="padding:10px;color:#fff;font-size:11px;font-weight:600;text-transform:uppercase;letter-spacing:0.5px;text-align:center;width:70px;">Cant.</th>
        <th style="padding:10px;color:#fff;font-size:11px;font-weight:600;text-transform:uppercase;letter-spacing:0.5px;text-align:right;width:120px;">P. Unitario</th>
        <th style="padding:10px;color:#fff;font-size:11px;font-weight:600;text-transform:uppercase;letter-spacing:0.5px;text-align:right;width:120px;">Subtotal</th>
      </tr>
    </thead>
    <tbody>
      ${itemsRows}
    </tbody>
  </table>

  <!-- TOTALS -->
  <div style="display:flex;justify-content:flex-end;margin-bottom:24px;">
    <div style="width:280px;">
      <div style="display:flex;justify-content:space-between;padding:6px 0;font-size:13px;border-bottom:1px solid #e5e7eb;">
        <span style="color:#6b7280;">Subtotal</span>
        <span>${fmt(data.subtotal)}</span>
      </div>
      <div style="display:flex;justify-content:space-between;padding:6px 0;font-size:13px;border-bottom:1px solid #e5e7eb;">
        <span style="color:#6b7280;">IVA (16%)</span>
        <span>${fmt(data.tax)}</span>
      </div>
      <div style="display:flex;justify-content:space-between;padding:10px 0;font-size:18px;font-weight:700;color:#dc2626;border-top:2px solid #1a1a1a;">
        <span>TOTAL</span>
        <span>${fmt(data.total)}</span>
      </div>
    </div>
  </div>

  <!-- NOTES / CONDITIONS -->
  ${data.notes || data.conditions ? `
  <div style="background:#f9fafb;border-radius:8px;padding:14px;margin-bottom:16px;font-size:12px;">
    ${data.notes ? `<div style="margin-bottom:6px;"><strong>Notas:</strong> ${data.notes}</div>` : ''}
    ${data.conditions ? `<div><strong>Condiciones:</strong> ${data.conditions}</div>` : ''}
  </div>
  ` : ''}

  <!-- FOOTER -->
  <div style="margin-top:30px;padding-top:12px;border-top:1px solid #e5e7eb;text-align:center;">
    ${data.legalText ? `<div style="font-size:10px;color:#9ca3af;margin-bottom:6px;">${data.legalText}</div>` : ''}
    <div style="font-size:10px;color:#9ca3af;">Generado por REDBUCK CRM+ERP — ${data.date}</div>
    <div style="font-size:9px;color:#d1d5db;margin-top:2px;">Precios sujetos a cambio sin previo aviso</div>
  </div>

</div>
</body></html>`;

  printWindow.document.write(html);
  printWindow.document.close();
}
