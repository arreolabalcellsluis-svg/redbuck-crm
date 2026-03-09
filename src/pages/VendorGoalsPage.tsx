import { useState, useMemo } from 'react';
import { useQuotations } from '@/hooks/useQuotations';
import { useOrders } from '@/hooks/useOrders';
import { useCustomers } from '@/hooks/useCustomers';
import { useTeamMembers } from '@/hooks/useTeamMembers';
import { useProducts } from '@/hooks/useProducts';
import { useAccountsReceivable } from '@/hooks/useAccountsReceivable';
import { useSalesGoals, useUpsertSalesGoal, useCommissionConfig, useUpdateCommissionConfig } from '@/hooks/useSalesGoals';
import { calcAllVendorKPIs, generateAlerts, type VendorKPI, type CommissionBreakdown, type TeamMember, type ProductLookup, type ARRecord } from '@/lib/vendorKPIsEngine';
import { useAppContext } from '@/contexts/AppContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import {
  Target, Trophy, TrendingUp, Users, FileText, ShoppingCart, DollarSign,
  ArrowUpDown, Save, BadgeDollarSign, Star, AlertTriangle, BarChart3, Settings2,
} from 'lucide-react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell,
  RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, Radar,
} from 'recharts';

const MONTHS = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];
const fmt = (n: number) => new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN', maximumFractionDigits: 0 }).format(n);
const fmtPct = (n: number) => `${n.toFixed(1)}%`;

