import { useState, useMemo } from 'react';
import { useAccountsPayable, useAddPayable, useRegisterPayablePayment, useDeletePayable, DBAccountPayable } from '@/hooks/useAccountsPayable';
import MetricCard from '@/components/shared/MetricCard';
import StatusBadge from '@/components/shared/StatusBadge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { CreditCard, AlertTriangle, Clock, CheckCircle, Plus, DollarSign, Trash2, Search, FileText } from 'lucide-react';
import { toast } from 'sonner';
import { differenceInDays, format, parseISO } from 'date-fns';
import { es } from 'date-fns/locale';

const fmt = (n: number, cur = 'MXN') =>
  new Intl.NumberFormat('es-MX', { style: 'currency', currency: cur, maximumFractionDigits: 0 }).format(n);

const STATUS_LABELS: Record<string, string> = {
  pendiente: 'Pendiente',
  por_vencer: 'Por vencer',
  vencida: 'Vencida',
  pago_parcial: 'Pago parcial',
  liquidada: 'Liquidada',
  cancelada: 'Cancelada',
};

const PAYMENT_METHODS = [
  { value: 'transferencia', label: 'Transferencia' },
  { value: 'cheque', label: 'Cheque' },
  { value: 'efectivo', label: 'Efectivo' },
  { value: 'tarjeta', label: 'Tarjeta' },
  { value: 'compensacion', label: 'Compensación' },
  { value: 'otro', label: 'Otro' },
];

function computeStatus(row: DBAccountPayable): DBAccountPayable['status'] {
  if (row.status === 'liquidada' || row.status === 'cancelada') return row.status;
  if (row.paid > 0 && row.balance > 0) return 'pago_parcial';
  const daysUntilDue = differenceInDays(parseISO(row.due_date), new Date());
  if (daysUntilDue < 0) return 'vencida';
  if (daysUntilDue <= 7) return 'por_vencer';
  return 'pendiente';
}

