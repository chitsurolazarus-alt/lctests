/* ==========================================================
   Admin — Graphic Design: Design Services (CRUD) and
   Design Quote Requests (inbox).
   Relies on globals from dashboard.js / auth.js:
   supabase, requireAuth, uploadFile, openModal, closeModal,
   escapeHTML, timeAgo.
   ========================================================== */

let GD_SVCS = [];
let GD_QUOTES = [];
let gdEditingId = null;
let gdPendingImage = null;
let gdViewingQuoteId = null;

const GD_STATUSES = ["new", "contacted", "quoted", "won", "lost"];

document.addEventListener("DOMContentLoaded", async () => {
  if (!document.querySelector('[data-tab-panel="gd-services"]')) return;
  const session = await requireAuth();
  if (!session) return;
  gdSetupServices();
  gdSetupQuotes();
  await Promise.all([gdLoadServices(), gdLoadQuotes()]);
});

const gdById = (id) => document.getElementById(id);
const gdBySort = (a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0) || String(a.created_at).localeCompare(String(b.created_at));
const gdSafeIconName = (s) => /^[a-z0-9-]{1,40}$/i.test(s || "") ? s : "palette";

function gdPrice(s) {
  if (s.starting_price === null || s.starting_price === undefined) return "—";
  const n = Number(s.starting_price);
  return "R" + n.toLocaleString("en-ZA", { maximumFractionDigits: 2 }) + (s.price_note ? ` <span style="color:var(--text-lo);font-size:.75rem">${escapeHTML(s.price_note)}</span>` : "");
}

/* ============================================================
   DESIGN SERVICES
   ============================================================ */
async function gdLoadServices() {
  const { data, error } = await supabase.from("graphic_design_services").select("*")
    .order("sort_order", { ascending: true }).order("created_at", { ascending: true });
  if (error) {
    console.error(error);
    gdById("gdServicesBody").innerHTML = `<tr><td colspan="7"><div class="empty-state"><i class="fas fa-triangle-exclamation"></i><p>Could not load services: ${escapeHTML(error.message)}<br>Have you run <code>sql/08_graphic_design.sql</code> in Supabase?</p></div></td></tr>`;
    return;
  }
  GD_SVCS = data || [];
  gdFillCategoryControls();
  gdRenderServices();
}

function gdCategoryList() {
  const out = [];
  [...GD_SVCS].sort(gdBySort).forEach(s => { if (!out.includes(s.category)) out.push(s.category); });
  return out;
}

function gdFillCategoryControls() {
  const cats = gdCategoryList();
  const filter = gdById("gdSvcCategoryFilter");
  const keep = filter.value;
  filter.innerHTML = `<option value="">All categories</option>` + cats.map(c => `<option>${escapeHTML(c)}</option>`).join("");
  filter.value = cats.includes(keep) ? keep : "";
  gdById("gdCategoryOptions").innerHTML = cats.map(c => `<option value="${escapeHTML(c)}">`).join("");
}

