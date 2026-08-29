# L.C Digital Solution WebCraft Studios — Site Redesign

## What's inside
- `index.html`, `services.html`, `portfolio.html`, `about.html`, `packages.html`, `hosting.html`, `contact.html`, `terms.html` — public site
- `login.html` — admin sign in / sign up
- `dashboard.html` — admin panel (portfolio, reviews, messages)
- `css/style.css` — full design system (dark/light theme)
- `js/supabase-client.js`, `js/main.js`, `js/auth.js`, `js/dashboard.js`
- `sql/schema.sql` — database tables, Row Level Security policies, storage buckets
- `assets/logo.png` — your logo

## 1. Set up Supabase (5 minutes)
1. Log in to your Supabase project (the one already connected: `oovmxkjhvufiehgrkmrv`).
2. Go to **SQL Editor → New query**, paste the entire contents of `sql/schema.sql`, and run it.
   This creates the `portfolios`, `reviews` and `messages` tables, locks them down with Row Level
   Security (public can read published content only; only logged-in admins can write), and creates
   the `portfolio-logos` and `review-photos` storage buckets.
3. Go to **Authentication → Users → Add user** and create your admin login (your email + a password).
   This is the account you'll use to log in at `login.html`.
4. Recommended: go to **Authentication → Settings** and turn **off** "Allow new users to sign up",
   since this is a single-admin site and the public Sign Up page isn't needed once your account exists.

## 2. Upload the files
Upload every file, keeping the folder structure exactly as-is (`css/`, `js/`, `sql/`, `assets/` stay
as folders) to your host (e.g. your `public_html` or hosting file manager). `sql/schema.sql` is
reference-only — it doesn't need to be uploaded, it just needs to have been run in Supabase once.

## 3. Log in to the dashboard
Visit `yourdomain.co.za/login.html`, sign in with the admin account you created in Supabase, and
you'll land on `dashboard.html`. From there you can add/edit/delete/reorder portfolio projects,
add/edit/approve/delete reviews, and view contact form enquiries.

## Notes
- The Supabase anon key in `js/supabase-client.js` is meant to be public (that's how Supabase
  works) — it's the SQL schema's Row Level Security policies that actually protect your data.
  Only logged-in admins can write; the public can only read approved/published content.
- Reviews are hidden from the public site until you tick "Publish immediately" or hit the approve
  button in the dashboard — so you can vet them first.
- The contact form saves messages straight into Supabase (visible under the Messages tab in the
  dashboard); it doesn't currently send you an email notification. If you want an email alert on
  every new enquiry, that needs a Supabase Edge Function — happy to add that as a next step.
- Deferred, as in the current site: blog, PDF brochure, payment gateway, CAPTCHA on the contact
  form.
- WhatsApp number and email are wired throughout: 27760950954 / chitsurosnet@outlook.com.

## Still to do before going live
- Swap the placeholder team initials on `about.html` for real names/photos if you want them shown.
- Add real portfolio projects and reviews through the dashboard (none are pre-loaded, as requested).
- Double check pricing on `packages.html` and `hosting.html` — I set reasonable placeholder amounts;
  update them to match your actual rates.
- Point your domain / update DNS once uploaded.
