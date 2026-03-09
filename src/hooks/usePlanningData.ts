/**
 * Shared hook that provides mapped data for planning engine consumers.
 * Eliminates the need for each page to independently import hooks + mappers.
 */
import { useMemo } from 'react';
import { useProducts } from '@/hooks/useProducts';
import { useOrders } from '@/hooks/useOrders';
import { useQuotations } from '@/hooks/useQuotations';
import { useImportOrders } from '@/hooks/useImportOrders';
import { useWarehouses } from '@/hooks/useWarehouses';
import { useCustomers } from '@/hooks/useCustomers';
import { useAccountsReceivable } from '@/hooks/useAccountsReceivable';
import { useTeamMembers } from '@/hooks/useTeamMembers';
import { mapDBProduct, mapDBOrder, mapDBQuotation } from '@/lib/dbMappers';
import { analyzeProducts, getPlanningSummary, type ProductAnalysis, type PlanningSummary } from '@/lib/planningEngine';
import type { Product, ImportOrder } from '@/types';
import type { MappedQuotation } from '@/lib/dbMappers';

export function usePlanningData() {
  const { data: dbProducts = [] } = useProducts();
  const { data: dbOrders = [] } = useOrders();
  const { data: dbQuotations = [] } = useQuotations();
  const { data: dbImports = [] } = useImportOrders();
  const { data: warehouses = [] } = useWarehouses();

  const products: Product[] = useMemo(() => dbProducts.map(mapDBProduct), [dbProducts]);
  const orders = useMemo(() => dbOrders.map(mapDBOrder), [dbOrders]);
  const quotations: MappedQuotation[] = useMemo(() => dbQuotations.map(mapDBQuotation), [dbQuotations]);
  const imports: ImportOrder[] = useMemo(() => dbImports, [dbImports]);

  const analyses: ProductAnalysis[] = useMemo(
    () => analyzeProducts(products, orders, quotations, imports),
    [products, orders, quotations, imports]
  );

  const summary: PlanningSummary = useMemo(() => getPlanningSummary(analyses), [analyses]);

  return { products, orders, quotations, imports, warehouses, analyses, summary, dbOrders, dbProducts };
}

export function useReportData() {
  const { data: dbProducts = [] } = useProducts();
  const { data: dbOrders = [] } = useOrders();
  const { data: dbQuotations = [] } = useQuotations();
  const { data: dbCustomers = [] } = useCustomers();
  const { data: dbImports = [] } = useImportOrders();
  const { data: dbReceivables = [] } = useAccountsReceivable();
  const { data: dbTeam = [] } = useTeamMembers();
  const { data: warehouses = [] } = useWarehouses();

  const products: Product[] = useMemo(() => dbProducts.map(mapDBProduct), [dbProducts]);
  const orders = useMemo(() => dbOrders.map(mapDBOrder), [dbOrders]);
  const quotations: MappedQuotation[] = useMemo(() => dbQuotations.map(mapDBQuotation), [dbQuotations]);

  return {
    products, orders, quotations,
    customers: dbCustomers,
    imports: dbImports,
    receivables: dbReceivables,
    team: dbTeam,
    warehouses,
    dbOrders,
  };
}
