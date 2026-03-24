/**
 * Premium Product Datasheet PDF — catalog-style commercial document
 * Converts images to base64 before rendering for WhatsApp sharing compatibility.
 */

import { getCompanyLogoUrl } from '@/hooks/useCompanyLogo';
import type { Product } from '@/types';

const fmt = (n: number, currency: 'MXN' | 'USD' = 'MXN') =>
  new Intl.NumberFormat('es-MX', { style: 'currency', currency, maximumFractionDigits: 0 }).format(n);

export interface DatasheetConfig {
  product: Product;
  exchangeRate: number;
  sellerName: string;
  sellerPhone: string;
  sellerEmail?: string;
  customNote?: string;
  showPriceMXN?: boolean;
}

// Convert image URL to base64
function toBase64(url: string): Promise<string> {
  return new Promise((resolve) => {
    if (!url || url === '/placeholder.svg') { resolve(''); return; }
    if (url.startsWith('data:')) { resolve(url); return; }
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      try {
        const canvas = document.createElement('canvas');
        canvas.width = img.naturalWidth;
        canvas.height = img.naturalHeight;
        const ctx = canvas.getContext('2d');
        ctx?.drawImage(img, 0, 0);
        resolve(canvas.toDataURL('image/jpeg', 0.85));
      } catch { resolve(url); }
    };
    img.onerror = () => resolve('');
    img.src = url;
  });
}

function generateBenefits(product: Product): string[] {
  const benefits: string[] = [];
  if (product.warranty) benefits.push(`✅ Garantía ${product.warranty} — Protección total para tu inversión`);
  if (product.deliveryDays <= 5) benefits.push('🚀 Entrega rápida — Recíbelo en menos de una semana');
  else if (product.deliveryDays <= 15) benefits.push(`📦 Entrega en ${product.deliveryDays} días — Planifica sin contratiempos`);
  
  const cat = product.category?.toLowerCase() || '';
  if (cat.includes('elevador')) {
    benefits.push('🔧 Optimiza tu taller — Mayor capacidad de atención por bahía');
    benefits.push('💪 Estructura reforzada — Diseñado para uso profesional intensivo');
  } else if (cat.includes('balanceadora')) {
    benefits.push('⚡ Precisión digital — Balanceo perfecto en cada servicio');
    benefits.push('💰 Recupera inversión rápido — Más servicios por hora');
  } else if (cat.includes('desmontadora')) {
    benefits.push('⏱️ Ahorra tiempo — Desmontaje y montaje en minutos');
    benefits.push('🛡️ Protege el rin — Sistema anti-daño integrado');
  } else if (cat.includes('alineadora')) {
    benefits.push('📐 Alineación de precisión — Tecnología 3D de última generación');
    benefits.push('📈 Servicio premium — Diferénciate de tu competencia');
  } else {
    benefits.push('🏭 Uso profesional — Diseñado para alto rendimiento');
    benefits.push('📈 Mejora tu productividad — Invierte en eficiencia');
  }
  
  if (Object.values(product.stock).reduce((a, b) => a + b, 0) > 0)
    benefits.push('✅ Disponible en inventario — Entrega inmediata');
  
  return benefits;
}

