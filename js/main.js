/* ==========================================================
   L.C Digital Solution WebCraft Studios — main.js
   Theme, nav, reveal animations, counters, dynamic content,
   forms. Runs on every page (safe no-ops if elements absent).
   ========================================================== */

const WHATSAPP_NUMBER = "27760950954";
const CONTACT_EMAIL = "chitsurosnet@outlook.com";

/* ---------- THEME ---------- */
(function initTheme(){
  const saved = localStorage.getItem("lc-theme") || "dark";
  document.documentElement.setAttribute("data-theme", saved);
  document.addEventListener("DOMContentLoaded", () => {
    const btn = document.getElementById("themeToggleBtn");
    updateThemeIcon(saved);
    btn?.addEventListener("click", () => {
      const current = document.documentElement.getAttribute("data-theme");
      const next = current === "dark" ? "light" : "dark";
      document.documentElement.setAttribute("data-theme", next);
      localStorage.setItem("lc-theme", next);
      updateThemeIcon(next);
    });
  });
  function updateThemeIcon(theme){
    const btn = document.getElementById("themeToggleBtn");
    if (!btn) return;
    btn.innerHTML = theme === "dark" ? '<i class="fas fa-sun"></i>' : '<i class="fas fa-moon"></i>';
  }
})();

/* ---------- NAV: scroll state + mobile burger + active link ---------- */
document.addEventListener("DOMContentLoaded", () => {
  const nav = document.querySelector(".nav");
  window.addEventListener("scroll", () => {
    if (!nav) return;
    nav.classList.toggle("scrolled", window.scrollY > 20);
  });

  const burger = document.getElementById("navBurger");
  burger?.addEventListener("click", () => nav.classList.toggle("open"));
  // Close the mobile menu after tapping a link so the page is visible.
  nav?.querySelectorAll(".nav-links a").forEach(a =>
    a.addEventListener("click", () => nav.classList.remove("open"))
  );
  window.addEventListener("resize", () => {
    if (window.innerWidth > 920) nav?.classList.remove("open");
  });

  const path = location.pathname.split("/").pop() || "index.html";
  document.querySelectorAll(".nav-links a").forEach(a => {
    if (a.getAttribute("href") === path) a.classList.add("active");
  });

  // WhatsApp links
  document.querySelectorAll("[data-whatsapp]").forEach(el => {
    const msg = el.getAttribute("data-whatsapp") || "Hi! I'd like to know more about your services.";
    el.href = `https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(msg)}`;
  });
  document.querySelectorAll("[data-mail]").forEach(el => el.href = `mailto:${CONTACT_EMAIL}`);
});

/* ---------- SCROLL REVEAL ---------- */
document.addEventListener("DOMContentLoaded", () => {
  const targets = document.querySelectorAll(".reveal");
  if (!("IntersectionObserver" in window) || !targets.length) {
    targets.forEach(t => t.classList.add("in"));
    return;
  }
  const io = new IntersectionObserver((entries) => {
    entries.forEach(e => { if (e.isIntersecting) { e.target.classList.add("in"); io.unobserve(e.target); } });
  }, { threshold: 0.15 });
  targets.forEach(t => io.observe(t));
});

/* ---------- ANIMATED COUNTERS ---------- */
document.addEventListener("DOMContentLoaded", () => {
  const counters = document.querySelectorAll("[data-count]");
  if (!counters.length) return;
  const run = (el) => {
    const target = parseFloat(el.getAttribute("data-count"));
    const suffix = el.getAttribute("data-suffix") || "";
    const dur = 1400; const start = performance.now();
    function tick(now){
      const p = Math.min((now - start) / dur, 1);
      const val = (target * (1 - Math.pow(1 - p, 3))).toFixed(target % 1 !== 0 ? 1 : 0);
      el.textContent = val + suffix;
      if (p < 1) requestAnimationFrame(tick);
    }
    requestAnimationFrame(tick);
  };
  const io = new IntersectionObserver((entries) => {
    entries.forEach(e => { if (e.isIntersecting) { run(e.target); io.unobserve(e.target); } });
  }, { threshold: 0.4 });
  counters.forEach(c => io.observe(c));
});

