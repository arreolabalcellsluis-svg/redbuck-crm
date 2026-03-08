import { useState, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { Search, Ban, AlertTriangle, XCircle, FileText, Loader2, ShieldAlert } from 'lucide-react';
import { useInvoices, type Invoice, CANCELLATION_REASONS } from '@/hooks/useInvoicing';
import { useInvoiceCancellations, useCancelInvoiceInternal, useCancelInvoiceSAT } from '@/hooks/useInvoiceCancellations';
import { useCustomers } from '@/hooks/useCustomers';
import { toast } from 'sonner';

const fmt = (n: number) => new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN', maximumFractionDigits: 2 }).format(n);

const REASON_LABELS: Record<string, string> = {
  '01': '01 - Con relación',
  '02': '02 - Sin relación',
  '03': '03 - No se realizó',
  '04': '04 - Factura global',
};

export default function CancellationsTab() {
  const { data: invoices, isLoading: loadingInv } = useInvoices();
  const { data: cancellations, isLoading: loadingCanc } = useInvoiceCancellations();
  const { data: customers } = useCustomers();
  const cancelInternalMut = useCancelInvoiceInternal();
  const cancelSATMut = useCancelInvoiceSAT();

  const [search, setSearch] = useState('');
  const [showInternalDialog, setShowInternalDialog] = useState(false);
  const [showSATDialog, setShowSATDialog] = useState(false);
  const [selectedInvoice, setSelectedInvoice] = useState<Invoice | null>(null);
  const [cancelReason, setCancelReason] = useState('02');
  const [substituteUuid, setSubstituteUuid] = useState('');
  const [internalNotes, setInternalNotes] = useState('');

  const invoiceMap = useMemo(() => new Map((invoices ?? []).map(i => [i.id, i])), [invoices]);
  const customerMap = useMemo(() => new Map((customers ?? []).map(c => [c.id, c])), [customers]);

  // Invoices eligible for cancellation (timbrada or lista_timbrar or borrador)
  const cancellableInvoices = useMemo(() =>
    (invoices ?? []).filter(i => ['timbrada', 'lista_timbrar', 'borrador'].includes(i.status)),
    [invoices]
  );

  const cancelledInvoices = useMemo(() =>
    (invoices ?? []).filter(i => i.status === 'cancelada'),
    [invoices]
  );

  // Cancellation history enriched
  const history = useMemo(() => {
    return (cancellations ?? []).map(c => {
      const inv = invoiceMap.get(c.invoice_id);
      const cust = inv?.customer_id ? customerMap.get(inv.customer_id) : null;
      return { ...c, invoice: inv, customer: cust };
    });
  }, [cancellations, invoiceMap, customerMap]);

  const filteredHistory = useMemo(() => {
    if (!search) return history;
    const s = search.toLowerCase();
    return history.filter(h =>
      (h.invoice?.folio ?? '').toLowerCase().includes(s) ||
      (h.invoice?.uuid ?? '').toLowerCase().includes(s) ||
      (h.customer?.name ?? '').toLowerCase().includes(s) ||
      h.canceled_by.toLowerCase().includes(s)
    );
  }, [history, search]);

  const openInternalCancel = (inv: Invoice) => {
    setSelectedInvoice(inv);
    setCancelReason('02');
    setInternalNotes('');
    setShowInternalDialog(true);
  };

  const openSATCancel = (inv: Invoice) => {
    if (!inv.uuid) {
      toast.error('Esta factura no tiene UUID (no ha sido timbrada)');
      return;
    }
    setSelectedInvoice(inv);
    setCancelReason('02');
    setSubstituteUuid('');
    setShowSATDialog(true);
  };

  const handleInternalCancel = () => {
    if (!selectedInvoice) return;
    cancelInternalMut.mutate({
      invoice_id: selectedInvoice.id,
      reason: cancelReason,
      notes: internalNotes,
    }, {
      onSuccess: () => setShowInternalDialog(false),
    });
  };

  const handleSATCancel = () => {
    if (!selectedInvoice) return;
    if (cancelReason === '01' && !substituteUuid.trim()) {
      toast.error('El UUID sustituto es requerido para motivo 01');
      return;
    }
    cancelSATMut.mutate({
      invoice_id: selectedInvoice.id,
      reason: cancelReason,
      substitute_uuid: cancelReason === '01' ? substituteUuid : undefined,
    }, {
      onSuccess: () => setShowSATDialog(false),
    });
  };

  if (loadingInv || loadingCanc) return <div className="py-8 text-center text-muted-foreground">Cargando...</div>;

  return (
    <div className="space-y-6 mt-4">
      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-4 pb-3 text-center">
            <p className="text-2xl font-bold text-destructive">{cancelledInvoices.length}</p>
            <p className="text-xs text-muted-foreground">Facturas canceladas</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-3 text-center">
            <p className="text-2xl font-bold">{cancellableInvoices.filter(i => i.status === 'timbrada').length}</p>
            <p className="text-xs text-muted-foreground">Timbradas (cancelables SAT)</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-3 text-center">
            <p className="text-2xl font-bold">{fmt(cancelledInvoices.reduce((s, i) => s + i.total, 0))}</p>
            <p className="text-xs text-muted-foreground">Monto cancelado</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-3 text-center">
            <p className="text-2xl font-bold">{(cancellations ?? []).length}</p>
            <p className="text-xs text-muted-foreground">Registros cancelación</p>
          </CardContent>
        </Card>
      </div>

      {/* Cancellable invoices */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2"><ShieldAlert size={18} /> Facturas disponibles para cancelar</CardTitle>
        </CardHeader>
        <CardContent>
          {cancellableInvoices.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-4">No hay facturas pendientes de cancelar</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Folio</TableHead>
                  <TableHead>Cliente</TableHead>
                  <TableHead>UUID</TableHead>
                  <TableHead className="text-right">Total</TableHead>
                  <TableHead>Estado</TableHead>
                  <TableHead>Pago</TableHead>
                  <TableHead className="text-right">Acciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {cancellableInvoices.map(inv => {
                  const cust = inv.customer_id ? customerMap.get(inv.customer_id) : null;
                  return (
                    <TableRow key={inv.id}>
                      <TableCell className="font-medium">{inv.series}-{inv.folio}</TableCell>
                      <TableCell>{cust?.name ?? '—'}</TableCell>
                      <TableCell className="text-xs font-mono max-w-[120px] truncate">{inv.uuid || '—'}</TableCell>
                      <TableCell className="text-right">{fmt(inv.total)}</TableCell>
                      <TableCell>
                        <Badge variant="outline" className="text-xs">
                          {inv.status === 'timbrada' ? 'Timbrada' : inv.status === 'lista_timbrar' ? 'Lista' : 'Borrador'}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className="text-xs">
                          {inv.payment_status === 'pagada' ? 'Pagada' : inv.payment_status === 'parcial' ? 'Parcial' : 'Pendiente'}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex gap-1 justify-end">
                          <Button size="sm" variant="outline" className="gap-1 text-xs" onClick={() => openInternalCancel(inv)}>
                            <Ban size={12} /> Interna
                          </Button>
                          {inv.status === 'timbrada' && inv.uuid && (
                            <Button size="sm" variant="destructive" className="gap-1 text-xs" onClick={() => openSATCancel(inv)}>
                              <AlertTriangle size={12} /> SAT
                            </Button>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Cancellation History */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-lg flex items-center gap-2"><XCircle size={18} /> Historial de cancelaciones</CardTitle>
          <div className="relative w-64">
            <Search size={14} className="absolute left-2.5 top-2.5 text-muted-foreground" />
            <Input placeholder="Buscar..." value={search} onChange={e => setSearch(e.target.value)} className="pl-8 h-9" />
          </div>
        </CardHeader>
        <CardContent>
          {filteredHistory.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-4">Sin registros de cancelación</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Factura</TableHead>
                  <TableHead>Cliente</TableHead>
                  <TableHead>UUID Factura</TableHead>
                  <TableHead>Motivo</TableHead>
                  <TableHead>UUID Sustituto</TableHead>
                  <TableHead>Cancelado por</TableHead>
                  <TableHead>Fecha</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredHistory.map(h => (
                  <TableRow key={h.id}>
                    <TableCell className="font-medium">{h.invoice ? `${h.invoice.series}-${h.invoice.folio}` : '—'}</TableCell>
                    <TableCell>{h.customer?.name ?? '—'}</TableCell>
                    <TableCell className="text-xs font-mono max-w-[120px] truncate">{h.invoice?.uuid || '—'}</TableCell>
                    <TableCell><Badge variant="outline" className="text-xs">{REASON_LABELS[h.cancellation_reason] ?? h.cancellation_reason}</Badge></TableCell>
                    <TableCell className="text-xs font-mono">{h.substitute_uuid || '—'}</TableCell>
                    <TableCell className="text-xs">{h.canceled_by}</TableCell>
                    <TableCell className="text-xs">{new Date(h.canceled_at).toLocaleString('es-MX')}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Internal Cancel Dialog */}
      <Dialog open={showInternalDialog} onOpenChange={setShowInternalDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2"><Ban size={18} /> Cancelar factura (interna)</DialogTitle>
            <DialogDescription>
              Esta cancelación es solo interna. No se notificará al SAT.
              {selectedInvoice && ` Factura: ${selectedInvoice.series}-${selectedInvoice.folio}`}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label>Motivo de cancelación</Label>
              <select className="w-full h-10 rounded-md border border-input bg-background px-3 text-sm" value={cancelReason} onChange={e => setCancelReason(e.target.value)}>
                {CANCELLATION_REASONS.map(r => <option key={r.code} value={r.code}>{r.label}</option>)}
              </select>
            </div>
            <div className="space-y-1.5">
              <Label>Observaciones</Label>
              <Textarea value={internalNotes} onChange={e => setInternalNotes(e.target.value)} placeholder="Motivo detallado de la cancelación interna..." rows={3} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowInternalDialog(false)}>Cancelar</Button>
            <Button variant="destructive" onClick={handleInternalCancel} disabled={cancelInternalMut.isPending} className="gap-1.5">
              {cancelInternalMut.isPending ? <Loader2 size={14} className="animate-spin" /> : <Ban size={14} />}
              {cancelInternalMut.isPending ? 'Cancelando...' : 'Confirmar cancelación'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* SAT Cancel Dialog */}
      <Dialog open={showSATDialog} onOpenChange={setShowSATDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-destructive"><AlertTriangle size={18} /> Cancelar factura ante SAT</DialogTitle>
            <DialogDescription>
              Esta acción enviará la solicitud de cancelación al SAT vía Facturama.
              {selectedInvoice && ` Factura: ${selectedInvoice.series}-${selectedInvoice.folio} — UUID: ${selectedInvoice.uuid}`}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="p-3 rounded-lg border border-destructive/30 bg-destructive/5 text-sm">
              <p className="font-medium text-destructive">⚠️ Acción irreversible</p>
              <p className="text-muted-foreground mt-1">La cancelación ante el SAT no se puede deshacer. Asegúrate de que el motivo sea correcto.</p>
            </div>
            <div className="space-y-1.5">
              <Label>Motivo de cancelación SAT</Label>
              <select className="w-full h-10 rounded-md border border-input bg-background px-3 text-sm" value={cancelReason} onChange={e => setCancelReason(e.target.value)}>
                {CANCELLATION_REASONS.map(r => <option key={r.code} value={r.code}>{r.label}</option>)}
              </select>
            </div>
            {cancelReason === '01' && (
              <div className="space-y-1.5">
                <Label>UUID del CFDI sustituto *</Label>
                <Input value={substituteUuid} onChange={e => setSubstituteUuid(e.target.value)} placeholder="Ingresa el UUID del CFDI que sustituye" />
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowSATDialog(false)}>Cancelar</Button>
            <Button variant="destructive" onClick={handleSATCancel} disabled={cancelSATMut.isPending} className="gap-1.5">
              {cancelSATMut.isPending ? <Loader2 size={14} className="animate-spin" /> : <AlertTriangle size={14} />}
              {cancelSATMut.isPending ? 'Enviando al SAT...' : 'Cancelar ante SAT'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
