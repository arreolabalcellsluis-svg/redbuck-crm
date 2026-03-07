import { useState, useMemo } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Search, ArrowUpDown } from 'lucide-react';
import { Button } from '@/components/ui/button';
import type { ProductAnalysis } from '@/lib/planningEngine';
import { CATEGORY_LABELS } from '@/types';

const fmt = (n: number) =>
  new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN', maximumFractionDigits: 0 }).format(n);

type SortDir = 'asc' | 'desc';

function useSortable<T>(data: T[], defaultKey: keyof T, defaultDir: SortDir = 'asc') {
  const [sortKey, setSortKey] = useState<keyof T>(defaultKey);
  const [sortDir, setSortDir] = useState<SortDir>(defaultDir);

  const toggle = (key: keyof T) => {
    if (sortKey === key) setSortDir(d => (d === 'asc' ? 'desc' : 'asc'));
    else { setSortKey(key); setSortDir('asc'); }
  };

  const sorted = useMemo(() => {
    return [...data].sort((a, b) => {
      const va = a[sortKey]; const vb = b[sortKey];
      if (typeof va === 'number' && typeof vb === 'number') return sortDir === 'asc' ? va - vb : vb - va;
      return sortDir === 'asc' ? String(va).localeCompare(String(vb)) : String(vb).localeCompare(String(va));
    });
  }, [data, sortKey, sortDir]);

  const SortHeader = ({ column, label }: { column: keyof T; label: string }) => (
    <Button variant="ghost" size="sm" className="h-auto p-0 text-xs font-medium text-muted-foreground hover:text-foreground"
      onClick={() => toggle(column)}>
      {label} <ArrowUpDown size={12} className="ml-1" />
    </Button>
  );

  return { sorted, SortHeader };
}

