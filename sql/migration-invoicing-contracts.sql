-- ============================================================
-- migration-invoicing-contracts.sql  (CORRECTED IN PLACE, IDEMPOTENT)
-- ------------------------------------------------------------
-- Run AFTER sql/00_cleanup.sql (or just run this on its own — every
-- statement is "if not exists" / "drop … create", so re-running it
-- never errors with "policy already exists" / "relation already exists").
--
-- What it builds:
--   • business_settings  (single row: letterhead + FNB banking, seeded)
--   • invoices           (admin only)
--   • contract_templates (reusable wording, 1 seed)
--   • contracts          (sent to clients; has signed_phone)
--   • get_contract_by_token(text)  -> anon, no login
--   • sign_contract(text,text,text,boolean,text) -> anon, no login (stores phone)
-- ============================================================

create extension if not exists pgcrypto;

-- ---------- 1. BUSINESS SETTINGS ----------
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
-- Upgrade an existing (older) business_settings table if it pre-dates these columns.
alter table business_settings add column if not exists registration_no   text;
alter table business_settings add column if not exists tax_no            text;
alter table business_settings add column if not exists company_address2  text;
alter table business_settings add column if not exists website           text;
alter table business_settings add column if not exists bank_branch_name  text;
alter table business_settings add column if not exists bank_account_type text;
alter table business_settings add column if not exists bank_swift_code   text;

alter table business_settings enable row level security;
drop policy if exists "Authenticated can view settings" on business_settings;
drop policy if exists "Authenticated can update settings" on business_settings;
drop policy if exists "Authenticated full access to settings" on business_settings;
create policy "Authenticated full access to settings" on business_settings
  for all to authenticated using (true) with check (true);

-- ---------- 2. INVOICES ----------
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

-- ---------- 3. CONTRACT TEMPLATES ----------
create table if not exists contract_templates (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  body text not null,
  default_deposit_percent numeric(5,2) default 50,
  created_at timestamptz default now()
);

alter table contract_templates enable row level security;
drop policy if exists "Authenticated full access to templates" on contract_templates;
create policy "Authenticated full access to templates" on contract_templates
  for all to authenticated using (true) with check (true);

