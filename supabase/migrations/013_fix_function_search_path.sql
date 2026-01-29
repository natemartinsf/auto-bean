-- Fix generate_short_code function to use immutable search_path
-- Addresses Supabase linter warning about mutable search_path (security risk)

CREATE OR REPLACE FUNCTION public.generate_short_code()
RETURNS TEXT
LANGUAGE plpgsql
SET search_path = ''
AS $$
DECLARE
  chars TEXT := 'abcdefghijklmnopqrstuvwxyz0123456789';
  result TEXT := '';
  i INT;
  random_bytes BYTEA;
BEGIN
  random_bytes := pg_catalog.gen_random_bytes(8);
  FOR i IN 0..7 LOOP
    result := result || pg_catalog.substr(chars, (pg_catalog.get_byte(random_bytes, i) % 36) + 1, 1);
  END LOOP;
  RETURN result;
END;
$$;
