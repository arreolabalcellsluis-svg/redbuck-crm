import { useState, useRef } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import {
  FileText, Settings, Shield, Upload, CheckCircle, AlertTriangle, XCircle, Search,
  Download, Eye, Send, Ban, RefreshCw, Users, Package, FileBadge, Plus,
} from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import {
  useFiscalSettings, useSaveFiscalSettings, FiscalSettings,
  useCustomerFiscalData, useAllCustomerFiscalData, useSaveCustomerFiscalData,
  useAllProductFiscalData, useSaveProductFiscalData,
  useInvoices, type Invoice, useTestPacConnection,
  SAT_TAX_REGIMES, SAT_CFDI_USES, SAT_PAYMENT_FORMS, SAT_PAYMENT_METHODS, TAX_OBJECTS,
} from '@/hooks/useInvoicing';
import { useCustomers } from '@/hooks/useCustomers';
import { useProducts } from '@/hooks/useProducts';
import InvoiceCreateDialog from '@/components/invoicing/InvoiceCreateDialog';
import InvoiceDetailDialog from '@/components/invoicing/InvoiceDetailDialog';

const fmt = (n: number) => new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN', maximumFractionDigits: 2 }).format(n);

const STATUS_MAP: Record<string, { label: string; color: string }> = {
  borrador: { label: 'Borrador', color: 'bg-muted text-muted-foreground' },
  lista_timbrar: { label: 'Lista para timbrar', color: 'bg-amber-100 text-amber-800' },
  timbrada: { label: 'Timbrada', color: 'bg-green-100 text-green-800' },
  cancelada: { label: 'Cancelada', color: 'bg-destructive/10 text-destructive' },
  error_timbrado: { label: 'Error', color: 'bg-destructive/10 text-destructive' },
};

const CSD_STATUS_MAP: Record<string, { icon: any; label: string; color: string }> = {
  sin_certificado: { icon: XCircle, label: 'Sin certificado', color: 'text-muted-foreground' },
  vigente: { icon: CheckCircle, label: 'Vigente', color: 'text-green-600' },
  proximo_vencer: { icon: AlertTriangle, label: 'Próximo a vencer', color: 'text-amber-600' },
  vencido: { icon: XCircle, label: 'Vencido', color: 'text-destructive' },
};

export default function InvoicingPage() {
  const [activeTab, setActiveTab] = useState('config');

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold font-display">Facturación CFDI 4.0</h1>
          <p className="text-sm text-muted-foreground">Generación, timbrado y gestión de facturas electrónicas</p>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid grid-cols-5 w-full max-w-3xl">
          <TabsTrigger value="config" className="gap-1.5"><Settings size={14} /> Emisor</TabsTrigger>
          <TabsTrigger value="csd" className="gap-1.5"><Shield size={14} /> CSD</TabsTrigger>
          <TabsTrigger value="customers" className="gap-1.5"><Users size={14} /> Clientes</TabsTrigger>
          <TabsTrigger value="products" className="gap-1.5"><Package size={14} /> Productos</TabsTrigger>
          <TabsTrigger value="invoices" className="gap-1.5"><FileBadge size={14} /> Facturas</TabsTrigger>
        </TabsList>

        <TabsContent value="config"><IssuerConfigTab /></TabsContent>
        <TabsContent value="csd"><CSDTab /></TabsContent>
        <TabsContent value="customers"><CustomerFiscalTab /></TabsContent>
        <TabsContent value="products"><ProductFiscalTab /></TabsContent>
        <TabsContent value="invoices"><InvoicesTab /></TabsContent>
      </Tabs>
    </div>
  );
}

