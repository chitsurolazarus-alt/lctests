-- ============================================================
-- 00_cleanup.sql
-- Wipes the invoicing/contracts schema so you can re-run the migration
-- from a clean slate. Run this ONCE, then run migration-invoicing-contracts.sql.
-- Safe to run even if some objects don't exist yet (everything is "if exists").
-- This only touches the 4 invoicing/contracts objects — it does NOT drop the
-- portfolios / reviews / messages tables from schema.sql.
-- ============================================================

-- 1. RLS policies
drop policy if exists "Authenticated can view settings"   on business_settings;
drop policy if exists "Authenticated can update settings"   on business_settings;
drop policy if exists "Authenticated full access to invoices"  on invoices;
drop policy if exists "Authenticated full access to templates" on contract_templates;
drop policy if exists "Authenticated full access to contracts" on contracts;

-- 2. Public RPC functions (drop BOTH the old 4-arg and new 5-arg sign_contract)
drop function if exists get_contract_by_token(text);
drop function if exists sign_contract(text, text, text, boolean);
drop function if exists sign_contract(text, text, text, boolean, text);

-- 3. Tables (cascade clears any FK dependencies)
drop table if exists contracts           cascade;
drop table if exists contract_templates  cascade;
drop table if exists invoices             cascade;
drop table if exists business_settings    cascade;
