/* ==========================================================
   Contracts — admin dashboard generator + shareable links
   Uses the shared anon+session client from js/supabase-client.js.
   The public signing page (contract-sign.html) calls the RPC
   functions directly; it never touches the contracts table.
   ========================================================== */

const CONTRACT_WHATSAPP = "27760950954";

let CONTRACTS = [];
let TEMPLATES = [];
let editingContractId = null;
let contractBodyDirty = false;

document.addEventListener("DOMContentLoaded", async () => {
  const session = await requireAuth();
  if (!session) return;
  setupContractUI();
  await Promise.all([loadTemplates(), loadContracts()]);
});

/* ---------- LOAD ---------- */
async function loadTemplates() {
  const { data, error } = await supabase.from("contract_templates").select("*").order("created_at", { ascending: true });
  if (error) { console.error(error); return; }
  TEMPLATES = data || [];
  const sel = document.getElementById("contractTemplate");
  if (sel) {
    sel.innerHTML = TEMPLATES.length
      ? TEMPLATES.map(t => `<option value="${t.id}">${escapeHTML(t.name)}</option>`).join("")
      : `<option value="">No templates</option>`;
  }
}

async function loadContracts() {
  const tbody = document.getElementById("contractTableBody");
  if (tbody) tbody.innerHTML = `<tr><td colspan="6"><div class="empty-state"><i class="fas fa-spinner fa-spin"></i><p>Loading…</p></div></td></tr>`;
  const { data, error } = await supabase.from("contracts").select("*").order("created_at", { ascending: false });
  if (error) {
    console.error(error);
    if (tbody) tbody.innerHTML = `<tr><td colspan="6"><div class="empty-state"><i class="fas fa-triangle-exclamation"></i><p>Couldn't load contracts.</p></div></td></tr>`;
    return;
  }
  CONTRACTS = data || [];
  renderContracts();
}

function renderContracts() {
  const tbody = document.getElementById("contractTableBody");
  if (!tbody) return;
  const q = (document.getElementById("contractSearch")?.value || "").toLowerCase().trim();
  const f = document.getElementById("contractStatusFilter")?.value || "";
  const rows = CONTRACTS.filter(c => {
    const matchQ = !q || (c.client_name || "").toLowerCase().includes(q);
    const matchF = !f || c.status === f;
    return matchQ && matchF;
  });

  if (!CONTRACTS.length) {
    tbody.innerHTML = `<tr><td colspan="6"><div class="empty-state"><i class="fas fa-file-signature"></i><p>No contracts yet — create your first one.</p></div></td></tr>`;
    return;
  }
  if (!rows.length) {
    tbody.innerHTML = `<tr><td colspan="6"><div class="empty-state"><i class="fas fa-search"></i><p>No contracts match your filter.</p></div></td></tr>`;
    return;
  }

  tbody.innerHTML = rows.map(c => {
    const actions = [];
    actions.push(`<button class="icon-btn" title="View" onclick="viewContract('${c.id}')"><i class="fas fa-eye"></i></button>`);
    if (c.status === "draft") {
      actions.push(`<button class="icon-btn" title="Send" onclick="sendContract('${c.id}')"><i class="fas fa-paper-plane"></i></button>`);
    } else if (c.status === "sent" || c.status === "viewed") {
      actions.push(`<button class="icon-btn" title="Copy link" onclick="copyContractLinkById('${c.id}')"><i class="fas fa-link"></i></button>`);
    }
    if (c.status === "signed") {
      actions.push(`<button class="icon-btn" title="Download signed PDF" onclick="downloadContractPDF('${c.id}')"><i class="fas fa-file-pdf"></i></button>`);
    }
    if (c.status !== "signed") {
      actions.push(`<button class="icon-btn" title="Cancel" onclick="cancelContract('${c.id}')"><i class="fas fa-ban"></i></button>`);
    }
    return `<tr>
      <td><strong>${escapeHTML(c.client_name)}</strong></td>
      <td>${formatMoney(c.total_amount)}</td>
      <td>${formatMoney(c.deposit_amount)}</td>
      <td>${statusBadge(c.status)}</td>
      <td class="muted">${formatDate(c.created_at)}</td>
      <td style="text-align:right;white-space:nowrap">${actions.join("")}</td>
    </tr>`;
  }).join("");
}

