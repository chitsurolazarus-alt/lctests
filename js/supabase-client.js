/* Supabase client — shared across every page */
const SUPABASE_URL = "https://oovmxkjhvufiehgrkmrv.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9vdm14a2podnVmaWVoZ3JrbXJ2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODU4MjM4MTgsImV4cCI6MjEwMTM5OTgxOH0.zn-dYrMIN5VyYlTRq0hf3icgfo3WAy0lJ9sIhDQiLXo";

// Create Supabase client.
// IMPORTANT: window.supabase currently holds the *library* (set by the CDN
// script). We create the client from it, then overwrite window.supabase with
// the client itself. auth.js reads window.supabase, so it must end up being
// the client, not the library — a plain top-level `const supabase = ...`
// alone would NOT update window.supabase (it only shadows the name locally),
// which caused "Cannot read properties of undefined (reading 'getSession')".
//
// GUARD: if the CDN <script> tag above failed to load (network hiccup, ad
// blocker, wrong path, CDN outage) or served an unexpected build,
// window.supabase won't have a .createClient function. Calling it blindly in
// that case throws here, which aborts this file silently — every later page
// (or the login form's signInWithPassword call) would then see window.supabase
// still pointing at the un-built library object and fail with a confusing
// "Cannot read properties of undefined (reading 'signInWithPassword')" deep
// inside the click handler instead of a clear message where the problem
// actually is. Check first and fail loudly, right here, instead.
if (!window.supabase || typeof window.supabase.createClient !== "function") {
  console.error(
    "Supabase library failed to load — check that the <script> tag for " +
    "@supabase/supabase-js loaded successfully (network tab / ad blockers) " +
    "before js/supabase-client.js runs."
  );
} else {
  window.supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
}
const supabase = window.supabase;

console.log("Supabase client initialized:", supabase);
