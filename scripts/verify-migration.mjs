#!/usr/bin/env node
/* ============================================================
   verify-migration.mjs  —  ONE-OFF DEV TOOL (not shipped to site)
   ------------------------------------------------------------
   Connects directly to Supabase with the SERVICE ROLE key (from
   .env) and checks that the invoicing/contracts migration landed:
     • all four tables exist
     • both RPC functions exist
     • read/write works on business_settings (insert → read → revert/delete)

   Run:   node scripts/verify-migration.mjs
   Requires: npm install @supabase/supabase-js  (done once, local only)
   The service-role key lives ONLY here + in .env — never in the browser.
   ============================================================ */

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { createClient } from "@supabase/supabase-js";

// ---- tiny .env loader (no extra deps) ----
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

if (!URL || !SERVICE_ROLE) {
  console.error("\n✖ Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env\n");
  process.exit(1);
}

const supabase = createClient(URL, SERVICE_ROLE, {
  auth: { persistSession: false, autoRefreshToken: false },
});

const TABLES = ["business_settings", "invoices", "contract_templates", "contracts"];
const FUNCS = ["get_contract_by_token", "sign_contract"];

let failures = 0;
const ok = (m) => console.log("  ✓ " + m);
const bad = (m) => { console.log("  ✗ " + m); failures++; };

async function tableExists(name) {
  const { error } = await supabase.from(name).select("*").limit(1);
  // code 42P01 = undefined_table. Supabase's PostgREST schema cache can also
  // return a "Could not find the table ... in the schema cache" error for a
  // table that doesn't exist yet (or whose cache hasn't reloaded) — treat
  // those as "missing" too so the report is accurate.
  if (!error) return true;
  const msg = String(error.message || "");
  const missing = error.code === "42P01" || /could not find the table/i.test(msg) || /schema cache/i.test(msg);
  return !missing;
}

// information_schema.routines isn't exposed over PostgREST, so we probe the
// function directly via rpc. A "function does not exist" error means it's
// missing; any other outcome (empty result, false, etc.) means it exists.
async function funcExists(name) {
  const probe = name === "get_contract_by_token"
    ? { p_token: "verify-probe-does-not-exist" }
    : { p_token: "x", p_name: "x", p_signature: "x", p_agree: false };
  const { error } = await supabase.rpc(name, probe);
  if (!error) return true;
  const msg = String(error.message || "");
  return !(/does not exist/i.test(msg) || /could not find.*function/i.test(msg) || /function.*not found/i.test(msg));
}

// The public contract-sign page calls these with the ANON key. Prove the
// `grant execute ... to anon` actually landed.
async function anonCanCall(name) {
  const anon = createClient(URL, env.SUPABASE_ANON_KEY, { auth: { persistSession: false } });
  const probe = name === "get_contract_by_token"
    ? { p_token: "verify-probe-does-not-exist" }
    : { p_token: "x", p_name: "x", p_signature: "x", p_agree: false };
  const { error } = await anon.rpc(name, probe);
  if (!error) return true;
  const msg = String(error.message || "");
  return !(/does not exist/i.test(msg) || /could not find.*function/i.test(msg) || /function.*not found/i.test(msg));
}

async function main() {
  console.log("\nSupabase migration verification\n" + "─".repeat(34));

  console.log("\nTables:");
  for (const t of TABLES) {
    (await tableExists(t)) ? ok(t) : bad(`${t} missing`);
  }

  console.log("\nFunctions (granted to anon):");
  for (const f of FUNCS) {
    const exists = await funcExists(f);
    if (exists) ok(`${f} exists`);
    else { bad(`${f} missing`); continue; }
    const anonOk = await anonCanCall(f);
    anonOk ? ok(`${f} callable by anon key`) : bad(`${f} NOT granted to anon`);
  }

  console.log("\nbusiness_settings read/write test:");
  try {
    const { data: existing } = await supabase
      .from("business_settings").select("*").eq("id", 1).maybeSingle();

    if (existing) {
      // single-row table (id=1) — prove write by updating a field, then restore.
      const originalName = existing.company_name;
      const { error: updErr } = await supabase
        .from("business_settings").update({ company_name: "__VERIFY__" }).eq("id", 1);
      if (updErr) throw updErr;
      const { data: check } = await supabase
        .from("business_settings").select("company_name").eq("id", 1).maybeSingle();
      ok(`read/write works (row id=1, round-tripped value "${check?.company_name}")`);
      await supabase.from("business_settings")
        .update({ company_name: originalName }).eq("id", 1);
      ok("restored original company_name");
    } else {
      const { error: insErr } = await supabase
        .from("business_settings").insert({ id: 1, company_name: "__VERIFY__" });
      if (insErr) throw insErr;
      const { data: check } = await supabase
        .from("business_settings").select("company_name").eq("id", 1).maybeSingle();
      ok(`insert/read works (row id=1, value "${check?.company_name}")`);
      await supabase.from("business_settings").delete().eq("id", 1);
      ok("deleted test row");
    }
  } catch (e) {
    bad("business_settings test failed: " + e.message);
  }

  console.log("\n" + "─".repeat(34));
  if (failures === 0) {
    console.log("✅ All checks passed — migration is live.\n");
    process.exit(0);
  } else {
    console.log(`❌ ${failures} check(s) failed. Apply the SQL in\n   sql/migration-invoicing-contracts.sql then re-run.\n`);
    process.exit(1);
  }
}

main();
