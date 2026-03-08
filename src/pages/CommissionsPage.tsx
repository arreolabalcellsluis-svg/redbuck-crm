import { useState, useMemo } from 'react';
import { useQuotations } from '@/hooks/useQuotations';
import { useOrders } from '@/hooks/useOrders';
import { useCustomers } from '@/hooks/useCustomers';
import { useSalesGoals, useCommissionConfig } from '@/hooks/useSalesGoals';
import { calcAllVendorKPIs, type VendorKPI } from '@/lib/vendorKPIsEngine';
import {
  buildVendorResults, calcGerenteCommission, calcCobranzaCommission, calcAdminCommission,
  calcExecutiveSummary, DEFAULT_ROLE_CONFIG,
  type RoleCommissionResult, type ExecutiveSummary,
} from '@/lib/roleCommissionsEngine';
import { useAppContext } from '@/contexts/AppContext';
import { DEMO_VENDEDOR_NAME } from '@/lib/rolePermissions';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import {
  BadgeDollarSign, Users, TrendingUp, ShieldCheck, BarChart3, AlertTriangle,
  DollarSign, Target, FileText, ArrowUpDown, Download,
} from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell,
  PieChart, Pie,
} from 'recharts';

const MONTHS = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'];
const fmt = (n: number) => new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN', maximumFractionDigits: 0 }).format(n);
const fmtPct = (n: number) => `${n.toFixed(1)}%`;

