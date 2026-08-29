/* ==========================================================
   contract-sign.js — public, UNauthenticated signing page.
   Talks to Supabase ONLY through the two security-definer RPC
   functions (get_contract_by_token / sign_contract) using the
   anon key. It can never read or list the contracts table.
   ========================================================== */

let TOKEN = null;
let PAD = null;
let CONTRACT = null;
let SIGNED = null;

// Public letterhead used for the client-facing signed-contract PDF.
// These are public company details (also shown across the marketing site),
// so hard-coding them here avoids giving the anon signing page DB access.
const BUSINESS = {
  company_name: "LC GLOBAL HOLDINGS (PTY) LTD",
  registration_no: "2026/418287/07",
  tax_no: "9908446199",
  company_address: "35 Ormonde Street, Lukasrand, Pretoria, 0700",
  company_address2: "18 Thyme Street x17, Ivypark, Polokwane, 0699",
  company_phone: "0760950954 / 0687289637",
  company_email: "chitsurosnet@outlook.com",
  website: "www.lcdigitalsolution.co.za",
  logo_url: "assets/lc-global-holdings-logo.jpg",
  bank_name: "First National Bank (FNB)",
  bank_account_holder: "LC GLOBAL HOLDINGS (PTY) LTD",
  bank_account_number: "63219779353",
  bank_branch_name: "Brooklyn",
  bank_branch_code: "251345",
  bank_account_type: "Gold Business Account",
  bank_swift_code: "FIRNZAJJ",
};

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
  } catch (e) { return null; }
}

function drawDocHeader(doc, s, title, rightLines, info) {
  const pageW = doc.internal.pageSize.getWidth();
  const margin = 40, top = 40;
  let logoGap = 0;
  if (info && info.dataUrl) {
    try {
      const maxH = 48, ar = info.w / info.h;
      let h = maxH, w = h * ar; if (w > 130) { w = 130; h = w / ar; }
      doc.addImage(info.dataUrl, info.format, margin, top, w, h);
      logoGap = w + 16;
    } catch (e) {}
  }
  const tx = margin + logoGap, colGap = 16, colW = (pageW - margin * 2 - logoGap - colGap) / 2;
  doc.setFont("helvetica", "bold"); doc.setFontSize(14); doc.setTextColor(20, 24, 36);
  doc.text(s.company_name || "L.C DIGITAL SOLUTION", tx, top + 11);
  let ly = top + 23;
  const regBits = [];
  if (s.registration_no) regBits.push("Reg. " + s.registration_no);
  if (s.tax_no) regBits.push("Tax " + s.tax_no);
  if (regBits.length) { doc.setFont("helvetica", "normal"); doc.setFontSize(8); doc.setTextColor(110, 118, 140); doc.text(regBits.join("    ·    "), tx, ly); ly += 11; }
  doc.setFont("helvetica", "normal"); doc.setFontSize(8); doc.setTextColor(80, 86, 102);
  const leftLines = doc.splitTextToSize(s.company_address || "", colW);
  const rightLinesAddr = doc.splitTextToSize(s.company_address2 || "", colW);
  let lyL = ly, lyR = ly;
  leftLines.forEach((ln) => { doc.text(ln, tx, lyL); lyL += 10; });
  rightLinesAddr.forEach((ln) => { doc.text(ln, tx + colW + colGap, lyR); lyR += 10; });
  ly = Math.max(lyL, lyR);
  const contact = [];
  if (s.company_phone) contact.push("Cell: " + s.company_phone);
  if (s.company_email) contact.push("Email: " + s.company_email);
  if (s.website) contact.push("Web: " + s.website);
  if (contact.length) { doc.text(contact.join("    "), tx, ly + 2); ly += 14; }
  doc.setDrawColor(0, 102, 255); doc.setLineWidth(1.4); doc.line(margin, ly, pageW - margin, ly);
  ly += 22;
  doc.setFont("helvetica", "bold"); doc.setFontSize(22); doc.setTextColor(20, 24, 36);
  doc.text(title, margin, ly);
  if (rightLines && rightLines.length) {
    doc.setFont("helvetica", "normal"); doc.setFontSize(9.5); doc.setTextColor(90, 96, 112);
    let ry = ly - 5;
    rightLines.forEach((ln) => { doc.text(ln, pageW - margin, ry, { align: "right" }); ry += 13; });
  }
  return ly + 16;
}

