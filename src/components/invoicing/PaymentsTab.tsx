import { useState, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Search, Plus, DollarSign, FileText, CreditCard, AlertTriangle, Download, FileCode, Loader2 } from 'lucide-react';
import { format } from 'date-fns';
import { toast } from 'sonner';
import { usePayments, useCreatePayment, useGenerateComplement, useDownloadComplementFile, type Payment } from '@/hooks/usePayments';
import { useInvoices, SAT_PAYMENT_FORMS, type Invoice } from '@/hooks/useInvoicing';
import { useCustomers } from '@/hooks/useCustomers';

const fmt = (n: number) => new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN', maximumFractionDigits: 2 }).format(n);

const COMPLEMENT_STATUS_MAP: Record<string, { label: string; color: string }> = {
  pendiente: { label: 'Pendiente', color: 'bg-amber-100 text-amber-800' },
  generado: { label: 'Generado', color: 'bg-green-100 text-green-800' },
  error: { label: 'Error', color: 'bg-destructive/10 text-destructive' },
};

const PAYMENT_STATUS_MAP: Record<string, { label: string; color: string }> = {
  pendiente: { label: 'Pendiente', color: 'bg-amber-100 text-amber-800' },
  parcial: { label: 'Parcial', color: 'bg-blue-100 text-blue-800' },
  pagada: { label: 'Pagada', color: 'bg-green-100 text-green-800' },
};

