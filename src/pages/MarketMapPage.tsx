import { useState, useMemo } from 'react';
import { toast } from 'sonner';
import {
  generateMarketData, getGrowthOpportunities, getMarketAnalytics,
  PENETRATION_LABELS, PENETRATION_DOT_COLORS, PENETRATION_BG,
  type CityMarketData, type PenetrationLevel,
} from '@/lib/marketMapEngine';
import MetricCard from '@/components/shared/MetricCard';
import { Input } from '@/components/ui/input';
import {
  MapPin, Search, Download, Globe, Users, FileText, ShoppingCart,
  TrendingUp, Target, AlertTriangle, ArrowRight, ChevronRight,
  Building2, BarChart3, Eye, X,
} from 'lucide-react';
import * as XLSX from 'xlsx';
import { saveAs } from 'file-saver';

const fmt = (n: number) =>
  new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN', maximumFractionDigits: 0 }).format(n);

// Mexico bounding box for SVG projection
const MEX_BOUNDS = { minLat: 14.5, maxLat: 33, minLng: -118, maxLng: -86.5 };
const SVG_W = 800;
const SVG_H = 480;

function project(lat: number, lng: number): { x: number; y: number } {
  const x = ((lng - MEX_BOUNDS.minLng) / (MEX_BOUNDS.maxLng - MEX_BOUNDS.minLng)) * SVG_W;
  const y = ((MEX_BOUNDS.maxLat - lat) / (MEX_BOUNDS.maxLat - MEX_BOUNDS.minLat)) * SVG_H;
  return { x, y };
}

function bubbleRadius(data: CityMarketData): number {
  const base = data.customers * 3 + data.closedSales * 5 + data.leads * 2;
  return Math.max(8, Math.min(28, 6 + base * 1.5));
}