export default function VendorGoalsPage() {
  const now = new Date();
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [year, setYear] = useState(now.getFullYear());
  const [selectedVendor, setSelectedVendor] = useState<string | null>(null);
  const [sortBy, setSortBy] = useState<'sales' | 'closeRate' | 'progressSales' | 'score' | 'commission'>('sales');
  const { currentRole } = useAppContext();
  const isAdmin = currentRole !== 'vendedor';

  const { data: quotations = [] } = useQuotations();
  const { data: orders = [] } = useOrders();
  const { data: customers = [] } = useCustomers();
  const { data: goals = [] } = useSalesGoals(month, year);
  const { data: configData } = useCommissionConfig();
  const upsertGoal = useUpsertSalesGoal();
  const updateConfig = useUpdateCommissionConfig();
  const { data: teamMembersRaw = [] } = useTeamMembers();
  const { data: productsRaw = [] } = useProducts();
  const { data: arRaw = [] } = useAccountsReceivable();

  const teamMembers: TeamMember[] = useMemo(() => teamMembersRaw.map(m => ({ id: m.id, name: m.name, role: m.role, active: m.active })), [teamMembersRaw]);
  const products: ProductLookup[] = useMemo(() => productsRaw.map(p => ({ name: p.name, cost: p.cost, listPrice: p.listPrice })), [productsRaw]);
  const accountsReceivable: ARRecord[] = useMemo(() => arRaw.map(ar => ({ id: ar.id, customerId: ar.customer_id, total: ar.total, paid: ar.paid, balance: ar.balance, status: ar.status, daysOverdue: ar.days_overdue })), [arRaw]);

  const commissionConfig = configData?.config;
  const scoreWeights = configData?.weights;
  const scoreLevels = configData?.levels;
  const vendors = teamMembers.filter(m => m.role === 'vendedor' && m.active);

  const allKPIs = useMemo(() =>
    calcAllVendorKPIs(quotations, orders, customers, goals, teamMembers, products, accountsReceivable, month, year, commissionConfig, scoreWeights, scoreLevels),
    [quotations, orders, customers, goals, teamMembers, products, accountsReceivable, month, year, commissionConfig, scoreWeights, scoreLevels]
  );

  const sortedKPIs = useMemo(() => {
    const copy = [...allKPIs];
    switch (sortBy) {
      case 'closeRate': return copy.sort((a, b) => b.closeRate - a.closeRate);
      case 'progressSales': return copy.sort((a, b) => b.progressSales - a.progressSales);
      case 'score': return copy.sort((a, b) => b.score - a.score);
      case 'commission': return copy.sort((a, b) => b.commission.total - a.commission.total);
      default: return copy.sort((a, b) => b.sales - a.sales);
    }
  }, [allKPIs, sortBy]);

  const alerts = useMemo(() => generateAlerts(allKPIs), [allKPIs]);
  const selectedKPI = selectedVendor ? allKPIs.find(k => k.vendorId === selectedVendor) : null;

  // Goal editing
  const [goalEdits, setGoalEdits] = useState<Record<string, Record<string, number>>>({});
  const updateGoalField = (vid: string, field: string, value: number) =>
    setGoalEdits(prev => ({ ...prev, [vid]: { ...prev[vid], [field]: value } }));

  const saveGoal = (vendorId: string) => {
    const vendor = vendors.find(v => v.id === vendorId);
    const existing = goals.find(g => g.vendor_id === vendorId);
    const e = goalEdits[vendorId] ?? {};
    upsertGoal.mutate({
      id: existing?.id,
      vendor_id: vendorId,
      vendor_name: vendor?.name ?? '',
      month, year,
      goal_sales: e.goal_sales ?? existing?.goal_sales ?? 0,
      goal_quotations: e.goal_quotations ?? existing?.goal_quotations ?? 0,
      goal_orders: e.goal_orders ?? existing?.goal_orders ?? 0,
      goal_new_customers: e.goal_new_customers ?? existing?.goal_new_customers ?? 0,
      goal_followups: e.goal_followups ?? existing?.goal_followups ?? 0,
      goal_collections: e.goal_collections ?? existing?.goal_collections ?? 0,
      goal_min_margin: e.goal_min_margin ?? existing?.goal_min_margin ?? 0,
    });
    setGoalEdits(prev => { const c = { ...prev }; delete c[vendorId]; return c; });
  };

  const progressColor = (p: number) => p >= 100 ? 'text-green-600' : p >= 60 ? 'text-amber-600' : 'text-destructive';
  const scoreColorClass = (c: string) => c === 'green' ? 'bg-green-100 text-green-800' : c === 'blue' ? 'bg-blue-100 text-blue-800' : c === 'amber' ? 'bg-amber-100 text-amber-800' : c === 'orange' ? 'bg-orange-100 text-orange-800' : 'bg-red-100 text-red-800';

  // ─── Team summary
  const teamSales = allKPIs.reduce((s, k) => s + k.sales, 0);
  const teamGoal = allKPIs.reduce((s, k) => s + k.goalSales, 0);
  const teamQuotations = allKPIs.reduce((s, k) => s + k.quotations, 0);
  const teamOrders = allKPIs.reduce((s, k) => s + k.orders, 0);
  const teamCloseRate = teamQuotations > 0 ? (teamOrders / teamQuotations) * 100 : 0;
  const teamNewCustomers = allKPIs.reduce((s, k) => s + k.newCustomers, 0);
  const teamCollections = allKPIs.reduce((s, k) => s + k.collections, 0);
  const teamMargin = allKPIs.length > 0 ? allKPIs.reduce((s, k) => s + k.marginAvg, 0) / allKPIs.length : 0;
  const teamScore = allKPIs.length > 0 ? Math.round(allKPIs.reduce((s, k) => s + k.score, 0) / allKPIs.length) : 0;
  const teamCommission = allKPIs.reduce((s, k) => s + k.commission.total, 0);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-display font-bold text-foreground flex items-center gap-2">
            <Target className="text-primary" size={28} /> Metas, KPIs y Comisiones
          </h1>
          <p className="text-sm text-muted-foreground">Desempeño comercial, comisiones inteligentes y score de vendedores</p>
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
        </div>
      </div>

      <Tabs defaultValue="executive">
        <TabsList className="flex flex-wrap gap-1 h-auto p-1">
          <TabsTrigger value="executive"><BarChart3 size={14} className="mr-1" />Ejecutivo</TabsTrigger>
          <TabsTrigger value="ranking"><Trophy size={14} className="mr-1" />Ranking</TabsTrigger>
          <TabsTrigger value="individual"><TrendingUp size={14} className="mr-1" />Individual</TabsTrigger>
          <TabsTrigger value="commissions"><BadgeDollarSign size={14} className="mr-1" />Comisiones</TabsTrigger>
          <TabsTrigger value="goals"><Target size={14} className="mr-1" />Metas</TabsTrigger>
          <TabsTrigger value="alerts" className="relative">
            <AlertTriangle size={14} className="mr-1" />Alertas
            {alerts.length > 0 && <Badge variant="destructive" className="ml-1 h-5 px-1.5 text-[10px]">{alerts.length}</Badge>}
          </TabsTrigger>
          {isAdmin && <TabsTrigger value="config"><Settings2 size={14} className="mr-1" />Config</TabsTrigger>}
        </TabsList>

        {/* ═══ EXECUTIVE ═══ */}
        <TabsContent value="executive" className="space-y-4">
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3">
            <SummaryCard icon={<DollarSign size={18} />} label="Ventas equipo" value={fmt(teamSales)} sub={teamGoal > 0 ? `${Math.round(teamSales / teamGoal * 100)}% de meta` : undefined} />
            <SummaryCard icon={<FileText size={18} />} label="Cotizaciones" value={String(teamQuotations)} />
            <SummaryCard icon={<ShoppingCart size={18} />} label="Pedidos" value={String(teamOrders)} sub={`Cierre: ${teamCloseRate.toFixed(0)}%`} />
            <SummaryCard icon={<Users size={18} />} label="Clientes nuevos" value={String(teamNewCustomers)} />
            <SummaryCard icon={<Star size={18} />} label="Score promedio" value={`${teamScore}/100`} />
            <SummaryCard icon={<BadgeDollarSign size={18} />} label="Comisión total" value={fmt(teamCommission)} />
          </div>

          <div className="grid md:grid-cols-2 gap-4">
            <Card>
              <CardHeader><CardTitle className="text-base">Ventas por vendedor</CardTitle></CardHeader>
              <CardContent>
                <div className="h-56">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={sortedKPIs} layout="vertical">
                      <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                      <XAxis type="number" tickFormatter={v => `$${(v / 1000).toFixed(0)}K`} stroke="hsl(var(--muted-foreground))" fontSize={11} />
                      <YAxis type="category" dataKey="vendorName" width={110} stroke="hsl(var(--muted-foreground))" fontSize={11} />
                      <Tooltip formatter={(v: number) => fmt(v)} />
                      <Bar dataKey="sales" radius={[0, 4, 4, 0]}>
                        {sortedKPIs.map((_, i) => <Cell key={i} fill={i === 0 ? 'hsl(var(--primary))' : `hsl(var(--primary) / ${0.7 - i * 0.1})`} />)}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader><CardTitle className="text-base">Score comercial</CardTitle></CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {sortedKPIs.map(k => (
                    <div key={k.vendorId} className="flex items-center gap-3">
                      <span className="text-sm w-28 truncate">{k.vendorName}</span>
                      <Progress value={k.score} className="flex-1 h-2" />
                      <Badge className={`${scoreColorClass(k.scoreColor)} text-xs`}>{k.score}</Badge>
                      <span className="text-[10px] text-muted-foreground w-16">{k.scoreLabel}</span>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Quick metrics table */}
          <Card>
            <CardContent className="pt-4 overflow-x-auto">
              <table className="w-full text-sm">
                <thead><tr className="border-b text-muted-foreground text-xs">
                  <th className="text-left py-2 px-1">Vendedor</th>
                  <th className="text-right px-1">Ventas</th>
                  <th className="text-right px-1">Margen</th>
                  <th className="text-right px-1">Cobranza</th>
                  <th className="text-right px-1">Score</th>
                  <th className="text-right px-1">Comisión</th>
                </tr></thead>
                <tbody>{allKPIs.map(k => (
                  <tr key={k.vendorId} className="border-b hover:bg-muted/30">
                    <td className="py-2 px-1 font-medium">{k.vendorName}</td>
                    <td className="py-2 px-1 text-right font-mono">{fmt(k.sales)}</td>
                    <td className="py-2 px-1 text-right">{fmtPct(k.marginAvg)}</td>
                    <td className="py-2 px-1 text-right font-mono">{fmt(k.collections)}</td>
                    <td className="py-2 px-1 text-right"><Badge className={`${scoreColorClass(k.scoreColor)} text-xs`}>{k.score}</Badge></td>
                    <td className="py-2 px-1 text-right font-mono font-bold">{fmt(k.commission.total)}</td>
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
            {(['sales', 'progressSales', 'closeRate', 'score', 'commission'] as const).map(key => (
              <Button key={key} variant={sortBy === key ? 'default' : 'outline'} size="sm" onClick={() => setSortBy(key)}>
                {{sales:'Ventas', progressSales:'Meta', closeRate:'Cierre', score:'Score', commission:'Comisión'}[key]}
              </Button>
            ))}
          </div>
          <Card><CardContent className="pt-4 overflow-x-auto">
            <table className="w-full text-sm">
              <thead><tr className="border-b text-muted-foreground text-xs">
                <th className="text-left py-2 px-1">#</th>
                <th className="text-left py-2 px-1">Vendedor</th>
                <th className="text-right px-1">Ventas</th>
                <th className="text-right px-1">Avance</th>
                <th className="text-right px-1">Cotiz.</th>
                <th className="text-right px-1">Pedidos</th>
                <th className="text-right px-1">Cierre</th>
                <th className="text-right px-1">Ticket</th>
                <th className="text-right px-1">Margen</th>
                <th className="text-right px-1">Clientes</th>
                <th className="text-right px-1">Cobranza</th>
                <th className="text-right px-1">Score</th>
                <th className="text-right px-1">Comisión</th>
              </tr></thead>
              <tbody>{sortedKPIs.map((k, i) => (
                <tr key={k.vendorId} className="border-b hover:bg-muted/30 cursor-pointer" onClick={() => setSelectedVendor(k.vendorId)}>
                  <td className="py-2 px-1 font-bold">{i < 3 ? ['🥇','🥈','🥉'][i] : i + 1}</td>
                  <td className="py-2 px-1 font-medium">{k.vendorName}</td>
                  <td className="py-2 px-1 text-right font-mono">{fmt(k.sales)}</td>
                  <td className="py-2 px-1 text-right"><span className={`font-bold ${progressColor(k.progressSales)}`}>{k.progressSales}%</span></td>
                  <td className="py-2 px-1 text-right">{k.quotations}</td>
                  <td className="py-2 px-1 text-right">{k.orders}</td>
                  <td className="py-2 px-1 text-right">{k.closeRate.toFixed(0)}%</td>
                  <td className="py-2 px-1 text-right font-mono">{fmt(k.avgTicket)}</td>
                  <td className="py-2 px-1 text-right">{fmtPct(k.marginAvg)}</td>
                  <td className="py-2 px-1 text-right">{k.newCustomers}</td>
                  <td className="py-2 px-1 text-right font-mono">{fmt(k.collections)}</td>
                  <td className="py-2 px-1 text-right"><Badge className={`${scoreColorClass(k.scoreColor)} text-xs`}>{k.score}</Badge></td>
                  <td className="py-2 px-1 text-right font-mono font-bold">{fmt(k.commission.total)}</td>
                </tr>
              ))}</tbody>
            </table>
          </CardContent></Card>
        </TabsContent>

        {/* ═══ INDIVIDUAL ═══ */}
        <TabsContent value="individual" className="space-y-4">
          <Select value={selectedVendor ?? ''} onValueChange={v => setSelectedVendor(v)}>
            <SelectTrigger className="w-60"><SelectValue placeholder="Selecciona un vendedor" /></SelectTrigger>
            <SelectContent>{vendors.map(v => <SelectItem key={v.id} value={v.id}>{v.name}</SelectItem>)}</SelectContent>
          </Select>

          {selectedKPI ? (
            <>
              {/* Score banner */}
              <Card className="border-l-4" style={{ borderLeftColor: selectedKPI.scoreColor === 'green' ? 'hsl(142,71%,45%)' : selectedKPI.scoreColor === 'blue' ? 'hsl(210,100%,52%)' : selectedKPI.scoreColor === 'amber' ? 'hsl(38,92%,50%)' : 'hsl(0,78%,45%)' }}>
                <CardContent className="pt-4 flex items-center justify-between">
                  <div>
                    <div className="text-sm text-muted-foreground">Score Comercial</div>
                    <div className="text-3xl font-bold">{selectedKPI.score}<span className="text-lg text-muted-foreground">/100</span></div>
                  </div>
                  <Badge className={`${scoreColorClass(selectedKPI.scoreColor)} text-sm px-3 py-1`}>{selectedKPI.scoreLabel}</Badge>
                  <div className="text-right">
                    <div className="text-sm text-muted-foreground">Comisión del mes</div>
                    <div className="text-2xl font-bold text-primary">{fmt(selectedKPI.commission.total)}</div>
                  </div>
                </CardContent>
              </Card>

              <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3">
                <KPICard label="Ventas" value={fmt(selectedKPI.sales)} goal={selectedKPI.goalSales > 0 ? `Meta: ${fmt(selectedKPI.goalSales)}` : undefined} progress={selectedKPI.progressSales} />
                <KPICard label="Cotizaciones" value={String(selectedKPI.quotations)} goal={selectedKPI.goalQuotations > 0 ? `Meta: ${selectedKPI.goalQuotations}` : undefined} progress={selectedKPI.progressQuotations} />
                <KPICard label="Pedidos" value={String(selectedKPI.orders)} progress={selectedKPI.progressOrders} />
                <KPICard label="Tasa de cierre" value={`${selectedKPI.closeRate.toFixed(1)}%`} />
                <KPICard label="Ticket promedio" value={fmt(selectedKPI.avgTicket)} />
                <KPICard label="Margen promedio" value={fmtPct(selectedKPI.marginAvg)} />
              </div>

              <div className="grid md:grid-cols-2 gap-4">
                <Card>
                  <CardHeader><CardTitle className="text-base">Perfil de desempeño</CardTitle></CardHeader>
                  <CardContent>
                    <div className="h-64">
                      <ResponsiveContainer width="100%" height="100%">
                        <RadarChart data={[
                          { metric: 'Ventas', value: selectedKPI.progressSales },
                          { metric: 'Cotiz.', value: selectedKPI.progressQuotations },
                          { metric: 'Pedidos', value: selectedKPI.progressOrders },
                          { metric: 'Clientes', value: selectedKPI.progressNewCustomers },
                          { metric: 'Cobranza', value: selectedKPI.progressCollections },
                          { metric: 'Seguim.', value: selectedKPI.progressFollowups },
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
                <Card>
                  <CardHeader><CardTitle className="text-base">Detalle del período</CardTitle></CardHeader>
                  <CardContent className="space-y-2">
                    <DetailRow label="Pipeline abierto" value={fmt(selectedKPI.pipeline)} />
                    <DetailRow label="Clientes nuevos" value={String(selectedKPI.newCustomers)} />
                    <DetailRow label="Clientes reactivados" value={String(selectedKPI.reactivatedCustomers)} />
                    <DetailRow label="Seguimientos" value={String(selectedKPI.followups)} />
                    <DetailRow label="Cobranza" value={fmt(selectedKPI.collections)} />
                    <DetailRow label="Margen promedio" value={fmtPct(selectedKPI.marginAvg)} />
                  </CardContent>
                </Card>
              </div>

              {/* Commission breakdown */}
              <CommissionDetail c={selectedKPI.commission} />
            </>
          ) : (
            <Card><CardContent className="py-16 text-center text-muted-foreground">Selecciona un vendedor para ver su dashboard</CardContent></Card>
          )}
        </TabsContent>

        {/* ═══ COMMISSIONS ═══ */}
        <TabsContent value="commissions" className="space-y-4">
          <p className="text-sm text-muted-foreground">Comisiones calculadas automáticamente para {MONTHS[month - 1]} {year}.</p>
          <Card><CardContent className="pt-4 overflow-x-auto">
            <table className="w-full text-sm">
              <thead><tr className="border-b text-muted-foreground text-xs">
                <th className="text-left py-2 px-1">Vendedor</th>
                <th className="text-right px-1">Ventas</th>
                <th className="text-right px-1">Meta</th>
                <th className="text-right px-1">%</th>
                <th className="text-right px-1">Base</th>
                <th className="text-right px-1">B. Margen</th>
                <th className="text-right px-1">B. Meta</th>
                <th className="text-right px-1">B. Clientes</th>
                <th className="text-right px-1">B. Cobranza</th>
                <th className="text-right px-1 font-bold">TOTAL</th>
              </tr></thead>
              <tbody>{allKPIs.map(k => {
                const c = k.commission;
                return (
                  <tr key={k.vendorId} className="border-b hover:bg-muted/30">
                    <td className="py-2 px-1 font-medium">{k.vendorName}</td>
                    <td className="py-2 px-1 text-right font-mono">{fmt(k.sales)}</td>
                    <td className="py-2 px-1 text-right font-mono">{fmt(k.goalSales)}</td>
                    <td className="py-2 px-1 text-right"><span className={progressColor(k.progressSales)}>{k.progressSales}%</span></td>
                    <td className="py-2 px-1 text-right font-mono">{fmt(c.baseAmount)}</td>
                    <td className="py-2 px-1 text-right font-mono">{fmt(c.marginBonusAmount)}</td>
                    <td className="py-2 px-1 text-right font-mono">{fmt(c.goalBonusAmount)}</td>
                    <td className="py-2 px-1 text-right font-mono">{fmt(c.newCustomerBonusAmount)}</td>
                    <td className="py-2 px-1 text-right font-mono">{fmt(c.collectionBonusAmount)}</td>
                    <td className="py-2 px-1 text-right font-mono font-bold text-primary">{fmt(c.total)}</td>
                  </tr>
                );
              })}</tbody>
              <tfoot><tr className="border-t-2 font-bold">
                <td className="py-2 px-1">TOTAL EQUIPO</td>
                <td className="py-2 px-1 text-right font-mono">{fmt(teamSales)}</td>
                <td className="py-2 px-1 text-right font-mono">{fmt(teamGoal)}</td>
                <td className="py-2 px-1 text-right">{teamGoal > 0 ? `${Math.round(teamSales/teamGoal*100)}%` : '-'}</td>
                <td className="py-2 px-1 text-right font-mono">{fmt(allKPIs.reduce((s,k)=>s+k.commission.baseAmount,0))}</td>
                <td className="py-2 px-1 text-right font-mono">{fmt(allKPIs.reduce((s,k)=>s+k.commission.marginBonusAmount,0))}</td>
                <td className="py-2 px-1 text-right font-mono">{fmt(allKPIs.reduce((s,k)=>s+k.commission.goalBonusAmount,0))}</td>
                <td className="py-2 px-1 text-right font-mono">{fmt(allKPIs.reduce((s,k)=>s+k.commission.newCustomerBonusAmount,0))}</td>
                <td className="py-2 px-1 text-right font-mono">{fmt(allKPIs.reduce((s,k)=>s+k.commission.collectionBonusAmount,0))}</td>
                <td className="py-2 px-1 text-right font-mono text-primary">{fmt(teamCommission)}</td>
              </tr></tfoot>
            </table>
          </CardContent></Card>
        </TabsContent>

        {/* ═══ GOALS ═══ */}
        <TabsContent value="goals" className="space-y-4">
          <p className="text-sm text-muted-foreground">Metas mensuales para {MONTHS[month - 1]} {year}.</p>
          {vendors.map(vendor => {
            const existing = goals.find(g => g.vendor_id === vendor.id);
            const e = goalEdits[vendor.id] ?? {};
            const hasEdits = Object.keys(e).length > 0;
            return (
              <Card key={vendor.id}>
                <CardContent className="pt-4">
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="font-semibold">{vendor.name}</h3>
                    <Button size="sm" disabled={!hasEdits} onClick={() => saveGoal(vendor.id)}><Save size={14} className="mr-1" />Guardar</Button>
                  </div>
                  <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-3">
                    <GoalInput label="Ventas ($)" value={e.goal_sales ?? existing?.goal_sales ?? 0} onChange={v => updateGoalField(vendor.id, 'goal_sales', v)} />
                    <GoalInput label="Cotizaciones" value={e.goal_quotations ?? existing?.goal_quotations ?? 0} onChange={v => updateGoalField(vendor.id, 'goal_quotations', v)} />
                    <GoalInput label="Pedidos" value={e.goal_orders ?? existing?.goal_orders ?? 0} onChange={v => updateGoalField(vendor.id, 'goal_orders', v)} />
                    <GoalInput label="Clientes nuevos" value={e.goal_new_customers ?? existing?.goal_new_customers ?? 0} onChange={v => updateGoalField(vendor.id, 'goal_new_customers', v)} />
                    <GoalInput label="Seguimientos" value={e.goal_followups ?? existing?.goal_followups ?? 0} onChange={v => updateGoalField(vendor.id, 'goal_followups', v)} />
                    <GoalInput label="Cobranza ($)" value={e.goal_collections ?? existing?.goal_collections ?? 0} onChange={v => updateGoalField(vendor.id, 'goal_collections', v)} />
                    <GoalInput label="Margen mín (%)" value={e.goal_min_margin ?? existing?.goal_min_margin ?? 0} onChange={v => updateGoalField(vendor.id, 'goal_min_margin', v)} />
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </TabsContent>

        {/* ═══ ALERTS ═══ */}
        <TabsContent value="alerts" className="space-y-3">
          {alerts.length === 0 ? (
            <Card><CardContent className="py-12 text-center text-muted-foreground">Sin alertas activas para este período</CardContent></Card>
          ) : alerts.map((a, i) => (
            <Card key={i} className={`border-l-4 ${a.type === 'danger' ? 'border-l-destructive' : a.type === 'warning' ? 'border-l-amber-500' : 'border-l-blue-500'}`}>
              <CardContent className="pt-3 pb-3 flex items-center gap-3">
                <AlertTriangle size={16} className={a.type === 'danger' ? 'text-destructive' : a.type === 'warning' ? 'text-amber-500' : 'text-blue-500'} />
                <span className="font-medium text-sm">{a.vendorName}</span>
                <span className="text-sm text-muted-foreground">{a.message}</span>
              </CardContent>
            </Card>
          ))}
        </TabsContent>

        {/* ═══ CONFIG ═══ */}
        {isAdmin && (
          <TabsContent value="config" className="space-y-4">
            <CommissionConfigEditor config={commissionConfig} onSave={(key, val) => updateConfig.mutate({ key, value: val })} />
          </TabsContent>
        )}
      </Tabs>
    </div>
  );
}

// ════════════════════════════════════════════════════════════════
// Sub-components
// ════════════════════════════════════════════════════════════════

function SummaryCard({ icon, label, value, sub }: { icon: React.ReactNode; label: string; value: string; sub?: string }) {
  return (
    <Card>
      <CardContent className="pt-4 text-center space-y-1">
        <div className="mx-auto text-primary">{icon}</div>
        <div className="text-lg font-bold">{value}</div>
        <div className="text-[11px] text-muted-foreground">{label}</div>
        {sub && <div className="text-[10px] text-muted-foreground">{sub}</div>}
      </CardContent>
    </Card>
  );
}

function KPICard({ label, value, goal, progress }: { label: string; value: string; goal?: string; progress?: number }) {
  return (
    <Card>
      <CardContent className="pt-4 space-y-1">
        <div className="text-xs text-muted-foreground">{label}</div>
        <div className="text-xl font-bold">{value}</div>
        {goal && <div className="text-[11px] text-muted-foreground">{goal}</div>}
        {progress !== undefined && progress > 0 && (
          <>
            <Progress value={Math.min(progress, 100)} className="h-1.5" />
            <div className={`text-xs font-medium ${progress >= 100 ? 'text-green-600' : progress >= 60 ? 'text-amber-600' : 'text-destructive'}`}>{progress}%</div>
          </>
        )}
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

function GoalInput({ label, value, onChange }: { label: string; value: number; onChange: (v: number) => void }) {
  return (
    <div>
      <label className="text-[11px] text-muted-foreground">{label}</label>
      <Input type="number" value={value} onChange={e => onChange(Number(e.target.value))} className="h-8 text-sm" />
    </div>
  );
}

function CommissionDetail({ c }: { c: CommissionBreakdown }) {
  const fmt2 = (n: number) => new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN', maximumFractionDigits: 0 }).format(n);
  return (
    <Card>
      <CardHeader><CardTitle className="text-base flex items-center gap-2"><BadgeDollarSign size={18} /> Desglose de comisión</CardTitle></CardHeader>
      <CardContent>
        <div className="grid md:grid-cols-2 gap-4">
          <div className="space-y-2">
            <DetailRow label={`Comisión base (${c.baseRate}% de ${fmt2(c.baseSales)})`} value={fmt2(c.baseAmount)} />
            <DetailRow label={`Bono margen (${c.marginBonusPct}% — margen: ${c.marginAvg.toFixed(1)}%)`} value={fmt2(c.marginBonusAmount)} />
            <DetailRow label={`Bono meta (${c.goalBonusPct}% — cumplimiento: ${c.goalPct}%)`} value={fmt2(c.goalBonusAmount)} />
          </div>
          <div className="space-y-2">
            <DetailRow label={`Bono clientes (${c.newCustomerCount} × ${fmt2(c.newCustomerBonusUnit)})`} value={fmt2(c.newCustomerBonusAmount)} />
            <DetailRow label={`Bono cobranza (${c.collectionBonusRate}% de ${fmt2(c.collectionAmount)})`} value={fmt2(c.collectionBonusAmount)} />
            <div className="flex justify-between py-2 border-t-2 border-primary/30">
              <span className="font-bold">COMISIÓN TOTAL</span>
              <span className="text-xl font-bold text-primary">{fmt2(c.total)}</span>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function CommissionConfigEditor({ config, onSave }: { config: any; onSave: (key: string, val: any) => void }) {
  const [baseRate, setBaseRate] = useState(config?.baseRate ?? 5);

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader><CardTitle className="text-base">Configuración de comisiones</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div className="grid md:grid-cols-3 gap-4">
            <div>
              <label className="text-sm font-medium">Comisión base (%)</label>
              <div className="flex gap-2 mt-1">
                <Input type="number" value={baseRate} onChange={e => setBaseRate(Number(e.target.value))} className="h-8" />
                <Button size="sm" onClick={() => onSave('base_rate', { rate: baseRate })}><Save size={14} /></Button>
              </div>
            </div>
            <div>
              <label className="text-sm font-medium">Bono cliente nuevo ($)</label>
              <div className="flex gap-2 mt-1">
                <Input type="number" defaultValue={config?.newCustomerBonus ?? 500} id="ncb" className="h-8" />
                <Button size="sm" onClick={() => onSave('new_customer_bonus', { amount: Number((document.getElementById('ncb') as HTMLInputElement).value) })}><Save size={14} /></Button>
              </div>
            </div>
            <div>
              <label className="text-sm font-medium">Bono cobranza (%)</label>
              <div className="flex gap-2 mt-1">
                <Input type="number" defaultValue={config?.collectionBonusRate ?? 1} id="cbr" className="h-8" />
                <Button size="sm" onClick={() => onSave('collection_bonus', { rate: Number((document.getElementById('cbr') as HTMLInputElement).value) })}><Save size={14} /></Button>
              </div>
            </div>
          </div>

          <div>
            <label className="text-sm font-medium">Bonos por margen</label>
            <p className="text-xs text-muted-foreground mb-2">Rangos de margen → porcentaje de bono adicional sobre ventas</p>
            <div className="space-y-1">
              {(config?.marginBonuses ?? []).map((tier: any, i: number) => (
                <div key={i} className="text-sm">Margen ≥ {tier.min_margin}% → Bono +{tier.bonus}%</div>
              ))}
            </div>
          </div>

          <div>
            <label className="text-sm font-medium">Bonos por meta</label>
            <p className="text-xs text-muted-foreground mb-2">Cumplimiento de meta → porcentaje de bono adicional</p>
            <div className="space-y-1">
              {(config?.goalBonuses ?? []).map((tier: any, i: number) => (
                <div key={i} className="text-sm">Meta ≥ {tier.min_pct}% → Bono +{tier.bonus}%</div>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
