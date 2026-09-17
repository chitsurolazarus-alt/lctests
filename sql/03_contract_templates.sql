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
   50),
  ('Website Hosting & Monitoring Agreement (Monthly Subscription)',
   $$This agreement is entered into between L.C Digital Solution WebCraft Studios ("the Service Provider") and {{client_name}} ("the Client") for the following ongoing website hosting and monitoring subscription:

{{service_description}}

The Client's website is hosted under the Service Provider's own hosting infrastructure and account. The Service Provider retains direct, exclusive access to the hosting account, server, hosting panel, and DNS records for the duration of this agreement. The Client is not given direct access to any of these, and all hosting-related administration is carried out solely by the Service Provider.

MONTHLY SUBSCRIPTION FEE: R{{total_amount}}, payable in full each month, in advance. There is no deposit and no partial payment on this subscription; the full monthly fee is due upfront for each month of service.

WHAT THE MONTHLY FEE COVERS:
The monthly subscription fee keeps the Client's website online and covers ongoing uptime and performance monitoring by the Service Provider. It also includes any reasonable changes, fixes, updates, or support requests the Client needs during that month, at no extra call-out charge for standard work.

PAYMENT & ARREARS:
The monthly subscription fee is payable in advance, before the start of each month, for as long as the Client wishes to remain hosted with the Service Provider. Payment is due via EFT to the Service Provider's bank account, as set out in the banking details section of this agreement. If payment lapses or falls into arrears, the Service Provider may suspend or take the website offline until payment is received in full, and no support or update work will be carried out while the account remains in arrears.

RENEWAL:
This agreement runs on a 12-month cycle. At the end of every 12-month period, the agreement is renewable, and a renewal fee applies to continue the service into the next 12-month term, in addition to the standard monthly subscription fee. The Service Provider will notify the Client ahead of each renewal date.

CANCELLATION:
Either party may cancel this agreement by giving the other reasonable written notice (at least 30 days). On cancellation, the Client may request a handover or export of their website files, which will be provided subject to all outstanding fees being settled in full.

By signing below, the Client confirms that they have read, understood, and agree to this monthly subscription, including the full-payment terms and the 12-month renewal fee described above, in full.$$,
   0),
  ('Database Hosting & Monitoring Agreement (Monthly Subscription)',
   $$This agreement is entered into between L.C Digital Solution WebCraft Studios ("the Service Provider") and {{client_name}} ("the Client") for the following ongoing database hosting and monitoring subscription:

{{service_description}}

The Client's database is hosted, backed up, and monitored under the Service Provider's own infrastructure and account. The Service Provider retains direct, exclusive access to the database and its credentials for the duration of this agreement. The Client is not given direct access to the database, and all database administration is carried out solely by the Service Provider.

MONTHLY SUBSCRIPTION FEE: R{{total_amount}}, payable in full each month, in advance. There is no deposit and no partial payment on this subscription; the full monthly fee is due upfront for each month of service.

WHAT THE MONTHLY FEE COVERS:
The monthly subscription fee keeps the Client's database online and backed up, and covers ongoing monitoring of its performance and integrity by the Service Provider. It also includes any reasonable changes, fixes, updates, or support requests the Client needs during that month, at no extra call-out charge for standard work.

PAYMENT & ARREARS:
The monthly subscription fee is payable in advance, before the start of each month, for as long as the Client wishes the Service Provider to continue hosting the database. Payment is due via EFT to the Service Provider's bank account, as set out in the banking details section of this agreement. If payment lapses or falls into arrears, the Service Provider may suspend access to or take the database offline until payment is received in full, and no support or monitoring work will be carried out while the account remains in arrears.

RENEWAL:
This agreement runs on a 12-month cycle. At the end of every 12-month period, the agreement is renewable, and a renewal fee applies to continue the service into the next 12-month term, in addition to the standard monthly subscription fee. The Service Provider will notify the Client ahead of each renewal date.

CANCELLATION:
Either party may cancel this agreement by giving the other reasonable written notice (at least 30 days). On cancellation, the Client may request a handover or export of their database, which will be provided subject to all outstanding fees being settled in full.

By signing below, the Client confirms that they have read, understood, and agree to this monthly subscription, including the full-payment terms and the 12-month renewal fee described above, in full.$$,
   0),
  ('Database & Domain Hosting Agreement (Monthly Subscription)',
   $$This agreement is entered into between L.C Digital Solution WebCraft Studios ("the Service Provider") and {{client_name}} ("the Client") for the following ongoing database and domain hosting subscription:

{{service_description}}

The Client's database is hosted, backed up, and monitored under the Service Provider's own infrastructure and account, and the Client's domain is managed and renewed by the Service Provider, all under the Service Provider's exclusive access and control. The Service Provider retains direct, exclusive access to the database, its credentials, and the domain registration account for the duration of this agreement. The Client is not given direct access to any of these.

MONTHLY SUBSCRIPTION FEE: R{{total_amount}}, payable in full each month, in advance. There is no deposit and no partial payment on this subscription; the full monthly fee is due upfront for each month of service.

WHAT THE MONTHLY FEE COVERS:
The monthly subscription fee keeps the Client's database online and backed up, covers ongoing monitoring of its performance and integrity, and includes management and timely renewal of the Client's domain by the Service Provider so that it does not lapse or expire. Domain renewal is handled by the Service Provider as part of this subscription, not the Client's own responsibility, unlike the Service Provider's one-off hosting arrangement. The monthly fee also includes any reasonable changes, fixes, updates, or support requests the Client needs during that month, at no extra call-out charge for standard work.

PAYMENT & ARREARS:
The monthly subscription fee is payable in advance, before the start of each month, for as long as the Client wishes the Service Provider to continue managing the database and domain. Payment is due via EFT to the Service Provider's bank account, as set out in the banking details section of this agreement. If payment lapses or falls into arrears, the Service Provider may suspend access to the database or place the domain administration on hold until payment is received in full, and no support, monitoring, or renewal work will be carried out while the account remains in arrears.

RENEWAL:
This agreement runs on a 12-month cycle. At the end of every 12-month period, the agreement is renewable, and a renewal fee applies to continue the service into the next 12-month term, in addition to the standard monthly subscription fee. The Service Provider will notify the Client ahead of each renewal date.

CANCELLATION:
Either party may cancel this agreement by giving the other reasonable written notice (at least 30 days). On cancellation, the Client may request a handover or export of their database and domain management details, which will be provided subject to all outstanding fees being settled in full.

By signing below, the Client confirms that they have read, understood, and agree to this monthly subscription, including the full-payment terms and the 12-month renewal fee described above, in full.$$,
   0)
) as t(name, body, default_deposit_percent)
where not exists (select 1 from contract_templates c where c.name = t.name);
