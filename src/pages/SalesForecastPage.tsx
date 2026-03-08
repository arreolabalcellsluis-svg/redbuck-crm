import { useState, useMemo } from 'react';
import { useQuotations } from '@/hooks/useQuotations';
import { useOrders } from '@/hooks/useOrders';
import { useCustomers } from '@/hooks/useCustomers';
import { useSalesGoals, useCommissionConfig } from '@/hooks/useSalesGoals';
import { calcAllVendorKPIs, getVendors } from '@/lib/vendorKPIsEngine';
import { calcAllVendorForecasts, calcTeamForecast, type VendorForecast } from '@/lib/vendorForecastEngine';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Button } from '@/components/ui/button';
import {
  TrendingUp, Target, Users, AlertTriangle, BarChart3, Eye,
  DollarSign, FileText, ArrowUpDown, ShieldCheck, Zap, Download,
} from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell, Legend,
  RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, Radar,
} from 'recharts';

const MONTHS = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'];
const fmt = (n: number) => new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN', maximumFractionDigits: 0 }).format(n);
const fmtPct = (n: number) => `${n.toFixed(1)}%`;

const confidenceBadge = (c: string, score: number) => {
  const cls = c === 'alta' ? 'bg-green-100 text-green-800' : c === 'media' ? 'bg-amber-100 text-amber-800' : 'bg-red-100 text-red-800';
  return <Badge className={`${cls} text-xs`}>{score}/100</Badge>;
};

const progressColor = (p: number) => p >= 100 ? 'text-green-600' : p >= 70 ? 'text-amber-600' : 'text-destructive';

