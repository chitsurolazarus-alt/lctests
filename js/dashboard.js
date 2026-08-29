/* ==========================================================
   Admin Dashboard — overview stats, portfolio CRUD, reviews
   CRUD, messages inbox, image uploads to Supabase Storage.
   ========================================================== */

let PORTFOLIOS = [];
let REVIEWS = [];
let MESSAGES = [];
let editingPortfolioId = null;
let editingReviewId = null;
let currentRating = 5;
let pendingLogoFile = null;
let pendingPhotoFile = null;

document.addEventListener("DOMContentLoaded", async () => {
  const session = await requireAuth();
  if (!session) return;

  setupMobileDrawer();
  setupTabs();
  setupPortfolioModal();
  setupReviewModal();
  await refreshAll();
});

async function refreshAll(){
  await Promise.all([loadPortfolios(), loadReviews(), loadMessages()]);
  renderOverview();
}

/* ---------- MOBILE NAV DRAWER ---------- */
function setupMobileDrawer(){
  const shell = document.getElementById("dashShell");
  const menuBtn = document.getElementById("dashMenuBtn");
  const overlay = document.getElementById("dashOverlay");
  if (!shell || !menuBtn) return;
  const close = () => shell.classList.remove("dash-nav-open");
  menuBtn.addEventListener("click", () => shell.classList.toggle("dash-nav-open"));
  overlay?.addEventListener("click", close);
  // Close the drawer after picking a tab on mobile so the panel is visible.
  document.querySelectorAll("[data-tab-target]").forEach(link => link.addEventListener("click", close));
}

/* ---------- TABS ---------- */
function setupTabs(){
  document.querySelectorAll("[data-tab-target]").forEach(link => {
    link.addEventListener("click", (e) => {
      e.preventDefault();
      const target = link.getAttribute("data-tab-target");
      document.querySelectorAll("[data-tab-target]").forEach(l => l.classList.remove("active"));
      link.classList.add("active");
      document.querySelectorAll("[data-tab-panel]").forEach(p => {
        p.style.display = p.getAttribute("data-tab-panel") === target ? "block" : "none";
      });
    });
  });
  document.querySelectorAll("[data-goto-tab]").forEach(btn => {
    btn.addEventListener("click", () => document.querySelector(`[data-tab-target="${btn.getAttribute("data-goto-tab")}"]`)?.click());
  });
}

/* ---------- OVERVIEW ---------- */
function renderOverview(){
  const set = (id, val) => { const el = document.getElementById(id); if (el) el.textContent = val; };
  set("kpiProjects", PORTFOLIOS.length);
  set("kpiReviews", REVIEWS.filter(r => r.approved).length);
  set("kpiPendingReviews", REVIEWS.filter(r => !r.approved).length);
  set("kpiMessages", MESSAGES.filter(m => !m.read).length);

  const feed = document.getElementById("activityFeed");
  if (!feed) return;
  const activity = [
    ...PORTFOLIOS.slice(0, 5).map(p => ({ text: `Project "${p.title}" added to portfolio`, date: p.created_at })),
    ...REVIEWS.slice(0, 5).map(r => ({ text: `Review from ${r.name} ${r.approved ? "(published)" : "(awaiting approval)"}`, date: r.created_at })),
    ...MESSAGES.slice(0, 5).map(m => ({ text: `New enquiry from ${m.name}`, date: m.created_at })),
  ].sort((a, b) => new Date(b.date) - new Date(a.date)).slice(0, 8);

  feed.innerHTML = activity.length ? activity.map(a => `
    <div style="display:flex;justify-content:space-between;padding:12px 0;border-bottom:1px solid var(--line);font-size:.88rem">
      <span>${escapeHTML(a.text)}</span>
      <span style="color:var(--text-lo)">${timeAgo(a.date)}</span>
    </div>`).join("") : `<p style="color:var(--text-lo);font-size:.9rem">No activity yet.</p>`;
}

/* ============================================================
   PORTFOLIO CRUD
   ============================================================ */
async function loadPortfolios(){
  const { data, error } = await supabase.from("portfolios").select("*").order("sort_order", { ascending: true });
  if (error) { console.error(error); return; }
  PORTFOLIOS = data || [];
  renderPortfolioTable();
}

