import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate, useLocation } from "react-router-dom";
import { AuthProvider, useAuth } from "@/contexts/AuthContext";
import { AppProvider, useAppContext } from "@/contexts/AppContext";
import { isPathBlockedForRole } from "@/lib/rolePermissions";
import AppLayout from "@/components/layout/AppLayout";
import LoginPage from "./pages/LoginPage";
import ResetPasswordPage from "./pages/ResetPasswordPage";
import DashboardPage from "./pages/DashboardPage";
import ExecutiveDashboardPage from "./pages/ExecutiveDashboardPage";
import CRMPage from "./pages/CRMPage";
import ProductsPage from "./pages/ProductsPage";
import SparePartsPage from "./pages/SparePartsPage";
import InventoryPage from "./pages/InventoryPage";
import QuotationsPage from "./pages/QuotationsPage";
import OrdersPage from "./pages/OrdersPage";
import ReceivablesPage from "./pages/ReceivablesPage";
import PurchasesPage from "./pages/PurchasesPage";
import ImportsPage from "./pages/ImportsPage";
import SuppliersPage from "./pages/SuppliersPage";
import ServicePage from "./pages/ServicePage";
import CommissionsPage from "./pages/CommissionsPage";
import PlanningPage from "./pages/PlanningPage";
import ReportsPage from "./pages/ReportsPage";
import SettingsPage from "./pages/SettingsPage";
import NotFound from "./pages/NotFound";
import RestockOpportunitiesPage from "./pages/RestockOpportunitiesPage";
import CommercialAgendaPage from "./pages/CommercialAgendaPage";
import DailyAssistantPage from "./pages/DailyAssistantPage";
import MarketMapPage from "./pages/MarketMapPage";
import PurchaseHistoryPage from "./pages/PurchaseHistoryPage";
import OrderHistoryPage from "./pages/OrderHistoryPage";
import OperatingExpensesPage from "./pages/OperatingExpensesPage";
import AssetsPage from "./pages/AssetsPage";
import AccountsPayablePage from "./pages/AccountsPayablePage";
import CFODashboardPage from "./pages/CFODashboardPage";
import BalanceSheetPage from "./pages/BalanceSheetPage";
import VendorGoalsPage from "./pages/VendorGoalsPage";
import CommissionSimulatorPage from "./pages/CommissionSimulatorPage";
import SalesForecastPage from "./pages/SalesForecastPage";
import InvoicingPage from "./pages/InvoicingPage";

// Report detail pages
import SalesReportPage from "./pages/reports/SalesReportPage";
import InventoryReportPage from "./pages/reports/InventoryReportPage";
import DeadStockReportPage from "./pages/reports/DeadStockReportPage";
import LowStockReportPage from "./pages/reports/LowStockReportPage";
import SkuSalesReportPage from "./pages/reports/SkuSalesReportPage";
import VendorDetailReportPage from "./pages/reports/VendorDetailReportPage";
import ProfitabilityReportPage from "./pages/reports/ProfitabilityReportPage";

// Executive reports module
import ExecutiveReportsPage from "./pages/reports/ExecutiveReportsPage";
import ReceivablesReportPage from "./pages/reports/ReceivablesReportPage";
import PurchasesReportPage from "./pages/reports/PurchasesReportPage";
import DistributorsReportPage from "./pages/reports/DistributorsReportPage";
import VendorPerformanceReportPage from "./pages/reports/VendorPerformanceReportPage";
import IncomeStatementReportPage from "./pages/reports/IncomeStatementReportPage";
import OverstockReportPage from "./pages/reports/OverstockReportPage";
import ImportPlanningPage from "./pages/reports/ImportPlanningPage";
import FinancialSimulatorPage from "./pages/reports/FinancialSimulatorPage";

const queryClient = new QueryClient();

// Route guard component that checks role permissions
function RoleGuard({ children }: { children: React.ReactNode }) {
  const { currentRole } = useAppContext();
  const location = useLocation();
  
  if (isPathBlockedForRole(location.pathname, currentRole)) {
    return <Navigate to="/" replace />;
  }
  
  return <>{children}</>;
}

