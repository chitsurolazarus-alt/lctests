/* ==========================================================
   Auth — login / session guard / logout (FIXED)
   ========================================================== */

// 1. Use the globally defined supabase variable directly.
// Only return it if it's an actual client (has .auth) — if supabase-client.js
// failed to build the client (see the guard there), window.supabase is still
// the bare library object, which has no .auth and would otherwise blow up
// deep inside a click handler with a confusing error.
function getSupabase() {
  const sb = window.supabase;
  if (!sb || !sb.auth) return null;
  return sb;
}

// 2. Ensure the script runs after DOM is ready
document.addEventListener("DOMContentLoaded", async function() {
  console.log("Auth.js loaded");
  
  const loginForm = document.getElementById("loginForm");
  // FIX: Match the exact IDs in your HTML ('message' and 'debug')
  const msgEl = document.getElementById("message"); 
  const debugEl = document.getElementById("debug");
  
  // If not on the login page, check for auth on dashboard
  if (!loginForm) {
    if (document.getElementById("dashboardContent") || window.location.pathname.includes('dashboard.html')) {
      await requireAuth();
    }
    return;
  }

  const supabase = getSupabase();
  if (!supabase) {
    console.error("Supabase client not available");
    if(debugEl) debugEl.innerHTML = '<div style="color:red">❌ Supabase client failed to initialize.</div>';
    return;
  }
  if (debugEl) debugEl.innerHTML = '<div style="color:#4ade80">✅ Supabase initialized successfully.</div>';

  // 3. Check if already logged in
  try {
    const { data: { session }, error } = await supabase.auth.getSession();
    console.log("Current session:", session);
    
    if (session) {
      console.log("Already logged in, redirecting to dashboard...");
      // FIX: Use absolute path for GitHub Pages reliability
      window.location.href = "dashboard.html"; 
      return;
    }
    if (error) {
      console.error("Session check error:", error);
    }
  } catch (err) {
    console.error("Session check failed:", err);
  }

  // 4. Login form submission
  loginForm.addEventListener("submit", async function(e) {
    e.preventDefault();
    console.log("Login form submitted");
    
    // FIX: Use the correct HTML IDs ('email' and 'password')
    const email = document.getElementById("email").value.trim();
    const password = document.getElementById("password").value;
    const btn = loginForm.querySelector('button[type="submit"]');
    
    // Clear previous UI states
    if (msgEl) {
        msgEl.style.display = "block";
        msgEl.innerText = "⏳ Logging in...";
        msgEl.style.color = "#fbbf24";
    }
    if (debugEl) debugEl.innerHTML = '<div>🔑 Attempting login...</div>';
    
    btn.disabled = true;
    btn.innerHTML = 'Signing in...';

    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email: email,
        password: password
      });

      console.log("Login response:", { data, error });

      if (error) {
        console.error("Login error:", error.message);
        if (msgEl) {
            msgEl.innerText = "❌ Error: " + error.message;
            msgEl.style.color = "#f87171";
        }
        if (debugEl) debugEl.innerHTML = `<div style="color:red">⚠️ Login failed: ${error.message}</div>`;
        btn.disabled = false;
        btn.innerHTML = "Sign In";
        return;
      }

      if (data?.session) {
        console.log("Login successful!");
        if (msgEl) {
            msgEl.innerText = "✅ Login successful! Redirecting...";
            msgEl.style.color = "#4ade80";
        }
        if (debugEl) debugEl.innerHTML = `<div style="color:green">✅ Logged in as: ${data.user.email}</div>`;
        
        // 5. Redirect to the dashboard
        setTimeout(() => {
          window.location.href = "dashboard.html";
        }, 1000);
      } else {
        if (msgEl) {
            msgEl.innerText = "No session created. Please try again.";
            msgEl.style.color = "#f87171";
        }
        btn.disabled = false;
        btn.innerHTML = "Sign In";
      }
    } catch (err) {
      console.error("Unexpected error:", err);
      if (msgEl) {
        msgEl.innerText = "An unexpected error occurred: " + err.message;
        msgEl.style.color = "#f87171";
      }
      btn.disabled = false;
      btn.innerHTML = "Sign In";
    }
  });
});

/* ---------- SESSION GUARD for dashboard ---------- */
// De-dupe: auth.js's own DOMContentLoaded handler AND dashboard.js both call
// requireAuth() on dashboard.html at the same time. Two concurrent
// getSession() calls can race (one resolves before the session is fully
// hydrated from storage) and disagree with each other — one redirects to
// login.html while the other thinks you're authenticated, then login.html's
// own check sends you straight back, and so on forever. Caching the in-flight
// promise means every caller shares the exact same result instead of racing.
let _requireAuthPromise = null;
function requireAuth() {
  if (_requireAuthPromise) return _requireAuthPromise;
  _requireAuthPromise = (async () => {
    console.log("Checking authentication...");
    const supabase = getSupabase();
    if (!supabase) {
      console.error("Supabase client not available");
      window.location.href = "login.html";
      return null;
    }

    try {
      const { data: { session }, error } = await supabase.auth.getSession();

      if (error) {
        console.error("Session error:", error);
        window.location.href = "login.html";
        return null;
      }

      if (!session) {
        console.log("No session found, redirecting to login...");
        window.location.href = "login.html";
        return null;
      }

      console.log("Authenticated as:", session.user.email);
      // If you have a dashboard element to show email:
      const emailEl = document.getElementById("adminEmail");
      if (emailEl) emailEl.textContent = session.user.email;

      return session;
    } catch (err) {
      console.error("Auth check failed:", err);
      window.location.href = "login.html";
      return null;
    } finally {
      // Clear the cache once settled so a later, genuinely new check
      // (e.g. after logging out and back in) isn't stuck on a stale result.
      _requireAuthPromise = null;
    }
  })();
  return _requireAuthPromise;
}

// Logout
document.addEventListener("DOMContentLoaded", function() {
  const logoutBtn = document.getElementById("logoutBtn");
  if (logoutBtn) {
    logoutBtn.addEventListener("click", async function() {
      console.log("Logging out...");
      const supabase = getSupabase();
      if (supabase) {
        await supabase.auth.signOut();
      }
      window.location.href = "login.html";
    });
  }
});
