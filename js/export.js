/* PipeIso – file save/open, export (SVG, PNG, PDF, print) and sharing. */
(function () {
  'use strict';
  const ISO = window.ISO;

  // Paper sizes in PDF points (1 pt = 1/72 inch), landscape
  const PAPER_PT = { A3: [1190.55, 841.89], A4: [841.89, 595.28] };
  const paperOf = () => (ISO.PAPERS[ISO.profile.get().paper] ? ISO.profile.get().paper : 'A3');

  const baseName = (doc) => {
    const t = doc.title;
    const n = [t.drawingNo || 'isometric', t.rev ? 'rev' + t.rev : ''].filter(Boolean).join('_');
    return n.replace(/[^\w.-]+/g, '_');
  };

  const download = (blob, name) => {
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = name;
    document.body.appendChild(a);
    a.click();
    setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 1000);
  };

  /** Draw the sheet onto a canvas of the given pixel width. */
  function sheetCanvas(doc, pxWidth) {
    const paper = paperOf();
    const svg = ISO.renderSheet(doc, { pxWidth, paper });
    const url = URL.createObjectURL(new Blob([svg], { type: 'image/svg+xml' }));
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => {
        const P = ISO.PAPERS[paper];
        const cv = document.createElement('canvas');
        cv.width = pxWidth;
        cv.height = Math.round((pxWidth * P.H) / P.W);
        const ctx = cv.getContext('2d');
        ctx.fillStyle = '#fff';
        ctx.fillRect(0, 0, cv.width, cv.height);
        ctx.drawImage(img, 0, 0, cv.width, cv.height);
        URL.revokeObjectURL(url);
        resolve(cv);
      };
      img.onerror = () => { URL.revokeObjectURL(url); reject(new Error(ISO.t('err.png'))); };
      img.src = url;
    });
  }
  const toBlob = (cv, type, q) => new Promise((res) => cv.toBlob(res, type, q));
  const pxFor = (dpi) => Math.round((ISO.PAPERS[paperOf()].W / 25.4) * dpi);

  /** Minimal one-page PDF that contains the sheet as a JPEG image. */
  function buildPdf(jpeg, pxW, pxH, ptW, ptH, title) {
    const enc = new TextEncoder();
    const parts = [];
    const offsets = [];
    let len = 0;
    const push = (x) => { const b = typeof x === 'string' ? enc.encode(x) : x; parts.push(b); len += b.length; };
    const obj = (n, body) => { offsets[n] = len; push(`${n} 0 obj\n`); body(); push('\nendobj\n'); };
    const pdfStr = (s) => '(' + String(s).replace(/[^\x20-\x7e]/g, '?').replace(/([()\\])/g, '\\$1') + ')';
    push('%PDF-1.4\n%âãÏÓ\n');
    obj(1, () => push('<< /Type /Catalog /Pages 2 0 R >>'));
    obj(2, () => push('<< /Type /Pages /Kids [3 0 R] /Count 1 >>'));
    obj(3, () => push(`<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${ptW} ${ptH}] /Resources << /XObject << /Im0 4 0 R >> >> /Contents 5 0 R >>`));
    obj(4, () => {
      push(`<< /Type /XObject /Subtype /Image /Width ${pxW} /Height ${pxH} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${jpeg.length} >>\nstream\n`);
      push(jpeg);
      push('\nendstream');
    });
    const content = `q ${ptW} 0 0 ${ptH} 0 0 cm /Im0 Do Q`;
    obj(5, () => push(`<< /Length ${content.length} >>\nstream\n${content}\nendstream`));
    obj(6, () => push(`<< /Title ${pdfStr(title)} /Producer (PipeIso) >>`));
    const xref = len;
    push('xref\n0 7\n0000000000 65535 f \n' + [1, 2, 3, 4, 5, 6].map((n) => String(offsets[n]).padStart(10, '0') + ' 00000 n \n').join(''));
    push(`trailer\n<< /Size 7 /Root 1 0 R /Info 6 0 R >>\nstartxref\n${xref}\n%%EOF\n`);
    return new Blob(parts, { type: 'application/pdf' });
  }

  async function pdfBlob(doc) {
    const cv = await sheetCanvas(doc, pxFor(200));
    const jpg = await toBlob(cv, 'image/jpeg', 0.92);
    const bytes = new Uint8Array(await jpg.arrayBuffer());
    const [w, h] = PAPER_PT[paperOf()];
    return buildPdf(bytes, cv.width, cv.height, w, h, `${doc.title.drawingNo || ''} ${doc.title.project || ''}`.trim());
  }
  async function pngBlob(doc) { return toBlob(await sheetCanvas(doc, pxFor(300)), 'image/png'); }
  const jsonBlob = (doc) => new Blob([JSON.stringify(doc, null, 2)], { type: 'application/json' });
  const svgBlob = (doc) => new Blob([ISO.renderSheet(doc, { paper: paperOf() })], { type: 'image/svg+xml' });

  /** Make the file for one export format. */
  async function makeFile(doc, kind) {
    const n = baseName(doc);
    if (kind === 'pdf') return new File([await pdfBlob(doc)], `${n}_${paperOf()}.pdf`, { type: 'application/pdf' });
    if (kind === 'png') return new File([await pngBlob(doc)], `${n}_${paperOf()}.png`, { type: 'image/png' });
    if (kind === 'svg') return new File([svgBlob(doc)], `${n}_${paperOf()}.svg`, { type: 'image/svg+xml' });
    return new File([jsonBlob(doc)], `${n}.pipeiso.json`, { type: 'application/json' });
  }

  ISO.exporter = {
    paperOf,
    saveJSON(doc) { download(jsonBlob(doc), baseName(doc) + '.pipeiso.json'); },
    openJSON(file) { return file.text().then((txt) => ISO.migrate(JSON.parse(txt))); },
    exportSVG(doc) { download(svgBlob(doc), `${baseName(doc)}_${paperOf()}.svg`); },
    async exportPNG(doc) { download(await pngBlob(doc), `${baseName(doc)}_${paperOf()}.png`); },
    async exportPDF(doc) { download(await pdfBlob(doc), `${baseName(doc)}_${paperOf()}.pdf`); },

    /** Can this browser hand files to other apps (system share sheet)? */
    canShareFiles() {
      try {
        return !!(navigator.canShare && navigator.canShare({ files: [new File(['x'], 'x.pdf', { type: 'application/pdf' })] }));
      } catch (e) { return false; }
    },

    /** Share the drawing in a format; falls back to a download. Returns 'shared', 'downloaded' or 'cancelled'. */
    async share(doc, kind) {
      const file = await makeFile(doc, kind);
      const title = [doc.title.drawingNo, doc.title.project].filter(Boolean).join(' – ') || 'PipeIso';
      if (navigator.canShare && navigator.canShare({ files: [file] })) {
        try {
          await navigator.share({ files: [file], title, text: title });
          return 'shared';
        } catch (e) {
          if (e && e.name === 'AbortError') return 'cancelled';
        }
      }
      download(file, file.name);
      return 'downloaded';
    },

    /** Opens the browser's print dialog with the sheet at the chosen paper size (vector). */
    print(doc) {
      const paper = paperOf();
      const P = ISO.PAPERS[paper];
      const html = `<!doctype html><html><head><meta charset="utf-8"><title>${ISO.svgUtil.esc(baseName(doc))}</title>
<style>@page{size:${paper} landscape;margin:0}html,body{margin:0;padding:0}svg{display:block;width:${P.W}mm;height:${P.H}mm}</style>
</head><body>${ISO.renderSheet(doc, { paper })}</body></html>`;
      const fr = document.createElement('iframe');
      fr.style.cssText = 'position:fixed;right:0;bottom:0;width:0;height:0;border:0;visibility:hidden';
      document.body.appendChild(fr);
      const d = fr.contentWindow.document;
      d.open(); d.write(html); d.close();
      setTimeout(() => {
        fr.contentWindow.focus();
        fr.contentWindow.print();
        setTimeout(() => fr.remove(), 2000);
      }, 300);
    },
  };
})();