function renderPortfolioTable(){
  const tbody = document.getElementById("portfolioTableBody");
  if (!tbody) return;
  if (!PORTFOLIOS.length) {
    tbody.innerHTML = `<tr><td colspan="6"><div class="empty-state"><i class="fas fa-briefcase"></i><p>No projects yet — add your first one.</p></div></td></tr>`;
    return;
  }
  tbody.innerHTML = PORTFOLIOS.map((p, i) => `
    <tr>
      <td>${p.logo_url ? `<img src="${p.logo_url}" class="row-thumb">` : `<div class="row-thumb"></div>`}</td>
      <td><strong>${escapeHTML(p.title)}</strong><br><span style="color:var(--text-lo);font-size:.78rem">${escapeHTML(p.client || "—")}</span></td>
      <td>${formatCategory(p.category)}</td>
      <td>${p.featured ? '<span class="badge on">Featured</span>' : '<span class="badge off">Standard</span>'}</td>
      <td>
        <button class="icon-btn" title="Move up" onclick="reorderPortfolio('${p.id}', -1)" ${i === 0 ? "disabled" : ""}><i class="fas fa-arrow-up"></i></button>
        <button class="icon-btn" title="Move down" onclick="reorderPortfolio('${p.id}', 1)" ${i === PORTFOLIOS.length - 1 ? "disabled" : ""}><i class="fas fa-arrow-down"></i></button>
      </td>
      <td style="white-space:nowrap">
        <button class="icon-btn" title="Edit" onclick="openPortfolioModal('${p.id}')"><i class="fas fa-pen"></i></button>
        <button class="icon-btn" title="Delete" onclick="deletePortfolio('${p.id}')"><i class="fas fa-trash"></i></button>
      </td>
    </tr>`).join("");
}

async function reorderPortfolio(id, dir){
  const idx = PORTFOLIOS.findIndex(p => p.id === id);
  const swapIdx = idx + dir;
  if (swapIdx < 0 || swapIdx >= PORTFOLIOS.length) return;
  const a = PORTFOLIOS[idx], b = PORTFOLIOS[swapIdx];
  const aOrder = a.sort_order ?? idx, bOrder = b.sort_order ?? swapIdx;
  await supabase.from("portfolios").update({ sort_order: bOrder }).eq("id", a.id);
  await supabase.from("portfolios").update({ sort_order: aOrder }).eq("id", b.id);
  await loadPortfolios();
}

function setupPortfolioModal(){
  const addBtn = document.getElementById("addPortfolioBtn");
  addBtn?.addEventListener("click", () => openPortfolioModal(null));

  document.getElementById("portfolioLogoInput")?.addEventListener("change", (e) => {
    pendingLogoFile = e.target.files[0] || null;
    if (pendingLogoFile) {
      const preview = document.getElementById("portfolioLogoPreview");
      preview.src = URL.createObjectURL(pendingLogoFile);
      preview.style.display = "block";
    }
  });

  document.getElementById("portfolioForm")?.addEventListener("submit", savePortfolio);
  document.getElementById("closePortfolioModal")?.addEventListener("click", () => closeModal("portfolioModal"));
}

function openPortfolioModal(id){
  editingPortfolioId = id;
  pendingLogoFile = null;
  const form = document.getElementById("portfolioForm");
  form.reset();
  document.getElementById("portfolioLogoPreview").style.display = "none";
  document.getElementById("portfolioModalTitle").textContent = id ? "Edit Project" : "Add Project";

  if (id) {
    const p = PORTFOLIOS.find(x => x.id === id);
    form.title.value = p.title;
    form.description.value = p.description;
    form.client.value = p.client || "";
    form.category.value = p.category;
    form.project_url.value = p.project_url || "";
    form.completion_date.value = p.completion_date || "";
    form.technologies.value = (p.technologies || []).join(", ");
    form.featured.checked = !!p.featured;
    if (p.logo_url) {
      const preview = document.getElementById("portfolioLogoPreview");
      preview.src = p.logo_url; preview.style.display = "block";
    }
  }
  openModal("portfolioModal");
}

async function savePortfolio(e){
  e.preventDefault();
  const form = e.target;
  const btn = form.querySelector('button[type="submit"]');
  btn.disabled = true; btn.innerHTML = '<span class="spinner"></span> Saving...';

  try {
    let logo_url = editingPortfolioId ? PORTFOLIOS.find(p => p.id === editingPortfolioId)?.logo_url : null;
    if (pendingLogoFile) {
      logo_url = await uploadFile("portfolio-logos", pendingLogoFile);
    }
    const payload = {
      title: form.title.value.trim(),
      description: form.description.value.trim(),
      client: form.client.value.trim(),
      category: form.category.value,
      project_url: form.project_url.value.trim(),
      completion_date: form.completion_date.value || null,
      technologies: form.technologies.value.split(",").map(t => t.trim()).filter(Boolean),
      featured: form.featured.checked,
      logo_url,
    };

    if (editingPortfolioId) {
      const { error } = await supabase.from("portfolios").update(payload).eq("id", editingPortfolioId);
      if (error) throw error;
    } else {
      payload.sort_order = PORTFOLIOS.length;
      const { error } = await supabase.from("portfolios").insert(payload);
      if (error) throw error;
    }
    closeModal("portfolioModal");
    await loadPortfolios();
    renderOverview();
  } catch (err) {
    alert("Couldn't save project: " + err.message);
  } finally {
    btn.disabled = false; btn.innerHTML = "Save Project";
  }
}

