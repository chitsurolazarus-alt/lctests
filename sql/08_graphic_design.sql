-- ============================================================
-- 08 — Graphic Design: services catalogue + quote requests
-- Run in Supabase SQL Editor. Idempotent — safe to re-run.
-- Admin = any `authenticated` user (same rule as every other table here).
-- ============================================================

-- ---------- 1. TABLES ----------
create table if not exists graphic_design_services (
  id             uuid primary key default gen_random_uuid(),
  category       text not null,
  title          text not null,
  description    text,
  starting_price numeric,
  price_note     text,                 -- e.g. 'from', 'per page'
  icon           text,                 -- Font Awesome name without prefix, e.g. 'pen-nib'
  image_url      text,
  sort_order     integer default 0,
  is_visible     boolean default true,
  created_at     timestamptz default now(),
  updated_at     timestamptz default now()
);

create table if not exists design_quote_requests (
  id             uuid primary key default gen_random_uuid(),
  name           text not null,
  email          text not null,
  phone          text,
  company        text,
  services       text[] not null,
  budget         text,
  deadline       date,
  details        text,
  attachment_url text,                 -- storage PATH inside bucket 'design-briefs' (admin opens via signed URL)
  status         text default 'new' check (status in ('new','contacted','quoted','won','lost')),
  created_at     timestamptz default now()
);

create index if not exists gd_services_order_idx on graphic_design_services (sort_order);
create index if not exists design_quotes_created_idx on design_quote_requests (created_at desc);

-- keep updated_at fresh
create or replace function set_updated_at() returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists gd_services_updated_at on graphic_design_services;
create trigger gd_services_updated_at before update on graphic_design_services
  for each row execute function set_updated_at();

-- ---------- 2. ROW LEVEL SECURITY ----------
alter table graphic_design_services enable row level security;
alter table design_quote_requests  enable row level security;

-- Services: public sees visible rows only; admin manages everything.
drop policy if exists "Public can view visible design services" on graphic_design_services;
create policy "Public can view visible design services" on graphic_design_services
  for select to anon, authenticated using (is_visible = true);

drop policy if exists "Admin can view all design services" on graphic_design_services;
create policy "Admin can view all design services" on graphic_design_services
  for select to authenticated using (true);

drop policy if exists "Admin can insert design services" on graphic_design_services;
create policy "Admin can insert design services" on graphic_design_services
  for insert to authenticated with check (true);

drop policy if exists "Admin can update design services" on graphic_design_services;
create policy "Admin can update design services" on graphic_design_services
  for update to authenticated using (true) with check (true);

drop policy if exists "Admin can delete design services" on graphic_design_services;
create policy "Admin can delete design services" on graphic_design_services
  for delete to authenticated using (true);

-- Quote requests: public may INSERT only (with sane limits); admin reads/updates/deletes.
drop policy if exists "Anyone can request a design quote" on design_quote_requests;
create policy "Anyone can request a design quote" on design_quote_requests
  for insert to anon, authenticated
  with check (
    status = 'new'
    and char_length(name) between 1 and 120
    and char_length(email) between 3 and 200
    and array_length(services, 1) between 1 and 40
    and (details is null or char_length(details) <= 3000)
  );

drop policy if exists "Admin can view design quotes" on design_quote_requests;
create policy "Admin can view design quotes" on design_quote_requests
  for select to authenticated using (true);

drop policy if exists "Admin can update design quotes" on design_quote_requests;
create policy "Admin can update design quotes" on design_quote_requests
  for update to authenticated using (true) with check (true);

drop policy if exists "Admin can delete design quotes" on design_quote_requests;
create policy "Admin can delete design quotes" on design_quote_requests
  for delete to authenticated using (true);

-- ---------- 3. STORAGE: design-briefs (private; public upload, admin read) ----------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'design-briefs', 'design-briefs', false, 10485760,
  array[
    'image/jpeg','image/png','image/webp','image/gif',
    'application/pdf',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
  ]
)
on conflict (id) do update
  set public = false,
      file_size_limit = 10485760,
      allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "Anyone can upload design briefs" on storage.objects;
create policy "Anyone can upload design briefs" on storage.objects
  for insert to anon, authenticated with check (bucket_id = 'design-briefs');

drop policy if exists "Admin can read design briefs" on storage.objects;
create policy "Admin can read design briefs" on storage.objects
  for select to authenticated using (bucket_id = 'design-briefs');

drop policy if exists "Admin can delete design briefs" on storage.objects;
create policy "Admin can delete design briefs" on storage.objects
  for delete to authenticated using (bucket_id = 'design-briefs');

-- ---------- 4. SEED (only when the table is empty; prices left NULL) ----------
insert into graphic_design_services (category, title, description, icon, sort_order)
select v.category, v.title, v.description, v.icon, v.sort_order
from (values
  ('Branding & Identity','Logo Design','A distinctive, versatile logo delivered in every file format you will ever need.','pen-nib',10),
  ('Branding & Identity','Business Cards','Sharp, print-ready business cards that make a memorable first impression.','id-card',20),
  ('Branding & Identity','Letterheads & Stationery','Matching letterheads, envelopes and stationery that keep your brand consistent.','envelope-open-text',30),

  ('Business Documents','CV / Resume Design','Clean, modern CVs that help you stand out to recruiters and employers.','file-lines',40),
  ('Business Documents','Business Plans','Professionally laid-out business plans ready for investors, banks and funders.','briefcase',50),
  ('Business Documents','Company Profiles','Polished company profiles that present your business as established and credible.','building',60),
  ('Business Documents','Tender Documents','Neatly formatted, compliant tender submissions that make evaluators'' lives easier.','file-contract',70),
  ('Business Documents','Document Conversion','Scanned PDFs converted into fully editable Word documents with formatting intact.','file-word',80),

  ('Presentations & Video','Presentation Slide Decks','Persuasive, on-brand slide decks for pitches, reports and training.','display',90),
  ('Presentations & Video','Promo & Explainer Videos','Short promo and explainer videos that tell your story in under a minute.','video',100),

  ('Marketing & Print','Flyers & Posters','Eye-catching flyers and posters designed to get noticed and get responses.','bullhorn',110),
  ('Marketing & Print','Brochures & Pamphlets','Folded brochures and pamphlets that explain your offering at a glance.','book-open',120),
  ('Marketing & Print','Banners & Signage','Large-format banners and signage artwork prepared to print at any size.','flag',130),
  ('Marketing & Print','Menus & Price Lists','Easy-to-read menus and price lists that make ordering effortless.','utensils',140),

  ('Digital & Social','Social Media Posts','Scroll-stopping posts sized and styled for every platform.','hashtag',150),
  ('Digital & Social','Social Media Kits','Complete profile, cover and template kits for a consistent social presence.','share-nodes',160),
  ('Digital & Social','Email & Web Banners','Banners and headers for newsletters, websites and ad campaigns.','rectangle-ad',170),
  ('Digital & Social','Infographics','Turn complex information into clear, shareable visuals.','chart-pie',180),

  ('Specialty','Packaging & Labels','Product packaging and labels that look great on the shelf.','box-open',190),
  ('Specialty','Vehicle Branding','Eye-catching vehicle wraps and decals that turn your fleet into advertising.','truck',200),
  ('Specialty','Event Invites & Certificates','Elegant invitations and certificates for events, awards and ceremonies.','award',210)
) as v(category, title, description, icon, sort_order)
where not exists (select 1 from graphic_design_services);
