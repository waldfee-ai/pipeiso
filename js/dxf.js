/* PipeIso – DXF export (AutoCAD R12, ASCII).
 * The printable sheet (an SVG in millimetres) is converted into DXF entities, so the DXF shows the
 * same sheet as the PDF: frame, drawing, dimensions, labels, title block and company logo, each on its own layer.
 * Units are millimetres on the paper (A3 = 420 × 297).
 * The company logo (SVG) becomes lines on layer LOGO: curves are split into short straight pieces, and filled
 * areas are drawn as their outlines (DXF R12 can only fill triangles and quads). */
(function () {
  'use strict';
  const ISO = window.ISO;

  // Layer name -> AutoCAD colour index (7 = black/white, 3 = green, 9 = light grey)
  const LAYERS = { 0: 7, FRAME: 7, TITLEBLOCK: 7, LOGO: 7, ANNOTATION: 7, PIPES: 7, COMPONENTS: 7, DIMENSIONS: 3, ANGLES: 3, LABELS: 7, GRID: 9 };

  const fmt = (v) => { const r = Math.round(v * 1000) / 1000; return Object.is(r, -0) ? '0' : String(r); };
  /** Text for DXF: characters outside plain ASCII written as \U+XXXX (understood by AutoCAD, LibreCAD, …). */
  const dxfText = (s) => String(s).replace(/[^\x20-\x7e]/gu, (ch) => '\\U+' + ch.codePointAt(0).toString(16).toUpperCase().padStart(4, '0'));

  // ---------- colours ----------
  const NAMED = { black: [0, 0, 0], white: [255, 255, 255], red: [255, 0, 0], green: [0, 128, 0], blue: [0, 0, 255], yellow: [255, 255, 0],
    cyan: [0, 255, 255], magenta: [255, 0, 255], gray: [128, 128, 128], grey: [128, 128, 128], orange: [255, 165, 0], navy: [0, 0, 128] };
  /** [r, g, b] of a CSS colour, or null for none / transparent / unknown. */
  function rgbOf(c) {
    if (!c) return null;
    c = String(c).trim().toLowerCase();
    if (c === 'none' || c === 'transparent') return null;
    let m = /^#([0-9a-f]{3})$/.exec(c);
    if (m) return m[1].split('').map((h) => parseInt(h + h, 16));
    m = /^#([0-9a-f]{6})/.exec(c);
    if (m) return [0, 2, 4].map((i) => parseInt(m[1].substr(i, 2), 16));
    m = /^rgba?\(\s*([\d.]+)[\s,]+([\d.]+)[\s,]+([\d.]+)(?:[\s,/]+([\d.]+%?))?\s*\)$/.exec(c);
    if (m) { if (m[4] !== undefined && parseFloat(m[4]) === 0) return null; return [+m[1], +m[2], +m[3]]; }
    return NAMED[c] || null;
  }
  const isWhite = (rgb) => !!rgb && rgb[0] > 245 && rgb[1] > 245 && rgb[2] > 245;
  // A few AutoCAD colour indexes and their colours; the logo uses the nearest one
  const ACI = [[1, 255, 0, 0], [2, 255, 255, 0], [3, 0, 255, 0], [4, 0, 255, 255], [5, 0, 0, 255], [6, 255, 0, 255], [7, 0, 0, 0],
    [8, 128, 128, 128], [9, 192, 192, 192], [30, 255, 127, 0], [40, 255, 191, 0], [94, 0, 127, 0], [140, 0, 127, 255], [150, 0, 63, 255],
    [174, 0, 0, 127], [12, 165, 0, 0], [250, 51, 51, 51], [252, 130, 130, 130], [254, 190, 190, 190]];
  const aciOf = (rgb) => {
    let best = 7, bd = Infinity;
    ACI.forEach(([n, r, g, b]) => { const d = (r - rgb[0]) ** 2 + (g - rgb[1]) ** 2 + (b - rgb[2]) ** 2; if (d < bd) { bd = d; best = n; } });
    return best;
  };

  // ---------- 2D transforms: [a, b, c, d, e, f] like SVG matrix() ----------
  const I = [1, 0, 0, 1, 0, 0];
  const mul = (m, n) => [m[0] * n[0] + m[2] * n[1], m[1] * n[0] + m[3] * n[1], m[0] * n[2] + m[2] * n[3], m[1] * n[2] + m[3] * n[3],
    m[0] * n[4] + m[2] * n[5] + m[4], m[1] * n[4] + m[3] * n[5] + m[5]];
  const apply = (m, p) => [m[0] * p[0] + m[2] * p[1] + m[4], m[1] * p[0] + m[3] * p[1] + m[5]];
  const nums = (s) => (String(s || '').match(/[-+]?(?:\d+\.?\d*|\.\d+)(?:e[-+]?\d+)?/gi) || []).map(parseFloat);
  function parseTransform(s) {
    let m = I;
    const re = /(matrix|translate|scale|rotate|skewX|skewY)\s*\(([^)]*)\)/g;
    let r;
    while ((r = re.exec(s || ''))) {
      const v = nums(r[2]);
      let t = I;
      if (r[1] === 'matrix' && v.length >= 6) t = v.slice(0, 6);
      else if (r[1] === 'translate') t = [1, 0, 0, 1, v[0] || 0, v[1] || 0];
      else if (r[1] === 'scale') t = [v[0] || 1, 0, 0, v[1] === undefined ? v[0] || 1 : v[1], 0, 0];
      else if (r[1] === 'rotate') {
        const a = ((v[0] || 0) * Math.PI) / 180, cs = Math.cos(a), sn = Math.sin(a);
        t = [cs, sn, -sn, cs, 0, 0];
        if (v.length >= 3) t = mul(mul([1, 0, 0, 1, v[1], v[2]], t), [1, 0, 0, 1, -v[1], -v[2]]);
      } else if (r[1] === 'skewX') t = [1, 0, Math.tan(((v[0] || 0) * Math.PI) / 180), 1, 0, 0];
      else if (r[1] === 'skewY') t = [1, Math.tan(((v[0] || 0) * Math.PI) / 180), 0, 1, 0, 0];
      m = mul(m, t);
    }
    return m;
  }
  /** Transform of a nested <svg> (or symbol used with a size): its viewBox fitted into x, y, width, height. */
  function viewportTransform(el, w, h) {
    const x = parseFloat(el.getAttribute('x')) || 0, y = parseFloat(el.getAttribute('y')) || 0;
    const vb = nums(el.getAttribute('viewBox'));
    let m = [1, 0, 0, 1, x, y];
    if (vb.length === 4 && vb[2] > 0 && vb[3] > 0 && w > 0 && h > 0) {
      const par = (el.getAttribute('preserveAspectRatio') || 'xMidYMid meet').trim();
      let sx = w / vb[2], sy = h / vb[3];
      if (!par.startsWith('none')) {
        const s = /slice/.test(par) ? Math.max(sx, sy) : Math.min(sx, sy);
        sx = sy = s;
      }
      const ax = /xMax/.test(par) ? 1 : /xMin/.test(par) ? 0 : 0.5, ay = /YMax/.test(par) ? 1 : /YMin/.test(par) ? 0 : 0.5;
      const tx = x + (w - vb[2] * sx) * ax - vb[0] * sx, ty = y + (h - vb[3] * sy) * ay - vb[1] * sy;
      m = [sx, 0, 0, sy, tx, ty];
    }
    return m;
  }

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

  // ---------- SVG path -> point lists (curves split into straight pieces) ----------
  function pathPolys(d) {
    const tk = String(d || '').match(/[MLHVCSQTAZmlhvcsqtaz]|[-+]?(?:\d+\.?\d*|\.\d+)(?:e[-+]?\d+)?/g) || [];
    const polys = [];
    let cur = null, cmd = '', x = 0, y = 0, sx = 0, sy = 0, i = 0, lc = null, lq = null; // lc/lq: last control points
    const isNum = (t) => t !== undefined && !/^[a-z]$/i.test(t);
    const num = () => parseFloat(tk[i++]);
    const flag = () => { const t = tk[i]; if (t && /^[01]{2,}/.test(t)) { tk[i] = t.slice(1); return +t[0]; } i++; return +t; };
    const add = (p) => { if (!cur) { cur = [[x, y]]; polys.push(cur); } cur.push(p); };
    const cubic = (p1, p2, p3) => {
      const p0 = [x, y], n = 16;
      for (let k = 1; k <= n; k++) {
        const t = k / n, u = 1 - t;
        add([u * u * u * p0[0] + 3 * u * u * t * p1[0] + 3 * u * t * t * p2[0] + t * t * t * p3[0],
          u * u * u * p0[1] + 3 * u * u * t * p1[1] + 3 * u * t * t * p2[1] + t * t * t * p3[1]]);
      }
    };
    const quad = (p1, p2) => {
      const p0 = [x, y], n = 12;
      for (let k = 1; k <= n; k++) { const t = k / n, u = 1 - t; add([u * u * p0[0] + 2 * u * t * p1[0] + t * t * p2[0], u * u * p0[1] + 2 * u * t * p1[1] + t * t * p2[1]]); }
    };
    const arc = (rx, ry, rot, large, sweep, x2, y2) => {
      // SVG endpoint arc -> centre form (SVG spec F.6.5)
      if (!(rx > 0 && ry > 0) || (x === x2 && y === y2)) { add([x2, y2]); return; }
      const phi = (rot * Math.PI) / 180, cp = Math.cos(phi), sp = Math.sin(phi);
      const dx = (x - x2) / 2, dy = (y - y2) / 2;
      const x1p = cp * dx + sp * dy, y1p = -sp * dx + cp * dy;
      const lam = (x1p * x1p) / (rx * rx) + (y1p * y1p) / (ry * ry);
      if (lam > 1) { rx *= Math.sqrt(lam); ry *= Math.sqrt(lam); }
      const num2 = rx * rx * ry * ry - rx * rx * y1p * y1p - ry * ry * x1p * x1p;
      let co = Math.sqrt(Math.max(0, num2 / (rx * rx * y1p * y1p + ry * ry * x1p * x1p)));
      if (large === sweep) co = -co;
      const cxp = (co * rx * y1p) / ry, cyp = (-co * ry * x1p) / rx;
      const cx = cp * cxp - sp * cyp + (x + x2) / 2, cy = sp * cxp + cp * cyp + (y + y2) / 2;
      const ang = (ux, uy, vx, vy) => Math.atan2(ux * vy - uy * vx, ux * vx + uy * vy);
      const t1 = ang(1, 0, (x1p - cxp) / rx, (y1p - cyp) / ry);
      let dt = ang((x1p - cxp) / rx, (y1p - cyp) / ry, (-x1p - cxp) / rx, (-y1p - cyp) / ry);
      if (!sweep && dt > 0) dt -= 2 * Math.PI; else if (sweep && dt < 0) dt += 2 * Math.PI;
      const n = Math.max(4, Math.ceil(Math.abs(dt) / (Math.PI / 18)));
      for (let k = 1; k <= n; k++) {
        const t = t1 + (dt * k) / n;
        add([cx + rx * Math.cos(t) * cp - ry * Math.sin(t) * sp, cy + rx * Math.cos(t) * sp + ry * Math.sin(t) * cp]);
      }
    };
    while (i < tk.length) {
      if (/^[a-z]$/i.test(tk[i])) cmd = tk[i++];
      else if (!cmd) { i++; continue; }
      const rel = cmd === cmd.toLowerCase(), C = cmd.toUpperCase();
      const ox = rel ? x : 0, oy = rel ? y : 0;
      if (C === 'Z') { if (cur) cur.push([sx, sy]); cur = null; x = sx; y = sy; lc = lq = null; cmd = ''; continue; }
      if (!isNum(tk[i])) { cmd = ''; continue; }
      if (C === 'M') {
        x = ox + num(); y = oy + num(); cur = [[x, y]]; polys.push(cur); sx = x; sy = y; lc = lq = null;
        cmd = rel ? 'l' : 'L';
      } else if (C === 'L') { const p = [ox + num(), oy + num()]; add(p); [x, y] = p; lc = lq = null; }
      else if (C === 'H') { x = ox * (rel ? 1 : 0) + num(); add([x, y]); lc = lq = null; }
      else if (C === 'V') { y = (rel ? oy : 0) + num(); add([x, y]); lc = lq = null; }
      else if (C === 'C') {
        const p1 = [ox + num(), oy + num()], p2 = [ox + num(), oy + num()], p3 = [ox + num(), oy + num()];
        cubic(p1, p2, p3); [x, y] = p3; lc = p2; lq = null;
      } else if (C === 'S') {
        const p1 = lc ? [2 * x - lc[0], 2 * y - lc[1]] : [x, y];
        const p2 = [ox + num(), oy + num()], p3 = [ox + num(), oy + num()];
        cubic(p1, p2, p3); [x, y] = p3; lc = p2; lq = null;
      } else if (C === 'Q') {
        const p1 = [ox + num(), oy + num()], p2 = [ox + num(), oy + num()];
        quad(p1, p2); [x, y] = p2; lq = p1; lc = null;
      } else if (C === 'T') {
        const p1 = lq ? [2 * x - lq[0], 2 * y - lq[1]] : [x, y];
        const p2 = [ox + num(), oy + num()];
        quad(p1, p2); [x, y] = p2; lq = p1; lc = null;
      } else if (C === 'A') {
        const rx = Math.abs(num()), ry = Math.abs(num()), rot = num(), large = flag(), sweep = flag();
        const x2 = ox + num(), y2 = oy + num();
        arc(rx, ry, rot, large, sweep, x2, y2); x = x2; y = y2; lc = lq = null;
      } else { i++; }
      if ([x, y].some(isNaN)) break;
    }
    return polys.filter((p) => p.length > 1);
  }

  const ptsAttr = (s) => {
    const v = nums(s);
    const out = [];
    for (let i = 0; i + 1 < v.length; i += 2) out.push([v[i], v[i + 1]]);
    return out;
  };
  const ellipsePts = (cx, cy, rx, ry, n = 48) => Array.from({ length: n + 1 }, (_, k) => {
    const t = (2 * Math.PI * k) / n;
    return [cx + rx * Math.cos(t), cy + ry * Math.sin(t)];
  });

  /** Convert a sheet SVG string (viewBox 0 0 W H, mm) into DXF text. */
  function svgToDxf(svgText, W, H) {
    const docx = new DOMParser().parseFromString(svgText, 'image/svg+xml');
    const root = docx.documentElement;
    const ents = [];
    let color = 0; // AutoCAD colour index for the next entity; 0 = by layer
    const g = (code, val) => ents.push(String(code), typeof val === 'number' ? fmt(val) : String(val));
    const head = (type, L) => { g(0, type); g(8, L); if (color) g(62, color); };
    const X = (p) => p[0], Y = (p) => H - p[1];           // SVG y grows downward, DXF y upward
    const same = (a, b) => Math.abs(a[0] - b[0]) < 1e-6 && Math.abs(a[1] - b[1]) < 1e-6;

    const lineE = (L, a, b) => {
      if (same(a, b)) return;
      head('LINE', L); g(10, X(a)); g(20, Y(a)); g(30, 0); g(11, X(b)); g(21, Y(b)); g(31, 0);
    };
    /** POLYLINE; width > 0 draws it with that constant width; bulges for arcs (discs). */
    const polyE = (L, pts, closed, width, bulges) => {
      head('POLYLINE', L); g(66, 1); g(10, 0); g(20, 0); g(30, 0); g(70, closed ? 1 : 0);
      if (width > 0) { g(40, width); g(41, width); }
      pts.forEach((p, i) => {
        g(0, 'VERTEX'); g(8, L); g(10, X(p)); g(20, Y(p)); g(30, 0);
        if (bulges && bulges[i]) g(42, bulges[i]);
      });
      g(0, 'SEQEND'); g(8, L);
    };
    const circleE = (L, c, r) => { head('CIRCLE', L); g(10, X(c)); g(20, Y(c)); g(30, 0); g(40, r); };
    /** Filled disc: closed polyline of two half circles with width = radius. */
    const discE = (L, c, r) => polyE(L, [[c[0] - r / 2, c[1]], [c[0] + r / 2, c[1]]], true, r, [1, 1]);
    /** Filled triangle or quad (DXF SOLID wants the 3rd and 4th corner swapped). */
    const solidE = (L, p) => {
      const q = p.length === 3 ? [p[0], p[1], p[2], p[2]] : [p[0], p[1], p[3], p[2]];
      head('SOLID', L);
      q.forEach((v, i) => { g(10 + i, X(v)); g(20 + i, Y(v)); g(30 + i, 0); });
    };
    const fillPoly = (L, pts) => {
      if (pts.length > 1 && same(pts[0], pts[pts.length - 1])) pts = pts.slice(0, -1);
      if (pts.length === 3 || pts.length === 4) { solidE(L, pts); return; }
      for (let i = 1; i + 1 < pts.length; i++) solidE(L, [pts[0], pts[i], pts[i + 1]]); // convex shapes only
    };
    /** Lines through a list of points (already on the sheet), clipped to rect when one is active. */
    const strokePts = (L, pts, closed, clip, width) => {
      if (closed && pts.length > 2 && !same(pts[0], pts[pts.length - 1])) pts = pts.concat([pts[0]]);
      if (clip) {
        for (let i = 0; i + 1 < pts.length; i++) { const s = clipSeg(pts[i], pts[i + 1], clip); if (s) lineE(L, s[0], s[1]); }
        return;
      }
      if (pts.length === 2 && !(width > 0)) { lineE(L, pts[0], pts[1]); return; }
      if (pts.length >= 2) {
        const isClosed = closed || (pts.length > 3 && same(pts[0], pts[pts.length - 1]));
        polyE(L, isClosed ? pts.slice(0, -1) : pts, isClosed, width);
      }
    };
    const textE = (L, p, h, s, rot, ha, va) => {
      if (!String(s).trim() || !(h > 0)) return;
      head('TEXT', L); g(10, X(p)); g(20, Y(p)); g(30, 0); g(40, h); g(1, dxfText(s));
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
    /** Attribute value, inherited from parent elements. */
    const attr = (el, name) => {
      for (let e = el; e && e.getAttribute; e = e.parentNode) { const v = e.getAttribute(name); if (v != null) return v; }
      return null;
    };
    /** Colour of a fill or stroke value; a gradient gives the colour of its first stop. */
    const paint = (v) => {
      if (!v) return null;
      const m = /url\(\s*['"]?#([^'")\s]+)/.exec(v);
      if (m) {
        const gr = docx.getElementById(m[1]);
        const stop = gr && gr.querySelector('stop');
        return stop ? rgbOf(stop.getAttribute('stop-color') || '#000') : null;
      }
      return rgbOf(v);
    };
    const opacityOk = (el) => { for (let e = el; e && e.getAttribute; e = e.parentNode) { if (parseFloat(e.getAttribute('opacity')) === 0) return false; } return true; };

    /** Draw one element with transform M (to sheet mm), on layer L. */
    function node(c, L, clip, M, depth) {
      const tag = c.localName;
      if (depth > 40 || tag === 'clipPath' || tag === 'defs' || tag === 'image' || tag === 'mask' || tag === 'pattern' ||
        tag === 'linearGradient' || tag === 'radialGradient' || tag === 'marker' || tag === 'style' || tag === 'symbol') return;
      L = c.getAttribute('data-layer') || L;
      const own = parseTransform(c.getAttribute('transform'));
      let m = mul(M, own);
      const cpRef = c.getAttribute('clip-path');
      if (cpRef) {
        const r = /#([^)'"]+)/.exec(cpRef);
        const rc = r && clips[r[1]];
        if (rc) { // clip rectangle in the element's own coordinates -> on the sheet
          const cs = [[rc.x0, rc.y0], [rc.x1, rc.y0], [rc.x0, rc.y1], [rc.x1, rc.y1]].map((p) => apply(m, p));
          clip = { x0: Math.min(...cs.map((p) => p[0])), y0: Math.min(...cs.map((p) => p[1])), x1: Math.max(...cs.map((p) => p[0])), y1: Math.max(...cs.map((p) => p[1])) };
        }
      }
      if (tag === 'svg') {
        if (c !== root) m = mul(m, viewportTransform(c, parseFloat(c.getAttribute('width')) || 0, parseFloat(c.getAttribute('height')) || 0));
        children(c, L, clip, m, depth);
        return;
      }
      if (tag === 'g') { children(c, L, clip, m, depth); return; }
      if (tag === 'use') {
        const id = (c.getAttribute('href') || c.getAttributeNS('http://www.w3.org/1999/xlink', 'href') || '').replace(/^#/, '');
        const ref = id && docx.getElementById(id);
        if (!ref) return;
        const um = mul(m, [1, 0, 0, 1, parseFloat(c.getAttribute('x')) || 0, parseFloat(c.getAttribute('y')) || 0]);
        if (ref.localName === 'symbol') {
          const w = parseFloat(c.getAttribute('width')) || 0, h = parseFloat(c.getAttribute('height')) || 0;
          children(ref, L, clip, w && h ? mul(um, viewportTransform(ref, w, h)) : um, depth + 1);
        } else node(ref, L, clip, um, depth + 1);
        return;
      }
      if (!opacityOk(c)) return;
      const logo = L === 'LOGO';
      const fillV = attr(c, 'fill'), strokeV = attr(c, 'stroke');
      const fillRgb = fillV === null ? [0, 0, 0] : paint(fillV);
      const strokeRgb = paint(strokeV);
      const showFill = !!fillRgb && !isWhite(fillRgb) && parseFloat(attr(c, 'fill-opacity') ?? 1) !== 0;
      const showStroke = !!strokeRgb && !isWhite(strokeRgb) && parseFloat(attr(c, 'stroke-opacity') ?? 1) !== 0;
      const sw = parseFloat(attr(c, 'stroke-width')) || 0;
      const num = (n) => parseFloat(c.getAttribute(n)) || 0;
      const T = (p) => apply(m, p);
      const scale = Math.sqrt(Math.abs(m[0] * m[3] - m[1] * m[2]));
      const similar = Math.abs(m[0] - m[3]) < 1e-9 && Math.abs(m[1] + m[2]) < 1e-9; // circles stay circles
      const pipeW = L === 'PIPES' ? sw * scale : 0; // pipes keep their thickness
      // The logo: filled areas are drawn as outlines, in the nearest AutoCAD colour
      const outline = (pts, closed) => {
        if (!(showFill || showStroke)) return;
        color = logo ? aciOf(showStroke && !showFill ? strokeRgb : fillRgb) : 0;
        strokePts(L, pts.map(T), closed, clip, 0);
        color = 0;
      };
      if (tag === 'line') {
        if (showStroke) strokePts(L, [[num('x1'), num('y1')], [num('x2'), num('y2')]].map(T), false, clip, pipeW);
      } else if (tag === 'rect') {
        const x = num('x'), y = num('y'), w = num('width'), h = num('height');
        if (!(w > 0 && h > 0)) return;
        const pts = [[x, y], [x + w, y], [x + w, y + h], [x, y + h]];
        if (logo) {
          // rounded corners (rx / ry): a quarter ellipse at each corner
          let rx = num('rx'), ry = num('ry');
          if (rx > 0 || ry > 0) {
            rx = Math.min(rx || ry, w / 2); ry = Math.min(ry || rx, h / 2);
            const q = (cx, cy, a0) => Array.from({ length: 7 }, (_, k) => { const t = a0 + (Math.PI / 2) * (k / 6); return [cx + rx * Math.cos(t), cy + ry * Math.sin(t)]; });
            outline([].concat(q(x + w - rx, y + ry, -Math.PI / 2), q(x + w - rx, y + h - ry, 0), q(x + rx, y + h - ry, Math.PI / 2), q(x + rx, y + ry, Math.PI)), true);
          } else outline(pts, true);
          return;
        }
        if (c.getAttribute('fill') !== null && showFill) fillPoly(L, pts.map(T));
        if (showStroke) strokePts(L, pts.map(T), true, clip, 0);
      } else if (tag === 'polygon' || tag === 'polyline') {
        const pts = ptsAttr(c.getAttribute('points'));
        if (logo) { outline(pts, tag === 'polygon'); return; }
        if (tag === 'polygon' && showFill) fillPoly(L, pts.map(T));
        if (showStroke) strokePts(L, pts.map(T), tag === 'polygon', clip, 0);
      } else if (tag === 'path') {
        const polys = pathPolys(c.getAttribute('d'));
        if (logo) { polys.forEach((pts) => outline(pts, false)); return; }
        if (showStroke) polys.forEach((pts) => strokePts(L, pts.map(T), false, clip, pipeW));
      } else if (tag === 'circle' || tag === 'ellipse') {
        const cx = num('cx'), cy = num('cy');
        const rx = tag === 'circle' ? num('r') : num('rx'), ry = tag === 'circle' ? num('r') : num('ry');
        if (!(rx > 0 && ry > 0)) return;
        if (!(showFill || showStroke)) return;
        color = logo ? aciOf(showStroke && !showFill ? strokeRgb : fillRgb) : 0;
        if (rx === ry && similar) {
          if (showFill && !logo) discE(L, T([cx, cy]), rx * scale);
          else circleE(L, T([cx, cy]), rx * scale);
        } else strokePts(L, ellipsePts(cx, cy, rx, ry).map(T), true, clip, 0);
        color = 0;
      } else if (tag === 'text') {
        if (!showFill) return;
        color = logo ? aciOf(fillRgb) : 0;
        const x = num('x'), y = num('y');
        const fs = (parseFloat(attr(c, 'font-size')) || 3) * scale;
        const ha = { middle: 1, end: 2 }[attr(c, 'text-anchor')] || 0;
        const db = attr(c, 'dominant-baseline');
        const va = db === 'central' || db === 'middle' ? 2 : 0;
        const rot = -(Math.atan2(m[1], m[0]) * 180) / Math.PI; // SVG turns clockwise, DXF counter-clockwise
        const h = fs * 0.72; // cap height of Arial ≈ 0.72 × font size
        const spans = Array.from(c.children).filter((s) => s.localName === 'tspan' && (s.hasAttribute('x') || s.hasAttribute('y')));
        if (!spans.length) textE(L, T([x, y]), h, c.textContent, rot, ha, va);
        else {
          let dy = 0;
          spans.forEach((s) => {
            dy += parseFloat(s.getAttribute('dy')) || 0;
            const sy = s.hasAttribute('y') ? parseFloat(s.getAttribute('y')) : y + dy;
            textE(L, T([s.hasAttribute('x') ? parseFloat(s.getAttribute('x')) : x, sy]), h, s.textContent, rot, ha, va);
          });
        }
        color = 0;
      }
    }
    function children(el, L, clip, M, depth) {
      for (const c of Array.from(el.children)) node(c, L, clip, M, depth + 1);
    }
    node(root, '0', null, I, 0);

    // File: header, tables (line type, layers, text style), entities
    const head2 = [];
    const h = (code, val) => head2.push(String(code), typeof val === 'number' ? fmt(val) : String(val));
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
    return head2.concat(ents, tail).join('\r\n') + '\r\n';
  }

  /** DXF of the printable sheet for a drawing (paper 'A3' or 'A4'). */
  ISO.sheetToDXF = (doc, paper) => {
    const P = ISO.PAPERS[paper] || ISO.PAPERS.A3;
    return svgToDxf(ISO.renderSheet(doc, { paper }), P.W, P.H);
  };
  ISO._dxf = { pathPolys, parseTransform }; // for tests
})();
