import { useState, useMemo } from 'react';
import { useCommissionConfig } from '@/hooks/useSalesGoals';
import { useTeamMembers } from '@/hooks/useTeamMembers';
import { DEFAULT_COMMISSION_CONFIG, type CommissionConfig, type TeamMember } from '@/lib/vendorKPIsEngine';
import { DEFAULT_ROLE_CONFIG } from '@/lib/roleCommissionsEngine';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Progress } from '@/components/ui/progress';
import {
  Calculator, Play, RotateCcw, Copy, TrendingUp, BadgeDollarSign,
  DollarSign, Users, Target, BarChart3, AlertTriangle,
} from 'lucide-react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell, Legend,
} from 'recharts';

const fmt = (n: number) => new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN', maximumFractionDigits: 0 }).format(n);
const fmtPct = (n: number) => `${n.toFixed(1)}%`;

interface ScenarioInput {
  name: string;
  vendorId: string;
  vendorName: string;
  sales: number;
  margin: number;
  orders: number;
  quotations: number;
  newCustomers: number;
  collected: number;
  goalSales: number;
}

interface SimulationResult {
  scenarioName: string;
  vendorName: string;
  sales: number;
  margin: number;
  goalPct: number;
  baseAmount: number;
  baseRate: number;
  marginBonusPct: number;
  marginBonusAmount: number;
  goalBonusPct: number;
  goalBonusAmount: number;
  newCustomerCount: number;
  newCustomerBonusAmount: number;
  collectionBonusAmount: number;
  grossTotal: number;
  // Penalties
  penaltyTotal: number;
  penalties: { label: string; amount: number }[];
  netTotal: number;
}

function simulateCommission(input: ScenarioInput, config: CommissionConfig): SimulationResult {
  const goalPct = input.goalSales > 0 ? Math.round((input.sales / input.goalSales) * 100) : 0;

  // Base
  const baseAmount = input.sales * (config.baseRate / 100);

  // Margin bonus
  const marginTier = [...config.marginBonuses]
    .sort((a, b) => b.min_margin - a.min_margin)
    .find(t => input.margin >= t.min_margin);
  const marginBonusPct = marginTier?.bonus ?? 0;
  const marginBonusAmount = input.sales * (marginBonusPct / 100);

  // Goal bonus
  const goalTier = [...config.goalBonuses]
    .sort((a, b) => b.min_pct - a.min_pct)
    .find(t => goalPct >= t.min_pct);
  const goalBonusPct = goalTier?.bonus ?? 0;
  const goalBonusAmount = input.sales * (goalBonusPct / 100);

  // New customer bonus
  const newCustomerBonusAmount = input.newCustomers * config.newCustomerBonus;

  // Collection bonus
  const collectionBonusAmount = input.collected * (config.collectionBonusRate / 100);

  const grossTotal = baseAmount + marginBonusAmount + goalBonusAmount + newCustomerBonusAmount + collectionBonusAmount;

  // Penalties
  const penalties: { label: string; amount: number }[] = [];
  const penaltyConfig = DEFAULT_ROLE_CONFIG.penalties;

  if (input.margin > 0 && input.margin < penaltyConfig.lowMarginThreshold) {
    penalties.push({
      label: `Margen ${input.margin.toFixed(1)}% < ${penaltyConfig.lowMarginThreshold}%`,
      amount: grossTotal * (penaltyConfig.lowMarginPenaltyPct / 100),
    });
  }

  if (input.sales > 0) {
    const uncollectedPct = ((input.sales - input.collected) / input.sales) * 100;
    if (uncollectedPct > penaltyConfig.uncollectedThreshold) {
      penalties.push({
        label: `${uncollectedPct.toFixed(0)}% sin cobrar > ${penaltyConfig.uncollectedThreshold}%`,
        amount: grossTotal * (penaltyConfig.uncollectedPenaltyPct / 100),
      });
    }
  }

  const penaltyTotal = penalties.reduce((s, p) => s + p.amount, 0);

  return {
    scenarioName: input.name,
    vendorName: input.vendorName,
    sales: input.sales,
    margin: input.margin,
    goalPct,
    baseAmount,
    baseRate: config.baseRate,
    marginBonusPct,
    marginBonusAmount,
    goalBonusPct,
    goalBonusAmount,
    newCustomerCount: input.newCustomers,
    newCustomerBonusAmount,
    collectionBonusAmount,
    grossTotal,
    penaltyTotal,
    penalties,
    netTotal: Math.max(0, grossTotal - penaltyTotal),
  };
}

