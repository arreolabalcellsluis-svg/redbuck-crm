import { useAppContext } from '@/contexts/AppContext';
import { demoCustomers } from '@/data/demo-data';
import { DEMO_VENDEDOR_ID } from '@/lib/rolePermissions';
import StatusBadge from '@/components/shared/StatusBadge';
import MetricCard from '@/components/shared/MetricCard';
import { CreditCard, AlertTriangle, CheckCircle, Clock, FileSpreadsheet, History, Download } from 'lucide-react';
import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { toast } from 'sonner';
import * as XLSX from 'xlsx';
import { addAuditLog } from '@/lib/auditLog';

const fmt = (n: number) => new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN', maximumFractionDigits: 0 }).format(n);

export default function ReceivablesPage() {
  const { currentRole, receivables, orders, payments, getTotalPaid, getOrderPayments } = useAppContext();
  const isVendedor = currentRole === 'vendedor';
  const vendorId = DEMO_VENDEDOR_ID;

  // Filter receivables for vendedor - only show their clients
  const myCustomerIds = isVendedor
    ? new Set(demoCustomers.filter(c => c.vendorId === vendorId).map(c => c.id))
    : null;
  const visibleReceivables = myCustomerIds
    ? receivables.filter(r => myCustomerIds.has(r.customerId))
    : receivables;

  const totalBalance = visibleReceivables.reduce((s, a) => s + a.balance, 0);
  const overdue = visibleReceivables.filter(a => a.status === 'vencido');
  const overdueAmount = overdue.reduce((s, a) => s + a.balance, 0);

  // Customer account statement
  const [selectedCustomerId, setSelectedCustomerId] = useState<string | null>(null);
  const [historyDateFrom, setHistoryDateFrom] = useState('');
  const [historyDateTo, setHistoryDateTo] = useState('');

  // Bulk download
  const [showBulkDownload, setShowBulkDownload] = useState(false);
  const [bulkDateFrom, setBulkDateFrom] = useState('');
  const [bulkDateTo, setBulkDateTo] = useState('');

  // Get unique customers from receivables
  const customerIds = [...new Set(receivables.map(r => r.customerId))];

  // Customer statement data
  const customerName = selectedCustomerId ? (demoCustomers.find(c => c.id === selectedCustomerId)?.name || receivables.find(r => r.customerId === selectedCustomerId)?.customerName || '') : '';
  const customerOrders = selectedCustomerId ? orders.filter(o => o.customerId === selectedCustomerId) : [];
  const customerReceivables = selectedCustomerId ? receivables.filter(r => r.customerId === selectedCustomerId) : [];
  const customerPaymentsList = selectedCustomerId ? payments.filter(p => customerOrders.some(o => o.id === p.orderId)) : [];
  const totalComprado = customerOrders.reduce((s, o) => s + o.total, 0);
  const totalPagado = customerOrders.reduce((s, o) => s + getTotalPaid(o.id), 0);
  const saldoPendiente = totalComprado - totalPagado;

  const filteredCustomerOrders = customerOrders.filter(o => {
    if (historyDateFrom && o.createdAt < historyDateFrom) return false;
    if (historyDateTo && o.createdAt > historyDateTo) return false;
    return true;
  });

  // Build unified statement rows (orders + payments interleaved chronologically)
  const buildStatementRows = () => {
    const rows: Array<{
      date: string; folio: string; type: string; orderTotal: number;
      paymentAmount: number; method: string; reference: string;
      accumulated: number; balance: number; status: string;
    }> = [];

    const runningPaid: Record<string, number> = {};
    const orderTotals: Record<string, number> = {};
    const orderFolios: Record<string, string> = {};

    // Initialize with advances
    filteredCustomerOrders.forEach(o => {
      orderTotals[o.id] = o.total;
      orderFolios[o.id] = o.folio;
      runningPaid[o.id] = o.advance || 0;

      // Add the order row itself
      const adv = o.advance || 0;
      const bal = Math.max(0, o.total - adv);
      rows.push({
        date: o.createdAt, folio: o.folio, type: 'Pedido', orderTotal: o.total,
        paymentAmount: adv, method: adv > 0 ? 'Anticipo' : '—', reference: '—',
        accumulated: adv, balance: bal,
        status: bal <= 0 ? 'Liquidado' : adv > 0 ? 'Anticipo recibido' : 'Sin pago',
      });
    });

    // Add each payment as its own row
    const relevantPayments = customerPaymentsList
      .filter(p => {
        if (!filteredCustomerOrders.some(o => o.id === p.orderId)) return false;
        if (historyDateFrom && p.date < historyDateFrom) return false;
        if (historyDateTo && p.date > historyDateTo) return false;
        return true;
      })
      .sort((a, b) => a.date.localeCompare(b.date));

    relevantPayments.forEach(p => {
      const oTotal = orderTotals[p.orderId] || 0;
      runningPaid[p.orderId] = (runningPaid[p.orderId] || 0) + p.amount;
      const acc = runningPaid[p.orderId];
      const bal = Math.max(0, oTotal - acc);
      rows.push({
        date: p.date, folio: orderFolios[p.orderId] || '', type: 'Pago',
        orderTotal: oTotal, paymentAmount: p.amount, method: p.method,
        reference: p.reference || '—', accumulated: acc, balance: bal,
        status: bal <= 0 ? 'Liquidado' : 'Pago parcial',
      });
    });

    return rows.sort((a, b) => a.date.localeCompare(b.date));
  };

  const statementRows = selectedCustomerId ? buildStatementRows() : [];

  const handleDownloadCustomerStatement = () => {
    if (!selectedCustomerId) return;
    if (statementRows.length === 0) { toast.error('No hay movimientos para descargar'); return; }

    const excelRows = statementRows.map(r => ({
      'Fecha': r.date,
      'Folio': r.folio,
      'Tipo': r.type,
      'Total Pedido': r.orderTotal,
      'Monto Pago': r.paymentAmount,
      'Método': r.method,
      'Referencia': r.reference,
      'Acumulado Pagado': r.accumulated,
      'Saldo Pendiente': r.balance,
      'Estatus': r.status,
    }));

    const summary = [
      { Concepto: 'Total comprado', Importe: totalComprado },
      { Concepto: 'Total pagado', Importe: totalPagado },
      { Concepto: 'Saldo pendiente', Importe: Math.max(0, saldoPendiente) },
    ];

    const wb = XLSX.utils.book_new();
    const ws1 = XLSX.utils.json_to_sheet(excelRows);
    ws1['!cols'] = Object.keys(excelRows[0]).map(() => ({ wch: 18 }));
    XLSX.utils.book_append_sheet(wb, ws1, 'Estado de Cuenta');
    const ws2 = XLSX.utils.json_to_sheet(summary);
    XLSX.utils.book_append_sheet(wb, ws2, 'Resumen');
    XLSX.writeFile(wb, `Estado_Cuenta_${customerName.replace(/\s+/g, '_')}.xlsx`);

    addAuditLog({ userId: 'current', userName: 'Usuario actual', module: 'cobranza', action: 'descargar_estado_cuenta', entityId: selectedCustomerId, comment: `Excel descargado para ${customerName}` });
    toast.success('Estado de cuenta descargado');
  };

  const handleBulkDownload = () => {
    if (!bulkDateFrom || !bulkDateTo) {
      toast.error('Selecciona un rango de fechas');
      return;
    }
    if (bulkDateFrom > bulkDateTo) {
      toast.error('La fecha inicial no puede ser mayor a la final');
      return;
    }

    const allMovements: any[] = [];
    customerIds.forEach(cId => {
      const cName = demoCustomers.find(c => c.id === cId)?.name || receivables.find(r => r.customerId === cId)?.customerName || '';
      const cOrders = orders.filter(o => o.customerId === cId && o.createdAt >= bulkDateFrom && o.createdAt <= bulkDateTo);
      cOrders.forEach(o => {
        const paid = getTotalPaid(o.id);
        allMovements.push({
          Cliente: cName,
          Fecha: o.createdAt,
          Folio: o.folio,
          'Importe Pedido': o.total,
          'Pagos Realizados': paid,
          'Saldo Pendiente': Math.max(0, o.total - paid),
          Estatus: paid >= o.total ? 'Liquidado' : paid > 0 ? 'Pago parcial' : 'Sin pago',
        });
      });
    });

    // Also include receivables without matching orders (legacy data)
    receivables.forEach(r => {
      if (!allMovements.some(m => m.Folio === r.orderFolio)) {
        if (r.dueDate >= bulkDateFrom && r.dueDate <= bulkDateTo) {
          allMovements.push({
            Cliente: r.customerName,
            Fecha: r.dueDate,
            Folio: r.orderFolio,
            'Importe Pedido': r.total,
            'Pagos Realizados': r.paid,
            'Saldo Pendiente': r.balance,
            Estatus: r.status === 'liquidado' ? 'Liquidado' : r.status === 'vencido' ? 'Vencido' : 'Pendiente',
          });
        }
      }
    });

    if (allMovements.length === 0) {
      toast.error('No hay movimientos en el rango seleccionado');
      return;
    }

    // Summary per customer
    const summaryMap: Record<string, { comprado: number; pagado: number; saldo: number }> = {};
    allMovements.forEach(m => {
      if (!summaryMap[m.Cliente]) summaryMap[m.Cliente] = { comprado: 0, pagado: 0, saldo: 0 };
      summaryMap[m.Cliente].comprado += m['Importe Pedido'];
      summaryMap[m.Cliente].pagado += m['Pagos Realizados'];
      summaryMap[m.Cliente].saldo += m['Saldo Pendiente'];
    });

    const summaryRows = Object.entries(summaryMap).map(([cliente, data]) => ({
      Cliente: cliente,
      'Total Comprado': data.comprado,
      'Total Pagado': data.pagado,
      'Saldo Pendiente': data.saldo,
    }));

    const wb = XLSX.utils.book_new();
    const ws1 = XLSX.utils.json_to_sheet(allMovements);
    ws1['!cols'] = Object.keys(allMovements[0]).map(() => ({ wch: 20 }));
    XLSX.utils.book_append_sheet(wb, ws1, 'Movimientos');
    const ws2 = XLSX.utils.json_to_sheet(summaryRows);
    ws2['!cols'] = Object.keys(summaryRows[0] || {}).map(() => ({ wch: 22 }));
    XLSX.utils.book_append_sheet(wb, ws2, 'Resumen por Cliente');
    XLSX.writeFile(wb, `Cobranza_${bulkDateFrom}_a_${bulkDateTo}.xlsx`);

    addAuditLog({ userId: 'current', userName: 'Usuario actual', module: 'cobranza', action: 'descargar_cobranza_masiva', entityId: 'all', comment: `Excel masivo ${bulkDateFrom} a ${bulkDateTo}` });
    toast.success(`Estado de cuenta descargado con ${allMovements.length} movimientos`);
    setShowBulkDownload(false);
  };

  return (
    <div>
      <div className="page-header flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="page-title">Cuentas por Cobrar</h1>
          <p className="page-subtitle">Control de cobranza y saldos pendientes — haz clic en un cliente para ver su estado de cuenta</p>
        </div>
        <button onClick={() => setShowBulkDownload(true)} className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:opacity-90 transition-opacity">
          <Download size={16} /> Descargar Excel general
        </button>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <MetricCard title="Saldo total" value={fmt(totalBalance)} icon={CreditCard} variant="primary" />
        <MetricCard title="Cartera vencida" value={fmt(overdueAmount)} icon={AlertTriangle} variant="danger" />
        <MetricCard title="Cuentas vencidas" value={overdue.length} icon={Clock} variant="warning" />
        <MetricCard title="Al corriente" value={visibleReceivables.filter(a => a.status === 'al_corriente').length} icon={CheckCircle} variant="success" />
      </div>

      <div className="bg-card rounded-xl border overflow-x-auto">
        <table className="data-table">
          <thead>
            <tr><th>Cliente</th><th>Pedido</th><th>Total</th><th>Pagado</th><th>Saldo</th><th>Vencimiento</th><th>Días vencido</th><th>Estatus</th></tr>
          </thead>
          <tbody>
            {receivables.map(ar => (
              <tr key={ar.id}>
                <td>
                  <button
                    onClick={() => { setSelectedCustomerId(ar.customerId); setHistoryDateFrom(''); setHistoryDateTo(''); }}
                    className="font-medium text-primary hover:underline cursor-pointer"
                  >
                    {ar.customerName}
                  </button>
                </td>
                <td className="font-mono text-xs">{ar.orderFolio}</td>
                <td>{fmt(ar.total)}</td>
                <td className="text-success">{fmt(ar.paid)}</td>
                <td className="font-semibold">{fmt(ar.balance)}</td>
                <td className="text-xs text-muted-foreground">{ar.dueDate}</td>
                <td>{ar.daysOverdue > 0 ? <span className="text-destructive font-bold">{ar.daysOverdue}</span> : '—'}</td>
                <td><StatusBadge status={ar.status} type="receivable" /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* CUSTOMER ACCOUNT STATEMENT */}
      <Dialog open={!!selectedCustomerId} onOpenChange={() => setSelectedCustomerId(null)}>
        <DialogContent className="max-w-[95vw] w-full max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2"><History size={20} /> Estado de cuenta — {customerName}</DialogTitle>
            <DialogDescription>Histórico completo de pedidos y pagos del cliente</DialogDescription>
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
          <div className="flex items-center gap-3 mb-4 flex-wrap">
            <div>
              <label className="text-xs font-medium text-muted-foreground">Desde</label>
              <input type="date" value={historyDateFrom} onChange={e => setHistoryDateFrom(e.target.value)} className="ml-2 px-2 py-1 rounded border bg-background text-xs" />
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground">Hasta</label>
              <input type="date" value={historyDateTo} onChange={e => setHistoryDateTo(e.target.value)} className="ml-2 px-2 py-1 rounded border bg-background text-xs" />
            </div>
            <button onClick={handleDownloadCustomerStatement} className="ml-auto inline-flex items-center gap-2 px-3 py-1.5 rounded-lg bg-primary text-primary-foreground text-xs font-medium hover:opacity-90">
              <FileSpreadsheet size={14} /> Descargar Excel
            </button>
          </div>
          <div className="border rounded-lg overflow-x-auto">
            <table className="data-table w-full min-w-[900px]">
              <thead>
                <tr>
                  <th className="whitespace-nowrap">Fecha</th>
                  <th className="whitespace-nowrap">Folio</th>
                  <th className="whitespace-nowrap">Tipo</th>
                  <th className="whitespace-nowrap">Total pedido</th>
                  <th className="whitespace-nowrap">Monto pago</th>
                  <th className="whitespace-nowrap">Método</th>
                  <th className="whitespace-nowrap">Referencia</th>
                  <th className="whitespace-nowrap">Acumulado</th>
                  <th className="whitespace-nowrap">Saldo pendiente</th>
                  <th className="whitespace-nowrap">Estatus</th>
                </tr>
              </thead>
              <tbody>
                {statementRows.length > 0 ? statementRows.map((r, i) => {
                  const isOrder = r.type === 'Pedido';
                  const statusClass = r.status === 'Liquidado' ? 'bg-success/10 text-success' : r.status === 'Sin pago' ? 'bg-muted text-muted-foreground' : 'bg-warning/10 text-warning';
                  return (
                    <tr key={i} className={isOrder ? 'bg-muted/30 font-medium' : ''}>
                      <td className="text-xs whitespace-nowrap">{r.date}</td>
                      <td className="font-mono text-xs font-semibold">{r.folio}</td>
                      <td><span className={`text-[10px] font-semibold uppercase px-1.5 py-0.5 rounded ${isOrder ? 'bg-primary/10 text-primary' : 'bg-success/10 text-success'}`}>{r.type}</span></td>
                      <td className="font-semibold">{fmt(r.orderTotal)}</td>
                      <td className="text-success font-semibold">{r.paymentAmount > 0 ? fmt(r.paymentAmount) : '—'}</td>
                      <td className="text-xs capitalize">{r.method}</td>
                      <td className="text-xs text-muted-foreground">{r.reference}</td>
                      <td className="text-xs font-medium">{fmt(r.accumulated)}</td>
                      <td className={r.balance > 0 ? 'text-destructive font-medium' : 'text-success font-medium'}>{fmt(r.balance)}</td>
                      <td><span className={`text-[10px] font-medium px-2 py-0.5 rounded-full whitespace-nowrap ${statusClass}`}>{r.status}</span></td>
                    </tr>
                  );
                }) : (
                  <tr><td colSpan={10} className="text-center text-muted-foreground text-sm py-6">Sin movimientos en el rango seleccionado</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </DialogContent>
      </Dialog>

      {/* BULK DOWNLOAD */}
      <Dialog open={showBulkDownload} onOpenChange={setShowBulkDownload}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2"><Download size={20} /> Descargar estado de cuenta general</DialogTitle>
            <DialogDescription>Descarga el estado de cuenta de todos los clientes en un archivo Excel. Selecciona el rango de fechas.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-xs font-medium text-muted-foreground mb-1 block">Fecha inicial *</label>
                <input type="date" value={bulkDateFrom} onChange={e => setBulkDateFrom(e.target.value)} className="w-full px-3 py-2 rounded-lg border bg-card text-sm" />
              </div>
              <div>
                <label className="text-xs font-medium text-muted-foreground mb-1 block">Fecha final *</label>
                <input type="date" value={bulkDateTo} onChange={e => setBulkDateTo(e.target.value)} className="w-full px-3 py-2 rounded-lg border bg-card text-sm" />
              </div>
            </div>
          </div>
          <DialogFooter>
            <button onClick={() => setShowBulkDownload(false)} className="px-4 py-2 rounded-lg border text-sm hover:bg-muted">Cancelar</button>
            <button onClick={handleBulkDownload} className="px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:opacity-90 flex items-center gap-2">
              <FileSpreadsheet size={14} /> Descargar Excel
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
