/**
 * REDBUCK – Vendor Sales Forecast Engine
 * Per-vendor sales forecasting using existing KPIs, pipeline, and close rates.
 *
 * REUSES:
 * - VendorKPI, calcAllVendorKPIs from vendorKPIsEngine (pipeline, closeRate, sales, goals)
 * - DBQuotation from useQuotations (per-quotation probability)
 * - SalesGoal from vendorKPIsEngine (goals)
 */

import type { VendorKPI } from './vendorKPIsEngine';
import type { DBQuotation } from '@/hooks/useQuotations';

// ─── Types ──────────────────────────────────────────────────────

export interface QuotationProbability {
  quotationId: string;
  folio: string;
  customerName: string;
  total: number;
  status: string;
  daysSinceCreation: number;
  daysSinceUpdate: number;
  hasFollowup: boolean;
  probability: number; // 0-100
  probabilityLabel: string;
  weightedValue: number; // total × probability/100
}

export type ConfidenceLevel = 'alta' | 'media' | 'baja';

export interface VendorForecast {
  vendorId: string;
  vendorName: string;
  // Current period actuals (from VendorKPI)
  salesActual: number;
  ordersActual: number;
  quotationsCount: number;
  closeRateHistoric: number;
  scoreCommercial: number;
  // Pipeline
  pipelineTotal: number;
  pipelineWeighted: number; // sum of weighted values
  openQuotations: QuotationProbability[];
  avgQuotationAmount: number;
  // Forecast
  forecastTotal: number; // salesActual + pipelineWeighted
  // Goal comparison
  goalSales: number;
  projectedCompletion: number; // forecastTotal / goalSales × 100
  gap: number; // goalSales - forecastTotal (negative = surplus)
  willMeetGoal: boolean;
  // Confidence
  confidence: ConfidenceLevel;
  confidenceScore: number; // 0-100
  confidenceFactors: string[];
  // Days remaining estimation
  daysInPeriod: number;
  daysElapsed: number;
  dailyRunRate: number;
  projectedByRunRate: number;
}

export interface ForecastAlert {
  vendorName: string;
  type: 'danger' | 'warning' | 'info';
  message: string;
  metric?: string;
}

export interface TeamForecast {
  totalSalesActual: number;
  totalPipeline: number;
  totalPipelineWeighted: number;
  totalForecast: number;
  totalGoal: number;
  projectedCompletion: number;
  vendorsAtRisk: number;
  vendorsOnTrack: number;
  vendorsExceeding: number;
  avgConfidenceScore: number;
  avgCloseRate: number;
  alerts: ForecastAlert[];
}

// ─── Quotation Probability Calculator ───────────────────────────

const OPEN_STATUSES = ['borrador', 'enviada', 'vista', 'seguimiento'];

function calcQuotationProbability(q: DBQuotation, vendorCloseRate: number): QuotationProbability {
  const now = new Date();
  const created = new Date(q.created_at);
  const updated = new Date(q.updated_at);
  const daysSinceCreation = Math.floor((now.getTime() - created.getTime()) / 86400000);
  const daysSinceUpdate = Math.floor((now.getTime() - updated.getTime()) / 86400000);
  const hasFollowup = q.status === 'seguimiento';

  // Base probability from vendor's historic close rate
  let probability = Math.min(vendorCloseRate, 80);

  // Status modifiers
  switch (q.status) {
    case 'seguimiento': probability += 15; break;
    case 'vista': probability += 10; break;
    case 'enviada': probability += 0; break;
    case 'borrador': probability -= 15; break;
  }

  // Age penalty: older quotations are less likely
  if (daysSinceCreation > 30) probability -= 20;
  else if (daysSinceCreation > 15) probability -= 10;
  else if (daysSinceCreation > 7) probability -= 5;

  // Recent activity bonus
  if (daysSinceUpdate <= 3) probability += 10;
  else if (daysSinceUpdate <= 7) probability += 5;

  // Inactivity penalty
  if (daysSinceUpdate > 14) probability -= 15;
  else if (daysSinceUpdate > 7) probability -= 5;

  // Clamp
  probability = Math.max(5, Math.min(95, probability));

  const label = probability >= 70 ? 'Alta' : probability >= 40 ? 'Media' : 'Baja';

  return {
    quotationId: q.id,
    folio: q.folio,
    customerName: q.customer_name,
    total: q.total,
    status: q.status,
    daysSinceCreation,
    daysSinceUpdate,
    hasFollowup,
    probability: Math.round(probability),
    probabilityLabel: label,
    weightedValue: q.total * (probability / 100),
  };
}