/* ---------- UI WIRING ---------- */
function setupContractUI() {
  document.getElementById("addContractBtn")?.addEventListener("click", () => openContractModal(null));
  document.getElementById("closeContractModal")?.addEventListener("click", () => closeModal("contractModal"));
  document.getElementById("closeContractLink")?.addEventListener("click", () => closeModal("contractLinkModal"));
  document.getElementById("closeContractView")?.addEventListener("click", () => closeModal("contractViewModal"));
  document.getElementById("contractSearch")?.addEventListener("input", renderContracts);
  document.getElementById("contractStatusFilter")?.addEventListener("change", renderContracts);
  document.getElementById("contractForm")?.addEventListener("submit", (e) => saveContract(e, false));
  document.getElementById("contractSendBtn")?.addEventListener("click", (e) => saveContract(e, true));
  document.getElementById("contractTemplate")?.addEventListener("change", onTemplateChange);
  document.getElementById("copyContractLink")?.addEventListener("click", copyContractLinkFromInput);

  // live preview + deposit cross-calc
  const fields = ["client_name", "service_description", "total_amount"];
  fields.forEach(n => document.querySelector(`#contractForm [name="${n}"]`)?.addEventListener("input", regeneratePreviewIfClean));
  document.getElementById("contractBody")?.addEventListener("input", () => { contractBodyDirty = true; });
  document.getElementById("contractTotal")?.addEventListener("input", () => recalcDeposit("total"));
  document.getElementById("contractDepositPct")?.addEventListener("input", () => recalcDeposit("pct"));
  document.getElementById("contractDepositAmt")?.addEventListener("input", () => recalcDeposit("amt"));
}

/* ---------- DEPOSIT CALC ---------- */
function recalcDeposit(source) {
  const totalEl = document.getElementById("contractTotal");
  const pctEl = document.getElementById("contractDepositPct");
  const amtEl = document.getElementById("contractDepositAmt");
  let total = parseFloat(totalEl.value) || 0;
  let pct = parseFloat(pctEl.value) || 0;
  let amt = parseFloat(amtEl.value) || 0;
  if (source === "pct") {
    amt = total * (pct / 100);
    amtEl.value = round2(amt);
  } else if (source === "amt") {
    pct = total > 0 ? (amt / total) * 100 : 0;
    pctEl.value = round2(pct);
  } else if (source === "total") {
    amt = total * (pct / 100);
    amtEl.value = round2(amt);
  }
  regeneratePreviewIfClean();
}

/* ---------- PREVIEW ---------- */
function currentPreviewValues() {
  const form = document.getElementById("contractForm");
  const total = parseFloat(document.getElementById("contractTotal").value) || 0;
  const amt = parseFloat(document.getElementById("contractDepositAmt").value) || 0;
  const pct = parseFloat(document.getElementById("contractDepositPct").value) || 0;
  return {
    client_name: form.client_name.value.trim(),
    service_description: form.service_description.value.trim(),
    total_amount: formatMoney(total),
    deposit_amount: formatMoney(amt),
    deposit_percent: round2(pct),
  };
}

function renderPreviewText(values) {
  const tpl = TEMPLATES.find(t => t.id === document.getElementById("contractTemplate").value);
  let body = tpl ? tpl.body : "";
  Object.entries(values).forEach(([k, v]) => {
    body = body.replaceAll(`{{${k}}}`, v === "" ? `{{${k}}}` : v);
  });
  return body;
}

function regeneratePreviewIfClean() {
  if (contractBodyDirty) return;
  const ta = document.getElementById("contractBody");
  if (!ta) return;
  ta.value = renderPreviewText(currentPreviewValues());
}

function onTemplateChange() {
  const tpl = TEMPLATES.find(t => t.id === document.getElementById("contractTemplate").value);
  if (!tpl) return;
  document.getElementById("contractDepositPct").value = tpl.default_deposit_percent ?? 50;
  recalcDeposit("pct");
  contractBodyDirty = false;
  regeneratePreviewIfClean();
}

