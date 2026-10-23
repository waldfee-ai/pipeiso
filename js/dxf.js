/* PipeIso – DXF export (AutoCAD R12, ASCII).
 * The printable sheet (an SVG in millimetres) is converted into DXF entities, so the DXF shows the
 * same sheet as the PDF: frame, drawing, dimensions, labels and title block, each on its own layer.
 * Units are millimetres on the paper (A3 = 420 × 297). The company logo is not included (DXF R12 has no images). */
(function () {
  'use strict';
  const ISO = window.ISO;

  // Layer name -> AutoCAD colour index (7 = black/white, 3 = green, 9 = light grey)
  const LAYERS = { 0: 7, FRAME: 7, TITLEBLOCK: 7, ANNOTATION: 7, PIPES: 7, COMPONENTS: 7, DIMENSIONS: 3, LABELS: 7, GRID: 9 };

  const fmt = (v) => { const r = Math.round(v * 1000) / 1000; return Object.is(r, -0) ? '0' : String(r); };
  const isWhite = (c) => /^(#fff|#ffffff|white)$/i.test(String(c || '').trim());
  const visible = (c) => !!c && c !== 'none' && c !== 'transparent' && !isWhite(c);
  /** Text for DXF: characters outside plain ASCII written as \U+XXXX (understood by AutoCAD, LibreCAD, …). */
  const dxfText = (s) => String(s).replace(/[^\x20-\x7e]/gu, (ch) => '\\U+' + ch.codePointAt(0).toString(16).toUpperCase().padStart(4, '0'));

  /** Clip segment a-b to rectangle r (Liang–Barsky). Returns the visible part or null. */
  function clipSeg(a, b, r) {
    let t0 = 0, t1 = 1;
    const dx = b[0] - a[0], dy = b[1] - a[1];
    const p = [-dx, dx, -dy, dy], q = [a[0] - r.x0, r.x1 - a[0], a[1] - r.y0, r.y1 - a[1]];
    for (let i = 0; i < 4; i++) {
      if (p[i] === 0) { if (q[i] < 0) return null; continue; }
      const t = q[i] / p[i];
      if (p[i] < 0) { if (t > t1) return null; if (t > t0) t0 = t; } else { if (t < t0) return null; if (t < t1) t1 = t; }
    }
    return [[a[0] + dx * t0, a[1] + dy * t0], [a[0] + dx * t1, a[1] + dy * t1]];
  }

  /** Point lists of an SVG path (M, L, H, V, Z; absolute and relative). Curves are not used by PipeIso. */
  function pathPolys(d) {
    const tk = String(d).match(/[MLHVZmlhvz]|[-+]?(?:\d+\.?\d*|\.\d+)(?:e[-+]?\d+)?/g) || [];
    const polys = [];
    let cur = null, cmd = '', x = 0, y = 0, sx = 0, sy = 0, i = 0;
    const num = () => parseFloat(tk[i++]);
    const to = (nx, ny) => {
      x = nx; y = ny;
      if (!cur) { cur = [[x, y]]; polys.push(cur); } else cur.push([x, y]);
    };
    while (i < tk.length) {
      if (/^[a-z]$/i.test(tk[i])) cmd = tk[i++];
      const rel = cmd === cmd.toLowerCase();
      const C = cmd.toUpperCase();
      if (C === 'Z') { if (cur) cur.push([sx, sy]); cur = null; x = sx; y = sy; cmd = ''; continue; }
      if (!C || i >= tk.length) { i++; continue; }
      if (C === 'M') {
        const nx = num(), ny = num();
        if (isNaN(nx) || isNaN(ny)) break;
        x = rel ? x + nx : nx; y = rel ? y + ny : ny;
        cur = [[x, y]]; polys.push(cur); sx = x; sy = y;
        cmd = rel ? 'l' : 'L';
      } else if (C === 'L') {
        const nx = num(), ny = num();
        if (isNaN(nx) || isNaN(ny)) break;
        to(rel ? x + nx : nx, rel ? y + ny : ny);
      } else if (C === 'H') {
        const nx = num(); if (isNaN(nx)) break;
        to(rel ? x + nx : nx, y);
      } else if (C === 'V') {
        const ny = num(); if (isNaN(ny)) break;
        to(x, rel ? y + ny : ny);
      } else { i++; }
    }
    return polys;
  }

  const ptsAttr = (s) => {
    const v = String(s || '').trim().split(/[\s,]+/).map(parseFloat);
    const out = [];
    for (let i = 0; i + 1 < v.length; i += 2) out.push([v[i], v[i + 1]]);
    return out;
  };

  /** Convert a sheet SVG string (viewBox 0 0 W H, mm) into DXF text. */
  function svgToDxf(svgText, W, H) {
    const root = new DOMParser().parseFromString(svgText, 'image/svg+xml').documentElement;
    const ents = [];
    const g = (code, val) => ents.push(String(code), typeof val === 'number' ? fmt(val) : String(val));
    const X = (p) => p[0], Y = (p) => H - p[1];           // SVG y grows downward, DXF y upward
    const same = (a, b) => Math.abs(a[0] - b[0]) < 1e-6 && Math.abs(a[1] - b[1]) < 1e-6;

    const lineE = (L, a, b) => {
      if (same(a, b)) return;
      g(0, 'LINE'); g(8, L); g(10, X(a)); g(20, Y(a)); g(30, 0); g(11, X(b)); g(21, Y(b)); g(31, 0);
    };
    /** POLYLINE; width > 0 draws it with that constant width; bulges for arcs (donuts). */
    const polyE = (L, pts, closed, width, bulges) => {
      g(0, 'POLYLINE'); g(8, L); g(66, 1); g(10, 0); g(20, 0); g(30, 0); g(70, closed ? 1 : 0);
      if (width > 0) { g(40, width); g(41, width); }
      pts.forEach((p, i) => {
        g(0, 'VERTEX'); g(8, L); g(10, X(p)); g(20, Y(p)); g(30, 0);
        if (bulges && bulges[i]) g(42, bulges[i]);
      });
      g(0, 'SEQEND'); g(8, L);
    };
    const circleE = (L, c, r) => { g(0, 'CIRCLE'); g(8, L); g(10, X(c)); g(20, Y(c)); g(30, 0); g(40, r); };
    /** Filled disc: closed polyline of two half circles with width = radius. */
    const discE = (L, c, r) => polyE(L, [[c[0] - r / 2, c[1]], [c[0] + r / 2, c[1]]], true, r, [1, 1]);
    /** Filled triangle or quad (DXF SOLID wants the 3rd and 4th corner swapped). */
    const solidE = (L, p) => {
      const q = p.length === 3 ? [p[0], p[1], p[2], p[2]] : [p[0], p[1], p[3], p[2]];
      g(0, 'SOLID'); g(8, L);
      q.forEach((v, i) => { g(10 + i, X(v)); g(20 + i, Y(v)); g(30 + i, 0); });
    };
    const fillPoly = (L, pts) => {
      if (pts.length > 1 && same(pts[0], pts[pts.length - 1])) pts = pts.slice(0, -1);
      if (pts.length === 3 || pts.length === 4) { solidE(L, pts); return; }
      for (let i = 1; i + 1 < pts.length; i++) solidE(L, [pts[0], pts[i], pts[i + 1]]); // convex shapes only
    };
    /** Lines through a list of points, clipped to rect when one is active. */
    const strokePts = (L, pts, closed, clip, width) => {
      if (closed && pts.length > 2 && !same(pts[0], pts[pts.length - 1])) pts = pts.concat([pts[0]]);
      if (clip) {
        for (let i = 0; i + 1 < pts.length; i++) { const s = clipSeg(pts[i], pts[i + 1], clip); if (s) lineE(L, s[0], s[1]); }
        return;
      }
      if (pts.length === 2 && !(width > 0)) { lineE(L, pts[0], pts[1]); return; }
      if (pts.length >= 2) polyE(L, closed ? pts.slice(0, -1) : pts, closed, width);
    };
    const textE = (L, p, h, s, rot, ha, va) => {
      if (!String(s).trim() || !(h > 0)) return;
      g(0, 'TEXT'); g(8, L); g(10, X(p)); g(20, Y(p)); g(30, 0); g(40, h); g(1, dxfText(s));
      if (rot) g(50, rot);
      if (ha || va) { if (ha) g(72, ha); g(11, X(p)); g(21, Y(p)); g(31, 0); if (va) g(73, va); }
    };

    // Clip rectangles by id (used for the isometric paper)
    const clips = {};
    root.querySelectorAll('clipPath').forEach((cp) => {
      const r = cp.querySelector('rect');
      if (!r) return;
      const x = +r.getAttribute('x') || 0, y = +r.getAttribute('y') || 0;
      clips[cp.getAttribute('id')] = { x0: x, y0: y, x1: x + (+r.getAttribute('width') || 0), y1: y + (+r.getAttribute('height') || 0) };
    });
    /** Attribute value, inherited from parent groups. */
    const attr = (el, name) => {
      for (let e = el; e && e.getAttribute; e = e.parentNode) { const v = e.getAttribute(name); if (v != null) return v; }
      return null;
    };

    function walk(el, layer, clip) {
      for (const c of Array.from(el.children)) {
        const tag = c.localName;
        if (tag === 'clipPath' || tag === 'defs' || tag === 'image') continue;
        const L = c.getAttribute('data-layer') || layer;
        let cl = clip;
        const cpRef = c.getAttribute('clip-path');
        if (cpRef) { const m = /#([^)'"]+)/.exec(cpRef); if (m && clips[m[1]]) cl = clips[m[1]]; }
        if (tag === 'g') { walk(c, L, cl); continue; }
        const stroke = attr(c, 'stroke'), fill = attr(c, 'fill');
        const sw = parseFloat(attr(c, 'stroke-width')) || 0;
        const num = (n) => parseFloat(c.getAttribute(n)) || 0;
        const pipeW = L === 'PIPES' ? sw : 0; // pipes keep their thickness
        if (tag === 'line') {
          if (visible(stroke)) strokePts(L, [[num('x1'), num('y1')], [num('x2'), num('y2')]], false, cl, pipeW);
        } else if (tag === 'rect') {
          const x = num('x'), y = num('y'), w = num('width'), h = num('height');
          const pts = [[x, y], [x + w, y], [x + w, y + h], [x, y + h]];
          if (fill !== null && visible(fill)) fillPoly(L, pts);
          if (visible(stroke)) strokePts(L, pts, true, cl, 0);
        } else if (tag === 'polygon' || tag === 'polyline') {
          const pts = ptsAttr(c.getAttribute('points'));
          if (tag === 'polygon' && visible(fill === null ? '#000' : fill)) fillPoly(L, pts);
          if (visible(stroke)) strokePts(L, pts, tag === 'polygon', cl, 0);
        } else if (tag === 'path') {
          if (visible(stroke)) pathPolys(c.getAttribute('d')).forEach((pts) => strokePts(L, pts, false, cl, pipeW));
        } else if (tag === 'circle') {
          const ctr = [num('cx'), num('cy')], r = num('r');
          if (!(r > 0)) continue;
          if (visible(fill === null ? '#000' : fill)) discE(L, ctr, r);
          else if (visible(stroke)) circleE(L, ctr, r);
        } else if (tag === 'text') {
          if (!visible(fill === null ? '#000' : fill)) continue;
          const x = num('x'), y = num('y');
          const fs = parseFloat(attr(c, 'font-size')) || 3;
          const ha = { middle: 1, end: 2 }[attr(c, 'text-anchor')] || 0;
          const db = attr(c, 'dominant-baseline');
          const va = db === 'central' || db === 'middle' ? 2 : 0;
          let rot = 0, rc = [x, y];
          const m = /rotate\(\s*([-\d.e]+)(?:[\s,]+([-\d.e]+)[\s,]+([-\d.e]+))?\s*\)/.exec(c.getAttribute('transform') || '');
          if (m) { rot = parseFloat(m[1]); if (m[2] != null) rc = [parseFloat(m[2]), parseFloat(m[3])]; }
          const turn = (p) => {
            if (!rot) return p;
            const a = (rot * Math.PI) / 180, dx = p[0] - rc[0], dy = p[1] - rc[1];
            return [rc[0] + dx * Math.cos(a) - dy * Math.sin(a), rc[1] + dx * Math.sin(a) + dy * Math.cos(a)];
          };
          const h = fs * 0.72; // cap height of Arial ≈ 0.72 × font size
          const spans = Array.from(c.children).filter((s) => s.localName === 'tspan' && s.hasAttribute('x'));
          if (!spans.length) textE(L, turn([x, y]), h, c.textContent, -rot, ha, va);
          else {
            let dy = 0;
            spans.forEach((s) => {
              dy += parseFloat(s.getAttribute('dy')) || 0;
              textE(L, turn([parseFloat(s.getAttribute('x')) || x, y + dy]), h, s.textContent, -rot, ha, va);
            });
          }
        }
      }
    }
    walk(root, '0', null);

    // File: header, tables (line type, layers, text style), entities
    const head = [];
    const h = (code, val) => head.push(String(code), typeof val === 'number' ? fmt(val) : String(val));
    h(0, 'SECTION'); h(2, 'HEADER');
    h(9, '$ACADVER'); h(1, 'AC1009');
    h(9, '$DWGCODEPAGE'); h(3, 'ANSI_1252');
    h(9, '$INSBASE'); h(10, 0); h(20, 0); h(30, 0);
    h(9, '$EXTMIN'); h(10, 0); h(20, 0); h(30, 0);
    h(9, '$EXTMAX'); h(10, W); h(20, H); h(30, 0);
    h(9, '$LIMMIN'); h(10, 0); h(20, 0);
    h(9, '$LIMMAX'); h(10, W); h(20, H);
    h(9, '$INSUNITS'); h(70, 4);
    h(9, '$MEASUREMENT'); h(70, 1);
    h(0, 'ENDSEC');
    h(0, 'SECTION'); h(2, 'TABLES');
    h(0, 'TABLE'); h(2, 'LTYPE'); h(70, 1);
    h(0, 'LTYPE'); h(2, 'CONTINUOUS'); h(70, 0); h(3, 'Solid line'); h(72, 65); h(73, 0); h(40, 0);
    h(0, 'ENDTAB');
    const names = Object.keys(LAYERS);
    h(0, 'TABLE'); h(2, 'LAYER'); h(70, names.length);
    names.forEach((nm) => { h(0, 'LAYER'); h(2, nm); h(70, 0); h(62, LAYERS[nm]); h(6, 'CONTINUOUS'); });
    h(0, 'ENDTAB');
    h(0, 'TABLE'); h(2, 'STYLE'); h(70, 1);
    h(0, 'STYLE'); h(2, 'STANDARD'); h(70, 0); h(40, 0); h(41, 1); h(50, 0); h(71, 0); h(42, 2.5); h(3, 'arial.ttf'); h(4, '');
    h(0, 'ENDTAB');
    h(0, 'ENDSEC');
    h(0, 'SECTION'); h(2, 'ENTITIES');
    const tail = ['0', 'ENDSEC', '0', 'EOF'];
    return head.concat(ents, tail).join('\r\n') + '\r\n';
  }

  /** DXF of the printable sheet for a drawing (paper 'A3' or 'A4'). */
  ISO.sheetToDXF = (doc, paper) => {
    const P = ISO.PAPERS[paper] || ISO.PAPERS.A3;
    return svgToDxf(ISO.renderSheet(doc, { paper }), P.W, P.H);
  };
})();
