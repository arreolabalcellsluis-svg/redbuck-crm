import { useState, useMemo } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { DBOrder, useUpdateOrder } from '@/hooks/useOrders';
import { DBOrderPayment } from '@/hooks/useOrderPayments';
import { useInvoices } from '@/hooks/useInvoicing';
import { useAppContext } from '@/contexts/AppContext';
import { supabase } from '@/integrations/supabase/client';
import { addAuditLog } from '@/lib/auditLog';
import { toast } from 'sonner';
import { DollarSign, Truck, FileText, Image, Edit2, History, Package, AlertTriangle, Upload, X, Eye } from 'lucide-react';
import ImageGalleryLightbox from '@/components/shared/ImageGalleryLightbox';

const fmt = (n: number) => new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN', maximumFractionDigits: 0 }).format(n);

interface Props {
  order: DBOrder | null;
  onClose: () => void;
  orderPayments: DBOrderPayment[];
  totalPaid: number;
  onOpenPayment: (order: DBOrder) => void;
  onOpenInvoice: (order: DBOrder) => void;
  products: any[];
}

export default function OrderDetailDialog({ order, onClose, orderPayments, totalPaid, onOpenPayment, onOpenInvoice, products }: Props) {
  const { currentRole } = useAppContext();
  const updateOrderMutation = useUpdateOrder();
  const { data: dbInvoices = [] } = useInvoices();

  // Shipping state
  const [shipping, setShipping] = useState({ transportista: '', guia_numero: '', fecha_envio: '' });
  const [shippingDirty, setShippingDirty] = useState(false);

  // Invoice manual state
  const [invoiceManual, setInvoiceManual] = useState({ number: '', date: '', pdf_url: '' });
  const [invoiceManualDirty, setInvoiceManualDirty] = useState(false);

  // Edit mode
  const [editMode, setEditMode] = useState(false);
  const [editItems, setEditItems] = useState<any[]>([]);
  const [editConfirmed, setEditConfirmed] = useState(false);

  // Image upload
  const [uploading, setUploading] = useState(false);

  // Init shipping/invoice when order changes
  const currentOrder = order;
  const linkedInvoice = useMemo(() => {
    if (!order) return null;
    return dbInvoices.find((inv: any) => inv.order_id === order.id) || null;
  }, [order, dbInvoices]);

  if (!order) return null;

  const balance = Math.max(0, order.total - totalPaid);
  const payStatus = totalPaid >= order.total ? 'Pagado completo' : totalPaid > 0 ? 'Pago parcial' : 'Pendiente';
  const payColor = totalPaid >= order.total ? 'text-success bg-success/10' : totalPaid > 0 ? 'text-warning bg-warning/10' : 'text-destructive bg-destructive/10';
  const isModified = (order.edit_history || []).length > 0;
  const hasPayments = totalPaid > 0;

  // Shipping handlers
  const initShipping = () => {
    setShipping({
      transportista: order.transportista || '',
      guia_numero: order.guia_numero || '',
      fecha_envio: order.fecha_envio || '',
    });
    setShippingDirty(false);
  };

  const saveShipping = () => {
    updateOrderMutation.mutate({
      id: order.id,
      transportista: shipping.transportista,
      guia_numero: shipping.guia_numero,
      fecha_envio: shipping.fecha_envio || null,
    } as any);
    setShippingDirty(false);
    toast.success('Información de envío guardada');
  };

  // Invoice manual handlers
  const initInvoiceManual = () => {
    setInvoiceManual({
      number: order.invoice_number_manual || '',
      date: order.invoice_date_manual || '',
      pdf_url: order.invoice_pdf_url || '',
    });
    setInvoiceManualDirty(false);
  };

  const saveInvoiceManual = () => {
    updateOrderMutation.mutate({
      id: order.id,
      invoice_number_manual: invoiceManual.number,
      invoice_date_manual: invoiceManual.date || null,
      invoice_pdf_url: invoiceManual.pdf_url,
    } as any);
    setInvoiceManualDirty(false);
    toast.success('Datos de factura guardados');
  };

  // Edit mode handlers
  const startEdit = () => {
    if (linkedInvoice && !editConfirmed) {
      const ok = window.confirm('Este pedido ya tiene una factura asociada. Se recomienda cancelar o actualizar la factura antes de modificar. ¿Deseas continuar?');
      if (!ok) return;
    }
    if (hasPayments && !editConfirmed) {
      const ok = window.confirm('Este pedido tiene pagos registrados. Modificarlo puede afectar la conciliación. ¿Deseas continuar?');
      if (!ok) return;
    }
    setEditConfirmed(true);
    setEditItems(order.items.map((it: any) => ({ ...it })));
    setEditMode(true);
  };

  const addEditItem = () => {
    setEditItems([...editItems, { productId: '', name: '', qty: 1, unitPrice: 0 }]);
  };

  const removeEditItem = (i: number) => {
    setEditItems(editItems.filter((_, idx) => idx !== i));
  };

  const updateEditItem = (i: number, field: string, value: any) => {
    const updated = [...editItems];
    if (field === 'productId') {
      const prod = products.find((p: any) => p.id === value);
      if (prod) {
        updated[i] = { ...updated[i], productId: value, name: prod.name, unitPrice: prod.list_price };
      }
    } else {
      updated[i] = { ...updated[i], [field]: value };
    }
    setEditItems(updated);
  };

  const editSubtotal = editItems.reduce((s: number, it: any) => s + (it.qty || 0) * (it.unitPrice || 0), 0);
  const editTax = editSubtotal * 0.16;
  const editTotal = editSubtotal + editTax;

  const saveEdit = () => {
    const changes: any[] = [];
    const oldItems = order.items || [];

    // Detect changes
    editItems.forEach((newIt: any, i: number) => {
      const oldIt = oldItems[i];
      if (!oldIt) {
        changes.push({ type: 'added', product: newIt.name || newIt.productName, qty: newIt.qty, price: newIt.unitPrice });
      } else {
        if ((oldIt.qty || 0) !== (newIt.qty || 0)) {
          changes.push({ type: 'qty_change', product: newIt.name || newIt.productName, from: oldIt.qty, to: newIt.qty });
        }
        if ((oldIt.unitPrice || 0) !== (newIt.unitPrice || 0)) {
          changes.push({ type: 'price_change', product: newIt.name || newIt.productName, from: oldIt.unitPrice, to: newIt.unitPrice });
        }
      }
    });
    oldItems.forEach((oldIt: any, i: number) => {
      if (!editItems[i]) {
        changes.push({ type: 'removed', product: oldIt.name || oldIt.productName, qty: oldIt.qty, price: oldIt.unitPrice });
      }
    });

    const historyEntry = {
      date: new Date().toISOString(),
      user: 'Usuario actual',
      role: currentRole,
      changes,
      previous_total: order.total,
      new_total: editTotal,
    };

    const newHistory = [...(order.edit_history || []), historyEntry];

    updateOrderMutation.mutate({
      id: order.id,
      items: editItems as any,
      total: editTotal,
      balance: Math.max(0, editTotal - totalPaid),
      edit_history: newHistory as any,
    } as any);

    addAuditLog({
      userId: 'current', userName: 'Usuario actual', userRole: currentRole,
      module: 'pedidos', action: 'editar_pedido', entityId: order.id,
      previousValue: `Total: ${fmt(order.total)}`, newValue: `Total: ${fmt(editTotal)}`,
      comment: `${changes.length} cambio(s) en productos`,
    });

    setEditMode(false);
    setEditConfirmed(false);
    toast.success('Pedido actualizado. Los cambios quedaron registrados.');
  };

  // Image upload
  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    setUploading(true);
    try {
      const newImages: string[] = [...(order.shipping_images || [])];
      for (const file of Array.from(files)) {
        const ext = file.name.split('.').pop();
        const path = `orders/${order.id}/${Date.now()}_${Math.random().toString(36).slice(2, 6)}.${ext}`;
        const { error } = await supabase.storage.from('company-assets').upload(path, file);
        if (error) throw error;
        const { data: urlData } = supabase.storage.from('company-assets').getPublicUrl(path);
        newImages.push(urlData.publicUrl);
      }
      updateOrderMutation.mutate({ id: order.id, shipping_images: newImages as any } as any);
      toast.success('Evidencia subida correctamente');
    } catch (err: any) {
      toast.error('Error al subir imagen: ' + err.message);
    } finally {
      setUploading(false);
    }
  };

  const removeImage = (idx: number) => {
    const newImages = (order.shipping_images || []).filter((_: any, i: number) => i !== idx);
    updateOrderMutation.mutate({ id: order.id, shipping_images: newImages as any } as any);
    toast.success('Imagen eliminada');
  };

  return (
    <Dialog open={!!order} onOpenChange={() => { setEditMode(false); setEditConfirmed(false); onClose(); }}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            Pedido {order.folio}
            {isModified && <span className="text-[10px] px-2 py-0.5 rounded-full bg-warning/10 text-warning font-medium">Modificado</span>}
          </DialogTitle>
          <DialogDescription>{order.customer_name} — {order.vendor_name} — {order.created_at?.slice(0, 10)}</DialogDescription>
        </DialogHeader>

        {/* Summary cards */}
        <div className="grid grid-cols-4 gap-2 mb-2">
          <div className="p-2 rounded-lg bg-muted/50 text-center">
            <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Total</div>
            <div className="font-bold">{fmt(order.total)}</div>
          </div>
          <div className="p-2 rounded-lg bg-success/10 text-center">
            <div className="text-[10px] uppercase tracking-wider text-success">Pagado</div>
            <div className="font-bold text-success">{fmt(totalPaid)}</div>
          </div>
          <div className="p-2 rounded-lg bg-destructive/10 text-center">
            <div className="text-[10px] uppercase tracking-wider text-destructive">Saldo</div>
            <div className="font-bold text-destructive">{fmt(balance)}</div>
          </div>
          <div className={`p-2 rounded-lg text-center ${payColor}`}>
            <div className="text-[10px] uppercase tracking-wider">Estado pago</div>
            <div className="font-bold text-sm">{payStatus}</div>
          </div>
        </div>

        {/* Shipping status indicator */}
        <div className="flex items-center gap-3 mb-2 text-xs">
          <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full font-medium ${order.transportista ? 'bg-success/10 text-success' : 'bg-muted text-muted-foreground'}`}>
            <Truck size={12} /> {order.transportista ? 'Envío registrado' : 'Sin envío'}
          </span>
          <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full font-medium ${linkedInvoice || order.invoice_number_manual ? 'bg-primary/10 text-primary' : 'bg-muted text-muted-foreground'}`}>
            <FileText size={12} /> {linkedInvoice ? `Factura ${(linkedInvoice as any).folio}` : order.invoice_number_manual ? `Factura ${order.invoice_number_manual}` : 'Sin factura'}
          </span>
        </div>

        <Tabs defaultValue="general" className="w-full" onValueChange={(v) => {
          if (v === 'shipping') initShipping();
          if (v === 'invoicing') initInvoiceManual();
        }}>
          <TabsList className="grid w-full grid-cols-6 text-xs">
            <TabsTrigger value="general" className="text-xs">General</TabsTrigger>
            <TabsTrigger value="products" className="text-xs">Productos</TabsTrigger>
            <TabsTrigger value="payments" className="text-xs">Pagos</TabsTrigger>
            <TabsTrigger value="shipping" className="text-xs">Envío</TabsTrigger>
            <TabsTrigger value="invoicing" className="text-xs">Facturación</TabsTrigger>
            <TabsTrigger value="evidence" className="text-xs">Evidencia</TabsTrigger>
          </TabsList>

          {/* GENERAL */}
          <TabsContent value="general" className="space-y-3 mt-3">
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div><span className="text-muted-foreground text-xs">Folio:</span> <span className="font-mono font-semibold">{order.folio}</span></div>
              <div><span className="text-muted-foreground text-xs">Tipo:</span> {order.order_type}</div>
              <div><span className="text-muted-foreground text-xs">Cliente:</span> {order.customer_name}</div>
              <div><span className="text-muted-foreground text-xs">Vendedor:</span> {order.vendor_name}</div>
              <div><span className="text-muted-foreground text-xs">Bodega:</span> {order.warehouse}</div>
              <div><span className="text-muted-foreground text-xs">Fecha promesa:</span> {order.promise_date || '—'}</div>
              <div><span className="text-muted-foreground text-xs">Cotización:</span> {order.quotation_folio || '—'}</div>
              <div><span className="text-muted-foreground text-xs">Creado:</span> {order.created_at?.slice(0, 10)}</div>
            </div>
            {order.delivery_notes && (
              <div className="text-sm"><span className="text-muted-foreground text-xs">Notas entrega:</span> {order.delivery_notes}</div>
            )}
          </TabsContent>

          {/* PRODUCTS */}
          <TabsContent value="products" className="space-y-3 mt-3">
            {!editMode ? (
              <>
                <div className="flex items-center justify-between">
                  <span className="text-xs font-medium text-muted-foreground">Productos del pedido</span>
                  <button onClick={startEdit} className="inline-flex items-center gap-1 text-xs text-primary hover:underline">
                    <Edit2 size={12} /> Editar pedido
                  </button>
                </div>
                <div className="space-y-1">
                  {(order.items || []).map((it: any, i: number) => (
                    <div key={i} className="flex justify-between text-sm p-2 rounded bg-muted/30">
                      <span>{it.name || it.productName} <span className="text-muted-foreground">x{it.qty}</span> <span className="text-muted-foreground">@ {fmt(it.unitPrice)}</span></span>
                      <span className="font-semibold">{fmt((it.qty || 0) * (it.unitPrice || 0))}</span>
                    </div>
                  ))}
                </div>
                <div className="text-right text-sm font-bold">Total: {fmt(order.total)}</div>
              </>
            ) : (
              <>
                {hasPayments && (
                  <div className="flex items-center gap-2 p-2 rounded-lg bg-warning/10 text-warning text-xs">
                    <AlertTriangle size={14} /> Este pedido tiene pagos registrados. Los cambios pueden afectar la conciliación.
                  </div>
                )}
                {linkedInvoice && (
                  <div className="flex items-center gap-2 p-2 rounded-lg bg-destructive/10 text-destructive text-xs">
                    <AlertTriangle size={14} /> Este pedido tiene factura asociada. Se recomienda actualizar la factura después de modificar.
                  </div>
                )}
                <div className="flex items-center justify-between">
                  <span className="text-xs font-medium text-warning">Modo edición</span>
                  <button onClick={addEditItem} className="text-xs text-primary hover:underline">+ Agregar producto</button>
                </div>
                <div className="space-y-2">
                  {editItems.map((it: any, i: number) => (
                    <div key={i} className="flex items-center gap-2">
                      <select
                        value={it.productId || ''}
                        onChange={e => updateEditItem(i, 'productId', e.target.value)}
                        className="flex-1 px-2 py-1.5 rounded border bg-background text-xs"
                      >
                        <option value="">{it.name || it.productName || 'Seleccionar...'}</option>
                        {products.filter((p: any) => p.active).map((p: any) => (
                          <option key={p.id} value={p.id}>{p.name}</option>
                        ))}
                      </select>
                      <input type="number" min={1} value={it.qty || 1} onChange={e => updateEditItem(i, 'qty', Number(e.target.value))} className="w-16 px-2 py-1.5 rounded border bg-background text-xs text-center" placeholder="Cant" />
                      <input type="number" value={it.unitPrice || 0} onChange={e => updateEditItem(i, 'unitPrice', Number(e.target.value))} className="w-24 px-2 py-1.5 rounded border bg-background text-xs" placeholder="Precio" />
                      <span className="text-xs font-semibold w-20 text-right">{fmt((it.qty || 0) * (it.unitPrice || 0))}</span>
                      <button onClick={() => removeEditItem(i)} className="text-muted-foreground hover:text-destructive"><X size={14} /></button>
                    </div>
                  ))}
                </div>
                <div className="text-right space-y-1 text-xs">
                  <div>Subtotal: {fmt(editSubtotal)}</div>
                  <div>IVA 16%: {fmt(editTax)}</div>
                  <div className="font-bold text-sm">Nuevo total: {fmt(editTotal)}</div>
                  {order.total !== editTotal && (
                    <div className="text-warning">Diferencia: {fmt(editTotal - order.total)}</div>
                  )}
                </div>
                <div className="flex gap-2 justify-end">
                  <button onClick={() => { setEditMode(false); setEditConfirmed(false); }} className="px-3 py-1.5 rounded-lg border text-xs hover:bg-muted">Cancelar</button>
                  <button onClick={saveEdit} className="px-3 py-1.5 rounded-lg bg-primary text-primary-foreground text-xs font-medium hover:opacity-90">Guardar cambios</button>
                </div>
              </>
            )}

            {/* Edit history */}
            {(order.edit_history || []).length > 0 && (
              <div className="mt-4">
                <div className="flex items-center gap-1 text-xs font-medium text-muted-foreground mb-2"><History size={12} /> Historial de cambios</div>
                <div className="space-y-2 max-h-40 overflow-y-auto">
                  {(order.edit_history as any[]).map((entry: any, idx: number) => (
                    <div key={idx} className="p-2 rounded bg-muted/30 text-xs">
                      <div className="flex justify-between text-muted-foreground">
                        <span>{entry.user} ({entry.role})</span>
                        <span>{new Date(entry.date).toLocaleString('es-MX')}</span>
                      </div>
                      <div className="mt-1 space-y-0.5">
                        {(entry.changes || []).map((c: any, ci: number) => (
                          <div key={ci} className="text-xs">
                            {c.type === 'added' && <span className="text-success">+ Agregado: {c.product} x{c.qty}</span>}
                            {c.type === 'removed' && <span className="text-destructive">− Eliminado: {c.product}</span>}
                            {c.type === 'qty_change' && <span className="text-warning">↔ {c.product}: cantidad {c.from} → {c.to}</span>}
                            {c.type === 'price_change' && <span className="text-warning">↔ {c.product}: precio {fmt(c.from)} → {fmt(c.to)}</span>}
                          </div>
                        ))}
                      </div>
                      {entry.previous_total !== entry.new_total && (
                        <div className="text-xs mt-1">Total: {fmt(entry.previous_total)} → {fmt(entry.new_total)}</div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </TabsContent>

          {/* PAYMENTS */}
          <TabsContent value="payments" className="space-y-3 mt-3">
            <div className={`p-3 rounded-lg text-center ${payColor}`}>
              <div className="font-bold text-lg">{payStatus}</div>
              <div className="text-xs mt-1">Pagado: {fmt(totalPaid)} / Total: {fmt(order.total)}</div>
            </div>
            {order.advance > 0 && (
              <div className="flex justify-between text-xs p-2 rounded bg-success/5">
                <span>Anticipo inicial</span>
                <span className="font-semibold text-success">{fmt(order.advance)}</span>
              </div>
            )}
            {orderPayments.length > 0 ? orderPayments.map(p => (
              <div key={p.id} className="flex justify-between text-xs p-2 rounded bg-success/5">
                <span>{p.payment_date} · {p.method} {p.reference && `· Ref: ${p.reference}`}</span>
                <span className="font-semibold text-success">{fmt(p.amount)}</span>
              </div>
            )) : !order.advance && <div className="text-xs text-muted-foreground">Sin pagos registrados</div>}
            <button onClick={() => onOpenPayment(order)} className="w-full px-3 py-2 rounded-lg bg-success text-success-foreground text-sm font-medium hover:opacity-90 flex items-center justify-center gap-2">
              <DollarSign size={14} /> Registrar pago
            </button>
          </TabsContent>

          {/* SHIPPING */}
          <TabsContent value="shipping" className="space-y-3 mt-3">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-medium text-muted-foreground">Transportista</label>
                <input value={shipping.transportista} onChange={e => { setShipping({ ...shipping, transportista: e.target.value }); setShippingDirty(true); }} className="w-full mt-1 px-3 py-2 rounded-lg border bg-background text-sm" placeholder="Nombre del transportista" />
              </div>
              <div>
                <label className="text-xs font-medium text-muted-foreground">Número de guía / Carta porte</label>
                <input value={shipping.guia_numero} onChange={e => { setShipping({ ...shipping, guia_numero: e.target.value }); setShippingDirty(true); }} className="w-full mt-1 px-3 py-2 rounded-lg border bg-background text-sm" placeholder="Ej. ABC123456" />
              </div>
              <div>
                <label className="text-xs font-medium text-muted-foreground">Fecha de envío</label>
                <input type="date" value={shipping.fecha_envio} onChange={e => { setShipping({ ...shipping, fecha_envio: e.target.value }); setShippingDirty(true); }} className="w-full mt-1 px-3 py-2 rounded-lg border bg-background text-sm" />
              </div>
            </div>
            {shippingDirty && (
              <button onClick={saveShipping} className="px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:opacity-90">Guardar envío</button>
            )}
          </TabsContent>

          {/* INVOICING */}
          <TabsContent value="invoicing" className="space-y-4 mt-3">
            {/* System invoice */}
            {linkedInvoice && (
              <div className="p-3 rounded-lg border bg-primary/5">
                <div className="text-xs font-medium text-primary mb-2">Factura del sistema</div>
                <div className="grid grid-cols-2 gap-2 text-sm">
                  <div><span className="text-muted-foreground text-xs">Folio:</span> {(linkedInvoice as any).series}-{(linkedInvoice as any).folio}</div>
                  <div><span className="text-muted-foreground text-xs">Total:</span> {fmt((linkedInvoice as any).total)}</div>
                  <div><span className="text-muted-foreground text-xs">Estatus:</span> {(linkedInvoice as any).status}</div>
                  <div><span className="text-muted-foreground text-xs">UUID:</span> <span className="font-mono text-[10px]">{(linkedInvoice as any).uuid || '—'}</span></div>
                </div>
              </div>
            )}

            {/* Manual invoice */}
            <div>
              <div className="text-xs font-medium text-muted-foreground mb-2">Factura manual</div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-muted-foreground">Número de factura</label>
                  <input value={invoiceManual.number} onChange={e => { setInvoiceManual({ ...invoiceManual, number: e.target.value }); setInvoiceManualDirty(true); }} className="w-full mt-1 px-3 py-2 rounded-lg border bg-background text-sm" />
                </div>
                <div>
                  <label className="text-xs text-muted-foreground">Fecha de factura</label>
                  <input type="date" value={invoiceManual.date} onChange={e => { setInvoiceManual({ ...invoiceManual, date: e.target.value }); setInvoiceManualDirty(true); }} className="w-full mt-1 px-3 py-2 rounded-lg border bg-background text-sm" />
                </div>
              </div>
              {invoiceManualDirty && (
                <button onClick={saveInvoiceManual} className="mt-2 px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:opacity-90">Guardar factura manual</button>
              )}
            </div>

            {/* Generate invoice button */}
            {!linkedInvoice && !['cancelado', 'nuevo'].includes(order.status) && (
              <button onClick={() => onOpenInvoice(order)} className="w-full px-3 py-2 rounded-lg border text-sm font-medium hover:bg-muted flex items-center justify-center gap-2">
                <FileText size={14} /> Generar factura desde sistema
              </button>
            )}
          </TabsContent>

          {/* EVIDENCE */}
          <TabsContent value="evidence" className="space-y-3 mt-3">
            <div className="text-xs font-medium text-muted-foreground">Evidencia de envío</div>
            <div className="text-[10px] text-muted-foreground">Producto antes de envío, empacado, en paquetería, guía visible</div>

            <label className="inline-flex items-center gap-2 px-3 py-2 rounded-lg border text-sm cursor-pointer hover:bg-muted">
              <Upload size={14} /> {uploading ? 'Subiendo...' : 'Subir imágenes'}
              <input type="file" multiple accept="image/*" onChange={handleImageUpload} className="hidden" disabled={uploading} />
            </label>

            {(order.shipping_images || []).length > 0 ? (
              <div className="grid grid-cols-3 gap-2">
                {(order.shipping_images as string[]).map((url: string, i: number) => (
                  <div key={i} className="relative group">
                    <img src={url} alt={`Evidencia ${i + 1}`} className="w-full h-24 object-cover rounded-lg border" />
                    <button onClick={() => removeImage(i)} className="absolute top-1 right-1 p-0.5 rounded bg-destructive/80 text-destructive-foreground opacity-0 group-hover:opacity-100 transition-opacity">
                      <X size={12} />
                    </button>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-xs text-muted-foreground py-4 text-center border-2 border-dashed rounded-lg">Sin evidencia de envío</div>
            )}
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
