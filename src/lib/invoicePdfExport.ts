/**
 * Generate a CFDI-style invoice PDF preview and demo XML
 */
import { numberToWords } from '@/lib/numberToWords';
import { getCompanyLogoUrl } from '@/hooks/useCompanyLogo';

const fmt = (n: number) => new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN', maximumFractionDigits: 2 }).format(n);

export interface InvoicePdfData {
  // Emisor
  issuerName: string;
  issuerRfc: string;
  issuerTaxRegime: string;
  issuerTradeName?: string;
  issuerZipCode: string;
  // Receptor
  customerName: string;
  customerRfc: string;
  customerTaxRegime: string;
  customerZipCode: string;
  cfdiUse: string;
  cfdiUseLabel?: string;
  // Comprobante
  series: string;
  folio: string;
  invoiceType: string;
  invoiceTypeLabel: string;
  paymentForm: string;
  paymentFormLabel: string;
  paymentMethod: string;
  paymentMethodLabel: string;
  currency: string;
  exchangeRate: number;
  uuid?: string;
  issuedAt?: string;
  conditions?: string;
  notes?: string;
  // Items
  items: {
    description: string;
    satProductKey: string;
    satUnitKey: string;
    qty: number;
    unitPrice: number;
    discount: number;
    subtotal: number;
    taxAmount: number;
    total: number;
  }[];
  subtotal: number;
  taxTotal: number;
  total: number;
  // Demo flag
  isDemo?: boolean;
}