function gdRenderServices() {
  const tbody = gdById("gdServicesBody");
  const cat = gdById("gdSvcCategoryFilter").value;
  const q = gdById("gdSvcSearch").value.trim().toLowerCase();
  const sorted = [...GD_SVCS].sort(gdBySort);
  const list = sorted.filter(s =>
    (!cat || s.category === cat) &&
    (!q || (s.title + " " + (s.description || "")).toLowerCase().includes(q)));

  if (!list.length) {
    tbody.innerHTML = `<tr><td colspan="7"><div class="empty-state"><i class="fas fa-palette"></i><p>${GD_SVCS.length ? "No services match your filter." : "No design services yet — add your first one."}</p></div></td></tr>`;
    return;
  }
  tbody.innerHTML = list.map(s => {
    const sameCat = sorted.filter(x => x.category === s.category);
    const pos = sameCat.findIndex(x => x.id === s.id);
    return `
    <tr>
      <td>${s.image_url
        ? `<img src="${escapeHTML(s.image_url)}" class="row-thumb" alt="" loading="lazy">`
        : `<div class="row-thumb" style="display:flex;align-items:center;justify-content:center"><i class="fas fa-${gdSafeIconName(s.icon)}" style="color:var(--text-lo)"></i></div>`}</td>
      <td><strong>${escapeHTML(s.title)}</strong><br><span style="color:var(--text-lo);font-size:.78rem">${escapeHTML((s.description || "").slice(0, 70))}${(s.description || "").length > 70 ? "…" : ""}</span></td>
      <td>${escapeHTML(s.category)}</td>
      <td>${gdPrice(s)}</td>
      <td><button class="badge ${s.is_visible ? "on" : "off"}" style="cursor:pointer;min-height:36px;border:0" data-gd-action="toggle" data-id="${s.id}" aria-label="${s.is_visible ? "Visible — tap to hide" : "Hidden — tap to show"}">${s.is_visible ? "Visible" : "Hidden"}</button></td>
      <td style="white-space:nowrap">
        <button class="icon-btn" title="Move up" aria-label="Move up" data-gd-action="up" data-id="${s.id}" ${pos === 0 ? "disabled" : ""}><i class="fas fa-arrow-up"></i></button>
        <button class="icon-btn" title="Move down" aria-label="Move down" data-gd-action="down" data-id="${s.id}" ${pos === sameCat.length - 1 ? "disabled" : ""}><i class="fas fa-arrow-down"></i></button>
      </td>
      <td style="white-space:nowrap">
        <button class="icon-btn" title="Edit" aria-label="Edit ${escapeHTML(s.title)}" data-gd-action="edit" data-id="${s.id}"><i class="fas fa-pen"></i></button>
        <button class="icon-btn" title="Delete" aria-label="Delete ${escapeHTML(s.title)}" data-gd-action="delete" data-id="${s.id}"><i class="fas fa-trash"></i></button>
      </td>
    </tr>`;
  }).join("");
}

function gdSetupServices() {
  gdById("gdAddServiceBtn").addEventListener("click", () => gdOpenServiceModal(null));
  gdById("gdSvcCategoryFilter").addEventListener("change", gdRenderServices);
  gdById("gdSvcSearch").addEventListener("input", gdRenderServices);
  gdById("closeGdServiceModal").addEventListener("click", () => closeModal("gdServiceModal"));
  gdById("gdServiceForm").addEventListener("submit", gdSaveService);
  gdById("gdServiceImage").addEventListener("change", (e) => {
    gdPendingImage = e.target.files[0] || null;
    if (gdPendingImage) {
      const img = gdById("gdServicePreview");
      img.src = URL.createObjectURL(gdPendingImage);
      img.style.display = "block";
    }
  });

  gdById("gdServicesBody").addEventListener("click", (e) => {
    const btn = e.target.closest("[data-gd-action]");
    if (!btn || btn.disabled) return;
    const id = btn.dataset.id;
    switch (btn.dataset.gdAction) {
      case "toggle": return gdToggleVisible(id);
      case "up": return gdMove(id, -1);
      case "down": return gdMove(id, 1);
      case "edit": return gdOpenServiceModal(id);
      case "delete": return gdDeleteService(id);
    }
  });
}

function gdOpenServiceModal(id) {
  gdEditingId = id;
  gdPendingImage = null;
  const f = gdById("gdServiceForm");
  f.reset();
  gdById("gdServicePreview").style.display = "none";
  gdById("gdServiceError").style.display = "none";
  gdById("gdServiceModalTitle").textContent = id ? "Edit Design Service" : "Add Design Service";
  f.is_visible.checked = true;
  if (id) {
    const s = GD_SVCS.find(x => x.id === id);
    f.category.value = s.category;
    f.title.value = s.title;
    f.description.value = s.description || "";
    f.starting_price.value = s.starting_price ?? "";
    f.price_note.value = s.price_note || "";
    f.icon.value = s.icon || "";
    f.is_visible.checked = !!s.is_visible;
    if (s.image_url) { const img = gdById("gdServicePreview"); img.src = s.image_url; img.style.display = "block"; }
  }
  openModal("gdServiceModal");
}

