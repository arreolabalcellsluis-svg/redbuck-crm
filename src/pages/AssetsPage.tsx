import { useState, useMemo } from 'react';
import { Plus, Edit2, Trash2, Building2, Car, Monitor, Code, Package, MoreHorizontal, Loader2, Download } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { toast } from '@/hooks/use-toast';
import {
  useAssets, useAddAsset, useUpdateAsset, useDeleteAsset,
  calcDepreciation, getTotalMonthlyDepAmort,
  type Asset, type AssetCategory, type AssetType, type AssetStatus,
} from '@/hooks/useAssets';

const CATEGORY_LABELS: Record<AssetCategory, string> = {
  vehiculos: 'Vehículos', maquinaria: 'Maquinaria', computadoras: 'Computadoras',
  software: 'Software', mobiliario: 'Mobiliario', equipo_oficina: 'Equipo de oficina', otros: 'Otros',
};
const CATEGORY_ICONS: Record<AssetCategory, typeof Car> = {
  vehiculos: Car, maquinaria: Building2, computadoras: Monitor,
  software: Code, mobiliario: Package, equipo_oficina: Package, otros: MoreHorizontal,
};
const TYPE_LABELS: Record<AssetType, string> = { depreciacion: 'Depreciación', amortizacion: 'Amortización' };

const fmt = (n: number) => new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN', maximumFractionDigits: 0 }).format(n);

// Demo data used as fallback when DB is empty
const demoAssets: Asset[] = [
  { id: 'a1', nombre: 'Camioneta Nissan NP300', categoria: 'vehiculos', tipo: 'depreciacion', descripcion: 'Camioneta de reparto principal', fechaCompra: '2023-06-15', costoAdquisicion: 420000, vidaUtilMeses: 60, valorRescate: 120000, estatus: 'activo' },
  { id: 'a2', nombre: 'Camioneta RAM 700', categoria: 'vehiculos', tipo: 'depreciacion', descripcion: 'Vehículo de ventas', fechaCompra: '2024-01-10', costoAdquisicion: 350000, vidaUtilMeses: 60, valorRescate: 100000, estatus: 'activo' },
  { id: 'a3', nombre: 'Montacargas Yale 2.5T', categoria: 'maquinaria', tipo: 'depreciacion', descripcion: 'Montacargas bodega principal', fechaCompra: '2022-03-01', costoAdquisicion: 280000, vidaUtilMeses: 120, valorRescate: 40000, estatus: 'activo' },
  { id: 'a4', nombre: 'MacBook Pro 16"', categoria: 'computadoras', tipo: 'depreciacion', descripcion: 'Equipo dirección', fechaCompra: '2024-06-01', costoAdquisicion: 65000, vidaUtilMeses: 36, valorRescate: 15000, estatus: 'activo' },
  { id: 'a5', nombre: 'Licencia ERP / CRM', categoria: 'software', tipo: 'amortizacion', descripcion: 'Licencia anual sistema', fechaCompra: '2025-01-01', costoAdquisicion: 48000, vidaUtilMeses: 12, valorRescate: 0, estatus: 'activo' },
  { id: 'a6', nombre: 'Escritorios ejecutivos (5)', categoria: 'mobiliario', tipo: 'depreciacion', descripcion: 'Mobiliario oficina', fechaCompra: '2023-01-15', costoAdquisicion: 35000, vidaUtilMeses: 120, valorRescate: 5000, estatus: 'activo' },
];

const emptyForm: Omit<Asset, 'id'> = {
  nombre: '', categoria: 'otros', tipo: 'depreciacion', descripcion: '',
  fechaCompra: new Date().toISOString().split('T')[0], costoAdquisicion: 0,
  vidaUtilMeses: 60, valorRescate: 0, estatus: 'activo',
};

// Re-export for use by IncomeStatementReportPage
export { calcDepreciation, getTotalMonthlyDepAmort };
export type { Asset };

