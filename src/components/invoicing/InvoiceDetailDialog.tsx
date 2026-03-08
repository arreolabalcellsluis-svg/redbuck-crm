import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { FileText, Download, Ban, Stamp, AlertTriangle } from 'lucide-react';
import {
  type Invoice, useInvoiceItems, useStampInvoice, useCancelInvoice,
  useDownloadInvoiceFile, useUpdateInvoiceStatus, CANCELLATION_REASONS,
} from '@/hooks/useInvoicing';
import { useCustomers } from '@/hooks/useCustomers';

const fmt = (n: number) => new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN', maximumFractionDigits: 2 }).format(n);

const STATUS_MAP: Record<string, { label: string; color: string }> = {
  borrador: { label: 'Borrador', color: 'bg-muted text-muted-foreground' },
  lista_timbrar: { label: 'Lista para timbrar', color: 'bg-amber-100 text-amber-800' },
  timbrada: { label: 'Timbrada', color: 'bg-green-100 text-green-800' },
  cancelada: { label: 'Cancelada', color: 'bg-destructive/10 text-destructive' },
  error_timbrado: { label: 'Error', color: 'bg-destructive/10 text-destructive' },
};

interface Props {
  invoice: Invoice | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export default function InvoiceDetailDialog({ invoice, open, onOpenChange }: Props) {
  const { data: items } = useInvoiceItems(invoice?.id);
  const { data: customers } = useCustomers();
  const stampMutation = useStampInvoice();
  const cancelMutation = useCancelInvoice();
  const downloadMutation = useDownloadInvoiceFile();
  const updateStatusMutation = useUpdateInvoiceStatus();

  const [showCancel, setShowCancel] = useState(false);
  const [cancelReason, setCancelReason] = useState('02');
  const [substituteUuid, setSubstituteUuid] = useState('');

  if (!invoice) return null;

  const st = STATUS_MAP[invoice.status] ?? STATUS_MAP.borrador;
  const customer = customers?.find(c => c.id === invoice.customer_id);

  const handleMarkReady = () => {
    updateStatusMutation.mutate({ id: invoice.id, status: 'lista_timbrar' });
  };

  const handleStamp = () => {
    stampMutation.mutate(invoice.id);
  };

  const handleCancel = () => {
    cancelMutation.mutate({
      invoice_id: invoice.id,
      reason: cancelReason,
      substitute_uuid: cancelReason === '01' ? substituteUuid : undefined,
      canceled_by: 'admin',
    }, {
      onSuccess: () => setShowCancel(false),
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-3">
            <FileText size={18} />
            Factura {invoice.series}-{invoice.folio}
            <Badge className={`${st.color} text-xs ml-2`}>{st.label}</Badge>
          </DialogTitle>
          <DialogDescription>
            {invoice.uuid ? `UUID: ${invoice.uuid}` : 'Sin timbrar'}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Header info */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
            <div>
              <p className="text-muted-foreground">Cliente</p>
              <p className="font-medium">{customer?.name || '—'}</p>
            </div>
            <div>
              <p className="text-muted-foreground">Fecha</p>
              <p className="font-medium">{new Date(invoice.created_at).toLocaleDateString('es-MX')}</p>
            </div>
            <div>
              <p className="text-muted-foreground">Forma de Pago</p>
              <p className="font-medium">{invoice.payment_form}</p>
            </div>
            <div>
              <p className="text-muted-foreground">Método de Pago</p>
              <p className="font-medium">{invoice.payment_method}</p>
            </div>
          </div>

          {invoice.issued_at && (
            <div className="text-sm">
              <span className="text-muted-foreground">Timbrado: </span>
              <span>{new Date(invoice.issued_at).toLocaleString('es-MX')}</span>
            </div>
          )}

          {invoice.status === 'error_timbrado' && invoice.pac_response && (
            <div className="p-3 rounded-lg border border-destructive/30 bg-destructive/5 text-sm">
              <p className="font-medium text-destructive flex items-center gap-1"><AlertTriangle size={14} /> Error de timbrado</p>
              <pre className="mt-1 text-xs overflow-auto max-h-24 text-muted-foreground">
                {JSON.stringify(invoice.pac_response, null, 2)}
              </pre>
            </div>
          )}

          <Separator />

          {/* Items */}
          <Card>
            <CardHeader className="py-3">
              <CardTitle className="text-sm">Conceptos</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
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
                  {(items ?? []).map(it => (
                    <TableRow key={it.id}>
                      <TableCell className="max-w-[200px] truncate">{it.description}</TableCell>
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
          <div className="flex justify-end text-sm">
            <div className="space-y-1 text-right">
              <div>Subtotal: <span className="font-medium">{fmt(invoice.subtotal)}</span></div>
              <div>IVA: <span className="font-medium">{fmt(invoice.tax_amount)}</span></div>
              <div className="text-base font-bold">Total: {fmt(invoice.total)}</div>
            </div>
          </div>

          {/* Cancel dialog */}
          {showCancel && (
            <div className="p-4 rounded-lg border border-destructive/30 bg-destructive/5 space-y-3">
              <p className="font-medium text-destructive">Cancelar CFDI</p>
              <div className="space-y-1.5">
                <Label>Motivo de cancelación</Label>
                <select className="w-full h-10 rounded-md border border-input bg-background px-3 text-sm" value={cancelReason} onChange={e => setCancelReason(e.target.value)}>
                  {CANCELLATION_REASONS.map(r => <option key={r.code} value={r.code}>{r.label}</option>)}
                </select>
              </div>
              {cancelReason === '01' && (
                <div className="space-y-1.5">
                  <Label>UUID del CFDI sustituto</Label>
                  <Input value={substituteUuid} onChange={e => setSubstituteUuid(e.target.value)} placeholder="UUID sustituto" />
                </div>
              )}
              <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={() => setShowCancel(false)}>No cancelar</Button>
                <Button variant="destructive" size="sm" onClick={handleCancel} disabled={cancelMutation.isPending}>
                  {cancelMutation.isPending ? 'Cancelando...' : 'Confirmar cancelación'}
                </Button>
              </div>
            </div>
          )}
        </div>

        <DialogFooter className="flex-wrap gap-2">
          {/* Actions based on status */}
          {invoice.status === 'borrador' && (
            <Button variant="outline" onClick={handleMarkReady} disabled={updateStatusMutation.isPending}>
              Marcar lista para timbrar
            </Button>
          )}
          {['borrador', 'lista_timbrar', 'error_timbrado'].includes(invoice.status) && (
            <Button onClick={handleStamp} disabled={stampMutation.isPending} className="gap-1.5 bg-green-600 hover:bg-green-700">
              <Stamp size={14} />
              {stampMutation.isPending ? 'Timbrando...' : 'Timbrar Factura'}
            </Button>
          )}
          {invoice.status === 'timbrada' && (
            <>
              <Button variant="outline" className="gap-1.5" onClick={() => downloadMutation.mutate({ invoice_id: invoice.id, file_type: 'xml' })} disabled={downloadMutation.isPending}>
                <Download size={14} /> XML
              </Button>
              <Button variant="outline" className="gap-1.5" onClick={() => downloadMutation.mutate({ invoice_id: invoice.id, file_type: 'pdf' })} disabled={downloadMutation.isPending}>
                <Download size={14} /> PDF
              </Button>
              <Button variant="destructive" className="gap-1.5" onClick={() => setShowCancel(true)}>
                <Ban size={14} /> Cancelar CFDI
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
