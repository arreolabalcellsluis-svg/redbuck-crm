import { Link } from 'react-router-dom';
import { useAppContext } from '@/contexts/AppContext';
import {
  DollarSign, Star, Warehouse, Skull, AlertTriangle, CreditCard,
  Globe, Building2, Users, TrendingUp, BarChart3, ArrowRight, ShieldAlert,
  FileSpreadsheet, FileText, Crown, BookOpen,
} from 'lucide-react';

const REPORTS = [
  {
    title: 'Ventas',
    description: 'Detalle transaccional por fecha, vendedor, cliente, SKU y canal',
    icon: DollarSign,
    path: '/reportes/ventas',
    color: 'bg-primary/10 text-primary',
    formats: ['Excel', 'PDF'],
    roles: ['director', 'administracion', 'gerencia_comercial'],
  },
  {
    title: 'Rentabilidad por Producto',
    description: 'Costo, margen, utilidad anual por SKU con ranking',
    icon: Star,
    path: '/reportes/rentabilidad',
    color: 'bg-warning/10 text-warning',
    formats: ['Excel'],
    roles: ['director', 'administracion'],
  },
  {
    title: 'Inventario',
    description: 'Stock por bodega, categoría, valor total y en tránsito',
    icon: Warehouse,
    path: '/reportes/inventario',
    color: 'bg-info/10 text-info',
    formats: ['Excel'],
    roles: ['director', 'administracion', 'gerencia_comercial'],
  },
  {
    title: 'Inventario Muerto',
    description: 'Productos sin rotación: 90, 180 y 365 días',
    icon: Skull,
    path: '/reportes/inventario-muerto',
    color: 'bg-destructive/10 text-destructive',
    formats: ['Excel'],
    roles: ['director', 'administracion'],
  },
  {
    title: 'Productos por Agotarse',
    description: 'Bajo stock con punto de reorden y sugerencia de compra',
    icon: AlertTriangle,
    path: '/reportes/bajo-stock',
    color: 'bg-warning/10 text-warning',
    formats: ['Excel'],
    roles: ['director', 'administracion', 'gerencia_comercial'],
  },
  {
    title: 'Cuentas por Cobrar',
    description: 'Cobranza con antigüedad de saldos y cartera vencida',
    icon: CreditCard,
    path: '/reportes/cuentas-cobrar',
    color: 'bg-destructive/10 text-destructive',
    formats: ['Excel', 'PDF'],
    roles: ['director', 'administracion'],
  },
  {
    title: 'Compras e Importaciones',
    description: 'Control de compras por proveedor, valor en tránsito',
    icon: Globe,
    path: '/reportes/compras',
    color: 'bg-primary/10 text-primary',
    formats: ['Excel'],
    roles: ['director', 'administracion'],
  },
  {
    title: 'Distribuidores / Clientes',
    description: 'Ranking de clientes, ventas acumuladas, cartera',
    icon: Building2,
    path: '/reportes/distribuidores',
    color: 'bg-info/10 text-info',
    formats: ['Excel'],
    roles: ['director', 'gerencia_comercial'],
  },
  {
    title: 'Desempeño de Vendedores',
    description: 'Ranking, conversión, cumplimiento de meta y comisiones',
    icon: Users,
    path: '/reportes/desempeno-vendedores',
    color: 'bg-success/10 text-success',
    formats: ['Excel', 'PDF'],
    roles: ['director', 'gerencia_comercial'],
  },
  {
    title: 'Ventas por SKU',
    description: 'Análisis por código de producto: monto, unidades, rentabilidad',
    icon: BarChart3,
    path: '/reportes/ventas-sku',
    color: 'bg-primary/10 text-primary',
    formats: ['Excel'],
    roles: ['director', 'administracion', 'gerencia_comercial'],
  },
  {
    title: 'Estado de Resultados',
    description: 'P&L: ventas, COGS, utilidad bruta, operativa y neta',
    icon: TrendingUp,
    path: '/reportes/estado-resultados',
    color: 'bg-success/10 text-success',
    formats: ['Excel', 'PDF'],
    roles: ['director'],
  },
];

