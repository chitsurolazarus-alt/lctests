/* ==========================================================
   Invoices — admin dashboard generator (list, modal, PDF)
   Uses the shared anon+session client from js/supabase-client.js.
   ========================================================== */

let INVOICES = [];
let editingInvoiceId = null;
let BUSINESS = null;

document.addEventListener("DOMContentLoaded", async () => {
  const session = await requireAuth();
  if (!session) return;
  setupInvoiceUI();
  await loadInvoices();
});

/* ---------- LOAD ---------- */
async function getBusinessSettings() {
  if (BUSINESS) return BUSINESS;
  const { data } = await supabase.from("business_settings").select("*").eq("id", 1).maybeSingle();
  BUSINESS = data || {};
  return BUSINESS;
}

async function loadInvoices() {
  const tbody = document.getElementById("invoiceTableBody");
  if (tbody) tbody.innerHTML = `<tr><td colspan="6"><div class="empty-state"><i class="fas fa-spinner fa-spin"></i><p>Loading…</p></div></td></tr>`;
  const { data, error } = await supabase.from("invoices").select("*").order("created_at", { ascending: false });
  if (error) {
    console.error(error);
    if (tbody) tbody.innerHTML = `<tr><td colspan="6"><div class="empty-state"><i class="fas fa-triangle-exclamation"></i><p>Couldn't load invoices.</p></div></td></tr>`;
    return;
  }
  INVOICES = data || [];
  renderInvoices();
  updateFinanceKPIs();
}

function renderInvoices() {
  const tbody = document.getElementById("invoiceTableBody");
  if (!tbody) return;
  const q = (document.getElementById("invoiceSearch")?.value || "").toLowerCase().trim();
  const f = document.getElementById("invoiceStatusFilter")?.value || "";
  const rows = INVOICES.filter(inv => {
    const matchQ = !q || (inv.client_name || "").toLowerCase().includes(q);
    const matchF = !f || inv.status === f;
    return matchQ && matchF;
  });

  if (!INVOICES.length) {
    tbody.innerHTML = `<tr><td colspan="6"><div class="empty-state"><i class="fas fa-file-invoice"></i><p>No invoices yet — create your first one.</p></div></td></tr>`;
    return;
  }
  if (!rows.length) {
    tbody.innerHTML = `<tr><td colspan="6"><div class="empty-state"><i class="fas fa-search"></i><p>No invoices match your filter.</p></div></td></tr>`;
    return;
  }
  tbody.innerHTML = rows.map(inv => `
    <tr>
      <td><strong>${escapeHTML(inv.invoice_number)}</strong></td>
      <td>${escapeHTML(inv.client_name)}${inv.client_company ? `<br><span class="muted" style="font-size:.78rem">${escapeHTML(inv.client_company)}</span>` : ""}</td>
      <td>${formatMoney(inv.total)}</td>
      <td>${statusBadge(inv.status)}</td>
      <td class="muted">${formatDate(inv.issue_date)}</td>
      <td style="text-align:right;white-space:nowrap">
        <button class="icon-btn" title="View" onclick="viewInvoice('${inv.id}')"><i class="fas fa-eye"></i></button>
        <button class="icon-btn" title="Edit" onclick="openInvoiceModal('${inv.id}')"><i class="fas fa-pen"></i></button>
        <button class="icon-btn" title="Download PDF" onclick="downloadInvoicePDF('${inv.id}')"><i class="fas fa-file-pdf"></i></button>
        ${inv.status !== 'paid' && inv.status !== 'cancelled' ? `<button class="icon-btn" title="Mark as Paid" onclick="markInvoicePaid('${inv.id}')"><i class="fas fa-check"></i></button>` : ""}
        <button class="icon-btn" title="Delete" onclick="deleteInvoice('${inv.id}')"><i class="fas fa-trash"></i></button>
      </td>
    </tr>`).join("");
}

