-- ============================================================
-- 04_contracts_and_functions.sql
-- Run FOURTH. Creates the contracts table (incl. signed_phone) + RLS,
-- and the two public-safe RPC functions used by the no-login signing
-- page. Idempotent: safe to re-run.
-- ============================================================

-- Ensure gen_random_bytes (used by the contracts token default) is available.
create extension if not exists pgcrypto;

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
  signed_phone text,          -- phone the client types when signing (Task 3)
  signed_signature_data text, -- base64 PNG from signature pad
  signed_at timestamptz,
  agreed_to_terms boolean default false,
  viewed_at timestamptz,
  created_at timestamptz default now()
);

-- Upgrade an existing contracts table if it was created by an earlier migration.
alter table contracts add column if not exists signed_phone text;

alter table contracts enable row level security;

drop policy if exists "Authenticated full access to contracts" on contracts;
create policy "Authenticated full access to contracts" on contracts
  for all to authenticated using (true) with check (true);
-- Deliberately NO anon policy on the table itself. Public access goes only
-- through the two functions below, so the anon key can never list or dump
-- every contract in the table.

-- 5a. Public read of a single contract by token (no auth).
-- NOTE: returned column is named "contract_status" (NOT "status") so it cannot
-- collide with contracts.status inside the function body.
drop function if exists get_contract_by_token(text);
create function get_contract_by_token(p_token text)
returns table (
  client_name text, service_description text, total_amount numeric,
  deposit_amount numeric, deposit_percent numeric, contract_body text,
  contract_status text, signed_at timestamptz
)
language plpgsql security definer
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

-- 5b. Public sign — now also stores the client's phone number (p_phone).
-- Drop the OLD 4-arg signature, then create the new 5-arg one so the
-- contract-sign page's rpc(...) call matches exactly.
drop function if exists sign_contract(text, text, text, boolean);
create function sign_contract(
  p_token text,
  p_name text,
  p_signature text,
  p_agree boolean,
  p_phone text default null
)
returns boolean
language plpgsql security definer
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
