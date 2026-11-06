-- Enable PostgreSQL native search capabilities used by the public catalog.
--   * pg_trgm  -> fuzzy / typo-tolerant matching (similarity, %)
--   * unaccent -> diacritic-insensitive matching ("pho bo" matches "Phở Bò")
--
-- Both extensions are installed in the `extensions` schema when available
-- (Supabase convention), otherwise they stay in the current schema.

CREATE SCHEMA IF NOT EXISTS extensions;
CREATE EXTENSION IF NOT EXISTS unaccent WITH SCHEMA extensions;
CREATE EXTENSION IF NOT EXISTS pg_trgm WITH SCHEMA extensions;

-- unaccent() is STABLE (dictionary lookup), which prevents its direct use in
-- expression indexes. This wrapper is IMMUTABLE so GIN expression indexes work.
DO $migration$
DECLARE
  unaccent_schema text;
BEGIN
  SELECT n.nspname
    INTO unaccent_schema
    FROM pg_extension e
    JOIN pg_namespace n ON n.oid = e.extnamespace
   WHERE e.extname = 'unaccent';

  IF unaccent_schema IS NULL THEN
    RAISE EXCEPTION 'PostgreSQL extension "unaccent" is required for catalog search';
  END IF;

  EXECUTE format(
    'CREATE OR REPLACE FUNCTION public.immutable_unaccent(text) '
    'RETURNS text LANGUAGE sql IMMUTABLE PARALLEL SAFE STRICT '
    'AS $fn$ SELECT %I.unaccent(%L::regdictionary, $1) $fn$',
    unaccent_schema,
    unaccent_schema || '.unaccent'
  );
END
$migration$;

-- Full-text indexes (config = 'simple' because Vietnamese has no built-in stemmer).
CREATE INDEX IF NOT EXISTS "Dish_search_fts_idx"
  ON "Dish" USING GIN (
    to_tsvector(
      'simple',
      public.immutable_unaccent(
        coalesce("name", '') || ' ' ||
        coalesce("description", '') || ' ' ||
        coalesce("category", '')
      )
    )
  );

CREATE INDEX IF NOT EXISTS "Chef_search_fts_idx"
  ON "Chef" USING GIN (
    to_tsvector(
      'simple',
      public.immutable_unaccent(
        coalesce("name", '') || ' ' ||
        coalesce("title", '') || ' ' ||
        coalesce("description", '') || ' ' ||
        coalesce("experience", '')
      )
    )
  );

CREATE INDEX IF NOT EXISTS "Ingredient_search_fts_idx"
  ON "Ingredient" USING GIN (
    to_tsvector(
      'simple',
      public.immutable_unaccent(
        coalesce("name", '') || ' ' ||
        coalesce("description", '') || ' ' ||
        coalesce("category", '')
      )
    )
  );

-- Trigram indexes for fuzzy name matching. The operator class lives in the
-- schema that owns pg_trgm, so it is resolved dynamically for portability.
DO $migration$
DECLARE
  trgm_schema text;
BEGIN
  SELECT n.nspname
    INTO trgm_schema
    FROM pg_extension e
    JOIN pg_namespace n ON n.oid = e.extnamespace
   WHERE e.extname = 'pg_trgm';

  IF trgm_schema IS NULL THEN
    RAISE EXCEPTION 'PostgreSQL extension "pg_trgm" is required for fuzzy search';
  END IF;

  EXECUTE format(
    'CREATE INDEX IF NOT EXISTS "Dish_name_trgm_idx" ON "Dish" USING GIN (public.immutable_unaccent("name") %I.gin_trgm_ops)',
    trgm_schema
  );
  EXECUTE format(
    'CREATE INDEX IF NOT EXISTS "Chef_name_trgm_idx" ON "Chef" USING GIN (public.immutable_unaccent("name") %I.gin_trgm_ops)',
    trgm_schema
  );
  EXECUTE format(
    'CREATE INDEX IF NOT EXISTS "Ingredient_name_trgm_idx" ON "Ingredient" USING GIN (public.immutable_unaccent("name") %I.gin_trgm_ops)',
    trgm_schema
  );
END
$migration$;