function updateFinanceKPIs() {
  const outEl = document.getElementById("kpiOutstanding");
  const paidEl = document.getElementById("kpiPaidMonth");
  if (!outEl || !paidEl) return;
  const now = new Date(), y = now.getFullYear(), m = now.getMonth();
  let outstanding = 0, paidMonth = 0;
  INVOICES.forEach(inv => {
    if (inv.status === 'sent' || inv.status === 'overdue') outstanding += Number(inv.total) || 0;
    if (inv.status === 'paid') {
      const d = new Date(inv.updated_at || inv.created_at);
      if (d.getFullYear() === y && d.getMonth() === m) paidMonth += Number(inv.total) || 0;
    }
  });
  outEl.textContent = formatMoney(outstanding);
  paidEl.textContent = formatMoney(paidMonth);
}

/* ---------- UI WIRING ---------- */
function setupInvoiceUI() {
  document.getElementById("addInvoiceBtn")?.addEventListener("click", () => openInvoiceModal(null));
  document.getElementById("addInvoiceItemBtn")?.addEventListener("click", () => addInvoiceItemRow());
  document.getElementById("closeInvoiceModal")?.addEventListener("click", () => closeModal("invoiceModal"));
  document.getElementById("closeInvoiceView")?.addEventListener("click", () => closeModal("invoiceViewModal"));
  document.getElementById("invoiceSearch")?.addEventListener("input", renderInvoices);
  document.getElementById("invoiceStatusFilter")?.addEventListener("change", renderInvoices);
  document.getElementById("invoiceForm")?.addEventListener("submit", saveInvoice);
  document.getElementById("invVatPercent")?.addEventListener("input", recalculateInvoiceTotals);
  document.getElementById("invDiscount")?.addEventListener("input", recalculateInvoiceTotals);
}

/* ---------- LINE ITEMS ---------- */
function addInvoiceItemRow(item) {
  item = item || { description: "", quantity: 1, unit_price: 0 };
  const wrap = document.getElementById("invoiceItems");
  const row = document.createElement("div");
  row.className = "inv-item";
  row.innerHTML = `
    <input type="text" class="inv-desc" placeholder="Description" value="${escapeHTML(item.description || "")}" required>
    <input type="number" class="inv-qty" value="${item.quantity ?? 1}" min="0" step="1" placeholder="Qty" aria-label="Quantity">
    <input type="number" class="inv-price" value="${item.unit_price ?? 0}" min="0" step="0.01" placeholder="Unit price" aria-label="Unit price">
    <span class="inv-line-total">R0.00</span>
    <button type="button" class="inv-item-remove" title="Remove line"><i class="fas fa-trash"></i></button>`;
  row.querySelectorAll("input").forEach(inp => inp.addEventListener("input", recalculateInvoiceTotals));
  row.querySelector(".inv-item-remove").addEventListener("click", () => { row.remove(); recalculateInvoiceTotals(); });
  wrap.appendChild(row);
  recalculateInvoiceTotals();
}

function recalculateInvoiceTotals() {
  let subtotal = 0;
  document.querySelectorAll("#invoiceItems .inv-item").forEach(row => {
    const qty = parseFloat(row.querySelector(".inv-qty").value) || 0;
    const price = parseFloat(row.querySelector(".inv-price").value) || 0;
    const line = qty * price;
    subtotal += line;
    row.querySelector(".inv-line-total").textContent = formatMoney(line);
  });
  const vatPct = parseFloat(document.getElementById("invVatPercent")?.value) || 0;
  const discount = parseFloat(document.getElementById("invDiscount")?.value) || 0;
  const vat = subtotal * (vatPct / 100);
  const total = Math.max(0, subtotal + vat - discount);
  const pct = document.getElementById("invVatPctLabel"); if (pct) pct.textContent = vatPct;
  const sub = document.getElementById("invSubtotal"); if (sub) sub.textContent = formatMoney(subtotal);
  const va = document.getElementById("invVatAmount"); if (va) va.textContent = formatMoney(vat);
  const dl = document.getElementById("invDiscountLabel"); if (dl) dl.textContent = "−" + formatMoney(discount);
  const tot = document.getElementById("invTotal"); if (tot) tot.textContent = formatMoney(total);
  return { subtotal, vatPct, vat, discount, total };
}

