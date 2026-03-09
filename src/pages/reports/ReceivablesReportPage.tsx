import { useState, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, CreditCard, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import ReportFilterBar from '@/components/shared/ReportFilterBar';
import { exportFullExcel, exportFullPdf } from '@/lib/fullReportExport';
import { useAccountsReceivable } from '@/hooks/useAccountsReceivable';
import { useAppContext } from '@/contexts/AppContext';

const fmt = (n: number) => new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN', maximumFractionDigits: 0 }).format(n);

const AGING_LABELS: Record<string, string> = {
  all: 'Todos',
  al_corriente: 'Al corriente',
  por_vencer: 'Por vencer',
  vencido: 'Vencido',
  vencido_30: 'Vencido > 30d',
  vencido_60: 'Vencido > 60d',
  vencido_90: 'Vencido > 90d',
};

export default function ReceivablesReportPage() {
  const { currentRole } = useAppContext();
  const { data: dbReceivables = [], isLoading } = useAccountsReceivable();
  const [filters, setFilters] = useState<Record<string, any>>({ search: '', aging: '', dateFrom: undefined, dateTo: undefined });

  const records = useMemo(() => {
    return dbReceivables.map(ar => ({
      id: ar.id,
      customerName: ar.customer_name,
      orderFolio: ar.order_folio,
      total: ar.total,
      paid: ar.paid,
      balance: ar.balance,
      dueDate: ar.due_date,
      daysOverdue: ar.days_overdue,
      status: ar.status,
      agingBucket: ar.days_overdue > 90 ? 'vencido_90' : ar.days_overdue > 60 ? 'vencido_60' : ar.days_overdue > 30 ? 'vencido_30' : ar.status,
    }));
  }, [dbReceivables]);

  const filtered = useMemo(() => {
    return records.filter(r => {
      if (filters.search) {
        const s = filters.search.toLowerCase();
        if (!r.customerName.toLowerCase().includes(s) && !r.orderFolio.toLowerCase().includes(s)) return false;
      }
      if (filters.aging && filters.aging !== 'all') {
        if (filters.aging.startsWith('vencido_')) {
          const days = parseInt(filters.aging.split('_')[1]);
          if (r.daysOverdue <= days) return false;
        } else if (r.status !== filters.aging) return false;
      }
      return true;
    });
  }, [records, filters]);

  const totals = useMemo(() => ({
    total: filtered.reduce((s, r) => s + r.total, 0),
    pagado: filtered.reduce((s, r) => s + r.paid, 0),
    saldo: filtered.reduce((s, r) => s + r.balance, 0),
    alCorriente: filtered.filter(r => r.status === 'al_corriente').reduce((s, r) => s + r.balance, 0),
    vencido: filtered.filter(r => r.daysOverdue > 0).reduce((s, r) => s + r.balance, 0),
  }), [filtered]);

  const hasActiveFilters = !!(filters.search || filters.aging);

  const handleExportExcel = () => {
    const dateStr = new Date().toISOString().split('T')[0];
    exportFullExcel({
      title: 'Cuentas por Cobrar', subtitle: `Al ${new Date().toLocaleDateString('es-MX')}`, filename: `CxC_${dateStr}`,
      kpis: [
        { label: 'Total facturado', value: fmt(totals.total) },
        { label: 'Total pagado', value: fmt(totals.pagado), color: 'success' },
        { label: 'Saldo pendiente', value: fmt(totals.saldo), color: 'warning' },
        { label: 'Al corriente', value: fmt(totals.alCorriente), color: 'success' },
        { label: 'Cartera vencida', value: fmt(totals.vencido), color: 'destructive' },
      ],
      sections: [{ title: 'Detalle de cobranza', headers: ['Cliente', 'Folio', 'Vencimiento', 'Total', 'Pagado', 'Saldo', 'Días vencido', 'Estatus'], rows: filtered.map(r => [r.customerName, r.orderFolio, r.dueDate, fmt(r.total), fmt(r.paid), fmt(r.balance), r.daysOverdue > 0 ? `${r.daysOverdue}d` : '0', r.status]), totalsRow: ['TOTAL', '', '', fmt(totals.total), fmt(totals.pagado), fmt(totals.saldo), '', ''] }],
    });
  };

  const handleExportPdf = () => {
    const dateStr = new Date().toISOString().split('T')[0];
    exportFullPdf({
      title: 'Cuentas por Cobrar', subtitle: `Al ${new Date().toLocaleDateString('es-MX')}`, filename: `CxC_${dateStr}`,
      kpis: [
        { label: 'Total facturado', value: fmt(totals.total) },
        { label: 'Total pagado', value: fmt(totals.pagado), color: 'success' },
        { label: 'Saldo pendiente', value: fmt(totals.saldo), color: 'warning' },
        { label: 'Al corriente', value: fmt(totals.alCorriente), color: 'success' },
        { label: 'Cartera vencida', value: fmt(totals.vencido), color: 'destructive' },
      ],
      sections: [{ title: 'Detalle', headers: ['Cliente', 'Folio', 'Vencimiento', 'Total', 'Pagado', 'Saldo', 'Días vencido', 'Estatus'], rows: filtered.map(r => [r.customerName, r.orderFolio, r.dueDate, fmt(r.total), fmt(r.paid), fmt(r.balance), r.daysOverdue > 0 ? `${r.daysOverdue}d` : '0', r.status]), totalsRow: ['TOTAL', '', '', fmt(totals.total), fmt(totals.pagado), fmt(totals.saldo), '', ''] }],
    });
  };

  if (isLoading) return <div className="flex items-center justify-center py-20"><Loader2 className="animate-spin text-primary" size={32} /><span className="ml-3 text-muted-foreground">Cargando...</span></div>;

  return (
    <div>
      <div className="page-header">
        <div className="flex items-center gap-3">
          <Link to="/reportes-ejecutivos"><Button variant="ghost" size="sm"><ArrowLeft size={16} /></Button></Link>
          <div>
            <h1 className="page-title flex items-center gap-2"><CreditCard size={22} className="text-destructive" /> Cuentas por Cobrar</h1>
            <p className="page-subtitle">Reporte financiero de cobranza</p>
          </div>
        </div>
      </div>

      <ReportFilterBar
        config={{
          search: true, searchPlaceholder: 'Buscar por cliente o folio...',
          dateRange: true,
          selects: [
            { key: 'aging', label: 'Clasificación', options: Object.entries(AGING_LABELS).map(([k, v]) => ({ value: k, label: v })) },
          ],
          exportExcel: true, exportPdf: true,
        }}
        filters={filters}
        onFilterChange={(k, v) => setFilters(prev => ({ ...prev, [k]: v }))}
        onClear={() => setFilters({ search: '', aging: '', dateFrom: undefined, dateTo: undefined })}
        onExportExcel={handleExportExcel}
        onExportPdf={handleExportPdf}
        hasActiveFilters={hasActiveFilters}
      />

      <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-4">
        <div className="bg-card rounded-xl border p-4 text-center">
          <div className="text-xs text-muted-foreground">Total facturado</div>
          <div className="text-lg font-bold">{fmt(totals.total)}</div>
        </div>
        <div className="bg-card rounded-xl border p-4 text-center">
          <div className="text-xs text-muted-foreground">Total pagado</div>
          <div className="text-lg font-bold text-success">{fmt(totals.pagado)}</div>
        </div>
        <div className="bg-card rounded-xl border p-4 text-center">
          <div className="text-xs text-muted-foreground">Saldo pendiente</div>
          <div className="text-lg font-bold text-warning">{fmt(totals.saldo)}</div>
        </div>
        <div className="bg-card rounded-xl border p-4 text-center">
          <div className="text-xs text-muted-foreground">Al corriente</div>
          <div className="text-lg font-bold text-success">{fmt(totals.alCorriente)}</div>
        </div>
        <div className="bg-card rounded-xl border p-4 text-center">
          <div className="text-xs text-muted-foreground">Cartera vencida</div>
          <div className="text-lg font-bold text-destructive">{fmt(totals.vencido)}</div>
        </div>
      </div>

      <div className="bg-card rounded-xl border overflow-x-auto">
        <table className="data-table">
          <thead>
            <tr><th>Cliente</th><th>Folio pedido</th><th>Vencimiento</th><th>Total</th><th>Pagado</th><th>Saldo</th><th>Días vencido</th><th>Estatus</th></tr>
          </thead>
          <tbody>
            {filtered.map(r => (
              <tr key={r.id}>
                <td className="text-xs font-medium">{r.customerName}</td>
                <td className="text-xs font-mono">{r.orderFolio}</td>
                <td className="text-xs">{r.dueDate}</td>
                <td className="text-xs">{fmt(r.total)}</td>
                <td className="text-xs text-success">{fmt(r.paid)}</td>
                <td className="text-xs font-bold">{fmt(r.balance)}</td>
                <td className="text-xs">
                  {r.daysOverdue > 0 ? <span className="text-destructive font-bold">{r.daysOverdue}d</span> : <span className="text-success">0</span>}
                </td>
                <td>
                  <span className={`text-xs px-2 py-0.5 rounded-full ${
                    r.status === 'liquidado' ? 'bg-success/10 text-success' :
                    r.status === 'al_corriente' ? 'bg-primary/10 text-primary' :
                    r.status === 'por_vencer' ? 'bg-warning/10 text-warning' :
                    'bg-destructive/10 text-destructive'
                  }`}>{r.status}</span>
                </td>
              </tr>
            ))}
            {filtered.length === 0 && <tr><td colSpan={8} className="text-center text-muted-foreground py-8">Sin registros</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}
