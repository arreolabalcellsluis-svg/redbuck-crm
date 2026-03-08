import { NavLink, useLocation } from 'react-router-dom';
import { useAppContext } from '@/contexts/AppContext';
import { useAuth } from '@/contexts/AuthContext';
import { ROLE_LABELS } from '@/types';
import { useCompanyLogo } from '@/hooks/useCompanyLogo';
import { getNavItemsForRole } from '@/lib/rolePermissions';
import {
  LayoutDashboard, Users, Package, Wrench, Warehouse, FileText,
  ShoppingCart, CreditCard, Truck, Globe, Building2, Settings,
  BadgeDollarSign, BarChart3, Search, Bell, ChevronLeft, ChevronRight,
  Menu, X, Cog, UserCircle, Brain, Crown, BookOpen, Calculator, LogOut, RefreshCw, CalendarDays, Sparkles, MapPin,
  ClipboardList, Wallet, Target, TrendingUp,
} from 'lucide-react';

const navItems = [
  { label: 'Dashboard', icon: LayoutDashboard, path: '/' },
  { label: 'Dashboard Ejecutivo', icon: Crown, path: '/ejecutivo' },
  { label: 'Dashboard Financiero', icon: Calculator, path: '/financiero' },
  { label: 'CRM', icon: Users, path: '/crm' },
  { label: 'Reabasto', icon: RefreshCw, path: '/crm/reabasto' },
  { label: 'Agenda', icon: CalendarDays, path: '/crm/agenda' },
  { label: 'Asistente', icon: Sparkles, path: '/crm/asistente' },
  { label: 'Mapa Mercado', icon: MapPin, path: '/crm/mapa-mercado' },
  { label: 'Productos', icon: Package, path: '/productos' },
  { label: 'Refacciones', icon: Wrench, path: '/refacciones' },
  { label: 'Inventario', icon: Warehouse, path: '/inventario' },
  { label: 'Cotizaciones', icon: FileText, path: '/cotizaciones' },
  { label: 'Pedidos', icon: ShoppingCart, path: '/pedidos' },
  { label: 'Hist. Pedidos', icon: ClipboardList, path: '/historial-pedidos' },
  { label: 'Cobranza', icon: CreditCard, path: '/cobranza' },
  { label: 'Cuentas x Pagar', icon: Wallet, path: '/cuentas-pagar' },
  { label: 'Compras', icon: Truck, path: '/compras' },
  { label: 'Hist. Compras', icon: ClipboardList, path: '/historial-compras' },
  { label: 'Importaciones', icon: Globe, path: '/importaciones' },
  { label: 'Proveedores', icon: Building2, path: '/proveedores' },
  { label: 'Servicio Técnico', icon: Cog, path: '/servicio' },
  { label: 'Comisiones', icon: BadgeDollarSign, path: '/comisiones' },
  { label: 'Metas Vendedores', icon: Target, path: '/metas-vendedores' },
  { label: 'Simulador Comisiones', icon: Calculator, path: '/simulador-comisiones' },
  { label: 'Pronóstico Ventas', icon: TrendingUp, path: '/pronostico-ventas' },
  { label: 'Gastos Operativos', icon: Wallet, path: '/gastos' },
  { label: 'Activos / Depreciación', icon: Building2, path: '/activos' },
  { label: 'Planeación', icon: Brain, path: '/planeacion' },
  { label: 'Reportes', icon: BarChart3, path: '/reportes' },
  { label: 'Reportes Ejecutivos', icon: BookOpen, path: '/reportes-ejecutivos' },
  { label: 'Simulador Financiero', icon: Calculator, path: '/reportes/simulador-financiero' },
  { label: 'Configuración', icon: Settings, path: '/configuracion' },
];