/* ---------- MODAL ---------- */
function openInvoiceModal(id) {
  editingInvoiceId = id;
  const form = document.getElementById("invoiceForm");
  form.reset();
  document.getElementById("invoiceItems").innerHTML = "";
  const errEl = document.getElementById("invoiceFormError"); if (errEl) errEl.style.display = "none";
  document.getElementById("invVatPercent").value = 15;
  document.getElementById("invDiscount").value = 0;
  form.issue_date.value = todayISO();
  document.getElementById("invoiceModalTitle").textContent = id ? "Edit Invoice" : "New Invoice";

  if (id) {
    const inv = INVOICES.find(x => x.id === id);
    if (!inv) return;
    form.client_name.value = inv.client_name || "";
    form.client_email.value = inv.client_email || "";
    form.client_phone.value = inv.client_phone || "";
    form.client_company.value = inv.client_company || "";
    form.client_address.value = inv.client_address || "";
    form.issue_date.value = inv.issue_date || todayISO();
    form.due_date.value = inv.due_date || "";
    form.notes.value = inv.notes || "";
    form.status.value = inv.status || "draft";
    (inv.items || []).forEach(it => addInvoiceItemRow(it));
    document.getElementById("invVatPercent").value = inv.vat_percent ?? 15;
    document.getElementById("invDiscount").value = inv.discount ?? 0;
  } else {
    addInvoiceItemRow();
  }
  recalculateInvoiceTotals();
  openModal("invoiceModal");
}

function showInvoiceError(msg) {
  const el = document.getElementById("invoiceFormError");
  if (!el) return;
  el.textContent = msg; el.style.display = "block";
}

async function saveInvoice(e) {
  e.preventDefault();
  const form = e.target;
  const errEl = document.getElementById("invoiceFormError"); if (errEl) errEl.style.display = "none";

  if (!form.client_name.value.trim()) return showInvoiceError("Client name is required.");

  const items = [];
  document.querySelectorAll("#invoiceItems .inv-item").forEach(row => {
    items.push({
      description: row.querySelector(".inv-desc").value.trim(),
      quantity: parseFloat(row.querySelector(".inv-qty").value) || 0,
      unit_price: parseFloat(row.querySelector(".inv-price").value) || 0,
    });
  });
  if (!items.length || items.every(it => !it.description && it.quantity === 0 && it.unit_price === 0)) {
    return showInvoiceError("Add at least one line item with a description.");
  }

  const { subtotal, vatPct, vat, discount, total } = recalculateInvoiceTotals();
  const btn = form.querySelector('button[type="submit"]');
  btn.disabled = true; btn.innerHTML = '<span class="spinner"></span> Saving…';

  try {
    const isEdit = !!editingInvoiceId;
    const invoice_number = isEdit
      ? INVOICES.find(x => x.id === editingInvoiceId).invoice_number
      : await nextInvoiceNumber();
    const payload = {
      invoice_number,
      client_name: form.client_name.value.trim(),
      client_email: form.client_email.value.trim() || null,
      client_phone: form.client_phone.value.trim() || null,
      client_company: form.client_company.value.trim() || null,
      client_address: form.client_address.value.trim() || null,
      issue_date: form.issue_date.value || todayISO(),
      due_date: form.due_date.value || null,
      items,
      subtotal: round2(subtotal),
      vat_percent: round2(vatPct),
      vat_amount: round2(vat),
      discount: round2(discount),
      total: round2(total),
      notes: form.notes.value.trim() || null,
      status: form.status.value,
    };
    if (isEdit) {
      const { error } = await supabase.from("invoices").update(payload).eq("id", editingInvoiceId);
      if (error) throw error;
    } else {
      const { error } = await supabase.from("invoices").insert(payload);
      if (error) throw error;
    }
    closeModal("invoiceModal");
    await loadInvoices();
  } catch (err) {
    showInvoiceError("Couldn't save invoice: " + err.message);
  } finally {
    btn.disabled = false; btn.innerHTML = "Save Invoice";
  }
}

