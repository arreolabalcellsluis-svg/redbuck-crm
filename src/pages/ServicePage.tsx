import { demoServiceOrders, demoCustomers, demoProducts, demoUsers } from '@/data/demo-data';
import { useAppContext } from '@/contexts/AppContext';
import StatusBadge from '@/components/shared/StatusBadge';
import MetricCard from '@/components/shared/MetricCard';
import { Wrench, Calendar, CheckCircle, Clock, Plus, Edit2, ImagePlus, X, ZoomIn, FileDown, MessageCircle, Download } from 'lucide-react';
import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { ServiceOrder, ServiceType, ServiceStatus } from '@/types';
import { addAuditLog } from '@/lib/auditLog';
import { toast } from 'sonner';
import * as XLSX from 'xlsx';
import { saveAs } from 'file-saver';

const SERVICE_TYPE_LABELS: Record<ServiceType, string> = {
  instalacion: 'Instalación', garantia: 'Garantía', mantenimiento: 'Mantenimiento',
  reparacion: 'Reparación', visita_tecnica: 'Visita técnica', capacitacion: 'Capacitación',
};

const SERVICE_STATUS_LABELS: Record<ServiceStatus, string> = {
  pendiente: 'Pendiente', programado: 'Programado', en_proceso: 'En proceso',
  terminado: 'Terminado', cancelado: 'Cancelado',
};

function generateServiceReportPDF(so: ExtendedServiceOrder) {
  const tech = demoUsers.find(u => u.name === so.technicianName);
  const html = `
    <html><head><title>Reporte ${so.folio}</title>
    <style>
      body { font-family: Arial, sans-serif; padding: 40px; color: #1a1a1a; }
      .header { text-align: center; border-bottom: 3px solid #c0392b; padding-bottom: 16px; margin-bottom: 24px; }
      .header h1 { margin: 0; font-size: 22px; color: #c0392b; }
      .header p { margin: 4px 0 0; font-size: 12px; color: #666; }
      .section { margin-bottom: 18px; }
      .section-title { font-size: 13px; font-weight: bold; text-transform: uppercase; color: #c0392b; border-bottom: 1px solid #ddd; padding-bottom: 4px; margin-bottom: 8px; }
      .row { display: flex; margin-bottom: 4px; font-size: 13px; }
      .label { font-weight: bold; width: 180px; color: #333; }
      .value { color: #555; }
      .desc-box { background: #f9f9f9; border: 1px solid #eee; border-radius: 6px; padding: 10px; font-size: 13px; white-space: pre-wrap; min-height: 30px; }
      .footer { margin-top: 40px; text-align: center; font-size: 11px; color: #999; border-top: 1px solid #ddd; padding-top: 12px; }
      .images-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 10px; }
      .images-grid img { width: 100%; height: 180px; object-fit: cover; border-radius: 6px; border: 1px solid #ddd; }
      @media print { body { padding: 20px; } .images-grid img { break-inside: avoid; } }
    </style></head><body>
    <div class="header">
      <h1>REDBUCK EQUIPMENT</h1>
      <p>Reporte de Servicio Técnico</p>
    </div>
    <div class="section">
      <div class="section-title">Datos Generales</div>
      <div class="row"><span class="label">Folio:</span><span class="value">${so.folio}</span></div>
      <div class="row"><span class="label">Cliente:</span><span class="value">${so.customerName}</span></div>
      <div class="row"><span class="label">Equipo:</span><span class="value">${so.productName}</span></div>
      <div class="row"><span class="label">Tipo de servicio:</span><span class="value">${SERVICE_TYPE_LABELS[so.type] || so.type}</span></div>
      <div class="row"><span class="label">Fecha programada:</span><span class="value">${so.scheduledDate}</span></div>
      ${so.completedDate ? `<div class="row"><span class="label">Fecha realizada:</span><span class="value">${so.completedDate}</span></div>` : ''}
      <div class="row"><span class="label">Estatus:</span><span class="value">${SERVICE_STATUS_LABELS[so.status] || so.status}</span></div>
    </div>
    <div class="section">
      <div class="section-title">Técnico Responsable</div>
      <div class="row"><span class="label">Nombre:</span><span class="value">${so.technicianName}</span></div>
      ${tech?.phone ? `<div class="row"><span class="label">Teléfono:</span><span class="value">${tech.phone}</span></div>` : ''}
      ${tech?.whatsapp ? `<div class="row"><span class="label">WhatsApp:</span><span class="value">${tech.whatsapp}</span></div>` : ''}
      ${tech?.email ? `<div class="row"><span class="label">Correo:</span><span class="value">${tech.email}</span></div>` : ''}
    </div>
    <div class="section">
      <div class="section-title">Descripción del servicio</div>
      <div class="desc-box">${so.description || 'Sin descripción'}</div>
    </div>
    <div class="section">
      <div class="section-title">Diagnóstico</div>
      <div class="desc-box">${so.diagnosis || 'Sin diagnóstico'}</div>
    </div>
    <div class="section">
      <div class="section-title">Acciones realizadas</div>
      <div class="desc-box">${so.actionsPerformed || 'Sin acciones registradas'}</div>
    </div>
    <div class="section">
      <div class="section-title">Observaciones</div>
      <div class="desc-box">${so.observations || 'Sin observaciones'}</div>
    </div>
    ${(so.images && so.images.length > 0) ? `
    <div class="section">
      <div class="section-title">Evidencia Fotográfica (${so.images.length} imagen${so.images.length > 1 ? 'es' : ''})</div>
      <div class="images-grid">
        ${so.images.map((img, i) => `<img src="${img}" alt="Evidencia ${i + 1}" />`).join('')}
      </div>
    </div>` : ''}
    <div class="footer">
      REDBUCK EQUIPMENT — Reporte generado el ${new Date().toLocaleDateString('es-MX')}
    </div>
    </body></html>
  `;
  const w = window.open('', '_blank');
  if (w) {
    w.document.write(html);
    w.document.close();
    w.setTimeout(() => w.print(), 400);
  } else {
    toast.error('Habilita las ventanas emergentes para descargar el PDF');
  }
}

