/* ==========================================================
   contract-sign.js — public, UNauthenticated signing page.
   Talks to Supabase ONLY through the two security-definer RPC
   functions (get_contract_by_token / sign_contract) using the
   anon key. It can never read or list the contracts table.
   ========================================================== */

let TOKEN = null;
let PAD = null;
let CONTRACT = null;

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
    if (data === true) return renderSuccess(name);
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
      <p class="muted" style="color:var(--text-lo)">Your signature has been recorded. A copy has been sent to the provider. You may now close this page.</p>
    </div>`;
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
