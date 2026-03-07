import { useState, useMemo } from 'react';
import { demoProducts, demoSuppliers } from '@/data/demo-data';
import { CATEGORY_LABELS } from '@/types';
import MetricCard from '@/components/shared/MetricCard';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { CalendarIcon, Search, X, FileSpreadsheet, Download, ShoppingCart, DollarSign, Building2, Receipt, ArrowUpDown, Eye } from 'lucide-react';
import { format, subDays, startOfMonth, startOfWeek, endOfWeek, subMonths, isWithinInterval, startOfDay, endOfDay } from 'date-fns';
import { es } from 'date-fns/locale';
import { cn } from '@/lib/utils';
import * as XLSX from 'xlsx';
import { saveAs } from 'file-saver';

const fmt = (n: number) => new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN', maximumFractionDigits: 0 }).format(n);

interface PurchaseRecord {
  id: string;
  date: string;
  folio: string;
  supplier: string;
  productName: string;
  category: string;
  qty: number;
  unitCost: number;
  subtotal: number;
  tax: number;
  total: number;
  status: string;
  responsible: string;
  notes?: string;
}

const STATUSES = [
  { value: 'enviada', label: 'Enviada' },
  { value: 'confirmada', label: 'Confirmada' },
  { value: 'en_transito', label: 'En tránsito' },
  { value: 'recibida_parcial', label: 'Recibida parcial' },
  { value: 'recibida_total', label: 'Recibida total' },
  { value: 'cancelada', label: 'Cancelada' },
];

const statusLabel = (s: string) => STATUSES.find(st => st.value === s)?.label || s;

// Generate demo purchase history
function generatePurchaseHistory(): PurchaseRecord[] {
  const records: PurchaseRecord[] = [];
  const suppliers = demoSuppliers.filter(s => ['nacional', 'internacional'].includes(s.type));
  const products = demoProducts;
  const statuses = ['enviada', 'confirmada', 'en_transito', 'recibida_parcial', 'recibida_total'];
  const responsibles = ['Héctor Morales', 'Carlos Mendoza'];

  const baseDates = [
    '2025-10-05', '2025-10-18', '2025-11-02', '2025-11-15', '2025-11-28',
    '2025-12-03', '2025-12-15', '2026-01-08', '2026-01-20', '2026-02-01',
    '2026-02-10', '2026-02-15', '2026-02-22', '2026-02-28', '2026-03-01',
    '2026-03-03', '2026-03-05',
  ];

  baseDates.forEach((date, i) => {
    const supplier = suppliers[i % suppliers.length];
    const product = products[i % products.length];
    const qty = Math.floor(Math.random() * 5) + 1;
    const subtotal = product.cost * qty;
    const tax = Math.round(subtotal * 0.16);
    records.push({
      id: `ph-${i + 1}`,
      date,
      folio: `OC-${date.slice(0, 4)}-${String(i + 1).padStart(3, '0')}`,
      supplier: supplier.name,
      productName: product.name,
      category: CATEGORY_LABELS[product.category] || product.category,
      qty,
      unitCost: product.cost,
      subtotal,
      tax,
      total: subtotal + tax,
      status: i < baseDates.length - 3 ? 'recibida_total' : statuses[i % statuses.length],
      responsible: responsibles[i % responsibles.length],
      notes: i % 3 === 0 ? 'Compra programada' : undefined,
    });
  });
  return records;
}

const allRecords = generatePurchaseHistory();

const DATE_PRESETS = [
  { label: 'Hoy', getRange: () => ({ from: new Date(), to: new Date() }) },
  { label: 'Esta semana', getRange: () => ({ from: startOfWeek(new Date(), { weekStartsOn: 1 }), to: endOfWeek(new Date(), { weekStartsOn: 1 }) }) },
  { label: 'Este mes', getRange: () => ({ from: startOfMonth(new Date()), to: new Date() }) },
  { label: 'Mes pasado', getRange: () => ({ from: startOfMonth(subMonths(new Date(), 1)), to: startOfMonth(new Date()) }) },
];

type SortKey = 'date' | 'folio' | 'supplier' | 'total' | 'status';

