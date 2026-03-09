
UPDATE public.invoices SET order_id = NULL WHERE order_id IS NOT NULL;
DELETE FROM public.order_payments;
DELETE FROM public.accounts_receivable;
DELETE FROM public.orders;