export default function SalesForecastPage() {
  const now = new Date();
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [year, setYear] = useState(now.getFullYear());
  const [selectedVendor, setSelectedVendor] = useState<string | null>(null);
  const [sortBy, setSortBy] = useState<'forecast' | 'completion' | 'confidence' | 'pipeline'>('forecast');

  const { data: quotations = [] } = useQuotations();
  const { data: orders = [] } = useOrders();
  const { data: customers = [] } = useCustomers();
  const { data: goals = [] } = useSalesGoals(month, year);
  const { data: configData } = useCommissionConfig();
  const vendors = getVendors();

  const vendorKPIs = useMemo(() =>
    calcAllVendorKPIs(quotations, orders, customers, goals, month, year, configData?.config, configData?.weights, configData?.levels),
    [quotations, orders, customers, goals, month, year, configData]
  );

  const forecasts = useMemo(() =>
    calcAllVendorForecasts(vendorKPIs, quotations, month, year),
    [vendorKPIs, quotations, month, year]
  );

  const team = useMemo(() => calcTeamForecast(forecasts), [forecasts]);

  const sortedForecasts = useMemo(() => {
    const copy = [...forecasts];
    switch (sortBy) {
      case 'completion': return copy.sort((a, b) => b.projectedCompletion - a.projectedCompletion);
      case 'confidence': return copy.sort((a, b) => b.confidenceScore - a.confidenceScore);
      case 'pipeline': return copy.sort((a, b) => b.pipelineWeighted - a.pipelineWeighted);
      default: return copy.sort((a, b) => b.forecastTotal - a.forecastTotal);
    }
  }, [forecasts, sortBy]);

  const selectedForecast = selectedVendor ? forecasts.find(f => f.vendorId === selectedVendor) : null;

  // Excel download state
  const [dlOpen, setDlOpen] = useState(false);
  const [dlDateFrom, setDlDateFrom] = useState('');
  const [dlDateTo, setDlDateTo] = useState('');

  const handleExcelDownload = async () => {
    const XLSX = await import('xlsx');
    const { saveAs } = await import('file-saver');
    const wb = XLSX.utils.book_new();

    const forecastData = sortedForecasts.map(f => ({
      Vendedor: f.vendorName, Vendido: f.salesActual, 'Pipeline total': f.pipelineTotal,
      'Pipeline ponderado': f.pipelineWeighted, Pronóstico: f.forecastTotal, Meta: f.goalSales,
      'Cumplimiento %': f.projectedCompletion, Gap: f.gap, 'Tasa cierre %': Number(f.closeRateHistoric.toFixed(1)),
      'Cotizaciones abiertas': f.openQuotations.length, Confianza: f.confidenceScore,
      'Nivel confianza': f.confidence, '¿Cumple meta?': f.willMeetGoal ? 'Sí' : 'No',
    }));
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(forecastData), 'Pronósticos');

    const teamData = [
      { Indicador: 'Periodo', Valor: `${MONTHS[month - 1]} ${year}` },
      { Indicador: 'Rango', Valor: dlDateFrom && dlDateTo ? `${dlDateFrom} a ${dlDateTo}` : 'Mes completo' },
      { Indicador: 'Total vendido', Valor: team.totalSalesActual },
      { Indicador: 'Pipeline ponderado', Valor: team.totalPipelineWeighted },
      { Indicador: 'Pronóstico total', Valor: team.totalForecast },
      { Indicador: 'Meta total', Valor: team.totalGoal },
      { Indicador: 'Cumplimiento proyectado %', Valor: team.projectedCompletion },
      { Indicador: 'Confianza promedio', Valor: team.avgConfidenceScore },
      { Indicador: 'Exceden meta', Valor: team.vendorsExceeding },
      { Indicador: 'En riesgo', Valor: team.vendorsAtRisk },
    ];
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(teamData), 'Resumen Equipo');

    if (team.alerts.length > 0) {
      const alertData = team.alerts.map(a => ({ Vendedor: a.vendorName, Tipo: a.type, Mensaje: a.message }));
      XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(alertData), 'Alertas');
    }

    const buf = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
    const blob = new Blob([buf], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    const dateStr = dlDateFrom && dlDateTo ? `${dlDateFrom}_${dlDateTo}` : `${MONTHS[month-1]}-${year}`;
    saveAs(blob, `pronostico-ventas_${dateStr}.xlsx`);
    setDlOpen(false);
  };

  const barData = sortedForecasts.map(f => ({
    name: f.vendorName.split(' ')[0],
    'Vendido': f.salesActual,
    'Pipeline ponderado': f.pipelineWeighted,
    'Meta': f.goalSales,
  }));

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-display font-bold text-foreground flex items-center gap-2">
            <TrendingUp className="text-primary" size={28} /> Pronóstico de Ventas
          </h1>
          <p className="text-sm text-muted-foreground">Proyección comercial por vendedor — {MONTHS[month - 1]} {year}</p>
        </div>
        <div className="flex items-center gap-2">
          <Select value={String(month)} onValueChange={v => setMonth(Number(v))}>
            <SelectTrigger className="w-36"><SelectValue /></SelectTrigger>
            <SelectContent>{MONTHS.map((m, i) => <SelectItem key={i} value={String(i + 1)}>{m}</SelectItem>)}</SelectContent>
          </Select>
          <Select value={String(year)} onValueChange={v => setYear(Number(v))}>
            <SelectTrigger className="w-24"><SelectValue /></SelectTrigger>
            <SelectContent>{[2025, 2026, 2027].map(y => <SelectItem key={y} value={String(y)}>{y}</SelectItem>)}</SelectContent>
          </Select>
          <Button variant="outline" size="sm" onClick={() => setDlOpen(true)}>
            <Download size={14} className="mr-1" /> Excel
          </Button>
        </div>
      </div>

      <Tabs defaultValue="ejecutivo">
        <TabsList className="flex flex-wrap gap-1 h-auto p-1">
          <TabsTrigger value="ejecutivo"><BarChart3 size={14} className="mr-1" />Ejecutivo</TabsTrigger>
          <TabsTrigger value="ranking"><ArrowUpDown size={14} className="mr-1" />Ranking</TabsTrigger>
          <TabsTrigger value="individual"><Eye size={14} className="mr-1" />Individual</TabsTrigger>
          <TabsTrigger value="alertas" className="relative">
            <AlertTriangle size={14} className="mr-1" />Alertas
            {team.alerts.length > 0 && <Badge variant="destructive" className="ml-1 h-5 px-1.5 text-[10px]">{team.alerts.length}</Badge>}
          </TabsTrigger>
        </TabsList>

        {/* ═══ EJECUTIVO ═══ */}
        <TabsContent value="ejecutivo" className="space-y-4">
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3">
            <SummaryCard icon={<DollarSign size={18} />} label="Vendido" value={fmt(team.totalSalesActual)} />
            <SummaryCard icon={<FileText size={18} />} label="Pipeline ponderado" value={fmt(team.totalPipelineWeighted)} sub={`Total: ${fmt(team.totalPipeline)}`} />
            <SummaryCard icon={<TrendingUp size={18} />} label="Pronóstico" value={fmt(team.totalForecast)} highlight />
            <SummaryCard icon={<Target size={18} />} label="Meta" value={fmt(team.totalGoal)} sub={`Cumpl: ${team.projectedCompletion}%`} />
            <SummaryCard icon={<ShieldCheck size={18} />} label="Confianza prom." value={`${team.avgConfidenceScore}/100`} />
            <SummaryCard icon={<Users size={18} />} label="Vendedores" value={`${team.vendorsExceeding}✅ ${team.vendorsOnTrack}⚠️ ${team.vendorsAtRisk}🔴`} />
          </div>

          {/* Forecast vs Goal chart */}
          <Card>
            <CardHeader><CardTitle className="text-base">Pronóstico vs Meta por vendedor</CardTitle></CardHeader>
            <CardContent>
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={barData} layout="vertical">
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                    <XAxis type="number" tickFormatter={v => `$${(v / 1000).toFixed(0)}K`} stroke="hsl(var(--muted-foreground))" fontSize={11} />
                    <YAxis type="category" dataKey="name" width={80} stroke="hsl(var(--muted-foreground))" fontSize={11} />
                    <Tooltip formatter={(v: number) => fmt(v)} />
                    <Legend wrapperStyle={{ fontSize: 11 }} />
                    <Bar dataKey="Vendido" stackId="a" fill="hsl(var(--primary))" radius={[0, 0, 0, 0]} />
                    <Bar dataKey="Pipeline ponderado" stackId="a" fill="hsl(var(--chart-3))" radius={[0, 4, 4, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>

          {/* Quick table */}
          <Card>
            <CardContent className="pt-4 overflow-x-auto">
              <table className="w-full text-sm">
                <thead><tr className="border-b text-muted-foreground text-xs">
                  <th className="text-left py-2 px-1">Vendedor</th>
                  <th className="text-right px-1">Vendido</th>
                  <th className="text-right px-1">Pipeline</th>
                  <th className="text-right px-1">Pronóstico</th>
                  <th className="text-right px-1">Meta</th>
                  <th className="text-right px-1">Cumpl.</th>
                  <th className="text-right px-1">Confianza</th>
                </tr></thead>
                <tbody>{sortedForecasts.map(f => (
                  <tr key={f.vendorId} className="border-b hover:bg-muted/30">
                    <td className="py-2 px-1 font-medium">{f.vendorName}</td>
                    <td className="py-2 px-1 text-right font-mono">{fmt(f.salesActual)}</td>
                    <td className="py-2 px-1 text-right font-mono">{fmt(f.pipelineWeighted)}</td>
                    <td className="py-2 px-1 text-right font-mono font-bold">{fmt(f.forecastTotal)}</td>
                    <td className="py-2 px-1 text-right font-mono">{fmt(f.goalSales)}</td>
                    <td className="py-2 px-1 text-right"><span className={`font-bold ${progressColor(f.projectedCompletion)}`}>{f.projectedCompletion}%</span></td>
                    <td className="py-2 px-1 text-right">{confidenceBadge(f.confidence, f.confidenceScore)}</td>
                  </tr>
                ))}</tbody>
              </table>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ═══ RANKING ═══ */}
        <TabsContent value="ranking" className="space-y-4">
          <div className="flex items-center gap-2 text-sm flex-wrap">
            <ArrowUpDown size={14} className="text-muted-foreground" />
            {(['forecast', 'completion', 'confidence', 'pipeline'] as const).map(key => (
              <Button key={key} variant={sortBy === key ? 'default' : 'outline'} size="sm" onClick={() => setSortBy(key)}>
                {{ forecast: 'Pronóstico', completion: 'Cumplimiento', confidence: 'Confianza', pipeline: 'Pipeline' }[key]}
              </Button>
            ))}
          </div>
          <Card><CardContent className="pt-4 overflow-x-auto">
            <table className="w-full text-sm">
              <thead><tr className="border-b text-muted-foreground text-xs">
                <th className="text-left py-2 px-1">#</th>
                <th className="text-left py-2 px-1">Vendedor</th>
                <th className="text-right px-1">Vendido</th>
                <th className="text-right px-1">Pipeline</th>
                <th className="text-right px-1">Ponderado</th>
                <th className="text-right px-1">Pronóstico</th>
                <th className="text-right px-1">Meta</th>
                <th className="text-right px-1">Cumpl.</th>
                <th className="text-right px-1">Gap</th>
                <th className="text-right px-1">Cierre</th>
                <th className="text-right px-1">Cotiz.</th>
                <th className="text-right px-1">Confianza</th>
                <th className="text-center px-1">Estado</th>
              </tr></thead>
              <tbody>{sortedForecasts.map((f, i) => (
                <tr key={f.vendorId} className="border-b hover:bg-muted/30 cursor-pointer" onClick={() => { setSelectedVendor(f.vendorId); }}>
                  <td className="py-2 px-1 font-bold">{i < 3 ? ['🥇','🥈','🥉'][i] : i + 1}</td>
                  <td className="py-2 px-1 font-medium">{f.vendorName}</td>
                  <td className="py-2 px-1 text-right font-mono">{fmt(f.salesActual)}</td>
                  <td className="py-2 px-1 text-right font-mono text-muted-foreground">{fmt(f.pipelineTotal)}</td>
                  <td className="py-2 px-1 text-right font-mono">{fmt(f.pipelineWeighted)}</td>
                  <td className="py-2 px-1 text-right font-mono font-bold">{fmt(f.forecastTotal)}</td>
                  <td className="py-2 px-1 text-right font-mono">{fmt(f.goalSales)}</td>
                  <td className="py-2 px-1 text-right"><span className={`font-bold ${progressColor(f.projectedCompletion)}`}>{f.projectedCompletion}%</span></td>
                  <td className="py-2 px-1 text-right font-mono">{f.gap > 0 ? <span className="text-destructive">-{fmt(f.gap)}</span> : <span className="text-green-600">+{fmt(Math.abs(f.gap))}</span>}</td>
                  <td className="py-2 px-1 text-right">{f.closeRateHistoric.toFixed(0)}%</td>
                  <td className="py-2 px-1 text-right">{f.openQuotations.length}</td>
                  <td className="py-2 px-1 text-right">{confidenceBadge(f.confidence, f.confidenceScore)}</td>
                  <td className="py-2 px-1 text-center">{f.willMeetGoal ? '✅' : f.projectedCompletion >= 70 ? '⚠️' : '🔴'}</td>
                </tr>
              ))}</tbody>
            </table>
          </CardContent></Card>
        </TabsContent>

        {/* ═══ INDIVIDUAL ═══ */}
        <TabsContent value="individual" className="space-y-4">
          <Select value={selectedVendor ?? ''} onValueChange={v => setSelectedVendor(v)}>
            <SelectTrigger className="w-60"><SelectValue placeholder="Selecciona vendedor" /></SelectTrigger>
            <SelectContent>{vendors.map(v => <SelectItem key={v.id} value={v.id}>{v.name}</SelectItem>)}</SelectContent>
          </Select>

          {selectedForecast ? (
            <>
              {/* Score banner */}
              <Card className={`border-l-4 ${selectedForecast.confidence === 'alta' ? 'border-l-green-500' : selectedForecast.confidence === 'media' ? 'border-l-amber-500' : 'border-l-destructive'}`}>
                <CardContent className="pt-4 flex flex-wrap items-center justify-between gap-4">
                  <div>
                    <div className="text-sm text-muted-foreground">Pronóstico total</div>
                    <div className="text-3xl font-bold">{fmt(selectedForecast.forecastTotal)}</div>
                  </div>
                  <div className="text-center">
                    <div className="text-sm text-muted-foreground">Cumplimiento proyectado</div>
                    <div className={`text-2xl font-bold ${progressColor(selectedForecast.projectedCompletion)}`}>{selectedForecast.projectedCompletion}%</div>
                  </div>
                  <div className="text-right">
                    <div className="text-sm text-muted-foreground">Confianza</div>
                    <div className="flex items-center gap-2 justify-end">
                      {confidenceBadge(selectedForecast.confidence, selectedForecast.confidenceScore)}
                      <span className="text-xs capitalize">{selectedForecast.confidence}</span>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3">
                <KPICard label="Vendido" value={fmt(selectedForecast.salesActual)} sub={`${selectedForecast.ordersActual} pedidos`} />
                <KPICard label="Pipeline total" value={fmt(selectedForecast.pipelineTotal)} sub={`${selectedForecast.openQuotations.length} cotizaciones`} />
                <KPICard label="Pipeline ponderado" value={fmt(selectedForecast.pipelineWeighted)} />
                <KPICard label="Meta" value={fmt(selectedForecast.goalSales)} sub={selectedForecast.gap > 0 ? `Falta: ${fmt(selectedForecast.gap)}` : `Excede: ${fmt(Math.abs(selectedForecast.gap))}`} />
                <KPICard label="Tasa cierre" value={`${selectedForecast.closeRateHistoric.toFixed(0)}%`} />
                <KPICard label="Run rate diario" value={fmt(selectedForecast.dailyRunRate)} sub={`Proy: ${fmt(selectedForecast.projectedByRunRate)}`} />
              </div>

              <div className="grid md:grid-cols-2 gap-4">
                {/* Radar */}
                <Card>
                  <CardHeader><CardTitle className="text-base">Perfil de pronóstico</CardTitle></CardHeader>
                  <CardContent>
                    <div className="h-56">
                      <ResponsiveContainer width="100%" height="100%">
                        <RadarChart data={[
                          { metric: 'Vendido', value: Math.min(selectedForecast.goalSales > 0 ? (selectedForecast.salesActual / selectedForecast.goalSales) * 100 : 0, 150) },
                          { metric: 'Pipeline', value: Math.min(selectedForecast.goalSales > 0 ? (selectedForecast.pipelineWeighted / selectedForecast.goalSales) * 100 : 0, 150) },
                          { metric: 'Cierre', value: Math.min(selectedForecast.closeRateHistoric * 2, 100) },
                          { metric: 'Confianza', value: selectedForecast.confidenceScore },
                          { metric: 'Score', value: selectedForecast.scoreCommercial },
                        ]}>
                          <PolarGrid stroke="hsl(var(--border))" />
                          <PolarAngleAxis dataKey="metric" tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }} />
                          <PolarRadiusAxis angle={90} domain={[0, 100]} tick={{ fontSize: 10 }} />
                          <Radar dataKey="value" stroke="hsl(var(--primary))" fill="hsl(var(--primary))" fillOpacity={0.3} />
                        </RadarChart>
                      </ResponsiveContainer>
                    </div>
                  </CardContent>
                </Card>

                {/* Confidence factors */}
                <Card>
                  <CardHeader><CardTitle className="text-base">Factores de confianza</CardTitle></CardHeader>
                  <CardContent className="space-y-2">
                    {selectedForecast.confidenceFactors.map((f, i) => (
                      <div key={i} className="flex items-center gap-2 text-sm">
                        <Zap size={12} className="text-primary" />
                        <span>{f}</span>
                      </div>
                    ))}
                    <div className="pt-3 border-t space-y-1">
                      <DetailRow label="Días transcurridos" value={`${selectedForecast.daysElapsed} / ${selectedForecast.daysInPeriod}`} />
                      <DetailRow label="Prom. cotización" value={fmt(selectedForecast.avgQuotationAmount)} />
                      <DetailRow label="Cotizaciones activas" value={String(selectedForecast.openQuotations.length)} />
                    </div>
                  </CardContent>
                </Card>
              </div>

              {/* Pipeline detail */}
              {selectedForecast.openQuotations.length > 0 && (
                <Card>
                  <CardHeader><CardTitle className="text-base">Pipeline — Probabilidad por cotización</CardTitle></CardHeader>
                  <CardContent className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead><tr className="border-b text-muted-foreground text-xs">
                        <th className="text-left py-2 px-1">Folio</th>
                        <th className="text-left px-1">Cliente</th>
                        <th className="text-right px-1">Monto</th>
                        <th className="text-center px-1">Estatus</th>
                        <th className="text-right px-1">Días</th>
                        <th className="text-right px-1">Últ. act.</th>
                        <th className="text-center px-1">Seguim.</th>
                        <th className="text-right px-1">Prob.</th>
                        <th className="text-right px-1">Valor pond.</th>
                      </tr></thead>
                      <tbody>{selectedForecast.openQuotations.map(q => (
                        <tr key={q.quotationId} className="border-b hover:bg-muted/30">
                          <td className="py-2 px-1 font-mono text-xs">{q.folio}</td>
                          <td className="py-2 px-1">{q.customerName}</td>
                          <td className="py-2 px-1 text-right font-mono">{fmt(q.total)}</td>
                          <td className="py-2 px-1 text-center"><Badge variant="outline" className="text-[10px]">{q.status}</Badge></td>
                          <td className="py-2 px-1 text-right">{q.daysSinceCreation}d</td>
                          <td className="py-2 px-1 text-right">{q.daysSinceUpdate}d</td>
                          <td className="py-2 px-1 text-center">{q.hasFollowup ? '✅' : '—'}</td>
                          <td className="py-2 px-1 text-right">
                            <Badge className={`text-xs ${q.probability >= 70 ? 'bg-green-100 text-green-800' : q.probability >= 40 ? 'bg-amber-100 text-amber-800' : 'bg-red-100 text-red-800'}`}>
                              {q.probability}%
                            </Badge>
                          </td>
                          <td className="py-2 px-1 text-right font-mono font-bold">{fmt(q.weightedValue)}</td>
                        </tr>
                      ))}</tbody>
                    </table>
                  </CardContent>
                </Card>
              )}
            </>
          ) : (
            <Card><CardContent className="py-16 text-center text-muted-foreground">Selecciona un vendedor para ver su pronóstico detallado</CardContent></Card>
          )}
        </TabsContent>

        {/* ═══ ALERTAS ═══ */}
        <TabsContent value="alertas" className="space-y-3">
          {team.alerts.length === 0 ? (
            <Card><CardContent className="py-12 text-center text-muted-foreground">Sin alertas de pronóstico para este período</CardContent></Card>
          ) : team.alerts.map((a, i) => (
            <Card key={i} className={`border-l-4 ${a.type === 'danger' ? 'border-l-destructive' : a.type === 'warning' ? 'border-l-amber-500' : 'border-l-blue-500'}`}>
              <CardContent className="pt-3 pb-3 flex items-center gap-3">
                <AlertTriangle size={16} className={a.type === 'danger' ? 'text-destructive' : a.type === 'warning' ? 'text-amber-500' : 'text-blue-500'} />
                <span className="font-medium text-sm">{a.vendorName}</span>
                <span className="text-sm text-muted-foreground">{a.message}</span>
              </CardContent>
            </Card>
          ))}
        </TabsContent>
      </Tabs>

      <Dialog open={dlOpen} onOpenChange={setDlOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>Descargar Pronóstico Excel</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">Selecciona el rango de fechas (opcional).</p>
            <div className="grid grid-cols-2 gap-3">
              <div><Label>Desde</Label><Input type="date" value={dlDateFrom} onChange={e => setDlDateFrom(e.target.value)} /></div>
              <div><Label>Hasta</Label><Input type="date" value={dlDateTo} onChange={e => setDlDateTo(e.target.value)} /></div>
            </div>
            <Button onClick={handleExcelDownload} className="w-full"><Download size={14} className="mr-2" />Descargar Excel</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ─── Sub-components ─────────────────────────────────────────────

function SummaryCard({ icon, label, value, sub, highlight }: { icon: React.ReactNode; label: string; value: string; sub?: string; highlight?: boolean }) {
  return (
    <Card className={highlight ? 'border-primary/50 bg-primary/5' : ''}>
      <CardContent className="pt-4 text-center space-y-1">
        <div className="mx-auto text-primary">{icon}</div>
        <div className={`text-lg font-bold ${highlight ? 'text-primary' : ''}`}>{value}</div>
        <div className="text-[11px] text-muted-foreground">{label}</div>
        {sub && <div className="text-[10px] text-muted-foreground">{sub}</div>}
      </CardContent>
    </Card>
  );
}

function KPICard({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <Card>
      <CardContent className="pt-4 space-y-1">
        <div className="text-xs text-muted-foreground">{label}</div>
        <div className="text-xl font-bold">{value}</div>
        {sub && <div className="text-[11px] text-muted-foreground">{sub}</div>}
      </CardContent>
    </Card>
  );
}

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between py-1.5 border-b border-border/50 last:border-0">
      <span className="text-sm text-muted-foreground">{label}</span>
      <span className="text-sm font-medium">{value}</span>
    </div>
  );
}