export default function PaymentsTab() {
  const { data: payments, isLoading: loadingPayments } = usePayments();
  const { data: invoices, isLoading: loadingInvoices } = useInvoices();
  const { data: customers } = useCustomers();
  const createPayment = useCreatePayment();
  const generateComplement = useGenerateComplement();
  const downloadComplementFile = useDownloadComplementFile();

  const [search, setSearch] = useState('');
  const [showRegister, setShowRegister] = useState(false);
  const [selectedInvoiceId, setSelectedInvoiceId] = useState('');
  const [paymentForm, setPaymentForm] = useState('03');
  const [paymentAmount, setPaymentAmount] = useState('');
  const [paymentDate, setPaymentDate] = useState(new Date().toISOString().slice(0, 10));
  const [paymentRef, setPaymentRef] = useState('');
  const [paymentBank, setPaymentBank] = useState('');
  const [paymentNotes, setPaymentNotes] = useState('');

  const customerMap = useMemo(() => new Map((customers ?? []).map(c => [c.id, c])), [customers]);

  // Calculate paid amounts per invoice from payments
  const paidPerInvoice = useMemo(() => {
    const map = new Map<string, number>();
    for (const p of payments ?? []) {
      map.set(p.invoice_id, (map.get(p.invoice_id) ?? 0) + p.amount);
    }
    return map;
  }, [payments]);

  // Invoices with pending balance (not cancelled, total > paid)
  const payableInvoices = useMemo(() => {
    return (invoices ?? []).filter(inv => {
      if (inv.status === 'cancelada') return false;
      const paid = paidPerInvoice.get(inv.id) ?? 0;
      return inv.total - paid > 0.01;
    });
  }, [invoices, paidPerInvoice]);

  const selectedInvoice = invoices?.find(i => i.id === selectedInvoiceId);
  const selectedPaid = selectedInvoiceId ? (paidPerInvoice.get(selectedInvoiceId) ?? 0) : 0;
  const selectedBalance = selectedInvoice ? selectedInvoice.total - selectedPaid : 0;

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return (payments ?? []).filter(p => {
      const inv = invoices?.find(i => i.id === p.invoice_id);
      const cust = p.customer_id ? customerMap.get(p.customer_id) : null;
      return !q ||
        (inv?.folio ?? '').toLowerCase().includes(q) ||
        (inv?.uuid ?? '').toLowerCase().includes(q) ||
        (cust?.name ?? '').toLowerCase().includes(q);
    });
  }, [payments, search, invoices, customerMap]);

  const openRegister = () => {
    setSelectedInvoiceId('');
    setPaymentForm('03');
    setPaymentAmount('');
    setPaymentDate(new Date().toISOString().slice(0, 10));
    setPaymentRef('');
    setPaymentBank('');
    setPaymentNotes('');
    setShowRegister(true);
  };

  const handleRegister = () => {
    if (!selectedInvoiceId) { toast.error('Selecciona una factura'); return; }
    const amount = parseFloat(paymentAmount);
    if (isNaN(amount) || amount <= 0) { toast.error('Monto inválido'); return; }
    if (amount > selectedBalance + 0.01) { toast.error(`El monto no puede ser mayor al saldo pendiente (${fmt(selectedBalance)})`); return; }
    if (!paymentDate) { toast.error('Fecha requerida'); return; }

    const remaining = Math.max(0, selectedBalance - amount);

    createPayment.mutate({
      invoice_id: selectedInvoiceId,
      customer_id: selectedInvoice?.customer_id ?? null,
      amount,
      previous_balance: selectedBalance,
      remaining_balance: remaining,
      payment_date: paymentDate,
      payment_form: paymentForm,
      currency: selectedInvoice?.currency ?? 'MXN',
      exchange_rate: selectedInvoice?.exchange_rate ?? 1,
      operation_reference: paymentRef,
      bank: paymentBank,
      notes: paymentNotes,
    }, {
      onSuccess: () => setShowRegister(false),
    });
  };

  // Summary KPIs
  const totalPaid = (payments ?? []).reduce((s, p) => s + p.amount, 0);
  const totalPending = (invoices ?? [])
    .filter(i => i.status !== 'cancelada')
    .reduce((s, i) => s + Math.max(0, i.total - (paidPerInvoice.get(i.id) ?? 0)), 0);

  if (loadingPayments || loadingInvoices) return <div className="py-8 text-center text-muted-foreground">Cargando pagos...</div>;

  return (
    <div className="mt-4 space-y-4">
      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-4 pb-3 text-center">
            <p className="text-xs text-muted-foreground uppercase">Pagos Registrados</p>
            <p className="text-2xl font-bold">{(payments ?? []).length}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-3 text-center">
            <p className="text-xs text-muted-foreground uppercase">Total Cobrado</p>
            <p className="text-2xl font-bold text-green-600">{fmt(totalPaid)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-3 text-center">
            <p className="text-xs text-muted-foreground uppercase">Saldo Pendiente</p>
            <p className="text-2xl font-bold text-amber-600">{fmt(totalPending)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-3 text-center">
            <p className="text-xs text-muted-foreground uppercase">Fact. con Saldo</p>
            <p className="text-2xl font-bold">{payableInvoices.length}</p>
          </CardContent>
        </Card>
      </div>

      {/* Controls */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" size={16} />
          <Input placeholder="Buscar por folio, UUID o cliente..." value={search} onChange={e => setSearch(e.target.value)} className="pl-9" />
        </div>
        <Badge variant="outline">{filtered.length} pagos</Badge>
        <Button onClick={openRegister} className="gap-1.5 ml-auto">
          <Plus size={14} /> Registrar Pago
        </Button>
      </div>

      {/* Payments Table */}
      {filtered.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <CreditCard className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
            <p className="text-muted-foreground">No hay pagos registrados aún</p>
            <p className="text-xs text-muted-foreground mt-1">Haz clic en "Registrar Pago" para comenzar</p>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Fecha</TableHead>
                <TableHead>Cliente</TableHead>
                <TableHead>Factura</TableHead>
                <TableHead>UUID Factura</TableHead>
                <TableHead className="text-right">Saldo Anterior</TableHead>
                <TableHead className="text-right">Monto Pagado</TableHead>
                <TableHead className="text-right">Saldo Restante</TableHead>
                <TableHead>Forma Pago</TableHead>
                <TableHead>Complemento</TableHead>
                <TableHead>UUID Complemento</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map(p => {
                const inv = invoices?.find(i => i.id === p.invoice_id);
                const cust = p.customer_id ? customerMap.get(p.customer_id) : null;
                const compSt = COMPLEMENT_STATUS_MAP[p.complement_status] ?? COMPLEMENT_STATUS_MAP.pendiente;
                const payFormLabel = SAT_PAYMENT_FORMS.find(f => f.code === p.payment_form)?.label ?? p.payment_form;
                return (
                  <TableRow key={p.id}>
                    <TableCell className="text-sm">{new Date(p.payment_date).toLocaleDateString('es-MX')}</TableCell>
                    <TableCell>{cust?.name ?? '—'}</TableCell>
                    <TableCell className="font-mono text-sm">{inv ? `${inv.series}-${inv.folio}` : '—'}</TableCell>
                    <TableCell className="font-mono text-xs max-w-[100px] truncate">{inv?.uuid || '—'}</TableCell>
                    <TableCell className="text-right">{fmt(p.previous_balance)}</TableCell>
                    <TableCell className="text-right font-medium text-green-700">{fmt(p.amount)}</TableCell>
                    <TableCell className="text-right">{fmt(p.remaining_balance)}</TableCell>
                    <TableCell className="text-xs">{payFormLabel}</TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1.5">
                        <Badge className={`${compSt.color} text-xs`}>{compSt.label}</Badge>
                        {p.complement_status === 'pendiente' && inv?.uuid && (
                          <Button
                            size="sm"
                            variant="outline"
                            className="h-6 text-xs gap-1"
                            disabled={generateComplement.isPending}
                            onClick={() => generateComplement.mutate(p.id)}
                          >
                            {generateComplement.isPending ? <Loader2 size={12} className="animate-spin" /> : <FileText size={12} />}
                            Generar
                          </Button>
                        )}
                        {p.complement_status === 'pendiente' && !inv?.uuid && (
                          <span className="text-xs text-muted-foreground">Sin UUID</span>
                        )}
                        {p.complement_status === 'generado' && (
                          <>
                            <Button size="icon" variant="ghost" className="h-6 w-6" title="Descargar XML" onClick={() => downloadComplementFile.mutate({ payment_id: p.id, file_type: 'xml' })}>
                              <FileCode size={12} />
                            </Button>
                            <Button size="icon" variant="ghost" className="h-6 w-6" title="Descargar PDF" onClick={() => downloadComplementFile.mutate({ payment_id: p.id, file_type: 'pdf' })}>
                              <Download size={12} />
                            </Button>
                          </>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </Card>
      )}

      {/* Register Payment Dialog */}
      <Dialog open={showRegister} onOpenChange={setShowRegister}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2"><DollarSign size={18} /> Registrar Pago</DialogTitle>
            <DialogDescription>Selecciona la factura y registra el pago del cliente</DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            {/* Invoice selector */}
            <div className="space-y-1.5">
              <Label>Factura con saldo pendiente *</Label>
              <select
                className="w-full h-10 rounded-md border border-input bg-background px-3 text-sm"
                value={selectedInvoiceId}
                onChange={e => setSelectedInvoiceId(e.target.value)}
              >
                <option value="">Seleccionar factura...</option>
                {payableInvoices.map(inv => {
                  const cust = inv.customer_id ? customerMap.get(inv.customer_id) : null;
                  const balance = inv.total - (paidPerInvoice.get(inv.id) ?? 0);
                  return (
                    <option key={inv.id} value={inv.id}>
                      {inv.series}-{inv.folio} | {cust?.name ?? '—'} | Saldo: {fmt(balance)}
                    </option>
                  );
                })}
              </select>
            </div>

            {/* Invoice summary */}
            {selectedInvoice && (
              <div className="p-3 rounded-lg border bg-muted/30 space-y-1 text-sm">
                <div className="flex justify-between"><span className="text-muted-foreground">Cliente:</span><span className="font-medium">{customerMap.get(selectedInvoice.customer_id ?? '')?.name ?? '—'}</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">UUID:</span><span className="font-mono text-xs">{selectedInvoice.uuid || 'Sin UUID'}</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">Total factura:</span><span className="font-medium">{fmt(selectedInvoice.total)}</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">Ya pagado:</span><span>{fmt(selectedPaid)}</span></div>
                <div className="flex justify-between font-medium"><span className="text-amber-700">Saldo pendiente:</span><span className="text-amber-700">{fmt(selectedBalance)}</span></div>
              </div>
            )}

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label>Monto a pagar *</Label>
                <Input
                  type="number"
                  step="0.01"
                  min="0.01"
                  max={selectedBalance}
                  value={paymentAmount}
                  onChange={e => setPaymentAmount(e.target.value)}
                  placeholder="0.00"
                />
              </div>
              <div className="space-y-1.5">
                <Label>Fecha de pago *</Label>
                <Input type="date" value={paymentDate} onChange={e => setPaymentDate(e.target.value)} />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label>Forma de pago SAT *</Label>
              <select
                className="w-full h-10 rounded-md border border-input bg-background px-3 text-sm"
                value={paymentForm}
                onChange={e => setPaymentForm(e.target.value)}
              >
                {SAT_PAYMENT_FORMS.map(f => (
                  <option key={f.code} value={f.code}>{f.label}</option>
                ))}
              </select>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label>Referencia de operación</Label>
                <Input value={paymentRef} onChange={e => setPaymentRef(e.target.value)} placeholder="Núm. transferencia, cheque..." />
              </div>
              <div className="space-y-1.5">
                <Label>Banco</Label>
                <Input value={paymentBank} onChange={e => setPaymentBank(e.target.value)} placeholder="Banco del pago" />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label>Observaciones</Label>
              <Input value={paymentNotes} onChange={e => setPaymentNotes(e.target.value)} placeholder="Notas adicionales" />
            </div>

            {/* Remaining balance preview */}
            {selectedInvoice && paymentAmount && !isNaN(parseFloat(paymentAmount)) && (
              <div className="p-3 rounded-lg border bg-green-50 dark:bg-green-950/20 flex items-center gap-3">
                <AlertTriangle size={16} className="text-green-600" />
                <div className="text-sm">
                  <span className="text-muted-foreground">Saldo después del pago: </span>
                  <span className="font-bold text-green-700">
                    {fmt(Math.max(0, selectedBalance - parseFloat(paymentAmount)))}
                  </span>
                  {selectedBalance - parseFloat(paymentAmount) <= 0.01 && (
                    <Badge className="ml-2 bg-green-100 text-green-800 text-xs">Factura liquidada</Badge>
                  )}
                </div>
              </div>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowRegister(false)}>Cancelar</Button>
            <Button onClick={handleRegister} disabled={createPayment.isPending} className="gap-1.5">
              <DollarSign size={14} />
              {createPayment.isPending ? 'Registrando...' : 'Registrar Pago'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