// ─── Shared filter bar ──────────────────────────────────────────────
function FilterBar({ search, onSearch, category, onCategory }: {
  search: string; onSearch: (v: string) => void;
  category: string; onCategory: (v: string) => void;
}) {
  return (
    <div className="flex items-center gap-3 mb-4">
      <div className="relative flex-1">
        <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
        <Input placeholder="Buscar producto..." value={search} onChange={e => onSearch(e.target.value)}
          className="pl-8 h-8 text-xs" />
      </div>
      <Select value={category} onValueChange={onCategory}>
        <SelectTrigger className="w-40 h-8 text-xs"><SelectValue placeholder="Categoría" /></SelectTrigger>
        <SelectContent>
          <SelectItem value="_all">Todas</SelectItem>
          {Object.entries(CATEGORY_LABELS).map(([k, v]) => (
            <SelectItem key={k} value={k}>{v}</SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}

function useFilters(analyses: ProductAnalysis[]) {
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('_all');

  const filtered = useMemo(() => {
    let d = analyses;
    if (search) {
      const s = search.toLowerCase();
      d = d.filter(a => a.product.name.toLowerCase().includes(s) || a.product.sku.toLowerCase().includes(s));
    }
    if (category !== '_all') d = d.filter(a => a.product.category === category);
    return d;
  }, [analyses, search, category]);

  return { search, setSearch, category, setCategory, filtered };
}

// ─── 1. DÍAS DE INVENTARIO ─────────────────────────────────────────
interface DaysRow { producto: string; categoria: string; existencia: number; ventasPromedio: number; diasInventario: number; }

export function DaysOfInventoryDialog({ open, onOpenChange, analyses }: {
  open: boolean; onOpenChange: (v: boolean) => void; analyses: ProductAnalysis[];
}) {
  const withStock = useMemo(() => analyses.filter(a => a.totalStock > 0), [analyses]);
  const { search, setSearch, category, setCategory, filtered } = useFilters(withStock);

  const rows: DaysRow[] = useMemo(() =>
    filtered.map(a => ({
      producto: a.product.name,
      categoria: CATEGORY_LABELS[a.product.category] || a.product.category,
      existencia: a.totalStock,
      ventasPromedio: Math.round(a.monthlySales * 10) / 10,
      diasInventario: a.daysOfStock > 900 ? 999 : a.daysOfStock,
    })),
  [filtered]);

  const { sorted, SortHeader } = useSortable(rows, 'diasInventario', 'asc');

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[85vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="text-lg font-display">Días de Inventario — Detalle por producto</DialogTitle>
        </DialogHeader>
        <FilterBar search={search} onSearch={setSearch} category={category} onCategory={setCategory} />
        <div className="overflow-auto flex-1 -mx-6 px-6">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead><SortHeader column="producto" label="Producto" /></TableHead>
                <TableHead><SortHeader column="categoria" label="Categoría" /></TableHead>
                <TableHead className="text-right"><SortHeader column="existencia" label="Existencia" /></TableHead>
                <TableHead className="text-right"><SortHeader column="ventasPromedio" label="Ventas prom./mes" /></TableHead>
                <TableHead className="text-right"><SortHeader column="diasInventario" label="Días inv." /></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {sorted.map((r, i) => (
                <TableRow key={i}>
                  <TableCell className="font-medium text-sm">{r.producto}</TableCell>
                  <TableCell className="text-sm text-muted-foreground">{r.categoria}</TableCell>
                  <TableCell className="text-right text-sm font-semibold">{r.existencia}</TableCell>
                  <TableCell className="text-right text-sm">{r.ventasPromedio}</TableCell>
                  <TableCell className="text-right text-sm">
                    <span className={r.diasInventario > 180 ? 'text-destructive font-bold' : r.diasInventario > 90 ? 'text-warning font-semibold' : 'text-success font-semibold'}>
                      {r.diasInventario >= 999 ? '> 1 año' : `${r.diasInventario}d`}
                    </span>
                  </TableCell>
                </TableRow>
              ))}
              {sorted.length === 0 && (
                <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground py-8">Sin resultados</TableCell></TableRow>
              )}
            </TableBody>
          </Table>
        </div>
        <p className="text-xs text-muted-foreground mt-2">{sorted.length} productos</p>
      </DialogContent>
    </Dialog>
  );
}

// ─── 2. INVENTARIO MUERTO ──────────────────────────────────────────
interface DeadRow { producto: string; categoria: string; existencia: number; diasEnInventario: number; fechaUltimaVenta: string; valorInventario: number; }

export function DeadStockDialog({ open, onOpenChange, analyses }: {
  open: boolean; onOpenChange: (v: boolean) => void; analyses: ProductAnalysis[];
}) {
  const { search, setSearch, category, setCategory, filtered } = useFilters(analyses);

  const rows: DeadRow[] = useMemo(() =>
    filtered.filter(a => a.totalStock > 0).map(a => {
      const daysInInv = a.daysOfStock > 900 ? 999 : a.deadStockDays > 900 ? 999 : Math.max(a.daysOfStock, a.deadStockDays);
      const lastSaleDate = new Date();
      lastSaleDate.setDate(lastSaleDate.getDate() - daysInInv);
      return {
        producto: a.product.name,
        categoria: CATEGORY_LABELS[a.product.category] || a.product.category,
        existencia: a.totalStock,
        diasEnInventario: daysInInv,
        fechaUltimaVenta: daysInInv >= 999 ? 'Sin ventas' : lastSaleDate.toLocaleDateString('es-MX'),
        valorInventario: a.stockValue,
      };
    }),
  [filtered]);

  const { sorted, SortHeader } = useSortable(rows, 'diasEnInventario', 'desc');

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-5xl max-h-[85vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="text-lg font-display">Inventario Muerto — Detalle por producto</DialogTitle>
        </DialogHeader>
        <FilterBar search={search} onSearch={setSearch} category={category} onCategory={setCategory} />
        <div className="overflow-auto flex-1 -mx-6 px-6">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead><SortHeader column="producto" label="Producto" /></TableHead>
                <TableHead><SortHeader column="categoria" label="Categoría" /></TableHead>
                <TableHead className="text-right"><SortHeader column="existencia" label="Existencia" /></TableHead>
                <TableHead className="text-right"><SortHeader column="diasEnInventario" label="Días en inv." /></TableHead>
                <TableHead><SortHeader column="fechaUltimaVenta" label="Últ. venta" /></TableHead>
                <TableHead className="text-right"><SortHeader column="valorInventario" label="Valor inv." /></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {sorted.map((r, i) => (
                <TableRow key={i}>
                  <TableCell className="font-medium text-sm">{r.producto}</TableCell>
                  <TableCell className="text-sm text-muted-foreground">{r.categoria}</TableCell>
                  <TableCell className="text-right text-sm font-semibold">{r.existencia}</TableCell>
                  <TableCell className="text-right text-sm">
                    <span className={r.diasEnInventario > 180 ? 'text-destructive font-bold' : r.diasEnInventario > 90 ? 'text-warning font-semibold' : 'font-semibold'}>
                      {r.diasEnInventario >= 999 ? '> 1 año' : `${r.diasEnInventario}d`}
                    </span>
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">{r.fechaUltimaVenta}</TableCell>
                  <TableCell className="text-right text-sm font-semibold">{fmt(r.valorInventario)}</TableCell>
                </TableRow>
              ))}
              {sorted.length === 0 && (
                <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground py-8">Sin resultados</TableCell></TableRow>
              )}
            </TableBody>
          </Table>
        </div>
        <p className="text-xs text-muted-foreground mt-2">{sorted.length} productos</p>
      </DialogContent>
    </Dialog>
  );
}

// ─── 3. PRODUCTOS EXCEDENTES ───────────────────────────────────────
interface ExcessRow { producto: string; categoria: string; existencia: number; stockIdeal: number; cantidadExcedente: number; valorExcedente: number; }

export function ExcessStockDialog({ open, onOpenChange, analyses }: {
  open: boolean; onOpenChange: (v: boolean) => void; analyses: ProductAnalysis[];
}) {
  const excess = useMemo(() => analyses.filter(a => a.excessUnits > 0), [analyses]);
  const { search, setSearch, category, setCategory, filtered } = useFilters(excess);

  const rows: ExcessRow[] = useMemo(() =>
    filtered.map(a => ({
      producto: a.product.name,
      categoria: CATEGORY_LABELS[a.product.category] || a.product.category,
      existencia: a.totalStock,
      stockIdeal: a.idealStock,
      cantidadExcedente: a.excessUnits,
      valorExcedente: a.excessValue,
    })),
  [filtered]);

  const { sorted, SortHeader } = useSortable(rows, 'cantidadExcedente', 'desc');

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-5xl max-h-[85vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="text-lg font-display">Productos Excedentes — Detalle</DialogTitle>
        </DialogHeader>
        <FilterBar search={search} onSearch={setSearch} category={category} onCategory={setCategory} />
        <div className="overflow-auto flex-1 -mx-6 px-6">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead><SortHeader column="producto" label="Producto" /></TableHead>
                <TableHead><SortHeader column="categoria" label="Categoría" /></TableHead>
                <TableHead className="text-right"><SortHeader column="existencia" label="Existencia" /></TableHead>
                <TableHead className="text-right"><SortHeader column="stockIdeal" label="Stock ideal" /></TableHead>
                <TableHead className="text-right"><SortHeader column="cantidadExcedente" label="Excedente" /></TableHead>
                <TableHead className="text-right"><SortHeader column="valorExcedente" label="Valor excedente" /></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {sorted.map((r, i) => (
                <TableRow key={i}>
                  <TableCell className="font-medium text-sm">{r.producto}</TableCell>
                  <TableCell className="text-sm text-muted-foreground">{r.categoria}</TableCell>
                  <TableCell className="text-right text-sm font-semibold">{r.existencia}</TableCell>
                  <TableCell className="text-right text-sm text-muted-foreground">{r.stockIdeal}</TableCell>
                  <TableCell className="text-right text-sm">
                    <span className="text-destructive font-bold">{r.cantidadExcedente}</span>
                  </TableCell>
                  <TableCell className="text-right text-sm font-semibold text-destructive">{fmt(r.valorExcedente)}</TableCell>
                </TableRow>
              ))}
              {sorted.length === 0 && (
                <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground py-8">Sin resultados</TableCell></TableRow>
              )}
            </TableBody>
          </Table>
        </div>
        <p className="text-xs text-muted-foreground mt-2">{sorted.length} productos</p>
      </DialogContent>
    </Dialog>
  );
}
