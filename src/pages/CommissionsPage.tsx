import { useState } from 'react';
import { salesByVendor } from '@/data/demo-data';
import MetricCard from '@/components/shared/MetricCard';
import { BadgeDollarSign, Target, TrendingUp, Award, Pencil, Check, X } from 'lucide-react';
import { toast } from 'sonner';

const fmt = (n: number) => new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN', maximumFractionDigits: 0 }).format(n);

interface CommissionRow {
  id: string;
  name: string;
  sales: number;
  goal: number;
  collected: number;
  commissionRate: number;
  commission: number;
  progress: number;
  type: 'vendedor' | 'administracion';
}

const totalAllSales = salesByVendor.reduce((s, v) => s + v.sales, 0);

function buildInitialRows(): CommissionRow[] {
  const vendorRows: CommissionRow[] = salesByVendor.map((v, i) => ({
    id: `v-${i}`,
    name: v.name,
    sales: v.sales,
    goal: 400000,
    collected: v.sales * 0.85,
    commissionRate: 5,
    commission: v.sales * 0.05,
    progress: Math.round((v.sales / 400000) * 100),
    type: 'vendedor',
  }));

  const adminRow: CommissionRow = {
    id: 'admin',
    name: 'Administración',
    sales: totalAllSales,
    goal: 0,
    collected: totalAllSales * 0.85,
    commissionRate: 2.5,
    commission: totalAllSales * 0.025,
    progress: 0,
    type: 'administracion',
  };

  return [...vendorRows, adminRow];
}

export default function CommissionsPage() {
  const [rows, setRows] = useState<CommissionRow[]>(buildInitialRows);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editRate, setEditRate] = useState<number>(0);
  const [editGoal, setEditGoal] = useState<number>(0);
  const [editName, setEditName] = useState('');

  const totalCommissions = rows.reduce((s, v) => s + v.commission, 0);
  const topVendor = rows.filter(r => r.type === 'vendedor').sort((a, b) => b.sales - a.sales)[0];

  const startEdit = (row: CommissionRow) => {
    setEditingId(row.id);
    setEditRate(row.commissionRate);
    setEditGoal(row.goal);
    setEditName(row.name);
  };

  const cancelEdit = () => {
    setEditingId(null);
  };

  const saveEdit = (id: string) => {
    if (editRate < 0 || editRate > 100) {
      toast.error('El porcentaje debe estar entre 0 y 100');
      return;
    }
    setRows(prev => prev.map(r => {
      if (r.id !== id) return r;
      const newRate = editRate;
      const newGoal = r.type === 'administracion' ? 0 : editGoal;
      const newName = editName.trim() || r.name;
      return {
        ...r,
        name: newName,
        commissionRate: newRate,
        commission: r.sales * (newRate / 100),
        goal: newGoal,
        progress: newGoal > 0 ? Math.round((r.sales / newGoal) * 100) : 0,
      };
    }));
    setEditingId(null);
    toast.success('Comisión actualizada');
  };

  return (
    <div>
      <div className="page-header">
        <h1 className="page-title">Comisiones</h1>
        <p className="page-subtitle">Seguimiento de comisiones por vendedor — Marzo 2026</p>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <MetricCard title="Vendedores" value={rows.filter(r => r.type === 'vendedor').length} icon={BadgeDollarSign} />
        <MetricCard title="Total comisiones" value={fmt(totalCommissions)} icon={TrendingUp} variant="primary" />
        <MetricCard title="Venta total" value={fmt(totalAllSales)} icon={Target} />
        <MetricCard title="Top vendedor" value={topVendor?.name || '-'} icon={Award} variant="success" />
      </div>

      <div className="bg-card rounded-xl border overflow-x-auto">
        <table className="data-table">
          <thead>
            <tr>
              <th>Nombre</th>
              <th>Tipo</th>
              <th>Venta</th>
              <th>Meta</th>
              <th>Avance</th>
              <th>Cobrado</th>
              <th>% Comisión</th>
              <th>Comisión</th>
              <th className="text-center">Acciones</th>
            </tr>
          </thead>
          <tbody>
            {rows.map(v => (
              <tr key={v.id} className={v.type === 'administracion' ? 'bg-muted/30 border-t-2 border-border' : ''}>
                {editingId === v.id ? (
                  <>
                    <td>
                      <input
                        value={editName}
                        onChange={e => setEditName(e.target.value)}
                        className="w-full px-2 py-1 rounded border bg-background text-sm"
                      />
                    </td>
                    <td className="text-xs text-muted-foreground">
                      {v.type === 'administracion' ? '🏢 Admin' : '👤 Vendedor'}
                    </td>
                    <td className="font-semibold">{fmt(v.sales)}</td>
                    <td>
                      {v.type === 'vendedor' ? (
                        <input
                          type="number"
                          value={editGoal}
                          onChange={e => setEditGoal(+e.target.value)}
                          className="w-24 px-2 py-1 rounded border bg-background text-sm"
                        />
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </td>
                    <td>—</td>
                    <td>{fmt(v.collected)}</td>
                    <td>
                      <div className="flex items-center gap-1">
                        <input
                          type="number"
                          step="0.5"
                          min="0"
                          max="100"
                          value={editRate}
                          onChange={e => setEditRate(+e.target.value)}
                          className="w-16 px-2 py-1 rounded border bg-background text-sm"
                        />
                        <span className="text-xs text-muted-foreground">%</span>
                      </div>
                    </td>
                    <td className="font-bold text-success">{fmt(v.sales * (editRate / 100))}</td>
                    <td className="text-center">
                      <div className="flex justify-center gap-1">
                        <button onClick={() => saveEdit(v.id)} className="p-1 rounded hover:bg-success/10 text-success" title="Guardar">
                          <Check size={16} />
                        </button>
                        <button onClick={cancelEdit} className="p-1 rounded hover:bg-destructive/10 text-destructive" title="Cancelar">
                          <X size={16} />
                        </button>
                      </div>
                    </td>
                  </>
                ) : (
                  <>
                    <td className="font-medium">{v.name}</td>
                    <td className="text-xs text-muted-foreground">
                      {v.type === 'administracion' ? '🏢 Admin' : '👤 Vendedor'}
                    </td>
                    <td className="font-semibold">{fmt(v.sales)}</td>
                    <td className="text-muted-foreground">
                      {v.type === 'vendedor' ? fmt(v.goal) : '—'}
                    </td>
                    <td>
                      {v.type === 'vendedor' ? (
                        <div className="flex items-center gap-2">
                          <div className="w-20 bg-muted rounded-full h-1.5">
                            <div
                              className={`h-1.5 rounded-full ${v.progress >= 100 ? 'bg-success' : v.progress >= 70 ? 'bg-warning' : 'bg-destructive'}`}
                              style={{ width: `${Math.min(v.progress, 100)}%` }}
                            />
                          </div>
                          <span className="text-xs font-medium">{v.progress}%</span>
                        </div>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </td>
                    <td>{fmt(v.collected)}</td>
                    <td>
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-primary/10 text-primary text-xs font-semibold">
                        {v.commissionRate}%
                      </span>
                    </td>
                    <td className="font-bold text-success">{fmt(v.commission)}</td>
                    <td className="text-center">
                      <button onClick={() => startEdit(v)} className="p-1.5 rounded-lg hover:bg-muted text-muted-foreground hover:text-foreground transition-colors" title="Editar comisión">
                        <Pencil size={15} />
                      </button>
                    </td>
                  </>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
