import { useMemo, useState } from 'react';
import { useInvoices, type Invoice } from '@/hooks/useInvoicing';
import { usePayments, type Payment } from '@/hooks/usePayments';
import { useCustomers } from '@/hooks/useCustomers';
import StatusBadge from '@/components/shared/StatusBadge';
import MetricCard from '@/components/shared/MetricCard';
import { CreditCard, AlertTriangle, CheckCircle, Clock, FileSpreadsheet, History, Download } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { toast } from 'sonner';
import * as XLSX from 'xlsx';
import { addAuditLog } from '@/lib/auditLog';

const fmt = (n: number) => new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN', maximumFractionDigits: 2 }).format(n);

interface ReceivableRow {
  invoiceId: string;
  customerId: string | null;
  customerName: string;
  folio: string;
  total: number;
  paid: number;
  balance: number;
  dueDate: string;
  daysOverdue: number;
  status: 'al_corriente' | 'vencido' | 'liquidado';
}

export default function ReceivablesPage() {
  const { data: invoices, isLoading: loadingInv } = useInvoices();
  const { data: payments, isLoading: loadingPay } = usePayments();
  const { data: customers } = useCustomers();

  const customerMap = useMemo(() => new Map((customers ?? []).map(c => [c.id, c])), [customers]);

  // Calculate paid per invoice
  const paidPerInvoice = useMemo(() => {
    const map = new Map<string, number>();
    for (const p of payments ?? []) {
      map.set(p.invoice_id, (map.get(p.invoice_id) ?? 0) + p.amount);
    }
    return map;
  }, [payments]);

  // Build receivables from invoices (exclude cancelled, only timbradas or lista_timbrar with balance)
  const receivables: ReceivableRow[] = useMemo(() => {
    const today = new Date();
    return (invoices ?? [])
      .filter(inv => inv.status !== 'cancelada' && inv.status !== 'borrador')
      .map(inv => {
        const paid = paidPerInvoice.get(inv.id) ?? 0;
        const balance = Math.max(0, inv.total - paid);
        // Estimate due date: issued_at + 30 days or created_at + 30 days
        const baseDate = inv.issued_at ? new Date(inv.issued_at) : new Date(inv.created_at);
        const dueDate = new Date(baseDate);
        dueDate.setDate(dueDate.getDate() + 30);
        const dueDateStr = dueDate.toISOString().slice(0, 10);
        const daysOverdue = balance > 0.01 ? Math.max(0, Math.floor((today.getTime() - dueDate.getTime()) / 86400000)) : 0;
        const status: ReceivableRow['status'] = balance <= 0.01 ? 'liquidado' : daysOverdue > 0 ? 'vencido' : 'al_corriente';
        const cust = inv.customer_id ? customerMap.get(inv.customer_id) : null;
        return {
          invoiceId: inv.id,
          customerId: inv.customer_id,
          customerName: cust?.name ?? 'Sin cliente',
          folio: `${inv.series}-${inv.folio}`,
          total: inv.total,
          paid,
          balance,
          dueDate: dueDateStr,
          daysOverdue,
          status,
        };
      })
      .filter(r => r.balance > 0.01); // Only show pending
  }, [invoices, paidPerInvoice, customerMap]);

  const totalBalance = receivables.reduce((s, r) => s + r.balance, 0);
  const overdue = receivables.filter(r => r.status === 'vencido');
  const overdueAmount = overdue.reduce((s, r) => s + r.balance, 0);

  // Customer statement
  const [selectedCustomerId, setSelectedCustomerId] = useState<string | null>(null);
  const [showBulkDownload, setShowBulkDownload] = useState(false);
  const [bulkDateFrom, setBulkDateFrom] = useState('');
  const [bulkDateTo, setBulkDateTo] = useState('');

  const customerName = selectedCustomerId ? (customerMap.get(selectedCustomerId)?.name ?? '') : '';

  const customerReceivables = useMemo(() =>
    receivables.filter(r => r.customerId === selectedCustomerId),
    [receivables, selectedCustomerId]
  );

  const customerPayments = useMemo(() =>
    (payments ?? []).filter(p => p.customer_id === selectedCustomerId),
    [payments, selectedCustomerId]
  );

  const customerInvoices = useMemo(() =>
    (invoices ?? []).filter(i => i.customer_id === selectedCustomerId && i.status !== 'cancelada'),
    [invoices, selectedCustomerId]
  );

  const totalComprado = customerInvoices.reduce((s, i) => s + i.total, 0);
  const totalPagado = customerPayments.reduce((s, p) => s + p.amount, 0);
  const saldoPendiente = totalComprado - totalPagado;

  // Build statement rows
  const statementRows = useMemo(() => {
    if (!selectedCustomerId) return [];
    const rows: Array<{
      date: string; folio: string; type: string; total: number;
      paymentAmount: number; method: string; reference: string;
      balance: number; status: string;
    }> = [];

    // Add invoice rows
    customerInvoices.forEach(inv => {
      const paid = paidPerInvoice.get(inv.id) ?? 0;
      const bal = Math.max(0, inv.total - paid);
      rows.push({
        date: (inv.issued_at ?? inv.created_at).slice(0, 10),
        folio: `${inv.series}-${inv.folio}`,
        type: 'Factura',
        total: inv.total,
        paymentAmount: 0,
        method: '—',
        reference: inv.uuid || '—',
        balance: bal,
        status: bal <= 0.01 ? 'Liquidada' : 'Pendiente',
      });
    });

    // Add payment rows
    customerPayments.forEach(p => {
      const inv = invoices?.find(i => i.id === p.invoice_id);
      rows.push({
        date: p.payment_date,
        folio: inv ? `${inv.series}-${inv.folio}` : '—',
        type: 'Pago',
        total: 0,
        paymentAmount: p.amount,
        method: p.payment_form,
        reference: p.operation_reference || '—',
        balance: p.remaining_balance,
        status: p.remaining_balance <= 0.01 ? 'Liquidada' : 'Parcial',
      });
    });

    return rows.sort((a, b) => a.date.localeCompare(b.date));
  }, [selectedCustomerId, customerInvoices, customerPayments, paidPerInvoice, invoices]);

  const handleDownloadCustomerStatement = () => {
    if (!selectedCustomerId || statementRows.length === 0) { toast.error('No hay movimientos'); return; }
    const excelRows = statementRows.map(r => ({
      Fecha: r.date, Folio: r.folio, Tipo: r.type, 'Total Factura': r.total,
      'Monto Pago': r.paymentAmount, Método: r.method, Referencia: r.reference,
      'Saldo Restante': r.balance, Estatus: r.status,
    }));
    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.json_to_sheet(excelRows);
    ws['!cols'] = Object.keys(excelRows[0]).map(() => ({ wch: 18 }));
    XLSX.utils.book_append_sheet(wb, ws, 'Estado de Cuenta');
    const ws2 = XLSX.utils.json_to_sheet([
      { Concepto: 'Total facturado', Importe: totalComprado },
      { Concepto: 'Total pagado', Importe: totalPagado },
      { Concepto: 'Saldo pendiente', Importe: Math.max(0, saldoPendiente) },
    ]);
    XLSX.utils.book_append_sheet(wb, ws2, 'Resumen');
    XLSX.writeFile(wb, `Estado_Cuenta_${customerName.replace(/\s+/g, '_')}.xlsx`);
    addAuditLog({ userId: 'current', userName: 'Usuario actual', module: 'cobranza', action: 'descargar_estado_cuenta', entityId: selectedCustomerId, comment: `Excel para ${customerName}` });
    toast.success('Estado de cuenta descargado');
  };

  const handleBulkDownload = () => {
    if (!bulkDateFrom || !bulkDateTo) { toast.error('Selecciona rango de fechas'); return; }
    const allRows: any[] = [];
    (invoices ?? []).filter(i => i.status !== 'cancelada' && i.status !== 'borrador').forEach(inv => {
      const d = (inv.issued_at ?? inv.created_at).slice(0, 10);
      if (d < bulkDateFrom || d > bulkDateTo) return;
      const paid = paidPerInvoice.get(inv.id) ?? 0;
      const cust = inv.customer_id ? customerMap.get(inv.customer_id) : null;
      allRows.push({
        Cliente: cust?.name ?? 'Sin cliente', Fecha: d, Folio: `${inv.series}-${inv.folio}`,
        Total: inv.total, Pagado: paid, Saldo: Math.max(0, inv.total - paid),
        Estatus: paid >= inv.total ? 'Liquidada' : paid > 0 ? 'Parcial' : 'Pendiente',
      });
    });
    if (allRows.length === 0) { toast.error('Sin movimientos en el rango'); return; }
    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.json_to_sheet(allRows);
    ws['!cols'] = Object.keys(allRows[0]).map(() => ({ wch: 20 }));
    XLSX.utils.book_append_sheet(wb, ws, 'Cobranza');
    XLSX.writeFile(wb, `Cobranza_${bulkDateFrom}_a_${bulkDateTo}.xlsx`);
    toast.success(`Descargado con ${allRows.length} registros`);
    setShowBulkDownload(false);
  };

  if (loadingInv || loadingPay) return <div className="py-12 text-center text-muted-foreground">Cargando cuentas por cobrar...</div>;

  return (
    <div>
      <div className="page-header flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="page-title">Cuentas por Cobrar</h1>
          <p className="page-subtitle">Control de cobranza y saldos pendientes de facturas — clic en cliente para ver estado de cuenta</p>
        </div>
        <button onClick={() => setShowBulkDownload(true)} className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:opacity-90 transition-opacity">
          <Download size={16} /> Descargar Excel general
        </button>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <MetricCard title="Saldo total" value={fmt(totalBalance)} icon={CreditCard} variant="primary" />
        <MetricCard title="Cartera vencida" value={fmt(overdueAmount)} icon={AlertTriangle} variant="danger" />
        <MetricCard title="Cuentas vencidas" value={overdue.length} icon={Clock} variant="warning" />
        <MetricCard title="Al corriente" value={receivables.filter(r => r.status === 'al_corriente').length} icon={CheckCircle} variant="success" />
      </div>

      <div className="bg-card rounded-xl border overflow-x-auto">
        <table className="data-table">
          <thead>
            <tr><th>Cliente</th><th>Factura</th><th>Total</th><th>Pagado</th><th>Saldo</th><th>Vencimiento</th><th>Días vencido</th><th>Estatus</th></tr>
          </thead>
          <tbody>
            {receivables.length === 0 ? (
              <tr><td colSpan={8} className="text-center text-muted-foreground py-8">No hay cuentas por cobrar pendientes</td></tr>
            ) : receivables.map(r => (
              <tr key={r.invoiceId}>
                <td>
                  <button
                    onClick={() => r.customerId && setSelectedCustomerId(r.customerId)}
                    className="font-medium text-primary hover:underline cursor-pointer"
                  >
                    {r.customerName}
                  </button>
                </td>
                <td className="font-mono text-xs">{r.folio}</td>
                <td>{fmt(r.total)}</td>
                <td className="text-success">{fmt(r.paid)}</td>
                <td className="font-semibold">{fmt(r.balance)}</td>
                <td className="text-xs text-muted-foreground">{r.dueDate}</td>
                <td>{r.daysOverdue > 0 ? <span className="text-destructive font-bold">{r.daysOverdue}</span> : '—'}</td>
                <td><StatusBadge status={r.status} type="receivable" /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Customer Statement Dialog */}
      <Dialog open={!!selectedCustomerId} onOpenChange={() => setSelectedCustomerId(null)}>
        <DialogContent className="max-w-[95vw] w-full max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2"><History size={20} /> Estado de cuenta — {customerName}</DialogTitle>
            <DialogDescription>Histórico de facturas y pagos del cliente</DialogDescription>
          </DialogHeader>
          <div className="grid grid-cols-3 gap-3 mb-4">
            <div className="p-3 rounded-lg bg-muted/50 text-center">
              <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Total facturado</div>
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
          <div className="flex justify-end mb-3">
            <button onClick={handleDownloadCustomerStatement} className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg bg-primary text-primary-foreground text-xs font-medium hover:opacity-90">
              <FileSpreadsheet size={14} /> Descargar Excel
            </button>
          </div>
          <div className="border rounded-lg overflow-x-auto">
            <table className="data-table w-full min-w-[800px]">
              <thead>
                <tr>
                  <th>Fecha</th><th>Folio</th><th>Tipo</th><th>Total Factura</th>
                  <th>Monto Pago</th><th>Método</th><th>Referencia</th><th>Saldo</th><th>Estatus</th>
                </tr>
              </thead>
              <tbody>
                {statementRows.length > 0 ? statementRows.map((r, i) => {
                  const isInvoice = r.type === 'Factura';
                  const statusClass = r.status === 'Liquidada' ? 'bg-success/10 text-success' : 'bg-warning/10 text-warning';
                  return (
                    <tr key={i} className={isInvoice ? 'bg-muted/30 font-medium' : ''}>
                      <td className="text-xs">{r.date}</td>
                      <td className="font-mono text-xs font-semibold">{r.folio}</td>
                      <td><span className={`text-[10px] font-semibold uppercase px-1.5 py-0.5 rounded ${isInvoice ? 'bg-primary/10 text-primary' : 'bg-success/10 text-success'}`}>{r.type}</span></td>
                      <td className="font-semibold">{r.total > 0 ? fmt(r.total) : '—'}</td>
                      <td className="text-success font-semibold">{r.paymentAmount > 0 ? fmt(r.paymentAmount) : '—'}</td>
                      <td className="text-xs">{r.method}</td>
                      <td className="text-xs text-muted-foreground max-w-[120px] truncate">{r.reference}</td>
                      <td className={r.balance > 0 ? 'text-destructive font-medium' : 'text-success font-medium'}>{fmt(r.balance)}</td>
                      <td><span className={`text-[10px] font-medium px-2 py-0.5 rounded-full ${statusClass}`}>{r.status}</span></td>
                    </tr>
                  );
                }) : (
                  <tr><td colSpan={9} className="text-center text-muted-foreground py-6">Sin movimientos</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </DialogContent>
      </Dialog>

      {/* Bulk Download Dialog */}
      <Dialog open={showBulkDownload} onOpenChange={setShowBulkDownload}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2"><Download size={20} /> Descargar estado de cuenta general</DialogTitle>
            <DialogDescription>Selecciona el rango de fechas</DialogDescription>
          </DialogHeader>
          <div className="flex gap-4 my-4">
            <div className="flex-1">
              <label className="text-xs font-medium text-muted-foreground">Desde</label>
              <input type="date" value={bulkDateFrom} onChange={e => setBulkDateFrom(e.target.value)} className="w-full mt-1 px-3 py-2 rounded-md border bg-background text-sm" />
            </div>
            <div className="flex-1">
              <label className="text-xs font-medium text-muted-foreground">Hasta</label>
              <input type="date" value={bulkDateTo} onChange={e => setBulkDateTo(e.target.value)} className="w-full mt-1 px-3 py-2 rounded-md border bg-background text-sm" />
            </div>
          </div>
          <div className="flex justify-end gap-2">
            <button onClick={() => setShowBulkDownload(false)} className="px-4 py-2 rounded-lg border text-sm">Cancelar</button>
            <button onClick={handleBulkDownload} className="px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-medium">Descargar</button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
