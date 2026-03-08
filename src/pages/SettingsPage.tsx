import { useState } from 'react';
import { demoUsers as initialUsers, demoWarehouses as initialWarehouses, demoCompanyInfo, demoSalesConditions, demoWhatsAppTemplate } from '@/data/demo-data';
import { ROLE_LABELS, UserRole, User, Warehouse } from '@/types';
import { useAppContext } from '@/contexts/AppContext';
import { Users, Warehouse as WarehouseIcon, Shield, Building2, FileText, MessageCircle, Hash, Pencil, Plus, Trash2, X, Check } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { toast } from 'sonner';

// ─── Module-level permissions definition ────────────────────────────
const ALL_MODULES = [
  { key: 'dashboard', label: 'Dashboard' },
  { key: 'ejecutivo', label: 'Dashboard Ejecutivo' },
  { key: 'crm', label: 'CRM' },
  { key: 'productos', label: 'Productos' },
  { key: 'refacciones', label: 'Refacciones' },
  { key: 'inventario', label: 'Inventario' },
  { key: 'cotizaciones', label: 'Cotizaciones' },
  { key: 'pedidos', label: 'Pedidos' },
  { key: 'cobranza', label: 'Cobranza' },
  { key: 'compras', label: 'Compras' },
  { key: 'importaciones', label: 'Importaciones' },
  { key: 'proveedores', label: 'Proveedores' },
  { key: 'servicio', label: 'Servicio' },
  { key: 'comisiones', label: 'Comisiones' },
  { key: 'planeacion', label: 'Planeación' },
  { key: 'reportes', label: 'Reportes' },
  { key: 'configuracion', label: 'Configuración' },
] as const;

type ModuleKey = typeof ALL_MODULES[number]['key'];

// Default permissions per role
const DEFAULT_ROLE_PERMISSIONS: Record<UserRole, ModuleKey[]> = {
  director: ALL_MODULES.map(m => m.key),
  gerencia_comercial: ['dashboard', 'crm', 'productos', 'cotizaciones', 'pedidos', 'cobranza', 'comisiones', 'reportes'],
  vendedor: ['dashboard', 'crm', 'productos', 'cotizaciones', 'pedidos'],
  administracion: ['dashboard', 'cobranza', 'pedidos', 'planeacion', 'reportes'],
  compras: ['dashboard', 'compras', 'importaciones', 'proveedores', 'inventario', 'planeacion'],
  almacen: ['dashboard', 'inventario', 'productos', 'refacciones'],
  tecnico: ['dashboard', 'servicio', 'refacciones', 'inventario'],
};