export async function generateProductDatasheet(config: DatasheetConfig) {
  const { product, exchangeRate, sellerName, sellerPhone, sellerEmail, customNote, showPriceMXN = true } = config;

  // Convert all images to base64
  const allImages = product.images?.length ? product.images : (product.image ? [product.image] : []);
  const [logoB64, ...imageB64s] = await Promise.all([
    toBase64(getCompanyLogoUrl()),
    ...allImages.map(img => toBase64(img)),
  ]);

  const mainImage = imageB64s[0] || '';
  const galleryImages = imageB64s.slice(1, 5); // max 4 gallery images
  const benefits = generateBenefits(product);
  const totalStock = Object.values(product.stock).reduce((a, b) => a + b, 0);

  const priceMXN = product.listPrice * exchangeRate;

  const printWindow = window.open('', '_blank');
  if (!printWindow) return;

  const galleryHtml = galleryImages.length > 0 ? `
    <div style="margin-top:24px;">
      <div style="display:flex;gap:12px;flex-wrap:wrap;justify-content:center;">
        ${galleryImages.map(img => img ? `
          <div style="width:calc(50% - 6px);max-width:240px;aspect-ratio:4/3;border-radius:12px;overflow:hidden;border:1px solid #e5e5e5;">
            <img src="${img}" style="width:100%;height:100%;object-fit:cover;" />
          </div>
        ` : '').join('')}
      </div>
    </div>
  ` : '';

  const descriptionParts = (product.description || '').split('\n').filter(Boolean);
  const specLines = descriptionParts.length > 0 ? descriptionParts : ['Equipo profesional de alta calidad para uso en taller.'];

  printWindow.document.write(`
    <!DOCTYPE html>
    <html>
    <head>
      <title>Ficha ${product.name}</title>
      <meta charset="UTF-8">
      <style>
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800;900&display=swap');
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body { font-family: 'Inter', -apple-system, sans-serif; color: #1a1a1a; background: #fff; }
        .page { max-width: 680px; margin: 0 auto; padding: 32px 28px; }

        /* Header */
        .header {
          display: flex; justify-content: space-between; align-items: center;
          padding-bottom: 16px; border-bottom: 3px solid #c41e2a; margin-bottom: 28px;
        }
        .header-left { display: flex; align-items: center; gap: 14px; }
        .logo { height: 44px; max-width: 130px; object-fit: contain; }
        .company-name { font-size: 20px; font-weight: 800; color: #c41e2a; letter-spacing: 0.5px; }
        .company-sub { font-size: 9px; color: #888; letter-spacing: 2px; text-transform: uppercase; margin-top: 2px; }
        .header-contact { text-align: right; font-size: 10px; color: #666; line-height: 1.6; }

        /* Hero Section */
        .hero { display: flex; gap: 24px; margin-bottom: 24px; }
        .hero-image {
          flex: 1; min-width: 0; aspect-ratio: 4/3; border-radius: 16px;
          overflow: hidden; background: #f5f5f5; border: 1px solid #e5e5e5;
        }
        .hero-image img { width: 100%; height: 100%; object-fit: cover; }
        .hero-info { width: 220px; flex-shrink: 0; display: flex; flex-direction: column; justify-content: center; }
        .product-name { font-size: 22px; font-weight: 800; line-height: 1.2; color: #1a1a1a; margin-bottom: 8px; }
        .product-meta { font-size: 11px; color: #888; margin-bottom: 16px; }
        .price-box {
          background: linear-gradient(135deg, #c41e2a, #e8384f); border-radius: 14px;
          padding: 18px 20px; color: white; text-align: center; margin-bottom: 12px;
        }
        .price-label { font-size: 10px; text-transform: uppercase; letter-spacing: 1.5px; opacity: 0.85; }
        .price-value { font-size: 28px; font-weight: 900; margin-top: 4px; }
        .price-mxn { font-size: 12px; opacity: 0.8; margin-top: 2px; }
        .availability {
          background: #f0fdf4; border: 1px solid #bbf7d0; border-radius: 10px;
          padding: 10px 14px; text-align: center; font-size: 11px; color: #15803d; font-weight: 600;
        }
        .no-stock {
          background: #fef9c3; border: 1px solid #fde68a; color: #a16207;
        }

        /* Sections */
        .section { margin-bottom: 24px; }
        .section-title {
          font-size: 13px; font-weight: 700; text-transform: uppercase;
          letter-spacing: 1px; color: #c41e2a; border-bottom: 2px solid #f0f0f0;
          padding-bottom: 6px; margin-bottom: 14px;
        }

        /* Specs */
        .specs-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 8px 20px; }
        .spec-item { display: flex; justify-content: space-between; padding: 6px 0; border-bottom: 1px solid #f5f5f5; font-size: 11px; }
        .spec-label { color: #666; }
        .spec-value { font-weight: 600; text-align: right; }

        /* Description */
        .description { font-size: 12px; line-height: 1.7; color: #444; }

        /* Benefits */
        .benefits-list { list-style: none; }
        .benefit-item {
          padding: 10px 14px; margin-bottom: 8px; border-radius: 10px;
          background: #fafafa; border-left: 3px solid #c41e2a;
          font-size: 12px; line-height: 1.5; color: #333;
        }

        /* CTA */
        .cta-section {
          background: linear-gradient(135deg, #1a1a1a, #333); border-radius: 16px;
          padding: 28px; text-align: center; color: white; margin-top: 28px;
        }
        .cta-title { font-size: 18px; font-weight: 800; margin-bottom: 6px; }
        .cta-sub { font-size: 12px; opacity: 0.7; margin-bottom: 18px; }
        .cta-seller { font-size: 13px; line-height: 1.8; }
        .cta-seller strong { font-weight: 700; }
        .cta-note {
          margin-top: 14px; padding-top: 14px; border-top: 1px solid rgba(255,255,255,0.15);
          font-size: 11px; font-style: italic; opacity: 0.7;
        }

        /* Footer */
        .footer {
          margin-top: 28px; padding-top: 12px; border-top: 1px solid #e5e5e5;
          display: flex; justify-content: space-between; font-size: 9px; color: #aaa;
        }

        @media print {
          body { padding: 0; }
          .page { padding: 20px; max-width: 100%; }
          @page { margin: 8mm; }
        }
      </style>
    </head>
    <body>
      <div class="page">

        <!-- HEADER -->
        <div class="header">
          <div class="header-left">
            ${logoB64 ? `<img src="${logoB64}" class="logo" />` : ''}
            <div>
              <div class="company-name">REDBUCK EQUIPMENT</div>
              <div class="company-sub">Equipo para taller automotriz</div>
            </div>
          </div>
          <div class="header-contact">
            📞 ${sellerPhone}<br/>
            ${sellerEmail ? `✉️ ${sellerEmail}<br/>` : ''}
            🌐 redbuckequipment.com
          </div>
        </div>

        <!-- HERO -->
        <div class="hero">
          <div class="hero-image">
            ${mainImage ? `<img src="${mainImage}" alt="${product.name}" />` : `<div style="display:flex;align-items:center;justify-content:center;height:100%;color:#ccc;font-size:40px;">📷</div>`}
          </div>
          <div class="hero-info">
            <div class="product-name">${product.name}</div>
            <div class="product-meta">
              ${product.brand} ${product.model}<br/>
              SKU: ${product.sku}
            </div>
            <div class="price-box">
              <div class="price-label">Precio de lista</div>
              <div class="price-value">${fmt(product.listPrice, 'USD')}</div>
              ${showPriceMXN ? `<div class="price-mxn">≈ ${fmt(priceMXN, 'MXN')} MXN</div>` : ''}
            </div>
            <div class="availability ${totalStock > 0 ? '' : 'no-stock'}">
              ${totalStock > 0 ? `✅ ${totalStock} unidades disponibles` : '📦 Disponible sobre pedido'}
              ${product.deliveryDays ? `<br/><span style="font-weight:400;font-size:10px;">Entrega en ${product.deliveryDays} días</span>` : ''}
            </div>
          </div>
        </div>

        <!-- GALLERY -->
        ${galleryHtml}

        <!-- SPECS -->
        <div class="section">
          <div class="section-title">Especificaciones</div>
          <div class="specs-grid">
            <div class="spec-item"><span class="spec-label">Marca</span><span class="spec-value">${product.brand}</span></div>
            <div class="spec-item"><span class="spec-label">Modelo</span><span class="spec-value">${product.model}</span></div>
            <div class="spec-item"><span class="spec-label">Categoría</span><span class="spec-value">${product.category}</span></div>
            <div class="spec-item"><span class="spec-label">Garantía</span><span class="spec-value">${product.warranty}</span></div>
            <div class="spec-item"><span class="spec-label">Tiempo de entrega</span><span class="spec-value">${product.deliveryDays} días</span></div>
            <div class="spec-item"><span class="spec-label">Moneda</span><span class="spec-value">${product.currency}</span></div>
          </div>
        </div>

        <!-- DESCRIPTION -->
        ${product.description ? `
          <div class="section">
            <div class="section-title">Descripción</div>
            <div class="description">
              ${specLines.map(l => `<p style="margin-bottom:6px;">${l}</p>`).join('')}
            </div>
          </div>
        ` : ''}

        <!-- BENEFITS -->
        <div class="section">
          <div class="section-title">¿Por qué elegir este equipo?</div>
          <ul class="benefits-list">
            ${benefits.map(b => `<li class="benefit-item">${b}</li>`).join('')}
          </ul>
        </div>

        <!-- CTA -->
        <div class="cta-section">
          <div class="cta-title">¿Listo para cotizar?</div>
          <div class="cta-sub">Solicita tu cotización personalizada hoy mismo</div>
          <div class="cta-seller">
            <strong>${sellerName}</strong><br/>
            📱 ${sellerPhone}<br/>
            ${sellerEmail ? `✉️ ${sellerEmail}` : ''}
          </div>
          ${customNote ? `<div class="cta-note">"${customNote}"</div>` : ''}
        </div>

        <!-- FOOTER -->
        <div class="footer">
          <span>REDBUCK EQUIPMENT — Ficha técnica comercial</span>
          <span>Generado: ${new Date().toLocaleDateString('es-MX')} · Precios sujetos a cambio sin previo aviso</span>
        </div>

      </div>
      <script>setTimeout(() => { window.print(); }, 800);</script>
    </body>
    </html>
  `);
  printWindow.document.close();
}