// ─── Confidence Calculator ──────────────────────────────────────

function calcConfidence(
  kpi: VendorKPI,
  openQuotations: QuotationProbability[],
  daysElapsed: number,
  daysInPeriod: number,
): { level: ConfidenceLevel; score: number; factors: string[] } {
  let score = 50; // baseline
  const factors: string[] = [];

  // Factor 1: Enough pipeline
  const pipelineToGoalRatio = kpi.goalSales > 0 ? (kpi.pipeline / kpi.goalSales) * 100 : 0;
  if (pipelineToGoalRatio > 50) { score += 10; factors.push('Pipeline suficiente'); }
  else if (pipelineToGoalRatio < 20) { score -= 15; factors.push('Pipeline insuficiente'); }

  // Factor 2: Close rate stability
  if (kpi.closeRate >= 40) { score += 15; factors.push('Tasa de cierre alta'); }
  else if (kpi.closeRate >= 25) { score += 5; factors.push('Tasa de cierre aceptable'); }
  else if (kpi.closeRate > 0) { score -= 10; factors.push('Tasa de cierre baja'); }

  // Factor 3: Recent activity
  const recentQuotations = openQuotations.filter(q => q.daysSinceUpdate <= 7).length;
  if (recentQuotations >= 3) { score += 10; factors.push('Actividad reciente alta'); }
  else if (recentQuotations === 0 && openQuotations.length > 0) { score -= 10; factors.push('Sin actividad reciente'); }

  // Factor 4: Commercial score
  if (kpi.score >= 60) { score += 10; factors.push('Score comercial alto'); }
  else if (kpi.score < 30) { score -= 10; factors.push('Score comercial bajo'); }

  // Factor 5: Time elapsed - more data = more confidence
  const timeRatio = daysElapsed / daysInPeriod;
  if (timeRatio > 0.5) { score += 5; factors.push('Datos suficientes del período'); }
  else { score -= 5; factors.push('Período en etapa temprana'); }

  // Factor 6: Number of open opportunities
  if (openQuotations.length >= 5) { score += 5; factors.push('Diversidad de oportunidades'); }
  else if (openQuotations.length <= 1) { score -= 10; factors.push('Pocas oportunidades abiertas'); }

  score = Math.max(10, Math.min(95, score));
  const level: ConfidenceLevel = score >= 65 ? 'alta' : score >= 40 ? 'media' : 'baja';

  return { level, score: Math.round(score), factors };
}

// ─── Main Forecast Calculator ───────────────────────────────────

export function calcVendorForecast(
  kpi: VendorKPI,
  allQuotations: DBQuotation[],
  month: number,
  year: number,
): VendorForecast {
  // Period dates
  const periodStart = new Date(year, month - 1, 1);
  const periodEnd = new Date(year, month, 0);
  const now = new Date();
  const daysInPeriod = periodEnd.getDate();
  const daysElapsed = Math.max(1, Math.min(daysInPeriod, Math.floor((now.getTime() - periodStart.getTime()) / 86400000)));

  // Open quotations for this vendor
  const vendorOpenQuotations = allQuotations
    .filter(q => q.vendor_id === kpi.vendorId && OPEN_STATUSES.includes(q.status))
    .map(q => calcQuotationProbability(q, kpi.closeRate));

  const pipelineTotal = vendorOpenQuotations.reduce((s, q) => s + q.total, 0);
  const pipelineWeighted = vendorOpenQuotations.reduce((s, q) => s + q.weightedValue, 0);
  const avgQuotationAmount = vendorOpenQuotations.length > 0
    ? pipelineTotal / vendorOpenQuotations.length : 0;

  // Forecast
  const forecastTotal = kpi.sales + pipelineWeighted;

  // Run rate projection
  const dailyRunRate = daysElapsed > 0 ? kpi.sales / daysElapsed : 0;
  const projectedByRunRate = dailyRunRate * daysInPeriod;

  // Goal
  const projectedCompletion = kpi.goalSales > 0
    ? Math.round((forecastTotal / kpi.goalSales) * 100) : 0;
  const gap = kpi.goalSales - forecastTotal;
  const willMeetGoal = forecastTotal >= kpi.goalSales;

  // Confidence
  const { level: confidence, score: confidenceScore, factors: confidenceFactors } =
    calcConfidence(kpi, vendorOpenQuotations, daysElapsed, daysInPeriod);

  return {
    vendorId: kpi.vendorId,
    vendorName: kpi.vendorName,
    salesActual: kpi.sales,
    ordersActual: kpi.orders,
    quotationsCount: kpi.quotations,
    closeRateHistoric: kpi.closeRate,
    scoreCommercial: kpi.score,
    pipelineTotal,
    pipelineWeighted,
    openQuotations: vendorOpenQuotations.sort((a, b) => b.probability - a.probability),
    avgQuotationAmount,
    forecastTotal,
    goalSales: kpi.goalSales,
    projectedCompletion,
    gap,
    willMeetGoal,
    confidence,
    confidenceScore,
    confidenceFactors,
    daysInPeriod,
    daysElapsed,
    dailyRunRate,
    projectedByRunRate,
  };
}