export default function CommissionsPage() {
  const now = new Date();
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [year, setYear] = useState(now.getFullYear());
  const { currentRole } = useAppContext();
  const isVendedor = currentRole === 'vendedor';

  const { data: quotations = [] } = useQuotations();
  const { data: orders = [] } = useOrders();
  const { data: customers = [] } = useCustomers();
  const { data: goals = [] } = useSalesGoals(month, year);
  const { data: configData } = useCommissionConfig();

  const vendorKPIs = useMemo(() =>
    calcAllVendorKPIs(quotations, orders, customers, goals, month, year, configData?.config, configData?.weights, configData?.levels),
    [quotations, orders, customers, goals, month, year, configData]
  );

  const roleConfig = DEFAULT_ROLE_CONFIG;

  const vendorResults = useMemo(() => buildVendorResults(vendorKPIs, orders, roleConfig.penalties), [vendorKPIs, orders]);
  const gerenteResult = useMemo(() => calcGerenteCommission(vendorKPIs, roleConfig.gerente), [vendorKPIs]);
  const cobranzaResult = useMemo(() => calcCobranzaCommission(vendorKPIs, roleConfig.cobranza), [vendorKPIs]);
  const adminResult = useMemo(() => calcAdminCommission(vendorKPIs, orders, roleConfig.administracion), [vendorKPIs, orders]);
  const summary = useMemo(() => calcExecutiveSummary(vendorResults, gerenteResult, cobranzaResult, adminResult, vendorKPIs), [vendorResults, gerenteResult, cobranzaResult, adminResult, vendorKPIs]);

  // Vendedor: only show their own
  const visibleVendorResults = isVendedor
    ? vendorResults.filter(r => r.userName.startsWith(DEMO_VENDEDOR_NAME.split(' ')[0]))
    : vendorResults;

  // Excel download state
  const [dlOpen, setDlOpen] = useState(false);
  const [dlDateFrom, setDlDateFrom] = useState('');
  const [dlDateTo, setDlDateTo] = useState('');

  const handleExcelDownload = async () => {
    const XLSX = await import('xlsx');
    const { saveAs } = await import('file-saver');
    const wb = XLSX.utils.book_new();

    // Vendor results
    const vendorData = visibleVendorResults.map(r => {
      const base = r.bonuses.find(b => b.label === 'Comisión base')?.amount ?? 0;
      const margin = r.bonuses.find(b => b.label === 'Bono margen')?.amount ?? 0;
      const goal = r.bonuses.find(b => b.label === 'Bono meta')?.amount ?? 0;
      const clients = r.bonuses.find(b => b.label === 'Bono clientes nuevos')?.amount ?? 0;
      const cob = r.bonuses.find(b => b.label === 'Bono cobranza')?.amount ?? 0;
      return {
        Vendedor: r.userName, 'Comisión base': base, 'Bono margen': margin,
        'Bono meta': goal, 'Bono clientes': clients, 'Bono cobranza': cob,
        Bruto: r.grossTotal, Castigos: r.penaltyTotal, Neto: r.netTotal,
      };
    });
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(vendorData), 'Vendedores');

    // Roles summary
    const rolesData = [
      { Rol: gerenteResult.roleName, Persona: gerenteResult.userName, Bruto: gerenteResult.grossTotal, Castigos: gerenteResult.penaltyTotal, Neto: gerenteResult.netTotal },
      { Rol: cobranzaResult.roleName, Persona: cobranzaResult.userName, Bruto: cobranzaResult.grossTotal, Castigos: cobranzaResult.penaltyTotal, Neto: cobranzaResult.netTotal },
      { Rol: adminResult.roleName, Persona: adminResult.userName, Bruto: adminResult.grossTotal, Castigos: adminResult.penaltyTotal, Neto: adminResult.netTotal },
    ];
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(rolesData), 'Roles');

    // Summary
    const summaryData = [
      { Indicador: 'Periodo', Valor: `${MONTHS[month - 1]} ${year}` },
      { Indicador: 'Rango fechas', Valor: dlDateFrom && dlDateTo ? `${dlDateFrom} a ${dlDateTo}` : 'Mes completo' },
      { Indicador: 'Total Vendedores', Valor: summary.totalVendorCommissions },
      { Indicador: 'Total Gerente', Valor: summary.totalGerenteBonus },
      { Indicador: 'Total Cobranza', Valor: summary.totalCobranzaBonus },
      { Indicador: 'Total Admin', Valor: summary.totalAdminBonus },
      { Indicador: 'GRAN TOTAL', Valor: summary.grandTotal },
      { Indicador: 'Ventas totales', Valor: summary.totalSales },
      { Indicador: 'Incentivos/Ventas %', Valor: summary.commissionToSalesRatio.toFixed(2) + '%' },
    ];
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(summaryData), 'Resumen');

    const buf = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
    const blob = new Blob([buf], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    const dateStr = dlDateFrom && dlDateTo ? `${dlDateFrom}_${dlDateTo}` : `${MONTHS[month-1]}-${year}`;
    saveAs(blob, `comisiones_${dateStr}.xlsx`);
    setDlOpen(false);
  };

  const pieData = [
    { name: 'Vendedores', value: summary.totalVendorCommissions, fill: 'hsl(var(--primary))' },
    { name: 'Gerente', value: summary.totalGerenteBonus, fill: 'hsl(var(--chart-2))' },
    { name: 'Cobranza', value: summary.totalCobranzaBonus, fill: 'hsl(var(--chart-3))' },
    { name: 'Admin', value: summary.totalAdminBonus, fill: 'hsl(var(--chart-4))' },
  ].filter(d => d.value > 0);

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-display font-bold text-foreground flex items-center gap-2">
            <BadgeDollarSign className="text-primary" size={28} /> Comisiones por Rol
          </h1>
          <p className="text-sm text-muted-foreground">Sistema de incentivos integral — {MONTHS[month - 1]} {year}</p>
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

      <Tabs defaultValue={isVendedor ? 'vendedores' : 'ejecutivo'}>
        <TabsList className="flex flex-wrap gap-1 h-auto p-1">
          {!isVendedor && <TabsTrigger value="ejecutivo"><BarChart3 size={14} className="mr-1" />Ejecutivo</TabsTrigger>}
          <TabsTrigger value="vendedores"><Users size={14} className="mr-1" />Vendedores</TabsTrigger>
          {!isVendedor && <TabsTrigger value="gerente"><TrendingUp size={14} className="mr-1" />Gerente</TabsTrigger>}
          {!isVendedor && <TabsTrigger value="cobranza"><DollarSign size={14} className="mr-1" />Cobranza</TabsTrigger>}
          {!isVendedor && <TabsTrigger value="admin"><ShieldCheck size={14} className="mr-1" />Administración</TabsTrigger>}
          {!isVendedor && <TabsTrigger value="castigos"><AlertTriangle size={14} className="mr-1" />Castigos</TabsTrigger>}
        </TabsList>

        {/* ═══ EJECUTIVO ═══ */}
        {!isVendedor && (
          <TabsContent value="ejecutivo" className="space-y-4">
            <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3">
              <SummaryCard label="Vendedores" value={fmt(summary.totalVendorCommissions)} icon={<Users size={18} />} />
              <SummaryCard label="Gerente" value={fmt(summary.totalGerenteBonus)} icon={<TrendingUp size={18} />} />
              <SummaryCard label="Cobranza" value={fmt(summary.totalCobranzaBonus)} icon={<DollarSign size={18} />} />
              <SummaryCard label="Admin" value={fmt(summary.totalAdminBonus)} icon={<ShieldCheck size={18} />} />
              <SummaryCard label="TOTAL INCENTIVOS" value={fmt(summary.grandTotal)} icon={<BadgeDollarSign size={18} />} highlight />
              <SummaryCard label="Ventas totales" value={fmt(summary.totalSales)} icon={<Target size={18} />} />
            </div>

            <div className="grid md:grid-cols-2 gap-4">
              {/* Distribution pie */}
              <Card>
                <CardHeader><CardTitle className="text-base">Distribución de incentivos</CardTitle></CardHeader>
                <CardContent>
                  <div className="h-52">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie data={pieData} dataKey="value" nameKey="name" cx="50%" cy="50%" innerRadius={50} outerRadius={80} paddingAngle={3}>
                          {pieData.map((d, i) => <Cell key={i} fill={d.fill} />)}
                        </Pie>
                        <Tooltip formatter={(v: number) => fmt(v)} />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                  <div className="flex flex-wrap justify-center gap-3 mt-2">
                    {pieData.map(d => (
                      <div key={d.name} className="flex items-center gap-1.5 text-xs">
                        <div className="w-2.5 h-2.5 rounded-full" style={{ background: d.fill }} />
                        <span>{d.name}: {fmt(d.value)}</span>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>

              {/* Ratios */}
              <Card>
                <CardHeader><CardTitle className="text-base">Rentabilidad de incentivos</CardTitle></CardHeader>
                <CardContent className="space-y-4">
                  <div>
                    <div className="flex justify-between text-sm mb-1">
                      <span className="text-muted-foreground">Incentivos / Ventas</span>
                      <span className="font-bold">{fmtPct(summary.commissionToSalesRatio)}</span>
                    </div>
                    <Progress value={Math.min(summary.commissionToSalesRatio * 5, 100)} className="h-2" />
                    <p className="text-[10px] text-muted-foreground mt-0.5">Recomendado: 3-8%</p>
                  </div>
                  <div>
                    <div className="flex justify-between text-sm mb-1">
                      <span className="text-muted-foreground">Incentivos / Utilidad bruta</span>
                      <span className="font-bold">{fmtPct(summary.commissionToProfitRatio)}</span>
                    </div>
                    <Progress value={Math.min(summary.commissionToProfitRatio * 2, 100)} className="h-2" />
                    <p className="text-[10px] text-muted-foreground mt-0.5">Recomendado: 10-25%</p>
                  </div>
                  <div className="pt-2 border-t space-y-1">
                    <DetailRow label="Ventas totales" value={fmt(summary.totalSales)} />
                    <DetailRow label="Utilidad bruta estimada" value={fmt(summary.totalGrossProfit)} />
                    <DetailRow label="Total incentivos" value={fmt(summary.grandTotal)} />
                    <DetailRow label="Utilidad después de incentivos" value={fmt(summary.totalGrossProfit - summary.grandTotal)} />
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* All roles table */}
            <Card>
              <CardHeader><CardTitle className="text-base">Resumen por rol</CardTitle></CardHeader>
              <CardContent className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead><tr className="border-b text-muted-foreground text-xs">
                    <th className="text-left py-2 px-2">Rol / Persona</th>
                    <th className="text-right px-2">Bruto</th>
                    <th className="text-right px-2">Castigos</th>
                    <th className="text-right px-2 font-bold">Neto</th>
                  </tr></thead>
                  <tbody>
                    {vendorResults.map(r => (
                      <tr key={r.userName} className="border-b hover:bg-muted/30">
                        <td className="py-2 px-2"><Badge variant="outline" className="mr-2 text-[10px]">Vendedor</Badge>{r.userName}</td>
                        <td className="py-2 px-2 text-right font-mono">{fmt(r.grossTotal)}</td>
                        <td className="py-2 px-2 text-right font-mono text-destructive">{r.penaltyTotal > 0 ? `-${fmt(r.penaltyTotal)}` : '—'}</td>
                        <td className="py-2 px-2 text-right font-mono font-bold">{fmt(r.netTotal)}</td>
                      </tr>
                    ))}
                    <RoleSummaryRow result={gerenteResult} />
                    <RoleSummaryRow result={cobranzaResult} />
                    <RoleSummaryRow result={adminResult} />
                  </tbody>
                  <tfoot><tr className="border-t-2 font-bold">
                    <td className="py-2 px-2">TOTAL</td>
                    <td className="py-2 px-2 text-right font-mono">{fmt(vendorResults.reduce((s,r)=>s+r.grossTotal,0) + gerenteResult.grossTotal + cobranzaResult.grossTotal + adminResult.grossTotal)}</td>
                    <td className="py-2 px-2 text-right font-mono text-destructive">{fmt(vendorResults.reduce((s,r)=>s+r.penaltyTotal,0))}</td>
                    <td className="py-2 px-2 text-right font-mono text-primary">{fmt(summary.grandTotal)}</td>
                  </tr></tfoot>
                </table>
              </CardContent>
            </Card>
          </TabsContent>
        )}

        {/* ═══ VENDEDORES ═══ */}
        <TabsContent value="vendedores" className="space-y-4">
          <Card><CardContent className="pt-4 overflow-x-auto">
            <table className="w-full text-sm">
              <thead><tr className="border-b text-muted-foreground text-xs">
                <th className="text-left py-2 px-1">Vendedor</th>
                <th className="text-right px-1">Ventas</th>
                <th className="text-right px-1">Base</th>
                <th className="text-right px-1">B.Margen</th>
                <th className="text-right px-1">B.Meta</th>
                <th className="text-right px-1">B.Clientes</th>
                <th className="text-right px-1">B.Cobranza</th>
                <th className="text-right px-1">Bruto</th>
                <th className="text-right px-1">Castigos</th>
                <th className="text-right px-1 font-bold">Neto</th>
              </tr></thead>
              <tbody>{visibleVendorResults.map(r => {
                const base = r.bonuses.find(b => b.label === 'Comisión base')?.amount ?? 0;
                const margin = r.bonuses.find(b => b.label === 'Bono margen')?.amount ?? 0;
                const goal = r.bonuses.find(b => b.label === 'Bono meta')?.amount ?? 0;
                const clients = r.bonuses.find(b => b.label === 'Bono clientes nuevos')?.amount ?? 0;
                const cob = r.bonuses.find(b => b.label === 'Bono cobranza')?.amount ?? 0;
                return (
                  <tr key={r.userName} className="border-b hover:bg-muted/30">
                    <td className="py-2 px-1 font-medium">{r.userName}</td>
                    <td className="py-2 px-1 text-right font-mono">{fmt(Number(r.kpis['Ventas'] ?? 0))}</td>
                    <td className="py-2 px-1 text-right font-mono">{fmt(base)}</td>
                    <td className="py-2 px-1 text-right font-mono">{fmt(margin)}</td>
                    <td className="py-2 px-1 text-right font-mono">{fmt(goal)}</td>
                    <td className="py-2 px-1 text-right font-mono">{fmt(clients)}</td>
                    <td className="py-2 px-1 text-right font-mono">{fmt(cob)}</td>
                    <td className="py-2 px-1 text-right font-mono">{fmt(r.grossTotal)}</td>
                    <td className="py-2 px-1 text-right font-mono text-destructive">{r.penaltyTotal > 0 ? `-${fmt(r.penaltyTotal)}` : '—'}</td>
                    <td className="py-2 px-1 text-right font-mono font-bold text-primary">{fmt(r.netTotal)}</td>
                  </tr>
                );
              })}</tbody>
            </table>
          </CardContent></Card>

          {/* Individual breakdown on click */}
          {visibleVendorResults.length > 0 && (
            <div className="space-y-3">
              {visibleVendorResults.map(r => (
                <RoleDetailCard key={r.userName} result={r} />
              ))}
            </div>
          )}
        </TabsContent>

        {/* ═══ GERENTE ═══ */}
        {!isVendedor && (
          <TabsContent value="gerente" className="space-y-4">
            <RoleDetailCard result={gerenteResult} showKPIs />
          </TabsContent>
        )}

        {/* ═══ COBRANZA ═══ */}
        {!isVendedor && (
          <TabsContent value="cobranza" className="space-y-4">
            <RoleDetailCard result={cobranzaResult} showKPIs />
          </TabsContent>
        )}

        {/* ═══ ADMIN ═══ */}
        {!isVendedor && (
          <TabsContent value="admin" className="space-y-4">
            <RoleDetailCard result={adminResult} showKPIs />
          </TabsContent>
        )}

        {/* ═══ CASTIGOS ═══ */}
        {!isVendedor && (
          <TabsContent value="castigos" className="space-y-4">
            <p className="text-sm text-muted-foreground">Castigos y reducciones aplicados automáticamente según reglas configuradas.</p>
            <Card>
              <CardHeader><CardTitle className="text-base flex items-center gap-2"><AlertTriangle size={16} className="text-destructive" /> Reglas activas</CardTitle></CardHeader>
              <CardContent className="space-y-2">
                <DetailRow label={`Margen < ${roleConfig.penalties.lowMarginThreshold}%`} value={`-${roleConfig.penalties.lowMarginPenaltyPct}% comisión`} />
                <DetailRow label={`Cancelaciones ≥ ${roleConfig.penalties.highCancellationThreshold}`} value={`-${roleConfig.penalties.highCancellationPenaltyPct}% comisión`} />
                <DetailRow label={`Sin cobrar > ${roleConfig.penalties.uncollectedThreshold}%`} value={`-${roleConfig.penalties.uncollectedPenaltyPct}% comisión`} />
              </CardContent>
            </Card>
            {vendorResults.filter(r => r.penalties.length > 0).length === 0 ? (
              <Card><CardContent className="py-12 text-center text-muted-foreground">Sin castigos aplicados este período</CardContent></Card>
            ) : (
              vendorResults.filter(r => r.penalties.length > 0).map(r => (
                <Card key={r.userName} className="border-l-4 border-l-destructive">
                  <CardContent className="pt-4">
                    <h3 className="font-semibold mb-2">{r.userName}</h3>
                    {r.penalties.map((p, i) => (
                      <div key={i} className="flex justify-between py-1 border-b border-border/50 last:border-0">
                        <div>
                          <span className="text-sm font-medium text-destructive">{p.label}</span>
                          <span className="text-xs text-muted-foreground ml-2">{p.detail}</span>
                        </div>
                        <span className="text-sm font-mono text-destructive">-{fmt(p.amount)}</span>
                      </div>
                    ))}
                  </CardContent>
                </Card>
              ))
            )}
          </TabsContent>
        )}
      </Tabs>
    </div>
  );
}

