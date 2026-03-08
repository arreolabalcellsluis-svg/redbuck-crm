import { useState, useEffect, useMemo } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';
import { Separator } from '@/components/ui/separator';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { FileText, Plus, Search, AlertTriangle, CalendarIcon, X, Stamp, CheckCircle, Save } from 'lucide-react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import { useOrders, type DBOrder } from '@/hooks/useOrders';
import { useAllCustomerFiscalData, useAllProductFiscalData, useFiscalSettings, useCreateInvoice, useInvoices, useStampInvoice, SAT_PAYMENT_FORMS, SAT_PAYMENT_METHODS, SAT_CFDI_USES } from '@/hooks/useInvoicing';
import { useCustomers } from '@/hooks/useCustomers';

const fmt = (n: number) => new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN', maximumFractionDigits: 2 }).format(n);

const DOCUMENT_TYPES = [
  { code: 'I', label: 'Factura' },
  { code: 'N', label: 'Recibo de Honorarios' },
  { code: 'E', label: 'Nota de Crédito' },
  { code: 'D', label: 'Nota de Devolución' },
] as const;


const RELATION_TYPES = [
  { code: '', label: 'Sin relación' },
  { code: '01', label: '01 — Nota de crédito de los documentos relacionados' },
  { code: '02', label: '02 — Nota de débito de los documentos relacionados' },
  { code: '03', label: '03 — Devolución de mercancía sobre facturas o traslados previos' },
  { code: '04', label: '04 — Sustitución de los CFDI previos' },
  { code: '05', label: '05 — Traslados de mercancías facturados previamente' },
  { code: '06', label: '06 — Factura generada por los traslados previos' },
  { code: '07', label: '07 — CFDI por aplicación de anticipos' },
  { code: '08', label: '08 — Factura generada por pagos en parcialidades' },
  { code: '09', label: '09 — Factura generada por pagos diferidos' },
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
  const { data: customers } = useCustomers();
  const createMutation = useCreateInvoice();
  const stampMutation = useStampInvoice();

  const [step, setStep] = useState<'select' | 'configure' | 'preview'>('select');
  const [savedInvoiceId, setSavedInvoiceId] = useState<string | null>(null);
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
  const [relationType, setRelationType] = useState('');
  const [relatedUuid, setRelatedUuid] = useState('');
  const [cfdiUse, setCfdiUse] = useState('G03');

  const fiscalMap = useMemo(() => new Map((customerFiscal ?? []).map(f => [f.customer_id, f])), [customerFiscal]);
  const prodFiscalMap = useMemo(() => new Map((productFiscal ?? []).map(f => [f.product_id, f])), [productFiscal]);

  // Auto-generate next folio number based on highest existing folio
  const nextFolio = useMemo(() => {
    const folios = (existingInvoices ?? []).map(inv => parseInt(inv.folio, 10)).filter(n => !isNaN(n));
    const maxFolio = folios.length > 0 ? Math.max(...folios) : 0;
    return String(maxFolio + 1).padStart(3, '0');
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
      setInvoiceType('I');
      setCurrency('MXN');
      setExchangeRate(1);
      setConditions('');
      setNotes('');
      setRelationType('');
      setRelatedUuid('');
      setSavedInvoiceId(null);
      setCfdiUse(customerFiscalData?.cfdi_use_default || 'G03');

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
    const taxObject = pf?.tax_object ?? '02';
    const vatRate = (taxObject === '01' || taxObject === '04') ? 0 : (pf?.vat_rate ?? 16);
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
        invoice_type: invoiceType,
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
      onSuccess: (invoiceId) => {
        setSavedInvoiceId(invoiceId);
        setStep('preview');
      },
    });
  };

  const handleStampFromPreview = () => {
    if (!savedInvoiceId) return;
    stampMutation.mutate(savedInvoiceId, {
      onSuccess: () => onOpenChange(false),
    });
  };

  const customerName = selectedOrder?.customer_name || customers?.find(c => c.id === selectedOrder?.customer_id)?.name || '—';
  const docTypeLabel = DOCUMENT_TYPES.find(t => t.code === invoiceType)?.label || 'Factura';

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileText size={18} />
            {step === 'select' ? 'Seleccionar Pedido para Facturar' : step === 'configure' ? `Configurar ${docTypeLabel}` : `Vista Previa — ${docTypeLabel}`}
          </DialogTitle>
          <DialogDescription>
            {step === 'select'
              ? 'Selecciona el pedido del cual generar la factura'
              : step === 'configure'
                ? `Pedido ${selectedOrder?.folio} — ${customerName}`
                : `Borrador ${series}-${folio} guardado correctamente`
            }
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

            {/* Document type + Relation */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label>Tipo de documento</Label>
                <select className="w-full h-10 rounded-md border border-input bg-background px-3 text-sm" value={invoiceType} onChange={e => setInvoiceType(e.target.value as any)}>
                  {DOCUMENT_TYPES.map(t => <option key={t.code} value={t.code}>{t.label}</option>)}
                </select>
              </div>
              <div className="space-y-1.5">
                <Label>Tipo de relación</Label>
                <select className="w-full h-10 rounded-md border border-input bg-background px-3 text-sm" value={relationType} onChange={e => setRelationType(e.target.value)}>
                  {RELATION_TYPES.map(r => <option key={r.code} value={r.code}>{r.label}</option>)}
                </select>
              </div>
            </div>

            {relationType && (
              <div className="space-y-1.5">
                <Label>UUID del CFDI relacionado</Label>
                <Input value={relatedUuid} onChange={e => setRelatedUuid(e.target.value.trim())} placeholder="XXXXXXXX-XXXX-XXXX-XXXX-XXXXXXXXXXXX" />
                <p className="text-[10px] text-muted-foreground">UUID (folio fiscal) del documento relacionado</p>
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

        {/* ===================== PREVIEW STEP ===================== */}
        {step === 'preview' && selectedOrder && (
          <div className="space-y-6">
            <div className="flex items-center gap-3 p-4 rounded-lg border border-green-200 bg-green-50">
              <CheckCircle size={20} className="text-green-600 shrink-0" />
              <div>
                <p className="font-medium text-green-800">Borrador guardado exitosamente</p>
                <p className="text-sm text-green-700">Puedes facturar ahora o encontrarlo después en la pestaña de Facturas.</p>
              </div>
            </div>

            {/* Invoice preview card */}
            <div className="border rounded-lg p-5 space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="font-bold text-lg">{docTypeLabel}</h3>
                  <p className="text-sm text-muted-foreground">Serie {series} — Folio {folio}</p>
                </div>
                <Badge className="bg-muted text-muted-foreground text-xs">Borrador</Badge>
              </div>

              <Separator />

              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                <div>
                  <p className="text-muted-foreground text-xs">Cliente</p>
                  <p className="font-medium">{customerName}</p>
                </div>
                <div>
                  <p className="text-muted-foreground text-xs">Pedido</p>
                  <p className="font-medium">{selectedOrder.folio}</p>
                </div>
                <div>
                  <p className="text-muted-foreground text-xs">Forma de Pago</p>
                  <p className="font-medium">{SAT_PAYMENT_FORMS.find(f => f.code === paymentForm)?.label || paymentForm}</p>
                </div>
                <div>
                  <p className="text-muted-foreground text-xs">Método de Pago</p>
                  <p className="font-medium">{SAT_PAYMENT_METHODS.find(m => m.code === paymentMethod)?.label || paymentMethod}</p>
                </div>
              </div>

              <Separator />

              {/* Items table */}
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Descripción</TableHead>
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
                      <TableCell className="max-w-[200px] truncate">{it.description || '—'}</TableCell>
                      <TableCell className="text-right">{it.qty}</TableCell>
                      <TableCell className="text-right">{fmt(it.unit_price)}</TableCell>
                      <TableCell className="text-right">{fmt(it.subtotal)}</TableCell>
                      <TableCell className="text-right">{fmt(it.tax_amount)}</TableCell>
                      <TableCell className="text-right font-medium">{fmt(it.total)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>

              {/* Totals */}
              <div className="flex justify-end">
                <div className="space-y-1 text-right text-sm">
                  <div>Subtotal: <span className="font-medium">{fmt(subtotal)}</span></div>
                  <div>IVA: <span className="font-medium">{fmt(taxTotal)}</span></div>
                  <div className="text-lg font-bold border-t pt-1 mt-1">Total: {fmt(total)}</div>
                </div>
              </div>

              {notes && (
                <div className="text-sm">
                  <span className="text-muted-foreground">Observaciones: </span>{notes}
                </div>
              )}
            </div>
          </div>
        )}

        <DialogFooter className="gap-2 flex-wrap">
          {step === 'configure' && (
            <Button variant="outline" onClick={() => setStep('select')}>← Cambiar pedido</Button>
          )}
          {step !== 'preview' && (
            <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          )}
          {step === 'configure' && (
            <Button onClick={handleCreate} disabled={createMutation.isPending} className="gap-1.5">
              <Plus size={14} />
              {createMutation.isPending ? 'Guardando...' : `Crear ${docTypeLabel} (Borrador)`}
            </Button>
          )}
          {step === 'preview' && (
            <>
              <Button variant="outline" onClick={() => onOpenChange(false)} className="gap-1.5">
                <Save size={14} /> Guardar como borrador
              </Button>
              <Button onClick={handleStampFromPreview} disabled={stampMutation.isPending} className="gap-1.5 bg-green-600 hover:bg-green-700">
                <Stamp size={14} />
                {stampMutation.isPending ? 'Timbrando...' : `Facturar ahora`}
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
