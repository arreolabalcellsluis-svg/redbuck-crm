
ALTER TABLE public.invoice_items
  DROP CONSTRAINT invoice_items_product_id_fkey,
  ADD CONSTRAINT invoice_items_product_id_fkey
    FOREIGN KEY (product_id) REFERENCES public.products(id)
    ON DELETE SET NULL;