// ════════════════════════════════════════════════════════════════
// Sub-components
// ════════════════════════════════════════════════════════════════

function SummaryCard({ label, value, icon, highlight }: { label: string; value: string; icon: React.ReactNode; highlight?: boolean }) {
  return (
    <Card className={highlight ? 'border-primary/50 bg-primary/5' : ''}>
      <CardContent className="pt-4 text-center space-y-1">
        <div className="mx-auto text-primary">{icon}</div>
        <div className={`text-lg font-bold ${highlight ? 'text-primary' : ''}`}>{value}</div>
        <div className="text-[11px] text-muted-foreground">{label}</div>
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

function RoleSummaryRow({ result }: { result: RoleCommissionResult }) {
  return (
    <tr className="border-b hover:bg-muted/30 bg-muted/20">
      <td className="py-2 px-2"><Badge variant="secondary" className="mr-2 text-[10px]">{result.roleName}</Badge>{result.userName}</td>
      <td className="py-2 px-2 text-right font-mono">{fmt(result.grossTotal)}</td>
      <td className="py-2 px-2 text-right font-mono text-destructive">{result.penaltyTotal > 0 ? `-${fmt(result.penaltyTotal)}` : '—'}</td>
      <td className="py-2 px-2 text-right font-mono font-bold">{fmt(result.netTotal)}</td>
    </tr>
  );
}

function RoleDetailCard({ result, showKPIs }: { result: RoleCommissionResult; showKPIs?: boolean }) {
  const fmtVal = (v: number | string) => typeof v === 'number' ? fmt(v) : v;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2">
          <Badge variant="outline">{result.roleName}</Badge>
          {result.userName}
          <span className="ml-auto text-xl font-bold text-primary">{fmt(result.netTotal)}</span>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {showKPIs && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {Object.entries(result.kpis).map(([key, val]) => (
              <div key={key} className="text-center p-2 rounded-lg bg-muted/30">
                <div className="text-xs text-muted-foreground">{key}</div>
                <div className="text-sm font-bold">{fmtVal(val)}</div>
              </div>
            ))}
          </div>
        )}

        {result.bonuses.length > 0 && (
          <div>
            <h4 className="text-xs font-semibold text-muted-foreground uppercase mb-2">Bonos</h4>
            {result.bonuses.map((b, i) => (
              <div key={i} className="flex justify-between py-1.5 border-b border-border/50 last:border-0">
                <div>
                  <span className="text-sm font-medium">{b.label}</span>
                  <span className="text-xs text-muted-foreground ml-2">{b.detail}</span>
                </div>
                <span className="text-sm font-mono font-semibold text-green-600">+{fmt(b.amount)}</span>
              </div>
            ))}
          </div>
        )}

        {result.penalties.length > 0 && (
          <div>
            <h4 className="text-xs font-semibold text-destructive uppercase mb-2">Castigos</h4>
            {result.penalties.map((p, i) => (
              <div key={i} className="flex justify-between py-1.5 border-b border-border/50 last:border-0">
                <div>
                  <span className="text-sm font-medium text-destructive">{p.label}</span>
                  <span className="text-xs text-muted-foreground ml-2">{p.detail}</span>
                </div>
                <span className="text-sm font-mono text-destructive">-{fmt(p.amount)}</span>
              </div>
            ))}
          </div>
        )}

        <div className="flex justify-between pt-2 border-t-2 border-primary/30">
          <span className="font-bold">TOTAL NETO</span>
          <span className="text-xl font-bold text-primary">{fmt(result.netTotal)}</span>
        </div>
      </CardContent>
    </Card>
  );
}

const fmt2 = fmt;
