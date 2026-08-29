// TEMPORARY sample generator — mirrors the production PDF drawing code so you
// can preview the redesigned invoice + contract letterhead WITHOUT real data.
// Run: node scripts/generate-samples.mjs   (outputs samples/sample-invoice.pdf, samples/sample-contract.pdf)
// Not shipped to the site. The browser (dashboard.html) uses the same layout
// via js/invoices.js + js/contracts.js.
import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
// Node build of jspdf-autotable exposes the namespace; attach it to jsPDF.
try { autoTable.applyPlugin(jsPDF); } catch (e) {}
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, "..");
const ACCENT = [27, 117, 188];

// ---- helpers (same as production) ----
const formatMoney = (n) => "R" + (Number(n) || 0).toLocaleString("en-ZA", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const formatDate = (s) => {
  if (!s) return "—";
  const d = new Date(s);
  if (isNaN(d.getTime())) return s;
  return d.toLocaleDateString("en-ZA", { day: "2-digit", month: "short", year: "numeric" });
};

function loadLogo() {
  const p = join(root, "assets/lc-global-holdings-logo.jpg");
  const b64 = readFileSync(p).toString("base64");
  return { dataUrl: "data:image/jpeg;base64," + b64, format: "JPEG" };
}

// Fake business settings = the seeded values (Task 4).
const S = {
  company_name: "LC GLOBAL HOLDINGS (PTY) LTD",
  registration_no: "2026/418287/07",
  tax_no: "9908446199",
  company_address: "35 Ormonde Street, Lukasrand, Pretoria, 0700",
  company_address2: "18 Thyme Street x17, Ivypark, Polokwane, 0699",
  company_phone: "0760950954 / 0687289637",
  company_email: "chitsurosnet@outlook.com",
  website: "www.lcdigitalsolution.co.za",
  vat_number: "",
  bank_name: "First National Bank (FNB)",
  bank_account_holder: "LC GLOBAL HOLDINGS (PTY) LTD",
  bank_account_number: "63219779353",
  bank_branch_code: "251345",
  bank_branch_name: "Brooklyn",
  bank_account_type: "Gold Business Account",
  bank_swift_code: "FIRNZAJJ",
  logo_url: "assets/lc-global-holdings-logo.jpg",
  invoice_prefix: "INV",
  invoice_footer_note: "Thank you for your business.",
};

function drawDocHeader(doc, s, title, rightLines, info) {
  const pageW = doc.internal.pageSize.getWidth();
  const margin = 40;
  const top = 40;
  let logoGap = 0;
  if (info && info.dataUrl) {
    try {
      const maxH = 48;
      const props = doc.getImageProperties(info.dataUrl);
      const ar = props.width / props.height;
      let h = maxH, w = h * ar;
      if (w > 130) { w = 130; h = w / ar; }
      doc.addImage(info.dataUrl, info.format, margin, top, w, h);
      logoGap = w + 16;
    } catch (e) {}
  }
  const tx = margin + logoGap;
  const colGap = 16;
  const colW = (pageW - margin * 2 - logoGap - colGap) / 2;
  doc.setFont("helvetica", "bold"); doc.setFontSize(14); doc.setTextColor(20, 24, 36);
  doc.text(s.company_name || "LC GLOBAL HOLDINGS (PTY) LTD", tx, top + 11);
  let ly = top + 23;
  const regBits = [];
  if (s.registration_no) regBits.push("Reg. " + s.registration_no);
  if (s.tax_no) regBits.push("Tax " + s.tax_no);
  if (regBits.length) {
    doc.setFont("helvetica", "normal"); doc.setFontSize(8); doc.setTextColor(110, 118, 140);
    doc.text(regBits.join("    ·    "), tx, ly); ly += 11;
  }
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
  doc.setDrawColor(ACCENT[0], ACCENT[1], ACCENT[2]); doc.setLineWidth(1.4);
  doc.line(margin, ly, pageW - margin, ly);
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

function buildInvoice() {
  const doc = new jsPDF({ unit: "pt", format: "a4" });
  const pageW = doc.internal.pageSize.getWidth();
  const margin = 40;
  const info = loadLogo();
  let y = drawDocHeader(doc, S, "INVOICE", [
    "Invoice: INV-2026-0001",
    "Issued: " + formatDate("2026-08-29"),
    "Due: " + formatDate("2026-09-12"),
  ], info);

  doc.setFont("helvetica", "bold"); doc.setFontSize(9); doc.setTextColor(120);
  doc.text("BILL TO", margin, y);
  doc.setFont("helvetica", "normal"); doc.setFontSize(10); doc.setTextColor(20);
  let by = y + 14;
  ["Thabo Mokoena", "Mokoena Trading CC", "thabo@mokoena.co.za", "082 555 1234", "12 Church Street, Polokwane, 0699"]
    .forEach((line) => { doc.text(line, margin, by); by += 13; });
  const rightX = pageW - margin;
  doc.setFont("helvetica", "bold"); doc.setFontSize(9); doc.setTextColor(120);
  doc.text("STATUS", rightX, y, { align: "right" });
  doc.setFont("helvetica", "normal"); doc.setFontSize(10);
  doc.text("SENT", rightX, y + 14, { align: "right" });
  y = Math.max(by, y + 30) + 14;

  const items = [
    ["Business website design (5 pages)", "1", "6500.00", "6500.00"],
    ["Hosting — annual (Gold Business)", "1", "2400.00", "2400.00"],
    ["Brand logo redesign", "1", "1800.00", "1800.00"],
    ["SEO starter pack", "1", "1200.00", "1200.00"],
  ];
  doc.autoTable({
    startY: y,
    head: [["Description", "Qty", "Unit Price", "Line Total"]],
    body: items,
    theme: "striped",
    styles: { font: "helvetica", fontSize: 9, cellPadding: 7, lineColor: [226, 230, 238], textColor: [30, 34, 46] },
    headStyles: { fillColor: ACCENT, textColor: 255, fontStyle: "bold" },
    alternateRowStyles: { fillColor: [245, 247, 251] },
    columnStyles: { 0: { cellWidth: "auto" }, 1: { halign: "right", cellWidth: 46 }, 2: { halign: "right", cellWidth: 90 }, 3: { halign: "right", cellWidth: 90 } },
    margin: { left: margin, right: margin },
  });

  const subtotal = 11900, vat = 1785, discount = 0, total = subtotal + vat - discount;
  let ty = doc.lastAutoTable.finalY + 18;
  const labelX = pageW - 235;
  const totRow = (label, val, bold) => {
    doc.setFont("helvetica", bold ? "bold" : "normal"); doc.setFontSize(bold ? 13 : 10); doc.setTextColor(30);
    doc.text(label, labelX, ty, { align: "left" });
    doc.text(val, pageW - margin, ty, { align: "right" });
    ty += bold ? 18 : 16;
  };
  totRow("Subtotal", formatMoney(subtotal), false);
  totRow("VAT (15%)", formatMoney(vat), false);
  totRow("Discount", "− " + formatMoney(discount), false);
  totRow("TOTAL", formatMoney(total), true);

  const bankLines = [
    "Bank: " + S.bank_name,
    "Account holder: " + S.bank_account_holder,
    "Account no: " + S.bank_account_number,
    "Account type: " + S.bank_account_type,
    "Branch: " + S.bank_branch_name,
    "Branch code: " + S.bank_branch_code,
    "Swift: " + S.bank_swift_code,
  ];
  const boxY = ty + 16;
  const boxH = 22 + bankLines.length * 12 + 4;
  doc.setDrawColor(ACCENT[0], ACCENT[1], ACCENT[2]); doc.setLineWidth(1);
  doc.roundedRect(margin, boxY, pageW - margin * 2, boxH, 6, 6);
  doc.setFont("helvetica", "bold"); doc.setFontSize(9); doc.setTextColor(ACCENT[0], ACCENT[1], ACCENT[2]);
  doc.text("PLEASE MAKE PAYMENT TO", margin + 14, boxY + 16);
  doc.setFont("helvetica", "normal"); doc.setFontSize(9); doc.setTextColor(40);
  bankLines.forEach((ln, i) => doc.text(ln, margin + 14, boxY + 32 + i * 12));

  drawDocFooter(doc, S);
  doc.save(join(root, "samples/sample-invoice.pdf"));
  console.log("wrote samples/sample-invoice.pdf");
}

function buildContract() {
  const doc = new jsPDF({ unit: "pt", format: "a4" });
  const pageW = doc.internal.pageSize.getWidth();
  const margin = 40;
  const info = loadLogo();
  let y = drawDocHeader(doc, S, "SERVICE AGREEMENT", ["Reference: " + formatDate("2026-08-29")], info);

  doc.setFont("helvetica", "bold"); doc.setFontSize(11); doc.setTextColor(20);
  doc.text("Mokoena Trading CC", margin, y); y += 18;
  doc.setFont("helvetica", "normal"); doc.setFontSize(9); doc.setTextColor(110);
  doc.text("Total Value: R11900.00     Deposit: R5950.00 (50%)", margin, y); y += 24;

  doc.setFont("helvetica", "bold"); doc.setFontSize(11); doc.setTextColor(20);
  doc.text("Agreement", margin, y); y += 16;
  const body = "This agreement is entered into between L.C Digital Solution WebCraft Studios (\"the Service Provider\") and Mokoena Trading CC (\"the Client\") for the following service:\n\nBusiness website design (5 pages), annual Gold Business hosting, brand logo redesign, and an SEO starter pack.\n\nTOTAL PROJECT VALUE: R11900.00\nDEPOSIT REQUIRED: R5950.00 (50% of total value), payable before work commences.\n\nDEPOSIT & REFUND TERMS:\nThe deposit secures the Client's place in the Service Provider's work schedule and covers initial setup, planning, and resource allocation. Once the deposit has been paid and work has commenced, the deposit becomes NON-REFUNDABLE.\n\nThe remaining balance is due on completion of the project, before final delivery, handover, or publishing of the work.\n\nBy signing below, the Client confirms that they have read, understood, and agree to these terms and conditions in full.";
  y = drawParagraphs(doc, body, margin, y, pageW - margin * 2, 13, 6);

  // Signed block (sample)
  y += 6;
  doc.setDrawColor(210); doc.setLineWidth(0.8); doc.line(margin, y, pageW - margin, y); y += 18;
  doc.setFont("helvetica", "bold"); doc.setFontSize(10.5); doc.setTextColor(20);
  doc.text("SIGNED", margin, y); y += 18;
  doc.setFont("helvetica", "normal"); doc.setFontSize(10);
  doc.text("Name: Thabo Mokoena", margin, y); y += 15;
  doc.text("Phone: 082 555 1234", margin, y); y += 15;
  doc.text("Date signed: " + formatDate("2026-08-29") + " 10:42", margin, y); y += 22;
  // sample signature line (real signatures render as an image in production)
  doc.setDrawColor(180); doc.setLineWidth(0.8);
  doc.line(margin, y, margin + 190, y);
  doc.setFontSize(8); doc.setTextColor(150);
  doc.text("(client signature)", margin, y + 12);

  drawDocFooter(doc, S);
  doc.save(join(root, "samples/sample-contract.pdf"));
  console.log("wrote samples/sample-contract.pdf");
}

buildInvoice();
buildContract();
console.log("DONE");
