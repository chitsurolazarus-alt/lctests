/* ==========================================================
   Graphic Design page — services catalogue (Supabase),
   category filter, card → quote-form selection, quote
   submission (+ optional file upload) and WhatsApp hand-off.
   Relies on: supabase (supabase-client.js), WHATSAPP_NUMBER,
   escapeHTML, portfolioCardHTML (main.js).
   ========================================================== */

const GD_MAX_FILE = 10 * 1024 * 1024;
const GD_ALLOWED_TYPES = [
  "image/jpeg", "image/png", "image/webp", "image/gif", "application/pdf",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
];
const GD_OTHER = "Other (describe below)";

let GD_SERVICES = [];            // visible services from Supabase
let GD_ACTIVE_CATEGORY = "all";
const GD_SELECTED = new Set();   // selected service titles

document.addEventListener("DOMContentLoaded", () => {
  if (!document.getElementById("gdGrid")) return;
  initQuoteForm();
  loadServices();
  loadRecentWork();
});

/* ---------- helpers ---------- */
const gdEl = (id) => document.getElementById(id);
const gdSafeIcon = (s) => /^[a-z0-9-]{1,40}$/i.test(s || "") ? s : "palette";

function gdPriceLabel(s) {
  if (s.starting_price === null || s.starting_price === undefined || s.starting_price === "") return null;
  const n = Number(s.starting_price);
  if (!isFinite(n)) return null;
  const amount = "R" + n.toLocaleString("en-ZA", { maximumFractionDigits: 2 });
  const note = (s.price_note || "").trim();
  if (/^(from|starting|approx|about)/i.test(note)) return note.charAt(0).toUpperCase() + note.slice(1) + " " + amount;
  return "From " + amount + (note ? " " + note : "");
}

function gdCategories() {
  const seen = []; // keep order of first appearance (services come sorted by sort_order)
  GD_SERVICES.forEach(s => { if (!seen.includes(s.category)) seen.push(s.category); });
  return seen;
}

/* ---------- load + render services ---------- */
async function loadServices() {
  const grid = gdEl("gdGrid");
  try {
    if (typeof supabase === "undefined" || !supabase.from) throw new Error("Supabase unavailable");
    const { data, error } = await supabase
      .from("graphic_design_services")
      .select("*")
      .eq("is_visible", true)
      .order("sort_order", { ascending: true });
    if (error) throw error;
    if (!data || !data.length) throw new Error("empty");
    GD_SERVICES = data;
  } catch (err) {
    console.warn("Design services could not be loaded:", err.message || err);
    grid.setAttribute("aria-busy", "false");
    grid.innerHTML = `<div class="empty-state" style="grid-column:1/-1">
      <i class="fas fa-palette"></i>
      <p>We could not load our service list right now. You can still tell us what you need in the form below, or message us directly.</p>
      <p style="margin-top:16px"><a data-whatsapp="Hi! I'd like a graphic design quote." class="btn btn-whatsapp btn-sm" target="_blank" rel="noopener"><i class="fab fa-whatsapp"></i> Chat on WhatsApp</a></p>
    </div>`;
    grid.querySelectorAll("[data-whatsapp]").forEach(a => {
      a.href = `https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(a.getAttribute("data-whatsapp"))}`;
    });
    gdEl("gdFilter").hidden = true;
    renderChecklist();
    return;
  }
  grid.setAttribute("aria-busy", "false");
  renderFilter();
  renderCards();
  renderChecklist();
}

function renderFilter() {
  const bar = gdEl("gdFilter");
  const cats = ["all", ...gdCategories()];
  bar.innerHTML = cats.map(c => `
    <button type="button" role="tab" class="filter-btn${c === GD_ACTIVE_CATEGORY ? " active" : ""}"
            aria-selected="${c === GD_ACTIVE_CATEGORY}" data-cat="${escapeHTML(c)}">${c === "all" ? "All" : escapeHTML(c)}</button>`).join("");
  bar.querySelectorAll(".filter-btn").forEach(btn => {
    btn.addEventListener("click", () => {
      GD_ACTIVE_CATEGORY = btn.dataset.cat;
      bar.querySelectorAll(".filter-btn").forEach(b => {
        const on = b === btn;
        b.classList.toggle("active", on);
        b.setAttribute("aria-selected", on);
      });
      renderCards();
    });
  });
}