export default function MarketMapPage() {
  const [allData] = useState(() => generateMarketData());
  const [search, setSearch] = useState('');
  const [filterState, setFilterState] = useState('todos');
  const [filterPenetration, setFilterPenetration] = useState<PenetrationLevel | 'todos'>('todos');
  const [filterVendor, setFilterVendor] = useState('todos');
  const [selectedCity, setSelectedCity] = useState<CityMarketData | null>(null);
  const [activeTab, setActiveTab] = useState<'mapa' | 'oportunidades' | 'analisis'>('mapa');

  const states = useMemo(() => {
    const set = new Set(allData.map(d => d.state).filter(Boolean));
    return Array.from(set).sort();
  }, [allData]);

  const vendors = useMemo(() => {
    const set = new Set(allData.flatMap(d => d.vendors));
    return Array.from(set).sort();
  }, [allData]);

  const filtered = useMemo(() => {
    let list = allData;
    if (filterState !== 'todos') list = list.filter(d => d.state === filterState);
    if (filterPenetration !== 'todos') list = list.filter(d => d.penetration === filterPenetration);
    if (filterVendor !== 'todos') list = list.filter(d => d.vendors.includes(filterVendor));
    if (search) {
      const s = search.toLowerCase();
      list = list.filter(d => d.city.toLowerCase().includes(s) || d.state.toLowerCase().includes(s));
    }
    return list;
  }, [allData, search, filterState, filterPenetration, filterVendor]);

  const growth = useMemo(() => getGrowthOpportunities(filtered), [filtered]);
  const analytics = useMemo(() => getMarketAnalytics(allData), [allData]);

  const exportData = (format: 'csv' | 'xlsx') => {
    const rows = filtered.map(d => ({
      Ciudad: d.city,
      Estado: d.state,
      Clientes: d.customers,
      Leads: d.leads,
      Cotizaciones: d.quotations,
      'Cotizaciones Abiertas': d.openQuotations,
      'Ventas Cerradas': d.closedSales,
      'Valor Ventas': d.totalSalesValue,
      'Valor Potencial': d.potentialValue,
      Penetración: PENETRATION_LABELS[d.penetration],
      Prioridad: d.priority,
      Vendedores: d.vendors.join(', '),
      Oportunidades: d.opportunities.join('; '),
    }));
    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Mapa de Mercado');
    if (format === 'csv') {
      const csv = XLSX.utils.sheet_to_csv(ws);
      saveAs(new Blob([csv], { type: 'text/csv;charset=utf-8' }), 'mapa-mercado.csv');
    } else {
      const buf = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
      saveAs(new Blob([buf]), 'mapa-mercado.xlsx');
    }
    toast.success(`Exportado a ${format.toUpperCase()}`);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="page-header">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-primary flex items-center justify-center">
            <Globe size={20} className="text-primary-foreground" />
          </div>
          <div>
            <h1 className="page-title">Mapa de Mercado</h1>
            <p className="page-subtitle">Visualización geográfica del mercado — {allData.length} ciudades analizadas</p>
          </div>
        </div>
        <div className="flex gap-2 mt-3 sm:mt-0">
          <button onClick={() => exportData('xlsx')} className="inline-flex items-center gap-2 px-3 py-2 rounded-lg border text-sm hover:bg-muted transition-colors">
            <Download size={14} /> Excel
          </button>
          <button onClick={() => exportData('csv')} className="inline-flex items-center gap-2 px-3 py-2 rounded-lg border text-sm hover:bg-muted transition-colors">
            <Download size={14} /> CSV
          </button>
        </div>
      </div>

      {/* Summary KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
        <MetricCard title="Ciudades Total" value={analytics.totalCities} icon={MapPin} variant="primary" />
        <MetricCard title="Con Presencia" value={analytics.citiesWithPresence} icon={Building2} variant="success" />
        <MetricCard title="Cobertura" value={`${analytics.coverageRate}%`} icon={Target} variant="info" />
        <MetricCard title="Ventas Totales" value={fmt(analytics.totalSales)} icon={ShoppingCart} variant="success" />
        <MetricCard title="Valor Potencial" value={fmt(analytics.totalPotential)} icon={TrendingUp} variant="warning" />
        <MetricCard title="Sin Presencia" value={allData.filter(d => d.penetration === 'sin_presencia').length} icon={AlertTriangle} variant="danger" />
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-muted p-1 rounded-lg w-fit">
        {(['mapa', 'oportunidades', 'analisis'] as const).map(tab => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
              activeTab === tab ? 'bg-background shadow-sm text-foreground' : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            {tab === 'mapa' ? '🗺️ Mapa' : tab === 'oportunidades' ? '🎯 Oportunidades' : '📊 Análisis'}
          </button>
        ))}
      </div>

      {/* Filters */}
      <div className="bg-card rounded-xl border p-4">
        <div className="flex flex-wrap gap-3 items-center">
          <div className="relative flex-1 min-w-[200px]">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <Input placeholder="Buscar ciudad o estado..." value={search} onChange={e => setSearch(e.target.value)} className="pl-9" />
          </div>
          <select value={filterState} onChange={e => setFilterState(e.target.value)}
            className="h-10 rounded-md border bg-background px-3 text-sm">
            <option value="todos">Todos los estados</option>
            {states.map(s => <option key={s} value={s}>{s}</option>)}
          </select>
          <select value={filterPenetration} onChange={e => setFilterPenetration(e.target.value as any)}
            className="h-10 rounded-md border bg-background px-3 text-sm">
            <option value="todos">Toda penetración</option>
            <option value="alto">🟢 Alto</option>
            <option value="medio">🟡 Medio</option>
            <option value="bajo">🟠 Bajo</option>
            <option value="sin_presencia">🔴 Sin presencia</option>
          </select>
          <select value={filterVendor} onChange={e => setFilterVendor(e.target.value)}
            className="h-10 rounded-md border bg-background px-3 text-sm">
            <option value="todos">Todos los vendedores</option>
            {vendors.map(v => <option key={v} value={v}>{v}</option>)}
          </select>
        </div>
      </div>

      {/* ═══ TAB: MAPA ═══ */}
      {activeTab === 'mapa' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Map SVG */}
          <div className="lg:col-span-2 bg-card rounded-xl border p-4 overflow-hidden">
            <h3 className="font-display font-semibold mb-3 flex items-center gap-2">
              <MapPin size={16} className="text-primary" /> Mapa Comercial de México
            </h3>
            {/* Legend */}
            <div className="flex gap-4 mb-3 text-xs">
              {(['alto', 'medio', 'bajo', 'sin_presencia'] as PenetrationLevel[]).map(p => (
                <div key={p} className="flex items-center gap-1.5">
                  <span className="w-3 h-3 rounded-full" style={{ backgroundColor: PENETRATION_DOT_COLORS[p] }} />
                  {PENETRATION_LABELS[p]}
                </div>
              ))}
            </div>
            <div className="relative w-full" style={{ paddingBottom: `${(SVG_H / SVG_W) * 100}%` }}>
              <svg
                viewBox={`0 0 ${SVG_W} ${SVG_H}`}
                className="absolute inset-0 w-full h-full"
                style={{ background: 'hsl(var(--muted) / 0.3)' }}
              >
                {/* Simple Mexico outline hint */}
                <rect x={0} y={0} width={SVG_W} height={SVG_H} rx={12} fill="none" stroke="hsl(var(--border))" strokeWidth={1} />
                {/* Grid lines */}
                {[0.25, 0.5, 0.75].map(f => (
                  <g key={f}>
                    <line x1={SVG_W * f} y1={0} x2={SVG_W * f} y2={SVG_H} stroke="hsl(var(--border))" strokeWidth={0.5} strokeDasharray="4 4" />
                    <line x1={0} y1={SVG_H * f} x2={SVG_W} y2={SVG_H * f} stroke="hsl(var(--border))" strokeWidth={0.5} strokeDasharray="4 4" />
                  </g>
                ))}
                {/* City bubbles */}
                {filtered.map(d => {
                  const { x, y } = project(d.lat, d.lng);
                  const r = bubbleRadius(d);
                  const isSelected = selectedCity?.city === d.city;
                  return (
                    <g key={d.city} className="cursor-pointer" onClick={() => setSelectedCity(d)}>
                      <circle
                        cx={x} cy={y} r={r}
                        fill={PENETRATION_DOT_COLORS[d.penetration]}
                        opacity={isSelected ? 0.95 : 0.7}
                        stroke={isSelected ? 'hsl(var(--foreground))' : 'white'}
                        strokeWidth={isSelected ? 2.5 : 1}
                      />
                      <text
                        x={x} y={y + r + 12}
                        textAnchor="middle"
                        fontSize={10}
                        fill="hsl(var(--foreground))"
                        className="pointer-events-none select-none"
                        fontWeight={isSelected ? 700 : 400}
                      >
                        {d.city}
                      </text>
                      {d.customers > 0 && (
                        <text
                          x={x} y={y + 4}
                          textAnchor="middle"
                          fontSize={r > 14 ? 11 : 8}
                          fill="white"
                          fontWeight="bold"
                          className="pointer-events-none select-none"
                        >
                          {d.customers}
                        </text>
                      )}
                    </g>
                  );
                })}
              </svg>
            </div>
          </div>

          {/* Detail panel */}
          <div className="bg-card rounded-xl border p-5 overflow-y-auto max-h-[700px]">
            {selectedCity ? (
              <div className="space-y-4">
                <div className="flex items-start justify-between">
                  <div>
                    <h3 className="font-display font-semibold text-lg">{selectedCity.city}</h3>
                    <p className="text-sm text-muted-foreground">{selectedCity.state}</p>
                  </div>
                  <button onClick={() => setSelectedCity(null)} className="p-1 rounded-md hover:bg-muted transition-colors">
                    <X size={16} className="text-muted-foreground" />
                  </button>
                </div>

                {/* Penetration badge */}
                <div className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-medium border ${PENETRATION_BG[selectedCity.penetration]}`}>
                  <span className="w-2 h-2 rounded-full" style={{ backgroundColor: PENETRATION_DOT_COLORS[selectedCity.penetration] }} />
                  Penetración: {PENETRATION_LABELS[selectedCity.penetration]}
                </div>

                {/* Stats */}
                <div className="grid grid-cols-2 gap-3">
                  {[
                    { label: 'Clientes', value: selectedCity.customers, icon: Users },
                    { label: 'Leads', value: selectedCity.leads, icon: Target },
                    { label: 'Cotizaciones', value: selectedCity.quotations, icon: FileText },
                    { label: 'Abiertas', value: selectedCity.openQuotations, icon: Eye },
                    { label: 'Ventas', value: selectedCity.closedSales, icon: ShoppingCart },
                    { label: 'Valor ventas', value: fmt(selectedCity.totalSalesValue), icon: TrendingUp },
                  ].map(s => (
                    <div key={s.label} className="p-3 rounded-lg bg-muted/50">
                      <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground mb-1">
                        <s.icon size={12} /> {s.label}
                      </div>
                      <div className="text-sm font-bold">{s.value}</div>
                    </div>
                  ))}
                </div>

                {/* Vendors */}
                {selectedCity.vendors.length > 0 && (
                  <div>
                    <h4 className="text-xs font-medium text-muted-foreground mb-2">Vendedores asignados</h4>
                    <div className="flex flex-wrap gap-1.5">
                      {selectedCity.vendors.map(v => (
                        <span key={v} className="px-2 py-1 rounded-md bg-primary/10 text-primary text-xs font-medium">{v}</span>
                      ))}
                    </div>
                  </div>
                )}

                {/* Top products */}
                {selectedCity.topProducts.length > 0 && (
                  <div>
                    <h4 className="text-xs font-medium text-muted-foreground mb-2">Equipos más vendidos</h4>
                    <div className="space-y-1.5">
                      {selectedCity.topProducts.map(p => (
                        <div key={p.name} className="flex items-center justify-between text-xs p-2 rounded-lg bg-muted/30">
                          <span className="truncate flex-1">{p.name}</span>
                          <span className="font-bold ml-2">{p.count}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Opportunities */}
                {selectedCity.opportunities.length > 0 && (
                  <div>
                    <h4 className="text-xs font-medium text-muted-foreground mb-2">Oportunidades detectadas</h4>
                    <div className="space-y-1.5">
                      {selectedCity.opportunities.map((opp, i) => (
                        <div key={i} className="flex items-start gap-2 text-xs p-2 rounded-lg bg-warning/5 border border-warning/20">
                          <AlertTriangle size={12} className="text-warning shrink-0 mt-0.5" />
                          <span>{opp}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Potential value */}
                {selectedCity.potentialValue > 0 && (
                  <div className="p-3 rounded-lg bg-primary/5 border border-primary/20">
                    <div className="text-[10px] text-muted-foreground">Valor potencial</div>
                    <div className="text-lg font-bold text-primary">{fmt(selectedCity.potentialValue)}</div>
                  </div>
                )}
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center h-64 text-muted-foreground">
                <MapPin size={40} className="mb-3 opacity-30" />
                <p className="text-sm font-medium">Selecciona una ciudad</p>
                <p className="text-xs">Haz click en un indicador del mapa para ver el detalle</p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ═══ TAB: OPORTUNIDADES ═══ */}
      {activeTab === 'oportunidades' && (
        <div className="space-y-6">
          <div className="bg-card rounded-xl border p-5">
            <h3 className="font-display font-semibold flex items-center gap-2 mb-4">
              <Target size={18} className="text-primary" /> Ciudades con Oportunidad de Crecimiento
            </h3>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b">
                    <th className="text-left p-3 font-medium text-muted-foreground">Ciudad</th>
                    <th className="text-left p-3 font-medium text-muted-foreground">Estado</th>
                    <th className="text-center p-3 font-medium text-muted-foreground">Leads</th>
                    <th className="text-center p-3 font-medium text-muted-foreground">Cotizaciones</th>
                    <th className="text-center p-3 font-medium text-muted-foreground">Ventas</th>
                    <th className="text-right p-3 font-medium text-muted-foreground">Valor Potencial</th>
                    <th className="text-center p-3 font-medium text-muted-foreground">Prioridad</th>
                    <th className="text-left p-3 font-medium text-muted-foreground">Oportunidades</th>
                  </tr>
                </thead>
                <tbody>
                  {growth.map(g => (
                    <tr key={g.city} className="border-b hover:bg-muted/30 transition-colors cursor-pointer"
                      onClick={() => { setSelectedCity(allData.find(d => d.city === g.city) ?? null); setActiveTab('mapa'); }}>
                      <td className="p-3 font-medium">{g.city}</td>
                      <td className="p-3 text-muted-foreground">{g.state}</td>
                      <td className="p-3 text-center">{g.leads}</td>
                      <td className="p-3 text-center">{g.quotations}</td>
                      <td className="p-3 text-center">{g.sales}</td>
                      <td className="p-3 text-right font-semibold">{fmt(g.potentialValue)}</td>
                      <td className="p-3 text-center">
                        <span className={`inline-flex px-2 py-0.5 rounded-full text-[11px] font-medium border ${
                          g.priority === 'alta' ? 'bg-destructive/10 text-destructive border-destructive/20' :
                          g.priority === 'media' ? 'bg-warning/10 text-warning border-warning/20' :
                          'bg-muted text-muted-foreground border-border'
                        }`}>
                          {g.priority.charAt(0).toUpperCase() + g.priority.slice(1)}
                        </span>
                      </td>
                      <td className="p-3 text-xs text-muted-foreground max-w-[200px] truncate">
                        {g.reasons.join('; ')}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ═══ TAB: ANÁLISIS ═══ */}
      {activeTab === 'analisis' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Top sales cities */}
          <div className="bg-card rounded-xl border p-5">
            <h3 className="font-display font-semibold flex items-center gap-2 mb-4">
              <ShoppingCart size={16} className="text-success" /> Ciudades con Mayor Volumen de Ventas
            </h3>
            <div className="space-y-3">
              {analytics.topSalesCities.map((d, i) => (
                <div key={d.city} className="flex items-center gap-3 cursor-pointer hover:bg-muted/50 rounded-lg p-2 -mx-2 transition-colors"
                  onClick={() => { setSelectedCity(d); setActiveTab('mapa'); }}>
                  <span className="text-xs font-bold text-muted-foreground w-5">{i + 1}</span>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium">{d.city}</span>
                      <span className="text-sm font-bold">{fmt(d.totalSalesValue)}</span>
                    </div>
                    <div className="flex items-center gap-2 text-[10px] text-muted-foreground mt-0.5">
                      <span>{d.state}</span>
                      <span>·</span>
                      <span>{d.customers} clientes</span>
                      <span>·</span>
                      <span>{d.closedSales} ventas</span>
                    </div>
                    <div className="w-full bg-muted rounded-full h-1.5 mt-1.5">
                      <div className="h-1.5 rounded-full bg-success transition-all" style={{
                        width: `${analytics.topSalesCities[0]?.totalSalesValue ? (d.totalSalesValue / analytics.topSalesCities[0].totalSalesValue) * 100 : 0}%`
                      }} />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Top leads cities */}
          <div className="bg-card rounded-xl border p-5">
            <h3 className="font-display font-semibold flex items-center gap-2 mb-4">
              <Users size={16} className="text-primary" /> Ciudades con Más Leads
            </h3>
            <div className="space-y-3">
              {analytics.topLeadsCities.map((d, i) => (
                <div key={d.city} className="flex items-center gap-3 cursor-pointer hover:bg-muted/50 rounded-lg p-2 -mx-2 transition-colors"
                  onClick={() => { setSelectedCity(d); setActiveTab('mapa'); }}>
                  <span className="text-xs font-bold text-muted-foreground w-5">{i + 1}</span>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium">{d.city}</span>
                      <span className="text-sm font-bold">{d.leads} leads</span>
                    </div>
                    <div className="text-[10px] text-muted-foreground mt-0.5">{d.state} · {d.quotations} cotizaciones · {d.closedSales} ventas</div>
                    <div className="w-full bg-muted rounded-full h-1.5 mt-1.5">
                      <div className="h-1.5 rounded-full bg-primary transition-all" style={{
                        width: `${analytics.topLeadsCities[0]?.leads ? (d.leads / analytics.topLeadsCities[0].leads) * 100 : 0}%`
                      }} />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Low penetration */}
          <div className="bg-card rounded-xl border p-5 lg:col-span-2">
            <h3 className="font-display font-semibold flex items-center gap-2 mb-4">
              <AlertTriangle size={16} className="text-warning" /> Ciudades con Baja Penetración de Mercado
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
              {analytics.lowPenetrationCities.slice(0, 12).map(d => (
                <div key={d.city}
                  className={`p-3 rounded-lg border cursor-pointer hover:shadow-md transition-all ${PENETRATION_BG[d.penetration]}`}
                  onClick={() => { setSelectedCity(d); setActiveTab('mapa'); }}>
                  <div className="flex items-center justify-between mb-1">
                    <span className="font-medium text-sm">{d.city}</span>
                    <span className="w-2 h-2 rounded-full" style={{ backgroundColor: PENETRATION_DOT_COLORS[d.penetration] }} />
                  </div>
                  <p className="text-[10px] text-muted-foreground">{d.state}</p>
                  <div className="flex items-center gap-3 mt-2 text-xs">
                    <span>{d.leads} leads</span>
                    <span>{d.quotations} cot.</span>
                    <span>{d.closedSales} ventas</span>
                  </div>
                  {d.opportunities.length > 0 && (
                    <p className="text-[10px] text-muted-foreground mt-1 truncate">
                      {d.opportunities[0]}
                    </p>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Market coverage summary */}
          <div className="bg-card rounded-xl border p-5 lg:col-span-2">
            <h3 className="font-display font-semibold flex items-center gap-2 mb-4">
              <BarChart3 size={16} className="text-primary" /> Resumen de Cobertura por Penetración
            </h3>
            <div className="grid grid-cols-4 gap-4">
              {(['alto', 'medio', 'bajo', 'sin_presencia'] as PenetrationLevel[]).map(p => {
                const count = allData.filter(d => d.penetration === p).length;
                const pct = allData.length > 0 ? Math.round((count / allData.length) * 100) : 0;
                return (
                  <div key={p} className={`p-4 rounded-lg border text-center ${PENETRATION_BG[p]}`}>
                    <div className="text-2xl font-bold">{count}</div>
                    <div className="text-xs font-medium mt-1">{PENETRATION_LABELS[p]}</div>
                    <div className="text-[10px] text-muted-foreground">{pct}%</div>
                    <div className="w-full bg-background/50 rounded-full h-2 mt-2">
                      <div className="h-2 rounded-full transition-all" style={{
                        width: `${pct}%`,
                        backgroundColor: PENETRATION_DOT_COLORS[p],
                      }} />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* City quick list (always visible below map) */}
      {activeTab === 'mapa' && (
        <div className="bg-card rounded-xl border p-5">
          <h3 className="font-display font-semibold mb-4 flex items-center gap-2">
            <Building2 size={16} className="text-primary" /> Todas las ciudades ({filtered.length})
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {filtered.map(d => (
              <div key={d.city}
                className={`p-3 rounded-lg border cursor-pointer hover:shadow-md transition-all ${
                  selectedCity?.city === d.city ? 'ring-2 ring-primary' : ''
                } ${PENETRATION_BG[d.penetration]}`}
                onClick={() => setSelectedCity(d)}>
                <div className="flex items-center justify-between mb-1">
                  <span className="font-medium text-sm">{d.city}</span>
                  <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: PENETRATION_DOT_COLORS[d.penetration] }} />
                </div>
                <p className="text-[10px] text-muted-foreground mb-2">{d.state}</p>
                <div className="flex items-center gap-3 text-xs">
                  <span title="Clientes">👥 {d.customers}</span>
                  <span title="Cotizaciones">📄 {d.quotations}</span>
                  <span title="Ventas">🛒 {d.closedSales}</span>
                  {d.totalSalesValue > 0 && (
                    <span className="font-semibold ml-auto">{fmt(d.totalSalesValue)}</span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