/* ---------- HERO PIXEL GRID (signature element) ---------- */
document.addEventListener("DOMContentLoaded", () => {
  const grid = document.getElementById("pixelGrid");
  if (!grid) return;
  const colors = ["var(--primary)", "var(--cyan)", "var(--violet)"];
  for (let i = 0; i < 64; i++) {
    const s = document.createElement("span");
    s.style.animationDelay = `${Math.random() * 0.8}s`;
    s.style.background = colors[Math.floor(Math.random() * colors.length)];
    grid.appendChild(s);
  }
});

/* ---------- TESTIMONIALS (approved reviews from Supabase) ---------- */
async function loadTestimonials(){
  const track = document.getElementById("testiTrack");
  if (!track || typeof supabase === "undefined") return;
  const { data, error } = await supabase
    .from("reviews")
    .select("*")
    .eq("approved", true)
    .order("created_at", { ascending: false })
    .limit(9);

  if (error || !data || !data.length) {
    track.innerHTML = `<div class="empty-state" style="min-width:100%">
      <i class="fas fa-comment-dots"></i>
      <p>Client reviews are on their way — check back soon.</p>
    </div>`;
    return;
  }
  track.innerHTML = data.map(r => `
    <div class="testi-card">
      <div class="testi-stars">${'<i class="fas fa-star"></i>'.repeat(r.rating)}${'<i class="far fa-star"></i>'.repeat(5 - r.rating)}</div>
      <p class="testi-text">"${escapeHTML(r.review_text)}"</p>
      <div class="testi-who">
        <div class="testi-avatar">${r.photo_url ? `<img src="${r.photo_url}" alt="${escapeHTML(r.name)}" style="width:100%;height:100%;object-fit:cover">` : escapeHTML(r.name).charAt(0)}</div>
        <div>
          <div class="testi-name">${escapeHTML(r.name)}</div>
          <div class="testi-role">${escapeHTML(r.company || "")}</div>
        </div>
      </div>
    </div>`).join("");
}
document.addEventListener("DOMContentLoaded", loadTestimonials);

/* ---------- PUBLIC REVIEW SUBMISSION (home page) ---------- */
function setupReviewForm(){
  const form = document.getElementById("reviewForm");
  if (!form || typeof supabase === "undefined") return;
  const stars = document.getElementById("reviewStars");
  const note = document.getElementById("reviewNote");
  let rating = 0;

  const paint = (n) => {
    stars.querySelectorAll("i").forEach(i => {
      const v = parseInt(i.dataset.value, 10);
      i.classList.toggle("fas", v <= n);
      i.classList.toggle("far", v > n);
      i.classList.toggle("active", v <= n);
    });
  };
  stars.querySelectorAll("i").forEach(i => {
    i.addEventListener("click", () => { rating = parseInt(i.dataset.value, 10); paint(rating); });
    i.addEventListener("mouseenter", () => paint(parseInt(i.dataset.value, 10)));
  });
  stars.addEventListener("mouseleave", () => paint(rating));

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    const name = form.reviewName.value.trim();
    const text = form.reviewText.value.trim();
    if (!name) { note.textContent = "Please enter your name."; note.style.color = "#f87171"; return; }
    if (!rating) { note.textContent = "Please choose a star rating."; note.style.color = "#f87171"; return; }
    if (!text) { note.textContent = "Please write your review."; note.style.color = "#f87171"; return; }

    const btn = form.querySelector("button[type=submit]");
    btn.disabled = true;
    // Inserts as approved = false (pending moderation); the RLS policy enforces this.
    const { error } = await supabase.from("reviews").insert({ name, review_text: text, rating });
    btn.disabled = false;

    if (error) { note.textContent = "Could not submit — please try again."; note.style.color = "#f87171"; return; }
    form.reset();
    rating = 0; paint(0);
    note.textContent = "Thanks! Your review will appear once it's approved.";
    note.style.color = "#4ade80";
  });
}
document.addEventListener("DOMContentLoaded", setupReviewForm);

