import { useState, useEffect, useMemo } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';
import { FileText, Plus, Search, AlertTriangle } from 'lucide-react';
import { toast } from 'sonner';
import { useOrders, type DBOrder } from '@/hooks/useOrders';
import { useAllCustomerFiscalData, useAllProductFiscalData, useFiscalSettings, useCreateInvoice, SAT_PAYMENT_FORMS, SAT_PAYMENT_METHODS } from '@/hooks/useInvoicing';

const fmt = (n: number) => new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN', maximumFractionDigits: 2 }).format(n);

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  preselectedOrderId?: string;
  preselectedOrderFolio?: string;
}

export default function InvoiceCreateDialog({ open, onOpenChange, preselectedOrderId, preselectedOrderFolio }: Props) {
  const { data: orders } = useOrders();
  const { data: fiscal } = useFiscalSettings();
  const { data: customerFiscal } = useAllCustomerFiscalData();
  const { data: productFiscal } = useAllProductFiscalData();
  const createMutation = useCreateInvoice();

  const [step, setStep] = useState<'select' | 'configure'>('select');
  const [search, setSearch] = useState('');
  const [selectedOrder, setSelectedOrder] = useState<DBOrder | null>(null);

  // Invoice fields
  const [series, setSeries] = useState('A');
  const [folio, setFolio] = useState('');
  const [paymentForm, setPaymentForm] = useState('99');
  const [paymentMethod, setPaymentMethod] = useState('PUE');
  const [currency, setCurrency] = useState('MXN');
  const [exchangeRate, setExchangeRate] = useState(1);
  const [conditions, setConditions] = useState('');
  const [notes, setNotes] = useState('');

  const fiscalMap = useMemo(() => new Map((customerFiscal ?? []).map(f => [f.customer_id, f])), [customerFiscal]);
  const prodFiscalMap = useMemo(() => new Map((productFiscal ?? []).map(f => [f.product_id, f])), [productFiscal]);

  // Reset on open
  useEffect(() => {
    if (open) {
      setSearch('');
      setSeries(fiscal?.default_series || 'A');
      setFolio('');
      setPaymentForm('99');
      setPaymentMethod('PUE');
      setCurrency('MXN');
      setExchangeRate(1);
      setConditions('');
      setNotes('');

      // Auto-select preselected order
      if ((preselectedOrderId || preselectedOrderFolio) && orders) {
        const found = orders.find(o =>
          (preselectedOrderId && o.id === preselectedOrderId) ||
          (preselectedOrderFolio && o.folio === preselectedOrderFolio)
        );
        if (found) {
          setSelectedOrder(found);
          setStep('configure');
          return;
        }
      }
      setStep('select');
      setSelectedOrder(null);
    }
  }, [open, fiscal, preselectedOrderId, preselectedOrderFolio, orders]);

  // Filter orders that can be invoiced
  const eligibleOrders = (orders ?? []).filter(o =>
    !['cancelado', 'nuevo'].includes(o.status) &&
    (o.customer_name.toLowerCase().includes(search.toLowerCase()) || o.folio.toLowerCase().includes(search.toLowerCase()))
  );

  const handleSelectOrder = (order: DBOrder) => {
    setSelectedOrder(order);
    setStep('configure');
  };

  const customerFiscalData = selectedOrder?.customer_id ? fiscalMap.get(selectedOrder.customer_id) : null;
  const hasCustomerFiscal = customerFiscalData && customerFiscalData.rfc && customerFiscalData.legal_name && customerFiscalData.fiscal_zip_code && customerFiscalData.tax_regime;

  // Build items from order
  const orderItems = selectedOrder?.items ?? [];
  const invoiceItems = orderItems.map((item: any) => {
    const pf = item.productId ? prodFiscalMap.get(item.productId) : null;
    const unitPrice = Number(item.unitPrice || item.price || 0);
    const qty = Number(item.qty || item.quantity || 1);
    const subtotal = unitPrice * qty;
    const vatRate = pf?.vat_rate ?? 16;
    const taxAmount = subtotal * (vatRate / 100);
    return {
      product_id: item.productId || null,
      description: pf?.fiscal_description || item.name || item.description || '',
      qty,
      unit_price: unitPrice,
      discount: 0,
      subtotal,
      tax_amount: taxAmount,
      total: subtotal + taxAmount,
      sat_product_key: pf?.sat_product_key || '',
      sat_unit_key: pf?.sat_unit_key || '',
    };
  });

  const subtotal = invoiceItems.reduce((s, i) => s + i.subtotal, 0);
  const taxTotal = invoiceItems.reduce((s, i) => s + i.tax_amount, 0);
  const total = subtotal + taxTotal;

  const missingFiscalProducts = invoiceItems.filter(i => !i.sat_product_key || !i.sat_unit_key);

  const handleCreate = () => {
    if (!selectedOrder) return;
    if (!fiscal?.id) { toast.error('Configura los datos del emisor primero'); return; }
    if (!hasCustomerFiscal) { toast.error('Completa los datos fiscales del cliente antes de facturar'); return; }
    if (missingFiscalProducts.length > 0) { toast.error('Hay productos sin claves SAT. Configura los datos fiscales de todos los productos.'); return; }
    if (!folio.trim()) { toast.error('El folio es obligatorio'); return; }

    createMutation.mutate({
      invoice: {
        customer_id: selectedOrder.customer_id,
        order_id: selectedOrder.id,
        sales_person_id: '',
        series,
        folio,
        invoice_type: 'I',
        payment_form: paymentForm,
        payment_method: paymentMethod,
        currency,
        exchange_rate: exchangeRate,
        subtotal,
        tax_amount: taxTotal,
        total,
        status: 'borrador',
        pac_provider: fiscal.pac_provider || 'facturama',
        conditions,
        notes,
        export_code: '01',
        created_by: '',
      },
      items: invoiceItems,
    }, {
      onSuccess: () => onOpenChange(false),
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileText size={18} />
            {step === 'select' ? 'Seleccionar Pedido para Facturar' : 'Configurar Factura'}
          </DialogTitle>
          <DialogDescription>
            {step === 'select' ? 'Selecciona el pedido del cual generar la factura' : `Pedido ${selectedOrder?.folio} — ${selectedOrder?.customer_name}`}
          </DialogDescription>
        </DialogHeader>

        {step === 'select' && (
          <div className="space-y-4">
            <div className="relative max-w-sm">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" size={16} />
              <Input placeholder="Buscar pedido o cliente..." value={search} onChange={e => setSearch(e.target.value)} className="pl-9" />
            </div>
            <div className="max-h-[400px] overflow-y-auto border rounded-lg">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Folio</TableHead>
                    <TableHead>Cliente</TableHead>
                    <TableHead>Estatus</TableHead>
                    <TableHead className="text-right">Total</TableHead>
                    <TableHead>Fiscal</TableHead>
                    <TableHead></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {eligibleOrders.slice(0, 30).map(o => {
                    const cf = o.customer_id ? fiscalMap.get(o.customer_id) : null;
                    const hasFiscal = cf && cf.rfc && cf.legal_name;
                    return (
                      <TableRow key={o.id}>
                        <TableCell className="font-mono text-sm">{o.folio}</TableCell>
                        <TableCell>{o.customer_name}</TableCell>
                        <TableCell><Badge variant="outline" className="text-xs">{o.status}</Badge></TableCell>
                        <TableCell className="text-right">{fmt(o.total)}</TableCell>
                        <TableCell>
                          {hasFiscal
                            ? <Badge className="bg-green-100 text-green-800 text-xs">OK</Badge>
                            : <Badge variant="outline" className="text-xs text-amber-600 border-amber-300">Incompleto</Badge>
                          }
                        </TableCell>
                        <TableCell>
                          <Button size="sm" onClick={() => handleSelectOrder(o)}>Seleccionar</Button>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                  {eligibleOrders.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center text-muted-foreground py-8">No hay pedidos disponibles</TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
          </div>
        )}

        {step === 'configure' && selectedOrder && (
          <div className="space-y-6">
            {/* Warnings */}
            {!hasCustomerFiscal && (
              <div className="flex items-center gap-2 p-3 rounded-lg border border-amber-300 bg-amber-50 text-amber-800 text-sm">
                <AlertTriangle size={16} />
                <span>Los datos fiscales del cliente están incompletos. Configúralos antes de timbrar.</span>
              </div>
            )}
            {missingFiscalProducts.length > 0 && (
              <div className="flex items-center gap-2 p-3 rounded-lg border border-amber-300 bg-amber-50 text-amber-800 text-sm">
                <AlertTriangle size={16} />
                <span>{missingFiscalProducts.length} producto(s) sin claves SAT configuradas.</span>
              </div>
            )}

            {/* CFDI Fields */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="space-y-1.5">
                <Label>Serie</Label>
                <Input value={series} onChange={e => setSeries(e.target.value.toUpperCase())} maxLength={5} />
              </div>
              <div className="space-y-1.5">
                <Label>Folio *</Label>
                <Input value={folio} onChange={e => setFolio(e.target.value)} placeholder="001" />
              </div>
              <div className="space-y-1.5">
                <Label>Forma de Pago</Label>
                <select className="w-full h-10 rounded-md border border-input bg-background px-3 text-sm" value={paymentForm} onChange={e => setPaymentForm(e.target.value)}>
                  {SAT_PAYMENT_FORMS.map(f => <option key={f.code} value={f.code}>{f.label}</option>)}
                </select>
              </div>
              <div className="space-y-1.5">
                <Label>Método de Pago</Label>
                <select className="w-full h-10 rounded-md border border-input bg-background px-3 text-sm" value={paymentMethod} onChange={e => setPaymentMethod(e.target.value)}>
                  {SAT_PAYMENT_METHODS.map(m => <option key={m.code} value={m.code}>{m.label}</option>)}
                </select>
              </div>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="space-y-1.5">
                <Label>Moneda</Label>
                <select className="w-full h-10 rounded-md border border-input bg-background px-3 text-sm" value={currency} onChange={e => setCurrency(e.target.value)}>
                  <option value="MXN">MXN</option>
                  <option value="USD">USD</option>
                </select>
              </div>
              {currency === 'USD' && (
                <div className="space-y-1.5">
                  <Label>Tipo de Cambio</Label>
                  <Input type="number" value={exchangeRate} onChange={e => setExchangeRate(Number(e.target.value))} />
                </div>
              )}
              <div className="space-y-1.5 col-span-2">
                <Label>Condiciones de pago</Label>
                <Input value={conditions} onChange={e => setConditions(e.target.value)} placeholder="Contado / Crédito 30 días" />
              </div>
            </div>

            {/* Items */}
            <Card>
              <CardContent className="p-0">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Descripción</TableHead>
                      <TableHead>Clave SAT</TableHead>
                      <TableHead className="text-right">Cant.</TableHead>
                      <TableHead className="text-right">P.Unit.</TableHead>
                      <TableHead className="text-right">Subtotal</TableHead>
                      <TableHead className="text-right">IVA</TableHead>
                      <TableHead className="text-right">Total</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {invoiceItems.map((it, idx) => (
                      <TableRow key={idx}>
                        <TableCell className="max-w-[200px] truncate">{it.description || <span className="text-muted-foreground italic">Sin descripción</span>}</TableCell>
                        <TableCell className="font-mono text-xs">{it.sat_product_key || <span className="text-destructive">—</span>}</TableCell>
                        <TableCell className="text-right">{it.qty}</TableCell>
                        <TableCell className="text-right">{fmt(it.unit_price)}</TableCell>
                        <TableCell className="text-right">{fmt(it.subtotal)}</TableCell>
                        <TableCell className="text-right">{fmt(it.tax_amount)}</TableCell>
                        <TableCell className="text-right font-medium">{fmt(it.total)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>

            {/* Totals */}
            <div className="flex justify-end">
              <div className="space-y-1 text-right text-sm">
                <div>Subtotal: <span className="font-medium">{fmt(subtotal)}</span></div>
                <div>IVA: <span className="font-medium">{fmt(taxTotal)}</span></div>
                <div className="text-base font-bold">Total: {fmt(total)}</div>
              </div>
            </div>

            <div className="space-y-1.5">
              <Label>Observaciones</Label>
              <Textarea value={notes} onChange={e => setNotes(e.target.value)} rows={2} placeholder="Notas internas" />
            </div>
          </div>
        )}

        <DialogFooter>
          {step === 'configure' && (
            <Button variant="outline" onClick={() => setStep('select')}>← Cambiar pedido</Button>
          )}
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          {step === 'configure' && (
            <Button onClick={handleCreate} disabled={createMutation.isPending} className="gap-1.5">
              <Plus size={14} />
              {createMutation.isPending ? 'Creando...' : 'Crear Factura (Borrador)'}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
