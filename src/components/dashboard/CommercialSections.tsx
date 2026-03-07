/**
 * 6 new commercial sections for the Executive Dashboard.
 * Appended AFTER existing sections — no modifications to current code.
 */
import { useMemo, useState } from 'react';
import {
  getOpportunityMoney, getVendorPerformance, getRecoverableMoney,
  getGrowthRadar, getUpgradeReadyClients, getCrossSellOpportunities,
  type RecoverableItem,
} from '@/lib/commercialIntelligence';
import {
  DollarSign, Flame, RefreshCw, Shuffle, ArrowUpCircle, UserX,
  Users, TrendingUp, Target, Radar, Crown, ShoppingBag,
  ArrowUp, ArrowDown, ChevronDown, ChevronUp,
} from 'lucide-react';

const fmt = (n: number) =>
  new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN', maximumFractionDigits: 0 }).format(n);

// ─── Shared sub-components ───────────────────────────────────────
function KPICard({ title, value, count, icon: Icon, color, priority }: {
  title: string; value: number; count: number; icon: any; color: string; priority?: 'high' | 'medium' | 'low';
}) {
  const priorityDot = priority === 'high' ? 'bg-destructive' : priority === 'medium' ? 'bg-warning' : 'bg-success';
  return (
    <div className="bg-card rounded-xl border p-4 hover:shadow-md transition-all">
      <div className="flex items-start justify-between mb-2">
        <div className={`p-2 rounded-lg ${color}`}>
          <Icon size={18} />
        </div>
        {priority && <span className={`w-2.5 h-2.5 rounded-full ${priorityDot}`} />}
      </div>
      <div className="text-xl font-bold font-display">{fmt(value)}</div>
      <div className="text-xs text-muted-foreground mt-1">{title}</div>
      <div className="text-[11px] font-medium text-muted-foreground mt-1">{count} registro{count !== 1 ? 's' : ''}</div>
    </div>
  );
}