async function nextInvoiceNumber() {
  const settings = await getBusinessSettings();
  const prefix = (settings.invoice_prefix || "INV").trim();
  const year = new Date().getFullYear();
  const { data } = await supabase.from("invoices").select("invoice_number")
    .ilike("invoice_number", `${prefix}-${year}-%`);
  let max = 0;
  (data || []).forEach(r => {
    const m = String(r.invoice_number).match(new RegExp(`^${escapeRegex(prefix)}-${year}-(\\d+)$`));
    if (m) max = Math.max(max, parseInt(m[1], 10));
  });
  return `${prefix}-${year}-${String(max + 1).padStart(4, "0")}`;
}

/* ---------- ACTIONS ---------- */
async function markInvoicePaid(id) {
  if (!confirm("Mark this invoice as paid?")) return;
  const { error } = await supabase.from("invoices").update({ status: "paid" }).eq("id", id);
  if (error) { alert(error.message); return; }
  await loadInvoices();
}

async function deleteInvoice(id) {
  if (!confirm("Delete this invoice? This can't be undone.")) return;
  const { error } = await supabase.from("invoices").delete().eq("id", id);
  if (error) { alert(error.message); return; }
  await loadInvoices();
}

async function viewInvoice(id) {
  const inv = INVOICES.find(x => x.id === id);
  if (!inv) return;
  const body = document.getElementById("invoiceViewBody");
  body.innerHTML = `
    <div class="flex-between" style="margin-bottom:14px">
      <div>
        <h3 style="margin:0">${escapeHTML(inv.invoice_number)}</h3>
        <span class="muted">${formatDate(inv.issue_date)}${inv.due_date ? ` · Due ${formatDate(inv.due_date)}` : ""}</span>
      </div>
      ${statusBadge(inv.status)}
    </div>
    <p style="margin:0 0 6px"><strong>${escapeHTML(inv.client_name)}</strong></p>
    ${inv.client_company ? `<p class="muted" style="margin:0 0 4px">${escapeHTML(inv.client_company)}</p>` : ""}
    ${inv.client_email ? `<p class="muted" style="margin:0 0 4px">${escapeHTML(inv.client_email)}</p>` : ""}
    ${inv.client_phone ? `<p class="muted" style="margin:0 0 4px">${escapeHTML(inv.client_phone)}</p>` : ""}
    ${inv.client_address ? `<p class="muted" style="margin:0 0 14px;white-space:pre-wrap">${escapeHTML(inv.client_address)}</p>` : ""}
    <div class="table-scroll"><table class="data-table">
      <thead><tr><th>Description</th><th>Qty</th><th>Unit</th><th>Total</th></tr></thead>
      <tbody>
        ${(inv.items || []).map(it => `<tr><td>${escapeHTML(it.description || "")}</td><td>${it.quantity}</td><td>${formatMoney(it.unit_price)}</td><td>${formatMoney((it.quantity || 0) * (it.unit_price || 0))}</td></tr>`).join("") || `<tr><td colspan="4" class="muted">No items</td></tr>`}
      </tbody>
    </table></div>
    <div class="invoice-totals" style="max-width:320px;margin-left:auto">
      <div class="tot-row"><span>Subtotal</span><span>${formatMoney(inv.subtotal)}</span></div>
      <div class="tot-row"><span>VAT (${inv.vat_percent}%)</span><span>${formatMoney(inv.vat_amount)}</span></div>
      <div class="tot-row"><span>Discount</span><span>−${formatMoney(inv.discount)}</span></div>
      <div class="tot-row tot-grand"><span>Total</span><span>${formatMoney(inv.total)}</span></div>
    </div>
    ${inv.notes ? `<p class="muted" style="margin-top:14px;white-space:pre-wrap">${escapeHTML(inv.notes)}</p>` : ""}
    <div style="display:flex;gap:10px;flex-wrap:wrap;margin-top:18px">
      <button class="btn btn-primary btn-sm" onclick="downloadInvoicePDF('${inv.id}')"><i class="fas fa-file-pdf"></i> Download PDF</button>
      ${inv.status !== 'paid' && inv.status !== 'cancelled' ? `<button class="btn btn-ghost btn-sm" onclick="markInvoicePaid('${inv.id}');closeModal('invoiceViewModal')"><i class="fas fa-check"></i> Mark as Paid</button>` : ""}
    </div>
    <p class="form-note" style="margin-top:14px">If the file opens instead of downloading on iPhone, tap the share icon and choose “Save to Files”.</p>`;
  openModal("invoiceViewModal");
}

