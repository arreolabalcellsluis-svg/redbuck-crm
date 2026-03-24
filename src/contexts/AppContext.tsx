import { useState, useEffect, createContext, useContext, ReactNode, useCallback } from 'react';
import { UserRole, Quotation, QuotationStatus, User, Order, AccountReceivable } from '@/types';
import { Payment } from '@/types/payments';
import { useTeamMembers } from '@/hooks/useTeamMembers';
import { addAuditLog } from '@/lib/auditLog';
import { useAuth } from '@/contexts/AuthContext';

// Vendor series state: vendorId -> current consecutive number
type VendorSeriesMap = Record<string, number>;

function buildInitialSeries(users: User[]): VendorSeriesMap {
  const map: VendorSeriesMap = {};
  users.filter(u => u.role === 'vendedor' && u.seriesPrefix).forEach(u => {
    map[u.id] = u.seriesCurrent ?? u.seriesStart ?? 1000;
  });
  return map;
}

interface AppContextType {
  currentRole: UserRole;
  setCurrentRole: (role: UserRole) => void;
  sidebarOpen: boolean;
  setSidebarOpen: (open: boolean) => void;
  // Quotation state
  quotations: Quotation[];
  addQuotation: (q: Quotation) => void;
  updateQuotation: (q: Quotation) => void;
  updateQuotationStatus: (id: string, status: QuotationStatus) => void;
  // Series
  vendorSeries: VendorSeriesMap;
  getNextFolio: (vendorId: string) => string;
  consumeFolio: (vendorId: string) => void;
  // Shared orders/receivables/payments state
  orders: Order[];
  setOrders: React.Dispatch<React.SetStateAction<Order[]>>;
  receivables: AccountReceivable[];
  setReceivables: React.Dispatch<React.SetStateAction<AccountReceivable[]>>;
  payments: Payment[];
  setPayments: React.Dispatch<React.SetStateAction<Payment[]>>;
  // Helper functions
  getOrderPayments: (orderId: string) => Payment[];
  getTotalPaid: (orderId: string) => number;
  registerPayment: (orderId: string, payment: Omit<Payment, 'id'>) => void;
  // Exchange rate
  exchangeRate: number;
  setExchangeRate: (rate: number) => void;
}

const AppContext = createContext<AppContextType | null>(null);

export function AppProvider({ children }: { children: ReactNode }) {
  const { userRole } = useAuth();
  const { data: teamMembers = [] } = useTeamMembers();
  const [currentRole, setCurrentRole] = useState<UserRole>('director');
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [quotations, setQuotations] = useState<Quotation[]>([]);
  const [vendorSeries, setVendorSeries] = useState<VendorSeriesMap>({});

  // Shared state for orders, receivables, payments
  const [orders, setOrders] = useState<Order[]>([]);
  const [receivables, setReceivables] = useState<AccountReceivable[]>([]);
  const [payments, setPayments] = useState<Payment[]>([]);
  // Sync auth role with app context
  useEffect(() => {
    if (userRole) {
      setCurrentRole(userRole as UserRole);
    }
  }, [userRole]);

  const [exchangeRate, setExchangeRate] = useState<number>(17.5);

  const getNextFolio = useCallback((vendorId: string): string => {
    const vendor = demoUsers.find(u => u.id === vendorId);
    if (!vendor?.seriesPrefix) return `COT-${Date.now()}`;
    const current = vendorSeries[vendorId] ?? vendor.seriesStart ?? 1000;
    const next = current + 1;
    return `${vendor.seriesPrefix}-${next}`;
  }, [vendorSeries]);

  const consumeFolio = useCallback((vendorId: string) => {
    setVendorSeries(prev => {
      const vendor = demoUsers.find(u => u.id === vendorId);
      const current = prev[vendorId] ?? vendor?.seriesStart ?? 1000;
      return { ...prev, [vendorId]: current + 1 };
    });
  }, []);

  const addQuotation = useCallback((q: Quotation) => {
    setQuotations(prev => {
      if (prev.some(existing => existing.folio === q.folio)) {
        console.warn(`Folio duplicado: ${q.folio}`);
        return prev;
      }
      return [q, ...prev];
    });
  }, []);

  const updateQuotation = useCallback((q: Quotation) => {
    setQuotations(prev => prev.map(existing => existing.id === q.id ? q : existing));
  }, []);

  const updateQuotationStatus = useCallback((id: string, status: QuotationStatus) => {
    setQuotations(prev => prev.map(q => q.id === id ? { ...q, status } : q));
  }, []);

  const getOrderPayments = useCallback((orderId: string) => {
    return payments.filter(p => p.orderId === orderId);
  }, [payments]);

  const getTotalPaid = useCallback((orderId: string) => {
    const order = orders.find(o => o.id === orderId);
    const paymentSum = payments.filter(p => p.orderId === orderId).reduce((s, p) => s + p.amount, 0);
    return (order?.advance || 0) + paymentSum;
  }, [orders, payments]);

  const registerPayment = useCallback((orderId: string, paymentData: Omit<Payment, 'id'>) => {
    const payment: Payment = {
      ...paymentData,
      id: `pay-${Date.now()}-${Math.random().toString(36).slice(2, 5)}`,
    };
    setPayments(prev => [...prev, payment]);

    // Update order balance
    const order = orders.find(o => o.id === orderId);
    if (!order) return;
    const currentPaid = getTotalPaid(orderId);
    const newPaid = currentPaid + paymentData.amount;
    const newBalance = order.total - newPaid;

    setOrders(prev => prev.map(o => o.id === orderId ? { ...o, balance: Math.max(0, newBalance) } : o));
    setReceivables(prev => prev.map(r => r.orderId === orderId ? {
      ...r,
      paid: newPaid,
      balance: Math.max(0, newBalance),
      status: newBalance <= 0 ? 'liquidado' : 'pago_parcial',
    } : r));

    addAuditLog({
      userId: 'current',
      userName: 'Usuario actual',
      module: 'pedidos',
      action: 'registrar_pago',
      entityId: orderId,
      newValue: `$${paymentData.amount} - ${paymentData.method}`,
      comment: paymentData.comment,
    });
  }, [orders, payments, getTotalPaid]);

  return (
    <AppContext.Provider value={{
      currentRole, setCurrentRole,
      sidebarOpen, setSidebarOpen,
      quotations, addQuotation, updateQuotation, updateQuotationStatus,
      vendorSeries, getNextFolio, consumeFolio,
      orders, setOrders,
      receivables, setReceivables,
      payments, setPayments,
      getOrderPayments, getTotalPaid, registerPayment,
      exchangeRate, setExchangeRate,
    }}>
      {children}
    </AppContext.Provider>
  );
}

export function useAppContext() {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error('useAppContext must be used within AppProvider');
  return ctx;
}
