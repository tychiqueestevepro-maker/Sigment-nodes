
-- Fix constraints on organizations table
-- 1. Allow duplicate names (remove UNIQUE on name)
-- 2. Enforce unique slugs (ensure UNIQUE on slug)

DO $$
DECLARE
    r RECORD;
BEGIN
    -- 1. Find and drop any UNIQUE constraint on the 'name' column
    FOR r IN 
        SELECT con.conname
        FROM pg_constraint con
        JOIN pg_class rel ON rel.oid = con.conrelid
        JOIN pg_namespace nsp ON nsp.oid = rel.relnamespace
        JOIN pg_attribute att ON att.attrelid = rel.oid AND att.attnum = ANY(con.conkey)
        WHERE nsp.nspname = 'public'
          AND rel.relname = 'organizations'
          AND att.attname = 'name'
          AND con.contype = 'u' -- 'u' for unique constraint
    LOOP
        EXECUTE 'ALTER TABLE organizations DROP CONSTRAINT ' || quote_ident(r.conname);
        RAISE NOTICE 'Dropped unique constraint on organizations.name: %', r.conname;
    END LOOP;

    -- 2. Ensure UNIQUE constraint on 'slug' exists
    -- Check if a unique constraint/index on slug already exists
    IF NOT EXISTS (
        SELECT 1
        FROM pg_constraint con
        JOIN pg_class rel ON rel.oid = con.conrelid
        JOIN pg_namespace nsp ON nsp.oid = rel.relnamespace
        JOIN pg_attribute att ON att.attrelid = rel.oid AND att.attnum = ANY(con.conkey)
        WHERE nsp.nspname = 'public'
          AND rel.relname = 'organizations'
          AND att.attname = 'slug'
          AND con.contype = 'u'
    ) THEN
        -- If not found, add it
        ALTER TABLE organizations ADD CONSTRAINT organizations_slug_key UNIQUE (slug);
        RAISE NOTICE 'Added unique constraint on organizations.slug';
    ELSE
        RAISE NOTICE 'Unique constraint on organizations.slug already exists';
    END IF;

END $$;
