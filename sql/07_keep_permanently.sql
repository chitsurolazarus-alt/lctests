-- ============================================================
-- 07_keep_permanently.sql
-- Adds a retention flag so an admin can explicitly mark a contract
-- to be kept permanently (vs. deleting it). Run in the Supabase
-- SQL editor. Idempotent: safe to re-run.
-- ============================================================

alter table contracts add column if not exists kept_permanently boolean not null default false;

-- Helpful for filtering "kept" contracts quickly in future clean-up jobs.
create index if not exists contracts_kept_permanently_idx
  on contracts (kept_permanently) where kept_permanently is true;