function drawDocFooter(doc, s) {
  const pageH = doc.internal.pageSize.getHeight();
  const pageW = doc.internal.pageSize.getWidth();
  const margin = 40, y = pageH - 38;
  doc.setDrawColor(220); doc.setLineWidth(0.6); doc.line(margin, y, pageW - margin, y);
  const center = [];
  if (s.website) center.push(s.website);
  if (s.company_email) center.push(s.company_email);
  doc.setFont("helvetica", "normal"); doc.setFontSize(8); doc.setTextColor(120, 126, 142);
  doc.text(center.join("    ·    "), pageW / 2, y + 12, { align: "center" });
}

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

document.addEventListener("DOMContentLoaded", async () => {
  TOKEN = new URLSearchParams(location.search).get("token");
  if (!TOKEN) return renderError("This link is missing its token. Please use the full link from your provider.");
  await loadContract();
});

async function loadContract() {
  try {
    const { data, error } = await window.supabase.rpc("get_contract_by_token", { p_token: TOKEN });
    if (error) throw error;
    if (!data || !data.length) {
      return renderError("This contract could not be found. It may have been cancelled or the link has expired.");
    }
    CONTRACT = data[0];
    if (CONTRACT.contract_status === "signed") return renderSigned(CONTRACT);
    renderSigning(CONTRACT);
  } catch (err) {
    console.error(err);
    renderError("Something went wrong loading this contract. Please try again or contact your provider.");
  }
}