export default function AssetsPage() {
  const { data: dbAssets, isLoading } = useAssets();
  const addAssetMutation = useAddAsset();
  const updateAssetMutation = useUpdateAsset();
  const deleteAssetMutation = useDeleteAsset();

  // Use DB data if available, fallback to demo
  const assets: Asset[] = dbAssets && dbAssets.length > 0 ? dbAssets : demoAssets;

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<Omit<Asset, 'id'>>(emptyForm);
  const [filterCategory, setFilterCategory] = useState<string>('all');

  // Excel download
  const [dlOpen, setDlOpen] = useState(false);
  const [dlDateFrom, setDlDateFrom] = useState('');
  const [dlDateTo, setDlDateTo] = useState('');

  const dlFilteredCount = useMemo(() => {
    if (!dlDateFrom && !dlDateTo) return assets.length;
    return assets.filter(a => {
      if (dlDateFrom && a.fechaCompra < dlDateFrom) return false;
      if (dlDateTo && a.fechaCompra > dlDateTo) return false;
      return true;
    }).length;
  }, [assets, dlDateFrom, dlDateTo]);

  const handleExcelDownload = async () => {
    const XLSX = await import('xlsx');
    const { saveAs } = await import('file-saver');
    const filteredAssets = assets.filter(a => {
      if (dlDateFrom && a.fechaCompra < dlDateFrom) return false;
      if (dlDateTo && a.fechaCompra > dlDateTo) return false;
      return true;
    });
    const wb = XLSX.utils.book_new();
    const data = filteredAssets.map(a => {
      const dep = calcDepreciation(a);
      return {
        Nombre: a.nombre, Categoría: CATEGORY_LABELS[a.categoria], Tipo: TYPE_LABELS[a.tipo],
        Descripción: a.descripcion, 'Fecha compra': a.fechaCompra,
        'Costo adquisición': a.costoAdquisicion, 'Vida útil (meses)': a.vidaUtilMeses,
        'Valor rescate': a.valorRescate, 'Cargo mensual': dep.cargoMensual,
        'Dep. acumulada': dep.depAcumulada, 'Valor en libros': dep.valorLibros,
        Estatus: a.estatus === 'activo' ? 'Activo' : 'Dado de baja',
      };
    });
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(data), 'Activos');
    const resumen = [
      { Indicador: 'Periodo', Valor: dlDateFrom && dlDateTo ? `${dlDateFrom} a ${dlDateTo}` : 'Todos' },
      { Indicador: 'Total activos', Valor: filteredAssets.length },
      { Indicador: 'Costo total', Valor: filteredAssets.reduce((s, a) => s + a.costoAdquisicion, 0) },
      { Indicador: 'Valor en libros', Valor: filteredAssets.filter(a => a.estatus === 'activo').reduce((s, a) => s + calcDepreciation(a).valorLibros, 0) },
      { Indicador: 'Cargo mensual total', Valor: filteredAssets.filter(a => a.estatus === 'activo').reduce((s, a) => s + calcDepreciation(a).cargoMensual, 0) },
    ];
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(resumen), 'Resumen');
    const buf = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
    saveAs(new Blob([buf], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }),
      `activos-depreciacion_${dlDateFrom || 'inicio'}_${dlDateTo || 'fin'}.xlsx`);
    setDlOpen(false);
  };

  const filtered = useMemo(() => {
    let list = assets;
    if (filterCategory !== 'all') list = list.filter(a => a.categoria === filterCategory);
    return list;
  }, [assets, filterCategory]);

  const summary = useMemo(() => {
    const activos = assets.filter(a => a.estatus === 'activo');
    const totalCosto = activos.reduce((s, a) => s + a.costoAdquisicion, 0);
    const totalValorLibros = activos.reduce((s, a) => s + calcDepreciation(a).valorLibros, 0);
    const totalDepAcumulada = activos.reduce((s, a) => s + calcDepreciation(a).depAcumulada, 0);
    const cargoMensual = getTotalMonthlyDepAmort(assets);
    return { totalCosto, totalValorLibros, totalDepAcumulada, cargoMensual, count: activos.length };
  }, [assets]);

  const openCreate = () => { setForm(emptyForm); setEditingId(null); setDialogOpen(true); };
  const openEdit = (a: Asset) => {
    const { id, ...rest } = a;
    setForm(rest); setEditingId(id); setDialogOpen(true);
  };

  const isDbConnected = dbAssets && dbAssets.length > 0;
  const isDemoId = (id: string) => id.startsWith('a') && id.length <= 3;

  const handleSave = () => {
    if (!form.nombre.trim()) { toast({ title: 'Nombre requerido', variant: 'destructive' }); return; }
    if (editingId && !isDemoId(editingId)) {
      updateAssetMutation.mutate({ ...form, id: editingId });
    } else {
      addAssetMutation.mutate(form);
    }
    setDialogOpen(false);
  };

  const handleDelete = (id: string) => {
    if (isDemoId(id)) {
      toast({ title: 'Los activos demo no se pueden eliminar', description: 'Registra un activo real para usar la base de datos', variant: 'destructive' });
      return;
    }
    deleteAssetMutation.mutate(id);
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="animate-spin text-primary" size={32} />
        <span className="ml-3 text-muted-foreground">Cargando activos...</span>
      </div>
    );
  }

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title flex items-center gap-2"><Building2 size={22} className="text-primary" /> Activos y Depreciación</h1>
          <p className="page-subtitle">
            Registro y cálculo de depreciación / amortización
            {isDbConnected && <span className="ml-2 text-xs text-success">● Conectado a base de datos</span>}
            {!isDbConnected && <span className="ml-2 text-xs text-warning">● Datos demo — registra tu primer activo para activar</span>}
          </p>
        </div>
        <Button onClick={openCreate} size="sm"><Plus size={16} className="mr-1" /> Agregar Activo</Button>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-6">
        {[
          { label: 'Activos activos', value: summary.count.toString(), color: 'primary' },
          { label: 'Costo total', value: fmt(summary.totalCosto), color: 'primary' },
          { label: 'Valor en libros', value: fmt(summary.totalValorLibros), color: 'warning' },
          { label: 'Dep. acumulada', value: fmt(summary.totalDepAcumulada), color: 'destructive' },
          { label: 'Cargo mensual', value: fmt(summary.cargoMensual), color: 'success' },
        ].map(k => (
          <div key={k.label} className={`bg-card rounded-xl border p-4 text-center border-l-4 border-l-${k.color}`}>
            <div className="text-xs text-muted-foreground">{k.label}</div>
            <div className="text-lg font-bold">{k.value}</div>
          </div>
        ))}
      </div>

      {/* Filter */}
      <div className="flex gap-3 mb-4">
        <Select value={filterCategory} onValueChange={setFilterCategory}>
          <SelectTrigger className="w-48"><SelectValue placeholder="Categoría" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todas las categorías</SelectItem>
            {Object.entries(CATEGORY_LABELS).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      {/* Table */}
      <div className="bg-card rounded-xl border overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Activo</TableHead>
              <TableHead>Categoría</TableHead>
              <TableHead>Tipo</TableHead>
              <TableHead>Fecha compra</TableHead>
              <TableHead className="text-right">Costo</TableHead>
              <TableHead>Vida útil</TableHead>
              <TableHead className="text-right">Cargo mensual</TableHead>
              <TableHead className="text-right">Dep. acumulada</TableHead>
              <TableHead className="text-right">Valor libros</TableHead>
              <TableHead>Estatus</TableHead>
              <TableHead></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.map(a => {
              const dep = calcDepreciation(a);
              const Icon = CATEGORY_ICONS[a.categoria] || Package;
              return (
                <TableRow key={a.id} className={a.estatus === 'dado_de_baja' ? 'opacity-50' : ''}>
                  <TableCell className="font-medium text-xs">
                    <div className="flex items-center gap-2"><Icon size={14} className="text-muted-foreground" />{a.nombre}</div>
                  </TableCell>
                  <TableCell className="text-xs">{CATEGORY_LABELS[a.categoria]}</TableCell>
                  <TableCell className="text-xs">{TYPE_LABELS[a.tipo]}</TableCell>
                  <TableCell className="text-xs">{a.fechaCompra}</TableCell>
                  <TableCell className="text-xs text-right">{fmt(a.costoAdquisicion)}</TableCell>
                  <TableCell className="text-xs">{a.vidaUtilMeses} meses</TableCell>
                  <TableCell className="text-xs text-right">{fmt(dep.cargoMensual)}</TableCell>
                  <TableCell className="text-xs text-right">{fmt(dep.depAcumulada)}</TableCell>
                  <TableCell className="text-xs text-right font-semibold">{fmt(dep.valorLibros)}</TableCell>
                  <TableCell>
                    <Badge variant={a.estatus === 'activo' ? 'default' : 'secondary'} className="text-[10px]">
                      {a.estatus === 'activo' ? 'Activo' : 'Baja'}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <div className="flex gap-1">
                      <Button variant="ghost" size="sm" onClick={() => openEdit(a)}><Edit2 size={14} /></Button>
                      {a.estatus === 'activo' && (
                        <Button variant="ghost" size="sm" onClick={() => handleDelete(a.id)}><Trash2 size={14} className="text-destructive" /></Button>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              );
            })}
            {filtered.length === 0 && (
              <TableRow><TableCell colSpan={11} className="text-center text-muted-foreground py-8">Sin activos registrados</TableCell></TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      {/* Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>{editingId ? 'Editar Activo' : 'Nuevo Activo'}</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div><Label>Nombre *</Label><Input value={form.nombre} onChange={e => setForm({ ...form, nombre: e.target.value })} /></div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Categoría</Label>
                <Select value={form.categoria} onValueChange={v => setForm({ ...form, categoria: v as AssetCategory })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{Object.entries(CATEGORY_LABELS).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div>
                <Label>Tipo</Label>
                <Select value={form.tipo} onValueChange={v => setForm({ ...form, tipo: v as AssetType })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{Object.entries(TYPE_LABELS).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}</SelectContent>
                </Select>
              </div>
            </div>
            <div><Label>Descripción</Label><Input value={form.descripcion} onChange={e => setForm({ ...form, descripcion: e.target.value })} /></div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label>Fecha de compra</Label><Input type="date" value={form.fechaCompra} onChange={e => setForm({ ...form, fechaCompra: e.target.value })} /></div>
              <div><Label>Costo de adquisición</Label><Input type="number" min={0} value={form.costoAdquisicion} onChange={e => setForm({ ...form, costoAdquisicion: Number(e.target.value) })} /></div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label>Vida útil (meses)</Label><Input type="number" min={1} value={form.vidaUtilMeses} onChange={e => setForm({ ...form, vidaUtilMeses: Number(e.target.value) })} /></div>
              <div><Label>Valor de rescate</Label><Input type="number" min={0} value={form.valorRescate} onChange={e => setForm({ ...form, valorRescate: Number(e.target.value) })} /></div>
            </div>
            <div>
              <Label>Estatus</Label>
              <Select value={form.estatus} onValueChange={v => setForm({ ...form, estatus: v as AssetStatus })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="activo">Activo</SelectItem>
                  <SelectItem value="dado_de_baja">Dado de baja</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div><Label>Notas</Label><Textarea value={form.notas || ''} onChange={e => setForm({ ...form, notas: e.target.value })} rows={2} /></div>
            <Button onClick={handleSave} className="w-full" disabled={addAssetMutation.isPending || updateAssetMutation.isPending}>
              {(addAssetMutation.isPending || updateAssetMutation.isPending) && <Loader2 size={16} className="mr-2 animate-spin" />}
              {editingId ? 'Guardar cambios' : 'Registrar activo'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