export default function ExecutiveReportsPage() {
  const { currentRole } = useAppContext();

  const accessibleReports = REPORTS.filter(r => r.roles.includes(currentRole));

  if (accessibleReports.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-96 gap-4">
        <ShieldAlert size={48} className="text-destructive" />
        <h2 className="text-xl font-bold">Acceso restringido</h2>
        <p className="text-muted-foreground">No tienes acceso a los reportes ejecutivos.</p>
      </div>
    );
  }

  return (
    <div>
      <div className="page-header">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-primary flex items-center justify-center">
            <BookOpen size={20} className="text-primary-foreground" />
          </div>
          <div>
            <h1 className="page-title">Reportes Ejecutivos</h1>
            <p className="page-subtitle">Genera reportes estratégicos descargables en Excel y PDF</p>
          </div>
        </div>
      </div>

      {/* Quick stats */}
      <div className="grid grid-cols-3 gap-4 mb-6">
        <div className="bg-card rounded-xl border p-4 text-center">
          <div className="text-xs text-muted-foreground">Reportes disponibles</div>
          <div className="text-2xl font-bold text-primary">{accessibleReports.length}</div>
        </div>
        <div className="bg-card rounded-xl border p-4 text-center">
          <div className="text-xs text-muted-foreground">Formatos</div>
          <div className="flex items-center justify-center gap-2 mt-1">
            <span className="flex items-center gap-1 text-xs bg-success/10 text-success px-2 py-0.5 rounded-full"><FileSpreadsheet size={12} /> Excel</span>
            <span className="flex items-center gap-1 text-xs bg-destructive/10 text-destructive px-2 py-0.5 rounded-full"><FileText size={12} /> PDF</span>
          </div>
        </div>
        <div className="bg-card rounded-xl border p-4 text-center">
          <div className="text-xs text-muted-foreground">Rol actual</div>
          <div className="text-sm font-bold mt-1 flex items-center justify-center gap-1">
            <Crown size={14} className="text-warning" />
            {currentRole === 'director' ? 'Director' : currentRole === 'administracion' ? 'Administración' : 'Gerencia'}
          </div>
        </div>
      </div>

      {/* Report cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {accessibleReports.map(report => (
          <Link
            key={report.path}
            to={report.path}
            className="flex flex-col p-5 bg-card rounded-xl border hover:shadow-lg hover:border-primary/30 hover:scale-[1.01] transition-all duration-200 group"
          >
            <div className="flex items-start gap-4 mb-3">
              <div className={`p-3 rounded-lg shrink-0 ${report.color} group-hover:scale-110 transition-transform`}>
                <report.icon size={22} />
              </div>
              <div className="min-w-0 flex-1">
                <h3 className="font-display font-semibold text-sm group-hover:text-primary transition-colors">{report.title}</h3>
                <p className="text-xs text-muted-foreground mt-1 leading-relaxed">{report.description}</p>
              </div>
            </div>
            <div className="flex items-center justify-between mt-auto pt-3 border-t">
              <div className="flex gap-1.5">
                {report.formats.map(f => (
                  <span key={f} className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${
                    f === 'Excel' ? 'bg-success/10 text-success' : 'bg-destructive/10 text-destructive'
                  }`}>
                    {f === 'Excel' ? '📊' : '📄'} {f}
                  </span>
                ))}
              </div>
              <ArrowRight size={14} className="text-muted-foreground group-hover:text-primary group-hover:translate-x-1 transition-all" />
            </div>
          </Link>
        ))}
      </div>

      {/* Tip */}
      <div className="mt-6 bg-muted/30 rounded-xl border border-dashed p-4 flex items-start gap-3">
        <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
          <BookOpen size={16} className="text-primary" />
        </div>
        <div>
          <p className="text-sm font-medium">Tip: Filtros y exportación</p>
          <p className="text-xs text-muted-foreground mt-1">
            Cada reporte incluye filtros por fecha, vendedor, SKU, categoría y más.
            Usa los presets de fecha rápida (Hoy, 30 días, 6 meses, Año actual) y exporta directamente a Excel o PDF con un click.
          </p>
        </div>
      </div>
    </div>
  );
}
