import { demoCompanyInfo, demoSalesConditions, demoWhatsAppTemplate, demoSpareParts } from '@/data/demo-data';
import { getCompanyLogoUrl } from '@/hooks/useCompanyLogo';
import { useAppContext } from '@/contexts/AppContext';
import { useAddAccountReceivable } from '@/hooks/useAccountsReceivable';
import { DEMO_VENDEDOR_ID } from '@/lib/rolePermissions';
import { getProductImage } from '@/lib/productImages';
import { numberToWords } from '@/lib/numberToWords';
import { exportQuotationsZip, exportQuotationsExcel } from '@/lib/exportUtils';
import { addAuditLog } from '@/lib/auditLog';
import StatusBadge from '@/components/shared/StatusBadge';
import MetricCard from '@/components/shared/MetricCard';
import { FileText, Send, CheckCircle, Plus, Search, MessageCircle, Download, Eye, Trash2, ShoppingCart, CalendarClock, PackageCheck, CreditCard, Pencil, CalendarIcon, X, Loader2 } from 'lucide-react';
import { useState, useRef, useMemo } from 'react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { cn } from '@/lib/utils';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { toast } from 'sonner';
import type { QuotationItem, Quotation, QuotationStatus, Order, OrderType, AccountReceivable } from '@/types';
import type { Payment } from '@/types/payments';
import { useQuotations, useAddQuotation, useUpdateQuotationStatus, useUpdateQuotation } from '@/hooks/useQuotations';
import { useCustomers } from '@/hooks/useCustomers';
import { useProducts, useUpdateProduct } from '@/hooks/useProducts';
import { useAddOrder } from '@/hooks/useOrders';
import { useOrders } from '@/hooks/useOrders';
import { useTeamMembers } from '@/hooks/useTeamMembers';

const fmt = (n: number) => new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN', maximumFractionDigits: 2 }).format(n);
const IVA_RATE = 0.16;

