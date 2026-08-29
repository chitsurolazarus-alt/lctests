-- ============================================================
-- 02_invoices.sql
-- Run SECOND. Creates the invoices table + RLS.
-- Idempotent: safe to re-run.
-- ============================================================

create table if not exists invoices (
  id uuid primary key default gen_random_uuid(),
  invoice_number text unique not null,
  client_name text not null,
  client_email text,
  client_phone text,
  client_company text,
  client_address text,
  issue_date date not null default current_date,
  due_date date,
  items jsonb not null default '[]',
  subtotal numeric(12,2) not null default 0,
  vat_percent numeric(5,2) not null default 15,
  vat_amount numeric(12,2) not null default 0,
  discount numeric(12,2) not null default 0,
  total numeric(12,2) not null default 0,
  notes text,
  status text not null default 'draft' check (status in ('draft','sent','paid','overdue','cancelled')),
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

alter table invoices enable row level security;

drop policy if exists "Authenticated full access to invoices" on invoices;
create policy "Authenticated full access to invoices" on invoices
  for all to authenticated using (true) with check (true);
-- No anon policy: invoices are never publicly readable.
