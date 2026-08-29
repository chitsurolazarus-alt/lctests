-- ============================================================
-- 03_contract_templates.sql
-- Run THIRD. Creates the reusable contract_templates table and seeds
-- one starter template. Idempotent: safe to re-run.
-- ============================================================

create table if not exists contract_templates (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  body text not null, -- supports {{client_name}}, {{service_description}}, {{total_amount}}, {{deposit_amount}}, {{deposit_percent}}
  default_deposit_percent numeric(5,2) default 50,
  created_at timestamptz default now()
);

alter table contract_templates enable row level security;

drop policy if exists "Authenticated full access to templates" on contract_templates;
create policy "Authenticated full access to templates" on contract_templates
  for all to authenticated using (true) with check (true);

-- Seed one starter template (only if none exists yet).
-- The body uses dollar-quoting ($$...$$) so the apostrophes and line breaks
-- in the contract text can NEVER be mis-parsed as SQL when pasted into the
-- SQL Editor (a plain E'...' literal with '' escapes is fragile to copy/paste).
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