/* ---------- MODAL ---------- */
function openContractModal(id) {
  editingContractId = id;
  const form = document.getElementById("contractForm");
  form.reset();
  const errEl = document.getElementById("contractFormError"); if (errEl) errEl.style.display = "none";
  document.getElementById("contractModalTitle").textContent = id ? "Edit Contract" : "New Contract";

  if (id) {
    const c = CONTRACTS.find(x => x.id === id);
    if (!c) return;
    if (document.getElementById("contractTemplate")) document.getElementById("contractTemplate").value = c.template_id || "";
    form.client_name.value = c.client_name || "";
    form.client_email.value = c.client_email || "";
    form.client_phone.value = c.client_phone || "";
    form.service_description.value = c.service_description || "";
    document.getElementById("contractTotal").value = c.total_amount ?? 0;
    document.getElementById("contractDepositPct").value = c.deposit_percent ?? 50;
    document.getElementById("contractDepositAmt").value = c.deposit_amount ?? 0;
    document.getElementById("contractBody").value = c.contract_body || "";
    contractBodyDirty = true; // existing text is authoritative
  } else {
    if (TEMPLATES[0]) document.getElementById("contractTemplate").value = TEMPLATES[0].id;
    document.getElementById("contractDepositPct").value = TEMPLATES[0]?.default_deposit_percent ?? 50;
    recalcDeposit("pct");
    contractBodyDirty = false;
    regeneratePreviewIfClean();
  }
  openModal("contractModal");
}

function showContractError(msg) {
  const el = document.getElementById("contractFormError");
  if (!el) return;
  el.textContent = msg; el.style.display = "block";
}

async function saveContract(e, send) {
  e.preventDefault();
  const form = document.getElementById("contractForm");
  const errEl = document.getElementById("contractFormError"); if (errEl) errEl.style.display = "none";

  if (!form.client_name.value.trim()) return showContractError("Client name is required.");
  if (!form.service_description.value.trim()) return showContractError("Service description is required.");

  const payload = {
    template_id: document.getElementById("contractTemplate").value || null,
    client_name: form.client_name.value.trim(),
    client_email: form.client_email.value.trim() || null,
    client_phone: form.client_phone.value.trim() || null,
    service_description: form.service_description.value.trim(),
    total_amount: parseFloat(document.getElementById("contractTotal").value) || 0,
    deposit_amount: parseFloat(document.getElementById("contractDepositAmt").value) || 0,
    deposit_percent: parseFloat(document.getElementById("contractDepositPct").value) || 0,
    contract_body: document.getElementById("contractBody").value,
  };

  const btn = send ? document.getElementById("contractSendBtn") : form.querySelector('button[type="submit"]');
  btn.disabled = true; btn.innerHTML = '<span class="spinner"></span> Saving…';

  try {
    let rowId = editingContractId;
    if (editingContractId) {
      const { error } = await supabase.from("contracts").update(payload).eq("id", editingContractId);
      if (error) throw error;
    } else {
      const { data, error } = await supabase.from("contracts").insert(payload).select("id").single();
      if (error) throw error;
      rowId = data.id;
    }
    closeModal("contractModal");
    await loadContracts();
    if (send) await sendContract(rowId);
  } catch (err) {
    showContractError("Couldn't save contract: " + err.message);
  } finally {
    btn.disabled = false;
    btn.innerHTML = send ? '<i class="fas fa-paper-plane"></i> Save &amp; Send' : '<i class="fas fa-save"></i> Save Draft';
  }
}

async function sendContract(id) {
  const { error } = await supabase.from("contracts").update({ status: "sent" }).eq("id", id);
  if (error) { alert(error.message); return; }
  await loadContracts();
  const { data, err } = await supabase.from("contracts").select("token").eq("id", id).maybeSingle();
  if (err || !data) { alert("Saved, but couldn't fetch the link."); return; }
  showContractLink(data.token);
}

function showContractLink(token) {
  const base = location.origin + location.pathname.replace(/dashboard\.html$/, "contract-sign.html");
  const url = `${base}?token=${token}`;
  document.getElementById("contractLinkInput").value = url;
  const wa = `Hi ${""}, please review and sign your contract here: ${url}`;
  document.getElementById("contractWhatsappLink").href = `https://wa.me/${CONTRACT_WHATSAPP}?text=${encodeURIComponent(wa)}`;
  openModal("contractLinkModal");
}

