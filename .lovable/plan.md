

## Plan: Export database data as CSV + Fix build errors

### Part 1: Export all table data as CSV files

Export data from all 30+ tables using `psql` COPY commands to `/mnt/documents/` so you can import them into your new remix project.

Tables to export:
- customers, products, orders, quotations, invoices, invoice_items, suppliers
- spare_parts, activities, accounts_receivable, accounts_payable, order_payments, payments
- import_orders, purchases, warehouses, team_members, inventory_movements
- commercial_documents, service_orders (if exists), operating_expenses, assets, bank_accounts
- app_settings, area_goals, commission_config, equity_entries, fiscal_settings
- customer_fiscal_data, product_fiscal_data, invoice_cancellations, user_roles

### Part 2: Fix build errors (13 files)

All errors are the same pattern: `Record<string, any>` is incompatible with Supabase's strict typed updates. The fix is to cast the updates object with `as any` in each `.update()` call.

**Files to fix:**
1. `useAccountsPayable.ts` - line 101
2. `useAccountsReceivable.ts` - line 69
3. `useActivities.ts` - line 124
4. `useCustomers.ts` - line 99
5. `useImportOrders.ts` - line 146
6. `useOrders.ts` - line 146
7. `useProducts.ts` - line 149
8. `usePurchases.ts` - line 83
9. `useQuotations.ts` - line 163
10. `useServiceOrders.ts` - line 99
11. `useSpareParts.ts` - line 85
12. `useTeamMembers.ts` - line 94
13. `useWarehouses.ts` - line 58

Each fix: change `.update(updates)` to `.update(updates as any)`.

