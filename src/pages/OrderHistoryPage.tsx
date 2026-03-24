import { useState, useMemo } from 'react';
import { useOrders } from '@/hooks/useOrders';
import { useProducts } from '@/hooks/useProducts';
import { CATEGORY_LABELS } from '@/types';
import MetricCard from '@/components/shared/MetricCard';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { CalendarIcon, Search, X, FileSpreadsheet, Download, ShoppingCart, DollarSign, Users, Receipt, ArrowUpDown, Eye } from 'lucide-react';
import { format, startOfMonth, subMonths, startOfWeek, endOfWeek, startOfDay, endOfDay } from 'date-fns';
import { es } from 'date-fns/locale';
import { cn } from '@/lib/utils';
import * as XLSX from 'xlsx';
import { saveAs } from 'file-saver';

const fmt = (n: number) => new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN', maximumFractionDigits: 0 }).format(n);

interface OrderRecord {
  id: string;
  date: string;
  folio: string;
  customerName: string;
  productName: string;
  category: string;
  qty: number;
  unitPrice: number;
  subtotal: number;
  tax: number;
  total: number;
  status: string;
  vendorName: string;
}

const ORDER_STATUSES: { value: string; label: string }[] = [
  { value: 'nuevo', label: 'Nuevo' },
  { value: 'por_confirmar', label: 'Por confirmar' },
  { value: 'confirmado', label: 'Confirmado' },
  { value: 'confirmado_anticipo', label: 'Confirmado c/anticipo' },
  { value: 'apartado', label: 'Apartado' },
  { value: 'entrega_programada', label: 'Entrega programada' },
  { value: 'en_bodega', label: 'En bodega' },
  { value: 'surtido_parcial', label: 'Surtido parcial' },
  { value: 'surtido_total', label: 'Surtido total' },
  { value: 'en_reparto', label: 'En reparto' },
  { value: 'en_entrega', label: 'En entrega' },
  { value: 'entregado', label: 'Entregado' },
  { value: 'cancelado', label: 'Cancelado' },
];

const statusLabel = (s: string) => ORDER_STATUSES.find(st => st.value === s)?.label || s;

const DATE_PRESETS = [
  { label: 'Hoy', getRange: () => ({ from: new Date(), to: new Date() }) },
  { label: 'Esta semana', getRange: () => ({ from: startOfWeek(new Date(), { weekStartsOn: 1 }), to: endOfWeek(new Date(), { weekStartsOn: 1 }) }) },
  { label: 'Este mes', getRange: () => ({ from: startOfMonth(new Date()), to: new Date() }) },
  { label: 'Mes pasado', getRange: () => ({ from: startOfMonth(subMonths(new Date(), 1)), to: startOfMonth(new Date()) }) },
];

type SortKey = 'date' | 'folio' | 'customerName' | 'total' | 'status';

