/* ==========================================================
   Business Settings — editor with autosave (dashboard).
   Writes to the single-row business_settings table (id=1).
   Uses the shared anon+session client from js/supabase-client.js.
   ========================================================== */

const SETTINGS_FIELDS = [
  "company_name", "registration_no", "tax_no", "company_address", "company_address2",
  "company_phone", "company_email", "website", "vat_number",
  "bank_name", "bank_account_holder", "bank_account_number", "bank_branch_code",
  "bank_branch_name", "bank_account_type", "bank_swift_code",
  "logo_url", "invoice_prefix", "invoice_footer_note",
];

let settingsSaveTimer = null;

document.addEventListener("DOMContentLoaded", async () => {
  const session = await requireAuth();
  if (!session) return;
  setupSettingsUI();
  await loadSettings();
  // Reload when the tab is opened, in case details changed elsewhere.
  document.querySelector('[data-tab-target="settings"]')
    ?.addEventListener("click", loadSettings);
});

async function loadSettings() {
  const form = document.getElementById("settingsForm");
  if (!form) return;
  const { data } = await supabase.from("business_settings").select("*").eq("id", 1).maybeSingle();
  if (!data) return;
  SETTINGS_FIELDS.forEach(k => { if (form[k]) form[k].value = data[k] ?? ""; });
  if (data.logo_url) showLogoPreview(data.logo_url);
}

function setupSettingsUI() {
  const form = document.getElementById("settingsForm");
  if (!form) return;
  form.querySelectorAll("input, textarea").forEach(el => {
    el.addEventListener("input", scheduleAutosave);
    el.addEventListener("change", scheduleAutosave);
  });

  document.getElementById("settingsLogoInput")?.addEventListener("change", uploadLogo);
  document.getElementById("settingsClearLogo")?.addEventListener("click", () => {
    form.logo_url.value = "";
    hideLogoPreview();
    scheduleAutosave();
  });
}

function scheduleAutosave() {
  const st = document.getElementById("settingsStatus");
  if (st) { st.textContent = "Saving…"; st.className = "settings-status saving"; }
  clearTimeout(settingsSaveTimer);
  settingsSaveTimer = setTimeout(saveSettings, 600);
}

async function saveSettings() {
  const form = document.getElementById("settingsForm");
  const payload = { id: 1 };
  SETTINGS_FIELDS.forEach(k => { payload[k] = (form[k]?.value || "").trim(); });
  if (!payload.invoice_prefix) payload.invoice_prefix = "INV";

  const st = document.getElementById("settingsStatus");
  const { error } = await supabase.from("business_settings").upsert(payload);
  if (error) {
    if (st) { st.textContent = "Save failed"; st.className = "settings-status error"; }
    console.error(error);
    return;
  }
  // Keep the PDF helper's cache fresh so generated docs use the new details.
  if (typeof BUSINESS !== "undefined") BUSINESS = payload;
  if (st) { st.textContent = "All changes saved ✓"; st.className = "settings-status saved"; }
}

async function uploadLogo(e) {
  const file = e.target.files?.[0];
  if (!file) return;
  const ext = (file.name.split(".").pop() || "png").toLowerCase();
  const path = `business-logo-${Date.now()}.${ext}`;
  const { error } = await supabase.storage.from("portfolio-logos").upload(path, file, { upsert: true });
  if (error) { alert("Logo upload failed: " + error.message); return; }
  const { data } = supabase.storage.from("portfolio-logos").getPublicUrl(path);
  const form = document.getElementById("settingsForm");
  form.logo_url.value = data.publicUrl;
  showLogoPreview(data.publicUrl);
  scheduleAutosave();
}

function showLogoPreview(url) {
  const img = document.getElementById("settingsLogoPreview");
  if (!img) return;
  img.src = url; img.style.display = "block";
}
function hideLogoPreview() {
  const img = document.getElementById("settingsLogoPreview");
  if (img) { img.style.display = "none"; img.src = ""; }
}