async function gdSaveService(e) {
  e.preventDefault();
  const f = e.target;
  const err = gdById("gdServiceError");
  err.style.display = "none";
  const category = f.category.value.trim();
  const title = f.title.value.trim();
  if (!category || !title) { err.textContent = "Category and title are required."; err.style.display = "block"; return; }
  const priceRaw = f.starting_price.value.trim();
  if (priceRaw !== "" && (isNaN(Number(priceRaw)) || Number(priceRaw) < 0)) {
    err.textContent = "Price must be a positive number (or leave it empty for “Get a quote”)."; err.style.display = "block"; return;
  }
  const icon = f.icon.value.trim().replace(/^fa-/, "");
  if (icon && !/^[a-z0-9-]{1,40}$/i.test(icon)) { err.textContent = "Icon must be a Font Awesome name like pen-nib."; err.style.display = "block"; return; }

  const btn = f.querySelector('button[type="submit"]');
  btn.disabled = true; btn.innerHTML = '<span class="spinner"></span> Saving…';
  try {
    let image_url = gdEditingId ? GD_SVCS.find(s => s.id === gdEditingId)?.image_url || null : null;
    if (gdPendingImage) image_url = await uploadFile("portfolio-logos", gdPendingImage);
    const payload = {
      category, title,
      description: f.description.value.trim() || null,
      starting_price: priceRaw === "" ? null : Number(priceRaw),
      price_note: f.price_note.value.trim() || null,
      icon: icon || null,
      image_url,
      is_visible: f.is_visible.checked
    };
    if (gdEditingId) {
      const { error } = await supabase.from("graphic_design_services").update(payload).eq("id", gdEditingId);
      if (error) throw error;
    } else {
      const max = GD_SVCS.reduce((m, s) => Math.max(m, s.sort_order ?? 0), 0);
      payload.sort_order = max + 10;
      const { error } = await supabase.from("graphic_design_services").insert(payload);
      if (error) throw error;
    }
    closeModal("gdServiceModal");
    await gdLoadServices();
  } catch (ex) {
    err.textContent = "Couldn't save: " + (ex.message || ex);
    err.style.display = "block";
  } finally {
    btn.disabled = false; btn.innerHTML = "Save Service";
  }
}

async function gdToggleVisible(id) {
  const s = GD_SVCS.find(x => x.id === id);
  const { error } = await supabase.from("graphic_design_services").update({ is_visible: !s.is_visible }).eq("id", id);
  if (error) { alert(error.message); return; }
  await gdLoadServices();
}

async function gdMove(id, dir) {
  const sorted = [...GD_SVCS].sort(gdBySort);
  const idx = sorted.findIndex(s => s.id === id);
  const cat = sorted[idx].category;
  let j = idx + dir;
  while (j >= 0 && j < sorted.length && sorted[j].category !== cat) j += dir;
  if (j < 0 || j >= sorted.length) return;
  const order = sorted.map(s => s.id);
  [order[idx], order[j]] = [order[j], order[idx]];
  // renumber 10,20,30… so duplicate sort_order values can never block a move
  const jobs = [];
  order.forEach((sid, i) => {
    const want = (i + 1) * 10;
    if (GD_SVCS.find(s => s.id === sid).sort_order !== want) {
      jobs.push(supabase.from("graphic_design_services").update({ sort_order: want }).eq("id", sid));
    }
  });
  const results = await Promise.all(jobs);
  const failed = results.find(r => r.error);
  if (failed) alert("Couldn't reorder: " + failed.error.message);
  await gdLoadServices();
}

async function gdDeleteService(id) {
  const s = GD_SVCS.find(x => x.id === id);
  if (!confirm(`Delete “${s.title}”? This can't be undone.`)) return;
  const { error } = await supabase.from("graphic_design_services").delete().eq("id", id);
  if (error) { alert(error.message); return; }
  await gdLoadServices();
}

/* ============================================================
   DESIGN QUOTE REQUESTS
   ============================================================ */
async function gdLoadQuotes() {
  const { data, error } = await supabase.from("design_quote_requests").select("*").order("created_at", { ascending: false });
  if (error) {
    console.error(error);
    gdById("gdQuotesBody").innerHTML = `<tr><td colspan="6"><div class="empty-state"><i class="fas fa-triangle-exclamation"></i><p>Could not load quote requests: ${escapeHTML(error.message)}<br>Have you run <code>sql/08_graphic_design.sql</code> in Supabase?</p></div></td></tr>`;
    return;
  }
  GD_QUOTES = data || [];
  gdRenderQuotes();
  gdUpdateQuoteCounts();
}

function gdUpdateQuoteCounts() {
  const n = GD_QUOTES.filter(q => q.status === "new").length;
  const badge = gdById("gdQuotesBadge");
  badge.textContent = n;
  badge.hidden = n === 0;
  const kpi = gdById("kpiDesignQuotes");
  if (kpi) kpi.textContent = n;
}

