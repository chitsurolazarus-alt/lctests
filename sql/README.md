# Database setup — run these in order

Copy each file's contents into the **Supabase SQL Editor**
(Project → SQL Editor → New Query → Run) and run them **one at a time**, in this order:

1. `01_business_settings.sql`  — single-row company/banking settings table + RLS
2. `02_invoices.sql`           — invoices table + RLS
3. `03_contract_templates.sql` — reusable contract wording + 1 seed template
4. `04_contracts_and_functions.sql` — contracts table (incl. `signed_phone`) + the two
   public, login-free RPC functions `get_contract_by_token` and `sign_contract`
   (now with a `p_phone` parameter)
5. `05_seed_business_info.sql` — pre-fills the real LC GLOBAL HOLDINGS details +
   FNB banking info + letterhead logo into `business_settings` (id = 1)

All five are idempotent (`create table if not exists`, `add column if not exists`,
`drop policy … create policy`, `drop function … create function`), so re-running them
is safe.

> After running `04`, if the dashboard still reports a "function does not exist" error
> when signing, click **Database → Functions** (or **Settings → API**) and hit
> **Reload schema cache** once — Supabase sometimes caches the old function signature.

These numbered files replace the older `migration-invoicing-contracts.sql`. Use the
numbered files, not the old one.