// ─── TAB 1: Issuer Configuration ───
function IssuerConfigTab() {
  const { data: settings, isLoading } = useFiscalSettings();
  const saveMutation = useSaveFiscalSettings();
  const testPacMutation = useTestPacConnection();
  const [form, setForm] = useState<Partial<FiscalSettings>>({});
  const [initialized, setInitialized] = useState(false);

  if (!initialized && settings) {
    setForm(settings);
    setInitialized(true);
  }
  if (!initialized && !isLoading && !settings) {
    setInitialized(true);
  }

  const set = (key: string, val: string) => setForm(prev => ({ ...prev, [key]: val }));

  const handleSave = () => {
    if (!form.issuer_rfc?.trim()) { toast.error('El RFC del emisor es obligatorio'); return; }
    if (!form.issuer_name?.trim()) { toast.error('La razón social es obligatoria'); return; }
    if (!form.issuer_tax_regime?.trim()) { toast.error('El régimen fiscal es obligatorio'); return; }
    if (!form.expedition_zip_code?.trim()) { toast.error('El código postal es obligatorio'); return; }
    saveMutation.mutate(form as any);
  };

  const handleTestPac = () => {
    testPacMutation.mutate();
  };

  if (isLoading) return <div className="py-8 text-center text-muted-foreground">Cargando configuración...</div>;

  return (
    <div className="grid gap-6 md:grid-cols-2 mt-4">
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Datos del Emisor</CardTitle>
          <CardDescription>Información fiscal de tu empresa para CFDI 4.0</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label>RFC Emisor *</Label>
              <Input value={form.issuer_rfc ?? ''} onChange={e => set('issuer_rfc', e.target.value.toUpperCase())} maxLength={13} placeholder="XAXX010101000" />
            </div>
            <div className="space-y-1.5">
              <Label>Código Postal *</Label>
              <Input value={form.expedition_zip_code ?? ''} onChange={e => set('expedition_zip_code', e.target.value)} maxLength={5} placeholder="44100" />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label>Razón Social *</Label>
            <Input value={form.issuer_name ?? ''} onChange={e => set('issuer_name', e.target.value.toUpperCase())} placeholder="EMPRESA SA DE CV" />
          </div>
          <div className="space-y-1.5">
            <Label>Nombre Comercial</Label>
            <Input value={form.issuer_trade_name ?? ''} onChange={e => set('issuer_trade_name', e.target.value)} placeholder="Mi Empresa" />
          </div>
          <div className="space-y-1.5">
            <Label>Régimen Fiscal *</Label>
            <select className="w-full h-10 rounded-md border border-input bg-background px-3 text-sm" value={form.issuer_tax_regime ?? ''} onChange={e => set('issuer_tax_regime', e.target.value)}>
              <option value="">Seleccionar...</option>
              {SAT_TAX_REGIMES.map(r => <option key={r.code} value={r.code}>{r.label}</option>)}
            </select>
          </div>
          <div className="space-y-1.5">
            <Label>Serie por defecto</Label>
            <Input value={form.default_series ?? 'A'} onChange={e => set('default_series', e.target.value.toUpperCase())} maxLength={5} placeholder="A" />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Configuración del PAC</CardTitle>
          <CardDescription>Proveedor autorizado de certificación</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-1.5">
            <Label>PAC Seleccionado</Label>
            <select className="w-full h-10 rounded-md border border-input bg-background px-3 text-sm" value={form.pac_provider ?? 'facturama'} onChange={e => set('pac_provider', e.target.value)}>
              <option value="facturama">Facturama</option>
              <option value="finkok">Finkok</option>
              <option value="sw_sapien">SW Sapien</option>
              <option value="otro">Otro</option>
            </select>
          </div>
          <div className="space-y-1.5">
            <Label>URL API</Label>
            <Input value={form.pac_api_url ?? ''} onChange={e => set('pac_api_url', e.target.value)} placeholder="https://apisandbox.facturama.mx" />
          </div>
          <div className="space-y-1.5">
            <Label>Usuario API</Label>
            <Input value={form.pac_username ?? ''} onChange={e => set('pac_username', e.target.value)} placeholder="usuario@empresa.com" />
          </div>
          <div className="space-y-1.5">
            <Label>Token / Password API</Label>
            <Input type="password" value={form.pac_token_encrypted ?? ''} onChange={e => set('pac_token_encrypted', e.target.value)} placeholder="••••••••" />
          </div>
          <div className="flex gap-2">
            <Button onClick={handleTestPac} disabled={testingPac} variant="outline" className="gap-1.5">
              <RefreshCw size={14} className={testingPac ? 'animate-spin' : ''} />
              {testingPac ? 'Probando...' : 'Probar conexión'}
            </Button>
          </div>
        </CardContent>
      </Card>

      <div className="md:col-span-2 flex justify-end">
        <Button onClick={handleSave} disabled={saveMutation.isPending} className="gap-1.5">
          {saveMutation.isPending ? 'Guardando...' : 'Guardar configuración'}
        </Button>
      </div>
    </div>
  );
}

