/**
 * Price List PDF Generator - REDBUCK Professional Catalog
 * Uses browser print API to generate downloadable PDF
 */

import { getCompanyLogoUrl } from '@/hooks/useCompanyLogo';

const fmtPrice = (n: number) =>
  new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'USD', minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n);

const MONTHS_ES = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];

export interface PriceListProduct {
  sku: string;
  name: string;
  capacity: string;
  image: string | null;
  price_client: number;
  price_distributor: number;
  commission_distributor: number;
  commission_admin: number;
  category: string;
  active: boolean;
}

const CATEGORY_ORDER: Record<string, number> = {
  elevadores: 1,
  alineadoras: 2,
  desmontadoras: 3,
  balanceadoras: 4,
  hidraulico: 5,
  lubricacion: 6,
  aire: 7,
  otros: 8,
};

const CATEGORY_DISPLAY: Record<string, string> = {
  elevadores: 'ELEVADORES',
  alineadoras: 'ALINEACIÓN',
  desmontadoras: 'DESMONTADORAS / LLANTAS',
  balanceadoras: 'BALANCEADORAS',
  hidraulico: 'HIDRÁULICO',
  lubricacion: 'LUBRICACIÓN',
  aire: 'AIRE',
  otros: 'HERRAMIENTA / OTROS',
};

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