function renderCards() {
  const grid = gdEl("gdGrid");
  const list = GD_ACTIVE_CATEGORY === "all" ? GD_SERVICES : GD_SERVICES.filter(s => s.category === GD_ACTIVE_CATEGORY);
  if (!list.length) {
    grid.innerHTML = `<div class="empty-state" style="grid-column:1/-1"><i class="fas fa-filter"></i><p>No services in this category yet.</p></div>`;
    return;
  }
  grid.innerHTML = list.map(s => {
    const price = gdPriceLabel(s);
    const on = GD_SELECTED.has(s.title);
    return `
    <article class="gd-card${on ? " selected" : ""}" data-id="${s.id}">
      <div class="gd-card-top">
        ${s.image_url
          ? `<img class="gd-card-img" src="${escapeHTML(s.image_url)}" alt="${escapeHTML(s.title)} example" loading="lazy" decoding="async">`
          : `<div class="card-icon" aria-hidden="true"><i class="fas fa-${gdSafeIcon(s.icon)}"></i></div>`}
        <span class="tag-pill">${escapeHTML(s.category)}</span>
      </div>
      <h3>${escapeHTML(s.title)}</h3>
      <p>${escapeHTML(s.description || "")}</p>
      <div class="gd-card-foot">
        <span class="gd-price${price ? "" : " quote"}">${price ? escapeHTML(price) : "Get a quote"}</span>
        <button type="button" class="gd-select-btn${on ? " on" : ""}" data-title="${escapeHTML(s.title)}" aria-pressed="${on}">
          <i class="fas ${on ? "fa-check" : "fa-plus"}"></i> <span>${on ? "Selected" : "Select"}</span>
        </button>
      </div>
    </article>`;
  }).join("");

  grid.querySelectorAll(".gd-select-btn").forEach(btn => {
    btn.addEventListener("click", () => toggleService(btn.dataset.title));
  });
}

/* ---------- selection state (cards <-> checklist) ---------- */
function toggleService(title, force) {
  const want = force === undefined ? !GD_SELECTED.has(title) : force;
  if (want) GD_SELECTED.add(title); else GD_SELECTED.delete(title);
  syncSelectionUI();
}

function syncSelectionUI() {
  document.querySelectorAll(".gd-select-btn").forEach(btn => {
    const on = GD_SELECTED.has(btn.dataset.title);
    btn.classList.toggle("on", on);
    btn.setAttribute("aria-pressed", on);
    btn.querySelector("i").className = "fas " + (on ? "fa-check" : "fa-plus");
    btn.querySelector("span").textContent = on ? "Selected" : "Select";
    btn.closest(".gd-card")?.classList.toggle("selected", on);
  });
  document.querySelectorAll("#gdChecklist input[type=checkbox]").forEach(cb => {
    cb.checked = GD_SELECTED.has(cb.value);
  });
  const n = GD_SELECTED.size;
  const bar = gdEl("gdSelectedBar");
  bar.hidden = n === 0;
  gdEl("gdSelectedCount").textContent = n + (n === 1 ? " service selected" : " services selected");
}

function renderChecklist() {
  const box = gdEl("gdChecklist");
  let html = "";
  gdCategories().forEach(cat => {
    const items = GD_SERVICES.filter(s => s.category === cat);
    html += `<div class="gd-check-group"><h4>${escapeHTML(cat)}</h4><div class="gd-check-list">` +
      items.map(s => checkboxHTML(s.title)).join("") + `</div></div>`;
  });
  html += `<div class="gd-check-group"><h4>Something else</h4><div class="gd-check-list">${checkboxHTML(GD_OTHER)}</div></div>`;
  box.innerHTML = html;
  box.querySelectorAll("input[type=checkbox]").forEach(cb => {
    cb.addEventListener("change", () => toggleService(cb.value, cb.checked));
  });
  syncSelectionUI();
}

let gdCheckCounter = 0;
function checkboxHTML(title) {
  const id = "gdsvc" + (++gdCheckCounter);
  return `<label class="gd-check" for="${id}"><input type="checkbox" id="${id}" value="${escapeHTML(title)}"><span>${escapeHTML(title)}</span></label>`;
}

/* ---------- recent design work (portfolio, category = graphic-design) ---------- */
async function loadRecentWork() {
  const section = gdEl("recentWork");
  try {
    if (typeof supabase === "undefined" || !supabase.from) return;
    const { data, error } = await supabase
      .from("portfolios").select("*")
      .eq("category", "graphic-design")
      .order("sort_order", { ascending: true })
      .limit(6);
    if (error || !data || !data.length) return;
    gdEl("gdPortfolio").innerHTML = data.map(portfolioCardHTML).join("");
    gdEl("gdPortfolio").querySelectorAll("[data-project-id]").forEach(c =>
      c.addEventListener("click", () => { location.href = "portfolio.html"; }));
    section.hidden = false;
  } catch (e) { /* section simply stays hidden */ }
}

/* ---------- quote form ---------- */
function initQuoteForm() {
  const form = gdEl("gdQuoteForm");
  const deadline = gdEl("gdDeadline");
  const today = new Date(); today.setMinutes(today.getMinutes() - today.getTimezoneOffset());
  deadline.min = today.toISOString().slice(0, 10);

  form.addEventListener("submit", onSubmitQuote);
  gdEl("gdWhatsAppBtn").addEventListener("click", sendOnWhatsApp);
}