function gdStatusBadge(status) {
  return `<span class="status-badge st-${escapeHTML(status)}">${escapeHTML(status.charAt(0).toUpperCase() + status.slice(1))}</span>`;
}

function gdRenderQuotes() {
  const tbody = gdById("gdQuotesBody");
  const status = gdById("gdQuoteStatusFilter").value;
  const q = gdById("gdQuoteSearch").value.trim().toLowerCase();
  const list = GD_QUOTES.filter(r =>
    (!status || r.status === status) &&
    (!q || (r.name + " " + r.email + " " + (r.company || "")).toLowerCase().includes(q)));

  if (!list.length) {
    tbody.innerHTML = `<tr><td colspan="6"><div class="empty-state"><i class="fas fa-file-pen"></i><p>${GD_QUOTES.length ? "No requests match your filter." : "No design quote requests yet."}</p></div></td></tr>`;
    return;
  }
  tbody.innerHTML = list.map(r => {
    const svcs = r.services || [];
    return `
    <tr style="${r.status === "new" ? "font-weight:600" : ""}">
      <td style="white-space:nowrap;font-weight:400"><span title="${escapeHTML(new Date(r.created_at).toLocaleString("en-ZA"))}">${timeAgo(r.created_at)}</span></td>
      <td>${escapeHTML(r.name)}<br><span style="color:var(--text-lo);font-size:.78rem;font-weight:400">${escapeHTML(r.company || r.email)}</span></td>
      <td style="font-weight:400;max-width:260px">${svcs.slice(0, 2).map(s => `<span class="chip">${escapeHTML(s)}</span>`).join("")}${svcs.length > 2 ? `<span class="chip">+${svcs.length - 2}</span>` : ""}</td>
      <td style="font-weight:400">${escapeHTML(r.budget || "—")}</td>
      <td>${gdStatusBadge(r.status || "new")}</td>
      <td style="white-space:nowrap">
        <button class="icon-btn" title="View request" aria-label="View request from ${escapeHTML(r.name)}" data-gd-quote="view" data-id="${r.id}"><i class="fas fa-eye"></i></button>
        <button class="icon-btn" title="Delete" aria-label="Delete request from ${escapeHTML(r.name)}" data-gd-quote="delete" data-id="${r.id}"><i class="fas fa-trash"></i></button>
      </td>
    </tr>`;
  }).join("");
}

function gdSetupQuotes() {
  gdById("gdQuoteStatusFilter").addEventListener("change", gdRenderQuotes);
  gdById("gdQuoteSearch").addEventListener("input", gdRenderQuotes);
  gdById("closeGdQuoteModal").addEventListener("click", () => closeModal("gdQuoteModal"));
  gdById("gdQuoteModal").addEventListener("click", (e) => { if (e.target.id === "gdQuoteModal") closeModal("gdQuoteModal"); });
  gdById("gdServiceModal").addEventListener("click", (e) => { if (e.target.id === "gdServiceModal") closeModal("gdServiceModal"); });
  gdById("gdQuotesBody").addEventListener("click", (e) => {
    const btn = e.target.closest("[data-gd-quote]");
    if (!btn) return;
    if (btn.dataset.gdQuote === "view") gdOpenQuote(btn.dataset.id);
    else gdDeleteQuote(btn.dataset.id);
  });
}

function gdWaNumber(phone) {
  let d = (phone || "").replace(/\D/g, "");
  if (!d) return "";
  if (d.startsWith("00")) d = d.slice(2);
  else if (d.startsWith("0")) d = "27" + d.slice(1);   // South African local format
  return d;
}