async function deletePortfolio(id){
  if (!confirm("Delete this project? This can't be undone.")) return;
  const { error } = await supabase.from("portfolios").delete().eq("id", id);
  if (error) { alert(error.message); return; }
  await loadPortfolios();
  renderOverview();
}

/* ============================================================
   REVIEWS CRUD
   ============================================================ */
async function loadReviews(){
  const { data, error } = await supabase.from("reviews").select("*").order("created_at", { ascending: false });
  if (error) { console.error(error); return; }
  REVIEWS = data || [];
  renderReviewTable();
}

function renderReviewTable(){
  const tbody = document.getElementById("reviewTableBody");
  if (!tbody) return;
  if (!REVIEWS.length) {
    tbody.innerHTML = `<tr><td colspan="5"><div class="empty-state"><i class="fas fa-comment-dots"></i><p>No reviews yet — add your first one.</p></div></td></tr>`;
    return;
  }
  tbody.innerHTML = REVIEWS.map(r => `
    <tr>
      <td>${r.photo_url ? `<img src="${r.photo_url}" class="row-thumb" style="border-radius:50%">` : `<div class="row-thumb" style="border-radius:50%"></div>`}</td>
      <td><strong>${escapeHTML(r.name)}</strong><br><span style="color:var(--text-lo);font-size:.78rem">${escapeHTML(r.company || "—")}</span></td>
      <td>${'<i class="fas fa-star" style="color:var(--amber)"></i>'.repeat(r.rating)}</td>
      <td>${r.approved ? '<span class="badge on">Published</span>' : '<span class="badge off">Pending</span>'}</td>
      <td style="white-space:nowrap">
        <button class="icon-btn" title="${r.approved ? "Hide" : "Approve"}" onclick="toggleReviewApproval('${r.id}', ${!r.approved})"><i class="fas ${r.approved ? "fa-eye-slash" : "fa-check"}"></i></button>
        <button class="icon-btn" title="Edit" onclick="openReviewModal('${r.id}')"><i class="fas fa-pen"></i></button>
        <button class="icon-btn" title="Delete" onclick="deleteReview('${r.id}')"><i class="fas fa-trash"></i></button>
      </td>
    </tr>`).join("");
}

async function toggleReviewApproval(id, approved){
  const { error } = await supabase.from("reviews").update({ approved }).eq("id", id);
  if (error) { alert(error.message); return; }
  await loadReviews();
  renderOverview();
}

function setupReviewModal(){
  document.getElementById("addReviewBtn")?.addEventListener("click", () => openReviewModal(null));

  document.getElementById("reviewPhotoInput")?.addEventListener("change", (e) => {
    pendingPhotoFile = e.target.files[0] || null;
    if (pendingPhotoFile) {
      const preview = document.getElementById("reviewPhotoPreview");
      preview.src = URL.createObjectURL(pendingPhotoFile);
      preview.style.display = "block";
    }
  });

  document.querySelectorAll("#starInput i").forEach(star => {
    star.addEventListener("click", () => {
      currentRating = parseInt(star.getAttribute("data-star"));
      paintStars();
    });
  });

  document.getElementById("reviewForm")?.addEventListener("submit", saveReview);
  document.getElementById("closeReviewModal")?.addEventListener("click", () => closeModal("reviewModal"));
}

function paintStars(){
  document.querySelectorAll("#starInput i").forEach(star => {
    star.classList.toggle("active", parseInt(star.getAttribute("data-star")) <= currentRating);
  });
}

function openReviewModal(id){
  editingReviewId = id;
  pendingPhotoFile = null;
  const form = document.getElementById("reviewForm");
  form.reset();
  document.getElementById("reviewPhotoPreview").style.display = "none";
  document.getElementById("reviewModalTitle").textContent = id ? "Edit Review" : "Add Review";
  currentRating = 5;

  if (id) {
    const r = REVIEWS.find(x => x.id === id);
    form.name.value = r.name;
    form.company.value = r.company || "";
    form.review_text.value = r.review_text;
    form.approved.checked = !!r.approved;
    currentRating = r.rating;
    if (r.photo_url) {
      const preview = document.getElementById("reviewPhotoPreview");
      preview.src = r.photo_url; preview.style.display = "block";
    }
  }
  paintStars();
  openModal("reviewModal");
}