function gdShowError(msg) {
  const el = gdEl("gdFormError");
  el.textContent = msg;
  el.style.display = msg ? "block" : "none";
  if (msg) el.scrollIntoView({ block: "center", behavior: "smooth" });
}

function readForm() {
  const f = gdEl("gdQuoteForm");
  return {
    name: f.name.value.trim(),
    email: f.email.value.trim(),
    phone: f.phone.value.trim(),
    company: f.company.value.trim(),
    budget: f.budget.value,
    deadline: f.deadline.value || null,
    details: f.details.value.trim(),
    services: Array.from(GD_SELECTED),
    file: f.file.files[0] || null,
    honey: f.website.value
  };
}

function validate(v) {
  if (!v.name) return "Please enter your name.";
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v.email)) return "Please enter a valid email address.";
  if (v.phone && !/^\+?[\d\s()\-]{7,20}$/.test(v.phone)) return "Please enter a valid phone number (digits, spaces and + only).";
  if (!v.services.length) return "Please tick at least one service you need.";
  if (v.deadline && v.deadline < gdEl("gdDeadline").min) return "The deadline cannot be in the past.";
  if (v.details.length > 3000) return "Project details are too long (max 3000 characters).";
  if (v.file) {
    if (v.file.size > GD_MAX_FILE) return "That file is larger than 10 MB. Please attach a smaller file.";
    const okExt = /\.(jpe?g|png|webp|gif|pdf|docx)$/i.test(v.file.name);
    if (!GD_ALLOWED_TYPES.includes(v.file.type) && !okExt) return "Only images, PDF and DOCX files can be attached.";
  }
  return "";
}

async function onSubmitQuote(e) {
  e.preventDefault();
  gdShowError("");
  gdEl("gdFormSuccess").style.display = "none";
  const v = readForm();
  if (v.honey) return; // bot
  const problem = validate(v);
  if (problem) { gdShowError(problem); return; }

  const btn = gdEl("gdSubmit");
  const label = btn.innerHTML;
  btn.disabled = true; btn.innerHTML = '<span class="spinner"></span> Sending…';

  try {
    let attachment = null;
    if (v.file) {
      const ext = (v.file.name.split(".").pop() || "bin").toLowerCase().replace(/[^a-z0-9]/g, "");
      attachment = `${Date.now()}-${Math.random().toString(36).slice(2, 10)}.${ext}`;
      const { error: upErr } = await supabase.storage.from("design-briefs")
        .upload(attachment, v.file, { contentType: v.file.type || undefined, upsert: false });
      if (upErr) throw upErr;
    }
    // No .select(): visitors may insert but can never read requests back.
    const { error } = await supabase.from("design_quote_requests").insert({
      name: v.name, email: v.email, phone: v.phone || null, company: v.company || null,
      services: v.services, budget: v.budget || null, deadline: v.deadline,
      details: v.details || null, attachment_url: attachment
    });
    if (error) throw error;

    gdEl("gdQuoteForm").reset();
    GD_SELECTED.clear(); syncSelectionUI();
    const ok = gdEl("gdFormSuccess");
    ok.style.display = "block";
    ok.scrollIntoView({ block: "center", behavior: "smooth" });
  } catch (err) {
    console.error("Quote request failed:", err);
    gdShowError("Sorry, we could not send your request. Please try again, or use the WhatsApp button to send it to us directly.");
  } finally {
    btn.disabled = false; btn.innerHTML = label;
  }
}

function sendOnWhatsApp() {
  const v = readForm();
  if (!v.services.length) { gdShowError("Please tick at least one service first, then tap WhatsApp."); return; }
  gdShowError("");
  const lines = ["Hi! I'd like a graphic design quote.", ""];
  if (v.name) lines.push("Name: " + v.name);
  if (v.company) lines.push("Company: " + v.company);
  if (v.phone) lines.push("Phone: " + v.phone);
  if (v.email) lines.push("Email: " + v.email);
  lines.push("", "Services needed:");
  const byCat = {};
  v.services.forEach(t => {
    const s = GD_SERVICES.find(x => x.title === t);
    const cat = s ? s.category : "Other";
    (byCat[cat] = byCat[cat] || []).push(t);
  });
  Object.keys(byCat).forEach(cat => {
    lines.push(cat + ":");
    byCat[cat].forEach(t => lines.push("  - " + t));
  });
  if (v.budget) lines.push("", "Budget: " + v.budget);
  if (v.deadline) lines.push("Deadline: " + v.deadline);
  if (v.details) lines.push("", "Details: " + v.details);
  if (v.file) lines.push("", "(I will send my file here in the chat.)");
  window.open(`https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(lines.join("\n"))}`, "_blank", "noopener");
}