/* ---------- PORTFOLIO PREVIEW (home page — featured only) ---------- */
async function loadPortfolioPreview(){
  const grid = document.getElementById("portfolioPreview");
  if (!grid || typeof supabase === "undefined") return;
  const { data, error } = await supabase
    .from("portfolios")
    .select("*")
    .eq("featured", true)
    .order("sort_order", { ascending: true })
    .limit(3);

  if (error || !data || !data.length) {
    grid.innerHTML = `<div class="empty-state" style="grid-column:1/-1">
      <i class="fas fa-briefcase"></i>
      <p>Featured work is being curated — the full portfolio is being built out through our admin panel.</p>
    </div>`;
    return;
  }
  grid.innerHTML = data.map(portfolioCardHTML).join("");
}
document.addEventListener("DOMContentLoaded", loadPortfolioPreview);

/* ---------- PORTFOLIO PAGE (full grid + filter + modal) ---------- */
let ALL_PORTFOLIO = [];
async function loadPortfolioPage(){
  const grid = document.getElementById("portfolioGrid");
  if (!grid || typeof supabase === "undefined") return;
  const { data, error } = await supabase
    .from("portfolios")
    .select("*")
    .order("sort_order", { ascending: true });

  if (error || !data || !data.length) {
    grid.innerHTML = `<div class="empty-state" style="grid-column:1/-1">
      <i class="fas fa-briefcase"></i>
      <p>No projects published yet. Check back soon — our portfolio is actively growing.</p>
    </div>`;
    return;
  }
  ALL_PORTFOLIO = data;
  renderPortfolioGrid(data);

  document.querySelectorAll(".filter-btn").forEach(btn => {
    btn.addEventListener("click", () => {
      document.querySelectorAll(".filter-btn").forEach(b => b.classList.remove("active"));
      btn.classList.add("active");
      const cat = btn.getAttribute("data-filter");
      renderPortfolioGrid(cat === "all" ? ALL_PORTFOLIO : ALL_PORTFOLIO.filter(p => p.category === cat));
    });
  });
}
function renderPortfolioGrid(items){
  const grid = document.getElementById("portfolioGrid");
  if (!items.length) { grid.innerHTML = `<div class="empty-state" style="grid-column:1/-1"><i class="fas fa-filter"></i><p>No projects in this category yet.</p></div>`; return; }
  grid.innerHTML = items.map(portfolioCardHTML).join("");
  grid.querySelectorAll("[data-project-id]").forEach(card => {
    card.addEventListener("click", () => openProjectModal(card.getAttribute("data-project-id")));
  });
}
function portfolioCardHTML(p){
  return `
    <div class="portfolio-card reveal in" data-project-id="${p.id}">
      <div class="portfolio-thumb">${p.logo_url ? `<img src="${p.logo_url}" alt="${escapeHTML(p.title)}">` : `<i class="fas fa-image" style="font-size:1.8rem;color:var(--text-lo)"></i>`}</div>
      <div class="portfolio-body">
        <span class="tag-pill">${formatCategory(p.category)}</span>
        <h3>${escapeHTML(p.title)}</h3>
        <p style="color:var(--text-lo);font-size:.88rem;margin-top:6px">${escapeHTML(p.client || "")}</p>
      </div>
    </div>`;
}
function openProjectModal(id){
  const p = ALL_PORTFOLIO.find(x => x.id === id);
  if (!p) return;
  const overlay = document.getElementById("projectModal");
  document.getElementById("modalBody").innerHTML = `
    <button class="modal-close" onclick="closeProjectModal()"><i class="fas fa-times"></i></button>
    ${p.logo_url ? `<img src="${p.logo_url}" alt="${escapeHTML(p.title)}" style="width:100%;border-radius:12px;margin-bottom:20px;aspect-ratio:16/9;object-fit:cover">` : ""}
    <span class="tag-pill">${formatCategory(p.category)}</span>
    <h2 style="margin:10px 0">${escapeHTML(p.title)}</h2>
    <p style="color:var(--text-lo);margin-bottom:16px">${escapeHTML(p.description)}</p>
    ${p.client ? `<p style="font-size:.88rem;margin-bottom:6px"><strong>Client:</strong> ${escapeHTML(p.client)}</p>` : ""}
    ${p.completion_date ? `<p style="font-size:.88rem;margin-bottom:6px"><strong>Completed:</strong> ${p.completion_date}</p>` : ""}
    ${p.technologies?.length ? `<p style="font-size:.88rem;margin-bottom:16px"><strong>Tech:</strong> ${p.technologies.map(escapeHTML).join(", ")}</p>` : ""}
    ${p.project_url ? `<a href="${p.project_url}" target="_blank" rel="noopener" class="btn btn-primary btn-sm">Visit Project <i class="fas fa-arrow-up-right-from-square"></i></a>` : ""}
  `;
  overlay.classList.add("open");
}
function closeProjectModal(){ document.getElementById("projectModal")?.classList.remove("open"); }
function formatCategory(cat){
  const map = { "web-development":"Web Development","software-development":"Software Development","hosting":"Hosting","graphic-design":"Graphic Design","seo-marketing":"SEO & Marketing","ai-automation":"AI & Automation" };
  return map[cat] || cat;
}
document.addEventListener("DOMContentLoaded", loadPortfolioPage);