/* ---------- PDF ---------- */
async function downloadInvoicePDF(id) {
  const inv = INVOICES.find(x => x.id === id);
  if (!inv) return;
  const settings = await getBusinessSettings();
  await generateInvoicePDF(inv, settings);
}

const ACCENT = [27, 117, 188]; // #1B75BC — matches the logo blue

// Load an image as a data URL AND capture its natural size so we can draw it
// proportionally (never stretched). Auto-detects JPEG vs PNG from the data URL.
async function loadImageInfo(url) {
  try {
    const res = await fetch(url);
    if (!res.ok) return null;
    const blob = await res.blob();
    const dataUrl = await new Promise((resolve, reject) => {
      const fr = new FileReader();
      fr.onload = () => resolve(fr.result);
      fr.onerror = () => reject(new Error("read failed"));
      fr.readAsDataURL(blob);
    });
    const format = /^data:image\/jpeg/.test(dataUrl) ? "JPEG" : "PNG";
    const dims = await new Promise((resolve) => {
      const im = new Image();
      im.onload = () => resolve({ w: im.naturalWidth || 200, h: im.naturalHeight || 200 });
      im.onerror = () => resolve({ w: 200, h: 200 });
      im.src = dataUrl;
    });
    return { dataUrl, format, w: dims.w, h: dims.h };
  } catch (e) {
    return null;
  }
}

// Shared professional letterhead used by both invoice & contract PDFs.
function drawDocHeader(doc, s, title, rightLines, info) {
  const pageW = doc.internal.pageSize.getWidth();
  const margin = 40;
  const top = 40;

  // Logo (sized proportionally — never stretched).
  let logoGap = 0;
  if (info && info.dataUrl) {
    try {
      const maxH = 48;
      const ar = info.w / info.h;
      let h = maxH, w = h * ar;
      if (w > 130) { w = 130; h = w / ar; }
      doc.addImage(info.dataUrl, info.format, margin, top, w, h);
      logoGap = w + 16;
    } catch (e) {}
  }

  const tx = margin + logoGap;
  const colGap = 16;
  const colW = (pageW - margin * 2 - logoGap - colGap) / 2;

  // Company name
  doc.setFont("helvetica", "bold"); doc.setFontSize(14); doc.setTextColor(20, 24, 36);
  doc.text(s.company_name || "LC GLOBAL HOLDINGS (PTY) LTD", tx, top + 11);

  // Registration + tax numbers (smaller line)
  let ly = top + 23;
  const regBits = [];
  if (s.registration_no) regBits.push("Reg. " + s.registration_no);
  if (s.tax_no) regBits.push("Tax " + s.tax_no);
  if (regBits.length) {
    doc.setFont("helvetica", "normal"); doc.setFontSize(8); doc.setTextColor(110, 118, 140);
    doc.text(regBits.join("    ·    "), tx, ly); ly += 11;
  }

  // Two office addresses side by side
  doc.setFont("helvetica", "normal"); doc.setFontSize(8); doc.setTextColor(80, 86, 102);
  const leftLines = doc.splitTextToSize(s.company_address || "", colW);
  const rightLinesAddr = doc.splitTextToSize(s.company_address2 || "", colW);
  let lyL = ly, lyR = ly;
  leftLines.forEach((ln) => { doc.text(ln, tx, lyL); lyL += 10; });
  rightLinesAddr.forEach((ln) => { doc.text(ln, tx + colW + colGap, lyR); lyR += 10; });
  ly = Math.max(lyL, lyR);

  // Cell / email / website compact line
  const contact = [];
  if (s.company_phone) contact.push("Cell: " + s.company_phone);
  if (s.company_email) contact.push("Email: " + s.company_email);
  if (s.website) contact.push("Web: " + s.website);
  if (contact.length) { doc.text(contact.join("    "), tx, ly + 2); ly += 14; }

  // Blue accent rule under the header
  doc.setDrawColor(ACCENT[0], ACCENT[1], ACCENT[2]); doc.setLineWidth(1.4);
  doc.line(margin, ly, pageW - margin, ly);
  ly += 22;

  // Document title (large bold) + reference lines on the right
  doc.setFont("helvetica", "bold"); doc.setFontSize(22); doc.setTextColor(20, 24, 36);
  doc.text(title, margin, ly);
  if (rightLines && rightLines.length) {
    doc.setFont("helvetica", "normal"); doc.setFontSize(9.5); doc.setTextColor(90, 96, 112);
    let ry = ly - 5;
    rightLines.forEach((ln) => { doc.text(ln, pageW - margin, ry, { align: "right" }); ry += 13; });
  }
  return ly + 16;
}