export default function AccountsPayablePage() {
  const { data: payables = [], isLoading } = useAccountsPayable();
  const addPayable = useAddPayable();
  const registerPayment = useRegisterPayablePayment();
  const deletePayable = useDeletePayable();

  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [showAdd, setShowAdd] = useState(false);
  const [showPayment, setShowPayment] = useState<string | null>(null);

  // Form state for new invoice
  const [form, setForm] = useState({
    supplier_name: '', invoice_number: '', description: '',
    invoice_date: format(new Date(), 'yyyy-MM-dd'),
    due_date: format(new Date(Date.now() + 30 * 86400000), 'yyyy-MM-dd'),
    total: '', currency: 'MXN', notes: '',
  });

  // Payment form
  const [payAmount, setPayAmount] = useState('');
  const [payMethod, setPayMethod] = useState('transferencia');

  const enriched = useMemo(() =>
    payables.map(p => ({ ...p, computedStatus: computeStatus(p) })),
    [payables]
  );

  const filtered = useMemo(() => {
    return enriched.filter(p => {
      if (search) {
        const s = search.toLowerCase();
        if (!p.supplier_name.toLowerCase().includes(s) && !p.invoice_number.toLowerCase().includes(s) && !p.description.toLowerCase().includes(s)) return false;
      }
      if (statusFilter && p.computedStatus !== statusFilter) return false;
      return true;
    });
  }, [enriched, search, statusFilter]);

  const totalDebt = filtered.reduce((s, p) => s + p.balance, 0);
  const overdue = filtered.filter(p => p.computedStatus === 'vencida');
  const overdueAmount = overdue.reduce((s, p) => s + p.balance, 0);
  const dueSoon = filtered.filter(p => p.computedStatus === 'por_vencer');
  const dueSoonAmount = dueSoon.reduce((s, p) => s + p.balance, 0);
  const paidTotal = filtered.filter(p => p.computedStatus === 'liquidada').length;

  const handleAddSubmit = () => {
    const total = parseFloat(form.total);
    if (!form.supplier_name || !total || total <= 0) {
      toast.error('Proveedor y monto son obligatorios');
      return;
    }
    addPayable.mutate({
      supplier_name: form.supplier_name,
      invoice_number: form.invoice_number,
      description: form.description,
      invoice_date: form.invoice_date,
      due_date: form.due_date,
      total,
      paid: 0,
      balance: total,
      currency: form.currency,
      status: 'pendiente',
      payment_method: null,
      import_order_id: null,
      purchase_order_id: null,
      notes: form.notes || null,
    }, {
      onSuccess: () => {
        setShowAdd(false);
        setForm({ supplier_name: '', invoice_number: '', description: '', invoice_date: format(new Date(), 'yyyy-MM-dd'), due_date: format(new Date(Date.now() + 30 * 86400000), 'yyyy-MM-dd'), total: '', currency: 'MXN', notes: '' });
      },
    });
  };

  const handlePaymentSubmit = () => {
    const amount = parseFloat(payAmount);
    if (!showPayment || !amount || amount <= 0) {
      toast.error('Ingresa un monto válido');
      return;
    }
    registerPayment.mutate({ id: showPayment, amount, method: payMethod }, {
      onSuccess: () => {
        setShowPayment(null);
        setPayAmount('');
        setPayMethod('transferencia');
      },
    });
  };

  const daysOverdue = (dueDate: string) => {
    const diff = differenceInDays(new Date(), parseISO(dueDate));
    return diff > 0 ? diff : 0;
  };

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">Cuentas por Pagar</h1>
          <p className="page-subtitle">Control de facturas de proveedores y vencimientos</p>
        </div>
        <Button onClick={() => setShowAdd(true)} className="gap-2">
          <Plus size={16} /> Nueva Factura
        </Button>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <MetricCard title="Total por pagar" value={fmt(totalDebt)} icon={CreditCard} />
        <MetricCard title="Vencidas" value={fmt(overdueAmount)} subtitle={`${overdue.length} facturas`} icon={AlertTriangle} />
        <MetricCard title="Por vencer (7d)" value={fmt(dueSoonAmount)} subtitle={`${dueSoon.length} facturas`} icon={Clock} />
        <MetricCard title="Liquidadas" value={`${paidTotal}`} icon={CheckCircle} />
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3 mb-4">
        <div className="relative flex-1 min-w-[200px]">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input placeholder="Buscar proveedor, factura..." value={search} onChange={e => setSearch(e.target.value)} className="pl-9" />
        </div>
        <Select value={statusFilter} onValueChange={v => setStatusFilter(v === 'all' ? '' : v)}>
          <SelectTrigger className="w-[180px]"><SelectValue placeholder="Estatus" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos</SelectItem>
            {Object.entries(STATUS_LABELS).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      {/* Table */}
      <div className="bg-card rounded-xl border overflow-x-auto">
        {isLoading ? (
          <div className="p-8 text-center text-muted-foreground">Cargando...</div>
        ) : filtered.length === 0 ? (
          <div className="p-8 text-center text-muted-foreground">
            <FileText size={32} className="mx-auto mb-2 opacity-40" />
            <p>No hay facturas registradas</p>
            <Button variant="outline" size="sm" className="mt-3" onClick={() => setShowAdd(true)}>Registrar primera factura</Button>
          </div>
        ) : (
          <table className="data-table">
            <thead>
              <tr>
                <th>Proveedor</th>
                <th>Factura</th>
                <th>Descripción</th>
                <th>Fecha</th>
                <th>Vencimiento</th>
                <th>Días venc.</th>
                <th>Total</th>
                <th>Pagado</th>
                <th>Saldo</th>
                <th>Estatus</th>
                <th>Acciones</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(p => (
                <tr key={p.id}>
                  <td className="text-xs font-medium">{p.supplier_name}</td>
                  <td className="text-xs font-mono">{p.invoice_number || '—'}</td>
                  <td className="text-xs max-w-[200px] truncate">{p.description || '—'}</td>
                  <td className="text-xs">{format(parseISO(p.invoice_date), 'dd MMM yy', { locale: es })}</td>
                  <td className="text-xs">{format(parseISO(p.due_date), 'dd MMM yy', { locale: es })}</td>
                  <td className="text-xs text-center">
                    {p.computedStatus === 'vencida' ? (
                      <span className="text-destructive font-bold">{daysOverdue(p.due_date)}d</span>
                    ) : p.computedStatus === 'liquidada' ? '—' : (
                      <span className="text-muted-foreground">{differenceInDays(parseISO(p.due_date), new Date())}d</span>
                    )}
                  </td>
                  <td className="text-xs font-bold">{fmt(p.total, p.currency)}</td>
                  <td className="text-xs text-primary">{fmt(p.paid, p.currency)}</td>
                  <td className="text-xs font-bold">{fmt(p.balance, p.currency)}</td>
                  <td>
                    <StatusBadge
                      status={p.computedStatus === 'vencida' ? 'vencido' : p.computedStatus === 'por_vencer' ? 'por_vencer' : p.computedStatus === 'liquidada' ? 'liquidado' : p.computedStatus === 'pago_parcial' ? 'pago_parcial' : p.computedStatus === 'cancelada' ? 'cancelado' : 'al_corriente'}
                    />
                  </td>
                  <td>
                    <div className="flex gap-1">
                      {p.computedStatus !== 'liquidada' && p.computedStatus !== 'cancelada' && (
                        <Button variant="outline" size="sm" className="gap-1 text-xs" onClick={() => { setShowPayment(p.id); setPayAmount(String(p.balance)); }}>
                          <DollarSign size={12} /> Pagar
                        </Button>
                      )}
                      <Button variant="ghost" size="sm" className="text-destructive" onClick={() => {
                        if (confirm('¿Eliminar esta factura?')) deletePayable.mutate(p.id);
                      }}>
                        <Trash2 size={14} />
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Add Invoice Dialog */}
      <Dialog open={showAdd} onOpenChange={setShowAdd}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Registrar Factura de Proveedor</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Proveedor *</Label>
                <Input value={form.supplier_name} onChange={e => setForm(f => ({ ...f, supplier_name: e.target.value }))} placeholder="Nombre del proveedor" />
              </div>
              <div>
                <Label>No. Factura</Label>
                <Input value={form.invoice_number} onChange={e => setForm(f => ({ ...f, invoice_number: e.target.value }))} placeholder="FAC-001" />
              </div>
            </div>
            <div>
              <Label>Descripción</Label>
              <Input value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} placeholder="Concepto de la factura" />
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div>
                <Label>Fecha factura</Label>
                <Input type="date" value={form.invoice_date} onChange={e => setForm(f => ({ ...f, invoice_date: e.target.value }))} />
              </div>
              <div>
                <Label>Vencimiento</Label>
                <Input type="date" value={form.due_date} onChange={e => setForm(f => ({ ...f, due_date: e.target.value }))} />
              </div>
              <div>
                <Label>Moneda</Label>
                <Select value={form.currency} onValueChange={v => setForm(f => ({ ...f, currency: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="MXN">MXN</SelectItem>
                    <SelectItem value="USD">USD</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div>
              <Label>Monto total *</Label>
              <Input type="number" value={form.total} onChange={e => setForm(f => ({ ...f, total: e.target.value }))} placeholder="0.00" />
            </div>
            <div>
              <Label>Notas</Label>
              <Textarea value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} rows={2} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAdd(false)}>Cancelar</Button>
            <Button onClick={handleAddSubmit} disabled={addPayable.isPending}>
              {addPayable.isPending ? 'Guardando...' : 'Registrar Factura'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Payment Dialog */}
      <Dialog open={!!showPayment} onOpenChange={() => setShowPayment(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Registrar Pago</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4">
            <div>
              <Label>Monto a pagar</Label>
              <Input type="number" value={payAmount} onChange={e => setPayAmount(e.target.value)} />
            </div>
            <div>
              <Label>Método de pago</Label>
              <Select value={payMethod} onValueChange={setPayMethod}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {PAYMENT_METHODS.map(m => <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowPayment(null)}>Cancelar</Button>
            <Button onClick={handlePaymentSubmit} disabled={registerPayment.isPending}>
              {registerPayment.isPending ? 'Procesando...' : 'Confirmar Pago'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