-- Seed one starter template (dollar-quoted so apostrophes/newlines can't break).
insert into contract_templates (name, body, default_deposit_percent)
select 'Standard Subscription / Project Agreement',
  $$This agreement is entered into between L.C Digital Solution WebCraft Studios ("the Service Provider") and {{client_name}} ("the Client") for the following service:

{{service_description}}

TOTAL PROJECT VALUE: R{{total_amount}}
DEPOSIT REQUIRED: R{{deposit_amount}} ({{deposit_percent}}% of total value), payable before work commences.

DEPOSIT & REFUND TERMS:
The deposit secures the Client's place in the Service Provider's work schedule and covers initial setup, planning, and resource allocation. Once the deposit has been paid and work has commenced, the deposit becomes NON-REFUNDABLE, regardless of whether the Client later chooses to cancel, pause, or discontinue the project. This applies even if only preliminary work has been completed.

The remaining balance is due on completion of the project, before final delivery, handover, or publishing of the work, unless otherwise agreed in writing.

By signing below, the Client confirms that they have read, understood, and agree to these terms and conditions in full.$$,
  50
where not exists (select 1 from contract_templates);

-- ---------- 4. CONTRACTS ----------
create table if not exists contracts (
  id uuid primary key default gen_random_uuid(),
  token text unique not null default encode(gen_random_bytes(24), 'hex'),
  template_id uuid references contract_templates(id),
  client_name text not null,
  client_email text,
  client_phone text,
  service_description text,
  total_amount numeric(12,2),
  deposit_amount numeric(12,2),
  deposit_percent numeric(5,2),
  contract_body text not null,
  status text not null default 'draft' check (status in ('draft','sent','viewed','signed','cancelled')),
  signed_name text,
  signed_phone text,
  signed_signature_data text,
  signed_at timestamptz,
  agreed_to_terms boolean default false,
  viewed_at timestamptz,
  created_at timestamptz default now()
);

alter table contracts add column if not exists signed_phone text;

alter table contracts enable row level security;
drop policy if exists "Authenticated full access to contracts" on contracts;
create policy "Authenticated full access to contracts" on contracts
  for all to authenticated using (true) with check (true);

-- ---------- 5. PUBLIC RPC FUNCTIONS (login-free signing) ----------
drop function if exists get_contract_by_token(text);
create function get_contract_by_token(p_token text)
returns table (
  client_name text, service_description text, total_amount numeric,
  deposit_amount numeric, deposit_percent numeric, contract_body text,
  contract_status text, signed_at timestamptz
)
language plpgsql security definer set search_path = public
as $$
begin
  update contracts
     set status = 'viewed', viewed_at = coalesce(viewed_at, now())
   where token = p_token and status = 'sent';
  return query
    select c.client_name, c.service_description, c.total_amount,
           c.deposit_amount, c.deposit_percent, c.contract_body,
           c.status, c.signed_at
      from contracts c
     where c.token = p_token and c.status in ('sent','viewed','signed');
end;
$$;
grant execute on function get_contract_by_token(text) to anon;

drop function if exists sign_contract(text, text, text, boolean);
drop function if exists sign_contract(text, text, text, boolean, text);
create function sign_contract(
  p_token text,
  p_name text,
  p_signature text,
  p_agree boolean,
  p_phone text default null
)
returns boolean
language plpgsql security definer set search_path = public
as $$
declare v_status text;
begin
  select status into v_status from contracts where token = p_token;
  if v_status is null or v_status not in ('sent','viewed') or p_agree is not true then
    return false;
  end if;
  update contracts
     set status = 'signed',
         signed_name = p_name,
         signed_phone = p_phone,
         signed_signature_data = p_signature,
         agreed_to_terms = true,
         signed_at = now()
   where token = p_token;
  return true;
end;
$$;
grant execute on function sign_contract(text, text, text, boolean, text) to anon;

-- ---------- 6. SEED REAL BUSINESS + BANKING DETAILS ----------
insert into business_settings (
  id, company_name, registration_no, tax_no,
  company_address, company_address2, company_phone, company_email, website,
  vat_number, bank_name, bank_account_holder, bank_account_number,
  bank_branch_code, bank_branch_name, bank_account_type, bank_swift_code,
  logo_url, invoice_prefix, invoice_footer_note
) values (
  1,
  'LC GLOBAL HOLDINGS (PTY) LTD',
  '2026/418287/07',
  '9908446199',
  '35 Ormonde Street, Lukasrand, Pretoria, 0700',
  '18 Thyme Street x17, Ivypark, Polokwane, 0699',
  '0760950954 / 0687289637',
  'chitsurosnet@outlook.com',
  'www.lcdigitalsolution.co.za',
  '',
  'First National Bank (FNB)',
  'LC GLOBAL HOLDINGS (PTY) LTD',
  '63219779353',
  '251345',
  'Brooklyn',
  'Gold Business Account',
  'FIRNZAJJ',
  'assets/lc-global-holdings-logo.jpg',
  'INV',
  'Thank you for your business.'
)
on conflict (id) do update set
  company_name       = excluded.company_name,
  registration_no    = excluded.registration_no,
  tax_no             = excluded.tax_no,
  company_address    = excluded.company_address,
  company_address2   = excluded.company_address2,
  company_phone      = excluded.company_phone,
  company_email      = excluded.company_email,
  website            = excluded.website,
  vat_number         = excluded.vat_number,
  bank_name          = excluded.bank_name,
  bank_account_holder = excluded.bank_account_holder,
  bank_account_number = excluded.bank_account_number,
  bank_branch_code    = excluded.bank_branch_code,
  bank_branch_name    = excluded.bank_branch_name,
  bank_account_type   = excluded.bank_account_type,
  bank_swift_code     = excluded.bank_swift_code,
  logo_url            = excluded.logo_url,
  invoice_prefix      = excluded.invoice_prefix,
  invoice_footer_note = excluded.invoice_footer_note,
  updated_at          = now();
