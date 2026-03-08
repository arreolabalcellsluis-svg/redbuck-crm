import { useState, useEffect, useMemo } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { FileText, Plus, Search, AlertTriangle, CalendarIcon, X } from 'lucide-react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import { useOrders, type DBOrder } from '@/hooks/useOrders';
import { useAllCustomerFiscalData, useAllProductFiscalData, useFiscalSettings, useCreateInvoice, useInvoices, SAT_PAYMENT_FORMS, SAT_PAYMENT_METHODS } from '@/hooks/useInvoicing';

const fmt = (n: number) => new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN', maximumFractionDigits: 2 }).format(n);

const DOCUMENT_TYPES = [
  { code: 'I', label: 'Factura (Ingreso)' },
  { code: 'E', label: 'Nota de Crédito / Devolución (Egreso)' },
  { code: 'P', label: 'Recibo de Pago (Complemento)' },
  { code: 'N', label: 'Recibo de Honorarios (Nómina)' },
  { code: 'T', label: 'Traslado' },
] as const;

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  preselectedOrderId?: string;
  preselectedOrderFolio?: string;
  preselectedOrder?: DBOrder;
}

export default function InvoiceCreateDialog({ open, onOpenChange, preselectedOrderId, preselectedOrderFolio, preselectedOrder }: Props) {
  const { data: orders } = useOrders();
  const { data: fiscal } = useFiscalSettings();
  const { data: customerFiscal } = useAllCustomerFiscalData();
  const { data: productFiscal } = useAllProductFiscalData();
  const { data: existingInvoices } = useInvoices();
  const createMutation = useCreateInvoice();

  const [step, setStep] = useState<'select' | 'configure'>('select');
  const [search, setSearch] = useState('');
  const [selectedOrder, setSelectedOrder] = useState<DBOrder | null>(null);
  const [dateFrom, setDateFrom] = useState<Date | undefined>();
  const [dateTo, setDateTo] = useState<Date | undefined>();

  // Invoice fields
  const [series, setSeries] = useState('A');
  const [folio, setFolio] = useState('');
  const [invoiceType, setInvoiceType] = useState<'I' | 'E' | 'P' | 'N' | 'T'>('I');
  const [paymentForm, setPaymentForm] = useState('99');
  const [paymentMethod, setPaymentMethod] = useState('PUE');
  const [currency, setCurrency] = useState('MXN');
  const [exchangeRate, setExchangeRate] = useState(1);
  const [conditions, setConditions] = useState('');
  const [notes, setNotes] = useState('');

  const fiscalMap = useMemo(() => new Map((customerFiscal ?? []).map(f => [f.customer_id, f])), [customerFiscal]);
  const prodFiscalMap = useMemo(() => new Map((productFiscal ?? []).map(f => [f.product_id, f])), [productFiscal]);

  // Auto-generate next folio number
  const nextFolio = useMemo(() => {
    const count = (existingInvoices ?? []).length;
    return String(count + 1).padStart(3, '0');
  }, [existingInvoices]);

  // Reset on open
  useEffect(() => {
    if (open) {
      setSearch('');
      const defaultSeries = fiscal?.default_series || 'A';
      setSeries(defaultSeries);
      setFolio(nextFolio);
      setPaymentForm('99');
      setPaymentMethod('PUE');
      setCurrency('MXN');
      setExchangeRate(1);
      setConditions('');
      setNotes('');

      // Auto-select: first try direct preselectedOrder object, then search DB orders
      if (preselectedOrder) {
        setSelectedOrder(preselectedOrder);
        setStep('configure');
        setNotes(`Pedido: ${preselectedOrder.folio}`);
        return;
      }
      if ((preselectedOrderId || preselectedOrderFolio) && orders) {
        const found = orders.find(o =>
          (preselectedOrderId && o.id === preselectedOrderId) ||
          (preselectedOrderFolio && o.folio === preselectedOrderFolio)
        );
        if (found) {
          setSelectedOrder(found);
          setStep('configure');
          setNotes(`Pedido: ${found.folio}`);
          return;
        }
      }
      setStep('select');
      setSelectedOrder(null);
    }
  }, [open, fiscal, preselectedOrder, preselectedOrderId, preselectedOrderFolio, orders, nextFolio]);

  // Filter and sort orders (newest first)
  const eligibleOrders = useMemo(() => {
    return (orders ?? [])
      .filter(o => {
        if (['cancelado', 'nuevo'].includes(o.status)) return false;
        if (search && !o.customer_name.toLowerCase().includes(search.toLowerCase()) && !o.folio.toLowerCase().includes(search.toLowerCase())) return false;
        if (dateFrom) {
          const d = new Date(o.created_at);
          if (d < dateFrom) return false;
        }
        if (dateTo) {
          const end = new Date(dateTo);
          end.setHours(23, 59, 59, 999);
          const d = new Date(o.created_at);
          if (d > end) return false;
        }
        return true;
      })
      .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
  }, [orders, search, dateFrom, dateTo]);

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
            <div className="flex items-center gap-2 flex-wrap">
              <div className="relative flex-1 min-w-[200px] max-w-sm">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" size={16} />
                <Input placeholder="Buscar pedido o cliente..." value={search} onChange={e => setSearch(e.target.value)} className="pl-9" />
              </div>

              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" size="sm" className={cn("gap-1.5 text-xs", !dateFrom && "text-muted-foreground")}>
                    <CalendarIcon size={14} />
                    {dateFrom ? format(dateFrom, 'dd/MM/yy') : 'Desde'}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar mode="single" selected={dateFrom} onSelect={setDateFrom} initialFocus className="p-3 pointer-events-auto" locale={es} />
                </PopoverContent>
              </Popover>

              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" size="sm" className={cn("gap-1.5 text-xs", !dateTo && "text-muted-foreground")}>
                    <CalendarIcon size={14} />
                    {dateTo ? format(dateTo, 'dd/MM/yy') : 'Hasta'}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar mode="single" selected={dateTo} onSelect={setDateTo} initialFocus className="p-3 pointer-events-auto" locale={es} />
                </PopoverContent>
              </Popover>

              {(dateFrom || dateTo) && (
                <Button variant="ghost" size="sm" onClick={() => { setDateFrom(undefined); setDateTo(undefined); }} className="text-xs text-muted-foreground h-8 px-2">
                  <X size={12} /> Limpiar
                </Button>
              )}

              <Badge variant="outline" className="text-xs ml-auto">{eligibleOrders.length} pedidos</Badge>
            </div>
            <div className="max-h-[400px] overflow-y-auto border rounded-lg">
              <Table>
                <TableHeader>
                   <TableRow>
                    <TableHead>Fecha</TableHead>
                    <TableHead>Folio</TableHead>
                    <TableHead>Cliente</TableHead>
                    <TableHead>Estatus</TableHead>
                    <TableHead className="text-right">Total</TableHead>
                    <TableHead>Fiscal</TableHead>
                    <TableHead></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {eligibleOrders.slice(0, 50).map(o => {
                    const cf = o.customer_id ? fiscalMap.get(o.customer_id) : null;
                    const hasFiscal = cf && cf.rfc && cf.legal_name;
                    return (
                      <TableRow key={o.id}>
                        <TableCell className="text-xs text-muted-foreground whitespace-nowrap">{new Date(o.created_at).toLocaleDateString('es-MX')}</TableCell>
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
                      <TableCell colSpan={7} className="text-center text-muted-foreground py-8">No hay pedidos disponibles</TableCell>
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