// ─── All Vendors Forecast ───────────────────────────────────────

export function calcAllVendorForecasts(
  vendorKPIs: VendorKPI[],
  allQuotations: DBQuotation[],
  month: number,
  year: number,
): VendorForecast[] {
  return vendorKPIs
    .map(kpi => calcVendorForecast(kpi, allQuotations, month, year))
    .sort((a, b) => b.forecastTotal - a.forecastTotal);
}

// ─── Team Forecast ──────────────────────────────────────────────

export function calcTeamForecast(
  forecasts: VendorForecast[],
): TeamForecast {
  const totalSalesActual = forecasts.reduce((s, f) => s + f.salesActual, 0);
  const totalPipeline = forecasts.reduce((s, f) => s + f.pipelineTotal, 0);
  const totalPipelineWeighted = forecasts.reduce((s, f) => s + f.pipelineWeighted, 0);
  const totalForecast = forecasts.reduce((s, f) => s + f.forecastTotal, 0);
  const totalGoal = forecasts.reduce((s, f) => s + f.goalSales, 0);
  const projectedCompletion = totalGoal > 0 ? Math.round((totalForecast / totalGoal) * 100) : 0;

  const vendorsAtRisk = forecasts.filter(f => f.goalSales > 0 && f.projectedCompletion < 70).length;
  const vendorsOnTrack = forecasts.filter(f => f.projectedCompletion >= 70 && f.projectedCompletion < 100).length;
  const vendorsExceeding = forecasts.filter(f => f.projectedCompletion >= 100).length;
  const avgConfidenceScore = forecasts.length > 0
    ? Math.round(forecasts.reduce((s, f) => s + f.confidenceScore, 0) / forecasts.length) : 0;
  const avgCloseRate = forecasts.length > 0
    ? forecasts.reduce((s, f) => s + f.closeRateHistoric, 0) / forecasts.length : 0;

  // Alerts
  const alerts: ForecastAlert[] = [];
  forecasts.forEach(f => {
    if (f.goalSales > 0 && f.projectedCompletion < 50) {
      alerts.push({ vendorName: f.vendorName, type: 'danger', message: `Pronóstico al ${f.projectedCompletion}% de meta — riesgo alto de incumplimiento` });
    } else if (f.goalSales > 0 && f.projectedCompletion < 70) {
      alerts.push({ vendorName: f.vendorName, type: 'warning', message: `Pronóstico al ${f.projectedCompletion}% — necesita impulso comercial` });
    }
    if (f.pipelineTotal === 0 && f.goalSales > f.salesActual) {
      alerts.push({ vendorName: f.vendorName, type: 'danger', message: 'Sin pipeline abierto y meta pendiente' });
    }
    if (f.confidence === 'baja') {
      alerts.push({ vendorName: f.vendorName, type: 'warning', message: `Confianza baja (${f.confidenceScore}/100) — calidad de pipeline débil` });
    }
    if (f.openQuotations.length > 0) {
      const oldUnfollowed = f.openQuotations.filter(q => q.daysSinceUpdate > 14).length;
      if (oldUnfollowed > 0) {
        alerts.push({ vendorName: f.vendorName, type: 'info', message: `${oldUnfollowed} cotización(es) sin seguimiento >14 días` });
      }
    }
    if (f.closeRateHistoric < 20 && f.quotationsCount >= 3) {
      alerts.push({ vendorName: f.vendorName, type: 'warning', message: `Tasa de cierre baja (${f.closeRateHistoric.toFixed(0)}%) reduce confiabilidad del pronóstico` });
    }
  });

  return {
    totalSalesActual,
    totalPipeline,
    totalPipelineWeighted,
    totalForecast,
    totalGoal,
    projectedCompletion,
    vendorsAtRisk,
    vendorsOnTrack,
    vendorsExceeding,
    avgConfidenceScore,
    avgCloseRate,
    alerts,
  };
}
