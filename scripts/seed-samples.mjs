#!/usr/bin/env node
/* ============================================================
   seed-samples.mjs  —  ONE-OFF DEV TOOL (not shipped to site)
   ------------------------------------------------------------
   Inserts ONE clearly-marked SAMPLE invoice + ONE SAMPLE contract
   into Supabase so you can click through the real dashboard UI,
   generate PDFs from DB rows, and test the public signing flow
   WITHOUT touching any real client data.

   • Uses the SERVICE ROLE key from .env (bypasses RLS, like
     verify-migration.mjs does) so the seed always lands.
   • Sample rows are tagged "SAMPLE" in client_name / invoice_number
     so you can find/delete them easily in the dashboard.
   • Re-running is safe: it skips rows that already exist and just
     prints the existing contract's signing link again.
   • Pass --force to delete + re-create the samples from scratch.

   Run:   node scripts/seed-samples.mjs
          node scripts/seed-samples.mjs --force
   ============================================================ */

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { createClient } from "@supabase/supabase-js";

// ---- tiny .env loader (mirrors verify-migration.mjs) ----
const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, "..");
function loadEnv() {
  const out = {};
  try {
    const raw = readFileSync(join(root, ".env"), "utf8");
    for (const line of raw.split("\n")) {
      const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
      if (m) out[m[1]] = m[2].replace(/^["']|["']$/g, "");
    }
  } catch (e) {
    console.error("Could not read .env:", e.message);
  }
  return out;
}
const env = loadEnv();
const URL = env.SUPABASE_URL;
const SERVICE_ROLE = env.SUPABASE_SERVICE_ROLE_KEY;
const FORCE = process.argv.includes("--force");

if (!URL || !SERVICE_ROLE) {
  console.error("\n✖ Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env\n");
  process.exit(1);
}

const supabase = createClient(URL, SERVICE_ROLE, {
  auth: { persistSession: false, autoRefreshToken: false },
});

// ---- shared sample values ----
const SAMPLE_INV_NO = "INV-2026-SAMPLE-001";
const SAMPLE_CLIENT = "SAMPLE — Mokoena Trading CC";
const SAMPLE_EMAIL = "sample@mokoena.example";

const invoiceItems = [
  { description: "Business website design (5 pages)", quantity: 1, unit_price: 6500.0 },
  { description: "Hosting — annual (Gold Business)", quantity: 1, unit_price: 2400.0 },
  { description: "Brand logo redesign", quantity: 1, unit_price: 1800.0 },
  { description: "SEO starter pack", quantity: 1, unit_price: 1200.0 },
];
const invSubtotal = 11900.0;
const invVatPercent = 15.0;
const invVat = 1785.0;
const invDiscount = 0.0;
const invTotal = invSubtotal + invVat - invDiscount;

const contractBody = `This agreement is entered into between L.C Digital Solution WebCraft Studios ("the Service Provider") and ${SAMPLE_CLIENT} ("the Client") for the following service:

Business website design (5 pages), annual Gold Business hosting, brand logo redesign, and an SEO starter pack.

TOTAL PROJECT VALUE: R11900.00
DEPOSIT REQUIRED: R5950.00 (50% of total value), payable before work commences.

DEPOSIT & REFUND TERMS:
The deposit secures the Client's place in the Service Provider's work schedule and covers initial setup, planning, and resource allocation. Once the deposit has been paid and work has commenced, the deposit becomes NON-REFUNDABLE, regardless of whether the Client later chooses to cancel, pause, or discontinue the project. This applies even if only preliminary work has been completed.

The remaining balance is due on completion of the project, before final delivery, handover, or publishing of the work, unless otherwise agreed in writing.

By signing below, the Client confirms that they have read, understood, and agree to these terms and conditions in full.`;

async function findTemplate() {
  const { data, error } = await supabase
    .from("contract_templates")
    .select("id")
    .order("created_at", { ascending: true })
    .limit(1);
  if (error) throw error;
  return data && data.length ? data[0].id : null;
}

async function seedInvoice() {
  const { data: existing } = await supabase
    .from("invoices")
    .select("id, invoice_number")
    .eq("invoice_number", SAMPLE_INV_NO)
    .maybeSingle();
  if (existing) {
    console.log(`  • Invoice already seeded (${SAMPLE_INV_NO}, id=${existing.id}) — skipping.`);
    return existing;
  }
  const { data, error } = await supabase
    .from("invoices")
    .insert({
      invoice_number: SAMPLE_INV_NO,
      client_name: SAMPLE_CLIENT,
      client_email: SAMPLE_EMAIL,
      client_phone: "082 555 1234",
      client_company: "Mokoena Trading CC",
      client_address: "12 Church Street, Polokwane, 0699",
      issue_date: "2026-08-29",
      due_date: "2026-09-12",
      items: invoiceItems,
      subtotal: invSubtotal,
      vat_percent: invVatPercent,
      vat_amount: invVat,
      discount: invDiscount,
      total: invTotal,
      notes: "SAMPLE invoice — safe to delete. Generated by scripts/seed-samples.mjs.",
      status: "sent",
    })
    .select("id")
    .single();
  if (error) throw error;
  console.log(`  ✓ Inserted sample invoice ${SAMPLE_INV_NO} (id=${data.id})`);
  return data;
}

async function seedContract(templateId) {
  const { data: existing } = await supabase
    .from("contracts")
    .select("id, token, client_name")
    .eq("client_email", SAMPLE_EMAIL)
    .maybeSingle();
  if (existing) {
    console.log(`  • Contract already seeded (client=${SAMPLE_CLIENT}, token=${existing.token}) — skipping.`);
    return existing;
  }
  const { data, error } = await supabase
    .from("contracts")
    .insert({
      template_id: templateId,
      client_name: SAMPLE_CLIENT,
      client_email: SAMPLE_EMAIL,
      client_phone: "082 555 1234",
      service_description:
        "Business website design (5 pages), annual Gold Business hosting, brand logo redesign, and an SEO starter pack.",
      total_amount: 11900.0,
      deposit_amount: 5950.0,
      deposit_percent: 50.0,
      contract_body: contractBody,
      status: "sent", // 'sent' makes it signable via the public page
    })
    .select("id, token")
    .single();
  if (error) throw error;
  console.log(`  ✓ Inserted sample contract (id=${data.id}, token=${data.token})`);
  return data;
}

async function deleteSamples() {
  console.log("  … removing existing SAMPLE rows (--force)");
  await supabase.from("contracts").delete().eq("client_email", SAMPLE_EMAIL);
  await supabase.from("invoices").delete().eq("invoice_number", SAMPLE_INV_NO);
}

async function main() {
  console.log("\nSeeding SAMPLE invoice + contract\n" + "─".repeat(34));

  if (FORCE) {
    await deleteSamples();
  }

  const templateId = await findTemplate();
  if (!templateId) {
    console.error("\n✖ No contract_templates row found. Run sql/migration-invoicing-contracts.sql first.\n");
    process.exit(1);
  }
  console.log(`  • Using contract template id=${templateId}`);

  const inv = await seedInvoice();
  const con = await seedContract(templateId);

  console.log("\n" + "─".repeat(34));
  console.log("✅ Samples ready to test with.\n");
  console.log("Dashboard: open dashboard.html → Invoices tab should show");
  console.log(`   "${SAMPLE_INV_NO}" (status: sent). Click view / download PDF.`);
  console.log("\nContracts tab should show \"" + SAMPLE_CLIENT + "\" (status: sent).");
  console.log("   • Click View to preview the rendered agreement + test download PDF.");
  console.log("   • To test the PUBLIC signing flow, open the signing page with its token:");
  console.log(`     contract-sign.html?token=${con.token}`);
  console.log("     (use the same host/origin that serves your dashboard).");
  console.log("   • After signing, return to the Contracts tab → View shows the");
  console.log("     signed name/phone/signature and the signed PDF renders correctly.\n");
}

main().catch((e) => {
  console.error("\n✖ Seed failed:", e.message, "\n");
  process.exit(1);
});