export default function OrderHistoryPage() {
  const { data: dbOrders = [] } = useOrders();
  const { data: dbProducts = [] } = useProducts();

  // Flatten real orders into line-item records
  const allRecords = useMemo<OrderRecord[]>(() => {
    const records: OrderRecord[] = [];
    dbOrders.forEach(order => {
      const items = order.items as any[];
      items?.forEach((item: any) => {
        const itemName = item.name || item.productName || '';
        const product = dbProducts.find(p => p.name === itemName);
        const subtotal = (item.qty || 1) * (item.unitPrice || 0);
        const tax = Math.round(subtotal * 0.16);
        records.push({
          id: `oh-${order.id}-${itemName.slice(0, 5)}`,
          date: order.created_at?.slice(0, 10) || '',
          folio: order.folio,
          customerName: order.customer_name,
          productName: itemName,
          category: product ? (CATEGORY_LABELS[product.category as keyof typeof CATEGORY_LABELS] || product.category) : 'Otros',
          qty: item.qty || 1,
          unitPrice: item.unitPrice || 0,
          subtotal,
          tax,
          total: subtotal + tax,
          status: order.status,
          vendorName: order.vendor_name,
        });
      });
    });
    return records.sort((a, b) => b.date.localeCompare(a.date));
  }, [dbOrders, dbProducts]);

  const [dateFrom, setDateFrom] = useState<Date | undefined>();
  const [dateTo, setDateTo] = useState<Date | undefined>();
  const [search, setSearch] = useState('');
  const [customer, setCustomer] = useState('');
  const [category, setCategory] = useState('');
  const [status, setStatus] = useState('');
  const [sortKey, setSortKey] = useState<SortKey>('date');
  const [sortAsc, setSortAsc] = useState(false);
  const [page, setPage] = useState(1);
  const [detailRecord, setDetailRecord] = useState<OrderRecord | null>(null);
  const pageSize = 10;

  const customerNames = [...new Set(allRecords.map(r => r.customerName))].sort();
  const categories = useMemo(() => {
    const productCats = [...new Set(dbProducts.map(p => CATEGORY_LABELS[p.category as keyof typeof CATEGORY_LABELS] || p.category))].filter(Boolean).sort();
    return productCats.length > 0 ? productCats : [...new Set(allRecords.map(r => r.category))].sort();
  }, [dbProducts, allRecords]);

  const filtered = useMemo(() => {
    let data = [...allRecords];
    if (dateFrom) data = data.filter(r => new Date(r.date) >= startOfDay(dateFrom));
    if (dateTo) data = data.filter(r => new Date(r.date) <= endOfDay(dateTo));
    if (search) {
      const s = search.toLowerCase();
      data = data.filter(r => r.folio.toLowerCase().includes(s) || r.customerName.toLowerCase().includes(s) || r.productName.toLowerCase().includes(s));
    }
    if (customer) data = data.filter(r => r.customerName === customer);
    if (category) data = data.filter(r => r.category === category);
    if (status) data = data.filter(r => r.status === status);
    data.sort((a, b) => {
      const av = a[sortKey], bv = b[sortKey];
      const cmp = typeof av === 'number' ? (av as number) - (bv as number) : String(av).localeCompare(String(bv));
      return sortAsc ? cmp : -cmp;
    });
    return data;
  }, [allRecords, dateFrom, dateTo, search, customer, category, status, sortKey, sortAsc]);

  const totalPages = Math.ceil(filtered.length / pageSize);
  const paged = filtered.slice((page - 1) * pageSize, page * pageSize);

  const kpis = useMemo(() => ({
    total: filtered.reduce((s, r) => s + r.total, 0),
    count: filtered.length,
    customers: new Set(filtered.map(r => r.customerName)).size,
    avgTicket: filtered.length ? filtered.reduce((s, r) => s + r.total, 0) / filtered.length : 0,
  }), [filtered]);

  const hasFilters = !!(dateFrom || dateTo || search || customer || category || status);
  const clearFilters = () => { setDateFrom(undefined); setDateTo(undefined); setSearch(''); setCustomer(''); setCategory(''); setStatus(''); setPage(1); };

  const toggleSort = (key: SortKey) => {
    if (sortKey === key) setSortAsc(!sortAsc);
    else { setSortKey(key); setSortAsc(true); }
  };

  const handleExport = (type: 'csv' | 'excel') => {
    const rows = filtered.map(r => ({
      Fecha: r.date, Folio: r.folio, Cliente: r.customerName, Producto: r.productName,
      Categoría: r.category, Cantidad: r.qty, 'Precio Unitario': r.unitPrice,
      Subtotal: r.subtotal, Impuestos: r.tax, Total: r.total, Estatus: statusLabel(r.status), Vendedor: r.vendorName,
    }));
    const ws = XLSX.utils.json_to_sheet(rows);
    ws['!cols'] = Object.keys(rows[0] || {}).map(() => ({ wch: 18 }));
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Pedidos');
    if (type === 'csv') {
      const csv = XLSX.utils.sheet_to_csv(ws);
      saveAs(new Blob([csv], { type: 'text/csv;charset=utf-8' }), 'historial-pedidos.csv');
    } else {
      const buf = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
      saveAs(new Blob([buf], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }), 'historial-pedidos.xlsx');
    }
  };

  const SortButton = ({ k, label }: { k: SortKey; label: string }) => (
    <button onClick={() => toggleSort(k)} className="flex items-center gap-1 hover:text-foreground">
      {label} <ArrowUpDown size={12} className={sortKey === k ? 'text-primary' : 'opacity-40'} />
    </button>
  );

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold font-display text-foreground">Historial de Pedidos</h1>
        <p className="text-sm text-muted-foreground">Consulta y exporta el historial completo de pedidos de venta.</p>
      </div>

      {/* Filters */}
      <div className="bg-card rounded-xl border p-4 space-y-3">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-sm font-semibold text-muted-foreground">Filtros</span>
          {DATE_PRESETS.map(p => (
            <Button key={p.label} variant="outline" size="sm" className="text-xs h-7 px-2"
              onClick={() => { const r = p.getRange(); setDateFrom(r.from); setDateTo(r.to); setPage(1); }}>
              {p.label}
            </Button>
          ))}
          <div className="ml-auto flex gap-2">
            {hasFilters && <Button variant="ghost" size="sm" onClick={clearFilters} className="text-xs h-7"><X size={14} className="mr-1" />Limpiar</Button>}
            <Button variant="outline" size="sm" onClick={() => handleExport('csv')} className="text-xs h-7"><Download size={14} className="mr-1" />CSV</Button>
            <Button variant="outline" size="sm" onClick={() => handleExport('excel')} className="text-xs h-7"><FileSpreadsheet size={14} className="mr-1" />Excel</Button>
          </div>
        </div>
        <div className="flex items-center gap-3 flex-wrap">
          <DatePicker label="Desde" value={dateFrom} onChange={d => { setDateFrom(d); setPage(1); }} />
          <DatePicker label="Hasta" value={dateTo} onChange={d => { setDateTo(d); setPage(1); }} />
          <div className="relative">
            <Search size={14} className="absolute left-2.5 top-2 text-muted-foreground" />
            <Input placeholder="Buscar folio, cliente, producto..." value={search} onChange={e => { setSearch(e.target.value); setPage(1); }} className="pl-8 w-56 h-8 text-xs" />
          </div>
          <Select value={customer} onValueChange={v => { setCustomer(v === '_all' ? '' : v); setPage(1); }}>
            <SelectTrigger className="w-48 h-8 text-xs"><SelectValue placeholder="Cliente" /></SelectTrigger>
            <SelectContent><SelectItem value="_all">Todos</SelectItem>{customerNames.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
          </Select>
          <Select value={category} onValueChange={v => { setCategory(v === '_all' ? '' : v); setPage(1); }}>
            <SelectTrigger className="w-36 h-8 text-xs"><SelectValue placeholder="Categoría" /></SelectTrigger>
            <SelectContent><SelectItem value="_all">Todas</SelectItem>{categories.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
          </Select>
          <Select value={status} onValueChange={v => { setStatus(v === '_all' ? '' : v); setPage(1); }}>
            <SelectTrigger className="w-40 h-8 text-xs"><SelectValue placeholder="Estatus" /></SelectTrigger>
            <SelectContent><SelectItem value="_all">Todos</SelectItem>{ORDER_STATUSES.map(s => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}</SelectContent>
          </Select>
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <MetricCard title="Monto Total" value={fmt(kpis.total)} icon={DollarSign} />
        <MetricCard title="Pedidos" value={kpis.count.toString()} icon={ShoppingCart} />
        <MetricCard title="Clientes" value={kpis.customers.toString()} icon={Users} />
        <MetricCard title="Ticket Promedio" value={fmt(kpis.avgTicket)} icon={Receipt} />
      </div>

      {/* Table */}
      <div className="bg-card rounded-xl border overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead><SortButton k="date" label="Fecha" /></TableHead>
              <TableHead><SortButton k="folio" label="Folio" /></TableHead>
              <TableHead><SortButton k="customerName" label="Cliente" /></TableHead>
              <TableHead>Producto</TableHead>
              <TableHead>Categoría</TableHead>
              <TableHead className="text-right">Cant.</TableHead>
              <TableHead className="text-right">P. Unit.</TableHead>
              <TableHead className="text-right"><SortButton k="total" label="Total" /></TableHead>
              <TableHead><SortButton k="status" label="Estatus" /></TableHead>
              <TableHead>Vendedor</TableHead>
              <TableHead></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {paged.length === 0 && (
              <TableRow><TableCell colSpan={11} className="text-center py-8 text-muted-foreground">Sin pedidos registrados</TableCell></TableRow>
            )}
            {paged.map(r => (
              <TableRow key={r.id}>
                <TableCell className="text-xs">{r.date}</TableCell>
                <TableCell className="text-xs font-medium">{r.folio}</TableCell>
                <TableCell className="text-xs">{r.customerName}</TableCell>
                <TableCell className="text-xs">{r.productName}</TableCell>
                <TableCell className="text-xs">{r.category}</TableCell>
                <TableCell className="text-xs text-right">{r.qty}</TableCell>
                <TableCell className="text-xs text-right">{fmt(r.unitPrice)}</TableCell>
                <TableCell className="text-xs text-right font-semibold">{fmt(r.total)}</TableCell>
                <TableCell><OrderStatusPill status={r.status} /></TableCell>
                <TableCell className="text-xs">{r.vendorName}</TableCell>
                <TableCell>
                  <Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={() => setDetailRecord(r)}>
                    <Eye size={14} />
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
        {totalPages > 1 && (
          <div className="flex items-center justify-between px-4 py-3 border-t">
            <span className="text-xs text-muted-foreground">{filtered.length} registros · Página {page} de {totalPages}</span>
            <div className="flex gap-1">
              <Button variant="outline" size="sm" className="h-7 text-xs" disabled={page <= 1} onClick={() => setPage(page - 1)}>Anterior</Button>
              <Button variant="outline" size="sm" className="h-7 text-xs" disabled={page >= totalPages} onClick={() => setPage(page + 1)}>Siguiente</Button>
            </div>
          </div>
        )}
      </div>

      {/* Detail Dialog */}
      <Dialog open={!!detailRecord} onOpenChange={() => setDetailRecord(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>Detalle de Pedido — {detailRecord?.folio}</DialogTitle></DialogHeader>
          {detailRecord && (
            <div className="space-y-3 text-sm">
              <Row label="Fecha" value={detailRecord.date} />
              <Row label="Folio" value={detailRecord.folio} />
              <Row label="Cliente" value={detailRecord.customerName} />
              <Row label="Producto" value={detailRecord.productName} />
              <Row label="Categoría" value={detailRecord.category} />
              <Row label="Cantidad" value={String(detailRecord.qty)} />
              <Row label="Precio Unitario" value={fmt(detailRecord.unitPrice)} />
              <Row label="Subtotal" value={fmt(detailRecord.subtotal)} />
              <Row label="Impuestos" value={fmt(detailRecord.tax)} />
              <Row label="Total" value={fmt(detailRecord.total)} bold />
              <Row label="Estatus" value={statusLabel(detailRecord.status)} />
              <Row label="Vendedor" value={detailRecord.vendorName} />
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

function Row({ label, value, bold }: { label: string; value: string; bold?: boolean }) {
  return (
    <div className="flex justify-between py-1 border-b border-border/50">
      <span className="text-muted-foreground">{label}</span>
      <span className={bold ? 'font-bold text-foreground' : 'text-foreground'}>{value}</span>
    </div>
  );
}

function OrderStatusPill({ status }: { status: string }) {
  const colors: Record<string, string> = {
    entregado: 'bg-success/10 text-success',
    confirmado: 'bg-info/10 text-info',
    en_entrega: 'bg-primary/10 text-primary',
    nuevo: 'bg-muted text-muted-foreground',
    cancelado: 'bg-destructive/10 text-destructive',
    surtido_total: 'bg-success/10 text-success',
    surtido_parcial: 'bg-warning/10 text-warning',
  };
  return <span className={cn('text-[10px] px-2 py-0.5 rounded-full font-medium', colors[status] || 'bg-muted text-muted-foreground')}>{statusLabel(status)}</span>;
}

function DatePicker({ label, value, onChange }: { label: string; value?: Date; onChange: (d: Date | undefined) => void }) {
  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="outline" size="sm" className={cn('h-8 text-xs gap-1', !value && 'text-muted-foreground')}>
          <CalendarIcon size={12} />
          {value ? format(value, 'dd/MM/yyyy') : label}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0" align="start">
        <Calendar mode="single" selected={value} onSelect={onChange} locale={es} className={cn('p-3 pointer-events-auto')} />
      </PopoverContent>
    </Popover>
  );
}
