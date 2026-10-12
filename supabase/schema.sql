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
-- Calandria: registro sellado de acciones.
-- * Sin datos personales: solo tipo de tarea, acción, cantidad y minutos.
-- * La base pone el número, la fecha y la huella (SHA-256 de la línea + la
--   huella anterior). La app verifica la cadena con la misma fórmula.
-- * Nadie puede modificar ni borrar líneas (ni el dueño, ni la app). Tampoco se
--   borran si se elimina el usuario: el registro tiene que quedar.
CREATE TABLE IF NOT EXISTS public.kiosk_calandria_log (
  owner UUID NOT NULL DEFAULT auth.uid(),
  seq INTEGER NOT NULL,
  at TEXT NOT NULL,
  kind TEXT NOT NULL CHECK (kind IN ('reposicion', 'ingreso_habitual', 'liquidacion', 'fiados', 'sistema')),
  action TEXT NOT NULL CHECK (action IN ('aprobada', 'descartada', 'pausa', 'reanudada')),
  qty INTEGER NOT NULL DEFAULT 0 CHECK (qty BETWEEN 0 AND 100000),
  minutes INTEGER NOT NULL DEFAULT 0 CHECK (minutes BETWEEN 0 AND 600),
  prev_hash TEXT NOT NULL,
  hash TEXT NOT NULL,
  PRIMARY KEY (owner, seq)
);

CREATE OR REPLACE FUNCTION public.kiosk_calandria_seal()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  last_seq INTEGER;
  last_hash TEXT;
BEGIN
  NEW.owner := COALESCE(auth.uid(), NEW.owner);
  IF NEW.owner IS NULL THEN
    RAISE EXCEPTION 'Calandria: falta el usuario';
  END IF;
  -- Una línea a la vez por cuenta, para que la cadena no se bifurque.
  PERFORM pg_advisory_xact_lock(hashtextextended('calandria:' || NEW.owner::TEXT, 0));
  SELECT l.seq, l.hash INTO last_seq, last_hash
    FROM public.kiosk_calandria_log l WHERE l.owner = NEW.owner ORDER BY l.seq DESC LIMIT 1;
  NEW.seq := COALESCE(last_seq, 0) + 1;
  NEW.prev_hash := COALESCE(last_hash, 'GENESIS');
  NEW.at := to_char(clock_timestamp() AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"');
  NEW.hash := encode(sha256(convert_to(
    NEW.seq || '|' || NEW.at || '|' || NEW.kind || '|' || NEW.action || '|' || NEW.qty || '|' || NEW.minutes || '|' || NEW.prev_hash,
    'UTF8')), 'hex');
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.kiosk_calandria_no_changes()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  RAISE EXCEPTION 'El registro de Calandria no se puede modificar ni borrar';
END;
$$;

DROP TRIGGER IF EXISTS kiosk_calandria_seal ON public.kiosk_calandria_log;
CREATE TRIGGER kiosk_calandria_seal BEFORE INSERT ON public.kiosk_calandria_log
  FOR EACH ROW EXECUTE FUNCTION public.kiosk_calandria_seal();
DROP TRIGGER IF EXISTS kiosk_calandria_no_update ON public.kiosk_calandria_log;
CREATE TRIGGER kiosk_calandria_no_update BEFORE UPDATE OR DELETE ON public.kiosk_calandria_log
  FOR EACH ROW EXECUTE FUNCTION public.kiosk_calandria_no_changes();
DROP TRIGGER IF EXISTS kiosk_calandria_no_truncate ON public.kiosk_calandria_log;
CREATE TRIGGER kiosk_calandria_no_truncate BEFORE TRUNCATE ON public.kiosk_calandria_log
  FOR EACH STATEMENT EXECUTE FUNCTION public.kiosk_calandria_no_changes();

ALTER TABLE public.kiosk_calandria_log ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "calandria ver lo propio" ON public.kiosk_calandria_log;
CREATE POLICY "calandria ver lo propio" ON public.kiosk_calandria_log FOR SELECT TO authenticated
  USING (owner = auth.uid());
DROP POLICY IF EXISTS "calandria agregar lo propio" ON public.kiosk_calandria_log;
CREATE POLICY "calandria agregar lo propio" ON public.kiosk_calandria_log FOR INSERT TO authenticated
  WITH CHECK (owner = auth.uid());
REVOKE ALL ON public.kiosk_calandria_log FROM anon, authenticated;
GRANT SELECT, INSERT ON public.kiosk_calandria_log TO authenticated;
REVOKE ALL ON FUNCTION public.kiosk_calandria_seal() FROM anon, public;

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