function ProtectedRoutes() {
  const { session, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: 'hsl(var(--background))' }}>
        <div className="text-center space-y-3">
          <img src="/images/logo-redbuck.png" alt="Logo" className="w-12 h-12 mx-auto object-contain" />
          <p className="text-sm text-muted-foreground">Cargando...</p>
        </div>
      </div>
    );
  }

  if (!session) {
    return <Navigate to="/login" replace />;
  }

  return (
    <AppProvider>
      <AppLayout>
        <RoleGuard>
          <Routes>
            <Route path="/" element={<DashboardPage />} />
            <Route path="/ejecutivo" element={<ExecutiveDashboardPage />} />
            <Route path="/financiero" element={<CFODashboardPage />} />
            <Route path="/crm" element={<CRMPage />} />
            <Route path="/crm/reabasto" element={<RestockOpportunitiesPage />} />
            <Route path="/crm/agenda" element={<CommercialAgendaPage />} />
            <Route path="/crm/asistente" element={<DailyAssistantPage />} />
            <Route path="/crm/mapa-mercado" element={<MarketMapPage />} />
            <Route path="/productos" element={<ProductsPage />} />
            <Route path="/refacciones" element={<SparePartsPage />} />
            <Route path="/inventario" element={<InventoryPage />} />
            <Route path="/cotizaciones" element={<QuotationsPage />} />
            <Route path="/pedidos" element={<OrdersPage />} />
            <Route path="/cobranza" element={<ReceivablesPage />} />
            <Route path="/cuentas-pagar" element={<AccountsPayablePage />} />
            <Route path="/compras" element={<PurchasesPage />} />
            <Route path="/historial-compras" element={<PurchaseHistoryPage />} />
            <Route path="/historial-pedidos" element={<OrderHistoryPage />} />
            <Route path="/importaciones" element={<ImportsPage />} />
            <Route path="/proveedores" element={<SuppliersPage />} />
            <Route path="/servicio" element={<ServicePage />} />
            <Route path="/comisiones" element={<CommissionsPage />} />
            <Route path="/metas-vendedores" element={<VendorGoalsPage />} />
            <Route path="/simulador-comisiones" element={<CommissionSimulatorPage />} />
            <Route path="/pronostico-ventas" element={<SalesForecastPage />} />
            <Route path="/planeacion" element={<PlanningPage />} />
            <Route path="/gastos" element={<OperatingExpensesPage />} />
            <Route path="/activos" element={<AssetsPage />} />
            <Route path="/balance-general" element={<BalanceSheetPage />} />
            <Route path="/reportes" element={<ReportsPage />} />
            <Route path="/reportes-ejecutivos" element={<ExecutiveReportsPage />} />
            <Route path="/reportes/ventas" element={<SalesReportPage />} />
            <Route path="/reportes/inventario" element={<InventoryReportPage />} />
            <Route path="/reportes/inventario-muerto" element={<DeadStockReportPage />} />
            <Route path="/reportes/bajo-stock" element={<LowStockReportPage />} />
            <Route path="/reportes/ventas-sku" element={<SkuSalesReportPage />} />
            <Route path="/reportes/vendedor" element={<VendorDetailReportPage />} />
            <Route path="/reportes/rentabilidad" element={<ProfitabilityReportPage />} />
            <Route path="/reportes/cuentas-cobrar" element={<ReceivablesReportPage />} />
            <Route path="/reportes/compras" element={<PurchasesReportPage />} />
            <Route path="/reportes/distribuidores" element={<DistributorsReportPage />} />
            <Route path="/reportes/desempeno-vendedores" element={<VendorPerformanceReportPage />} />
            <Route path="/reportes/estado-resultados" element={<IncomeStatementReportPage />} />
            <Route path="/reportes/sobreinventario" element={<OverstockReportPage />} />
            <Route path="/reportes/plan-importaciones" element={<ImportPlanningPage />} />
            <Route path="/reportes/simulador-financiero" element={<FinancialSimulatorPage />} />
            <Route path="/facturacion" element={<InvoicingPage />} />
            <Route path="/configuracion" element={<SettingsPage />} />
            <Route path="*" element={<NotFound />} />
          </Routes>
        </RoleGuard>
      </AppLayout>
    </AppProvider>
  );
}

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <AuthProvider>
          <Routes>
            <Route path="/login" element={<LoginPage />} />
            <Route path="/reset-password" element={<ResetPasswordPage />} />
            <Route path="/*" element={<ProtectedRoutes />} />
          </Routes>
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