function escapeHTML(str) {
  if (str === null || str === undefined) return "";
  return String(str).replace(/[&<>"']/g, m => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[m]));
}
function formatMoney(n) {
  const v = Number(n) || 0;
  return "R" + v.toLocaleString("en-ZA", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}
function formatDate(s) {
  if (!s) return "";
  const d = new Date(s);
  if (isNaN(d.getTime())) return "";
  return d.toLocaleDateString("en-ZA", { day: "2-digit", month: "short", year: "numeric" }) +
    " " + d.toLocaleTimeString("en-ZA", { hour: "2-digit", minute: "2-digit" });
}

function renderSigning(c) {
  const app = document.getElementById("app");
  app.innerHTML = `
    <div class="cs-card">
      <div class="cs-client">${escapeHTML(c.client_name)}</div>
      <p class="muted" style="color:var(--text-lo);font-size:.85rem;margin-bottom:4px">Please review your agreement below, then sign.</p>
      <div class="cs-meta">
        <div><div class="lbl">Service</div><div class="val" style="font-size:.9rem;font-weight:500">${escapeHTML(c.service_description || "—")}</div></div>
        <div><div class="lbl">Total Value</div><div class="val">${formatMoney(c.total_amount)}</div></div>
        <div><div class="lbl">Deposit Required</div><div class="val">${formatMoney(c.deposit_amount)} <span style="font-size:.75rem;color:var(--text-lo)">(${c.deposit_percent}%)</span></div></div>
      </div>
      <h4 style="margin:4px 0 8px;font-size:.95rem">Agreement</h4>
      <div class="cs-body">${escapeHTML(c.contract_body)}</div>

      <div class="cs-divider"></div>
      <h4 style="margin-bottom:6px;font-size:.95rem">Sign here</h4>
      <div class="form-field" style="margin-bottom:10px">
        <label>Full Name *</label>
        <input type="text" id="signName" placeholder="Type your full name" autocomplete="name">
      </div>
      <div class="form-field" style="margin-bottom:14px">
        <label>Phone Number *</label>
        <input type="tel" id="signPhone" placeholder="e.g. 082 123 4567" autocomplete="tel">
      </div>
      <div class="agree-row">
        <input type="checkbox" id="signAgree">
        <label for="signAgree" style="font-weight:400">I have read and agree to the terms and conditions above.</label>
      </div>
      <label style="font-size:.82rem;font-weight:600;color:var(--text-lo)">Signature <span class="muted" style="font-weight:400">(draw with your finger)</span></label>
      <div class="sig-wrap">
        <button type="button" class="btn btn-ghost btn-sm sig-clear" id="sigClear"><i class="fas fa-eraser"></i> Clear</button>
        <canvas id="sigPad"></canvas>
      </div>
      <p class="form-error" id="signError"></p>
      <button class="btn btn-primary btn-block" id="signSubmit" style="margin-top:14px">
        <i class="fas fa-signature"></i> Sign &amp; Submit
      </button>
    </div>`;

  initSignaturePad();
  document.getElementById("signSubmit").addEventListener("click", submitSignature);
  document.getElementById("sigClear").addEventListener("click", () => PAD.clear());
}

function initSignaturePad() {
  const canvas = document.getElementById("sigPad");
  const ratio = Math.max(window.devicePixelRatio || 1, 1);
  function fit() {
    const w = canvas.offsetWidth, h = canvas.offsetHeight;
    canvas.width = w * ratio; canvas.height = h * ratio;
    canvas.getContext("2d").scale(ratio, ratio);
    PAD.clear();
  }
  PAD = new SignaturePad(canvas, { backgroundColor: "rgba(0,0,0,0)" });
  fit();
  window.addEventListener("resize", () => {
    const data = PAD.toData();
    fit();
    try { PAD.fromData(data); } catch (e) {}
  });
}

async function submitSignature() {
  const name = document.getElementById("signName").value.trim();
  const phone = document.getElementById("signPhone").value.trim();
  const agree = document.getElementById("signAgree").checked;
  const errEl = document.getElementById("signError");
  errEl.style.display = "none";

  if (!name) return showSignError("Please enter your full name.");
  if (!phone) return showSignError("Please enter your phone number.");
  if (!agree) return showSignError("You must agree to the terms before signing.");
  if (PAD.isEmpty()) return showSignError("Please provide your signature in the box.");

  const btn = document.getElementById("signSubmit");
  btn.disabled = true; btn.innerHTML = '<span class="spinner"></span> Submitting…';

  try {
    const signature = PAD.toDataURL("image/png");
    const { data, error } = await window.supabase.rpc("sign_contract", {
      p_token: TOKEN,
      p_name: name,
      p_signature: signature,
      p_agree: true,
      p_phone: phone,
    });
    if (error) throw error;
    if (data === true) {
      CONTRACT.signed_at = new Date().toISOString();
      SIGNED = { name, phone, signature, contract: CONTRACT };
      return renderSuccess(name);
    }
    return showSignError("This contract could not be signed — it may already be signed or is no longer available.");
  } catch (err) {
    console.error(err);
    showSignError("Something went wrong submitting your signature. Please try again.");
  } finally {
    btn.disabled = false; btn.innerHTML = '<i class="fas fa-signature"></i> Sign &amp; Submit';
  }
}

function showSignError(msg) {
  const el = document.getElementById("signError");
  if (!el) return;
  el.textContent = msg; el.style.display = "block";
  el.scrollIntoView({ behavior: "smooth", block: "center" });
}

function renderSigned(c) {
  document.getElementById("app").innerHTML = `
    <div class="cs-card cs-success">
      <i class="fas fa-circle-check"></i>
      <h3 style="margin-bottom:8px">Already signed</h3>
      <p class="muted" style="color:var(--text-lo)">This contract was signed${c.signed_at ? " on " + formatDate(c.signed_at) : ""}. No further action is needed.</p>
    </div>`;
}

function renderSuccess(name) {
  document.getElementById("app").innerHTML = `
    <div class="cs-card cs-success">
      <i class="fas fa-circle-check"></i>
      <h3 style="margin-bottom:8px">Thank you, ${escapeHTML(name)}!</h3>
      <p class="muted" style="color:var(--text-lo)">Your signature has been recorded. You can download a copy of your signed contract below.</p>
      <button class="btn btn-primary btn-block" id="downloadSignedBtn" style="margin-top:18px">
        <i class="fas fa-download"></i> Download Signed Contract (PDF)
      </button>
    </div>`;
  document.getElementById("downloadSignedBtn").addEventListener("click", downloadSignedContractPdf);
}

async function downloadSignedContractPdf() {
  if (!SIGNED || !window.jspdf || !window.jspdf.jsPDF) { alert("PDF library not loaded."); return; }
  const { name, phone, signature, contract } = SIGNED;
  const { jsPDF } = window.jspdf;
  const doc = new jsPDF({ unit: "pt", format: "a4" });
  const pageW = doc.internal.pageSize.getWidth();
  const margin = 40;

  const info = await loadImageInfo(BUSINESS.logo_url || "assets/lc-global-holdings-logo.jpg");
  let y = drawDocHeader(doc, BUSINESS, "SIGNED SERVICE AGREEMENT", ["Signed: " + formatDate(contract.signed_at)], info);

  doc.setFont("helvetica", "bold"); doc.setFontSize(11); doc.setTextColor(20);
  doc.text(contract.client_name || "", margin, y); y += 18;
  doc.setFont("helvetica", "normal"); doc.setFontSize(9); doc.setTextColor(110);
  doc.text("Total Value: " + formatMoney(contract.total_amount) + "     Deposit: " + formatMoney(contract.deposit_amount) + " (" + (contract.deposit_percent || 0) + "%)", margin, y);
  y += 24;

  doc.setFont("helvetica", "bold"); doc.setFontSize(11); doc.setTextColor(20);
  doc.text("Agreement", margin, y); y += 16;
  y = drawParagraphs(doc, contract.contract_body || "", margin, y, pageW - margin * 2, 13, 6);

  y += 6;
  doc.setDrawColor(210); doc.setLineWidth(0.8); doc.line(margin, y, pageW - margin, y); y += 18;
  doc.setFont("helvetica", "bold"); doc.setFontSize(10.5); doc.setTextColor(20);
  doc.text("SIGNED", margin, y); y += 18;
  doc.setFont("helvetica", "normal"); doc.setFontSize(10);
  doc.text("Name: " + (name || ""), margin, y); y += 15;
  doc.text("Phone: " + (phone || "—"), margin, y); y += 15;
  doc.text("Date signed: " + formatDate(contract.signed_at), margin, y); y += 20;
  if (signature) {
    try {
      const props = doc.getImageProperties(signature);
      const maxW = 220, ar = props.width / props.height;
      let sw = maxW, sh = sw / ar; if (sh > 70) { sh = 70; sw = sh * ar; }
      doc.addImage(signature, "PNG", margin, y, sw, sh); y += sh + 16;
    } catch (e) {}
  }
  // Payment details (so a client knows exactly where to pay).
  if (BUSINESS.bank_account_number) {
    const bankLines = [
      BUSINESS.bank_name && "Bank: " + BUSINESS.bank_name,
      BUSINESS.bank_account_holder && "Account holder: " + BUSINESS.bank_account_holder,
      "Account no: " + BUSINESS.bank_account_number,
      BUSINESS.bank_account_type && "Account type: " + BUSINESS.bank_account_type,
      BUSINESS.bank_branch_name && "Branch: " + BUSINESS.bank_branch_name,
      BUSINESS.bank_branch_code && "Branch code: " + BUSINESS.bank_branch_code,
      BUSINESS.bank_swift_code && "Swift: " + BUSINESS.bank_swift_code,
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

  drawDocFooter(doc, BUSINESS);
  const safe = String(contract.client_name || "client").replace(/\s+/g, "-").toLowerCase();
  doc.save("signed-contract-" + safe + ".pdf");
}

function renderError(msg) {
  document.getElementById("app").innerHTML = `
    <div class="cs-card">
      <div class="empty-state">
        <i class="fas fa-triangle-exclamation"></i>
        <p>${escapeHTML(msg)}</p>
      </div>
    </div>`;
}