export async function generatePriceListPdf(
  products: PriceListProduct[],
  filterCategory?: string
): Promise<void> {
  // Filter active products with at least one price
  let filtered = products.filter(
    (p) => p.active && (p.price_client > 0 || p.price_distributor > 0)
  );

  if (filterCategory && filterCategory !== 'all') {
    filtered = filtered.filter((p) => p.category === filterCategory);
  }

  // Sort by category order then name
  filtered.sort((a, b) => {
    const ca = CATEGORY_ORDER[a.category] ?? 99;
    const cb = CATEGORY_ORDER[b.category] ?? 99;
    if (ca !== cb) return ca - cb;
    return a.name.localeCompare(b.name);
  });

  if (filtered.length === 0) {
    alert('No hay productos para generar la lista de precios.');
    return;
  }

  // Group by category
  const grouped: Record<string, PriceListProduct[]> = {};
  for (const p of filtered) {
    if (!grouped[p.category]) grouped[p.category] = [];
    grouped[p.category].push(p);
  }

  const logoUrl = getCompanyLogoUrl();
  const logoBase64 = await toBase64(logoUrl);

  const now = new Date();
  const monthYear = `${MONTHS_ES[now.getMonth()]} ${now.getFullYear()}`;

  // Convert product images to base64
  const imageCache: Record<string, string | null> = {};
  for (const p of filtered) {
    if (p.image && !imageCache[p.image]) {
      imageCache[p.image] = await toBase64(p.image);
    }
  }

  // Build category sections
  let sectionsHtml = '';
  const categoryKeys = Object.keys(grouped).sort(
    (a, b) => (CATEGORY_ORDER[a] ?? 99) - (CATEGORY_ORDER[b] ?? 99)
  );

  for (const cat of categoryKeys) {
    const items = grouped[cat];
    const catLabel = CATEGORY_DISPLAY[cat] || cat.toUpperCase();

    const rowsHtml = items
      .map(
        (p, i) => {
          const priceDistCalc = p.price_client > 0 ? p.price_client * 0.85 : 0;
          const comAdmin = p.price_client > 0 ? p.price_client * 0.025 : 0;
          return `
      <tr style="background:${i % 2 === 0 ? '#ffffff' : '#F5F5F5'};">
        <td style="padding:6px 8px;border:1px solid #e0e0e0;font-size:11px;font-weight:600;text-align:center;vertical-align:middle;">${p.sku}</td>
        <td style="padding:6px 8px;border:1px solid #e0e0e0;font-size:11px;vertical-align:middle;max-width:200px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${p.name}</td>
        <td style="padding:6px 8px;border:1px solid #e0e0e0;font-size:11px;text-align:center;vertical-align:middle;">${p.capacity || '—'}</td>
        <td style="padding:4px;border:1px solid #e0e0e0;text-align:center;vertical-align:middle;width:60px;">
          ${p.image && imageCache[p.image] ? `<img src="${imageCache[p.image]}" style="height:40px;max-width:55px;object-fit:contain;" />` : '<span style="color:#ccc;font-size:9px;">Sin foto</span>'}
        </td>
        <td style="padding:6px 8px;border:1px solid #e0e0e0;font-size:11px;text-align:right;vertical-align:middle;font-weight:600;color:#C00000;">${p.price_client > 0 ? fmtPrice(p.price_client) : '—'}</td>
        <td style="padding:6px 8px;border:1px solid #e0e0e0;font-size:11px;text-align:right;vertical-align:middle;font-weight:600;">${p.price_distributor > 0 ? fmtPrice(p.price_distributor) : '—'}</td>
        <td style="padding:6px 8px;border:1px solid #e0e0e0;font-size:11px;text-align:right;vertical-align:middle;">${comDist > 0 ? fmtPrice(comDist) : '—'}</td>
        <td style="padding:6px 8px;border:1px solid #e0e0e0;font-size:11px;text-align:right;vertical-align:middle;">${comAdmin > 0 ? fmtPrice(comAdmin) : '—'}</td>
      </tr>
    `;
        }
      )
      .join('');

    sectionsHtml += `
      <div style="page-break-inside:avoid;margin-bottom:20px;">
        <div style="background:#C00000;color:white;padding:8px 14px;font-size:14px;font-weight:800;letter-spacing:2px;margin-bottom:0;border-radius:4px 4px 0 0;">
          ${catLabel}
        </div>
        <table style="width:100%;border-collapse:collapse;">
          <thead>
            <tr style="background:#000000;">
              <th style="padding:8px;color:#fff;font-size:9px;font-weight:700;text-transform:uppercase;letter-spacing:0.5px;text-align:center;border:1px solid #333;width:80px;">Código</th>
              <th style="padding:8px;color:#fff;font-size:9px;font-weight:700;text-transform:uppercase;letter-spacing:0.5px;text-align:left;border:1px solid #333;">Descripción</th>
              <th style="padding:8px;color:#fff;font-size:9px;font-weight:700;text-transform:uppercase;letter-spacing:0.5px;text-align:center;border:1px solid #333;width:90px;">Capacidad</th>
              <th style="padding:8px;color:#fff;font-size:9px;font-weight:700;text-transform:uppercase;letter-spacing:0.5px;text-align:center;border:1px solid #333;width:60px;">Foto</th>
              <th style="padding:8px;color:#fff;font-size:9px;font-weight:700;text-transform:uppercase;letter-spacing:0.5px;text-align:right;border:1px solid #333;width:100px;">Cliente</th>
              <th style="padding:8px;color:#fff;font-size:9px;font-weight:700;text-transform:uppercase;letter-spacing:0.5px;text-align:right;border:1px solid #333;width:100px;">Distribuidor</th>
              <th style="padding:8px;color:#fff;font-size:9px;font-weight:700;text-transform:uppercase;letter-spacing:0.5px;text-align:right;border:1px solid #333;width:90px;">Com. Dist.</th>
              <th style="padding:8px;color:#fff;font-size:9px;font-weight:700;text-transform:uppercase;letter-spacing:0.5px;text-align:right;border:1px solid #333;width:90px;">Com. Admon</th>
            </tr>
          </thead>
          <tbody>
            ${rowsHtml}
          </tbody>
        </table>
      </div>
    `;
  }

  const headerHtml = `
    <div style="display:flex;justify-content:space-between;align-items:center;padding:10px 0;border-bottom:4px solid #C00000;margin-bottom:16px;">
      <div style="display:flex;align-items:center;gap:10px;">
        ${logoBase64 ? `<img src="${logoBase64}" style="height:45px;object-fit:contain;" />` : ''}
      </div>
      <div style="text-align:center;flex:1;">
        <div style="font-size:20px;font-weight:900;color:#C00000;letter-spacing:3px;">LISTA DE PRECIOS REDBUCK</div>
        <div style="font-size:12px;color:#666;margin-top:2px;font-weight:600;">PRECIO VIGENTE ${monthYear.toUpperCase()}</div>
      </div>
      <div style="display:flex;align-items:center;gap:10px;">
        ${logoBase64 ? `<img src="${logoBase64}" style="height:45px;object-fit:contain;" />` : ''}
      </div>
    </div>
  `;

  const footerHtml = `
    <div style="margin-top:30px;padding-top:14px;border-top:3px solid #C00000;text-align:center;">
      <div style="font-size:11px;font-weight:700;color:#C00000;margin-bottom:4px;">REDBUCK EQUIPMENT</div>
      <div style="font-size:10px;color:#666;">Guadalajara, Jalisco</div>
      <div style="font-size:10px;color:#666;margin-top:2px;">Precios + IVA · Precios sujetos a cambio sin previo aviso</div>
      <div style="font-size:9px;color:#999;margin-top:4px;">Generado: ${now.toLocaleDateString('es-MX')} · Lista de precios confidencial</div>
    </div>
  `;

  const printWindow = window.open('', '_blank');
  if (!printWindow) return;

  const html = `<!DOCTYPE html>
<html><head><meta charset="utf-8">
<title>Lista de Precios REDBUCK - ${monthYear}</title>
<style>
  @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800;900&display=swap');
  * { margin:0; padding:0; box-sizing:border-box; }
  body { font-family:'Inter',sans-serif; background:#fff; color:#1a1a1a; padding:20px 30px; -webkit-print-color-adjust:exact; print-color-adjust:exact; }
  @page { size:letter landscape; margin:10mm 12mm; }
  @media print { 
    body { padding:0; }
    .no-print { display:none !important; }
  }
  table { page-break-inside:auto; }
  tr { page-break-inside:avoid; page-break-after:auto; }
  thead { display:table-header-group; }
  .print-btn { position:fixed;top:16px;right:16px;padding:10px 28px;background:#C00000;color:#fff;border:none;border-radius:8px;font-size:14px;font-weight:700;cursor:pointer;z-index:999;box-shadow:0 4px 12px rgba(192,0,0,0.3); }
  .print-btn:hover { background:#a00000; }
</style>
</head><body>
<button class="print-btn no-print" onclick="window.print()">⬇ Descargar PDF</button>

<div style="max-width:1100px;margin:0 auto;">
  ${headerHtml}
  ${sectionsHtml}
  ${footerHtml}
</div>
</body></html>`;

  printWindow.document.write(html);
  printWindow.document.close();
}