export default function QuotationsPage() {
  const { currentRole, exchangeRate } = useAppContext();
  const addReceivableMutation = useAddAccountReceivable();

  // DB hooks
  const { data: dbQuotations = [], isLoading: quotationsLoading } = useQuotations();
  const addQuotationMutation = useAddQuotation();
  const updateQuotationStatusMutation = useUpdateQuotationStatus();
  const updateQuotationMutation = useUpdateQuotation();
  const { data: dbOrders = [] } = useOrders();
  const addOrderMutation = useAddOrder();
  const { data: dbCustomers = [] } = useCustomers();
  const { data: dbProducts = [] } = useProducts();
  const updateProductMutation = useUpdateProduct();
  const { data: dbTeamMembers = [] } = useTeamMembers();

  // Compute next folio from DB quotations for a given vendor
  const getNextFolioFromDB = (vendorId: string): string => {
    const vendor = dbTeamMembers.find(u => u.id === vendorId);
    if (!vendor?.seriesPrefix) return `COT-${Date.now()}`;
    const prefix = vendor.seriesPrefix;
    let maxNum = vendor.seriesStart ?? 1000;
    dbQuotations.forEach(q => {
      if (q.folio && q.folio.startsWith(prefix + '-')) {
        const numPart = parseInt(q.folio.replace(prefix + '-', ''), 10);
        if (!isNaN(numPart) && numPart > maxNum) maxNum = numPart;
      }
    });
    return `${prefix}-${maxNum + 1}`;
  };

  const getVendorCurrentNum = (vendorId: string): number => {
    const vendor = dbTeamMembers.find(u => u.id === vendorId);
    if (!vendor?.seriesPrefix) return 0;
    const prefix = vendor.seriesPrefix;
    let maxNum = vendor.seriesStart ?? 1000;
    dbQuotations.forEach(q => {
      if (q.folio && q.folio.startsWith(prefix + '-')) {
        const numPart = parseInt(q.folio.replace(prefix + '-', ''), 10);
        if (!isNaN(numPart) && numPart > maxNum) maxNum = numPart;
      }
    });
    return maxNum;
  };

  // Set of quotation folios that already have an order generated
  const foliosWithOrder = useMemo(() => {
    const set = new Set<string>();
    dbOrders.forEach(o => {
      if (o.quotation_folio) set.add(o.quotation_folio);
    });
    return set;
  }, [dbOrders]);

  // Map DB quotations to local Quotation type
  const quotations: Quotation[] = useMemo(() => dbQuotations.map(q => ({
    id: q.id,
    folio: q.folio,
    customerId: q.customer_id || '',
    customerName: q.customer_name,
    customerPhone: q.customer_phone || undefined,
    customerWhatsapp: q.customer_whatsapp || undefined,
    vendorId: q.vendor_id || '',
    vendorName: q.vendor_name,
    vendorPhone: q.vendor_phone || undefined,
    vendorEmail: q.vendor_email || undefined,
    items: (q.items || []).map((it: any) => ({
      productId: it.productId || '',
      productName: it.productName || it.name || '',
      productImage: it.productImage || '/placeholder.svg',
      sku: it.sku || '',
      qty: it.qty || 0,
      unitPrice: it.unitPrice || 0,
      discount: it.discount || 0,
    })),
    subtotal: q.subtotal,
    tax: q.tax,
    total: q.total,
    status: q.status as QuotationStatus,
    validUntil: q.valid_until,
    createdAt: q.created_at?.slice(0, 10) || '',
  })), [dbQuotations]);

  // Map DB orders to local Order type for conversion flow
  const orders: Order[] = useMemo(() => dbOrders.map(o => ({
    id: o.id,
    folio: o.folio,
    customerId: o.customer_id || '',
    customerName: o.customer_name,
    vendorName: o.vendor_name,
    items: (o.items || []).map((it: any) => ({ productName: it.name || it.productName || '', qty: it.qty || 0, unitPrice: it.unitPrice || 0 })),
    total: o.total,
    advance: o.advance,
    balance: o.balance,
    status: o.status as any,
    warehouse: o.warehouse,
    promiseDate: o.promise_date || '',
    createdAt: o.created_at?.slice(0, 10) || '',
    orderType: o.order_type as OrderType,
  })), [dbOrders]);
  const [search, setSearch] = useState('');
  const [dateFrom, setDateFrom] = useState<Date | undefined>();
  const [dateTo, setDateTo] = useState<Date | undefined>();
  const [showCreate, setShowCreate] = useState(false);
  const [showPreview, setShowPreview] = useState<Quotation | null>(null);
  const [showWhatsApp, setShowWhatsApp] = useState<Quotation | null>(null);
  const [showZipDialog, setShowZipDialog] = useState(false);
  const [whatsappMsg, setWhatsappMsg] = useState(demoWhatsAppTemplate.message);
  const [zipDateFrom, setZipDateFrom] = useState('');
  const [zipDateTo, setZipDateTo] = useState('');
  const [zipVendorId, setZipVendorId] = useState('');
  const [zipStatus, setZipStatus] = useState('');
  const [zipLoading, setZipLoading] = useState(false);

  const [selectedCustomerId, setSelectedCustomerId] = useState('');
  const [selectedVendorId, setSelectedVendorId] = useState(currentRole === 'vendedor' ? DEMO_VENDEDOR_ID : '');
  const [items, setItems] = useState<QuotationItem[]>([]);
  const [productSearch, setProductSearch] = useState('');
  const [sparePartSearch, setSparePartSearch] = useState('');
  const [validDays, setValidDays] = useState(15);
  const [showNoProspectAlert, setShowNoProspectAlert] = useState(false);

  // Conversion flow state
  const [convertQuotation, setConvertQuotation] = useState<Quotation | null>(null);
  const [orderTypeStep, setOrderTypeStep] = useState<'select' | 'details' | 'confirm'>('select');
  const [selectedOrderType, setSelectedOrderType] = useState<OrderType | null>(null);
  const [advanceAmount, setAdvanceAmount] = useState(0);
  const [advanceMethod, setAdvanceMethod] = useState<Payment['method']>('transferencia');
  const [advanceReference, setAdvanceReference] = useState('');
  const [advanceDate, setAdvanceDate] = useState('');
  const [scheduledDate, setScheduledDate] = useState('');
  const [deliveryNotes, setDeliveryNotes] = useState('');
  const [reserveDeadline, setReserveDeadline] = useState('');
  const [isGeneratingOrder, setIsGeneratingOrder] = useState(false);

  const isVendedor = currentRole === 'vendedor';
  const vendorId = DEMO_VENDEDOR_ID;

  const visibleQuotations = isVendedor
    ? quotations.filter(q => q.vendorId === vendorId)
    : quotations;

  const filtered = visibleQuotations.filter(q => {
    if (search && !q.customerName.toLowerCase().includes(search.toLowerCase()) && !q.folio.toLowerCase().includes(search.toLowerCase())) return false;
    if (dateFrom) {
      const d = new Date(q.createdAt);
      if (d < dateFrom) return false;
    }
    if (dateTo) {
      const end = new Date(dateTo);
      end.setHours(23, 59, 59, 999);
      const d = new Date(q.createdAt);
      if (d > end) return false;
    }
    return true;
  });

  const vendors = dbTeamMembers.filter(u => u.role === 'vendedor' && u.active);

  const addItem = (productId: string) => {
    const product = dbProducts.find(p => p.id === productId);
    if (!product) return;
    const priceInMxn = product.currency === 'USD' ? Math.round(product.list_price * exchangeRate) : product.list_price;
    // Use main image: first from images array, then single image, then fallback
    const images = Array.isArray(product.images) ? product.images as string[] : [];
    const mainImage = images[0] || product.image || getProductImage(product.id);
    setItems(prev => [...prev, {
      productId: product.id,
      productName: product.name,
      productImage: mainImage,
      sku: product.sku,
      qty: 1,
      unitPrice: priceInMxn,
      discount: 0,
    }]);
  };

  const addSparePart = (sparePartId: string) => {
    const sparePart = demoSpareParts.find(sp => sp.id === sparePartId);
    if (!sparePart) return;
    setItems(prev => [...prev, {
      productId: sparePart.id,
      productName: sparePart.name,
      productImage: '/placeholder.svg',
      sku: sparePart.sku,
      qty: 1,
      unitPrice: sparePart.price,
      discount: 0,
    }]);
  };

  const removeItem = (idx: number) => setItems(prev => prev.filter((_, i) => i !== idx));

  const updateItem = (idx: number, field: keyof QuotationItem, value: any) => {
    setItems(prev => prev.map((item, i) => i === idx ? { ...item, [field]: value } : item));
  };

  const calcSubtotal = () => items.reduce((sum, item) => {
    const lineTotal = item.qty * item.unitPrice * (1 - (item.discount || 0) / 100);
    return sum + lineTotal;
  }, 0);

  const handleCreateQuotation = () => {
    if (!selectedCustomerId) { setShowNoProspectAlert(true); return; }
    if (!selectedVendorId) { toast.error('Selecciona un vendedor'); return; }
    if (items.length === 0) { toast.error('Agrega al menos un producto'); return; }

    const subtotal = calcSubtotal();
    const tax = Math.round(subtotal * IVA_RATE * 100) / 100;
    const total = Math.round((subtotal + tax) * 100) / 100;
    const vendor = dbTeamMembers.find(u => u.id === selectedVendorId);
    const customer = dbCustomers.find(c => c.id === selectedCustomerId);
    const folio = getNextFolioFromDB(selectedVendorId);

    const today = new Date();
    const validDate = new Date(today);
    validDate.setDate(validDate.getDate() + validDays);
    const fmtDate = (d: Date) => d.toISOString().split('T')[0];

    const newQuotation: Quotation = {
      id: `q-${Date.now()}`,
      folio,
      customerId: selectedCustomerId,
      customerName: customer?.name || '',
      customerPhone: customer?.phone,
      customerWhatsapp: customer?.whatsapp || customer?.phone,
      vendorId: selectedVendorId,
      vendorName: vendor?.name || '',
      vendorPhone: vendor?.phone,
      vendorEmail: vendor?.email,
      items: [...items],
      subtotal: Math.round(subtotal * 100) / 100,
      tax,
      total,
      status: 'borrador' as QuotationStatus,
      validUntil: fmtDate(validDate),
      createdAt: fmtDate(today),
    };

    addQuotationMutation.mutate({
      folio,
      customer_id: selectedCustomerId,
      customer_name: customer?.name || '',
      customer_phone: customer?.phone || null,
      customer_whatsapp: customer?.whatsapp || customer?.phone || null,
      vendor_id: selectedVendorId,
      vendor_name: vendor?.name || '',
      vendor_phone: vendor?.phone || null,
      vendor_email: vendor?.email || null,
      items: [...items] as any,
      subtotal: Math.round(subtotal * 100) / 100,
      tax,
      total,
      status: 'borrador',
      valid_until: fmtDate(validDate),
    });

    toast.success(
      <div>
        <div className="font-semibold">Cotización {folio} creada</div>
        <div className="text-xs mt-0.5">{customer?.name} — {fmt(total)}</div>
      </div>
    );
    setShowCreate(false);
    resetForm();
  };

  const resetForm = () => {
    setSelectedCustomerId('');
    setSelectedVendorId(isVendedor ? vendorId : '');
    setItems([]);
    setValidDays(15);
    setEditingQuotation(null);
  };

  // --- Edit quotation ---
  const [editingQuotation, setEditingQuotation] = useState<Quotation | null>(null);

  const openEditQuotation = (q: Quotation) => {
    setEditingQuotation(q);
    setSelectedCustomerId(q.customerId);
    setSelectedVendorId(q.vendorId || '');
    setItems([...q.items]);
    setValidDays(Math.max(1, Math.round((new Date(q.validUntil).getTime() - new Date(q.createdAt).getTime()) / (1000 * 60 * 60 * 24))));
    setShowCreate(true);
  };

  const handleSaveEdit = () => {
    if (!editingQuotation) return;
    if (!selectedCustomerId) { toast.error('Selecciona un cliente'); return; }
    if (items.length === 0) { toast.error('Agrega al menos un producto'); return; }

    const subtotal = calcSubtotal();
    const tax = Math.round(subtotal * IVA_RATE * 100) / 100;
    const total = Math.round((subtotal + tax) * 100) / 100;
    const vendor = dbTeamMembers.find(u => u.id === selectedVendorId);
    const customer = dbCustomers.find(c => c.id === selectedCustomerId);

    const today = new Date();
    const validDate = new Date(today);
    validDate.setDate(validDate.getDate() + validDays);
    const fmtDate = (d: Date) => d.toISOString().split('T')[0];

    const updated: Quotation = {
      ...editingQuotation,
      customerId: selectedCustomerId,
      customerName: customer?.name || '',
      customerPhone: customer?.phone,
      customerWhatsapp: customer?.whatsapp || customer?.phone,
      vendorId: selectedVendorId,
      vendorName: vendor?.name || '',
      vendorPhone: vendor?.phone,
      vendorEmail: vendor?.email,
      items: [...items],
      subtotal: Math.round(subtotal * 100) / 100,
      tax,
      total,
      validUntil: fmtDate(validDate),
    };

    updateQuotationMutation.mutate({
      id: editingQuotation.id,
      customer_id: updated.customerId || null,
      customer_name: updated.customerName,
      customer_phone: updated.customerPhone || null,
      customer_whatsapp: updated.customerWhatsapp || null,
      vendor_id: updated.vendorId || null,
      vendor_name: updated.vendorName,
      vendor_phone: updated.vendorPhone || null,
      vendor_email: updated.vendorEmail || null,
      items: updated.items,
      subtotal: updated.subtotal,
      tax: updated.tax,
      total: updated.total,
      valid_until: updated.validUntil,
    });
    setShowCreate(false);
    resetForm();
  };

  // --- Quotation status change ---
  const QUOTATION_STATUSES: { value: QuotationStatus; label: string }[] = [
    { value: 'borrador', label: 'Borrador' },
    { value: 'enviada', label: 'Enviada' },
    { value: 'vista', label: 'Vista' },
    { value: 'seguimiento', label: 'Seguimiento' },
    { value: 'aceptada', label: 'Aceptada' },
    { value: 'rechazada', label: 'Rechazada' },
    { value: 'vencida', label: 'Vencida' },
  ];

  const handleStatusChange = (q: Quotation, newStatus: QuotationStatus) => {
    const oldStatus = q.status;
    updateQuotationStatusMutation.mutate({ id: q.id, status: newStatus });
    addAuditLog({ userId: 'current', userName: 'Usuario actual', userRole: currentRole, module: 'cotizaciones', action: 'cambio_estatus', entityId: q.id, previousValue: oldStatus, newValue: newStatus, comment: `Cotización ${q.folio}: ${oldStatus} → ${newStatus}` });
    if (newStatus === 'aceptada') {
      openConversion(q);
    }
    toast.success(`Estatus actualizado a "${QUOTATION_STATUSES.find(s => s.value === newStatus)?.label}"`);
  };

  // --- Conversion flow ---
  const openConversion = (q: Quotation) => {
    setConvertQuotation(q);
    setOrderTypeStep('select');
    setSelectedOrderType(null);
    setAdvanceAmount(0);
    setAdvanceMethod('transferencia');
    setAdvanceReference('');
    setAdvanceDate(new Date().toISOString().slice(0, 10));
    setScheduledDate('');
    setDeliveryNotes('');
    setReserveDeadline('');
    setIsGeneratingOrder(false);
  };

  const getOrderStatusForType = (type: OrderType): Order['status'] => {
    switch (type) {
      case 'directo': return 'confirmado';
      case 'anticipo': return 'confirmado_anticipo';
      case 'apartado': return 'apartado';
      case 'entrega_futura': return 'entrega_programada';
    }
  };

  const ORDER_TYPE_OPTIONS: { value: OrderType; label: string; desc: string; icon: typeof ShoppingCart }[] = [
    { value: 'directo', label: 'Pedido directo', desc: 'El cliente paga completo o acepta inmediatamente', icon: PackageCheck },
    { value: 'anticipo', label: 'Pedido con anticipo', desc: 'El cliente paga un anticipo para confirmar', icon: CreditCard },
    { value: 'apartado', label: 'Pedido apartado', desc: 'El cliente aparta el equipo sin pago', icon: ShoppingCart },
    { value: 'entrega_futura', label: 'Entrega futura', desc: 'El cliente compra para recibir después', icon: CalendarClock },
  ];

  const handleGenerateOrder = async () => {
    if (!convertQuotation || !selectedOrderType || isGeneratingOrder) return;
    const q = convertQuotation;

    if (selectedOrderType === 'anticipo' && advanceAmount <= 0) {
      toast.error('Ingresa el monto del anticipo');
      return;
    }
    if (selectedOrderType === 'entrega_futura' && !scheduledDate) {
      toast.error('Selecciona la fecha de entrega programada');
      return;
    }

    const folio = `PED-2026-${String(orders.length + 1).padStart(3, '0')}`;
    const advance = selectedOrderType === 'anticipo' ? advanceAmount : selectedOrderType === 'directo' ? q.total : 0;
    const balance = q.total - advance;
    const today = new Date().toISOString().slice(0, 10);

    setIsGeneratingOrder(true);
    try {
      const createdOrder = await addOrderMutation.mutateAsync({
        folio,
        customer_id: q.customerId || null,
        customer_name: q.customerName,
        vendor_name: q.vendorName,
        items: q.items.map(it => ({ productId: it.productId, name: it.productName, qty: it.qty, unitPrice: it.unitPrice * (1 - (it.discount || 0) / 100) })),
        total: q.total,
        advance,
        balance: Math.max(0, balance),
        status: getOrderStatusForType(selectedOrderType),
        order_type: selectedOrderType,
        warehouse: 'Bodega Principal',
        promise_date: selectedOrderType === 'entrega_futura' ? scheduledDate : today,
        quotation_folio: q.folio,
        scheduled_delivery_date: selectedOrderType === 'entrega_futura' ? scheduledDate : null,
        delivery_notes: deliveryNotes || null,
        reserve_deadline: selectedOrderType === 'apartado' ? reserveDeadline : null,
        transportista: '',
        guia_numero: '',
        fecha_envio: null,
        shipping_images: [],
        invoice_number_manual: '',
        invoice_date_manual: null,
        invoice_pdf_url: '',
        edit_history: [],
      });

      const receivableStatus = advance >= q.total ? 'liquidado' : advance > 0 ? 'al_corriente' : selectedOrderType === 'apartado' ? 'por_vencer' : 'al_corriente';
      const dueDate = selectedOrderType === 'apartado' && reserveDeadline ? reserveDeadline : selectedOrderType === 'entrega_futura' ? scheduledDate : today;
      addReceivableMutation.mutate({
        order_id: createdOrder.id,
        customer_id: q.customerId,
        customer_name: q.customerName,
        order_folio: folio,
        total: q.total,
        paid: advance,
        balance: Math.max(0, balance),
        due_date: dueDate,
        days_overdue: 0,
        status: receivableStatus,
      });

      addAuditLog({
        userId: 'current', userName: 'Usuario actual', userRole: currentRole,
        module: 'cotizaciones', action: 'convertir_a_pedido', entityId: q.id,
        newValue: `${folio} (${selectedOrderType})`,
        comment: `Cotización ${q.folio} convertida a pedido ${folio} — Tipo: ${selectedOrderType}${advance > 0 ? ` — Anticipo: ${fmt(advance)}` : ''}`,
      });

      const warehouse = 'Bodega Principal';
      for (const item of q.items) {
        if (!item.productId) continue;
        const product = dbProducts.find(p => p.id === item.productId);
        if (!product) continue;
        const currentStock = (product.stock as Record<string, number>)[warehouse] ?? 0;
        const newStock = Math.max(0, currentStock - item.qty);
        const updatedStock = { ...(product.stock as Record<string, number>), [warehouse]: newStock };
        updateProductMutation.mutate({ id: product.id, stock: updatedStock });
      }

      updateQuotationStatusMutation.mutate({ id: q.id, status: 'aceptada' });

      toast.success(
        <div>
          <div className="font-semibold">Pedido {folio} generado</div>
          <div className="text-xs mt-0.5">Desde cotización {q.folio} — {ORDER_TYPE_OPTIONS.find(o => o.value === selectedOrderType)?.label}</div>
        </div>
      );

      setConvertQuotation(null);
    } catch (err: any) {
      console.error('Error generating order:', err);
      toast.error('Error al generar pedido: ' + (err?.message || JSON.stringify(err) || 'Intenta de nuevo'));
    } finally {
      setIsGeneratingOrder(false);
    }
  };

  const handleWhatsAppSend = (q: Quotation) => {
    // Always use the latest phone from the customer database
    const liveCustomer = q.customerId ? dbCustomers.find(c => c.id === q.customerId) : null;
    const customerPhone = liveCustomer?.whatsapp || liveCustomer?.phone?.replace(/[^0-9]/g, '') || q.customerWhatsapp || q.customerPhone?.replace(/[^0-9]/g, '');
    if (!customerPhone) { toast.error('El cliente no tiene número de WhatsApp registrado.'); return; }
    const cleanPhone = customerPhone.startsWith('52') ? customerPhone : `52${customerPhone.replace(/[^0-9]/g, '')}`;
    
    // Use vendor's WhatsApp number so the link opens on the vendor's device sending TO the customer
    const vendor = dbTeamMembers.find(u => u.id === q.vendorId);
    const vendorWa = vendor?.whatsapp || vendor?.phone?.replace(/[^0-9]/g, '') || '';

    // wa.me sends TO the customer's number — this opens WhatsApp on whichever device opens the link
    const url = `https://wa.me/${cleanPhone}?text=${encodeURIComponent(whatsappMsg)}`;
    window.open(url, '_blank');
    toast.success(`Abriendo WhatsApp para enviar a ${q.customerName}...`);
    setShowWhatsApp(null);
  };

  const normalizeImageSrc = (src: string) => {
    if (!src || src === '/placeholder.svg') return '';
    if (src.startsWith('data:') || src.startsWith('blob:')) return src;
    if (src.startsWith('http://') || src.startsWith('https://')) return src;
    return `${window.location.origin}${src.startsWith('/') ? src : `/${src}`}`;
  };

  // Helper: convert image URL to base64 data URL
  const toBase64 = (url: string): Promise<string> => {
    return new Promise((resolve) => {
      if (!url || url === '/placeholder.svg') { resolve(''); return; }
      if (url.startsWith('data:')) { resolve(url); return; }

      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.onload = () => {
        try {
          const canvas = document.createElement('canvas');
          canvas.width = img.naturalWidth;
          canvas.height = img.naturalHeight;
          const ctx = canvas.getContext('2d');
          ctx?.drawImage(img, 0, 0);
          resolve(canvas.toDataURL('image/jpeg', 0.85));
        } catch { resolve(''); }
      };
      img.onerror = () => resolve('');
      img.src = url;
    });
  };

  // PDF that replicates QuotationPreview exactly
  const handleDownloadPdf = async (q: Quotation) => {
    const company = demoCompanyInfo;
    const conditions = demoSalesConditions;

    // Pre-convert all product images to base64
    const imagePromises = q.items.map((item) => {
      return toBase64(normalizeImageSrc(item.productImage || ''));
    });
    const base64Images = await Promise.all(imagePromises);

    const itemsHtml = q.items.map((item, idx) => {
      const lineTotal = item.qty * item.unitPrice * (1 - (item.discount || 0) / 100);
      const b64 = base64Images[idx];
      const imgTag = b64
        ? `<img src="${b64}" alt="${item.productName}" style="width:100%;height:100%;object-fit:cover;" />`
        : `<div style="width:100%;height:100%;display:flex;align-items:center;justify-content:center;color:hsl(0,0%,70%);font-size:11px;">Sin imagen</div>`;
      return `
        <div style="border-radius:12px;overflow:hidden;border:1px solid hsl(0,0%,90%);margin-bottom:16px;page-break-inside:avoid;">
          <div style="display:flex;">
            <div style="width:180px;height:140px;flex-shrink:0;overflow:hidden;background:hsl(0,0%,95%);">
              ${imgTag}
            </div>
            <div style="flex:1;padding:16px;display:flex;flex-direction:column;justify-content:space-between;min-width:0;">
              <div>
                <div style="font-weight:700;font-size:15px;line-height:1.3;">${item.productName}</div>
                ${item.sku ? `<div style="font-size:10px;font-family:monospace;color:hsl(0,0%,50%);margin-top:4px;">${item.sku}</div>` : ''}
                ${item.discount > 0 ? `<span style="display:inline-block;margin-top:6px;font-size:10px;font-weight:600;padding:2px 8px;border-radius:12px;background:hsla(0,80%,50%,0.1);color:hsl(0,80%,50%);">Desc. ${item.discount}%</span>` : ''}
              </div>
              <div style="display:flex;align-items:flex-end;justify-content:space-between;margin-top:12px;padding-top:8px;border-top:1px solid hsl(0,0%,93%);">
                <div style="display:flex;gap:24px;">
                  <div>
                    <div style="font-size:9px;text-transform:uppercase;letter-spacing:0.05em;color:hsl(0,0%,55%);font-weight:600;">Cantidad</div>
                    <div style="font-weight:700;font-size:14px;margin-top:2px;">${item.qty}</div>
                  </div>
                  <div>
                    <div style="font-size:9px;text-transform:uppercase;letter-spacing:0.05em;color:hsl(0,0%,55%);font-weight:600;">P. Unitario</div>
                    <div style="font-weight:700;font-size:14px;margin-top:2px;">${fmt(item.unitPrice)}</div>
                  </div>
                </div>
                <div style="text-align:right;">
                  <div style="font-size:9px;text-transform:uppercase;letter-spacing:0.05em;color:hsl(0,0%,55%);font-weight:600;">Subtotal</div>
                  <div style="font-weight:900;font-size:16px;color:#dc2626;margin-top:2px;">${fmt(lineTotal)}</div>
                </div>
              </div>
            </div>
          </div>
        </div>`;
    }).join('');

    const html = `<!DOCTYPE html>
<html><head><meta charset="utf-8"><title>Cotización ${q.folio}</title>
<style>
  @page { margin: 0; size: letter; }
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Arial, sans-serif; color: hsl(0,0%,12%); font-size: 13px; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  @media print { body { -webkit-print-color-adjust: exact; print-color-adjust: exact; } }
</style></head>
<body>
  <!-- RED ACCENT BAR -->
  <div style="height:8px;background:#dc2626;width:100%;"></div>

  <!-- HEADER -->
  <div style="padding:24px 32px 20px;display:flex;justify-content:space-between;align-items:flex-start;">
    <div style="display:flex;align-items:center;gap:16px;">
    <div style="display:flex;align-items:flex-start;gap:16px;">
      <img src="${getCompanyLogoUrl()}" alt="Logo" style="height:56px;max-width:140px;object-fit:contain;border-radius:8px;" onerror="this.style.display='none'" />
      <div>
        <div style="font-weight:800;font-size:20px;letter-spacing:-0.5px;line-height:1.2;">${company.nombreComercial}</div>
        <div style="font-size:11px;color:hsl(0,0%,50%);margin-top:2px;">${company.razonSocial}</div>
        <div style="font-size:11px;color:hsl(0,0%,50%);line-height:1.5;margin-top:4px;">${company.direccion}<br/>Tel: ${company.telefono} · ${company.correo}<br/>RFC: ${company.rfc}</div>
      </div>
    </div>
    </div>
    <div style="text-align:right;flex-shrink:0;">
      <div style="display:inline-block;padding:8px 16px;border-radius:8px;background:rgba(220,38,38,0.08);color:#dc2626;font-weight:900;font-size:24px;letter-spacing:-0.5px;">${q.folio}</div>
      <div style="font-size:11px;color:hsl(0,0%,50%);margin-top:8px;line-height:1.6;">
        <span style="font-weight:600;color:hsl(0,0%,25%);">Fecha:</span> ${q.createdAt}<br/>
        <span style="font-weight:600;color:hsl(0,0%,25%);">Vigencia:</span> ${q.validUntil}
      </div>
    </div>
  </div>

  <div style="height:1px;background:hsl(0,0%,90%);margin:0 32px;"></div>

  <!-- CLIENT & VENDOR -->
  <div style="padding:20px 32px;display:flex;gap:20px;">
    <div style="flex:1;border-radius:12px;padding:16px;background:hsl(0,0%,97%);border:1px solid hsl(0,0%,90%);">
      <div style="font-size:9px;text-transform:uppercase;letter-spacing:0.15em;font-weight:700;color:#dc2626;margin-bottom:8px;">Cliente</div>
      <div style="font-weight:700;font-size:15px;line-height:1.3;">${q.customerName}</div>
      ${q.customerPhone ? `<div style="font-size:11px;color:hsl(0,0%,50%);margin-top:6px;">Tel: ${q.customerPhone}</div>` : ''}
    </div>
    <div style="flex:1;border-radius:12px;padding:16px;background:hsl(0,0%,97%);border:1px solid hsl(0,0%,90%);">
      <div style="font-size:9px;text-transform:uppercase;letter-spacing:0.15em;font-weight:700;color:#dc2626;margin-bottom:8px;">Vendedor</div>
      <div style="font-weight:700;font-size:15px;line-height:1.3;">${q.vendorName}</div>
      <div style="font-size:11px;color:hsl(0,0%,50%);margin-top:6px;line-height:1.5;">
        ${q.vendorPhone ? `Tel: ${q.vendorPhone}` : ''}${q.vendorEmail ? ` · ${q.vendorEmail}` : ''}
      </div>
    </div>
  </div>

  <!-- PRODUCTS LABEL -->
  <div style="padding:0 32px;font-size:9px;text-transform:uppercase;letter-spacing:0.15em;font-weight:700;color:#dc2626;margin-bottom:12px;">Productos cotizados</div>

  <!-- PRODUCT CARDS -->
  <div style="padding:0 32px;">${itemsHtml}</div>

  <!-- TOTALS -->
  <div style="margin:0 32px 24px;border-radius:12px;overflow:hidden;border:1px solid hsl(0,0%,88%);page-break-inside:avoid;">
    <div style="padding:20px;background:hsl(0,0%,97%);">
      <div style="display:flex;justify-content:space-between;align-items:center;font-size:14px;margin-bottom:8px;">
        <span style="color:hsl(0,0%,50%);">Subtotal</span>
        <span style="font-weight:600;">${fmt(q.subtotal)}</span>
      </div>
      <div style="display:flex;justify-content:space-between;align-items:center;font-size:14px;">
        <span style="color:hsl(0,0%,50%);">IVA 16%</span>
        <span style="font-weight:600;">${fmt(q.tax)}</span>
      </div>
    </div>
    <div style="padding:16px 20px;background:#dc2626;color:#fff;display:flex;justify-content:space-between;align-items:center;">
      <div>
        <div style="font-size:10px;text-transform:uppercase;letter-spacing:0.12em;font-weight:600;opacity:0.8;">Total a pagar</div>
        <div style="font-size:11px;opacity:0.7;margin-top:2px;">${numberToWords(q.total)}</div>
      </div>
      <div style="font-weight:900;font-size:24px;letter-spacing:-0.5px;">${fmt(q.total)}</div>
    </div>
  </div>

  <!-- CONDITIONS -->
  <div style="margin:0 32px 24px;border-radius:12px;padding:20px;background:hsl(0,0%,97%);border:1px solid hsl(0,0%,90%);page-break-inside:avoid;">
    <div style="font-size:9px;text-transform:uppercase;letter-spacing:0.15em;font-weight:700;color:hsl(0,0%,45%);margin-bottom:12px;">Condiciones Generales de Venta</div>
    <div style="font-size:11px;color:hsl(0,0%,45%);white-space:pre-line;line-height:1.7;">${conditions.text}</div>
  </div>

  <!-- FOOTER -->
  <div style="padding:0 32px 24px;display:flex;justify-content:space-between;align-items:center;">
    <div style="font-size:10px;color:hsl(0,0%,60%);">Cotización generada por REDBUCK ERP CRM</div>
    <div style="display:flex;align-items:center;gap:8px;">
      <div style="width:20px;height:20px;border-radius:4px;background:#dc2626;color:#fff;display:flex;align-items:center;justify-content:center;font-weight:900;font-size:8px;">RB</div>
      <span style="font-size:10px;font-weight:700;color:hsl(0,0%,40%);">redbuck.mx</span>
    </div>
  </div>
</body></html>`;

    const printWindow = window.open('', '_blank');
    if (printWindow) {
      printWindow.document.write(html);
      printWindow.document.close();

      const printWhenReady = () => {
        const images = Array.from(printWindow.document.images);
        if (images.length === 0) {
          printWindow.print();
          return;
        }

        let pending = images.length;
        const done = () => {
          pending -= 1;
          if (pending <= 0) {
            setTimeout(() => printWindow.print(), 100);
          }
        };

        images.forEach((image) => {
          if (image.complete) {
            done();
            return;
          }

          image.addEventListener('load', done, { once: true });
          image.addEventListener('error', done, { once: true });
        });
      };

      printWindow.addEventListener('load', printWhenReady, { once: true });
    } else {
      toast.error('Permite las ventanas emergentes para descargar el PDF.');
    }
  };

  const handleZipDownload = async () => {
    if (!zipDateFrom || !zipDateTo) { toast.error('Selecciona un rango de fechas'); return; }
    if (zipDateFrom > zipDateTo) { toast.error('La fecha inicial no puede ser mayor a la final'); return; }
    setZipLoading(true);
    try {
      const result = await exportQuotationsZip(quotations, { dateFrom: zipDateFrom, dateTo: zipDateTo, vendorId: zipVendorId || undefined, status: zipStatus || undefined });
      toast.success(`ZIP generado con ${result.count} cotizaciones`);
      setShowZipDialog(false);
    } catch (err: any) {
      toast.error(err.message || 'Error al generar ZIP');
    } finally {
      setZipLoading(false);
    }
  };

  const handleExcelDownload = () => {
    if (!zipDateFrom || !zipDateTo) { toast.error('Selecciona un rango de fechas'); return; }
    if (zipDateFrom > zipDateTo) { toast.error('La fecha inicial no puede ser mayor a la final'); return; }
    try {
      const result = exportQuotationsExcel(quotations, { dateFrom: zipDateFrom, dateTo: zipDateTo, vendorId: zipVendorId || undefined, status: zipStatus || undefined });
      toast.success(`Excel generado con ${result.count} cotizaciones`);
    } catch (err: any) {
      toast.error(err.message || 'Error al generar Excel');
    }
  };

  const zipFilteredCount = quotations.filter(q => {
    if (zipDateFrom && q.createdAt < zipDateFrom) return false;
    if (zipDateTo && q.createdAt > zipDateTo) return false;
    if (zipVendorId && q.vendorId !== zipVendorId) return false;
    if (zipStatus && q.status !== zipStatus) return false;
    return true;
  }).length;

  const subtotalPreview = calcSubtotal();
  const taxPreview = Math.round(subtotalPreview * IVA_RATE * 100) / 100;
  const totalPreview = Math.round((subtotalPreview + taxPreview) * 100) / 100;
  const nextFolioPreview = selectedVendorId ? getNextFolioFromDB(selectedVendorId) : null;

  return (
    <div>
      <div className="page-header flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="page-title">Cotizaciones</h1>
          <p className="page-subtitle">Gestión de cotizaciones comerciales — seriadas por vendedor · {quotations.length} registros</p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => setShowZipDialog(true)} className="inline-flex items-center gap-2 px-3 py-2 rounded-lg border text-sm font-medium hover:bg-muted transition-colors">
            <Download size={16} /> Descargar Excel
          </button>
          <button onClick={() => { resetForm(); setShowCreate(true); }} className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:opacity-90 transition-opacity">
            <Plus size={16} /> Nueva cotización
          </button>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <MetricCard title="Total" value={quotations.length} icon={FileText} />
        <MetricCard title="Enviadas" value={quotations.filter(q => q.status === 'enviada' || q.status === 'seguimiento').length} icon={Send} variant="primary" />
        <MetricCard title="Aceptadas" value={quotations.filter(q => q.status === 'aceptada').length} icon={CheckCircle} variant="success" />
        <MetricCard title="Valor total" value={fmt(quotations.reduce((s, q) => s + q.total, 0))} icon={FileText} />
      </div>

      <div className="flex items-center gap-3 mb-4 flex-wrap">
        <div className="relative flex-1 max-w-sm">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Buscar por folio o cliente..." className="w-full pl-9 pr-3 py-2 rounded-lg border bg-card text-sm outline-none focus:ring-2 focus:ring-primary/20" />
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

        <span className="text-xs text-muted-foreground ml-auto">{filtered.length} cotizaciones</span>
      </div>

      <div className="bg-card rounded-xl border overflow-x-auto">
        <table className="data-table">
          <thead>
            <tr><th>Folio</th><th>Cliente</th><th>Vendedor</th><th>Total</th><th>Estatus</th><th>Vigencia</th><th>Fecha</th><th></th></tr>
          </thead>
          <tbody>
            {filtered.map(q => (
              <tr key={q.id}>
                <td className="font-mono text-xs font-semibold">{q.folio}</td>
                <td className="font-medium">{q.customerName}</td>
                <td className="text-muted-foreground">{q.vendorName}</td>
                <td className="font-semibold">{fmt(q.total)}</td>
                <td>
                  <select value={q.status} onChange={e => handleStatusChange(q, e.target.value as QuotationStatus)} className="text-xs font-medium px-2 py-1 rounded-lg border bg-background cursor-pointer focus:ring-2 focus:ring-primary/20 outline-none">
                    {QUOTATION_STATUSES.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
                  </select>
                </td>
                <td className="text-xs text-muted-foreground">{q.validUntil}</td>
                <td className="text-xs text-muted-foreground">{q.createdAt}</td>
                <td>
                  <div className="flex items-center gap-1">
                    {q.status === 'aceptada' && (
                      foliosWithOrder.has(q.folio)
                        ? <span className="p-1.5 rounded-md bg-green-500/20 text-green-600" title="Pedido ya generado"><ShoppingCart size={14} /></span>
                        : <button onClick={() => openConversion(q)} className="p-1.5 rounded-md hover:bg-primary/10 text-primary" title="Generar pedido"><ShoppingCart size={14} /></button>
                    )}
                    <button onClick={() => setShowPreview(q)} className="p-1.5 rounded-md hover:bg-muted" title="Vista previa"><Eye size={14} /></button>
                    <button onClick={() => openEditQuotation(q)} className="p-1.5 rounded-md hover:bg-muted text-amber-600" title="Editar cotización"><Pencil size={14} /></button>
                    <button onClick={() => { setWhatsappMsg(demoWhatsAppTemplate.message); setShowWhatsApp(q); }} className="p-1.5 rounded-md hover:bg-muted text-success" title="Enviar por WhatsApp"><MessageCircle size={14} /></button>
                    <button onClick={() => handleDownloadPdf(q)} className="p-1.5 rounded-md hover:bg-muted text-primary" title="Descargar PDF"><Download size={14} /></button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* CREATE QUOTATION DIALOG */}
      <Dialog open={showCreate} onOpenChange={setShowCreate}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingQuotation ? `Editar Cotización ${editingQuotation.folio}` : 'Nueva Cotización'}</DialogTitle>
            <DialogDescription>
              {editingQuotation ? 'Modifica los datos de la cotización.' : 'Selecciona un prospecto/cliente y agrega productos.'}
              {nextFolioPreview && <span className="ml-2 inline-flex items-center px-2 py-0.5 rounded-md font-mono font-bold text-primary bg-primary/10">Próximo folio: {nextFolioPreview}</span>}
            </DialogDescription>
          </DialogHeader>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1 block">Cliente / Prospecto *</label>
              <select value={selectedCustomerId} onChange={e => setSelectedCustomerId(e.target.value)} className="w-full px-3 py-2 rounded-lg border bg-card text-sm">
                <option value="">Seleccionar cliente...</option>
                {dbCustomers.map(c => <option key={c.id} value={c.id}>{c.name} — {c.city}</option>)}
              </select>
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1 block">Vendedor *</label>
              {isVendedor ? (
                <div className="w-full px-3 py-2 rounded-lg border bg-muted text-sm font-medium">
                  {vendors.find(v => v.id === vendorId)?.name ?? 'Vendedor'}
                </div>
              ) : (
                <select value={selectedVendorId} onChange={e => setSelectedVendorId(e.target.value)} className="w-full px-3 py-2 rounded-lg border bg-card text-sm">
                  <option value="">Seleccionar vendedor...</option>
                  {vendors.map(v => {
                    const current = getVendorCurrentNum(v.id);
                    return <option key={v.id} value={v.id}>{v.name} — Serie {v.seriesPrefix} (siguiente: {v.seriesPrefix}-{current + 1})</option>;
                  })}
                </select>
              )}
            </div>
          </div>

          <div className="mb-4">
            <label className="text-xs font-medium text-muted-foreground mb-1 block">Vigencia (días)</label>
            <input type="number" value={validDays} onChange={e => setValidDays(+e.target.value)} className="w-24 px-3 py-2 rounded-lg border bg-card text-sm" />
          </div>

          <div className="mb-4">
            <label className="text-xs font-medium text-muted-foreground mb-1 block">Agregar producto</label>
            <div className="flex gap-2">
              <div className="relative flex-1">
                <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                <input 
                  type="text" 
                  placeholder="Buscar por SKU o nombre..." 
                  value={productSearch}
                  onChange={e => setProductSearch(e.target.value)}
                  className="w-full pl-9 pr-3 py-2 rounded-lg border bg-card text-sm"
                />
              </div>
            </div>
            {productSearch.trim() && (
              <div className="mt-2 border rounded-lg max-h-48 overflow-y-auto bg-card">
                {dbProducts
                  .filter(p => p.active)
                  .filter(p => 
                    p.sku.toLowerCase().includes(productSearch.toLowerCase()) ||
                    p.name.toLowerCase().includes(productSearch.toLowerCase())
                  )
                  .slice(0, 10)
                  .map(p => (
                    <button
                      key={p.id}
                      type="button"
                      onClick={() => { addItem(p.id); setProductSearch(''); }}
                      className="w-full px-3 py-2 text-left hover:bg-muted flex items-center gap-3 border-b last:border-b-0"
                    >
                      <img src={getProductImage(p.id)} alt="" className="w-10 h-10 rounded object-cover bg-muted shrink-0" />
                      <div className="min-w-0 flex-1">
                        <div className="font-medium text-sm truncate">{p.name}</div>
                        <div className="text-xs text-muted-foreground">{p.sku} — {fmt(p.list_price)} {p.currency}</div>
                      </div>
                    </button>
                  ))
                }
                {dbProducts
                  .filter(p => p.active)
                  .filter(p => 
                    p.sku.toLowerCase().includes(productSearch.toLowerCase()) || 
                    p.name.toLowerCase().includes(productSearch.toLowerCase())
                  ).length === 0 && (
                  <div className="px-3 py-4 text-center text-sm text-muted-foreground">No se encontraron productos</div>
                )}
              </div>
            )}
          </div>

          <div className="mb-4">
            <label className="text-xs font-medium text-muted-foreground mb-1 block">Agregar refacción</label>
            <div className="flex gap-2">
              <div className="relative flex-1">
                <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                <input 
                  type="text" 
                  placeholder="Buscar refacción por SKU o nombre..." 
                  value={sparePartSearch}
                  onChange={e => setSparePartSearch(e.target.value)}
                  className="w-full pl-9 pr-3 py-2 rounded-lg border bg-card text-sm"
                />
              </div>
            </div>
            {sparePartSearch.trim() && (
              <div className="mt-2 border rounded-lg max-h-48 overflow-y-auto bg-card">
                {demoSpareParts
                  .filter(sp => sp.active)
                  .filter(sp => 
                    sp.sku.toLowerCase().includes(sparePartSearch.toLowerCase()) || 
                    sp.name.toLowerCase().includes(sparePartSearch.toLowerCase())
                  )
                  .slice(0, 10)
                  .map(sp => (
                    <button
                      key={sp.id}
                      type="button"
                      onClick={() => { addSparePart(sp.id); setSparePartSearch(''); }}
                      className="w-full px-3 py-2 text-left hover:bg-muted flex items-center gap-3 border-b last:border-b-0"
                    >
                      <div className="w-10 h-10 rounded bg-muted flex items-center justify-center shrink-0">
                        <span className="text-xs text-muted-foreground">REF</span>
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="font-medium text-sm truncate">{sp.name}</div>
                        <div className="text-xs text-muted-foreground">{sp.sku} — {fmt(sp.price)} MXN — Stock: {sp.stock}</div>
                      </div>
                    </button>
                  ))
                }
                {demoSpareParts
                  .filter(sp => sp.active)
                  .filter(sp => 
                    sp.sku.toLowerCase().includes(sparePartSearch.toLowerCase()) || 
                    sp.name.toLowerCase().includes(sparePartSearch.toLowerCase())
                  ).length === 0 && (
                  <div className="px-3 py-4 text-center text-sm text-muted-foreground">No se encontraron refacciones</div>
                )}
              </div>
            )}
          </div>

          {items.length > 0 && (
            <div className="border rounded-lg overflow-hidden mb-4">
              <table className="data-table">
                <thead><tr><th>Producto</th><th>Cant.</th><th>P. Unit.</th><th>Desc. %</th><th>Subtotal</th><th></th></tr></thead>
                <tbody>
                  {items.map((item, idx) => {
                    const lineTotal = item.qty * item.unitPrice * (1 - (item.discount || 0) / 100);
                    return (
                      <tr key={idx}>
                        <td>
                          <div className="flex items-center gap-3">
                            <img src={item.productImage || '/placeholder.svg'} alt="" className="w-12 h-12 rounded-lg object-cover bg-muted shrink-0" />
                            <div>
                              <div className="font-medium text-sm">{item.productName}</div>
                              <div className="text-xs text-muted-foreground">{item.sku}</div>
                            </div>
                          </div>
                        </td>
                        <td><input type="number" min={1} value={item.qty} onChange={e => updateItem(idx, 'qty', +e.target.value)} className="w-16 px-2 py-1 rounded border bg-card text-sm text-center" /></td>
                        <td><input type="number" value={item.unitPrice} onChange={e => updateItem(idx, 'unitPrice', +e.target.value)} className="w-28 px-2 py-1 rounded border bg-card text-sm text-right" /></td>
                        <td><input type="number" min={0} max={100} value={item.discount} onChange={e => updateItem(idx, 'discount', +e.target.value)} className="w-16 px-2 py-1 rounded border bg-card text-sm text-center" /></td>
                        <td className="font-semibold text-right">{fmt(lineTotal)}</td>
                        <td><button onClick={() => removeItem(idx)} className="p-1 text-destructive hover:bg-destructive/10 rounded"><Trash2 size={14} /></button></td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
              <div className="p-4 border-t space-y-1 text-right">
                <div className="text-sm">Subtotal: <span className="font-semibold">{fmt(subtotalPreview)}</span></div>
                <div className="text-sm">IVA 16%: <span className="font-semibold">{fmt(taxPreview)}</span></div>
                <div className="text-lg font-bold font-display">Total: {fmt(totalPreview)}</div>
                <div className="text-xs text-muted-foreground">{numberToWords(totalPreview)}</div>
              </div>
            </div>
          )}

          <DialogFooter>
            <button onClick={() => { setShowCreate(false); resetForm(); }} className="px-4 py-2 rounded-lg border text-sm font-medium">Cancelar</button>
            <button onClick={editingQuotation ? handleSaveEdit : handleCreateQuotation} className="px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:opacity-90">{editingQuotation ? 'Guardar Cambios' : 'Crear Cotización'}</button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* NO PROSPECT ALERT */}
      <Dialog open={showNoProspectAlert} onOpenChange={setShowNoProspectAlert}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Prospecto requerido</DialogTitle>
            <DialogDescription>Para generar una cotización primero debes registrar o seleccionar un prospecto o cliente.</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <button onClick={() => setShowNoProspectAlert(false)} className="px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-medium">Entendido</button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* QUOTATION PREVIEW */}
      <Dialog open={!!showPreview} onOpenChange={() => setShowPreview(null)}>
        <DialogContent className="max-w-[720px] max-h-[92vh] overflow-y-auto p-0">
          {showPreview && (
            <>
              <div className="sticky top-0 z-10 flex justify-end px-4 pt-3 pb-1">
                <Button size="sm" variant="outline" className="gap-2" onClick={() => handleDownloadPdf(showPreview)}>
                  <Download size={14} /> Descargar PDF
                </Button>
              </div>
              <QuotationPreview quotation={showPreview} />
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* WHATSAPP SEND */}
      <Dialog open={!!showWhatsApp} onOpenChange={() => setShowWhatsApp(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2"><MessageCircle size={20} className="text-success" /> Enviar por WhatsApp</DialogTitle>
            <DialogDescription>Cotización {showWhatsApp?.folio} para {showWhatsApp?.customerName}</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1 block">Número de destino</label>
              <div className="text-sm font-medium">{(() => {
                const liveCustomer = showWhatsApp?.customerId ? dbCustomers.find(c => c.id === showWhatsApp.customerId) : null;
                return liveCustomer?.whatsapp || liveCustomer?.phone || showWhatsApp?.customerWhatsapp || showWhatsApp?.customerPhone || '⚠️ Sin número registrado';
              })()}</div>
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1 block">Mensaje</label>
              <textarea value={whatsappMsg} onChange={e => setWhatsappMsg(e.target.value)} rows={3} className="w-full px-3 py-2 rounded-lg border bg-card text-sm resize-none" />
            </div>
          </div>
          <DialogFooter>
            <button onClick={() => setShowWhatsApp(null)} className="px-4 py-2 rounded-lg border text-sm font-medium">Cancelar</button>
            <button onClick={() => showWhatsApp && handleWhatsAppSend(showWhatsApp)} className="px-4 py-2 rounded-lg bg-success text-success-foreground text-sm font-medium hover:opacity-90 flex items-center gap-2">
              <MessageCircle size={16} /> Enviar
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ZIP DOWNLOAD */}
      <Dialog open={showZipDialog} onOpenChange={setShowZipDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2"><Download size={20} /> Descargar cotizaciones</DialogTitle>
            <DialogDescription>Selecciona un rango de fechas y filtros opcionales para descargar.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-xs font-medium text-muted-foreground mb-1 block">Fecha inicial *</label>
                <input type="date" value={zipDateFrom} onChange={e => setZipDateFrom(e.target.value)} className="w-full px-3 py-2 rounded-lg border bg-card text-sm" />
              </div>
              <div>
                <label className="text-xs font-medium text-muted-foreground mb-1 block">Fecha final *</label>
                <input type="date" value={zipDateTo} onChange={e => setZipDateTo(e.target.value)} className="w-full px-3 py-2 rounded-lg border bg-card text-sm" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-xs font-medium text-muted-foreground mb-1 block">Vendedor (opcional)</label>
                <select value={zipVendorId} onChange={e => setZipVendorId(e.target.value)} className="w-full px-3 py-2 rounded-lg border bg-card text-sm">
                  <option value="">Todos</option>
                  {vendors.map(v => <option key={v.id} value={v.id}>{v.name}</option>)}
                </select>
              </div>
              <div>
                <label className="text-xs font-medium text-muted-foreground mb-1 block">Estatus (opcional)</label>
                <select value={zipStatus} onChange={e => setZipStatus(e.target.value)} className="w-full px-3 py-2 rounded-lg border bg-card text-sm">
                  <option value="">Todos</option>
                  <option value="borrador">Borrador</option>
                  <option value="enviada">Enviada</option>
                  <option value="seguimiento">Seguimiento</option>
                  <option value="aceptada">Aceptada</option>
                  <option value="rechazada">Rechazada</option>
                  <option value="vencida">Vencida</option>
                </select>
              </div>
            </div>
          </div>
          {zipDateFrom && zipDateTo && (
            <div className="rounded-lg bg-muted/50 p-3 text-sm text-center">
              <span className="font-semibold text-primary">{zipFilteredCount}</span> cotización{zipFilteredCount !== 1 ? 'es' : ''} encontrada{zipFilteredCount !== 1 ? 's' : ''} en el periodo seleccionado
            </div>
          )}
          <DialogFooter className="flex-col sm:flex-row gap-2">
            <button onClick={() => setShowZipDialog(false)} className="px-4 py-2 rounded-lg border text-sm font-medium">Cancelar</button>
            <button onClick={handleExcelDownload} className="px-4 py-2 rounded-lg border border-primary/30 text-primary text-sm font-medium hover:bg-primary/5 flex items-center gap-2">
              <FileText size={16} /> Descargar Excel
            </button>
            <button onClick={handleZipDownload} disabled={zipLoading} className="px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-medium disabled:opacity-50 flex items-center gap-2">
              <Download size={16} /> {zipLoading ? 'Generando...' : 'Descargar ZIP'}
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* CONVERSION DIALOG */}
      <Dialog open={!!convertQuotation} onOpenChange={() => setConvertQuotation(null)}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          {convertQuotation && (
            <>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  <ShoppingCart size={20} className="text-primary" />
                  {orderTypeStep === 'select' ? 'Generar pedido desde cotización' : orderTypeStep === 'details' ? `Configurar — ${ORDER_TYPE_OPTIONS.find(o => o.value === selectedOrderType)?.label}` : 'Confirmar pedido'}
                </DialogTitle>
                <DialogDescription>Cotización {convertQuotation.folio} — {convertQuotation.customerName} — {fmt(convertQuotation.total)}</DialogDescription>
              </DialogHeader>

              {/* STEP 1: Select order type */}
              {orderTypeStep === 'select' && (
                <div className="grid grid-cols-2 gap-3">
                  {ORDER_TYPE_OPTIONS.map(opt => {
                    const Icon = opt.icon;
                    return (
                      <button key={opt.value} onClick={() => { setSelectedOrderType(opt.value); setOrderTypeStep(opt.value === 'directo' ? 'confirm' : 'details'); }} className={`p-4 rounded-xl border-2 text-left transition-all hover:border-primary hover:bg-primary/5 ${selectedOrderType === opt.value ? 'border-primary bg-primary/5' : 'border-border'}`}>
                        <Icon size={24} className="text-primary mb-2" />
                        <div className="font-semibold text-sm">{opt.label}</div>
                        <div className="text-xs text-muted-foreground mt-1">{opt.desc}</div>
                      </button>
                    );
                  })}
                </div>
              )}

              {/* STEP 2: Details for anticipo */}
              {orderTypeStep === 'details' && selectedOrderType === 'anticipo' && (
                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="text-xs font-medium text-muted-foreground">Monto del anticipo *</label>
                      <input type="number" value={advanceAmount} onChange={e => setAdvanceAmount(Number(e.target.value))} className="w-full mt-1 px-3 py-2 rounded-lg border bg-background text-sm" />
                    </div>
                    <div>
                      <label className="text-xs font-medium text-muted-foreground">Método de pago</label>
                      <select value={advanceMethod} onChange={e => setAdvanceMethod(e.target.value as Payment['method'])} className="w-full mt-1 px-3 py-2 rounded-lg border bg-background text-sm">
                        <option value="transferencia">Transferencia</option>
                        <option value="efectivo">Efectivo</option>
                        <option value="cheque">Cheque</option>
                        <option value="tarjeta">Tarjeta</option>
                        <option value="otro">Otro</option>
                      </select>
                    </div>
                    <div>
                      <label className="text-xs font-medium text-muted-foreground">Referencia de pago</label>
                      <input value={advanceReference} onChange={e => setAdvanceReference(e.target.value)} className="w-full mt-1 px-3 py-2 rounded-lg border bg-background text-sm" />
                    </div>
                    <div>
                      <label className="text-xs font-medium text-muted-foreground">Fecha de pago</label>
                      <input type="date" value={advanceDate} onChange={e => setAdvanceDate(e.target.value)} className="w-full mt-1 px-3 py-2 rounded-lg border bg-background text-sm" />
                    </div>
                  </div>
                  <div className="p-3 rounded-lg bg-muted/50 text-sm">
                    <div className="flex justify-between"><span className="text-muted-foreground">Total cotización</span><span className="font-semibold">{fmt(convertQuotation.total)}</span></div>
                    <div className="flex justify-between mt-1"><span className="text-muted-foreground">Anticipo</span><span className="font-semibold text-success">{fmt(advanceAmount)}</span></div>
                    <div className="flex justify-between mt-1 pt-1 border-t"><span className="font-medium">Saldo pendiente</span><span className="font-bold text-destructive">{fmt(Math.max(0, convertQuotation.total - advanceAmount))}</span></div>
                  </div>
                  <DialogFooter>
                    <button onClick={() => setOrderTypeStep('select')} className="px-4 py-2 rounded-lg border text-sm">Atrás</button>
                    <button onClick={() => setOrderTypeStep('confirm')} className="px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-medium">Continuar</button>
                  </DialogFooter>
                </div>
              )}

              {/* Details for apartado */}
              {orderTypeStep === 'details' && selectedOrderType === 'apartado' && (
                <div className="space-y-4">
                  <div>
                    <label className="text-xs font-medium text-muted-foreground">Fecha límite de pago (opcional)</label>
                    <input type="date" value={reserveDeadline} onChange={e => setReserveDeadline(e.target.value)} className="w-full mt-1 px-3 py-2 rounded-lg border bg-background text-sm" />
                  </div>
                  <div>
                    <label className="text-xs font-medium text-muted-foreground">Observaciones</label>
                    <textarea value={deliveryNotes} onChange={e => setDeliveryNotes(e.target.value)} rows={2} className="w-full mt-1 px-3 py-2 rounded-lg border bg-background text-sm resize-none" placeholder="Notas sobre la reserva..." />
                  </div>
                  <div className="p-3 rounded-lg bg-warning/10 border border-warning/20 text-sm text-warning">
                    El inventario se marcará como reservado temporalmente. No se registrará pago.
                  </div>
                  <DialogFooter>
                    <button onClick={() => setOrderTypeStep('select')} className="px-4 py-2 rounded-lg border text-sm">Atrás</button>
                    <button onClick={() => setOrderTypeStep('confirm')} className="px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-medium">Continuar</button>
                  </DialogFooter>
                </div>
              )}

              {/* Details for entrega_futura */}
              {orderTypeStep === 'details' && selectedOrderType === 'entrega_futura' && (
                <div className="space-y-4">
                  <div>
                    <label className="text-xs font-medium text-muted-foreground">Fecha programada de entrega *</label>
                    <input type="date" value={scheduledDate} onChange={e => setScheduledDate(e.target.value)} className="w-full mt-1 px-3 py-2 rounded-lg border bg-background text-sm" />
                  </div>
                  <div>
                    <label className="text-xs font-medium text-muted-foreground">Observaciones logísticas</label>
                    <textarea value={deliveryNotes} onChange={e => setDeliveryNotes(e.target.value)} rows={2} className="w-full mt-1 px-3 py-2 rounded-lg border bg-background text-sm resize-none" placeholder="Notas para la entrega..." />
                  </div>
                  <DialogFooter>
                    <button onClick={() => setOrderTypeStep('select')} className="px-4 py-2 rounded-lg border text-sm">Atrás</button>
                    <button onClick={() => setOrderTypeStep('confirm')} className="px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-medium">Continuar</button>
                  </DialogFooter>
                </div>
              )}

              {/* STEP 3: Confirmation */}
              {orderTypeStep === 'confirm' && selectedOrderType && (
                <div className="space-y-4">
                  <div className="p-4 rounded-xl border bg-muted/30 space-y-3">
                    <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-primary">
                      {(() => { const Icon = ORDER_TYPE_OPTIONS.find(o => o.value === selectedOrderType)!.icon; return <Icon size={14} />; })()}
                      {ORDER_TYPE_OPTIONS.find(o => o.value === selectedOrderType)?.label}
                    </div>
                    <div className="grid grid-cols-2 gap-2 text-sm">
                      <div><span className="text-muted-foreground">Cliente:</span> <span className="font-medium">{convertQuotation.customerName}</span></div>
                      <div><span className="text-muted-foreground">Vendedor:</span> <span className="font-medium">{convertQuotation.vendorName}</span></div>
                      <div><span className="text-muted-foreground">Cotización:</span> <span className="font-mono font-semibold">{convertQuotation.folio}</span></div>
                      <div><span className="text-muted-foreground">Folio pedido:</span> <span className="font-mono font-semibold">PED-2026-{String(orders.length + 1).padStart(3, '0')}</span></div>
                    </div>
                    <div className="border-t pt-2 space-y-1">
                      <div className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Productos</div>
                      {convertQuotation.items.map((it, i) => {
                        const lineTotal = it.qty * it.unitPrice * (1 - (it.discount || 0) / 100);
                        return (
                          <div key={i} className="flex justify-between text-sm p-1.5 rounded bg-background/60">
                            <span>{it.productName} <span className="text-muted-foreground">x{it.qty}</span></span>
                            <span className="font-semibold">{fmt(lineTotal)}</span>
                          </div>
                        );
                      })}
                    </div>
                    <div className="border-t pt-2 space-y-1 text-sm">
                      <div className="flex justify-between"><span className="text-muted-foreground">Total</span><span className="font-bold text-lg">{fmt(convertQuotation.total)}</span></div>
                      {selectedOrderType === 'anticipo' && (
                        <>
                          <div className="flex justify-between"><span className="text-muted-foreground">Anticipo ({advanceMethod})</span><span className="font-semibold text-success">{fmt(advanceAmount)}</span></div>
                          <div className="flex justify-between"><span className="text-muted-foreground">Saldo pendiente</span><span className="font-semibold text-destructive">{fmt(Math.max(0, convertQuotation.total - advanceAmount))}</span></div>
                        </>
                      )}
                      {selectedOrderType === 'directo' && (
                        <div className="flex justify-between"><span className="text-muted-foreground">Pago completo</span><span className="font-semibold text-success">{fmt(convertQuotation.total)}</span></div>
                      )}
                      {selectedOrderType === 'apartado' && reserveDeadline && (
                        <div className="flex justify-between"><span className="text-muted-foreground">Fecha límite</span><span className="font-medium">{reserveDeadline}</span></div>
                      )}
                      {selectedOrderType === 'entrega_futura' && scheduledDate && (
                        <div className="flex justify-between"><span className="text-muted-foreground">Entrega programada</span><span className="font-medium">{scheduledDate}</span></div>
                      )}
                    </div>
                  </div>
                  <DialogFooter>
                    <button onClick={() => setOrderTypeStep(selectedOrderType === 'directo' ? 'select' : 'details')} className="px-4 py-2 rounded-lg border text-sm">Atrás</button>
                    <button onClick={handleGenerateOrder} disabled={isGeneratingOrder} className="px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:opacity-90 flex items-center gap-2 disabled:opacity-50">
                      {isGeneratingOrder ? <Loader2 size={16} className="animate-spin" /> : <ShoppingCart size={16} />} {isGeneratingOrder ? 'Generando...' : 'Generar pedido'}
                    </button>
                  </DialogFooter>
                </div>
              )}
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

/* ===================== PREMIUM QUOTATION PREVIEW ===================== */
function QuotationPreview({ quotation }: { quotation: Quotation }) {
  const company = demoCompanyInfo;
  const conditions = demoSalesConditions;
  const logoSrc = getCompanyLogoUrl();

  return (
    <div className="bg-white text-[hsl(0,0%,12%)]" id="quotation-pdf">
      <div className="h-2 w-full" style={{ background: 'hsl(var(--primary))' }} />
      <div className="px-8 pt-6 pb-5 flex items-start justify-between">
        <div className="flex items-center gap-4">
          <img src={logoSrc} alt="Logo" className="w-14 h-14 rounded-xl object-contain" onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }} />
          <div>
            <div className="font-display font-extrabold text-xl tracking-tight leading-tight">{company.nombreComercial}</div>
            <div className="text-[11px] text-[hsl(0,0%,50%)] mt-0.5">{company.razonSocial}</div>
            <div className="text-[11px] text-[hsl(0,0%,50%)] leading-snug mt-1">{company.direccion}<br />Tel: {company.telefono} · {company.correo}<br />RFC: {company.rfc}</div>
          </div>
        </div>
        <div className="text-right shrink-0">
          <div className="inline-block px-4 py-2 rounded-lg font-display font-black text-2xl tracking-tight" style={{ background: 'hsl(var(--primary) / 0.08)', color: 'hsl(var(--primary))' }}>{quotation.folio}</div>
          <div className="text-[11px] text-[hsl(0,0%,50%)] mt-2 space-y-0.5">
            <div><span className="font-semibold text-[hsl(0,0%,25%)]">Fecha:</span> {quotation.createdAt}</div>
            <div><span className="font-semibold text-[hsl(0,0%,25%)]">Vigencia:</span> {quotation.validUntil}</div>
          </div>
        </div>
      </div>
      <div className="h-px mx-8" style={{ background: 'hsl(0,0%,90%)' }} />
      <div className="px-8 py-5 grid grid-cols-2 gap-5">
        <div className="rounded-xl p-4" style={{ background: 'hsl(0,0%,97%)', border: '1px solid hsl(0,0%,90%)' }}>
          <div className="text-[9px] uppercase tracking-[0.15em] font-bold mb-2" style={{ color: 'hsl(var(--primary))' }}>Cliente</div>
          <div className="font-display font-bold text-[15px] leading-tight">{quotation.customerName}</div>
          {quotation.customerPhone && <div className="text-[11px] text-[hsl(0,0%,50%)] mt-1.5">Tel: {quotation.customerPhone}</div>}
        </div>
        <div className="rounded-xl p-4" style={{ background: 'hsl(0,0%,97%)', border: '1px solid hsl(0,0%,90%)' }}>
          <div className="text-[9px] uppercase tracking-[0.15em] font-bold mb-2" style={{ color: 'hsl(var(--primary))' }}>Vendedor</div>
          <div className="font-display font-bold text-[15px] leading-tight">{quotation.vendorName}</div>
          <div className="text-[11px] text-[hsl(0,0%,50%)] mt-1.5 space-y-0.5">
            {quotation.vendorPhone && <div>Tel: {quotation.vendorPhone}</div>}
            {quotation.vendorEmail && <div>{quotation.vendorEmail}</div>}
          </div>
        </div>
      </div>
      <div className="px-8 pb-2">
        <div className="text-[9px] uppercase tracking-[0.15em] font-bold mb-3" style={{ color: 'hsl(var(--primary))' }}>Productos cotizados</div>
      </div>
      <div className="px-8 space-y-4 pb-6">
        {quotation.items.map((item, idx) => {
          const lineTotal = item.qty * item.unitPrice * (1 - (item.discount || 0) / 100);
          return (
            <div key={idx} className="rounded-xl overflow-hidden" style={{ border: '1px solid hsl(0,0%,90%)' }}>
              <div className="flex">
                <div className="w-[180px] h-[140px] shrink-0 relative overflow-hidden" style={{ background: 'hsl(0,0%,95%)' }}>
                  <img src={item.productImage || '/placeholder.svg'} alt={item.productName} className="w-full h-full object-cover" onError={(e) => { (e.target as HTMLImageElement).src = '/placeholder.svg'; }} />
                </div>
                <div className="flex-1 p-4 flex flex-col justify-between min-w-0">
                  <div>
                    <div className="font-display font-bold text-[15px] leading-tight">{item.productName}</div>
                    {item.sku && <div className="text-[10px] font-mono text-[hsl(0,0%,50%)] mt-1">{item.sku}</div>}
                    {item.discount > 0 && <div className="inline-block mt-1.5 text-[10px] font-semibold px-2 py-0.5 rounded-full" style={{ background: 'hsl(var(--primary) / 0.1)', color: 'hsl(var(--primary))' }}>Desc. {item.discount}%</div>}
                  </div>
                  <div className="flex items-end justify-between mt-3 pt-2" style={{ borderTop: '1px solid hsl(0,0%,93%)' }}>
                    <div className="flex gap-6">
                      <div>
                        <div className="text-[9px] uppercase tracking-wider text-[hsl(0,0%,55%)] font-semibold">Cantidad</div>
                        <div className="text-sm font-bold mt-0.5">{item.qty}</div>
                      </div>
                      <div>
                        <div className="text-[9px] uppercase tracking-wider text-[hsl(0,0%,55%)] font-semibold">P. Unitario</div>
                        <div className="text-sm font-bold mt-0.5">{fmt(item.unitPrice)}</div>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-[9px] uppercase tracking-wider text-[hsl(0,0%,55%)] font-semibold">Subtotal</div>
                      <div className="text-base font-display font-black mt-0.5" style={{ color: 'hsl(var(--primary))' }}>{fmt(lineTotal)}</div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>
      <div className="mx-8 mb-6 rounded-xl overflow-hidden" style={{ border: '1px solid hsl(0,0%,88%)' }}>
        <div className="p-5 space-y-2" style={{ background: 'hsl(0,0%,97%)' }}>
          <div className="flex justify-between items-center text-sm"><span className="text-[hsl(0,0%,50%)]">Subtotal</span><span className="font-semibold">{fmt(quotation.subtotal)}</span></div>
          <div className="flex justify-between items-center text-sm"><span className="text-[hsl(0,0%,50%)]">IVA 16%</span><span className="font-semibold">{fmt(quotation.tax)}</span></div>
        </div>
        <div className="px-5 py-4 flex items-center justify-between" style={{ background: 'hsl(var(--primary))', color: '#fff' }}>
          <div>
            <div className="text-[10px] uppercase tracking-[0.12em] font-semibold opacity-80">Total a pagar</div>
            <div className="text-[11px] opacity-70 mt-0.5">{numberToWords(quotation.total)}</div>
          </div>
          <div className="font-display font-black text-2xl tracking-tight">{fmt(quotation.total)}</div>
        </div>
      </div>
      <div className="mx-8 mb-6 rounded-xl p-5" style={{ background: 'hsl(0,0%,97%)', border: '1px solid hsl(0,0%,90%)' }}>
        <div className="text-[9px] uppercase tracking-[0.15em] font-bold mb-3 text-[hsl(0,0%,45%)]">Condiciones Generales de Venta</div>
        <div className="text-[11px] text-[hsl(0,0%,45%)] whitespace-pre-line leading-[1.7]">{conditions.text}</div>
      </div>
      <div className="px-8 pb-6 flex items-center justify-between">
        <div className="text-[10px] text-[hsl(0,0%,60%)]">Cotización generada por REDBUCK ERP CRM</div>
        <div className="flex items-center gap-2">
          <div className="w-5 h-5 rounded flex items-center justify-center font-display font-black text-[8px]" style={{ background: 'hsl(var(--primary))', color: '#fff' }}>RB</div>
          <span className="text-[10px] font-display font-bold text-[hsl(0,0%,40%)]">redbuck.mx</span>
        </div>
      </div>
    </div>
  );
}
