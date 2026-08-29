-- ============================================================
-- 06_reviews.sql
-- Run AFTER sql/schema.sql (which creates the `reviews` table and the
-- base RLS policies). This file opens the table to PUBLIC submissions:
-- anyone (anon) may INSERT a review, but it lands as approved = false
-- (pending moderation) and is only shown on the site once an admin
-- approves it in the dashboard. Anon can never set approved = true,
-- push the rating outside 1..5, or update/delete any row.
--
-- Safe to re-run: every statement is "drop … create".
-- ============================================================

alter table reviews enable row level security;

-- Public can submit a review (pending moderation).
drop policy if exists "Public can submit a review" on reviews;
create policy "Public can submit a review" on reviews
  for insert to anon
  with check (approved = false and rating between 1 and 5);

-- Public can read approved reviews (mirrors schema.sql; repeated so this file
-- is self-contained and re-runnable).
drop policy if exists "Public can view approved reviews" on reviews;
create policy "Public can view approved reviews" on reviews
  for select to anon using (approved = true);