/* ---------- CONTACT FORM ---------- */
document.addEventListener("DOMContentLoaded", () => {
  const form = document.getElementById("contactForm");
  if (!form) return;
  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    const btn = form.querySelector('button[type="submit"]');
    const successEl = document.getElementById("formSuccess");
    const errorEl = document.getElementById("formError");
    successEl.style.display = "none"; errorEl.style.display = "none";
    btn.disabled = true; btn.innerHTML = '<span class="spinner"></span> Sending...';

    const payload = {
      name: form.name.value.trim(),
      email: form.email.value.trim(),
      phone: form.phone.value.trim(),
      service: form.service.value,
      message: form.message.value.trim(),
    };
    try {
      const { error } = await supabase.from("messages").insert(payload);
      if (error) throw error;
      successEl.style.display = "block";
      form.reset();
    } catch (err) {
      errorEl.textContent = "Something went wrong sending your message — please try WhatsApp or email instead.";
      errorEl.style.display = "block";
    } finally {
      btn.disabled = false; btn.innerHTML = 'Send Message <i class="fas fa-paper-plane"></i>';
    }
  });
});

/* ---------- NEWSLETTER (footer) ---------- */
document.addEventListener("DOMContentLoaded", () => {
  const form = document.getElementById("newsletterForm");
  form?.addEventListener("submit", (e) => {
    e.preventDefault();
    const input = form.querySelector("input");
    input.value = "";
    const note = document.getElementById("newsletterNote");
    if (note) { note.textContent = "Thanks — you're on the list!"; note.style.color = "var(--cyan)"; }
  });
});

/* ---------- PRICING TOGGLE (hosting page: monthly/yearly) ---------- */
document.addEventListener("DOMContentLoaded", () => {
  const toggle = document.getElementById("billingToggle");
  if (!toggle) return;
  toggle.querySelectorAll("button").forEach(btn => {
    btn.addEventListener("click", () => {
      toggle.querySelectorAll("button").forEach(b => b.classList.remove("active"));
      btn.classList.add("active");
      const mode = btn.getAttribute("data-mode");
      document.querySelectorAll("[data-price-monthly]").forEach(el => {
        el.textContent = mode === "yearly" ? el.getAttribute("data-price-yearly") : el.getAttribute("data-price-monthly");
      });
    });
  });
});

/* ---------- UTIL ---------- */
function escapeHTML(str){
  if (str === null || str === undefined) return "";
  return String(str).replace(/[&<>"']/g, m => ({ "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;" }[m]));
}
