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

-- Seed one starter template PER SERVICE we offer (dollar-quoted so
-- apostrophes/newlines can't break). Each row is inserted only if a
-- template with that name does not already exist, so re-running is safe.
insert into contract_templates (name, body, default_deposit_percent)
select * from (values
  ('Web Development Agreement',
   $$This agreement is entered into between L.C Digital Solution WebCraft Studios ("the Service Provider") and {{client_name}} ("the Client") for the following web development service:

{{service_description}}

TOTAL PROJECT VALUE: R{{total_amount}}
DEPOSIT REQUIRED: R{{deposit_amount}} ({{deposit_percent}}% of total value), payable before work commences.

DEPOSIT & REFUND TERMS:
The deposit secures the Client's place in the Service Provider's work schedule and covers initial setup, planning, and resource allocation. Once the deposit has been paid and work has commenced, the deposit becomes NON-REFUNDABLE, regardless of whether the Client later chooses to cancel, pause, or discontinue the project.

The remaining balance is due on completion of the website, before final delivery, handover, or publishing, unless otherwise agreed in writing.

By signing below, the Client confirms that they have read, understood, and agree to these terms and conditions in full.$$,
   50),
  ('Software Development Agreement',
   $$This agreement is entered into between L.C Digital Solution WebCraft Studios ("the Service Provider") and {{client_name}} ("the Client") for the following software development service:

{{service_description}}

TOTAL PROJECT VALUE: R{{total_amount}}
DEPOSIT REQUIRED: R{{deposit_amount}} ({{deposit_percent}}% of total value), payable before work commences.

DEPOSIT & REFUND TERMS:
The deposit secures the Client's place in the Service Provider's work schedule and covers initial setup, planning, and resource allocation. Once the deposit has been paid and work has commenced, the deposit becomes NON-REFUNDABLE, regardless of whether the Client later chooses to cancel, pause, or discontinue the project.

The remaining balance is due on completion of the application, before handover of the source code and final delivery, unless otherwise agreed in writing.

By signing below, the Client confirms that they have read, understood, and agree to these terms and conditions in full.$$,
   50),
  ('Hosting Service Agreement',
   $$This agreement is entered into between L.C Digital Solution WebCraft Studios ("the Service Provider") and {{client_name}} ("the Client") for the following hosting service:

{{service_description}}

HOSTING FEE: R{{total_amount}}
INITIAL PAYMENT REQUIRED: R{{deposit_amount}} ({{deposit_percent}}% of the fee), payable before activation.

TERMS:
Hosting is provided on a recurring basis. The initial payment secures the Client's slot and covers setup. Once the payment has been made and the service has been activated, the initial payment becomes NON-REFUNDABLE.

Renewal is the Client's responsibility: hosting and any domain must be renewed before expiry to avoid downtime, and a renewal fee applies at renewal time. The remaining balance (if any) is due before the service period begins, unless otherwise agreed in writing.

By signing below, the Client confirms that they have read, understood, and agree to these terms and conditions in full.$$,
   50),
  ('Graphic Design Agreement',
   $$This agreement is entered into between L.C Digital Solution WebCraft Studios ("the Service Provider") and {{client_name}} ("the Client") for the following graphic design service:

{{service_description}}

TOTAL PROJECT VALUE: R{{total_amount}}
DEPOSIT REQUIRED: R{{deposit_amount}} ({{deposit_percent}}% of total value), payable before work commences.

DEPOSIT & REFUND TERMS:
The deposit secures the Client's place in the Service Provider's work schedule and covers initial concept, planning, and resource allocation. Once the deposit has been paid and work has commenced, the deposit becomes NON-REFUNDABLE, regardless of whether the Client later chooses to cancel, pause, or discontinue the project.

The remaining balance is due on completion of the design, before final artwork and source files are delivered, unless otherwise agreed in writing.

By signing below, the Client confirms that they have read, understood, and agree to these terms and conditions in full.$$,
   50),
  ('SEO & Marketing Agreement',
   $$This agreement is entered into between L.C Digital Solution WebCraft Studios ("the Service Provider") and {{client_name}} ("the Client") for the following SEO and marketing service:

{{service_description}}

TOTAL PROJECT VALUE: R{{total_amount}}
DEPOSIT REQUIRED: R{{deposit_amount}} ({{deposit_percent}}% of total value), payable before work commences.

DEPOSIT & REFUND TERMS:
The deposit secures the Client's place in the Service Provider's work schedule and covers initial audit, planning, and resource allocation. Once the deposit has been paid and work has commenced, the deposit becomes NON-REFUNDABLE, regardless of whether the Client later chooses to cancel, pause, or discontinue the project.

The remaining balance is due on completion of the campaign setup, before launch and reporting are delivered, unless otherwise agreed in writing.

By signing below, the Client confirms that they have read, understood, and agree to these terms and conditions in full.$$,
   50),
  ('AI & Automation Agreement',
   $$This agreement is entered into between L.C Digital Solution WebCraft Studios ("the Service Provider") and {{client_name}} ("the Client") for the following AI and automation service:

{{service_description}}

TOTAL PROJECT VALUE: R{{total_amount}}
DEPOSIT REQUIRED: R{{deposit_amount}} ({{deposit_percent}}% of total value), payable before work commences.

DEPOSIT & REFUND TERMS:
The deposit secures the Client's place in the Service Provider's work schedule and covers initial analysis, planning, and resource allocation. Once the deposit has been paid and work has commenced, the deposit becomes NON-REFUNDABLE, regardless of whether the Client later chooses to cancel, pause, or discontinue the project.

The remaining balance is due on completion of the solution, before the automation is deployed and handed over, unless otherwise agreed in writing.

By signing below, the Client confirms that they have read, understood, and agree to these terms and conditions in full.$$,
   50)
) as t(name, body, default_deposit_percent)
where not exists (select 1 from contract_templates c where c.name = t.name);
