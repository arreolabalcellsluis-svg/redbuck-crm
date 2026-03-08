import { demoCustomers, demoProducts, demoUsers } from '@/data/demo-data';
import { useAppContext } from '@/contexts/AppContext';
import StatusBadge from '@/components/shared/StatusBadge';
import MetricCard from '@/components/shared/MetricCard';
import { ShoppingCart, PackageCheck, Truck, Clock, Plus, Search, X, Edit2, DollarSign, FileSpreadsheet, History, ChevronsUpDown, Check, CalendarClock, Package, FileText } from 'lucide-react';
import { useState, useMemo } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Command, CommandInput, CommandList, CommandEmpty, CommandGroup, CommandItem } from '@/components/ui/command';
import { cn } from '@/lib/utils';
import { Order, OrderStatus, OrderType, AccountReceivable } from '@/types';
import { Payment, PaymentStatus } from '@/types/payments';
import { addAuditLog } from '@/lib/auditLog';
import { toast } from 'sonner';
import * as XLSX from 'xlsx';
import { useAuthorization } from '@/hooks/useAuthorization';
import AuthorizationDialog from '@/components/shared/AuthorizationDialog';
import InvoiceCreateDialog from '@/components/invoicing/InvoiceCreateDialog';

const fmt = (n: number) => new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN', maximumFractionDigits: 0 }).format(n);
const vendors = demoUsers.filter(u => u.role === 'vendedor');
const ORDER_STATUSES: { value: OrderStatus; label: string }[] = [
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

export default function OrdersPage() {
  const { currentRole, orders, setOrders, receivables, setReceivables, payments, setPayments, getOrderPayments, getTotalPaid, registerPayment } = useAppContext();
  const isAdmin = currentRole === 'director';
  const { authRequest, requestAuthorization, closeAuth } = useAuthorization();
  const navigate = useNavigate();
  const [search, setSearch] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ customerId: '', vendorName: '', warehouse: 'Bodega Principal', promiseDate: '', advance: 0 });
  const [items, setItems] = useState<{ productId: string; productName: string; qty: number; unitPrice: number }[]>([]);

  // Edit folio
  const [editFolioOrder, setEditFolioOrder] = useState<Order | null>(null);
  const [newFolio, setNewFolio] = useState('');

  // Payments dialog
  const [paymentOrder, setPaymentOrder] = useState<Order | null>(null);
  const [payForm, setPayForm] = useState({ date: '', amount: 0, method: 'transferencia' as Payment['method'], reference: '', comment: '' });

  // Order detail / account statement
  const [detailOrder, setDetailOrder] = useState<Order | null>(null);

  // Customer history
  const [historyCustomerId, setHistoryCustomerId] = useState<string | null>(null);
  const [historyDateFrom, setHistoryDateFrom] = useState('');
  const [historyDateTo, setHistoryDateTo] = useState('');

  const filtered = orders.filter(o => {
    const q = search.toLowerCase();
    if (q && !o.customerName.toLowerCase().includes(q) && !o.folio.toLowerCase().includes(q)) return false;
    if (filterStatus && o.status !== filterStatus) return false;
    return true;
  });

  const getPaymentStatusLocal = (order: Order): PaymentStatus => {
    const paid = getTotalPaid(order.id);
    if (paid >= order.total) return 'liquidado';
    if (paid > 0 && paid < order.total * 0.5) return 'anticipo_recibido';
    if (paid > 0) return 'pago_parcial';
    return 'sin_pago';
  };

  const handleStatusChange = (orderId: string, newStatus: OrderStatus) => {
    const order = orders.find(o => o.id === orderId);
    if (!order) return;
    const oldStatus = order.status;
    setOrders(prev => prev.map(o => o.id === orderId ? { ...o, status: newStatus } : o));
    addAuditLog({ action: 'Cambio de estatus de pedido', module: 'Pedidos', userId: '', userName: 'Usuario actual', userRole: currentRole, entityId: order.id, previousValue: oldStatus, newValue: newStatus, comment: `Pedido ${order.folio}: ${oldStatus} → ${newStatus}` });
    toast.success(`Estatus actualizado a "${ORDER_STATUSES.find(s => s.value === newStatus)?.label}"`);
  };

  const addItem = () => setItems([...items, { productId: '', productName: '', qty: 1, unitPrice: 0 }]);
  const removeItem = (i: number) => setItems(items.filter((_, idx) => idx !== i));
  const updateItem = (i: number, field: string, value: any) => {
    const updated = [...items];
    if (field === 'productId') {
      const prod = demoProducts.find(p => p.id === value);
      if (prod) updated[i] = { ...updated[i], productId: value, productName: prod.name, unitPrice: prod.listPrice };
    } else {
      (updated[i] as any)[field] = value;
    }
    setItems(updated);
  };

  const subtotal = items.reduce((s, it) => s + it.qty * it.unitPrice, 0);
  const tax = subtotal * 0.16;
  const total = subtotal + tax;

  const handleCreate = () => {
    const customer = demoCustomers.find(c => c.id === form.customerId);
    if (!customer || items.length === 0 || !form.promiseDate) {
      toast.error('Completa cliente, productos y fecha promesa');
      return;
    }
    const folio = `PED-2026-${String(orders.length + 1).padStart(3, '0')}`;
    const newOrder: Order = {
      id: `or-${Date.now()}`,
      folio,
      customerId: customer.id,
      customerName: customer.name,
      vendorName: form.vendorName,
      items: items.map(it => ({ productName: it.productName, qty: it.qty, unitPrice: it.unitPrice })),
      total,
      advance: form.advance,
      balance: total - form.advance,
      status: 'nuevo',
      warehouse: form.warehouse,
      promiseDate: form.promiseDate,
      createdAt: new Date().toISOString().slice(0, 10),
    };
    setOrders(prev => [newOrder, ...prev]);

    // Auto-create receivable
    const newReceivable: AccountReceivable = {
      id: `ar-${Date.now()}`,
      customerId: customer.id,
      customerName: customer.name,
      orderId: newOrder.id,
      orderFolio: folio,
      total,
      paid: form.advance,
      balance: total - form.advance,
      dueDate: form.promiseDate,
      daysOverdue: 0,
      status: form.advance >= total ? 'liquidado' : form.advance > 0 ? 'al_corriente' : 'al_corriente',
    };
    setReceivables(prev => [newReceivable, ...prev]);

    addAuditLog({ userId: 'current', userName: 'Usuario actual', module: 'pedidos', action: 'crear_pedido', entityId: newOrder.id, newValue: folio, comment: `Pedido creado para ${customer.name}` });

    setOpen(false);
    setForm({ customerId: '', vendorName: '', warehouse: 'Bodega Principal', promiseDate: '', advance: 0 });
    setItems([]);
    toast.success(`Pedido ${folio} creado y registrado en cobranza`);
  };

  // Edit folio
  const handleEditFolio = () => {
    if (!editFolioOrder || !newFolio.trim()) return;
    if (orders.some(o => o.folio === newFolio.trim() && o.id !== editFolioOrder.id)) {
      toast.error('Ya existe un pedido con ese folio');
      return;
    }
    const oldFolio = editFolioOrder.folio;
    setOrders(prev => prev.map(o => o.id === editFolioOrder.id ? { ...o, folio: newFolio.trim() } : o));
    setReceivables(prev => prev.map(r => r.orderId === editFolioOrder.id ? { ...r, orderFolio: newFolio.trim() } : r));
    addAuditLog({ userId: 'current', userName: 'Usuario actual', module: 'pedidos', action: 'editar_folio', entityId: editFolioOrder.id, previousValue: oldFolio, newValue: newFolio.trim() });
    toast.success(`Folio cambiado de ${oldFolio} a ${newFolio.trim()}`);
    setEditFolioOrder(null);
  };

  // Register payment
  const handleRegisterPayment = () => {
    if (!paymentOrder || !payForm.date || payForm.amount <= 0) {
      toast.error('Completa fecha y monto del pago');
      return;
    }
    requestAuthorization('modify_payment', 'pedidos', () => {
      registerPayment(paymentOrder.id, {
        orderId: paymentOrder.id,
        date: payForm.date,
        amount: payForm.amount,
        method: payForm.method,
        reference: payForm.reference,
        comment: payForm.comment,
        registeredBy: 'Usuario actual',
      });
      toast.success(`Pago de ${fmt(payForm.amount)} registrado`);
      setPayForm({ date: '', amount: 0, method: 'transferencia', reference: '', comment: '' });
      setPaymentOrder(null);
    }, {
      entityId: paymentOrder.id,
      entityLabel: `${paymentOrder.folio} — ${fmt(payForm.amount)}`,
    });
  };

  // Customer history
  const customerOrders = historyCustomerId ? orders.filter(o => o.customerId === historyCustomerId) : [];
  const customerReceivables = historyCustomerId ? receivables.filter(r => r.customerId === historyCustomerId) : [];
  const customerPayments = historyCustomerId ? payments.filter(p => customerOrders.some(o => o.id === p.orderId)) : [];
  const customerName = historyCustomerId ? (demoCustomers.find(c => c.id === historyCustomerId)?.name || '') : '';
  const totalComprado = customerOrders.reduce((s, o) => s + o.total, 0);
  const totalPagado = customerOrders.reduce((s, o) => s + getTotalPaid(o.id), 0);
  const saldoPendiente = totalComprado - totalPagado;

  const handleDownloadStatement = () => {
    if (!historyCustomerId) return;
    const movements = customerOrders.map(o => {
      const orderPayments = payments.filter(p => p.orderId === o.id);
      const totalPaidOrder = o.advance + orderPayments.reduce((s, p) => s + p.amount, 0);
      return {
        Cliente: customerName,
        Fecha: o.createdAt,
        Folio: o.folio,
        Tipo: 'Pedido',
        'Importe Pedido': o.total,
        'Pagos Realizados': totalPaidOrder,
        'Saldo Pendiente': o.total - totalPaidOrder,
        Estatus: totalPaidOrder >= o.total ? 'Liquidado' : totalPaidOrder > 0 ? 'Pago parcial' : 'Sin pago',
      };
    }).filter(m => {
      if (historyDateFrom && m.Fecha < historyDateFrom) return false;
      if (historyDateTo && m.Fecha > historyDateTo) return false;
      return true;
    });

    const summary = [
      { Concepto: 'Total comprado', Importe: totalComprado },
      { Concepto: 'Total pagado', Importe: totalPagado },
      { Concepto: 'Saldo pendiente', Importe: saldoPendiente },
    ];

    const wb = XLSX.utils.book_new();
    const ws1 = XLSX.utils.json_to_sheet(movements);
    XLSX.utils.book_append_sheet(wb, ws1, 'Movimientos');
    const ws2 = XLSX.utils.json_to_sheet(summary);
    XLSX.utils.book_append_sheet(wb, ws2, 'Resumen');
    XLSX.writeFile(wb, `Estado_Cuenta_${customerName.replace(/\s+/g, '_')}.xlsx`);

    addAuditLog({ userId: 'current', userName: 'Usuario actual', module: 'pedidos', action: 'descargar_estado_cuenta', entityId: historyCustomerId, comment: `Excel descargado para ${customerName}` });
    toast.success('Estado de cuenta descargado');
  };

  return (
    <div>
      <div className="page-header flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="page-title">Pedidos</h1>
          <p className="page-subtitle">Control de pedidos y entregas</p>
        </div>
        <button onClick={() => setOpen(true)} className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:opacity-90 transition-opacity">
          <Plus size={16} /> Nuevo pedido
        </button>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4 mb-6">
        <MetricCard title="Total pedidos" value={orders.length} icon={ShoppingCart} />
        <MetricCard title="Entregados" value={orders.filter(o => o.status === 'entregado').length} icon={PackageCheck} variant="success" />
        <MetricCard title="En entrega" value={orders.filter(o => o.status === 'en_entrega').length} icon={Truck} variant="warning" />
        <MetricCard title="En reparto" value={orders.filter(o => o.status === 'en_reparto').length} icon={Package} variant="warning" />
        <MetricCard title="Entrega programada" value={orders.filter(o => o.status === 'entrega_programada').length} icon={CalendarClock} variant="primary" />
        <MetricCard title="Valor total" value={fmt(orders.reduce((s, o) => s + o.total, 0))} icon={ShoppingCart} variant="primary" />
      </div>

      <div className="flex items-center gap-3 mb-4 flex-wrap">
        <div className="relative flex-1 max-w-sm">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Buscar pedido..." className="w-full pl-9 pr-3 py-2 rounded-lg border bg-card text-sm outline-none focus:ring-2 focus:ring-primary/20" />
        </div>
        <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)} className="px-3 py-2 rounded-lg border bg-card text-sm outline-none focus:ring-2 focus:ring-primary/20">
          <option value="">Todos los estatus</option>
          {ORDER_STATUSES.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
        </select>
        {(search || filterStatus) && (
          <button onClick={() => { setSearch(''); setFilterStatus(''); }} className="text-xs text-muted-foreground hover:text-foreground px-2 py-1 rounded hover:bg-muted transition-colors">
            Limpiar filtros
          </button>
        )}
      </div>

      <div className="bg-card rounded-xl border overflow-x-auto">
        <table className="data-table">
          <thead>
            <tr><th>Folio</th><th>Cliente</th><th>Vendedor</th><th>Total</th><th>Pagado</th><th>Saldo</th><th>Estatus</th><th>Cobro</th><th>Bodega</th><th>Promesa</th><th></th></tr>
          </thead>
          <tbody>
            {filtered.map(o => {
              const paid = getTotalPaid(o.id);
              const balance = o.total - paid;
              const payStatus = getPaymentStatusLocal(o);
              return (
                <tr key={o.id}>
                  <td>
                    <button onClick={() => setDetailOrder(o)} className="font-mono text-xs font-semibold text-primary hover:underline cursor-pointer">{o.folio}</button>
                  </td>
                  <td>
                    <button onClick={() => { setHistoryCustomerId(o.customerId); setHistoryDateFrom(''); setHistoryDateTo(''); }} className="font-medium text-primary hover:underline cursor-pointer">{o.customerName}</button>
                  </td>
                  <td className="text-muted-foreground">{o.vendorName}</td>
                  <td className="font-semibold">{fmt(o.total)}</td>
                  <td className="text-success">{fmt(paid)}</td>
                  <td className={balance > 0 ? 'text-destructive font-medium' : 'text-success'}>{fmt(Math.max(0, balance))}</td>
                  <td>
                    <select value={o.status} onChange={e => handleStatusChange(o.id, e.target.value as OrderStatus)} className="text-xs font-medium px-2 py-1 rounded-lg border bg-background cursor-pointer focus:ring-2 focus:ring-primary/20 outline-none">
                      {ORDER_STATUSES.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
                    </select>
                  </td>
                  <td><span className={`text-xs font-medium px-2 py-0.5 rounded-full ${payStatus === 'liquidado' ? 'bg-success/10 text-success' : payStatus === 'sin_pago' ? 'bg-destructive/10 text-destructive' : 'bg-warning/10 text-warning'}`}>{payStatus.replace('_', ' ')}</span></td>
                  <td className="text-xs text-muted-foreground">{o.warehouse}</td>
                  <td className="text-xs text-muted-foreground">{o.promiseDate}</td>
                  <td>
                    <div className="flex items-center gap-1">
                      <button onClick={() => setPaymentOrder(o)} className="p-1.5 rounded-md hover:bg-muted text-success" title="Registrar pago"><DollarSign size={14} /></button>
                      {isAdmin && <button onClick={() => { setEditFolioOrder(o); setNewFolio(o.folio); }} className="p-1.5 rounded-md hover:bg-muted" title="Editar folio"><Edit2 size={14} /></button>}
                      {!['cancelado', 'nuevo'].includes(o.status) && (
                        <button onClick={() => navigate('/facturacion', { state: { invoiceOrderId: o.id, invoiceOrderFolio: o.folio } })} className="p-1.5 rounded-md hover:bg-muted text-primary" title="Facturar pedido"><FileText size={14} /></button>
                      )}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* CREATE ORDER */}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Nuevo Pedido</DialogTitle>
            <DialogDescription>Registra un nuevo pedido. Se creará automáticamente su registro en cobranza.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-medium text-muted-foreground">Cliente *</label>
                <select value={form.customerId} onChange={e => setForm({ ...form, customerId: e.target.value })} className="w-full mt-1 px-3 py-2 rounded-lg border bg-background text-sm">
                  <option value="">Seleccionar...</option>
                  {demoCustomers.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </div>
              <div>
                <label className="text-xs font-medium text-muted-foreground">Vendedor</label>
                <select value={form.vendorName} onChange={e => setForm({ ...form, vendorName: e.target.value })} className="w-full mt-1 px-3 py-2 rounded-lg border bg-background text-sm">
                  <option value="">Seleccionar...</option>
                  {vendors.map(v => <option key={v.id} value={v.name}>{v.name}</option>)}
                </select>
              </div>
              <div>
                <label className="text-xs font-medium text-muted-foreground">Bodega</label>
                <select value={form.warehouse} onChange={e => setForm({ ...form, warehouse: e.target.value })} className="w-full mt-1 px-3 py-2 rounded-lg border bg-background text-sm">
                  <option>Bodega Principal</option><option>Bodega Sur</option><option>Bodega CDMX</option>
                </select>
              </div>
              <div>
                <label className="text-xs font-medium text-muted-foreground">Fecha promesa *</label>
                <input type="date" value={form.promiseDate} onChange={e => setForm({ ...form, promiseDate: e.target.value })} className="w-full mt-1 px-3 py-2 rounded-lg border bg-background text-sm" />
              </div>
            </div>
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="text-xs font-medium text-muted-foreground">Productos *</label>
                <button onClick={addItem} className="text-xs text-primary hover:underline">+ Agregar producto</button>
              </div>
              {items.map((it, i) => (
                <div key={i} className="flex items-center gap-2 mb-2">
                  <Popover>
                    <PopoverTrigger asChild>
                      <button type="button" className={cn("flex-1 flex items-center justify-between px-2 py-1.5 rounded border bg-background text-sm text-left", !it.productId && "text-muted-foreground")}>
                        <span className="truncate">{it.productId ? demoProducts.find(p => p.id === it.productId)?.name || 'Producto...' : 'Seleccionar producto...'}</span>
                        <ChevronsUpDown className="ml-1 h-3.5 w-3.5 shrink-0 opacity-50" />
                      </button>
                    </PopoverTrigger>
                    <PopoverContent className="w-[320px] p-0" align="start">
                      <Command>
                        <CommandInput placeholder="Buscar producto..." />
                        <CommandList>
                          <CommandEmpty>No se encontró producto.</CommandEmpty>
                          <CommandGroup>
                            {demoProducts.filter(p => p.active).map(p => (
                              <CommandItem key={p.id} value={p.name} onSelect={() => updateItem(i, 'productId', p.id)}>
                                <Check className={cn("mr-2 h-4 w-4", it.productId === p.id ? "opacity-100" : "opacity-0")} />
                                <div className="flex flex-col">
                                  <span className="text-sm">{p.name}</span>
                                  <span className="text-xs text-muted-foreground">{p.sku} — {fmt(p.listPrice)}</span>
                                </div>
                              </CommandItem>
                            ))}
                          </CommandGroup>
                        </CommandList>
                      </Command>
                    </PopoverContent>
                  </Popover>
                  <input type="number" min={1} value={it.qty} onChange={e => updateItem(i, 'qty', Number(e.target.value))} className="w-16 px-2 py-1.5 rounded border bg-background text-sm text-center" />
                  <input type="number" value={it.unitPrice} onChange={e => updateItem(i, 'unitPrice', Number(e.target.value))} className="w-28 px-2 py-1.5 rounded border bg-background text-sm" />
                  <button onClick={() => removeItem(i)} className="text-muted-foreground hover:text-destructive"><X size={14} /></button>
                </div>
              ))}
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-medium text-muted-foreground">Anticipo</label>
                <input type="number" value={form.advance} onChange={e => setForm({ ...form, advance: Number(e.target.value) })} className="w-full mt-1 px-3 py-2 rounded-lg border bg-background text-sm" />
              </div>
              <div className="text-right space-y-1 pt-4">
                <div className="text-xs text-muted-foreground">Subtotal: {fmt(subtotal)}</div>
                <div className="text-xs text-muted-foreground">IVA 16%: {fmt(tax)}</div>
                <div className="text-sm font-bold">Total: {fmt(total)}</div>
              </div>
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <button onClick={() => setOpen(false)} className="px-4 py-2 rounded-lg border text-sm hover:bg-muted">Cancelar</button>
              <button onClick={handleCreate} className="px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:opacity-90">Crear pedido</button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* EDIT FOLIO */}
      <Dialog open={!!editFolioOrder} onOpenChange={() => setEditFolioOrder(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Editar folio del pedido</DialogTitle>
            <DialogDescription>⚠️ El cambio quedará registrado en auditoría. El folio no puede duplicarse.</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <label className="text-xs font-medium text-muted-foreground">Folio actual</label>
              <div className="font-mono font-bold text-sm mt-1">{editFolioOrder?.folio}</div>
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground">Nuevo folio *</label>
              <input value={newFolio} onChange={e => setNewFolio(e.target.value)} className="w-full mt-1 px-3 py-2 rounded-lg border bg-background text-sm font-mono" />
            </div>
          </div>
          <DialogFooter>
            <button onClick={() => setEditFolioOrder(null)} className="px-4 py-2 rounded-lg border text-sm hover:bg-muted">Cancelar</button>
            <button onClick={handleEditFolio} className="px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:opacity-90">Guardar cambio</button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* REGISTER PAYMENT */}
      <Dialog open={!!paymentOrder} onOpenChange={() => setPaymentOrder(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2"><DollarSign size={20} className="text-success" /> Registrar pago</DialogTitle>
            <DialogDescription>Pedido {paymentOrder?.folio} — Total: {paymentOrder ? fmt(paymentOrder.total) : ''} — Saldo: {paymentOrder ? fmt(Math.max(0, paymentOrder.total - getTotalPaid(paymentOrder.id))) : ''}</DialogDescription>
          </DialogHeader>
          {paymentOrder && (
            <>
              {getOrderPayments(paymentOrder.id).length > 0 && (
                <div className="mb-4">
                  <div className="text-xs font-medium text-muted-foreground mb-2">Pagos anteriores</div>
                  <div className="space-y-1">
                    {getOrderPayments(paymentOrder.id).map(p => (
                      <div key={p.id} className="flex justify-between text-xs p-2 rounded bg-muted/50">
                        <span>{p.date} · {p.method}</span>
                        <span className="font-semibold text-success">{fmt(p.amount)}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              <div className="space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs font-medium text-muted-foreground">Fecha *</label>
                    <input type="date" value={payForm.date} onChange={e => setPayForm({ ...payForm, date: e.target.value })} className="w-full mt-1 px-3 py-2 rounded-lg border bg-background text-sm" />
                  </div>
                  <div>
                    <label className="text-xs font-medium text-muted-foreground">Monto *</label>
                    <input type="number" value={payForm.amount} onChange={e => setPayForm({ ...payForm, amount: Number(e.target.value) })} className="w-full mt-1 px-3 py-2 rounded-lg border bg-background text-sm" />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs font-medium text-muted-foreground">Método</label>
                    <select value={payForm.method} onChange={e => setPayForm({ ...payForm, method: e.target.value as Payment['method'] })} className="w-full mt-1 px-3 py-2 rounded-lg border bg-background text-sm">
                      <option value="transferencia">Transferencia</option>
                      <option value="efectivo">Efectivo</option>
                      <option value="cheque">Cheque</option>
                      <option value="tarjeta">Tarjeta</option>
                      <option value="otro">Otro</option>
                    </select>
                  </div>
                  <div>
                    <label className="text-xs font-medium text-muted-foreground">Referencia</label>
                    <input value={payForm.reference} onChange={e => setPayForm({ ...payForm, reference: e.target.value })} className="w-full mt-1 px-3 py-2 rounded-lg border bg-background text-sm" />
                  </div>
                </div>
                <div>
                  <label className="text-xs font-medium text-muted-foreground">Observaciones</label>
                  <textarea value={payForm.comment} onChange={e => setPayForm({ ...payForm, comment: e.target.value })} rows={2} className="w-full mt-1 px-3 py-2 rounded-lg border bg-background text-sm resize-none" />
                </div>
              </div>
            </>
          )}
          <DialogFooter>
            <button onClick={() => setPaymentOrder(null)} className="px-4 py-2 rounded-lg border text-sm hover:bg-muted">Cancelar</button>
            <button onClick={handleRegisterPayment} className="px-4 py-2 rounded-lg bg-success text-success-foreground text-sm font-medium hover:opacity-90">Registrar pago</button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ORDER DETAIL / ACCOUNT STATEMENT */}
      <Dialog open={!!detailOrder} onOpenChange={() => setDetailOrder(null)}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          {detailOrder && (() => {
            const paid = getTotalPaid(detailOrder.id);
            const balance = Math.max(0, detailOrder.total - paid);
            const orderPays = getOrderPayments(detailOrder.id);
            return (
              <>
                <DialogHeader>
                  <DialogTitle>Pedido {detailOrder.folio}</DialogTitle>
                  <DialogDescription>{detailOrder.customerName} — {detailOrder.vendorName}</DialogDescription>
                </DialogHeader>
                <div className="grid grid-cols-3 gap-3 mb-4">
                  <div className="p-3 rounded-lg bg-muted/50 text-center">
                    <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Total</div>
                    <div className="font-bold text-lg">{fmt(detailOrder.total)}</div>
                  </div>
                  <div className="p-3 rounded-lg bg-success/10 text-center">
                    <div className="text-[10px] uppercase tracking-wider text-success">Pagado</div>
                    <div className="font-bold text-lg text-success">{fmt(paid)}</div>
                  </div>
                  <div className="p-3 rounded-lg bg-destructive/10 text-center">
                    <div className="text-[10px] uppercase tracking-wider text-destructive">Saldo</div>
                    <div className="font-bold text-lg text-destructive">{fmt(balance)}</div>
                  </div>
                </div>
                <div className="mb-4">
                  <div className="text-xs font-medium text-muted-foreground mb-2">Productos</div>
                  <div className="space-y-1">
                    {detailOrder.items.map((it, i) => (
                      <div key={i} className="flex justify-between text-sm p-2 rounded bg-muted/30">
                        <span>{it.productName} x{it.qty}</span>
                        <span className="font-semibold">{fmt(it.qty * it.unitPrice)}</span>
                      </div>
                    ))}
                  </div>
                </div>
                <div className="mb-4">
                  <div className="text-xs font-medium text-muted-foreground mb-2">Historial de pagos</div>
                  {detailOrder.advance > 0 && (
                    <div className="flex justify-between text-xs p-2 rounded bg-success/5 mb-1">
                      <span>Anticipo inicial</span>
                      <span className="font-semibold text-success">{fmt(detailOrder.advance)}</span>
                    </div>
                  )}
                  {orderPays.length > 0 ? orderPays.map(p => (
                    <div key={p.id} className="flex justify-between text-xs p-2 rounded bg-success/5 mb-1">
                      <span>{p.date} · {p.method} {p.reference && `· Ref: ${p.reference}`}</span>
                      <span className="font-semibold text-success">{fmt(p.amount)}</span>
                    </div>
                  )) : !detailOrder.advance && <div className="text-xs text-muted-foreground">Sin pagos registrados</div>}
                </div>
                <div className="flex gap-2">
                  <button onClick={() => { setPaymentOrder(detailOrder); setDetailOrder(null); }} className="flex-1 px-3 py-2 rounded-lg bg-success text-success-foreground text-sm font-medium hover:opacity-90 flex items-center justify-center gap-2">
                    <DollarSign size={14} /> Registrar pago
                  </button>
                  <button onClick={() => { setHistoryCustomerId(detailOrder.customerId); setDetailOrder(null); }} className="flex-1 px-3 py-2 rounded-lg border text-sm font-medium hover:bg-muted flex items-center justify-center gap-2">
                    <History size={14} /> Estado de cuenta cliente
                  </button>
                </div>
              </>
            );
          })()}
        </DialogContent>
      </Dialog>

      {/* CUSTOMER HISTORY / ACCOUNT STATEMENT */}
      <Dialog open={!!historyCustomerId} onOpenChange={() => setHistoryCustomerId(null)}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2"><History size={20} /> Estado de cuenta — {customerName}</DialogTitle>
            <DialogDescription>Histórico de compras y pagos del cliente</DialogDescription>
          </DialogHeader>
          <div className="grid grid-cols-3 gap-3 mb-4">
            <div className="p-3 rounded-lg bg-muted/50 text-center">
              <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Total comprado</div>
              <div className="font-bold text-lg">{fmt(totalComprado)}</div>
            </div>
            <div className="p-3 rounded-lg bg-success/10 text-center">
              <div className="text-[10px] uppercase tracking-wider text-success">Total pagado</div>
              <div className="font-bold text-lg text-success">{fmt(totalPagado)}</div>
            </div>
            <div className="p-3 rounded-lg bg-destructive/10 text-center">
              <div className="text-[10px] uppercase tracking-wider text-destructive">Saldo pendiente</div>
              <div className="font-bold text-lg text-destructive">{fmt(Math.max(0, saldoPendiente))}</div>
            </div>
          </div>
          <div className="flex items-center gap-3 mb-4">
            <div>
              <label className="text-xs font-medium text-muted-foreground">Desde</label>
              <input type="date" value={historyDateFrom} onChange={e => setHistoryDateFrom(e.target.value)} className="ml-2 px-2 py-1 rounded border bg-background text-xs" />
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground">Hasta</label>
              <input type="date" value={historyDateTo} onChange={e => setHistoryDateTo(e.target.value)} className="ml-2 px-2 py-1 rounded border bg-background text-xs" />
            </div>
            <button onClick={handleDownloadStatement} className="ml-auto inline-flex items-center gap-2 px-3 py-1.5 rounded-lg bg-primary text-primary-foreground text-xs font-medium hover:opacity-90">
              <FileSpreadsheet size={14} /> Descargar Excel
            </button>
          </div>
          <div className="border rounded-lg overflow-hidden">
            <table className="data-table">
              <thead><tr><th>Fecha</th><th>Folio</th><th>Total</th><th>Pagado</th><th>Saldo</th><th>Estatus</th></tr></thead>
              <tbody>
                {customerOrders.filter(o => {
                  if (historyDateFrom && o.createdAt < historyDateFrom) return false;
                  if (historyDateTo && o.createdAt > historyDateTo) return false;
                  return true;
                }).map(o => {
                  const oPaid = getTotalPaid(o.id);
                  const oBal = Math.max(0, o.total - oPaid);
                  return (
                    <tr key={o.id}>
                      <td className="text-xs">{o.createdAt}</td>
                      <td className="font-mono text-xs font-semibold">{o.folio}</td>
                      <td className="font-semibold">{fmt(o.total)}</td>
                      <td className="text-success">{fmt(oPaid)}</td>
                      <td className={oBal > 0 ? 'text-destructive font-medium' : 'text-success'}>{fmt(oBal)}</td>
                      <td><span className={`text-xs font-medium px-2 py-0.5 rounded-full ${oBal <= 0 ? 'bg-success/10 text-success' : 'bg-warning/10 text-warning'}`}>{oBal <= 0 ? 'Liquidado' : 'Pendiente'}</span></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </DialogContent>
      </Dialog>

      <AuthorizationDialog request={authRequest} onClose={closeAuth} />
    </div>
  );
}
