-- ============================================================
-- 05_seed_business_info.sql
-- Run LAST. Pre-fills the single business_settings row (id = 1) with
-- the REAL company + banking details so they appear on every invoice
-- and contract the first time you open the dashboard. You should never
-- have to type these in. Copy the exact values below — do not reformat.
-- ============================================================

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
  '',                                 -- VAT number (none supplied; Income Tax No is above)
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