function RecoverableCard({ title, value, count, icon: Icon, color, topItems }: {
  title: string; value: number; count: number; icon: any; color: string; topItems: RecoverableItem[];
}) {
  const [open, setOpen] = useState(false);
  return (
    <div className="bg-card rounded-xl border overflow-hidden">
      <div className="p-4">
        <div className="flex items-start justify-between mb-2">
          <div className={`p-2 rounded-lg ${color}`}>
            <Icon size={18} />
          </div>
          <span className="text-xs font-medium bg-destructive/10 text-destructive px-2 py-0.5 rounded-full">{count}</span>
        </div>
        <div className="text-xl font-bold font-display">{fmt(value)}</div>
        <div className="text-xs text-muted-foreground mt-1">{title}</div>
      </div>
      {topItems.length > 0 && (
        <>
          <button
            onClick={() => setOpen(!open)}
            className="w-full flex items-center justify-between px-4 py-2 border-t text-xs font-medium text-muted-foreground hover:bg-muted/50 transition-colors"
          >
            Top {topItems.length} mayor valor
            {open ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
          </button>
          {open && (
            <div className="border-t divide-y">
              {topItems.map(item => (
                <div key={item.id} className="px-4 py-2.5 text-xs flex items-center justify-between">
                  <div className="min-w-0">
                    <div className="font-medium truncate">{item.name}</div>
                    <div className="text-muted-foreground truncate">{item.detail}</div>
                  </div>
                  <span className="font-bold text-primary ml-3 whitespace-nowrap">{fmt(item.value)}</span>
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}

type SortDir = 'asc' | 'desc';

function SortableHeader({ label, active, dir, onClick }: {
  label: string; active: boolean; dir: SortDir; onClick: () => void;
}) {
  return (
    <th className="cursor-pointer select-none hover:text-primary transition-colors" onClick={onClick}>
      <span className="inline-flex items-center gap-1">
        {label}
        {active && (dir === 'asc' ? <ArrowUp size={12} /> : <ArrowDown size={12} />)}
      </span>
    </th>
  );
}

// ─── Main export ─────────────────────────────────────────────────
export default function CommercialSections() {
  const opp = useMemo(() => getOpportunityMoney(), []);
  const vendors = useMemo(() => getVendorPerformance(), []);
  const recoverable = useMemo(() => getRecoverableMoney(), []);
  const radar = useMemo(() => getGrowthRadar(), []);
  const upgradeClients = useMemo(() => getUpgradeReadyClients(), []);
  const crossSell = useMemo(() => getCrossSellOpportunities(), []);

  // Vendor sort
  const [vendorSort, setVendorSort] = useState<{ key: string; dir: SortDir }>({ key: 'totalSales', dir: 'desc' });
  const sortedVendors = useMemo(() => {
    const k = vendorSort.key as keyof typeof vendors[0];
    return [...vendors].sort((a, b) => {
      const av = a[k] as number;
      const bv = b[k] as number;
      return vendorSort.dir === 'asc' ? av - bv : bv - av;
    });
  }, [vendors, vendorSort]);

  const toggleVendorSort = (key: string) => {
    setVendorSort(prev => ({ key, dir: prev.key === key && prev.dir === 'desc' ? 'asc' : 'desc' }));
  };

  // Radar sort
  const [radarSort, setRadarSort] = useState<{ key: string; dir: SortDir }>({ key: 'score', dir: 'desc' });
  const sortedRadar = useMemo(() => {
    const k = radarSort.key as keyof typeof radar[0];
    return [...radar].sort((a, b) => {
      const av = a[k];
      const bv = b[k];
      if (typeof av === 'number' && typeof bv === 'number') return radarSort.dir === 'asc' ? av - bv : bv - av;
      return radarSort.dir === 'asc' ? String(av).localeCompare(String(bv)) : String(bv).localeCompare(String(av));
    });
  }, [radar, radarSort]);

  const toggleRadarSort = (key: string) => {
    setRadarSort(prev => ({ key, dir: prev.key === key && prev.dir === 'desc' ? 'asc' : 'desc' }));
  };

  const oppTypeLabels: Record<string, string> = {
    upgrade: '⬆️ Upgrade',
    cross_sell: '🔀 Venta cruzada',
    recent_interest: '🔥 Interés reciente',
  };

  const priorityLabels: Record<string, string> = {
    alta: '🔴 Alta',
    media: '🟡 Media',
    baja: '🟢 Baja',
  };

  return (
    <>
      {/* ═══ DINERO EN OPORTUNIDADES ═══ */}
      <div>
        <h2 className="font-display font-bold text-lg flex items-center gap-2 mb-4">
          <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center">
            <DollarSign size={16} className="text-primary" />
          </div>
          Dinero en Oportunidades
        </h2>
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
          <KPICard title="Cotizaciones abiertas" value={opp.openQuotationsValue} count={opp.openQuotationsCount} icon={DollarSign} color="bg-primary/10 text-primary" priority="high" />
          <KPICard title="Cotizaciones calientes" value={opp.hotQuotationsValue} count={opp.hotQuotationsCount} icon={Flame} color="bg-destructive/10 text-destructive" priority="high" />
          <KPICard title="Oportunidades reabasto" value={opp.restockOpportunitiesValue} count={opp.restockOpportunitiesCount} icon={RefreshCw} color="bg-warning/10 text-warning" priority="medium" />
          <KPICard title="Venta cruzada" value={opp.crossSellValue} count={opp.crossSellCount} icon={Shuffle} color="bg-info/10 text-info" priority="medium" />
          <KPICard title="Listos para crecer" value={opp.upgradeReadyValue} count={opp.upgradeReadyCount} icon={ArrowUpCircle} color="bg-success/10 text-success" priority="low" />
          <KPICard title="Sin seguimiento" value={opp.noFollowUpValue} count={opp.noFollowUpCount} icon={UserX} color="bg-muted text-muted-foreground" priority="high" />
        </div>
      </div>

      {/* ═══ RENDIMIENTO DE VENDEDORES ═══ */}
      <div className="bg-card rounded-xl border overflow-x-auto">
        <div className="p-5 border-b">
          <h2 className="font-display font-bold text-lg flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-success/10 flex items-center justify-center">
              <Users size={16} className="text-success" />
            </div>
            Rendimiento de Vendedores
          </h2>
        </div>
        <table className="data-table">
          <thead>
            <tr>
              <SortableHeader label="Vendedor" active={vendorSort.key === 'name'} dir={vendorSort.dir} onClick={() => toggleVendorSort('name')} />
              <SortableHeader label="Ventas totales" active={vendorSort.key === 'totalSales'} dir={vendorSort.dir} onClick={() => toggleVendorSort('totalSales')} />
              <SortableHeader label="# Cotizaciones" active={vendorSort.key === 'quotationCount'} dir={vendorSort.dir} onClick={() => toggleVendorSort('quotationCount')} />
              <SortableHeader label="Tasa de cierre" active={vendorSort.key === 'closeRate'} dir={vendorSort.dir} onClick={() => toggleVendorSort('closeRate')} />
            </tr>
          </thead>
          <tbody>
            {sortedVendors.map(v => (
              <tr key={v.name}>
                <td className="font-medium">{v.name}</td>
                <td className="font-bold">{fmt(v.totalSales)}</td>
                <td>{v.quotationCount}</td>
                <td>
                  <span className={`font-semibold ${v.closeRate >= 50 ? 'text-success' : v.closeRate >= 25 ? 'text-warning' : 'text-destructive'}`}>
                    {v.closeRate}%
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* ═══ DINERO RECUPERABLE ═══ */}
      <div>
        <h2 className="font-display font-bold text-lg flex items-center gap-2 mb-4">
          <div className="w-8 h-8 rounded-lg bg-destructive/10 flex items-center justify-center">
            <Target size={16} className="text-destructive" />
          </div>
          Dinero Recuperable
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <RecoverableCard title="Cotizaciones sin seguimiento" value={recoverable.noFollowUpValue} count={recoverable.noFollowUpCount} icon={UserX} color="bg-warning/10 text-warning" topItems={recoverable.noFollowUpTop} />
          <RecoverableCard title="Clientes inactivos" value={recoverable.inactiveClientsValue} count={recoverable.inactiveClientsCount} icon={Users} color="bg-destructive/10 text-destructive" topItems={recoverable.inactiveClientsTop} />
          <RecoverableCard title="Oportunidades por reabasto" value={recoverable.restockValue} count={recoverable.restockCount} icon={RefreshCw} color="bg-primary/10 text-primary" topItems={recoverable.restockTop} />
        </div>
      </div>

      {/* ═══ RADAR DE CRECIMIENTO ═══ */}
      <div>
        <h2 className="font-display font-bold text-lg flex items-center gap-2 mb-4">
          <div className="w-8 h-8 rounded-lg bg-info/10 flex items-center justify-center">
            <Radar size={16} className="text-info" />
          </div>
          Radar de Crecimiento
        </h2>
        <div className="grid grid-cols-3 gap-4 mb-4">
          <div className="bg-card rounded-xl border p-4 text-center">
            <div className="text-2xl font-bold text-success">{upgradeClients.length}</div>
            <div className="text-xs text-muted-foreground">Listos para crecer</div>
          </div>
          <div className="bg-card rounded-xl border p-4 text-center">
            <div className="text-2xl font-bold text-info">{crossSell.length}</div>
            <div className="text-xs text-muted-foreground">Venta cruzada</div>
          </div>
          <div className="bg-card rounded-xl border p-4 text-center">
            <div className="text-2xl font-bold text-primary">{radar.filter(r => r.opportunityType === 'recent_interest').length}</div>
            <div className="text-xs text-muted-foreground">Interés reciente</div>
          </div>
        </div>
        <div className="bg-card rounded-xl border overflow-x-auto">
          <table className="data-table">
            <thead>
              <tr>
                <SortableHeader label="Cliente" active={radarSort.key === 'customerName'} dir={radarSort.dir} onClick={() => toggleRadarSort('customerName')} />
                <th>Ciudad</th>
                <th>Vendedor</th>
                <th>Tipo oportunidad</th>
                <th>Producto sugerido</th>
                <SortableHeader label="Score" active={radarSort.key === 'score'} dir={radarSort.dir} onClick={() => toggleRadarSort('score')} />
                <th>Última actividad</th>
              </tr>
            </thead>
            <tbody>
              {sortedRadar.map((r, i) => (
                <tr key={`${r.customerId}-${r.opportunityType}-${i}`}>
                  <td className="font-medium">{r.customerName}</td>
                  <td className="text-muted-foreground">{r.city}</td>
                  <td className="text-muted-foreground">{r.vendorName}</td>
                  <td><span className="text-xs">{oppTypeLabels[r.opportunityType]}</span></td>
                  <td className="text-sm">{r.suggestedProduct}</td>
                  <td>
                    <div className="flex items-center gap-2">
                      <div className="w-12 bg-muted rounded-full h-1.5">
                        <div className="h-1.5 rounded-full bg-primary transition-all" style={{ width: `${r.score}%` }} />
                      </div>
                      <span className="text-xs font-bold">{r.score}</span>
                    </div>
                  </td>
                  <td className="text-xs text-muted-foreground">{r.lastActivity}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* ═══ CLIENTES LISTOS PARA CRECER ═══ */}
      <div className="bg-card rounded-xl border overflow-x-auto">
        <div className="p-5 border-b">
          <h2 className="font-display font-bold text-lg flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-success/10 flex items-center justify-center">
              <Crown size={16} className="text-success" />
            </div>
            Clientes Listos para Crecer
          </h2>
        </div>
        <table className="data-table">
          <thead>
            <tr>
              <th>Cliente</th>
              <th>Ciudad</th>
              <th>Vendedor</th>
              <th>Nivel actual</th>
              <th>Siguiente producto</th>
              <th>Valor estimado</th>
              <th>Score</th>
            </tr>
          </thead>
          <tbody>
            {upgradeClients.length === 0 ? (
              <tr><td colSpan={7} className="text-center text-muted-foreground py-6">Sin clientes identificados</td></tr>
            ) : upgradeClients.map(u => (
              <tr key={u.customerId}>
                <td className="font-medium">{u.customerName}</td>
                <td className="text-muted-foreground">{u.city}</td>
                <td className="text-muted-foreground">{u.vendorName}</td>
                <td>
                  <span className="text-xs px-2 py-0.5 rounded-full bg-muted font-medium">{u.currentLevel}</span>
                </td>
                <td className="text-sm font-medium text-primary">{u.nextProduct}</td>
                <td className="font-bold">{fmt(u.estimatedValue)}</td>
                <td>
                  <div className="flex items-center gap-2">
                    <div className="w-12 bg-muted rounded-full h-1.5">
                      <div className="h-1.5 rounded-full bg-success transition-all" style={{ width: `${u.score}%` }} />
                    </div>
                    <span className="text-xs font-bold">{u.score}</span>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* ═══ VENTA CRUZADA DISPONIBLE ═══ */}
      <div className="bg-card rounded-xl border overflow-x-auto">
        <div className="p-5 border-b">
          <h2 className="font-display font-bold text-lg flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-info/10 flex items-center justify-center">
              <ShoppingBag size={16} className="text-info" />
            </div>
            Venta Cruzada Disponible
          </h2>
        </div>
        <table className="data-table">
          <thead>
            <tr>
              <th>Cliente</th>
              <th>Ciudad</th>
              <th>Vendedor</th>
              <th>Producto comprado</th>
              <th>Producto sugerido</th>
              <th>Valor estimado</th>
              <th>Prioridad</th>
            </tr>
          </thead>
          <tbody>
            {crossSell.length === 0 ? (
              <tr><td colSpan={7} className="text-center text-muted-foreground py-6">Sin oportunidades identificadas</td></tr>
            ) : crossSell.map((c, i) => (
              <tr key={`${c.customerId}-${c.suggestedProduct}-${i}`}>
                <td className="font-medium">{c.customerName}</td>
                <td className="text-muted-foreground">{c.city}</td>
                <td className="text-muted-foreground">{c.vendorName}</td>
                <td className="text-sm text-muted-foreground">{c.purchasedProduct}</td>
                <td className="text-sm font-medium text-primary">{c.suggestedProduct}</td>
                <td className="font-bold">{fmt(c.estimatedValue)}</td>
                <td><span className="text-xs">{priorityLabels[c.priority]}</span></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