function sendServiceReportWhatsApp(so: ExtendedServiceOrder) {
  const customer = demoCustomers.find(c => c.id === so.customerId);
  const tech = demoUsers.find(u => u.name === so.technicianName);
  const phone = customer?.whatsapp || customer?.phone || '';
  const cleanPhone = phone.replace(/\D/g, '');

  const text = [
    `📋 *REPORTE DE SERVICIO TÉCNICO*`,
    `━━━━━━━━━━━━━━━━━━`,
    `*Folio:* ${so.folio}`,
    `*Cliente:* ${so.customerName}`,
    `*Equipo:* ${so.productName}`,
    `*Tipo:* ${SERVICE_TYPE_LABELS[so.type] || so.type}`,
    `*Fecha:* ${so.scheduledDate}`,
    so.completedDate ? `*Fecha realizada:* ${so.completedDate}` : '',
    `*Estatus:* ${SERVICE_STATUS_LABELS[so.status] || so.status}`,
    ``,
    `👷 *Técnico Responsable*`,
    `*Nombre:* ${so.technicianName}`,
    tech?.phone ? `*Tel:* ${tech.phone}` : '',
    tech?.email ? `*Email:* ${tech.email}` : '',
    ``,
    `📝 *Descripción:* ${so.description || 'N/A'}`,
    so.diagnosis ? `🔍 *Diagnóstico:* ${so.diagnosis}` : '',
    so.actionsPerformed ? `🔧 *Acciones realizadas:* ${so.actionsPerformed}` : '',
    so.observations ? `📌 *Observaciones:* ${so.observations}` : '',
    ``,
    `_REDBUCK EQUIPMENT_`,
  ].filter(Boolean).join('\n');

  const url = cleanPhone
    ? `https://wa.me/${cleanPhone}?text=${encodeURIComponent(text)}`
    : `https://wa.me/?text=${encodeURIComponent(text)}`;

  window.open(url, '_blank');
}

