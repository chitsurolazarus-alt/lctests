-- ============================================================
-- 01_business_settings.sql
-- Run this FIRST (order matters: 01 -> 02 -> 03 -> 04 -> 05).
-- Creates the single-row business_settings table that powers the
-- invoice/contract letterhead + banking details, and its RLS policies.
-- Idempotent: safe to re-run.
-- ============================================================

-- Needed for the contracts token default (gen_random_bytes).
create extension if not exists pgcrypto;

create table if not exists business_settings (
  id int primary key default 1,
  company_name text not null default 'LC GLOBAL HOLDINGS (PTY) LTD',
  registration_no text,
  tax_no text,
  company_address text,
  company_address2 text,
  company_phone text,
  company_email text,
  website text,
  vat_number text,
  bank_name text,
  bank_account_holder text,
  bank_account_number text,
  bank_branch_code text,
  bank_branch_name text,
  bank_account_type text,
  bank_swift_code text,
  logo_url text,
  invoice_prefix text default 'INV',
  invoice_footer_note text default 'Thank you for your business.',
  updated_at timestamptz default now(),
  constraint single_row check (id = 1)
);

-- Add any new columns if an earlier migration already created the table
-- (so this script also upgrades an existing business_settings table).
alter table business_settings add column if not exists registration_no   text;
alter table business_settings add column if not exists tax_no            text;
alter table business_settings add column if not exists company_address2  text;
alter table business_settings add column if not exists website           text;
alter table business_settings add column if not exists bank_branch_name  text;
alter table business_settings add column if not exists bank_account_type text;
alter table business_settings add column if not exists bank_swift_code   text;

alter table business_settings enable row level security;

drop policy if exists "Authenticated can view settings" on business_settings;
create policy "Authenticated can view settings" on business_settings
  for select to authenticated using (true);

drop policy if exists "Authenticated can update settings" on business_settings;
create policy "Authenticated can update settings" on business_settings
  for update to authenticated using (true);