// Footer on every page: thin rule, centred website/email, and page number.
function drawDocFooter(doc, s) {
  const pageH = doc.internal.pageSize.getHeight();
  const pageW = doc.internal.pageSize.getWidth();
  const margin = 40;
  const y = pageH - 38;
  doc.setDrawColor(220); doc.setLineWidth(0.6);
  doc.line(margin, y, pageW - margin, y);
  const center = [];
  if (s.website) center.push(s.website);
  if (s.company_email) center.push(s.company_email);
  doc.setFont("helvetica", "normal"); doc.setFontSize(8); doc.setTextColor(120, 126, 142);
  doc.text(center.join("    ·    "), pageW / 2, y + 12, { align: "center" });
  const pages = doc.internal.getNumberOfPages();
  if (pages > 1) {
    for (let p = 1; p <= pages; p++) {
      doc.setPage(p);
      doc.setFontSize(8); doc.setTextColor(120, 126, 142);
      doc.text("Page " + p + " of " + pages, pageW - margin, y + 12, { align: "right" });
    }
    doc.setPage(pages);
  }
}

// Render multi-paragraph body text with proper line + paragraph spacing.
function drawParagraphs(doc, text, x, y, maxWidth, lineHeight, paraGap) {
  doc.setFont("helvetica", "normal"); doc.setFontSize(10); doc.setTextColor(30, 34, 46);
  const paragraphs = String(text || "").split(/\n/);
  for (const para of paragraphs) {
    const trimmed = para.trim();
    if (!trimmed) { y += paraGap; continue; }
    const lines = doc.splitTextToSize(trimmed, maxWidth);
    lines.forEach((ln) => { doc.text(ln, x, y); y += lineHeight; });
    y += paraGap;
  }
  return y;
}

