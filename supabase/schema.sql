-- Sistema Kiosco — estructura y seguridad para Supabase
-- Pegar en Supabase → SQL Editor → Run (se puede volver a correr).
-- Cada cuenta ve SOLO sus datos (RLS por owner). Sin login no se ve nada.

CREATE TABLE IF NOT EXISTS public.kiosk_products (
  id TEXT PRIMARY KEY,
  owner UUID NOT NULL DEFAULT auth.uid() REFERENCES auth.users (id) ON DELETE CASCADE,
  data JSONB NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.kiosk_sales (
  id TEXT PRIMARY KEY,
  owner UUID NOT NULL DEFAULT auth.uid() REFERENCES auth.users (id) ON DELETE CASCADE,
  data JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.kiosk_movements (
  id TEXT PRIMARY KEY,
  owner UUID NOT NULL DEFAULT auth.uid() REFERENCES auth.users (id) ON DELETE CASCADE,
  data JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.kiosk_meta (
  owner UUID PRIMARY KEY DEFAULT auth.uid() REFERENCES auth.users (id) ON DELETE CASCADE,
  categories JSONB,
  current_shift JSONB,
  closed_shifts JSONB,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS kiosk_products_owner_idx ON public.kiosk_products (owner);
CREATE INDEX IF NOT EXISTS kiosk_sales_owner_created_idx ON public.kiosk_sales (owner, created_at DESC);
CREATE INDEX IF NOT EXISTS kiosk_movements_owner_created_idx ON public.kiosk_movements (owner, created_at DESC);

-- RLS: cada usuario solo ve y modifica lo suyo.
ALTER TABLE public.kiosk_products ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.kiosk_sales ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.kiosk_movements ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.kiosk_meta ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "productos propios" ON public.kiosk_products;
CREATE POLICY "productos propios" ON public.kiosk_products FOR ALL TO authenticated
  USING (owner = auth.uid()) WITH CHECK (owner = auth.uid());
DROP POLICY IF EXISTS "ventas propias" ON public.kiosk_sales;
CREATE POLICY "ventas propias" ON public.kiosk_sales FOR ALL TO authenticated
  USING (owner = auth.uid()) WITH CHECK (owner = auth.uid());
DROP POLICY IF EXISTS "movimientos propios" ON public.kiosk_movements;
CREATE POLICY "movimientos propios" ON public.kiosk_movements FOR ALL TO authenticated
  USING (owner = auth.uid()) WITH CHECK (owner = auth.uid());
DROP POLICY IF EXISTS "caja propia" ON public.kiosk_meta;
CREATE POLICY "caja propia" ON public.kiosk_meta FOR ALL TO authenticated
  USING (owner = auth.uid()) WITH CHECK (owner = auth.uid());

REVOKE ALL ON public.kiosk_products, public.kiosk_sales, public.kiosk_movements, public.kiosk_meta FROM anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.kiosk_products, public.kiosk_sales, public.kiosk_movements, public.kiosk_meta TO authenticated;

-- Guarda un producto y SUMA la diferencia de stock en una sola operación.
-- Así dos equipos que venden el mismo producto a la vez no se pisan.
CREATE OR REPLACE FUNCTION public.kiosk_upsert_product(p JSONB, stock_delta NUMERIC, is_new BOOLEAN)
RETURNS NUMERIC
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  new_stock NUMERIC;
BEGIN
  INSERT INTO public.kiosk_products AS kp (id, owner, data, updated_at)
  VALUES (p->>'id', auth.uid(), p, now())
  ON CONFLICT (id) DO UPDATE
    SET data = jsonb_set(
          EXCLUDED.data,
          '{stock}',
          to_jsonb(GREATEST(0, COALESCE((kp.data->>'stock')::NUMERIC, 0) + CASE WHEN is_new THEN 0 ELSE stock_delta END))
        ),
        updated_at = now()
  RETURNING (data->>'stock')::NUMERIC INTO new_stock;
  RETURN new_stock;
END;
$$;
REVOKE ALL ON FUNCTION public.kiosk_upsert_product(JSONB, NUMERIC, BOOLEAN) FROM anon, public;
GRANT EXECUTE ON FUNCTION public.kiosk_upsert_product(JSONB, NUMERIC, BOOLEAN) TO authenticated;

-- Tiempo real: avisar a los otros equipos de cada cambio.
DO $$
DECLARE t TEXT;
BEGIN
  IF EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime') THEN
    FOREACH t IN ARRAY ARRAY['kiosk_products', 'kiosk_sales', 'kiosk_movements', 'kiosk_meta'] LOOP
      IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND tablename = t) THEN
        EXECUTE format('ALTER PUBLICATION supabase_realtime ADD TABLE public.%I', t);
      END IF;
    END LOOP;
  END IF;
END $$;

-- ---------------------------------------------------------------------------
-- Versión anterior: todo el kiosco estaba en la tabla kiosk_state (fila 'main').
-- 1) Para pasar esos datos a la cuenta del negocio, reemplazar el email y correr:
--
-- WITH u AS (SELECT id FROM auth.users WHERE email = 'duena@ejemplo.com'),
--      s AS (SELECT data FROM public.kiosk_state WHERE id = 'main')
-- , a AS (INSERT INTO public.kiosk_products (id, owner, data)
--          SELECT e->>'id', u.id, e FROM s, u, jsonb_array_elements(s.data->'products') e ON CONFLICT DO NOTHING)
-- , b AS (INSERT INTO public.kiosk_sales (id, owner, data, created_at)
--          SELECT e->>'id', u.id, e, (e->>'date')::timestamptz FROM s, u, jsonb_array_elements(s.data->'sales') e ON CONFLICT DO NOTHING)
-- , c AS (INSERT INTO public.kiosk_movements (id, owner, data, created_at)
--          SELECT e->>'id', u.id, e, (e->>'date')::timestamptz FROM s, u, jsonb_array_elements(s.data->'stockMovements') e ON CONFLICT DO NOTHING)
-- INSERT INTO public.kiosk_meta (owner, categories, current_shift, closed_shifts)
--   SELECT u.id, s.data->'categories', s.data->'currentShift', '[]'::jsonb FROM s, u ON CONFLICT (owner) DO NOTHING;
--
-- 2) Cerrar la tabla vieja (la clave anon quedó publicada en GitHub):
DO $$
BEGIN
  IF to_regclass('public.kiosk_state') IS NOT NULL THEN
    EXECUTE 'ALTER TABLE public.kiosk_state ENABLE ROW LEVEL SECURITY';
    EXECUTE 'REVOKE ALL ON public.kiosk_state FROM anon, authenticated';
  END IF;
END $$;