const defaultScenario = (name: string, vendorId: string, vendorName: string): ScenarioInput => ({
  name,
  vendorId,
  vendorName,
  sales: 400000,
  margin: 25,
  orders: 6,
  quotations: 12,
  newCustomers: 2,
  collected: 340000,
  goalSales: 500000,
});

export default function CommissionSimulatorPage() {
  const { data: configData } = useCommissionConfig();
  const commissionConfig = configData?.config ?? DEFAULT_COMMISSION_CONFIG;
  const { data: teamMembersRaw = [] } = useTeamMembers();
  const vendors = useMemo(() => teamMembersRaw.filter(m => m.role === 'vendedor' && m.active).map(m => ({ id: m.id, name: m.name })), [teamMembersRaw]);

  const [selectedVendor, setSelectedVendor] = useState(vendors[0]?.id ?? '');
  const selectedVendorName = vendors.find(v => v.id === selectedVendor)?.name ?? '';

  const [scenarios, setScenarios] = useState<ScenarioInput[]>([
    defaultScenario('Conservador', selectedVendor, selectedVendorName),
    { ...defaultScenario('Actual', selectedVendor, selectedVendorName), sales: 550000, margin: 28, orders: 8, quotations: 15, newCustomers: 3, collected: 470000 },
    { ...defaultScenario('Optimista', selectedVendor, selectedVendorName), sales: 750000, margin: 32, orders: 12, quotations: 20, newCustomers: 5, collected: 650000 },
  ]);

  const updateVendor = (vendorId: string) => {
    const name = vendors.find(v => v.id === vendorId)?.name ?? '';
    setSelectedVendor(vendorId);
    setScenarios(prev => prev.map(s => ({ ...s, vendorId, vendorName: name })));
  };

  const updateScenario = (index: number, field: keyof ScenarioInput, value: any) => {
    setScenarios(prev => prev.map((s, i) => i === index ? { ...s, [field]: value } : s));
  };

  const resetScenarios = () => {
    const name = vendors.find(v => v.id === selectedVendor)?.name ?? '';
    setScenarios([
      defaultScenario('Conservador', selectedVendor, name),
      { ...defaultScenario('Actual', selectedVendor, name), sales: 550000, margin: 28, orders: 8, quotations: 15, newCustomers: 3, collected: 470000 },
      { ...defaultScenario('Optimista', selectedVendor, name), sales: 750000, margin: 32, orders: 12, quotations: 20, newCustomers: 5, collected: 650000 },
    ]);
  };

  const results = useMemo(() =>
    scenarios.map(s => simulateCommission(s, commissionConfig)),
    [scenarios, commissionConfig]
  );

  const chartData = results.map(r => ({
    name: r.scenarioName,
    'Com. Base': r.baseAmount,
    'B. Margen': r.marginBonusAmount,
    'B. Meta': r.goalBonusAmount,
    'B. Clientes': r.newCustomerBonusAmount,
    'B. Cobranza': r.collectionBonusAmount,
    'Castigos': -r.penaltyTotal,
  }));

  const comparisonData = results.map(r => ({
    name: r.scenarioName,
    ventas: r.sales,
    comision: r.netTotal,
    ratio: r.sales > 0 ? (r.netTotal / r.sales) * 100 : 0,
  }));

  const COLORS = ['hsl(var(--primary))', 'hsl(var(--chart-2))', 'hsl(var(--chart-3))', 'hsl(var(--chart-4))', 'hsl(var(--chart-5))'];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-display font-bold text-foreground flex items-center gap-2">
            <Calculator className="text-primary" size={28} /> Simulador de Comisiones
          </h1>
          <p className="text-sm text-muted-foreground">Simula escenarios de ventas y estima comisiones sin afectar datos reales</p>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant="outline" className="text-xs px-3 py-1 border-amber-500 text-amber-600">
            <AlertTriangle size={12} className="mr-1" /> Solo simulación — No modifica datos reales
          </Badge>
        </div>
      </div>

      {/* Vendor selector + reset */}
      <div className="flex items-center gap-3">
        <Select value={selectedVendor} onValueChange={updateVendor}>
          <SelectTrigger className="w-52"><SelectValue placeholder="Selecciona vendedor" /></SelectTrigger>
          <SelectContent>{vendors.map(v => <SelectItem key={v.id} value={v.id}>{v.name}</SelectItem>)}</SelectContent>
        </Select>
        <Button variant="outline" size="sm" onClick={resetScenarios}><RotateCcw size={14} className="mr-1" />Resetear</Button>
      </div>

      {/* Active commission rules */}
      <Card>
        <CardHeader><CardTitle className="text-sm flex items-center gap-2"><BadgeDollarSign size={16} /> Reglas de comisión activas</CardTitle></CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-4 text-xs">
            <span className="px-2 py-1 rounded bg-muted">Base: {commissionConfig.baseRate}%</span>
            {commissionConfig.marginBonuses.map((t, i) => (
              <span key={i} className="px-2 py-1 rounded bg-muted">Margen ≥{t.min_margin}% → +{t.bonus}%</span>
            ))}
            {commissionConfig.goalBonuses.map((t, i) => (
              <span key={i} className="px-2 py-1 rounded bg-muted">Meta ≥{t.min_pct}% → +{t.bonus}%</span>
            ))}
            <span className="px-2 py-1 rounded bg-muted">Cliente nuevo: {fmt(commissionConfig.newCustomerBonus)}</span>
            <span className="px-2 py-1 rounded bg-muted">Cobranza: {commissionConfig.collectionBonusRate}%</span>
          </div>
        </CardContent>
      </Card>

      <Tabs defaultValue="inputs">
        <TabsList className="flex flex-wrap gap-1 h-auto p-1">
          <TabsTrigger value="inputs"><Play size={14} className="mr-1" />Escenarios</TabsTrigger>
          <TabsTrigger value="results"><BarChart3 size={14} className="mr-1" />Resultados</TabsTrigger>
          <TabsTrigger value="comparison"><TrendingUp size={14} className="mr-1" />Comparativa</TabsTrigger>
        </TabsList>

        {/* ═══ INPUTS ═══ */}
        <TabsContent value="inputs" className="space-y-4">
          <div className="grid md:grid-cols-3 gap-4">
            {scenarios.map((scenario, idx) => (
              <Card key={idx} className={idx === 1 ? 'border-primary/50' : ''}>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm flex items-center gap-2">
                    {idx === 0 ? '📉' : idx === 1 ? '📊' : '📈'}
                    <Input
                      value={scenario.name}
                      onChange={e => updateScenario(idx, 'name', e.target.value)}
                      className="h-7 text-sm font-bold border-none p-0 focus-visible:ring-0"
                    />
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <SimInput label="Ventas ($)" value={scenario.sales} onChange={v => updateScenario(idx, 'sales', v)} />
                  <SimInput label="Margen (%)" value={scenario.margin} onChange={v => updateScenario(idx, 'margin', v)} step={0.5} />
                  <SimInput label="Pedidos" value={scenario.orders} onChange={v => updateScenario(idx, 'orders', v)} />
                  <SimInput label="Cotizaciones" value={scenario.quotations} onChange={v => updateScenario(idx, 'quotations', v)} />
                  <SimInput label="Clientes nuevos" value={scenario.newCustomers} onChange={v => updateScenario(idx, 'newCustomers', v)} />
                  <SimInput label="Monto cobrado ($)" value={scenario.collected} onChange={v => updateScenario(idx, 'collected', v)} />
                  <SimInput label="Meta de ventas ($)" value={scenario.goalSales} onChange={v => updateScenario(idx, 'goalSales', v)} />

                  {/* Quick result */}
                  <div className="pt-3 border-t space-y-1">
                    <div className="flex justify-between text-xs">
                      <span className="text-muted-foreground">Cumplimiento</span>
                      <span className="font-bold">{results[idx]?.goalPct ?? 0}%</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-sm font-medium">Comisión neta</span>
                      <span className="text-lg font-bold text-primary">{fmt(results[idx]?.netTotal ?? 0)}</span>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>

        {/* ═══ RESULTS ═══ */}
        <TabsContent value="results" className="space-y-4">
          <div className="grid md:grid-cols-3 gap-4">
            {results.map((r, idx) => (
              <Card key={idx}>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm">{r.scenarioName}</CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  <DetailRow label="Ventas" value={fmt(r.sales)} />
                  <DetailRow label="Margen" value={fmtPct(r.margin)} />
                  <DetailRow label="Cumplimiento meta" value={`${r.goalPct}%`} />
                  <div className="border-t pt-2 mt-2">
                    <DetailRow label={`Comisión base (${r.baseRate}%)`} value={fmt(r.baseAmount)} />
                    <DetailRow label={`Bono margen (+${r.marginBonusPct}%)`} value={fmt(r.marginBonusAmount)} />
                    <DetailRow label={`Bono meta (+${r.goalBonusPct}%)`} value={fmt(r.goalBonusAmount)} />
                    <DetailRow label={`Bono clientes (${r.newCustomerCount})`} value={fmt(r.newCustomerBonusAmount)} />
                    <DetailRow label="Bono cobranza" value={fmt(r.collectionBonusAmount)} />
                  </div>
                  <DetailRow label="Bruto" value={fmt(r.grossTotal)} />
                  {r.penalties.length > 0 && (
                    <div className="border-t pt-2">
                      {r.penalties.map((p, i) => (
                        <div key={i} className="flex justify-between py-0.5">
                          <span className="text-xs text-destructive">{p.label}</span>
                          <span className="text-xs font-mono text-destructive">-{fmt(p.amount)}</span>
                        </div>
                      ))}
                    </div>
                  )}
                  <div className="flex justify-between pt-2 border-t-2 border-primary/30">
                    <span className="font-bold">NETO</span>
                    <span className="text-xl font-bold text-primary">{fmt(r.netTotal)}</span>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>

          {/* Stacked bar chart */}
          <Card>
            <CardHeader><CardTitle className="text-base">Desglose por escenario</CardTitle></CardHeader>
            <CardContent>
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={chartData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                    <XAxis dataKey="name" stroke="hsl(var(--muted-foreground))" fontSize={12} />
                    <YAxis tickFormatter={v => `$${(v / 1000).toFixed(0)}K`} stroke="hsl(var(--muted-foreground))" fontSize={11} />
                    <Tooltip formatter={(v: number) => fmt(Math.abs(v))} />
                    <Legend wrapperStyle={{ fontSize: 11 }} />
                    <Bar dataKey="Com. Base" stackId="a" fill="hsl(var(--primary))" />
                    <Bar dataKey="B. Margen" stackId="a" fill="hsl(var(--chart-2))" />
                    <Bar dataKey="B. Meta" stackId="a" fill="hsl(var(--chart-3))" />
                    <Bar dataKey="B. Clientes" stackId="a" fill="hsl(var(--chart-4))" />
                    <Bar dataKey="B. Cobranza" stackId="a" fill="hsl(var(--chart-5))" />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ═══ COMPARISON ═══ */}
        <TabsContent value="comparison" className="space-y-4">
          <Card>
            <CardHeader><CardTitle className="text-base">Comparativa de escenarios</CardTitle></CardHeader>
            <CardContent className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead><tr className="border-b text-muted-foreground text-xs">
                  <th className="text-left py-2 px-2">Escenario</th>
                  <th className="text-right px-2">Ventas</th>
                  <th className="text-right px-2">Meta</th>
                  <th className="text-right px-2">Cumpl.</th>
                  <th className="text-right px-2">Margen</th>
                  <th className="text-right px-2">Cobrado</th>
                  <th className="text-right px-2">Comisión bruta</th>
                  <th className="text-right px-2">Castigos</th>
                  <th className="text-right px-2 font-bold">Comisión neta</th>
                  <th className="text-right px-2">% s/Venta</th>
                </tr></thead>
                <tbody>{results.map((r, i) => (
                  <tr key={i} className="border-b hover:bg-muted/30">
                    <td className="py-2 px-2 font-medium">{i === 0 ? '📉' : i === 1 ? '📊' : '📈'} {r.scenarioName}</td>
                    <td className="py-2 px-2 text-right font-mono">{fmt(r.sales)}</td>
                    <td className="py-2 px-2 text-right font-mono">{fmt(scenarios[i].goalSales)}</td>
                    <td className="py-2 px-2 text-right">
                      <span className={r.goalPct >= 100 ? 'text-green-600 font-bold' : r.goalPct >= 60 ? 'text-amber-600' : 'text-destructive'}>{r.goalPct}%</span>
                    </td>
                    <td className="py-2 px-2 text-right">{fmtPct(r.margin)}</td>
                    <td className="py-2 px-2 text-right font-mono">{fmt(scenarios[i].collected)}</td>
                    <td className="py-2 px-2 text-right font-mono">{fmt(r.grossTotal)}</td>
                    <td className="py-2 px-2 text-right font-mono text-destructive">{r.penaltyTotal > 0 ? `-${fmt(r.penaltyTotal)}` : '—'}</td>
                    <td className="py-2 px-2 text-right font-mono font-bold text-primary">{fmt(r.netTotal)}</td>
                    <td className="py-2 px-2 text-right text-muted-foreground">{r.sales > 0 ? fmtPct((r.netTotal / r.sales) * 100) : '—'}</td>
                  </tr>
                ))}</tbody>
              </table>
            </CardContent>
          </Card>

          {/* Delta analysis */}
          {results.length >= 2 && (
            <Card>
              <CardHeader><CardTitle className="text-base">Análisis de variaciones</CardTitle></CardHeader>
              <CardContent>
                <div className="grid md:grid-cols-2 gap-4">
                  {results.slice(1).map((r, i) => {
                    const base = results[0];
                    const salesDelta = r.sales - base.sales;
                    const commDelta = r.netTotal - base.netTotal;
                    return (
                      <div key={i} className="p-4 rounded-lg bg-muted/30 space-y-2">
                        <h4 className="text-sm font-semibold">{r.scenarioName} vs {base.scenarioName}</h4>
                        <div className="flex justify-between text-sm">
                          <span className="text-muted-foreground">Δ Ventas</span>
                          <span className={`font-mono font-bold ${salesDelta >= 0 ? 'text-green-600' : 'text-destructive'}`}>
                            {salesDelta >= 0 ? '+' : ''}{fmt(salesDelta)}
                          </span>
                        </div>
                        <div className="flex justify-between text-sm">
                          <span className="text-muted-foreground">Δ Comisión</span>
                          <span className={`font-mono font-bold ${commDelta >= 0 ? 'text-green-600' : 'text-destructive'}`}>
                            {commDelta >= 0 ? '+' : ''}{fmt(commDelta)}
                          </span>
                        </div>
                        <div className="flex justify-between text-sm">
                          <span className="text-muted-foreground">Elasticidad</span>
                          <span className="font-mono text-muted-foreground">
                            {salesDelta !== 0 ? `${((commDelta / salesDelta) * 100).toFixed(1)}%` : '—'}
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}

// ─── Sub-components ─────────────────────────────────────────────
function SimInput({ label, value, onChange, step = 1 }: { label: string; value: number; onChange: (v: number) => void; step?: number }) {
  return (
    <div className="flex items-center justify-between gap-2">
      <label className="text-xs text-muted-foreground whitespace-nowrap">{label}</label>
      <Input
        type="number"
        step={step}
        value={value}
        onChange={e => onChange(Number(e.target.value))}
        className="h-7 w-28 text-sm text-right"
      />
    </div>
  );
}

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between py-1 border-b border-border/50 last:border-0">
      <span className="text-xs text-muted-foreground">{label}</span>
      <span className="text-xs font-medium font-mono">{value}</span>
    </div>
  );
}