async function saveReview(e){
  e.preventDefault();
  const form = e.target;
  const btn = form.querySelector('button[type="submit"]');
  btn.disabled = true; btn.innerHTML = '<span class="spinner"></span> Saving...';

  try {
    let photo_url = editingReviewId ? REVIEWS.find(r => r.id === editingReviewId)?.photo_url : null;
    if (pendingPhotoFile) {
      photo_url = await uploadFile("review-photos", pendingPhotoFile);
    }
    const payload = {
      name: form.name.value.trim(),
      company: form.company.value.trim(),
      review_text: form.review_text.value.trim(),
      rating: currentRating,
      approved: form.approved.checked,
      photo_url,
    };

    if (editingReviewId) {
      const { error } = await supabase.from("reviews").update(payload).eq("id", editingReviewId);
      if (error) throw error;
    } else {
      const { error } = await supabase.from("reviews").insert(payload);
      if (error) throw error;
    }
    closeModal("reviewModal");
    await loadReviews();
    renderOverview();
  } catch (err) {
    alert("Couldn't save review: " + err.message);
  } finally {
    btn.disabled = false; btn.innerHTML = "Save Review";
  }
}

async function deleteReview(id){
  if (!confirm("Delete this review?")) return;
  const { error } = await supabase.from("reviews").delete().eq("id", id);
  if (error) { alert(error.message); return; }
  await loadReviews();
  renderOverview();
}

/* ============================================================
   MESSAGES (contact form inbox)
   ============================================================ */
async function loadMessages(){
  const { data, error } = await supabase.from("messages").select("*").order("created_at", { ascending: false });
  if (error) { console.error(error); return; }
  MESSAGES = data || [];
  renderMessagesTable();
}

function renderMessagesTable(){
  const tbody = document.getElementById("messagesTableBody");
  if (!tbody) return;
  if (!MESSAGES.length) {
    tbody.innerHTML = `<tr><td colspan="5"><div class="empty-state"><i class="fas fa-envelope"></i><p>No enquiries yet.</p></div></td></tr>`;
    return;
  }
  tbody.innerHTML = MESSAGES.map(m => `
    <tr style="${m.read ? "" : "font-weight:600"}">
      <td>${escapeHTML(m.name)}<br><span style="color:var(--text-lo);font-size:.78rem;font-weight:400">${escapeHTML(m.email)}</span></td>
      <td>${escapeHTML(m.service || "—")}</td>
      <td style="max-width:280px;font-weight:400">${escapeHTML(m.message).slice(0, 90)}${m.message.length > 90 ? "…" : ""}</td>
      <td style="font-weight:400;color:var(--text-lo)">${timeAgo(m.created_at)}</td>
      <td style="white-space:nowrap">
        <button class="icon-btn" title="${m.read ? "Mark unread" : "Mark read"}" onclick="toggleMessageRead('${m.id}', ${!m.read})"><i class="fas ${m.read ? "fa-envelope" : "fa-envelope-open"}"></i></button>
        <button class="icon-btn" title="Delete" onclick="deleteMessage('${m.id}')"><i class="fas fa-trash"></i></button>
      </td>
    </tr>`).join("");
}

async function toggleMessageRead(id, read){
  await supabase.from("messages").update({ read }).eq("id", id);
  await loadMessages();
  renderOverview();
}
async function deleteMessage(id){
  if (!confirm("Delete this message?")) return;
  await supabase.from("messages").delete().eq("id", id);
  await loadMessages();
  renderOverview();
}

/* ============================================================
   HELPERS
   ============================================================ */
async function uploadFile(bucket, file){
  const ext = file.name.split(".").pop();
  const path = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
  const { error } = await supabase.storage.from(bucket).upload(path, file);
  if (error) throw error;
  const { data } = supabase.storage.from(bucket).getPublicUrl(path);
  return data.publicUrl;
}

function openModal(id){ document.getElementById(id)?.classList.add("open"); }
function closeModal(id){ document.getElementById(id)?.classList.remove("open"); }

function formatCategory(cat){
  const map = { "web-development":"Web Development","software-development":"Software Development","hosting":"Hosting","graphic-design":"Graphic Design","seo-marketing":"SEO & Marketing","ai-automation":"AI & Automation" };
  return map[cat] || cat;
}
function timeAgo(dateStr){
  const diff = (Date.now() - new Date(dateStr).getTime()) / 1000;
  if (diff < 60) return "just now";
  if (diff < 3600) return Math.floor(diff / 60) + "m ago";
  if (diff < 86400) return Math.floor(diff / 3600) + "h ago";
  return Math.floor(diff / 86400) + "d ago";
}
function escapeHTML(str){
  if (str === null || str === undefined) return "";
  return String(str).replace(/[&<>"']/g, m => ({ "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;" }[m]));
}