function copyContractLinkFromInput() {
  const input = document.getElementById("contractLinkInput");
  input.select();
  const done = () => {
    const btn = document.getElementById("copyContractLink");
    const old = btn.innerHTML;
    btn.innerHTML = '<i class="fas fa-check"></i> Copied';
    setTimeout(() => (btn.innerHTML = old), 1600);
  };
  if (navigator.clipboard?.writeText) {
    navigator.clipboard.writeText(input.value).then(done).catch(() => { document.execCommand("copy"); done(); });
  } else {
    document.execCommand("copy"); done();
  }
}

async function copyContractLinkById(id) {
  const { data } = await supabase.from("contracts").select("token").eq("id", id).maybeSingle();
  if (!data) return;
  showContractLink(data.token);
}

async function cancelContract(id) {
  if (!confirm("Cancel this contract? It will no longer be signable.")) return;
  const { error } = await supabase.from("contracts").update({ status: "cancelled" }).eq("id", id);
  if (error) { alert(error.message); return; }
  await loadContracts();
}

/* ---------- VIEW (incl. signed details) ---------- */
async function viewContract(id) {
  const c = CONTRACTS.find(x => x.id === id);
  if (!c) return;
  // fetch full row to include signed fields
  const { data } = await supabase.from("contracts").select("*").eq("id", id).maybeSingle();
  const row = data || c;
  const body = document.getElementById("contractViewBody");
  const signedBlock = row.status === "signed" ? `
    <div class="signed-block">
      <h4 style="margin:18px 0 8px">Signed</h4>
      <p style="margin:0 0 6px"><strong>Name:</strong> ${escapeHTML(row.signed_name || "")}</p>
      <p style="margin:0 0 6px"><strong>Phone:</strong> ${escapeHTML(row.signed_phone || "—")}</p>
      <p class="muted" style="margin:0 0 10px">${formatDate(row.signed_at)} ${row.signed_at ? new Date(row.signed_at).toLocaleTimeString("en-ZA") : ""}</p>
      ${row.signed_signature_data ? `<img src="${row.signed_signature_data}" alt="Signature" class="sig-preview">` : ""}
      <div style="margin-top:14px"><button class="btn btn-primary btn-sm" onclick="downloadContractPDF('${row.id}')"><i class="fas fa-file-pdf"></i> Download Signed PDF</button></div>
    </div>` : "";

  body.innerHTML = `
    <div class="flex-between" style="margin-bottom:12px">
      <h3 style="margin:0">${escapeHTML(row.client_name)}</h3>
      ${statusBadge(row.status)}
    </div>
    <p class="muted" style="margin:0 0 12px">Created ${formatDate(row.created_at)}</p>
    <div class="contract-meta">
      <div><span class="muted">Service</span><br>${escapeHTML(row.service_description || "—")}</div>
      <div><span class="muted">Total</span><br>${formatMoney(row.total_amount)}</div>
      <div><span class="muted">Deposit</span><br>${formatMoney(row.deposit_amount)} (${row.deposit_percent}%)</div>
    </div>
    <h4 style="margin:18px 0 8px">Agreement</h4>
    <div class="contract-text">${escapeHTML(row.contract_body).replace(/\n/g, "<br>")}</div>
    ${signedBlock}
  `;
  openModal("contractViewModal");
}

/* ---------- SIGNED PDF ---------- */
async function downloadContractPDF(id) {
  const { data, error } = await supabase.from("contracts").select("*").eq("id", id).maybeSingle();
  if (error || !data) { alert("Couldn't load contract."); return; }
  const settings = await getBusinessSettings();
  await generateContractPDF(data, settings);
}