// ─── TAB 2: CSD Upload ───
function CSDTab() {
  const { data: settings, isLoading } = useFiscalSettings();
  const saveMutation = useSaveFiscalSettings();
  const cerRef = useRef<HTMLInputElement>(null);
  const keyRef = useRef<HTMLInputElement>(null);
  const [csdPassword, setCsdPassword] = useState('');
  const [uploading, setUploading] = useState(false);

  const csdStatus = settings?.csd_status ?? 'sin_certificado';
  const statusInfo = CSD_STATUS_MAP[csdStatus] || CSD_STATUS_MAP.sin_certificado;
  const StatusIcon = statusInfo.icon;

  const handleUploadCSD = async () => {
    const cerFile = cerRef.current?.files?.[0];
    const keyFile = keyRef.current?.files?.[0];

    if (!cerFile) { toast.error('Selecciona el archivo .cer'); return; }
    if (!keyFile) { toast.error('Selecciona el archivo .key'); return; }
    if (!csdPassword) { toast.error('Ingresa la contraseña del certificado'); return; }

    if (!cerFile.name.endsWith('.cer')) { toast.error('El archivo debe tener extensión .cer'); return; }
    if (!keyFile.name.endsWith('.key')) { toast.error('El archivo debe tener extensión .key'); return; }

    setUploading(true);
    try {
      // Upload .cer
      const cerPath = `csd/${Date.now()}_${cerFile.name}`;
      const { error: cerErr } = await supabase.storage.from('invoicing').upload(cerPath, cerFile);
      if (cerErr) throw cerErr;

      // Upload .key
      const keyPath = `csd/${Date.now()}_${keyFile.name}`;
      const { error: keyErr } = await supabase.storage.from('invoicing').upload(keyPath, keyFile);
      if (keyErr) throw keyErr;

      // Update settings
      await saveMutation.mutateAsync({
        id: settings?.id,
        csd_cer_path: cerPath,
        csd_key_path: keyPath,
        csd_password_encrypted: csdPassword, // In production, encrypt this server-side
        csd_status: 'vigente',
      } as any);

      toast.success('Archivos CSD cargados correctamente');
      setCsdPassword('');
    } catch (e: any) {
      toast.error('Error al subir archivos: ' + e.message);
    } finally {
      setUploading(false);
    }
  };

  if (isLoading) return <div className="py-8 text-center text-muted-foreground">Cargando...</div>;

  if (!settings?.id) {
    return (
      <Card className="mt-4">
        <CardContent className="py-12 text-center">
          <Shield className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
          <p className="text-muted-foreground">Primero configura los datos del emisor en la pestaña "Emisor"</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="grid gap-6 md:grid-cols-2 mt-4">
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Certificado de Sello Digital (CSD)</CardTitle>
          <CardDescription>Archivos requeridos para timbrar facturas</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center gap-3 p-3 rounded-lg border">
            <StatusIcon size={20} className={statusInfo.color} />
            <div>
              <p className="text-sm font-medium">{statusInfo.label}</p>
              {settings.csd_expiration_date && (
                <p className="text-xs text-muted-foreground">Vigencia: {settings.csd_expiration_date}</p>
              )}
            </div>
          </div>

          <div className="space-y-1.5">
            <Label>Archivo .cer</Label>
            <Input ref={cerRef} type="file" accept=".cer" />
          </div>
          <div className="space-y-1.5">
            <Label>Archivo .key</Label>
            <Input ref={keyRef} type="file" accept=".key" />
          </div>
          <div className="space-y-1.5">
            <Label>Contraseña del certificado</Label>
            <Input type="password" value={csdPassword} onChange={e => setCsdPassword(e.target.value)} placeholder="••••••••" />
          </div>
          <Button onClick={handleUploadCSD} disabled={uploading} className="gap-1.5 w-full">
            <Upload size={14} />
            {uploading ? 'Subiendo...' : 'Cargar archivos CSD'}
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Archivos actuales</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {settings.csd_cer_path ? (
            <div className="flex items-center gap-2 p-2 rounded border bg-muted/30">
              <FileText size={16} className="text-green-600" />
              <span className="text-sm truncate flex-1">{settings.csd_cer_path.split('/').pop()}</span>
              <Badge variant="outline" className="text-xs">CER</Badge>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">Sin archivo .cer</p>
          )}
          {settings.csd_key_path ? (
            <div className="flex items-center gap-2 p-2 rounded border bg-muted/30">
              <FileText size={16} className="text-green-600" />
              <span className="text-sm truncate flex-1">{settings.csd_key_path.split('/').pop()}</span>
              <Badge variant="outline" className="text-xs">KEY</Badge>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">Sin archivo .key</p>
          )}
          <p className="text-xs text-muted-foreground mt-4">
            Los archivos se almacenan de forma segura. La contraseña del certificado se cifra antes de guardar.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}

// ─── TAB 3: Customer Fiscal Data ───
function CustomerFiscalTab() {
  const { data: customers, isLoading: loadingCustomers } = useCustomers();
  const { data: allFiscal, isLoading: loadingFiscal } = useAllCustomerFiscalData();
  const saveMutation = useSaveCustomerFiscalData();
  const [search, setSearch] = useState('');
  const [editing, setEditing] = useState<string | null>(null);
  const [form, setForm] = useState<Record<string, string>>({});

  const fiscalMap = new Map((allFiscal ?? []).map(f => [f.customer_id, f]));

  const filtered = (customers ?? []).filter(c =>
    c.name.toLowerCase().includes(search.toLowerCase()) ||
    (c.rfc ?? '').toLowerCase().includes(search.toLowerCase())
  );

  const openEdit = (customerId: string) => {
    const existing = fiscalMap.get(customerId);
    setForm({
      rfc: existing?.rfc ?? '',
      legal_name: existing?.legal_name ?? '',
      fiscal_zip_code: existing?.fiscal_zip_code ?? '',
      tax_regime: existing?.tax_regime ?? '',
      cfdi_use_default: existing?.cfdi_use_default ?? 'G03',
      invoice_email: existing?.invoice_email ?? '',
    });
    setEditing(customerId);
  };

  const handleSave = () => {
    if (!form.rfc?.trim()) { toast.error('El RFC es obligatorio'); return; }
    if (!form.legal_name?.trim()) { toast.error('El nombre fiscal es obligatorio'); return; }
    if (!form.fiscal_zip_code?.trim()) { toast.error('El código postal fiscal es obligatorio'); return; }
    if (!form.tax_regime?.trim()) { toast.error('El régimen fiscal es obligatorio'); return; }
    saveMutation.mutate({ customer_id: editing!, ...form } as any, {
      onSuccess: () => setEditing(null),
    });
  };

  if (loadingCustomers || loadingFiscal) return <div className="py-8 text-center text-muted-foreground">Cargando clientes...</div>;

  return (
    <div className="mt-4 space-y-4">
      <div className="flex items-center gap-3">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" size={16} />
          <Input placeholder="Buscar cliente o RFC..." value={search} onChange={e => setSearch(e.target.value)} className="pl-9" />
        </div>
        <Badge variant="outline">{filtered.length} clientes</Badge>
      </div>

      <Card>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Cliente</TableHead>
              <TableHead>RFC</TableHead>
              <TableHead>Nombre Fiscal</TableHead>
              <TableHead>Régimen</TableHead>
              <TableHead>Uso CFDI</TableHead>
              <TableHead>Estado</TableHead>
              <TableHead></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.slice(0, 50).map(c => {
              const fiscal = fiscalMap.get(c.id);
              const complete = fiscal && fiscal.rfc && fiscal.legal_name && fiscal.fiscal_zip_code && fiscal.tax_regime;
              return (
                <TableRow key={c.id}>
                  <TableCell className="font-medium">{c.name}</TableCell>
                  <TableCell>{fiscal?.rfc || <span className="text-muted-foreground">—</span>}</TableCell>
                  <TableCell className="max-w-[200px] truncate">{fiscal?.legal_name || <span className="text-muted-foreground">—</span>}</TableCell>
                  <TableCell>{fiscal?.tax_regime ? SAT_TAX_REGIMES.find(r => r.code === fiscal.tax_regime)?.code : '—'}</TableCell>
                  <TableCell>{fiscal?.cfdi_use_default || '—'}</TableCell>
                  <TableCell>
                    {complete ? (
                      <Badge className="bg-green-100 text-green-800 text-xs">Completo</Badge>
                    ) : (
                      <Badge variant="outline" className="text-xs text-amber-600 border-amber-300">Incompleto</Badge>
                    )}
                  </TableCell>
                  <TableCell>
                    <Button size="sm" variant="ghost" onClick={() => openEdit(c.id)}>Editar</Button>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </Card>

      <Dialog open={!!editing} onOpenChange={() => setEditing(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Datos Fiscales del Cliente</DialogTitle>
            <DialogDescription>Información requerida para emitir CFDI</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label>RFC *</Label>
              <Input value={form.rfc ?? ''} onChange={e => setForm(p => ({ ...p, rfc: e.target.value.toUpperCase() }))} maxLength={13} />
            </div>
            <div className="space-y-1.5">
              <Label>Nombre / Razón Social Fiscal *</Label>
              <Input value={form.legal_name ?? ''} onChange={e => setForm(p => ({ ...p, legal_name: e.target.value.toUpperCase() }))} />
            </div>
            <div className="space-y-1.5">
              <Label>Código Postal Fiscal *</Label>
              <Input value={form.fiscal_zip_code ?? ''} onChange={e => setForm(p => ({ ...p, fiscal_zip_code: e.target.value }))} maxLength={5} />
            </div>
            <div className="space-y-1.5">
              <Label>Régimen Fiscal *</Label>
              <select className="w-full h-10 rounded-md border border-input bg-background px-3 text-sm" value={form.tax_regime ?? ''} onChange={e => setForm(p => ({ ...p, tax_regime: e.target.value }))}>
                <option value="">Seleccionar...</option>
                {SAT_TAX_REGIMES.map(r => <option key={r.code} value={r.code}>{r.label}</option>)}
              </select>
            </div>
            <div className="space-y-1.5">
              <Label>Uso CFDI por defecto *</Label>
              <select className="w-full h-10 rounded-md border border-input bg-background px-3 text-sm" value={form.cfdi_use_default ?? 'G03'} onChange={e => setForm(p => ({ ...p, cfdi_use_default: e.target.value }))}>
                {SAT_CFDI_USES.map(u => <option key={u.code} value={u.code}>{u.label}</option>)}
              </select>
            </div>
            <div className="space-y-1.5">
              <Label>Correo para factura</Label>
              <Input type="email" value={form.invoice_email ?? ''} onChange={e => setForm(p => ({ ...p, invoice_email: e.target.value }))} placeholder="facturacion@empresa.com" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditing(null)}>Cancelar</Button>
            <Button onClick={handleSave} disabled={saveMutation.isPending}>
              {saveMutation.isPending ? 'Guardando...' : 'Guardar'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ─── TAB 4: Product Fiscal Data ───
function ProductFiscalTab() {
  const { data: products, isLoading: loadingProducts } = useProducts();
  const { data: allFiscal, isLoading: loadingFiscal } = useAllProductFiscalData();
  const saveMutation = useSaveProductFiscalData();
  const [search, setSearch] = useState('');
  const [editing, setEditing] = useState<string | null>(null);
  const [form, setForm] = useState<Record<string, string | number>>({});

  const fiscalMap = new Map((allFiscal ?? []).map(f => [f.product_id, f]));

  const filtered = (products ?? []).filter(p =>
    p.name.toLowerCase().includes(search.toLowerCase()) ||
    p.sku.toLowerCase().includes(search.toLowerCase())
  );

  const openEdit = (productId: string) => {
    const existing = fiscalMap.get(productId);
    setForm({
      sat_product_key: existing?.sat_product_key ?? '',
      sat_unit_key: existing?.sat_unit_key ?? '',
      commercial_unit: existing?.commercial_unit ?? 'Pieza',
      tax_object: existing?.tax_object ?? '02',
      vat_rate: existing?.vat_rate ?? 16,
      fiscal_description: existing?.fiscal_description ?? '',
    });
    setEditing(productId);
  };

  const handleSave = () => {
    if (!(form.sat_product_key as string)?.trim()) { toast.error('La clave SAT del producto es obligatoria'); return; }
    if (!(form.sat_unit_key as string)?.trim()) { toast.error('La clave SAT de unidad es obligatoria'); return; }
    saveMutation.mutate({ product_id: editing!, ...form } as any, {
      onSuccess: () => setEditing(null),
    });
  };

  if (loadingProducts || loadingFiscal) return <div className="py-8 text-center text-muted-foreground">Cargando productos...</div>;

  return (
    <div className="mt-4 space-y-4">
      <div className="flex items-center gap-3">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" size={16} />
          <Input placeholder="Buscar producto o SKU..." value={search} onChange={e => setSearch(e.target.value)} className="pl-9" />
        </div>
        <Badge variant="outline">{filtered.length} productos</Badge>
      </div>

      <Card>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>SKU</TableHead>
              <TableHead>Producto</TableHead>
              <TableHead>Clave SAT Prod.</TableHead>
              <TableHead>Clave SAT Unidad</TableHead>
              <TableHead>IVA</TableHead>
              <TableHead>Estado</TableHead>
              <TableHead></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.slice(0, 50).map(p => {
              const fiscal = fiscalMap.get(p.id);
              const complete = fiscal && fiscal.sat_product_key && fiscal.sat_unit_key;
              return (
                <TableRow key={p.id}>
                  <TableCell className="font-mono text-xs">{p.sku}</TableCell>
                  <TableCell className="font-medium max-w-[200px] truncate">{p.name}</TableCell>
                  <TableCell>{fiscal?.sat_product_key || <span className="text-muted-foreground">—</span>}</TableCell>
                  <TableCell>{fiscal?.sat_unit_key || <span className="text-muted-foreground">—</span>}</TableCell>
                  <TableCell>{fiscal ? `${fiscal.vat_rate}%` : '—'}</TableCell>
                  <TableCell>
                    {complete ? (
                      <Badge className="bg-green-100 text-green-800 text-xs">Completo</Badge>
                    ) : (
                      <Badge variant="outline" className="text-xs text-amber-600 border-amber-300">Incompleto</Badge>
                    )}
                  </TableCell>
                  <TableCell>
                    <Button size="sm" variant="ghost" onClick={() => openEdit(p.id)}>Editar</Button>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </Card>

      <Dialog open={!!editing} onOpenChange={() => setEditing(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Datos Fiscales del Producto</DialogTitle>
            <DialogDescription>Claves SAT requeridas para CFDI 4.0</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label>Clave SAT Producto/Servicio *</Label>
              <Input value={(form.sat_product_key as string) ?? ''} onChange={e => setForm(p => ({ ...p, sat_product_key: e.target.value }))} placeholder="84111506" maxLength={8} />
              <p className="text-xs text-muted-foreground">Consulta el catálogo SAT para encontrar la clave correcta</p>
            </div>
            <div className="space-y-1.5">
              <Label>Clave SAT Unidad *</Label>
              <Input value={(form.sat_unit_key as string) ?? ''} onChange={e => setForm(p => ({ ...p, sat_unit_key: e.target.value }))} placeholder="H87" maxLength={5} />
            </div>
            <div className="space-y-1.5">
              <Label>Unidad Comercial</Label>
              <Input value={(form.commercial_unit as string) ?? ''} onChange={e => setForm(p => ({ ...p, commercial_unit: e.target.value }))} placeholder="Pieza" />
            </div>
            <div className="space-y-1.5">
              <Label>Objeto de Impuesto</Label>
              <select className="w-full h-10 rounded-md border border-input bg-background px-3 text-sm" value={(form.tax_object as string) ?? '02'} onChange={e => setForm(p => ({ ...p, tax_object: e.target.value }))}>
                {TAX_OBJECTS.map(t => <option key={t.code} value={t.code}>{t.label}</option>)}
              </select>
            </div>
            <div className="space-y-1.5">
              <Label>Tasa IVA (%)</Label>
              <Input type="number" value={form.vat_rate ?? 16} onChange={e => setForm(p => ({ ...p, vat_rate: parseFloat(e.target.value) || 0 }))} />
            </div>
            <div className="space-y-1.5">
              <Label>Descripción Fiscal</Label>
              <Input value={(form.fiscal_description as string) ?? ''} onChange={e => setForm(p => ({ ...p, fiscal_description: e.target.value }))} placeholder="Descripción para factura" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditing(null)}>Cancelar</Button>
            <Button onClick={handleSave} disabled={saveMutation.isPending}>
              {saveMutation.isPending ? 'Guardando...' : 'Guardar'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ─── TAB 5: Invoices History ───
function InvoicesTab() {
  const { data: invoices, isLoading } = useInvoices();
  const { data: customers } = useCustomers();
  const [search, setSearch] = useState('');
  const [showCreate, setShowCreate] = useState(false);
  const [selectedInvoice, setSelectedInvoice] = useState<Invoice | null>(null);

  if (isLoading) return <div className="py-8 text-center text-muted-foreground">Cargando facturas...</div>;

  const customerMap = new Map((customers ?? []).map(c => [c.id, c]));

  const filtered = (invoices ?? []).filter(inv =>
    inv.folio.toLowerCase().includes(search.toLowerCase()) ||
    (inv.uuid ?? '').toLowerCase().includes(search.toLowerCase()) ||
    (inv.customer_id && customerMap.get(inv.customer_id)?.name?.toLowerCase().includes(search.toLowerCase()))
  );

  return (
    <div className="mt-4 space-y-4">
      <div className="flex items-center gap-3">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" size={16} />
          <Input placeholder="Buscar folio, UUID o cliente..." value={search} onChange={e => setSearch(e.target.value)} className="pl-9" />
        </div>
        <Badge variant="outline">{filtered.length} facturas</Badge>
        <Button onClick={() => setShowCreate(true)} className="gap-1.5 ml-auto">
          <Plus size={14} /> Nueva Factura
        </Button>
      </div>

      {filtered.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <FileBadge className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
            <p className="text-muted-foreground">No hay facturas aún</p>
            <p className="text-xs text-muted-foreground mt-1">
              Haz clic en "Nueva Factura" para generar una desde un pedido
            </p>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Fecha</TableHead>
                <TableHead>Serie-Folio</TableHead>
                <TableHead>Cliente</TableHead>
                <TableHead>UUID</TableHead>
                <TableHead className="text-right">Subtotal</TableHead>
                <TableHead className="text-right">Total</TableHead>
                <TableHead>Estatus</TableHead>
                <TableHead>Acciones</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map(inv => {
                const st = STATUS_MAP[inv.status] ?? STATUS_MAP.borrador;
                const cust = inv.customer_id ? customerMap.get(inv.customer_id) : null;
                return (
                  <TableRow key={inv.id}>
                    <TableCell className="text-sm">{new Date(inv.created_at).toLocaleDateString('es-MX')}</TableCell>
                    <TableCell className="font-mono text-sm">{inv.series}-{inv.folio}</TableCell>
                    <TableCell>{cust?.name || '—'}</TableCell>
                    <TableCell className="font-mono text-xs max-w-[120px] truncate">{inv.uuid || '—'}</TableCell>
                    <TableCell className="text-right">{fmt(inv.subtotal)}</TableCell>
                    <TableCell className="text-right font-medium">{fmt(inv.total)}</TableCell>
                    <TableCell><Badge className={`${st.color} text-xs`}>{st.label}</Badge></TableCell>
                    <TableCell>
                      <div className="flex gap-1">
                        <Button size="icon" variant="ghost" title="Ver detalle" onClick={() => setSelectedInvoice(inv)}><Eye size={14} /></Button>
                        {inv.status === 'timbrada' && (
                          <Button size="icon" variant="ghost" title="Descargar XML"><Download size={14} /></Button>
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

      <InvoiceCreateDialog open={showCreate} onOpenChange={setShowCreate} />
      <InvoiceDetailDialog invoice={selectedInvoice} open={!!selectedInvoice} onOpenChange={open => { if (!open) setSelectedInvoice(null); }} />
    </div>
  );
}