async function generateInvoicePDF(inv, s) {
  if (!window.jspdf || !window.jspdf.jsPDF) { alert("PDF library not loaded."); return; }
  const { jsPDF } = window.jspdf;
  const doc = new jsPDF({ unit: "pt", format: "a4" });
  const pageW = doc.internal.pageSize.getWidth();
  const margin = 40;

  const info = await loadImageInfo(s.logo_url || "assets/lc-global-holdings-logo.jpg");
  let y = drawDocHeader(doc, s, "INVOICE", [
    "Invoice: " + inv.invoice_number,
    "Issued: " + formatDate(inv.issue_date),
    inv.due_date ? "Due: " + formatDate(inv.due_date) : null,
  ].filter(Boolean), info);

  // Bill To block (left) + status (right)
  doc.setFont("helvetica", "bold"); doc.setFontSize(9); doc.setTextColor(120);
  doc.text("BILL TO", margin, y);
  doc.setFont("helvetica", "normal"); doc.setFontSize(10); doc.setTextColor(20);
  let by = y + 14;
  [inv.client_name, inv.client_company, inv.client_email, inv.client_phone, inv.client_address]
    .filter(Boolean).forEach((line) => { doc.text(String(line), margin, by); by += 13; });

  const rightX = pageW - margin;
  doc.setFont("helvetica", "bold"); doc.setFontSize(9); doc.setTextColor(120);
  doc.text("STATUS", rightX, y, { align: "right" });
  doc.setFont("helvetica", "normal"); doc.setFontSize(10);
  doc.text((inv.status || "").toUpperCase(), rightX, y + 14, { align: "right" });

  y = Math.max(by, y + 30) + 14;

  // Items table
  const body = (inv.items || []).map((it) => [
    it.description || "",
    String(it.quantity),
    formatMoney(it.unit_price),
    formatMoney((it.quantity || 0) * (it.unit_price || 0)),
  ]);
  doc.autoTable({
    startY: y,
    head: [["Description", "Qty", "Unit Price", "Line Total"]],
    body,
    theme: "striped",
    styles: { font: "helvetica", fontSize: 9, cellPadding: 7, lineColor: [226, 230, 238], textColor: [30, 34, 46] },
    headStyles: { fillColor: ACCENT, textColor: 255, fontStyle: "bold" },
    alternateRowStyles: { fillColor: [245, 247, 251] },
    columnStyles: {
      0: { cellWidth: "auto" },
      1: { halign: "right", cellWidth: 46 },
      2: { halign: "right", cellWidth: 90 },
      3: { halign: "right", cellWidth: 90 },
    },
    margin: { left: margin, right: margin },
  });

  let ty = doc.lastAutoTable.finalY + 18;
  const labelX = pageW - 235;
  doc.setFontSize(10); doc.setTextColor(30);
  const totRow = (label, val, bold) => {
    doc.setFont("helvetica", bold ? "bold" : "normal");
    doc.text(label, labelX, ty, { align: "left" });
    doc.text(val, pageW - margin, ty, { align: "right" });
    ty += 16;
  };
  totRow("Subtotal", formatMoney(inv.subtotal), false);
  totRow(`VAT (${inv.vat_percent}%)`, formatMoney(inv.vat_amount), false);
  totRow("Discount", "− " + formatMoney(inv.discount), false);
  doc.setFontSize(13);
  totRow("TOTAL", formatMoney(inv.total), true);

  // Payment details box (so a client can screenshot just this for an EFT)
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
    const boxY = ty + 16;
    const boxH = 22 + bankLines.length * 12 + 4;
    doc.setDrawColor(ACCENT[0], ACCENT[1], ACCENT[2]); doc.setLineWidth(1);
    doc.roundedRect(margin, boxY, pageW - margin * 2, boxH, 6, 6);
    doc.setFont("helvetica", "bold"); doc.setFontSize(9); doc.setTextColor(ACCENT[0], ACCENT[1], ACCENT[2]);
    doc.text("PLEASE MAKE PAYMENT TO", margin + 14, boxY + 16);
    doc.setFont("helvetica", "normal"); doc.setFontSize(9); doc.setTextColor(40);
    bankLines.forEach((ln, i) => doc.text(ln, margin + 14, boxY + 32 + i * 12));
  }

  drawDocFooter(doc, s);
  doc.save(`${inv.invoice_number}.pdf`);
}

/* ---------- HELPERS ---------- */
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
function todayISO() { return new Date().toISOString().slice(0, 10); }
function round2(n) { return Math.round((Number(n) || 0) * 100) / 100; }
function escapeRegex(s) { return String(s).replace(/[.*+?^${}()|[\]\\]/g, "\\$&"); }
function statusBadge(status) {
  const map = {
    draft: ["st-draft", "Draft"],
    sent: ["st-sent", "Sent"],
    paid: ["st-paid", "Paid"],
    overdue: ["st-overdue", "Overdue"],
    cancelled: ["st-cancelled", "Cancelled"],
    viewed: ["st-viewed", "Viewed"],
    signed: ["st-signed", "Signed"],
  };
  const [cls, label] = map[status] || ["st-draft", status];
  return `<span class="status-badge ${cls}">${label}</span>`;
}