export function generateInvoicePdfHtml(data: InvoicePdfData): string {
  const totalWords = numberToWords(data.total);
  const dateStr = data.issuedAt ? new Date(data.issuedAt).toLocaleString('es-MX') : new Date().toLocaleString('es-MX');
  const logoUrl = getCompanyLogoUrl();
  const demoWatermark = data.isDemo ? `
    <div style="position:fixed;top:40%;left:50%;transform:translate(-50%,-50%) rotate(-35deg);font-size:120px;font-weight:900;color:rgba(200,0,0,0.07);z-index:0;pointer-events:none;white-space:nowrap;">
      SIN VALIDEZ FISCAL
    </div>` : '';

  const logoWatermark = `
    <div style="position:fixed;top:50%;left:50%;transform:translate(-50%,-50%);z-index:0;pointer-events:none;opacity:0.04;">
      <img src="${logoUrl}" alt="" style="width:420px;height:420px;object-fit:contain;" onerror="this.style.display='none'" />
    </div>`;

  const uuid = data.uuid || (data.isDemo ? 'DEMO0000-0000-0000-0000-000000000000' : '—');

  return `<!DOCTYPE html>
<html>
<head>
  <title>Factura ${data.series}-${data.folio}</title>
  <style>
    * { margin:0; padding:0; box-sizing:border-box; }
    @page { size: letter; margin: 15mm; }
    body { font-family: 'Segoe UI', Arial, Helvetica, sans-serif; font-size: 9.5px; color: #1a1a1a; padding: 20px; position:relative; }
    .invoice-container { max-width: 780px; margin: 0 auto; position:relative; z-index:1; }

    /* Header */
    .inv-header { display:flex; justify-content:space-between; align-items:flex-start; border-bottom:3px solid #c41e2a; padding-bottom:12px; margin-bottom:14px; }
    .inv-brand { font-size:22px; font-weight:900; color:#c41e2a; letter-spacing:1px; }
    .inv-brand-sub { font-size:8px; color:#888; letter-spacing:2px; margin-top:2px; }
    .inv-doc-type { text-align:right; }
    .inv-doc-type h2 { font-size:16px; font-weight:700; color:#333; }
    .inv-doc-type .folio { font-size:14px; color:#c41e2a; font-weight:700; }

    /* Two-column info */
    .inv-parties { display:grid; grid-template-columns:1fr 1fr; gap:16px; margin-bottom:14px; }
    .inv-party { border:1px solid #e0e0e0; border-radius:6px; padding:10px 12px; background:#fafafa; }
    .inv-party-title { font-size:8px; font-weight:700; text-transform:uppercase; letter-spacing:1px; color:#c41e2a; margin-bottom:6px; border-bottom:1px solid #eee; padding-bottom:4px; }
    .inv-party-name { font-size:11px; font-weight:700; margin-bottom:3px; }
    .inv-party p { font-size:9px; color:#555; line-height:1.5; }
    .inv-party .label { color:#888; font-size:8px; text-transform:uppercase; }

    /* CFDI data row */
    .inv-cfdi-row { display:grid; grid-template-columns:repeat(4, 1fr); gap:8px; margin-bottom:14px; }
    .inv-cfdi-cell { background:#f5f5f5; border-radius:5px; padding:7px 10px; text-align:center; }
    .inv-cfdi-cell .label { font-size:7.5px; color:#888; text-transform:uppercase; letter-spacing:0.5px; }
    .inv-cfdi-cell .value { font-size:10px; font-weight:600; margin-top:2px; }

    /* Table */
    .inv-table { width:100%; border-collapse:collapse; margin-bottom:14px; }
    .inv-table th { background:#c41e2a; color:white; font-size:8px; text-transform:uppercase; letter-spacing:0.5px; padding:7px 8px; text-align:left; }
    .inv-table th:last-child, .inv-table th:nth-child(n+3) { text-align:right; }
    .inv-table td { padding:6px 8px; border-bottom:1px solid #eee; font-size:9px; }
    .inv-table td:last-child, .inv-table td:nth-child(n+3) { text-align:right; }
    .inv-table tr:nth-child(even) { background:#fafafa; }
    .inv-table .desc { max-width:220px; }

    /* Totals */
    .inv-totals { display:flex; justify-content:space-between; align-items:flex-start; margin-bottom:14px; }
    .inv-total-words { flex:1; font-size:8.5px; color:#555; padding:8px 12px; background:#f9f9f9; border-radius:5px; margin-right:16px; line-height:1.6; }
    .inv-total-box { min-width:200px; }
    .inv-total-row { display:flex; justify-content:space-between; padding:4px 0; font-size:10px; }
    .inv-total-row.grand { font-size:14px; font-weight:800; color:#c41e2a; border-top:2px solid #c41e2a; padding-top:6px; margin-top:4px; }

    /* UUID / Sello */
    .inv-stamp { border:1px solid #e0e0e0; border-radius:6px; padding:10px 12px; margin-bottom:14px; background:#fafafa; }
    .inv-stamp-title { font-size:8px; font-weight:700; text-transform:uppercase; color:#c41e2a; margin-bottom:6px; }
    .inv-stamp p { font-size:8px; color:#555; word-break:break-all; line-height:1.5; }
    .inv-stamp .uuid { font-size:11px; font-weight:700; color:#333; font-family:monospace; }

    /* Footer */
    .inv-footer { text-align:center; font-size:8px; color:#aaa; border-top:1px solid #ddd; padding-top:8px; margin-top:10px; }

    /* Notes */
    .inv-notes { font-size:8.5px; color:#555; margin-bottom:10px; padding:6px 10px; background:#fffbe6; border:1px solid #f0e68c; border-radius:4px; }

    @media print { body { padding:0; } }
  </style>
</head>
<body>
  ${demoWatermark}
  ${logoWatermark}
  <div class="invoice-container">
    <!-- Header -->
    <div class="inv-header">
      <div style="display:flex;align-items:center;gap:12px;">
        <img src="${logoUrl}" alt="Logo" style="height:40px;max-width:130px;object-fit:contain;" onerror="this.style.display='none'" />
        <div>
          <div class="inv-brand">${data.issuerTradeName || data.issuerName}</div>
          <div class="inv-brand-sub">${data.issuerName}</div>
        </div>
      </div>
      <div class="inv-doc-type">
        <h2>${data.invoiceTypeLabel}</h2>
        <div class="folio">${data.series}-${data.folio}</div>
        <div style="font-size:9px;color:#666;margin-top:4px;">${dateStr}</div>
      </div>
    </div>

    <!-- Parties -->
    <div class="inv-parties">
      <div class="inv-party">
        <div class="inv-party-title">Emisor</div>
        <div class="inv-party-name">${data.issuerName}</div>
        <p><span class="label">RFC:</span> ${data.issuerRfc}</p>
        <p><span class="label">Régimen Fiscal:</span> ${data.issuerTaxRegime}</p>
        <p><span class="label">C.P. Expedición:</span> ${data.issuerZipCode}</p>
      </div>
      <div class="inv-party">
        <div class="inv-party-title">Receptor</div>
        <div class="inv-party-name">${data.customerName}</div>
        <p><span class="label">RFC:</span> ${data.customerRfc}</p>
        <p><span class="label">Régimen Fiscal:</span> ${data.customerTaxRegime}</p>
        <p><span class="label">C.P.:</span> ${data.customerZipCode}</p>
        <p><span class="label">Uso CFDI:</span> ${data.cfdiUseLabel || data.cfdiUse}</p>
      </div>
    </div>

    <!-- CFDI Data -->
    <div class="inv-cfdi-row">
      <div class="inv-cfdi-cell">
        <div class="label">Tipo Comprobante</div>
        <div class="value">${data.invoiceType} — ${data.invoiceTypeLabel}</div>
      </div>
      <div class="inv-cfdi-cell">
        <div class="label">Forma de Pago</div>
        <div class="value">${data.paymentFormLabel}</div>
      </div>
      <div class="inv-cfdi-cell">
        <div class="label">Método de Pago</div>
        <div class="value">${data.paymentMethodLabel}</div>
      </div>
      <div class="inv-cfdi-cell">
        <div class="label">Moneda</div>
        <div class="value">${data.currency}${data.currency === 'USD' ? ` (TC: ${data.exchangeRate})` : ''}</div>
      </div>
    </div>

    ${data.conditions ? `<div class="inv-notes"><strong>Condiciones:</strong> ${data.conditions}</div>` : ''}

    <!-- Items table -->
    <table class="inv-table">
      <thead>
        <tr>
          <th>#</th>
          <th>Clave SAT</th>
          <th class="desc">Descripción</th>
          <th>Unidad</th>
          <th>Cant.</th>
          <th>P. Unitario</th>
          <th>Descuento</th>
          <th>Subtotal</th>
          <th>IVA</th>
          <th>Total</th>
        </tr>
      </thead>
      <tbody>
        ${data.items.map((it, i) => `
          <tr>
            <td>${i + 1}</td>
            <td>${it.satProductKey || '—'}</td>
            <td class="desc">${it.description || '—'}</td>
            <td>${it.satUnitKey || '—'}</td>
            <td>${it.qty}</td>
            <td>${fmt(it.unitPrice)}</td>
            <td>${fmt(it.discount)}</td>
            <td>${fmt(it.subtotal)}</td>
            <td>${fmt(it.taxAmount)}</td>
            <td style="font-weight:600;">${fmt(it.total)}</td>
          </tr>
        `).join('')}
      </tbody>
    </table>

    <!-- Totals + Words -->
    <div class="inv-totals">
      <div class="inv-total-words">
        <strong>Total con letra:</strong><br/>
        ${totalWords} M.N.
      </div>
      <div class="inv-total-box">
        <div class="inv-total-row"><span>Subtotal</span><span>${fmt(data.subtotal)}</span></div>
        <div class="inv-total-row"><span>IVA (16%)</span><span>${fmt(data.taxTotal)}</span></div>
        <div class="inv-total-row grand"><span>Total</span><span>${fmt(data.total)}</span></div>
      </div>
    </div>

    ${data.notes ? `<div class="inv-notes"><strong>Observaciones:</strong> ${data.notes}</div>` : ''}

    <!-- Stamp / UUID -->
    <div class="inv-stamp">
      <div class="inv-stamp-title">Sello Digital del CFDI</div>
      <p><strong>UUID:</strong> <span class="uuid">${uuid}</span></p>
      ${data.isDemo ? '<p style="color:#c41e2a;font-weight:700;margin-top:4px;">⚠ DOCUMENTO DEMO — SIN VALIDEZ FISCAL</p>' : ''}
      <p style="margin-top:4px;"><strong>Fecha de certificación:</strong> ${dateStr}</p>
      <p><strong>Sello SAT:</strong> ${data.isDemo ? 'DEMO—Este documento no tiene validez fiscal y es solo una vista previa del formato' : '...'}</p>
    </div>

    <div class="inv-footer">
      Este documento es una representación impresa de un CFDI ${data.isDemo ? '(DEMO — SIN VALIDEZ FISCAL)' : ''}<br/>
      ${data.issuerName} — RFC: ${data.issuerRfc}
    </div>
  </div>
  <script>setTimeout(() => { window.print(); }, 600);</script>
</body>
</html>`;
}