export default function SettingsPage() {
  const { currentRole, vendorSeries, exchangeRate, setExchangeRate } = useAppContext();
  const isDirector = true; // All roles with access can edit settings

  // ─── State ─────────────────────────────────────────────
  const [users, setUsers] = useState<User[]>(initialUsers);
  const [warehouses, setWarehouses] = useState<Warehouse[]>(initialWarehouses);
  const [rolePermissions, setRolePermissions] = useState<Record<UserRole, ModuleKey[]>>(DEFAULT_ROLE_PERMISSIONS);
  const [companyInfo, setCompanyInfo] = useState(demoCompanyInfo);
  const [salesConditions, setSalesConditions] = useState(demoSalesConditions.text);
  const [whatsappMsg, setWhatsappMsg] = useState(demoWhatsAppTemplate.message);
  const [ivaRate, setIvaRate] = useState(16);
  const [editingSeriesId, setEditingSeriesId] = useState<string | null>(null);
  const [seriesForm, setSeriesForm] = useState({ prefix: '', start: 1000, current: 1000 });
  const [showAddVendorSeries, setShowAddVendorSeries] = useState(false);
  const [newVendorForm, setNewVendorForm] = useState({ name: '', prefix: '', start: 1000 });

  // ─── Dialogs ───────────────────────────────────────────
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [editingWarehouse, setEditingWarehouse] = useState<Warehouse | null>(null);
  const [editingRole, setEditingRole] = useState<UserRole | null>(null);
  const [showCreateUser, setShowCreateUser] = useState(false);
  const [showCreateWarehouse, setShowCreateWarehouse] = useState(false);

  // ─── User form ─────────────────────────────────────────
  const emptyUserForm = (): Omit<User, 'id'> => ({
    name: '', email: '', phone: '', whatsapp: '', role: 'vendedor', active: true,
  });
  const [userForm, setUserForm] = useState(emptyUserForm());

  // ─── Warehouse form ────────────────────────────────────
  const emptyWhForm = (): Omit<Warehouse, 'id'> => ({ name: '', location: '', hasExhibition: false });
  const [whForm, setWhForm] = useState(emptyWhForm());

  // ─── Handlers: Users ───────────────────────────────────
  const openEditUser = (u: User) => {
    setEditingUser(u);
    const { id, ...rest } = u;
    setUserForm(rest);
  };

  const handleSaveUser = () => {
    if (!userForm.name.trim()) { toast.error('El nombre es obligatorio'); return; }
    if (!userForm.email.trim()) { toast.error('El correo es obligatorio'); return; }
    if (editingUser) {
      setUsers(prev => prev.map(u => u.id === editingUser.id ? { ...u, ...userForm } : u));
      toast.success(`Usuario "${userForm.name}" actualizado`);
      setEditingUser(null);
    } else {
      const newUser: User = { ...userForm, id: `u-${Date.now()}` };
      setUsers(prev => [...prev, newUser]);
      toast.success(`Usuario "${userForm.name}" creado`);
      setShowCreateUser(false);
    }
    setUserForm(emptyUserForm());
  };

  const handleToggleActive = (userId: string) => {
    setUsers(prev => prev.map(u => u.id === userId ? { ...u, active: !u.active } : u));
  };

  // ─── Handlers: Warehouses ──────────────────────────────
  const openEditWarehouse = (w: Warehouse) => {
    setEditingWarehouse(w);
    const { id, ...rest } = w;
    setWhForm(rest);
  };

  const handleSaveWarehouse = () => {
    if (!whForm.name.trim()) { toast.error('El nombre es obligatorio'); return; }
    if (editingWarehouse) {
      setWarehouses(prev => prev.map(w => w.id === editingWarehouse.id ? { ...w, ...whForm } : w));
      toast.success(`Bodega "${whForm.name}" actualizada`);
      setEditingWarehouse(null);
    } else {
      const newWh: Warehouse = { ...whForm, id: `w-${Date.now()}` };
      setWarehouses(prev => [...prev, newWh]);
      toast.success(`Bodega "${whForm.name}" creada`);
      setShowCreateWarehouse(false);
    }
    setWhForm(emptyWhForm());
  };

  const handleDeleteWarehouse = (id: string) => {
    setWarehouses(prev => prev.filter(w => w.id !== id));
    toast.success('Bodega eliminada');
  };

  // ─── Handlers: Role Permissions ────────────────────────
  const toggleModuleForRole = (role: UserRole, mod: ModuleKey) => {
    setRolePermissions(prev => {
      const current = prev[role] || [];
      const updated = current.includes(mod) ? current.filter(m => m !== mod) : [...current, mod];
      return { ...prev, [role]: updated };
    });
  };

  // ─── Render helpers ────────────────────────────────────
  const userFormFields = (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      <div className="md:col-span-2">
        <label className="text-xs font-medium text-muted-foreground mb-1 block">Nombre completo *</label>
        <input value={userForm.name} onChange={e => setUserForm(p => ({ ...p, name: e.target.value }))} className="w-full px-3 py-2 rounded-lg border bg-card text-sm" />
      </div>
      <div>
        <label className="text-xs font-medium text-muted-foreground mb-1 block">Correo electrónico *</label>
        <input value={userForm.email} onChange={e => setUserForm(p => ({ ...p, email: e.target.value }))} className="w-full px-3 py-2 rounded-lg border bg-card text-sm" />
      </div>
      <div>
        <label className="text-xs font-medium text-muted-foreground mb-1 block">Teléfono</label>
        <input value={userForm.phone || ''} onChange={e => setUserForm(p => ({ ...p, phone: e.target.value }))} className="w-full px-3 py-2 rounded-lg border bg-card text-sm" />
      </div>
      <div>
        <label className="text-xs font-medium text-muted-foreground mb-1 block">WhatsApp</label>
        <input value={userForm.whatsapp || ''} onChange={e => setUserForm(p => ({ ...p, whatsapp: e.target.value }))} className="w-full px-3 py-2 rounded-lg border bg-card text-sm" />
      </div>
      <div>
        <label className="text-xs font-medium text-muted-foreground mb-1 block">Rol *</label>
        <select value={userForm.role} onChange={e => setUserForm(p => ({ ...p, role: e.target.value as UserRole }))} className="w-full px-3 py-2 rounded-lg border bg-card text-sm">
          {Object.entries(ROLE_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
        </select>
      </div>
      {(userForm.role === 'vendedor' || userForm.role === 'administracion') && (
        <div>
          <label className="text-xs font-medium text-muted-foreground mb-1 block">% Comisión por ventas</label>
          <input type="number" step="0.5" min="0" max="100" value={userForm.commissionRate ?? ''} onChange={e => setUserForm(p => ({ ...p, commissionRate: e.target.value ? +e.target.value : undefined }))} className="w-full px-3 py-2 rounded-lg border bg-card text-sm" placeholder="5" />
        </div>
      )}
      {userForm.role === 'vendedor' && (
        <>
          <div>
            <label className="text-xs font-medium text-muted-foreground mb-1 block">Prefijo de serie</label>
            <input value={userForm.seriesPrefix || ''} onChange={e => setUserForm(p => ({ ...p, seriesPrefix: e.target.value }))} className="w-full px-3 py-2 rounded-lg border bg-card text-sm" placeholder="V6" />
          </div>
          <div>
            <label className="text-xs font-medium text-muted-foreground mb-1 block">Serie inicio</label>
            <input type="number" value={userForm.seriesStart || ''} onChange={e => setUserForm(p => ({ ...p, seriesStart: +e.target.value }))} className="w-full px-3 py-2 rounded-lg border bg-card text-sm" placeholder="6000" />
          </div>
        </>
      )}
      <div className="md:col-span-2 flex items-center gap-2">
        <input type="checkbox" checked={userForm.active} onChange={e => setUserForm(p => ({ ...p, active: e.target.checked }))} id="user-active" className="rounded" />
        <label htmlFor="user-active" className="text-sm">Usuario activo</label>
      </div>
    </div>
  );

  const warehouseFormFields = (
    <div className="grid grid-cols-1 gap-4">
      <div>
        <label className="text-xs font-medium text-muted-foreground mb-1 block">Nombre *</label>
        <input value={whForm.name} onChange={e => setWhForm(p => ({ ...p, name: e.target.value }))} className="w-full px-3 py-2 rounded-lg border bg-card text-sm" />
      </div>
      <div>
        <label className="text-xs font-medium text-muted-foreground mb-1 block">Ubicación</label>
        <input value={whForm.location} onChange={e => setWhForm(p => ({ ...p, location: e.target.value }))} className="w-full px-3 py-2 rounded-lg border bg-card text-sm" />
      </div>
      <div className="flex items-center gap-2">
        <input type="checkbox" checked={whForm.hasExhibition} onChange={e => setWhForm(p => ({ ...p, hasExhibition: e.target.checked }))} id="wh-exhibition" className="rounded" />
        <label htmlFor="wh-exhibition" className="text-sm">Tiene área de exhibición</label>
      </div>
    </div>
  );

  return (
    <div>
      <div className="page-header">
        <h1 className="page-title">Configuración</h1>
        <p className="page-subtitle">Administración del sistema REDBUCK ERP CRM</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* ═══════════ COMPANY INFO ═══════════ */}
        <div className="bg-card rounded-xl border p-5">
          <div className="flex items-center gap-2 mb-4">
            <Building2 size={20} className="text-primary" />
            <h3 className="font-display font-semibold">Datos de la empresa</h3>
          </div>
          <div className="space-y-3">
            {([
              { label: 'Razón Social', key: 'razonSocial' as const },
              { label: 'Nombre Comercial', key: 'nombreComercial' as const },
              { label: 'Dirección', key: 'direccion' as const },
              { label: 'Teléfono', key: 'telefono' as const },
              { label: 'Correo', key: 'correo' as const },
              { label: 'RFC', key: 'rfc' as const },
            ]).map(f => (
              <div key={f.key}>
                <label className="text-xs font-medium text-muted-foreground mb-1 block">{f.label}</label>
                <input
                  value={companyInfo[f.key]}
                  onChange={e => setCompanyInfo(prev => ({ ...prev, [f.key]: e.target.value }))}
                  disabled={!isDirector}
                  className="w-full px-3 py-2 rounded-lg border bg-muted/50 text-sm disabled:opacity-60"
                />
              </div>
            ))}
            {isDirector && (
              <button onClick={() => toast.success('Datos de empresa guardados')} className="px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:opacity-90">
                Guardar
              </button>
            )}
          </div>
        </div>

        {/* ═══════════ USERS ═══════════ */}
        <div className="bg-card rounded-xl border p-5">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <Users size={20} className="text-primary" />
              <h3 className="font-display font-semibold">Usuarios</h3>
            </div>
            {isDirector && (
              <button onClick={() => { setUserForm(emptyUserForm()); setShowCreateUser(true); }} className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-primary text-primary-foreground text-xs font-medium hover:opacity-90">
                <Plus size={14} /> Nuevo
              </button>
            )}
          </div>
          <div className="space-y-2 max-h-[400px] overflow-y-auto">
            {users.map(u => (
              <div key={u.id} className={`flex items-center justify-between p-3 rounded-lg border ${u.active ? 'bg-muted/50' : 'bg-muted/20 opacity-60'}`}>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium flex items-center gap-2">
                    {u.name}
                    {!u.active && <span className="text-[10px] px-1.5 py-0.5 rounded bg-destructive/10 text-destructive">Inactivo</span>}
                  </div>
                  <div className="text-xs text-muted-foreground truncate">{u.email} · {u.phone}</div>
                </div>
                <div className="flex items-center gap-2 ml-2">
                  <span className="text-xs font-medium px-2 py-1 rounded-full bg-muted whitespace-nowrap">{ROLE_LABELS[u.role]}</span>
                  {isDirector && (
                    <button onClick={() => openEditUser(u)} className="p-1.5 rounded-md hover:bg-muted transition-colors text-muted-foreground hover:text-foreground" title="Editar usuario">
                      <Pencil size={14} />
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* ═══════════ VENDOR SERIES ═══════════ */}
        <div className="bg-card rounded-xl border p-5">
          <div className="flex items-center gap-2 mb-4">
            <Hash size={20} className="text-primary" />
            <h3 className="font-display font-semibold">Series de cotización por vendedor</h3>
          </div>
          <div className="space-y-2">
            {users.filter(u => u.role === 'vendedor' && u.active).map(u => {
              const current = vendorSeries[u.id] ?? u.seriesCurrent ?? u.seriesStart ?? 1000;
              const isEditing = editingSeriesId === u.id;
              return (
                <div key={u.id} className="flex items-center justify-between p-3 rounded-lg bg-muted/50 border">
                  {isEditing ? (
                    <div className="flex items-center gap-3 flex-1 flex-wrap">
                      <div>
                        <label className="text-[10px] text-muted-foreground block mb-0.5">Prefijo</label>
                        <input value={seriesForm.prefix} onChange={e => setSeriesForm(f => ({ ...f, prefix: e.target.value.toUpperCase() }))}
                          className="w-20 px-2 py-1 rounded border bg-background text-sm font-mono" />
                      </div>
                      <div>
                        <label className="text-[10px] text-muted-foreground block mb-0.5">Inicio</label>
                        <input type="number" value={seriesForm.start} onChange={e => setSeriesForm(f => ({ ...f, start: +e.target.value }))}
                          className="w-24 px-2 py-1 rounded border bg-background text-sm font-mono" />
                      </div>
                      <div>
                        <label className="text-[10px] text-muted-foreground block mb-0.5">Actual</label>
                        <input type="number" value={seriesForm.current} onChange={e => setSeriesForm(f => ({ ...f, current: +e.target.value }))}
                          className="w-24 px-2 py-1 rounded border bg-background text-sm font-mono" />
                      </div>
                      <div className="flex items-end gap-1 ml-auto">
                        <button onClick={() => {
                          setUsers(prev => prev.map(usr => usr.id === u.id ? { ...usr, seriesPrefix: seriesForm.prefix, seriesStart: seriesForm.start, seriesCurrent: seriesForm.current } : usr));
                          setEditingSeriesId(null);
                          toast.success(`Serie de ${u.name} actualizada`);
                        }} className="p-1.5 rounded-md bg-success/10 text-success hover:bg-success/20 transition-colors" title="Guardar">
                          <Check size={14} />
                        </button>
                        <button onClick={() => setEditingSeriesId(null)} className="p-1.5 rounded-md hover:bg-muted transition-colors text-muted-foreground" title="Cancelar">
                          <X size={14} />
                        </button>
                      </div>
                    </div>
                  ) : (
                    <>
                      <div>
                        <div className="text-sm font-medium">{u.name}</div>
                        <div className="text-xs text-muted-foreground">
                          Prefijo: <span className="font-mono font-semibold">{u.seriesPrefix}</span> · Inicio: {u.seriesStart} · Actual: {current}
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <div className="font-mono text-sm font-semibold text-primary">{u.seriesPrefix}-{current + 1}</div>
                        {isDirector && (
                          <button onClick={() => {
                            setEditingSeriesId(u.id);
                            setSeriesForm({ prefix: u.seriesPrefix || '', start: u.seriesStart || 1000, current: current });
                          }} className="p-1.5 rounded-md hover:bg-muted transition-colors text-muted-foreground hover:text-foreground" title="Editar serie">
                            <Pencil size={14} />
                          </button>
                        )}
                      </div>
                    </>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* ═══════════ WAREHOUSES ═══════════ */}
        <div className="bg-card rounded-xl border p-5">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <WarehouseIcon size={20} className="text-primary" />
              <h3 className="font-display font-semibold">Bodegas</h3>
            </div>
            {isDirector && (
              <button onClick={() => { setWhForm(emptyWhForm()); setShowCreateWarehouse(true); }} className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-primary text-primary-foreground text-xs font-medium hover:opacity-90">
                <Plus size={14} /> Nueva
              </button>
            )}
          </div>
          <div className="space-y-2">
            {warehouses.map(w => (
              <div key={w.id} className="flex items-center justify-between p-3 rounded-lg bg-muted/50 border">
                <div>
                  <div className="text-sm font-medium">{w.name}</div>
                  <div className="text-xs text-muted-foreground">{w.location}{w.hasExhibition ? ' · Con exhibición' : ''}</div>
                </div>
                {isDirector && (
                  <div className="flex items-center gap-1">
                    <button onClick={() => openEditWarehouse(w)} className="p-1.5 rounded-md hover:bg-muted transition-colors text-muted-foreground hover:text-foreground" title="Editar">
                      <Pencil size={14} />
                    </button>
                    <button onClick={() => handleDeleteWarehouse(w.id)} className="p-1.5 rounded-md hover:bg-destructive/10 transition-colors text-muted-foreground hover:text-destructive" title="Eliminar">
                      <Trash2 size={14} />
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* ═══════════ ROLES & PERMISSIONS ═══════════ */}
        <div className="bg-card rounded-xl border p-5 lg:col-span-2">
          <div className="flex items-center gap-2 mb-4">
            <Shield size={20} className="text-primary" />
            <h3 className="font-display font-semibold">Roles del sistema — Permisos por módulo</h3>
          </div>
          <p className="text-xs text-muted-foreground mb-4">
            {isDirector ? 'Haz clic en un módulo para activar/desactivar el acceso para cada rol.' : 'Solo el Director puede modificar los permisos.'}
          </p>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b">
                  <th className="text-left py-2 pr-4 text-xs font-semibold text-muted-foreground">Módulo</th>
                  {Object.entries(ROLE_LABELS).map(([k, v]) => (
                    <th key={k} className="text-center py-2 px-2 text-xs font-semibold text-muted-foreground whitespace-nowrap">{v.split('/')[0].trim()}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {ALL_MODULES.map(mod => (
                  <tr key={mod.key} className="border-b last:border-0 hover:bg-muted/30">
                    <td className="py-2 pr-4 text-sm font-medium">{mod.label}</td>
                    {(Object.keys(ROLE_LABELS) as UserRole[]).map(role => {
                      const hasAccess = rolePermissions[role]?.includes(mod.key);
                      const isDir = role === 'director';
                      return (
                        <td key={role} className="text-center py-2 px-2">
                          <button
                            onClick={() => !isDir && isDirector && toggleModuleForRole(role, mod.key)}
                            disabled={isDir || !isDirector}
                            className={`w-7 h-7 rounded-md inline-flex items-center justify-center transition-colors ${
                              hasAccess
                                ? 'bg-primary/15 text-primary'
                                : 'bg-muted text-muted-foreground/30'
                            } ${isDir ? 'cursor-not-allowed' : isDirector ? 'hover:opacity-80 cursor-pointer' : 'cursor-default'}`}
                            title={isDir ? 'Director siempre tiene acceso total' : hasAccess ? 'Quitar acceso' : 'Dar acceso'}
                          >
                            {hasAccess ? <Check size={14} /> : <X size={14} />}
                          </button>
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {isDirector && (
            <button onClick={() => toast.success('Permisos de roles guardados correctamente')} className="mt-4 px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:opacity-90">
              Guardar permisos
            </button>
          )}
        </div>

        {/* ═══════════ SALES CONDITIONS ═══════════ */}
        <div className="bg-card rounded-xl border p-5">
          <div className="flex items-center gap-2 mb-4">
            <FileText size={20} className="text-primary" />
            <h3 className="font-display font-semibold">Condiciones generales de venta</h3>
          </div>
          <textarea value={salesConditions} onChange={e => setSalesConditions(e.target.value)} rows={8} disabled={!isDirector} className="w-full px-3 py-2 rounded-lg border bg-muted/50 text-sm resize-y font-mono leading-relaxed disabled:opacity-60" />
          {isDirector && (
            <button onClick={() => toast.success('Condiciones de venta guardadas')} className="mt-3 px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:opacity-90">
              Guardar
            </button>
          )}
        </div>

        {/* ═══════════ WHATSAPP & FISCAL ═══════════ */}
        <div className="bg-card rounded-xl border p-5">
          <div className="flex items-center gap-2 mb-4">
            <MessageCircle size={20} className="text-primary" />
            <h3 className="font-display font-semibold">Plantilla WhatsApp para cotizaciones</h3>
          </div>
          <textarea value={whatsappMsg} onChange={e => setWhatsappMsg(e.target.value)} rows={3} disabled={!isDirector} className="w-full px-3 py-2 rounded-lg border bg-muted/50 text-sm resize-y disabled:opacity-60" />
          {isDirector && (
            <button onClick={() => toast.success('Plantilla WhatsApp guardada')} className="mt-3 px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:opacity-90">
              Guardar
            </button>
          )}
          <div className="mt-6 pt-4 border-t">
            <h3 className="font-display font-semibold text-sm mb-3">Parámetros fiscales</h3>
            <div className="flex items-center gap-3">
              <label className="text-xs font-medium text-muted-foreground">IVA por defecto:</label>
              <input type="number" value={ivaRate} onChange={e => setIvaRate(+e.target.value)} className="w-20 px-3 py-2 rounded-lg border bg-muted/50 text-sm text-center" />
              <span className="text-sm text-muted-foreground">%</span>
            </div>
            <div className="flex items-center gap-3 mt-3">
              <label className="text-xs font-medium text-muted-foreground">Tipo de cambio USD → MXN:</label>
              <div className="flex items-center gap-1">
                <span className="text-sm text-muted-foreground">$1 USD =</span>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  value={exchangeRate}
                  onChange={e => setExchangeRate(+e.target.value)}
                  disabled={currentRole !== 'director'}
                  className="w-24 px-3 py-2 rounded-lg border bg-muted/50 text-sm text-center disabled:opacity-60"
                />
                <span className="text-sm text-muted-foreground">MXN</span>
              </div>
              {currentRole !== 'director' && (
                <span className="text-[10px] text-muted-foreground italic">(Solo el Director puede modificar)</span>
              )}
            </div>
            {currentRole === 'director' && (
              <button onClick={() => toast.success('Tipo de cambio actualizado')} className="mt-3 px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:opacity-90">
                Guardar tipo de cambio
              </button>
            )}
            <div className="flex items-center gap-3 mt-2">
              <label className="text-xs font-medium text-muted-foreground">Moneda:</label>
              <span className="text-sm font-medium">MXN — Peso Mexicano</span>
            </div>
          </div>
        </div>
      </div>

      {/* ═══════════ USER DIALOG (Create/Edit) ═══════════ */}
      <Dialog open={showCreateUser || !!editingUser} onOpenChange={open => { if (!open) { setShowCreateUser(false); setEditingUser(null); setUserForm(emptyUserForm()); } }}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingUser ? 'Editar Usuario' : 'Nuevo Usuario'}</DialogTitle>
            <DialogDescription>{editingUser ? 'Modifica los datos, rol y acceso del usuario.' : 'Registra un nuevo usuario en el sistema.'}</DialogDescription>
          </DialogHeader>
          {userFormFields}
          <DialogFooter>
            <button onClick={() => { setShowCreateUser(false); setEditingUser(null); setUserForm(emptyUserForm()); }} className="px-4 py-2 rounded-lg border text-sm font-medium">Cancelar</button>
            <button onClick={handleSaveUser} className="px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:opacity-90">
              {editingUser ? 'Guardar Cambios' : 'Crear Usuario'}
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ═══════════ WAREHOUSE DIALOG (Create/Edit) ═══════════ */}
      <Dialog open={showCreateWarehouse || !!editingWarehouse} onOpenChange={open => { if (!open) { setShowCreateWarehouse(false); setEditingWarehouse(null); setWhForm(emptyWhForm()); } }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{editingWarehouse ? 'Editar Bodega' : 'Nueva Bodega'}</DialogTitle>
            <DialogDescription>Configura los datos de la bodega.</DialogDescription>
          </DialogHeader>
          {warehouseFormFields}
          <DialogFooter>
            <button onClick={() => { setShowCreateWarehouse(false); setEditingWarehouse(null); setWhForm(emptyWhForm()); }} className="px-4 py-2 rounded-lg border text-sm font-medium">Cancelar</button>
            <button onClick={handleSaveWarehouse} className="px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:opacity-90">
              {editingWarehouse ? 'Guardar Cambios' : 'Crear Bodega'}
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