async function generateContractPDF(c, s) {
  if (!window.jspdf || !window.jspdf.jsPDF) { alert("PDF library not loaded."); return; }
  const { jsPDF } = window.jspdf;
  const doc = new jsPDF({ unit: "pt", format: "a4" });
  const pageW = doc.internal.pageSize.getWidth();
  const margin = 40;

  const info = await loadImageInfo(s.logo_url || "assets/lc-global-holdings-logo.jpg");
  let y = drawDocHeader(doc, s, "SERVICE AGREEMENT", ["Reference: " + formatDate(c.created_at)], info);

  // Client summary
  doc.setFont("helvetica", "bold"); doc.setFontSize(11); doc.setTextColor(20);
  doc.text(c.client_name || "", margin, y); y += 18;
  doc.setFont("helvetica", "normal"); doc.setFontSize(9); doc.setTextColor(110);
  doc.text(`Total Value: ${formatMoney(c.total_amount)}     Deposit: ${formatMoney(c.deposit_amount)} (${c.deposit_percent}%)`, margin, y);
  y += 24;

  // Agreement body — proper paragraph spacing, not a wall of text.
  doc.setFont("helvetica", "bold"); doc.setFontSize(11); doc.setTextColor(20);
  doc.text("Agreement", margin, y); y += 16;
  y = drawParagraphs(doc, c.contract_body || "", margin, y, pageW - margin * 2, 13, 6);

  // Signature block
  if (c.status === "signed") {
    y += 6;
    doc.setDrawColor(210); doc.setLineWidth(0.8);
    doc.line(margin, y, pageW - margin, y); y += 18;
    doc.setFont("helvetica", "bold"); doc.setFontSize(10.5); doc.setTextColor(20);
    doc.text("SIGNED", margin, y); y += 18;
    doc.setFont("helvetica", "normal"); doc.setFontSize(10);
    doc.text("Name: " + (c.signed_name || ""), margin, y); y += 15;
    doc.text("Phone: " + (c.signed_phone || "—"), margin, y); y += 15;
    doc.text("Date signed: " + formatDate(c.signed_at) + (c.signed_at ? " " + new Date(c.signed_at).toLocaleTimeString("en-ZA") : ""), margin, y); y += 20;
    if (c.signed_signature_data) {
      try {
        const props = doc.getImageProperties(c.signed_signature_data);
        const maxW = 220, ar = props.width / props.height;
        let sw = maxW, sh = sw / ar;
        if (sh > 70) { sh = 70; sw = sh * ar; }
        doc.addImage(c.signed_signature_data, "PNG", margin, y, sw, sh); y += sh + 16;
      } catch (e) {}
    }
  }

  // Payment details (so a client knows exactly where to pay).
  if (s.bank_account_number) {
    const bankLines = [
      s.bank_name && "Bank: " + s.bank_name,
      s.bank_account_holder && "Account holder: " + s.bank_account_holder,
      "Account no: " + s.bank_account_number,
      s.bank_account_type && "Account type: " + s.bank_account_type,
      s.bank_branch_name && "Branch: " + s.bank_branch_name,
      s.bank_branch_code && "Branch code: " + s.bank_branch_code,
      s.bank_swift_code && "Swift: " + s.bank_swift_code,
    ].filter(Boolean);
    const boxY = y + 16;
    const boxH = 22 + bankLines.length * 12 + 4;
    doc.setDrawColor(0, 102, 255); doc.setLineWidth(1);
    doc.roundedRect(margin, boxY, pageW - margin * 2, boxH, 6, 6);
    doc.setFont("helvetica", "bold"); doc.setFontSize(9); doc.setTextColor(0, 102, 255);
    doc.text("PLEASE MAKE PAYMENT TO", margin + 14, boxY + 16);
    doc.setFont("helvetica", "normal"); doc.setFontSize(9); doc.setTextColor(40);
    bankLines.forEach((ln, i) => doc.text(ln, margin + 14, boxY + 32 + i * 12));
    y = boxY + boxH + 16;
  }

  drawDocFooter(doc, s);
  doc.save(`contract-${String(c.client_name || "client").replace(/\s+/g, "-").toLowerCase()}.pdf`);
}

/* ---------- HELPERS (shared with invoices.js) ---------- */
function formatMoney(n) {
  const v = Number(n) || 0;
  return "R" + v.toLocaleString("en-ZA", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}
function formatDate(s) {
  if (!s) return "—";
  const d = new Date(s);
  if (isNaN(d.getTime())) return s;
  return d.toLocaleDateString("en-ZA", { day: "2-digit", month: "short", year: "numeric" });
}
function round2(n) { return Math.round((Number(n) || 0) * 100) / 100; }
function statusBadge(status) {
  const map = {
    draft: ["st-draft", "Draft"], sent: ["st-sent", "Sent"], paid: ["st-paid", "Paid"],
    overdue: ["st-overdue", "Overdue"], cancelled: ["st-cancelled", "Cancelled"],
    viewed: ["st-viewed", "Viewed"], signed: ["st-signed", "Signed"],
  };
  const [cls, label] = map[status] || ["st-draft", status];
  return `<span class="status-badge ${cls}">${label}</span>`;
}