function gdOpenQuote(id) {
  const r = GD_QUOTES.find(x => x.id === id);
  if (!r) return;
  gdViewingQuoteId = id;
  const wa = gdWaNumber(r.phone);
  const svcText = (r.services || []).join(", ");
  const waMsg = `Hi ${r.name}, thanks for your graphic design quote request (${svcText}). We'd love to help — `;
  const mailSubject = "Your graphic design quote — L.C Digital Solution";
  const mailBody = `Hi ${r.name},\n\nThank you for your request for: ${svcText}.\n\n`;

  gdById("gdQuoteBody").innerHTML = `
    <div class="gd-qr-detail">
      <h3 style="margin-bottom:4px">${escapeHTML(r.name)}</h3>
      <p class="muted" style="font-size:.85rem">Received ${escapeHTML(new Date(r.created_at).toLocaleString("en-ZA"))}</p>
      <dl>
        <dt>Email</dt><dd><a href="mailto:${escapeHTML(r.email)}">${escapeHTML(r.email)}</a></dd>
        <dt>Phone</dt><dd>${r.phone ? `<a href="tel:${escapeHTML(r.phone.replace(/[^\d+]/g, ""))}">${escapeHTML(r.phone)}</a>` : "—"}</dd>
        <dt>Company</dt><dd>${escapeHTML(r.company || "—")}</dd>
        <dt>Services</dt><dd>${(r.services || []).map(s => `<span class="chip">${escapeHTML(s)}</span>`).join("") || "—"}</dd>
        <dt>Budget</dt><dd>${escapeHTML(r.budget || "—")}</dd>
        <dt>Deadline</dt><dd>${r.deadline ? escapeHTML(r.deadline) : "—"}</dd>
        <dt>Details</dt><dd style="white-space:pre-wrap">${escapeHTML(r.details || "—")}</dd>
        <dt>Attachment</dt><dd>${r.attachment_url ? `<button type="button" class="btn btn-ghost btn-sm" id="gdOpenAttachment"><i class="fas fa-paperclip"></i> Open attachment</button>` : "—"}</dd>
        <dt>Status</dt><dd>
          <select id="gdQuoteStatus" class="table-filter" aria-label="Change status" style="min-height:44px">
            ${GD_STATUSES.map(s => `<option value="${s}" ${s === r.status ? "selected" : ""}>${s.charAt(0).toUpperCase() + s.slice(1)}</option>`).join("")}
          </select>
          <span id="gdQuoteStatusNote" class="form-note" style="margin-left:8px"></span>
        </dd>
      </dl>
      <div class="gd-qr-actions">
        ${wa ? `<a class="btn btn-whatsapp btn-sm" target="_blank" rel="noopener" href="https://wa.me/${wa}?text=${encodeURIComponent(waMsg)}"><i class="fab fa-whatsapp"></i> Reply on WhatsApp</a>` : ""}
        <a class="btn btn-primary btn-sm" href="mailto:${escapeHTML(r.email)}?subject=${encodeURIComponent(mailSubject)}&body=${encodeURIComponent(mailBody)}"><i class="fas fa-envelope"></i> Reply by email</a>
        <button type="button" class="btn btn-ghost btn-sm" id="gdQuoteDeleteBtn"><i class="fas fa-trash"></i> Delete</button>
      </div>
    </div>`;

  gdById("gdQuoteStatus").addEventListener("change", async (e) => {
    const note = gdById("gdQuoteStatusNote");
    note.textContent = "Saving…";
    const { error } = await supabase.from("design_quote_requests").update({ status: e.target.value }).eq("id", id);
    if (error) { note.textContent = "Failed: " + error.message; return; }
    note.textContent = "Saved ✓";
    r.status = e.target.value;
    gdRenderQuotes();
    gdUpdateQuoteCounts();
  });
  gdById("gdQuoteDeleteBtn").addEventListener("click", () => gdDeleteQuote(id));
  gdById("gdOpenAttachment")?.addEventListener("click", async () => {
    const w = window.open("", "_blank");               // open synchronously so iOS/Safari doesn't block it
    const { data, error } = await supabase.storage.from("design-briefs").createSignedUrl(r.attachment_url, 3600);
    if (error || !data?.signedUrl) { w?.close(); alert("Couldn't open attachment: " + (error?.message || "unknown error")); return; }
    if (w) w.location.href = data.signedUrl; else window.location.href = data.signedUrl;
  });
  openModal("gdQuoteModal");
}

async function gdDeleteQuote(id) {
  const r = GD_QUOTES.find(x => x.id === id);
  if (!confirm(`Delete the request from ${r.name}? This can't be undone.`)) return;
  const { error } = await supabase.from("design_quote_requests").delete().eq("id", id);
  if (error) { alert(error.message); return; }
  if (r.attachment_url) await supabase.storage.from("design-briefs").remove([r.attachment_url]);
  closeModal("gdQuoteModal");
  await gdLoadQuotes();
}