const technicians = demoUsers.filter(u => u.role === 'tecnico');

// Extended service order with images
interface ExtendedServiceOrder extends ServiceOrder {
  images?: string[];
  diagnosis?: string;
  actionsPerformed?: string;
  completedDate?: string;
  observations?: string;
}

export default function ServicePage() {
  const { currentRole } = useAppContext();
  const canEdit = currentRole === 'director' || currentRole === 'tecnico' || currentRole === 'administracion';

  const [services, setServices] = useState<ExtendedServiceOrder[]>(
    demoServiceOrders.map(s => ({ ...s, images: [], diagnosis: '', actionsPerformed: '', observations: '' }))
  );
  const [open, setOpen] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState({
    customerId: '', productName: '', technicianName: technicians[0]?.name || '',
    type: 'instalacion' as ServiceType, scheduledDate: '', description: '',
    status: 'pendiente' as ServiceStatus,
    diagnosis: '', actionsPerformed: '', completedDate: '', observations: '',
  });
  const [formImages, setFormImages] = useState<string[]>([]);
  const [showDownload, setShowDownload] = useState(false);
  const [dlDateFrom, setDlDateFrom] = useState('');
  const [dlDateTo, setDlDateTo] = useState('');

  // Image viewer
  const [viewImage, setViewImage] = useState<string | null>(null);

  // Images dialog for existing order
  const [imageOrderId, setImageOrderId] = useState<string | null>(null);

  const openEdit = (so: ExtendedServiceOrder) => {
    setEditId(so.id);
    setForm({
      customerId: so.customerId, productName: so.productName,
      technicianName: so.technicianName, type: so.type,
      scheduledDate: so.scheduledDate, description: so.description,
      status: so.status,
      diagnosis: so.diagnosis || '', actionsPerformed: so.actionsPerformed || '',
      completedDate: so.completedDate || '', observations: so.observations || '',
    });
    setFormImages(so.images || []);
    setOpen(true);
  };

  const resetForm = () => {
    setEditId(null);
    setForm({
      customerId: '', productName: '', technicianName: technicians[0]?.name || '',
      type: 'instalacion', scheduledDate: '', description: '',
      status: 'pendiente', diagnosis: '', actionsPerformed: '', completedDate: '', observations: '',
    });
    setFormImages([]);
  };

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;
    Array.from(files).forEach(file => {
      const reader = new FileReader();
      reader.onload = (ev) => {
        const result = ev.target?.result as string;
        setFormImages(prev => [...prev, result]);
      };
      reader.readAsDataURL(file);
    });
    e.target.value = '';
  };

  const handleAddImageToOrder = (orderId: string, e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;
    Array.from(files).forEach(file => {
      const reader = new FileReader();
      reader.onload = (ev) => {
        const result = ev.target?.result as string;
        setServices(prev => prev.map(s => s.id === orderId ? { ...s, images: [...(s.images || []), result] } : s));
        addAuditLog({ userId: 'current', userName: 'Usuario actual', module: 'servicio', action: 'subir_imagen', entityId: orderId, comment: 'Imagen agregada a orden de servicio' });
      };
      reader.readAsDataURL(file);
    });
    e.target.value = '';
    toast.success('Imagen(es) agregada(s)');
  };

  const removeImageFromOrder = (orderId: string, imgIdx: number) => {
    setServices(prev => prev.map(s => s.id === orderId ? { ...s, images: (s.images || []).filter((_, i) => i !== imgIdx) } : s));
    addAuditLog({ userId: 'current', userName: 'Usuario actual', module: 'servicio', action: 'eliminar_imagen', entityId: orderId, comment: 'Imagen eliminada de orden' });
    toast.success('Imagen eliminada');
  };

  const handleSave = () => {
    const customer = demoCustomers.find(c => c.id === form.customerId);
    if ((!customer && !editId) || !form.productName || !form.scheduledDate) {
      toast.error('Completa cliente, equipo y fecha');
      return;
    }

    if (editId) {
      setServices(prev => prev.map(s => s.id === editId ? {
        ...s,
        customerId: form.customerId || s.customerId,
        customerName: customer?.name || s.customerName,
        productName: form.productName,
        technicianName: form.technicianName,
        type: form.type,
        scheduledDate: form.scheduledDate,
        description: form.description,
        status: form.status,
        diagnosis: form.diagnosis,
        actionsPerformed: form.actionsPerformed,
        completedDate: form.completedDate,
        observations: form.observations,
        images: formImages,
      } : s));
      addAuditLog({ userId: 'current', userName: 'Usuario actual', module: 'servicio', action: 'editar_orden', entityId: editId, newValue: `Status: ${form.status}`, comment: `Orden editada` });
      toast.success('Orden de servicio actualizada');
    } else {
      const folio = `SRV-2026-${String(services.length + 1).padStart(3, '0')}`;
      const newService: ExtendedServiceOrder = {
        id: `so-${Date.now()}`, folio,
        customerId: customer!.id, customerName: customer!.name,
        productName: form.productName, technicianName: form.technicianName,
        type: form.type, scheduledDate: form.scheduledDate,
        status: form.status, description: form.description,
        diagnosis: form.diagnosis, actionsPerformed: form.actionsPerformed,
        completedDate: form.completedDate, observations: form.observations,
        images: formImages,
      };
      setServices(prev => [newService, ...prev]);
      addAuditLog({ userId: 'current', userName: 'Usuario actual', module: 'servicio', action: 'crear_orden', entityId: newService.id, newValue: folio });
      toast.success(`Orden ${folio} creada`);
    }
    setOpen(false);
    resetForm();
  };

  const handleServiceExcel = () => {
    if (!dlDateFrom || !dlDateTo) { toast.error('Selecciona un rango de fechas'); return; }
    if (dlDateFrom > dlDateTo) { toast.error('La fecha inicial no puede ser mayor a la final'); return; }

    const data = services.filter(s => s.scheduledDate >= dlDateFrom && s.scheduledDate <= dlDateTo);
    if (data.length === 0) { toast.error('No hay órdenes en el rango seleccionado'); return; }

    const rows = data.map(s => ({
      'Folio': s.folio,
      'Cliente': s.customerName,
      'Equipo': s.productName,
      'Técnico': s.technicianName,
      'Tipo': SERVICE_TYPE_LABELS[s.type] || s.type,
      'Fecha Programada': s.scheduledDate,
      'Fecha Realizada': s.completedDate || '',
      'Estatus': SERVICE_STATUS_LABELS[s.status] || s.status,
      'Descripción': s.description || '',
      'Diagnóstico': s.diagnosis || '',
      'Acciones Realizadas': s.actionsPerformed || '',
      'Observaciones': s.observations || '',
      'Fotos': s.images?.length || 0,
    }));

    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.json_to_sheet(rows);
    ws['!cols'] = Object.keys(rows[0]).map(() => ({ wch: 20 }));
    XLSX.utils.book_append_sheet(wb, ws, 'Servicio Técnico');

    const buf = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
    saveAs(new Blob([buf], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }), `Servicio_Tecnico_${dlDateFrom}_a_${dlDateTo}.xlsx`);
    toast.success(`Excel generado con ${data.length} órdenes`);
    setShowDownload(false);
  };

  const dlFilteredCount = services.filter(s => {
    if (dlDateFrom && s.scheduledDate < dlDateFrom) return false;
    if (dlDateTo && s.scheduledDate > dlDateTo) return false;
    return true;
  }).length;

  return (
    <div>
      <div className="page-header flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="page-title">Servicio Técnico</h1>
          <p className="page-subtitle">Instalaciones, garantías y mantenimiento</p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => setShowDownload(true)} className="inline-flex items-center gap-2 px-3 py-2 rounded-lg border text-sm font-medium hover:bg-muted transition-colors">
            <Download size={16} /> Descargar Excel
          </button>
          <button onClick={() => { resetForm(); setOpen(true); }} className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:opacity-90 transition-opacity">
            <Plus size={16} /> Nueva orden
          </button>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <MetricCard title="Órdenes activas" value={services.length} icon={Wrench} variant="primary" />
        <MetricCard title="Programadas" value={services.filter(s => s.status === 'programado').length} icon={Calendar} variant="info" />
        <MetricCard title="Pendientes" value={services.filter(s => s.status === 'pendiente').length} icon={Clock} variant="warning" />
        <MetricCard title="Terminadas" value={services.filter(s => s.status === 'terminado').length} icon={CheckCircle} variant="success" />
      </div>

      <div className="bg-card rounded-xl border overflow-x-auto">
        <table className="data-table">
          <thead>
            <tr><th>Folio</th><th>Cliente</th><th>Equipo</th><th>Técnico</th><th>Tipo</th><th>Fecha</th><th>Estatus</th><th>Fotos</th><th>Acciones</th></tr>
          </thead>
          <tbody>
            {services.map(so => (
              <tr key={so.id}>
                <td className="font-mono text-xs font-semibold">{so.folio}</td>
                <td className="font-medium">{so.customerName}</td>
                <td className="text-muted-foreground">{so.productName}</td>
                <td className="text-muted-foreground">{so.technicianName}</td>
                <td className="capitalize text-xs">{so.type.replace('_', ' ')}</td>
                <td className="text-xs text-muted-foreground">{so.scheduledDate}</td>
                <td><StatusBadge status={so.status} type="service" /></td>
                <td>
                  <div className="flex items-center gap-1">
                    {(so.images?.length || 0) > 0 && (
                      <button onClick={() => setImageOrderId(so.id)} className="text-xs text-primary hover:underline">{so.images!.length} 📷</button>
                    )}
                    {canEdit && (
                      <label className="p-1 rounded-md hover:bg-muted cursor-pointer" title="Agregar imagen">
                        <ImagePlus size={14} className="text-muted-foreground" />
                        <input type="file" accept="image/*" multiple className="hidden" onChange={e => handleAddImageToOrder(so.id, e)} />
                      </label>
                    )}
                  </div>
                </td>
                <td>
                  <div className="flex items-center gap-1">
                    <button onClick={() => generateServiceReportPDF(so)} className="p-1.5 rounded-md hover:bg-muted text-muted-foreground hover:text-foreground" title="Descargar PDF">
                      <FileDown size={14} />
                    </button>
                    <button onClick={() => sendServiceReportWhatsApp(so)} className="p-1.5 rounded-md hover:bg-muted text-green-600 hover:text-green-700" title="Enviar por WhatsApp">
                      <MessageCircle size={14} />
                    </button>
                    {canEdit && (
                      <button onClick={() => openEdit(so)} className="p-1.5 rounded-md hover:bg-muted" title="Editar orden">
                        <Edit2 size={14} />
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* CREATE / EDIT SERVICE ORDER */}
      <Dialog open={open} onOpenChange={() => { setOpen(false); resetForm(); }}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editId ? 'Editar Orden de Servicio' : 'Nueva Orden de Servicio'}</DialogTitle>
            <DialogDescription>{editId ? 'Modifica la información del servicio' : 'Programa una orden de servicio técnico'}</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <label className="text-xs font-medium text-muted-foreground">Cliente *</label>
              <select value={form.customerId} onChange={e => setForm({ ...form, customerId: e.target.value })} className="w-full mt-1 px-3 py-2 rounded-lg border bg-background text-sm">
                <option value="">Seleccionar...</option>
                {demoCustomers.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground">Equipo *</label>
              <select value={form.productName} onChange={e => setForm({ ...form, productName: e.target.value })} className="w-full mt-1 px-3 py-2 rounded-lg border bg-background text-sm">
                <option value="">Seleccionar...</option>
                {demoProducts.filter(p => p.active).map(p => <option key={p.id} value={p.name}>{p.name}</option>)}
              </select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-medium text-muted-foreground">Tipo</label>
                <select value={form.type} onChange={e => setForm({ ...form, type: e.target.value as ServiceType })} className="w-full mt-1 px-3 py-2 rounded-lg border bg-background text-sm">
                  <option value="instalacion">Instalación</option>
                  <option value="garantia">Garantía</option>
                  <option value="mantenimiento">Mantenimiento</option>
                  <option value="reparacion">Reparación</option>
                  <option value="visita_tecnica">Visita técnica</option>
                  <option value="capacitacion">Capacitación</option>
                </select>
              </div>
              <div>
                <label className="text-xs font-medium text-muted-foreground">Fecha programada *</label>
                <input type="date" value={form.scheduledDate} onChange={e => setForm({ ...form, scheduledDate: e.target.value })} className="w-full mt-1 px-3 py-2 rounded-lg border bg-background text-sm" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-medium text-muted-foreground">Técnico</label>
                <select value={form.technicianName} onChange={e => setForm({ ...form, technicianName: e.target.value })} className="w-full mt-1 px-3 py-2 rounded-lg border bg-background text-sm">
                  {technicians.map(t => <option key={t.id} value={t.name}>{t.name}</option>)}
                </select>
              </div>
              <div>
                <label className="text-xs font-medium text-muted-foreground">Estatus</label>
                <select value={form.status} onChange={e => setForm({ ...form, status: e.target.value as ServiceStatus })} className="w-full mt-1 px-3 py-2 rounded-lg border bg-background text-sm">
                  <option value="pendiente">Pendiente</option>
                  <option value="programado">Programado</option>
                  <option value="en_proceso">En proceso</option>
                  <option value="terminado">Terminado</option>
                  <option value="cancelado">Cancelado</option>
                </select>
              </div>
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground">Descripción</label>
              <textarea value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} rows={2} className="w-full mt-1 px-3 py-2 rounded-lg border bg-background text-sm resize-none" />
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground">Diagnóstico</label>
              <textarea value={form.diagnosis} onChange={e => setForm({ ...form, diagnosis: e.target.value })} rows={2} className="w-full mt-1 px-3 py-2 rounded-lg border bg-background text-sm resize-none" />
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground">Acciones realizadas</label>
              <textarea value={form.actionsPerformed} onChange={e => setForm({ ...form, actionsPerformed: e.target.value })} rows={2} className="w-full mt-1 px-3 py-2 rounded-lg border bg-background text-sm resize-none" />
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground">Observaciones</label>
              <textarea value={form.observations} onChange={e => setForm({ ...form, observations: e.target.value })} rows={2} className="w-full mt-1 px-3 py-2 rounded-lg border bg-background text-sm resize-none" />
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground">Fecha realizada</label>
              <input type="date" value={form.completedDate} onChange={e => setForm({ ...form, completedDate: e.target.value })} className="w-full mt-1 px-3 py-2 rounded-lg border bg-background text-sm" />
            </div>

            {/* Images */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="text-xs font-medium text-muted-foreground">Imágenes</label>
                <label className="text-xs text-primary hover:underline cursor-pointer flex items-center gap-1">
                  <ImagePlus size={12} /> Agregar
                  <input type="file" accept="image/*" multiple className="hidden" onChange={handleImageUpload} />
                </label>
              </div>
              {formImages.length > 0 && (
                <div className="grid grid-cols-4 gap-2">
                  {formImages.map((img, i) => (
                    <div key={i} className="relative group">
                      <img src={img} alt="" className="w-full h-20 object-cover rounded-lg cursor-pointer" onClick={() => setViewImage(img)} />
                      <button onClick={() => setFormImages(prev => prev.filter((_, idx) => idx !== i))} className="absolute top-1 right-1 w-5 h-5 rounded-full bg-destructive text-destructive-foreground flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                        <X size={10} />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button onClick={() => { setOpen(false); resetForm(); }} className="px-4 py-2 rounded-lg border text-sm hover:bg-muted">Cancelar</button>
              <button onClick={handleSave} className="px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:opacity-90">
                {editId ? 'Guardar cambios' : 'Crear orden'}
              </button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* IMAGE GALLERY for existing order */}
      <Dialog open={!!imageOrderId} onOpenChange={() => setImageOrderId(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Galería de imágenes</DialogTitle>
            <DialogDescription>Fotos de la orden de servicio</DialogDescription>
          </DialogHeader>
          {imageOrderId && (() => {
            const order = services.find(s => s.id === imageOrderId);
            if (!order?.images?.length) return <div className="text-sm text-muted-foreground">Sin imágenes</div>;
            return (
              <div className="grid grid-cols-3 gap-3">
                {order.images.map((img, i) => (
                  <div key={i} className="relative group">
                    <img src={img} alt="" className="w-full h-24 object-cover rounded-lg cursor-pointer" onClick={() => setViewImage(img)} />
                    {canEdit && (
                      <button onClick={() => removeImageFromOrder(order.id, i)} className="absolute top-1 right-1 w-5 h-5 rounded-full bg-destructive text-destructive-foreground flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                        <X size={10} />
                      </button>
                    )}
                  </div>
                ))}
              </div>
            );
          })()}
        </DialogContent>
      </Dialog>

      {/* FULL IMAGE VIEW */}
      <Dialog open={!!viewImage} onOpenChange={() => setViewImage(null)}>
        <DialogContent className="max-w-3xl p-2">
          {viewImage && <img src={viewImage} alt="" className="w-full max-h-[80vh] object-contain rounded-lg" />}
        </DialogContent>
      </Dialog>

      {/* DOWNLOAD EXCEL DIALOG */}
      <Dialog open={showDownload} onOpenChange={setShowDownload}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2"><Download size={20} /> Descargar Servicio Técnico</DialogTitle>
            <DialogDescription>Selecciona el rango de fechas programadas para descargar.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-xs font-medium text-muted-foreground mb-1 block">Fecha inicial *</label>
                <input type="date" value={dlDateFrom} onChange={e => setDlDateFrom(e.target.value)} className="w-full px-3 py-2 rounded-lg border bg-card text-sm" />
              </div>
              <div>
                <label className="text-xs font-medium text-muted-foreground mb-1 block">Fecha final *</label>
                <input type="date" value={dlDateTo} onChange={e => setDlDateTo(e.target.value)} className="w-full px-3 py-2 rounded-lg border bg-card text-sm" />
              </div>
            </div>
            {dlDateFrom && dlDateTo && (
              <div className="rounded-lg bg-muted/50 p-3 text-sm text-center">
                <span className="font-semibold text-primary">{dlFilteredCount}</span> orden{dlFilteredCount !== 1 ? 'es' : ''} encontrada{dlFilteredCount !== 1 ? 's' : ''}
              </div>
            )}
          </div>
          <DialogFooter>
            <button onClick={() => setShowDownload(false)} className="px-4 py-2 rounded-lg border text-sm hover:bg-muted">Cancelar</button>
            <button onClick={handleServiceExcel} className="px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:opacity-90 flex items-center gap-2">
              <Download size={16} /> Descargar Excel
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