export default function PurchaseHistoryPage() {
  const [dateFrom, setDateFrom] = useState<Date | undefined>();
  const [dateTo, setDateTo] = useState<Date | undefined>();
  const [search, setSearch] = useState('');
  const [supplier, setSupplier] = useState('');
  const [category, setCategory] = useState('');
  const [status, setStatus] = useState('');
  const [sortKey, setSortKey] = useState<SortKey>('date');
  const [sortAsc, setSortAsc] = useState(false);
  const [page, setPage] = useState(1);
  const [detailRecord, setDetailRecord] = useState<PurchaseRecord | null>(null);
  const pageSize = 10;

  const suppliers = [...new Set(allRecords.map(r => r.supplier))];
  const categories = [...new Set(allRecords.map(r => r.category))];

  const filtered = useMemo(() => {
    let data = [...allRecords];
    if (dateFrom) data = data.filter(r => new Date(r.date) >= startOfDay(dateFrom));
    if (dateTo) data = data.filter(r => new Date(r.date) <= endOfDay(dateTo));
    if (search) {
      const s = search.toLowerCase();
      data = data.filter(r => r.folio.toLowerCase().includes(s) || r.supplier.toLowerCase().includes(s) || r.productName.toLowerCase().includes(s));
    }
    if (supplier) data = data.filter(r => r.supplier === supplier);
    if (category) data = data.filter(r => r.category === category);
    if (status) data = data.filter(r => r.status === status);

    data.sort((a, b) => {
      const av = a[sortKey], bv = b[sortKey];
      const cmp = typeof av === 'number' ? (av as number) - (bv as number) : String(av).localeCompare(String(bv));
      return sortAsc ? cmp : -cmp;
    });
    return data;
  }, [dateFrom, dateTo, search, supplier, category, status, sortKey, sortAsc]);

  const totalPages = Math.ceil(filtered.length / pageSize);
  const paged = filtered.slice((page - 1) * pageSize, page * pageSize);

  const kpis = useMemo(() => ({
    total: filtered.reduce((s, r) => s + r.total, 0),
    count: filtered.length,
    suppliers: new Set(filtered.map(r => r.supplier)).size,
    avgTicket: filtered.length ? filtered.reduce((s, r) => s + r.total, 0) / filtered.length : 0,
  }), [filtered]);

  const hasFilters = !!(dateFrom || dateTo || search || supplier || category || status);
  const clearFilters = () => { setDateFrom(undefined); setDateTo(undefined); setSearch(''); setSupplier(''); setCategory(''); setStatus(''); setPage(1); };

  const toggleSort = (key: SortKey) => {
    if (sortKey === key) setSortAsc(!sortAsc);
    else { setSortKey(key); setSortAsc(true); }
  };

  const handleExport = (type: 'csv' | 'excel') => {
    const rows = filtered.map(r => ({
      Fecha: r.date, Folio: r.folio, Proveedor: r.supplier, Producto: r.productName,
      Categoría: r.category, Cantidad: r.qty, 'Costo Unitario': r.unitCost,
      Subtotal: r.subtotal, Impuestos: r.tax, Total: r.total, Estatus: statusLabel(r.status), Responsable: r.responsible,
    }));
    const ws = XLSX.utils.json_to_sheet(rows);
    ws['!cols'] = Object.keys(rows[0] || {}).map(() => ({ wch: 18 }));
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Compras');
    if (type === 'csv') {
      const csv = XLSX.utils.sheet_to_csv(ws);
      const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
      saveAs(blob, 'historial-compras.csv');
    } else {
      const buf = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
      saveAs(new Blob([buf], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }), 'historial-compras.xlsx');
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
        <h1 className="text-2xl font-bold font-display text-foreground">Historial de Compras</h1>
        <p className="text-sm text-muted-foreground">Consulta y exporta el historial completo de órdenes de compra.</p>
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
            <Input placeholder="Buscar folio, proveedor, producto..." value={search} onChange={e => { setSearch(e.target.value); setPage(1); }} className="pl-8 w-56 h-8 text-xs" />
          </div>
          <Select value={supplier} onValueChange={v => { setSupplier(v === '_all' ? '' : v); setPage(1); }}>
            <SelectTrigger className="w-44 h-8 text-xs"><SelectValue placeholder="Proveedor" /></SelectTrigger>
            <SelectContent><SelectItem value="_all">Todos</SelectItem>{suppliers.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
          </Select>
          <Select value={category} onValueChange={v => { setCategory(v === '_all' ? '' : v); setPage(1); }}>
            <SelectTrigger className="w-36 h-8 text-xs"><SelectValue placeholder="Categoría" /></SelectTrigger>
            <SelectContent><SelectItem value="_all">Todas</SelectItem>{categories.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
          </Select>
          <Select value={status} onValueChange={v => { setStatus(v === '_all' ? '' : v); setPage(1); }}>
            <SelectTrigger className="w-36 h-8 text-xs"><SelectValue placeholder="Estatus" /></SelectTrigger>
            <SelectContent><SelectItem value="_all">Todos</SelectItem>{STATUSES.map(s => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}</SelectContent>
          </Select>
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <MetricCard title="Monto Total" value={fmt(kpis.total)} icon={DollarSign} />
        <MetricCard title="Compras" value={kpis.count.toString()} icon={ShoppingCart} />
        <MetricCard title="Proveedores" value={kpis.suppliers.toString()} icon={Building2} />
        <MetricCard title="Ticket Promedio" value={fmt(kpis.avgTicket)} icon={Receipt} />
      </div>

      {/* Table */}
      <div className="bg-card rounded-xl border overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead><SortButton k="date" label="Fecha" /></TableHead>
              <TableHead><SortButton k="folio" label="Folio" /></TableHead>
              <TableHead><SortButton k="supplier" label="Proveedor" /></TableHead>
              <TableHead>Producto</TableHead>
              <TableHead>Categoría</TableHead>
              <TableHead className="text-right">Cant.</TableHead>
              <TableHead className="text-right">Costo Unit.</TableHead>
              <TableHead className="text-right"><SortButton k="total" label="Total" /></TableHead>
              <TableHead><SortButton k="status" label="Estatus" /></TableHead>
              <TableHead>Responsable</TableHead>
              <TableHead></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {paged.length === 0 && (
              <TableRow><TableCell colSpan={11} className="text-center py-8 text-muted-foreground">Sin resultados</TableCell></TableRow>
            )}
            {paged.map(r => (
              <TableRow key={r.id}>
                <TableCell className="text-xs">{r.date}</TableCell>
                <TableCell className="text-xs font-medium">{r.folio}</TableCell>
                <TableCell className="text-xs">{r.supplier}</TableCell>
                <TableCell className="text-xs">{r.productName}</TableCell>
                <TableCell className="text-xs">{r.category}</TableCell>
                <TableCell className="text-xs text-right">{r.qty}</TableCell>
                <TableCell className="text-xs text-right">{fmt(r.unitCost)}</TableCell>
                <TableCell className="text-xs text-right font-semibold">{fmt(r.total)}</TableCell>
                <TableCell><StatusPill status={r.status} /></TableCell>
                <TableCell className="text-xs">{r.responsible}</TableCell>
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
          <DialogHeader><DialogTitle>Detalle de Compra — {detailRecord?.folio}</DialogTitle></DialogHeader>
          {detailRecord && (
            <div className="space-y-3 text-sm">
              <Row label="Fecha" value={detailRecord.date} />
              <Row label="Folio" value={detailRecord.folio} />
              <Row label="Proveedor" value={detailRecord.supplier} />
              <Row label="Producto" value={detailRecord.productName} />
              <Row label="Categoría" value={detailRecord.category} />
              <Row label="Cantidad" value={String(detailRecord.qty)} />
              <Row label="Costo Unitario" value={fmt(detailRecord.unitCost)} />
              <Row label="Subtotal" value={fmt(detailRecord.subtotal)} />
              <Row label="Impuestos" value={fmt(detailRecord.tax)} />
              <Row label="Total" value={fmt(detailRecord.total)} bold />
              <Row label="Estatus" value={statusLabel(detailRecord.status)} />
              <Row label="Responsable" value={detailRecord.responsible} />
              {detailRecord.notes && <Row label="Notas" value={detailRecord.notes} />}
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

function StatusPill({ status }: { status: string }) {
  const colors: Record<string, string> = {
    recibida_total: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
    recibida_parcial: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400',
    confirmada: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
    en_transito: 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400',
    enviada: 'bg-muted text-muted-foreground',
    cancelada: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
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
