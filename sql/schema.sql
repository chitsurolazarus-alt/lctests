-- ============================================================
-- L.C Digital Solution WebCraft Studios — Supabase Schema
-- Run this once in Supabase SQL Editor (Project > SQL Editor > New Query)
-- ============================================================

-- 1. PORTFOLIOS TABLE
create table if not exists portfolios (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  description text not null,
  client text,
  category text not null check (category in ('web-development','software-development','hosting','graphic-design','seo-marketing','ai-automation')),
  logo_url text,
  project_url text,
  completion_date date,
  technologies text[] default '{}',
  featured boolean default false,
  sort_order integer default 0,
  created_at timestamptz default now()
);

-- 2. REVIEWS TABLE
create table if not exists reviews (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  company text,
  review_text text not null,
  rating integer not null check (rating between 1 and 5),
  photo_url text,
  approved boolean default false,
  created_at timestamptz default now()
);

-- 3. CONTACT MESSAGES TABLE (stores contact form submissions)
create table if not exists messages (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  email text not null,
  phone text,
  service text,
  message text not null,
  read boolean default false,
  created_at timestamptz default now()
);

-- ============================================================
-- ROW LEVEL SECURITY
-- Public can READ approved/published content only.
-- Only authenticated (admin) users can WRITE.
-- ============================================================

alter table portfolios enable row level security;
alter table reviews enable row level security;
alter table messages enable row level security;

-- Portfolios: anyone can view, only logged-in users can manage
create policy "Public can view portfolios" on portfolios
  for select using (true);
create policy "Authenticated users can insert portfolios" on portfolios
  for insert to authenticated with check (true);
create policy "Authenticated users can update portfolios" on portfolios
  for update to authenticated using (true);
create policy "Authenticated users can delete portfolios" on portfolios
  for delete to authenticated using (true);

-- Reviews: public can only see approved ones, admin sees/manages all
create policy "Public can view approved reviews" on reviews
  for select using (approved = true);
create policy "Authenticated users can view all reviews" on reviews
  for select to authenticated using (true);
create policy "Authenticated users can insert reviews" on reviews
  for insert to authenticated with check (true);
create policy "Authenticated users can update reviews" on reviews
  for update to authenticated using (true);
create policy "Authenticated users can delete reviews" on reviews
  for delete to authenticated using (true);

-- Messages: anyone can submit, only admin can read/manage
create policy "Anyone can submit a message" on messages
  for insert with check (true);
create policy "Authenticated users can view messages" on messages
  for select to authenticated using (true);
create policy "Authenticated users can update messages" on messages
  for update to authenticated using (true);
create policy "Authenticated users can delete messages" on messages
  for delete to authenticated using (true);

-- ============================================================
-- STORAGE BUCKETS
-- Run these, or create the buckets manually in Storage > New bucket
-- (name: portfolio-logos, public; name: review-photos, public)
-- ============================================================
insert into storage.buckets (id, name, public)
values ('portfolio-logos', 'portfolio-logos', true)
on conflict (id) do nothing;

insert into storage.buckets (id, name, public)
values ('review-photos', 'review-photos', true)
on conflict (id) do nothing;

-- Storage policies: public read, authenticated write
create policy "Public read portfolio-logos" on storage.objects
  for select using (bucket_id = 'portfolio-logos');
create policy "Authenticated upload portfolio-logos" on storage.objects
  for insert to authenticated with check (bucket_id = 'portfolio-logos');
create policy "Authenticated delete portfolio-logos" on storage.objects
  for delete to authenticated using (bucket_id = 'portfolio-logos');

create policy "Public read review-photos" on storage.objects
  for select using (bucket_id = 'review-photos');
create policy "Authenticated upload review-photos" on storage.objects
  for insert to authenticated with check (bucket_id = 'review-photos');
create policy "Authenticated delete review-photos" on storage.objects
  for delete to authenticated using (bucket_id = 'review-photos');

-- ============================================================
-- ADMIN USER
-- Create your admin login in Supabase Dashboard:
-- Authentication > Users > Add User (email + password)
-- Do NOT use the public Sign Up page for this — that page is
-- disabled by default; admins are created manually for security.
-- ============================================================
