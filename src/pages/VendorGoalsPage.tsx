import { useState, useMemo } from 'react';
import { useQuotations } from '@/hooks/useQuotations';
import { useOrders } from '@/hooks/useOrders';
import { useCustomers } from '@/hooks/useCustomers';
import { useSalesGoals, useUpsertSalesGoal } from '@/hooks/useSalesGoals';
import { calcAllVendorKPIs, getVendors, type VendorKPI } from '@/lib/vendorKPIsEngine';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Target, Trophy, TrendingUp, Users, FileText, ShoppingCart, DollarSign, ArrowUpDown, Save } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, Radar } from 'recharts';

const MONTHS = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];
const fmt = (n: number) => new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN', maximumFractionDigits: 0 }).format(n);

export default function VendorGoalsPage() {
  const now = new Date();
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [year, setYear] = useState(now.getFullYear());
  const [selectedVendor, setSelectedVendor] = useState<string | null>(null);
  const [sortBy, setSortBy] = useState<'sales' | 'closeRate' | 'progressSales'>('sales');

  const { data: quotations = [] } = useQuotations();
  const { data: orders = [] } = useOrders();
  const { data: customers = [] } = useCustomers();
  const { data: goals = [] } = useSalesGoals(month, year);
  const upsertGoal = useUpsertSalesGoal();

  const vendors = getVendors();

  const allKPIs = useMemo(() =>
    calcAllVendorKPIs(quotations, orders, customers, goals, month, year),
    [quotations, orders, customers, goals, month, year]
  );

  const sortedKPIs = useMemo(() => {
    const copy = [...allKPIs];
    if (sortBy === 'closeRate') return copy.sort((a, b) => b.closeRate - a.closeRate);
    if (sortBy === 'progressSales') return copy.sort((a, b) => b.progressSales - a.progressSales);
    return copy.sort((a, b) => b.sales - a.sales);
  }, [allKPIs, sortBy]);

  const selectedKPI = selectedVendor ? allKPIs.find(k => k.vendorId === selectedVendor) : null;

  // ─── Goal editing state ───
  const [goalEdits, setGoalEdits] = useState<Record<string, Partial<{ goal_sales: number; goal_quotations: number; goal_orders: number; goal_new_customers: number; goal_followups: number }>>>({});

  const updateGoalField = (vendorId: string, field: string, value: number) => {
    setGoalEdits(prev => ({ ...prev, [vendorId]: { ...prev[vendorId], [field]: value } }));
  };

  const saveGoal = (vendorId: string) => {
    const vendor = vendors.find(v => v.id === vendorId);
    const existing = goals.find(g => g.vendor_id === vendorId);
    const edits = goalEdits[vendorId] ?? {};
    upsertGoal.mutate({
      id: existing?.id,
      vendor_id: vendorId,
      vendor_name: vendor?.name ?? '',
      month,
      year,
      goal_sales: edits.goal_sales ?? existing?.goal_sales ?? 0,
      goal_quotations: edits.goal_quotations ?? existing?.goal_quotations ?? 0,
      goal_orders: edits.goal_orders ?? existing?.goal_orders ?? 0,
      goal_new_customers: edits.goal_new_customers ?? existing?.goal_new_customers ?? 0,
      goal_followups: edits.goal_followups ?? existing?.goal_followups ?? 0,
    });
    setGoalEdits(prev => { const copy = { ...prev }; delete copy[vendorId]; return copy; });
  };

  const progressColor = (p: number) => p >= 100 ? 'text-green-600' : p >= 60 ? 'text-amber-600' : 'text-destructive';

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-display font-bold text-foreground flex items-center gap-2">
            <Target className="text-primary" size={28} /> Metas y KPIs de Vendedores
          </h1>
          <p className="text-sm text-muted-foreground">Desempeño comercial, metas y ranking de vendedores</p>
        </div>
        <div className="flex items-center gap-2">
          <Select value={String(month)} onValueChange={v => setMonth(Number(v))}>
            <SelectTrigger className="w-36"><SelectValue /></SelectTrigger>
            <SelectContent>
              {MONTHS.map((m, i) => <SelectItem key={i} value={String(i + 1)}>{m}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={String(year)} onValueChange={v => setYear(Number(v))}>
            <SelectTrigger className="w-24"><SelectValue /></SelectTrigger>
            <SelectContent>
              {[2025, 2026, 2027].map(y => <SelectItem key={y} value={String(y)}>{y}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
      </div>

      <Tabs defaultValue="ranking">
        <TabsList className="grid grid-cols-3 w-full max-w-lg">
          <TabsTrigger value="ranking"><Trophy size={16} className="mr-1" /> Ranking</TabsTrigger>
          <TabsTrigger value="individual"><TrendingUp size={16} className="mr-1" /> Individual</TabsTrigger>
          <TabsTrigger value="goals"><Target size={16} className="mr-1" /> Metas</TabsTrigger>
        </TabsList>

        {/* ═══ TAB: RANKING ═══ */}
        <TabsContent value="ranking" className="space-y-4">
          {/* Summary cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <Card><CardContent className="pt-4 text-center">
              <DollarSign className="mx-auto text-primary mb-1" size={20} />
              <div className="text-lg font-bold">{fmt(allKPIs.reduce((s, k) => s + k.sales, 0))}</div>
              <div className="text-xs text-muted-foreground">Ventas totales</div>
            </CardContent></Card>
            <Card><CardContent className="pt-4 text-center">
              <FileText className="mx-auto text-blue-500 mb-1" size={20} />
              <div className="text-lg font-bold">{allKPIs.reduce((s, k) => s + k.quotations, 0)}</div>
              <div className="text-xs text-muted-foreground">Cotizaciones</div>
            </CardContent></Card>
            <Card><CardContent className="pt-4 text-center">
              <ShoppingCart className="mx-auto text-green-600 mb-1" size={20} />
              <div className="text-lg font-bold">{allKPIs.reduce((s, k) => s + k.orders, 0)}</div>
              <div className="text-xs text-muted-foreground">Pedidos</div>
            </CardContent></Card>
            <Card><CardContent className="pt-4 text-center">
              <Users className="mx-auto text-amber-500 mb-1" size={20} />
              <div className="text-lg font-bold">{allKPIs.reduce((s, k) => s + k.newCustomers, 0)}</div>
              <div className="text-xs text-muted-foreground">Clientes nuevos</div>
            </CardContent></Card>
          </div>

          {/* Sort control */}
          <div className="flex items-center gap-2 text-sm">
            <ArrowUpDown size={14} className="text-muted-foreground" />
            <span className="text-muted-foreground">Ordenar por:</span>
            <Button variant={sortBy === 'sales' ? 'default' : 'outline'} size="sm" onClick={() => setSortBy('sales')}>Ventas</Button>
            <Button variant={sortBy === 'closeRate' ? 'default' : 'outline'} size="sm" onClick={() => setSortBy('closeRate')}>Tasa cierre</Button>
            <Button variant={sortBy === 'progressSales' ? 'default' : 'outline'} size="sm" onClick={() => setSortBy('progressSales')}>Avance meta</Button>
          </div>

          {/* Ranking chart */}
          <Card>
            <CardHeader><CardTitle className="text-base">Ventas por Vendedor — {MONTHS[month - 1]} {year}</CardTitle></CardHeader>
            <CardContent>
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={sortedKPIs} layout="vertical">
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                    <XAxis type="number" tickFormatter={v => `$${(v / 1000).toFixed(0)}K`} stroke="hsl(var(--muted-foreground))" fontSize={11} />
                    <YAxis type="category" dataKey="vendorName" width={120} stroke="hsl(var(--muted-foreground))" fontSize={11} />
                    <Tooltip formatter={(v: number) => fmt(v)} />
                    <Bar dataKey="sales" radius={[0, 4, 4, 0]}>
                      {sortedKPIs.map((_, i) => (
                        <Cell key={i} fill={i === 0 ? 'hsl(var(--primary))' : i === 1 ? 'hsl(var(--primary) / 0.7)' : 'hsl(var(--primary) / 0.4)'} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>

          {/* Ranking table */}
          <Card>
            <CardContent className="pt-4">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b text-muted-foreground">
                      <th className="text-left py-2 px-2">#</th>
                      <th className="text-left py-2 px-2">Vendedor</th>
                      <th className="text-right py-2 px-2">Ventas</th>
                      <th className="text-right py-2 px-2">Avance</th>
                      <th className="text-right py-2 px-2">Cotiz.</th>
                      <th className="text-right py-2 px-2">Pedidos</th>
                      <th className="text-right py-2 px-2">Cierre</th>
                      <th className="text-right py-2 px-2">Ticket</th>
                      <th className="text-right py-2 px-2">Clientes</th>
                      <th className="text-right py-2 px-2">Pipeline</th>
                    </tr>
                  </thead>
                  <tbody>
                    {sortedKPIs.map((kpi, i) => (
                      <tr key={kpi.vendorId} className="border-b hover:bg-muted/30 cursor-pointer" onClick={() => setSelectedVendor(kpi.vendorId)}>
                        <td className="py-2 px-2 font-bold">{i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : i + 1}</td>
                        <td className="py-2 px-2 font-medium">{kpi.vendorName}</td>
                        <td className="py-2 px-2 text-right font-mono">{fmt(kpi.sales)}</td>
                        <td className="py-2 px-2 text-right">
                          <span className={`font-bold ${progressColor(kpi.progressSales)}`}>{kpi.progressSales}%</span>
                        </td>
                        <td className="py-2 px-2 text-right">{kpi.quotations}</td>
                        <td className="py-2 px-2 text-right">{kpi.orders}</td>
                        <td className="py-2 px-2 text-right">{kpi.closeRate.toFixed(0)}%</td>
                        <td className="py-2 px-2 text-right font-mono">{fmt(kpi.avgTicket)}</td>
                        <td className="py-2 px-2 text-right">{kpi.newCustomers}</td>
                        <td className="py-2 px-2 text-right font-mono">{fmt(kpi.pipeline)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ═══ TAB: INDIVIDUAL ═══ */}
        <TabsContent value="individual" className="space-y-4">
          <div className="flex items-center gap-3">
            <Select value={selectedVendor ?? ''} onValueChange={v => setSelectedVendor(v)}>
              <SelectTrigger className="w-60"><SelectValue placeholder="Selecciona un vendedor" /></SelectTrigger>
              <SelectContent>
                {vendors.map(v => <SelectItem key={v.id} value={v.id}>{v.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>

          {selectedKPI ? (
            <>
              {/* KPI cards */}
              <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
                <KPICard label="Ventas" value={fmt(selectedKPI.sales)} goal={selectedKPI.goalSales > 0 ? `Meta: ${fmt(selectedKPI.goalSales)}` : undefined} progress={selectedKPI.progressSales} />
                <KPICard label="Cotizaciones" value={String(selectedKPI.quotations)} goal={selectedKPI.goalQuotations > 0 ? `Meta: ${selectedKPI.goalQuotations}` : undefined} progress={selectedKPI.progressQuotations} />
                <KPICard label="Pedidos" value={String(selectedKPI.orders)} goal={selectedKPI.goalOrders > 0 ? `Meta: ${selectedKPI.goalOrders}` : undefined} progress={selectedKPI.progressOrders} />
                <KPICard label="Tasa de cierre" value={`${selectedKPI.closeRate.toFixed(1)}%`} />
                <KPICard label="Ticket promedio" value={fmt(selectedKPI.avgTicket)} />
              </div>

              <div className="grid md:grid-cols-2 gap-4">
                {/* Radar */}
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

                {/* Detail cards */}
                <Card>
                  <CardHeader><CardTitle className="text-base">Detalle del período</CardTitle></CardHeader>
                  <CardContent className="space-y-3">
                    <DetailRow label="Pipeline abierto" value={fmt(selectedKPI.pipeline)} />
                    <DetailRow label="Clientes nuevos" value={String(selectedKPI.newCustomers)} />
                    <DetailRow label="Clientes reactivados" value={String(selectedKPI.reactivatedCustomers)} />
                    <DetailRow label="Seguimientos" value={String(selectedKPI.followups)} />
                    <DetailRow label="Cobranza" value={fmt(selectedKPI.collections)} />
                  </CardContent>
                </Card>
              </div>
            </>
          ) : (
            <Card><CardContent className="py-16 text-center text-muted-foreground">Selecciona un vendedor para ver su dashboard individual</CardContent></Card>
          )}
        </TabsContent>

        {/* ═══ TAB: GOALS ═══ */}
        <TabsContent value="goals" className="space-y-4">
          <p className="text-sm text-muted-foreground">Asigna metas mensuales a cada vendedor para {MONTHS[month - 1]} {year}.</p>

          <div className="space-y-3">
            {vendors.map(vendor => {
              const existing = goals.find(g => g.vendor_id === vendor.id);
              const edits = goalEdits[vendor.id] ?? {};
              const hasEdits = Object.keys(edits).length > 0;

              return (
                <Card key={vendor.id}>
                  <CardContent className="pt-4">
                    <div className="flex items-center justify-between mb-3">
                      <h3 className="font-semibold">{vendor.name}</h3>
                      <Button size="sm" disabled={!hasEdits} onClick={() => saveGoal(vendor.id)}>
                        <Save size={14} className="mr-1" /> Guardar
                      </Button>
                    </div>
                    <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
                      <GoalInput label="Meta ventas ($)" value={edits.goal_sales ?? existing?.goal_sales ?? 0} onChange={v => updateGoalField(vendor.id, 'goal_sales', v)} />
                      <GoalInput label="Meta cotizaciones" value={edits.goal_quotations ?? existing?.goal_quotations ?? 0} onChange={v => updateGoalField(vendor.id, 'goal_quotations', v)} />
                      <GoalInput label="Meta pedidos" value={edits.goal_orders ?? existing?.goal_orders ?? 0} onChange={v => updateGoalField(vendor.id, 'goal_orders', v)} />
                      <GoalInput label="Meta clientes nuevos" value={edits.goal_new_customers ?? existing?.goal_new_customers ?? 0} onChange={v => updateGoalField(vendor.id, 'goal_new_customers', v)} />
                      <GoalInput label="Meta seguimientos" value={edits.goal_followups ?? existing?.goal_followups ?? 0} onChange={v => updateGoalField(vendor.id, 'goal_followups', v)} />
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}

// ─── Sub-components ─────────────────────────────────────────────

function KPICard({ label, value, goal, progress }: { label: string; value: string; goal?: string; progress?: number }) {
  return (
    <Card>
      <CardContent className="pt-4 space-y-1">
        <div className="text-xs text-muted-foreground">{label}</div>
        <div className="text-xl font-bold">{value}</div>
        {goal && <div className="text-[11px] text-muted-foreground">{goal}</div>}
        {progress !== undefined && progress > 0 && (
          <div className="space-y-1">
            <Progress value={Math.min(progress, 100)} className="h-1.5" />
            <div className={`text-xs font-medium ${progress >= 100 ? 'text-green-600' : progress >= 60 ? 'text-amber-600' : 'text-destructive'}`}>{progress}%</div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between py-1.5 border-b border-border/50 last:border-0">
      <span className="text-sm text-muted-foreground">{label}</span>
      <span className="text-sm font-medium">{value}</span>
    </div>
  );
}

function GoalInput({ label, value, onChange }: { label: string; value: number; onChange: (v: number) => void }) {
  return (
    <div>
      <label className="text-[11px] text-muted-foreground">{label}</label>
      <Input
        type="number"
        value={value}
        onChange={e => onChange(Number(e.target.value))}
        className="h-8 text-sm"
      />
    </div>
  );
}
