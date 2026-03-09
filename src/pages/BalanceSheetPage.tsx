import { useState, useMemo } from 'react';
import { Plus, Edit2, Trash2, Landmark, Banknote, Users2, TrendingUp, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { toast } from '@/hooks/use-toast';
import { useBankAccounts, useAddBankAccount, useUpdateBankAccount, useDeleteBankAccount, type BankAccount } from '@/hooks/useBankAccounts';
import { useEquityEntries, useAddEquityEntry, useUpdateEquityEntry, useDeleteEquityEntry, type EquityEntry, type EquityType } from '@/hooks/useEquityEntries';
import { useOrders } from '@/hooks/useOrders';
import { useExpenses } from '@/hooks/useExpenses';

const fmt = (n: number) => new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN', maximumFractionDigits: 0 }).format(n);

const EQUITY_TYPE_LABELS: Record<EquityType, string> = {
  aportacion_socios: 'Aportación de Socios',
  utilidad_ejercicio: 'Utilidad del Ejercicio',
  utilidades_acumuladas: 'Utilidades Acumuladas',
};

const emptyBank: Omit<BankAccount, 'id'> = { nombre: '', banco: '', numero_cuenta: '', clabe: '', moneda: 'MXN', saldo: 0, activa: true, notas: '' };
const emptyEquity: Omit<EquityEntry, 'id'> = { tipo: 'aportacion_socios', concepto: '', monto: 0, fecha_inicio: new Date().toISOString().split('T')[0], fecha_fin: null, notas: '' };

export default function BalanceSheetPage() {
  const { data: bankAccounts = [], isLoading: loadingBanks } = useBankAccounts();
  const addBank = useAddBankAccount();
  const updateBank = useUpdateBankAccount();
  const deleteBank = useDeleteBankAccount();

  const { data: equityEntries = [], isLoading: loadingEquity } = useEquityEntries();
  const addEquity = useAddEquityEntry();
  const updateEquity = useUpdateEquityEntry();
  const deleteEquity = useDeleteEquityEntry();

  const { data: dbOrders = [] } = useOrders();
  const { data: dbExpenses = [] } = useExpenses();

  // Dialog state
  const [bankDialogOpen, setBankDialogOpen] = useState(false);
  const [bankForm, setBankForm] = useState<Omit<BankAccount, 'id'>>(emptyBank);
  const [editingBankId, setEditingBankId] = useState<string | null>(null);

  const [equityDialogOpen, setEquityDialogOpen] = useState(false);
  const [equityForm, setEquityForm] = useState<Omit<EquityEntry, 'id'>>(emptyEquity);
  const [editingEquityId, setEditingEquityId] = useState<string | null>(null);

  // Calculated profit from real data
  const currentYear = new Date().getFullYear();
  const calculatedProfit = useMemo(() => {
    const yearOrders = dbOrders.filter(o => new Date(o.created_at).getFullYear() === currentYear && o.status !== 'cancelado');
    const totalSales = yearOrders.reduce((s, o) => s + o.total, 0);
    // Estimate cost at ~60% of sales from items
    const totalCost = yearOrders.reduce((s, o) => {
      const items = Array.isArray(o.items) ? o.items : [];
      return s + items.reduce((is: number, it: any) => is + ((it.cost || it.costo || 0) * (it.qty || it.cantidad || 1)), 0);
    }, 0);
    const totalExpenses = dbExpenses.filter(e => new Date(e.fecha).getFullYear() === currentYear).reduce((s, e) => s + e.monto, 0);
    return totalSales - totalCost - totalExpenses;
  }, [dbOrders, dbExpenses, currentYear]);

  // Summaries
  const totalBankBalance = useMemo(() => bankAccounts.filter(a => a.activa).reduce((s, a) => s + a.saldo, 0), [bankAccounts]);
  const aportaciones = useMemo(() => equityEntries.filter(e => e.tipo === 'aportacion_socios').reduce((s, e) => s + e.monto, 0), [equityEntries]);
  const utilidadesAcum = useMemo(() => equityEntries.filter(e => e.tipo === 'utilidades_acumuladas').reduce((s, e) => s + e.monto, 0), [equityEntries]);
  const utilidadManual = useMemo(() => equityEntries.filter(e => e.tipo === 'utilidad_ejercicio').reduce((s, e) => s + e.monto, 0), [equityEntries]);
  const totalCapital = aportaciones + utilidadesAcum + calculatedProfit + utilidadManual;

  // Bank CRUD
  const openCreateBank = () => { setBankForm(emptyBank); setEditingBankId(null); setBankDialogOpen(true); };
  const openEditBank = (a: BankAccount) => { const { id, ...rest } = a; setBankForm(rest); setEditingBankId(id); setBankDialogOpen(true); };
  const saveBank = () => {
    if (!bankForm.nombre.trim()) { toast({ title: 'Nombre requerido', variant: 'destructive' }); return; }
    if (editingBankId) updateBank.mutate({ ...bankForm, id: editingBankId });
    else addBank.mutate(bankForm);
    setBankDialogOpen(false);
  };

  // Equity CRUD
  const openCreateEquity = (tipo?: EquityType) => { setEquityForm({ ...emptyEquity, tipo: tipo ?? 'aportacion_socios' }); setEditingEquityId(null); setEquityDialogOpen(true); };
  const openEditEquity = (e: EquityEntry) => { const { id, ...rest } = e; setEquityForm(rest); setEditingEquityId(id); setEquityDialogOpen(true); };
  const saveEquity = () => {
    if (!equityForm.concepto.trim()) { toast({ title: 'Concepto requerido', variant: 'destructive' }); return; }
    if (editingEquityId) updateEquity.mutate({ ...equityForm, id: editingEquityId });
    else addEquity.mutate(equityForm);
    setEquityDialogOpen(false);
  };

  if (loadingBanks || loadingEquity) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="animate-spin text-primary" size={32} />
        <span className="ml-3 text-muted-foreground">Cargando...</span>
      </div>
    );
  }

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title flex items-center gap-2"><Landmark size={22} className="text-primary" /> Balance General</h1>
          <p className="page-subtitle">Cuentas bancarias, capital contable y posición financiera</p>
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        {[
          { label: 'Saldo en Bancos', value: fmt(totalBankBalance), icon: Banknote, color: 'primary' },
          { label: 'Aportación Socios', value: fmt(aportaciones), icon: Users2, color: 'accent' },
          { label: `Utilidad ${currentYear} (calc.)`, value: fmt(calculatedProfit), icon: TrendingUp, color: calculatedProfit >= 0 ? 'success' : 'destructive' },
          { label: 'Capital Contable', value: fmt(totalCapital), icon: Landmark, color: 'primary' },
        ].map(k => (
          <div key={k.label} className={`bg-card rounded-xl border p-4 border-l-4 border-l-${k.color}`}>
            <div className="flex items-center gap-2 text-xs text-muted-foreground mb-1"><k.icon size={14} />{k.label}</div>
            <div className="text-lg font-bold">{k.value}</div>
          </div>
        ))}
      </div>

      <Tabs defaultValue="bancos" className="space-y-4">
        <TabsList>
          <TabsTrigger value="bancos">Cuentas Bancarias</TabsTrigger>
          <TabsTrigger value="capital">Capital Contable</TabsTrigger>
        </TabsList>

        {/* BANK ACCOUNTS TAB */}
        <TabsContent value="bancos">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-sm font-semibold">Cuentas Bancarias ({bankAccounts.length})</h2>
            <Button onClick={openCreateBank} size="sm"><Plus size={16} className="mr-1" /> Nueva Cuenta</Button>
          </div>
          <div className="bg-card rounded-xl border overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nombre</TableHead>
                  <TableHead>Banco</TableHead>
                  <TableHead>No. Cuenta</TableHead>
                  <TableHead>CLABE</TableHead>
                  <TableHead>Moneda</TableHead>
                  <TableHead className="text-right">Saldo</TableHead>
                  <TableHead>Estatus</TableHead>
                  <TableHead></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {bankAccounts.map(a => (
                  <TableRow key={a.id} className={!a.activa ? 'opacity-50' : ''}>
                    <TableCell className="font-medium text-xs">{a.nombre}</TableCell>
                    <TableCell className="text-xs">{a.banco}</TableCell>
                    <TableCell className="text-xs font-mono">{a.numero_cuenta}</TableCell>
                    <TableCell className="text-xs font-mono">{a.clabe}</TableCell>
                    <TableCell className="text-xs">{a.moneda}</TableCell>
                    <TableCell className="text-xs text-right font-semibold">{fmt(a.saldo)}</TableCell>
                    <TableCell><Badge variant={a.activa ? 'default' : 'secondary'} className="text-[10px]">{a.activa ? 'Activa' : 'Inactiva'}</Badge></TableCell>
                    <TableCell>
                      <div className="flex gap-1">
                        <Button variant="ghost" size="sm" onClick={() => openEditBank(a)}><Edit2 size={14} /></Button>
                        <Button variant="ghost" size="sm" onClick={() => deleteBank.mutate(a.id)}><Trash2 size={14} className="text-destructive" /></Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
                {bankAccounts.length === 0 && (
                  <TableRow><TableCell colSpan={8} className="text-center text-muted-foreground py-8">Sin cuentas bancarias registradas</TableCell></TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </TabsContent>

        {/* CAPITAL CONTABLE TAB */}
        <TabsContent value="capital">
          <div className="space-y-6">
            {/* Utilidad del ejercicio calculada */}
            <div className="bg-card rounded-xl border p-5">
              <h3 className="text-sm font-semibold mb-3 flex items-center gap-2"><TrendingUp size={16} className="text-primary" /> Utilidad del Ejercicio {currentYear} (Cálculo Automático)</h3>
              <p className="text-2xl font-bold">{fmt(calculatedProfit)}</p>
              <p className="text-xs text-muted-foreground mt-1">Calculada de ventas reales menos costos y gastos operativos registrados</p>
            </div>

            {/* Sections */}
            {(['aportacion_socios', 'utilidad_ejercicio', 'utilidades_acumuladas'] as EquityType[]).map(tipo => {
              const entries = equityEntries.filter(e => e.tipo === tipo);
              const total = entries.reduce((s, e) => s + e.monto, 0);
              return (
                <div key={tipo} className="bg-card rounded-xl border p-5">
                  <div className="flex justify-between items-center mb-3">
                    <h3 className="text-sm font-semibold">{EQUITY_TYPE_LABELS[tipo]} ({fmt(total)})</h3>
                    <Button variant="outline" size="sm" onClick={() => openCreateEquity(tipo)}><Plus size={14} className="mr-1" /> Agregar</Button>
                  </div>
                  {entries.length === 0 ? (
                    <p className="text-xs text-muted-foreground">Sin registros</p>
                  ) : (
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Concepto</TableHead>
                          <TableHead>Fecha inicio</TableHead>
                          <TableHead>Fecha fin</TableHead>
                          <TableHead className="text-right">Monto</TableHead>
                          <TableHead>Notas</TableHead>
                          <TableHead></TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {entries.map(e => (
                          <TableRow key={e.id}>
                            <TableCell className="text-xs font-medium">{e.concepto}</TableCell>
                            <TableCell className="text-xs">{e.fecha_inicio}</TableCell>
                            <TableCell className="text-xs">{e.fecha_fin || '—'}</TableCell>
                            <TableCell className="text-xs text-right font-semibold">{fmt(e.monto)}</TableCell>
                            <TableCell className="text-xs text-muted-foreground max-w-[150px] truncate">{e.notas}</TableCell>
                            <TableCell>
                              <div className="flex gap-1">
                                <Button variant="ghost" size="sm" onClick={() => openEditEquity(e)}><Edit2 size={14} /></Button>
                                <Button variant="ghost" size="sm" onClick={() => deleteEquity.mutate(e.id)}><Trash2 size={14} className="text-destructive" /></Button>
                              </div>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  )}
                </div>
              );
            })}

            {/* Resumen Capital Contable */}
            <div className="bg-card rounded-xl border p-5">
              <h3 className="text-sm font-semibold mb-3">Resumen Capital Contable</h3>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between"><span>Aportación de Socios</span><span className="font-semibold">{fmt(aportaciones)}</span></div>
                <div className="flex justify-between"><span>Utilidades Acumuladas</span><span className="font-semibold">{fmt(utilidadesAcum)}</span></div>
                <div className="flex justify-between"><span>Utilidad del Ejercicio (automática)</span><span className="font-semibold">{fmt(calculatedProfit)}</span></div>
                {utilidadManual !== 0 && <div className="flex justify-between"><span>Ajuste Manual Utilidad</span><span className="font-semibold">{fmt(utilidadManual)}</span></div>}
                <div className="border-t pt-2 flex justify-between font-bold text-base">
                  <span>Total Capital Contable</span><span>{fmt(totalCapital)}</span>
                </div>
              </div>
            </div>
          </div>
        </TabsContent>
      </Tabs>

      {/* Bank Dialog */}
      <Dialog open={bankDialogOpen} onOpenChange={setBankDialogOpen}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>{editingBankId ? 'Editar Cuenta' : 'Nueva Cuenta Bancaria'}</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div><Label>Nombre de la cuenta *</Label><Input value={bankForm.nombre} onChange={e => setBankForm({ ...bankForm, nombre: e.target.value })} placeholder="Ej. Cuenta principal" /></div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label>Banco</Label><Input value={bankForm.banco} onChange={e => setBankForm({ ...bankForm, banco: e.target.value })} placeholder="Ej. BBVA" /></div>
              <div><Label>Moneda</Label>
                <Select value={bankForm.moneda} onValueChange={v => setBankForm({ ...bankForm, moneda: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent><SelectItem value="MXN">MXN</SelectItem><SelectItem value="USD">USD</SelectItem></SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label>No. Cuenta</Label><Input value={bankForm.numero_cuenta} onChange={e => setBankForm({ ...bankForm, numero_cuenta: e.target.value })} /></div>
              <div><Label>CLABE</Label><Input value={bankForm.clabe} onChange={e => setBankForm({ ...bankForm, clabe: e.target.value })} /></div>
            </div>
            <div><Label>Saldo actual</Label><Input type="number" min={0} value={bankForm.saldo} onChange={e => setBankForm({ ...bankForm, saldo: Number(e.target.value) })} /></div>
            <div><Label>Notas</Label><Textarea value={bankForm.notas} onChange={e => setBankForm({ ...bankForm, notas: e.target.value })} rows={2} /></div>
            <Button onClick={saveBank} className="w-full" disabled={addBank.isPending || updateBank.isPending}>
              {(addBank.isPending || updateBank.isPending) && <Loader2 size={16} className="mr-2 animate-spin" />}
              {editingBankId ? 'Guardar cambios' : 'Registrar cuenta'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Equity Dialog */}
      <Dialog open={equityDialogOpen} onOpenChange={setEquityDialogOpen}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>{editingEquityId ? 'Editar Registro' : 'Nuevo Registro de Capital'}</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div><Label>Tipo</Label>
              <Select value={equityForm.tipo} onValueChange={v => setEquityForm({ ...equityForm, tipo: v as EquityType })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {Object.entries(EQUITY_TYPE_LABELS).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div><Label>Concepto *</Label><Input value={equityForm.concepto} onChange={e => setEquityForm({ ...equityForm, concepto: e.target.value })} placeholder="Ej. Aportación inicial" /></div>
            <div><Label>Monto</Label><Input type="number" value={equityForm.monto} onChange={e => setEquityForm({ ...equityForm, monto: Number(e.target.value) })} /></div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label>Fecha inicio</Label><Input type="date" value={equityForm.fecha_inicio} onChange={e => setEquityForm({ ...equityForm, fecha_inicio: e.target.value })} /></div>
              <div><Label>Fecha fin</Label><Input type="date" value={equityForm.fecha_fin ?? ''} onChange={e => setEquityForm({ ...equityForm, fecha_fin: e.target.value || null })} /></div>
            </div>
            <div><Label>Notas</Label><Textarea value={equityForm.notas} onChange={e => setEquityForm({ ...equityForm, notas: e.target.value })} rows={2} /></div>
            <Button onClick={saveEquity} className="w-full" disabled={addEquity.isPending || updateEquity.isPending}>
              {(addEquity.isPending || updateEquity.isPending) && <Loader2 size={16} className="mr-2 animate-spin" />}
              {editingEquityId ? 'Guardar cambios' : 'Registrar'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