export default function AppSidebar() {
  const { currentRole, setCurrentRole, sidebarOpen, setSidebarOpen } = useAppContext();
  const { user, userRole, signOut } = useAuth();
  const location = useLocation();
  const { logoUrl } = useCompanyLogo();

  return (
    <>
      {/* Mobile overlay */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-40 bg-foreground/20 backdrop-blur-sm lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      <aside
        className={`fixed top-0 left-0 z-50 h-screen flex flex-col transition-all duration-300 ${
          sidebarOpen ? 'w-64' : 'w-0 lg:w-16'
        } overflow-hidden`}
        style={{ background: 'hsl(var(--sidebar-background))' }}
      >
        {/* Brand */}
        <div className="flex items-center justify-between px-4 h-16 shrink-0" style={{ borderBottom: '1px solid hsl(var(--sidebar-border))' }}>
          {sidebarOpen && (
            <div className="flex items-center gap-2">
              {logoUrl ? (
                <img src={logoUrl} alt="Logo" className="w-8 h-8 rounded-lg object-contain" />
              ) : (
                <div className="w-8 h-8 rounded-lg flex items-center justify-center font-display font-bold text-sm" style={{ background: 'hsl(var(--sidebar-primary))', color: 'hsl(var(--sidebar-primary-foreground))' }}>
                  RB
                </div>
              )}
              <div>
                <div className="text-sm font-bold font-display" style={{ color: 'hsl(var(--sidebar-accent-foreground))' }}>REDBUCK</div>
                <div className="text-[10px] tracking-widest uppercase" style={{ color: 'hsl(var(--sidebar-muted))' }}>ERP · CRM</div>
              </div>
            </div>
          )}
          <button
            onClick={() => setSidebarOpen(!sidebarOpen)}
            className="p-1.5 rounded-md transition-colors hidden lg:flex"
            style={{ color: 'hsl(var(--sidebar-muted))' }}
          >
            {sidebarOpen ? <ChevronLeft size={18} /> : <ChevronRight size={18} />}
          </button>
        </div>

        {/* Nav */}
        <nav className="flex-1 overflow-y-auto py-3 px-2 space-y-0.5">
          {getNavItemsForRole(navItems, currentRole).map((item) => {
            const isActive = location.pathname === item.path || (item.path !== '/' && location.pathname.startsWith(item.path));
            return (
              <NavLink
                key={item.path}
                to={item.path}
                onClick={() => window.innerWidth < 1024 && setSidebarOpen(false)}
                className={`sidebar-link ${isActive ? 'sidebar-link-active' : ''}`}
                title={item.label}
              >
                <item.icon size={18} className="shrink-0" />
                {sidebarOpen && <span>{item.label}</span>}
              </NavLink>
            );
          })}
        </nav>

        {/* Role Switcher (demo) */}
        {sidebarOpen && (
          <div className="p-3 shrink-0" style={{ borderTop: '1px solid hsl(var(--sidebar-border))' }}>
            <div className="text-[10px] uppercase tracking-wider mb-2" style={{ color: 'hsl(var(--sidebar-muted))' }}>Vista como:</div>
            <select
              value={currentRole}
              onChange={(e) => setCurrentRole(e.target.value as any)}
              className="w-full text-xs rounded-md px-2 py-1.5 border-0"
              style={{ background: 'hsl(var(--sidebar-accent))', color: 'hsl(var(--sidebar-accent-foreground))' }}
            >
              {Object.entries(ROLE_LABELS).map(([k, v]) => (
                <option key={k} value={k}>{v}</option>
              ))}
            </select>
          </div>
        )}

        {/* User */}
        <div className="p-3 shrink-0 flex items-center gap-3" style={{ borderTop: '1px solid hsl(var(--sidebar-border))' }}>
          <div className="w-8 h-8 rounded-full flex items-center justify-center shrink-0" style={{ background: 'hsl(var(--sidebar-accent))' }}>
            <UserCircle size={18} style={{ color: 'hsl(var(--sidebar-muted))' }} />
          </div>
          {sidebarOpen && (
            <div className="min-w-0 flex-1">
              <div className="text-xs font-medium truncate" style={{ color: 'hsl(var(--sidebar-accent-foreground))' }}>
                {user?.email?.split('@')[0] ?? 'Usuario'}
              </div>
              <div className="text-[10px] truncate" style={{ color: 'hsl(var(--sidebar-muted))' }}>
                {ROLE_LABELS[currentRole]}
              </div>
            </div>
          )}
          {sidebarOpen && (
            <button
              onClick={signOut}
              className="p-1.5 rounded-md transition-colors hover:bg-destructive/20"
              style={{ color: 'hsl(var(--sidebar-muted))' }}
              title="Cerrar sesión"
            >
              <LogOut size={16} />
            </button>
          )}
        </div>
      </aside>
    </>
  );
}
