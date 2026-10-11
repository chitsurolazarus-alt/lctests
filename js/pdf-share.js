/* ==========================================================
   savePdf(doc, filename) — one place that saves every PDF.

   Desktop / Android: normal jsPDF download (unchanged).
   iPhone / iPad: opens the native share sheet with the PDF
   attached, so it can be saved to Files, AirDropped, sent via
   WhatsApp / Mail, etc.  If iOS blocks the automatic share
   (it only allows it straight after a tap, and PDF building can
   take a moment), a small bottom sheet appears with a fresh
   "Save to Files / Share" button and an "Open PDF" fallback.
   ========================================================== */

function pdfIsIOS() {
  return /iPad|iPhone|iPod/.test(navigator.userAgent) ||
    (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1); // iPadOS reports as Mac
}

async function savePdf(doc, filename) {
  if (!pdfIsIOS()) { doc.save(filename); return; }

  const blob = doc.output("blob");
  let file = null;
  try { file = new File([blob], filename, { type: "application/pdf" }); } catch (e) { /* very old iOS */ }

  if (file && navigator.canShare && navigator.canShare({ files: [file] })) {
    try {
      await navigator.share({ files: [file], title: filename.replace(/\.pdf$/i, "") });
      return;
    } catch (e) {
      if (e && e.name === "AbortError") return;   // user closed the share sheet — nothing to do
      /* NotAllowedError etc. → fall through to the manual sheet */
    }
  }
  showPdfSheet(file, blob, filename);
}

function showPdfSheet(file, blob, filename) {
  document.querySelector(".pdf-sheet")?.remove();
  const url = URL.createObjectURL(blob);
  const canShareFile = !!(file && navigator.canShare && navigator.canShare({ files: [file] }));

  const wrap = document.createElement("div");
  wrap.className = "pdf-sheet";
  wrap.setAttribute("role", "dialog");
  wrap.setAttribute("aria-modal", "true");
  wrap.setAttribute("aria-label", "Save or share PDF");
  wrap.innerHTML = `
    <div class="pdf-sheet-box">
      <h3><i class="fas fa-file-pdf"></i> Your PDF is ready</h3>
      <p id="pdfSheetName"></p>
      ${canShareFile ? `<button type="button" class="btn btn-primary" id="pdfShareBtn"><i class="fas fa-share-from-square"></i> Save to Files / Share</button>` : ""}
      <a class="btn ${canShareFile ? "btn-ghost" : "btn-primary"}" id="pdfOpenLink" href="${url}" target="_blank" rel="noopener"><i class="fas fa-up-right-from-square"></i> Open PDF</a>
      ${canShareFile ? "" : `<p style="margin-bottom:10px">After it opens, tap the share icon and choose “Save to Files”.</p>`}
      <button type="button" class="btn btn-ghost" id="pdfCloseBtn">Close</button>
    </div>`;
  document.body.appendChild(wrap);
  wrap.querySelector("#pdfSheetName").textContent = filename;

  const close = () => { wrap.remove(); setTimeout(() => URL.revokeObjectURL(url), 60000); };
  wrap.querySelector("#pdfCloseBtn").addEventListener("click", close);
  wrap.addEventListener("click", (e) => { if (e.target === wrap) close(); });
  wrap.querySelector("#pdfShareBtn")?.addEventListener("click", async () => {
    try {
      await navigator.share({ files: [file], title: filename.replace(/\.pdf$/i, "") });
      close();
    } catch (e) {
      if (e && e.name !== "AbortError") wrap.querySelector("#pdfSheetName").textContent = "Couldn't open the share sheet — use “Open PDF” instead.";
    }
  });
}