export function openInvoicePdf(data: InvoicePdfData) {
  const html = generateInvoicePdfHtml(data);
  const w = window.open('', '_blank');
  if (!w) return;
  w.document.write(html);
  w.document.close();
}

export function generateDemoXml(data: InvoicePdfData): string {
  const now = new Date().toISOString();
  const uuid = data.uuid || 'DEMO0000-0000-0000-0000-000000000000';
  return `<?xml version="1.0" encoding="UTF-8"?>
<!-- ${data.isDemo ? 'DOCUMENTO DEMO — SIN VALIDEZ FISCAL' : 'CFDI'} -->
<cfdi:Comprobante
  xmlns:cfdi="http://www.sat.gob.mx/cfd/4"
  xmlns:tfd="http://www.sat.gob.mx/TimbreFiscalDigital"
  Version="4.0"
  Serie="${data.series}"
  Folio="${data.folio}"
  Fecha="${now}"
  FormaPago="${data.paymentForm}"
  MetodoPago="${data.paymentMethod}"
  TipoDeComprobante="${data.invoiceType}"
  Moneda="${data.currency}"
  TipoCambio="${data.exchangeRate}"
  SubTotal="${data.subtotal.toFixed(2)}"
  Total="${data.total.toFixed(2)}"
  LugarExpedicion="${data.issuerZipCode}"
  Exportacion="01">

  <cfdi:Emisor
    Rfc="${data.issuerRfc}"
    Nombre="${data.issuerName}"
    RegimenFiscal="${data.issuerTaxRegime}" />

  <cfdi:Receptor
    Rfc="${data.customerRfc}"
    Nombre="${data.customerName}"
    UsoCFDI="${data.cfdiUse}"
    RegimenFiscalReceptor="${data.customerTaxRegime}"
    DomicilioFiscalReceptor="${data.customerZipCode}" />

  <cfdi:Conceptos>
${data.items.map(it => `    <cfdi:Concepto
      ClaveProdServ="${it.satProductKey}"
      ClaveUnidad="${it.satUnitKey}"
      Cantidad="${it.qty}"
      Descripcion="${it.description}"
      ValorUnitario="${it.unitPrice.toFixed(2)}"
      Importe="${it.subtotal.toFixed(2)}"
      ObjetoImp="02">
      <cfdi:Impuestos>
        <cfdi:Traslados>
          <cfdi:Traslado Base="${it.subtotal.toFixed(2)}" Impuesto="002" TipoFactor="Tasa" TasaOCuota="0.160000" Importe="${it.taxAmount.toFixed(2)}" />
        </cfdi:Traslados>
      </cfdi:Impuestos>
    </cfdi:Concepto>`).join('\n')}
  </cfdi:Conceptos>

  <cfdi:Impuestos TotalImpuestosTrasladados="${data.taxTotal.toFixed(2)}">
    <cfdi:Traslados>
      <cfdi:Traslado Base="${data.subtotal.toFixed(2)}" Impuesto="002" TipoFactor="Tasa" TasaOCuota="0.160000" Importe="${data.taxTotal.toFixed(2)}" />
    </cfdi:Traslados>
  </cfdi:Impuestos>

  <cfdi:Complemento>
    <tfd:TimbreFiscalDigital
      Version="1.1"
      UUID="${uuid}"
      FechaTimbrado="${now}"
      SelloCFD="${data.isDemo ? 'DEMO_SELLO_CFD' : '...'}"
      SelloSAT="${data.isDemo ? 'DEMO_SELLO_SAT' : '...'}"
      NoCertificadoSAT="${data.isDemo ? '00000000000000000000' : '...'}"
      RfcProvCertif="${data.isDemo ? 'DEMO000000XX0' : '...'}" />
  </cfdi:Complemento>

</cfdi:Comprobante>`;
}

export function downloadXml(data: InvoicePdfData) {
  const xml = generateDemoXml(data);
  const blob = new Blob([xml], { type: 'application/xml' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${data.series}-${data.folio}${data.isDemo ? '-DEMO' : ''}.xml`;
  a.click();
  URL.revokeObjectURL(url);
}
