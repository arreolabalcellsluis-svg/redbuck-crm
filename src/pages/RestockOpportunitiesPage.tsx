/**
 * Oportunidades por Reabasto — Uses real DB data.
 * Shows quotations that were rejected/expired and could be reactivated when stock is available.
 */
import { useState, useMemo } from 'react';
import { useQuotations } from '@/hooks/useQuotations';
import { useProducts } from '@/hooks/useProducts';
import { useTeamMembers } from '@/hooks/useTeamMembers';
import MetricCard from '@/components/shared/MetricCard';
import {
  RefreshCw, Search, DollarSign, Package, Clock, TrendingUp, AlertTriangle,
} from 'lucide-react';
import { Input } from '@/components/ui/input';

const fmt = (n: number) =>
  new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN', maximumFractionDigits: 0 }).format(n);

export default function RestockOpportunitiesPage() {
  const { data: dbQuotations = [] } = useQuotations();
  const { data: dbProducts = [] } = useProducts();
  const [search, setSearch] = useState('');

  // Restock opportunities: expired/rejected quotations where product now has stock
  const opportunities = useMemo(() => {
    return dbQuotations
      .filter(q => q.status === 'rechazada' || q.status === 'vencida')
      .map(q => {
        const items = q.items as any[];
        const productsWithStock = items?.filter((item: any) => {
          const product = dbProducts.find(p => p.id === item.productId);
          if (!product) return false;
          const stock = product.stock as Record<string, number>;
          const total = Object.values(stock).reduce((a: number, b) => a + Number(b), 0);
          return total > 0;
        }) || [];
        return {
          id: q.id,
          folio: q.folio,
          customerName: q.customer_name,
          vendorName: q.vendor_name,
          total: q.total,
          status: q.status,
          createdAt: q.created_at?.slice(0, 10) || '',
          hasStockNow: productsWithStock.length > 0,
          productsAvailable: productsWithStock.length,
          totalProducts: items?.length || 0,
        };
      });
  }, [dbQuotations, dbProducts]);

  const filtered = useMemo(() => {
    if (!search) return opportunities;
    const s = search.toLowerCase();
    return opportunities.filter(o =>
      o.folio.toLowerCase().includes(s) || o.customerName.toLowerCase().includes(s)
    );
  }, [opportunities, search]);

  const withStock = filtered.filter(o => o.hasStockNow);
  const totalValue = filtered.reduce((s, o) => s + o.total, 0);
  const recoverableValue = withStock.reduce((s, o) => s + o.total, 0);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold font-display text-foreground flex items-center gap-3">
          <RefreshCw size={24} className="text-primary" />
          Oportunidades por Reabasto
        </h1>
        <p className="text-sm text-muted-foreground">
          Cotizaciones vencidas o rechazadas donde el producto ya está disponible para reactivar.
        </p>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <MetricCard title="Total oportunidades" value={String(filtered.length)} icon={Package} />
        <MetricCard title="Con stock disponible" value={String(withStock.length)} icon={TrendingUp} variant="success" />
        <MetricCard title="Valor total" value={fmt(totalValue)} icon={DollarSign} />
        <MetricCard title="Valor recuperable" value={fmt(recoverableValue)} icon={DollarSign} variant="success" />
      </div>

      <div className="relative max-w-sm">
        <Search size={14} className="absolute left-2.5 top-2.5 text-muted-foreground" />
        <Input
          placeholder="Buscar por folio o cliente..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="pl-8 h-9 text-sm"
        />
      </div>

      {filtered.length === 0 ? (
        <div className="bg-card rounded-xl border p-12 text-center">
          <RefreshCw size={40} className="mx-auto text-muted-foreground mb-3" />
          <p className="text-muted-foreground">No hay oportunidades de reabasto por el momento.</p>
          <p className="text-xs text-muted-foreground mt-1">Las cotizaciones vencidas o rechazadas aparecerán aquí cuando el producto vuelva a estar disponible.</p>
        </div>
      ) : (
        <div className="bg-card rounded-xl border overflow-hidden">
          <table className="data-table">
            <thead>
              <tr>
                <th>Folio</th>
                <th>Cliente</th>
                <th>Vendedor</th>
                <th>Fecha</th>
                <th className="text-right">Total</th>
                <th>Estatus</th>
                <th>Stock disponible</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(o => (
                <tr key={o.id}>
                  <td className="font-medium text-sm">{o.folio}</td>
                  <td className="text-sm">{o.customerName}</td>
                  <td className="text-sm">{o.vendorName}</td>
                  <td className="text-sm text-muted-foreground">{o.createdAt}</td>
                  <td className="text-sm text-right font-semibold">{fmt(o.total)}</td>
                  <td>
                    <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${
                      o.status === 'vencida' ? 'bg-warning/10 text-warning' : 'bg-destructive/10 text-destructive'
                    }`}>
                      {o.status === 'vencida' ? 'Vencida' : 'Rechazada'}
                    </span>
                  </td>
                  <td>
                    {o.hasStockNow ? (
                      <span className="text-xs text-success font-semibold flex items-center gap-1">
                        <TrendingUp size={12} /> {o.productsAvailable}/{o.totalProducts} disponibles
                      </span>
                    ) : (
                      <span className="text-xs text-muted-foreground">Sin stock</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
