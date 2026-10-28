/* PipeIso – SVG rendering of the drawing (editor view and printable sheet). */
(function () {
  'use strict';
  const ISO = window.ISO;

  const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const r2 = (n) => Math.round(n * 100) / 100;
  const add = (a, b, k = 1) => [a[0] + b[0] * k, a[1] + b[1] * k];
  const sub = (a, b) => [a[0] - b[0], a[1] - b[1]];
  const norm = (v) => { const l = Math.hypot(v[0], v[1]) || 1; return [v[0] / l, v[1] / l]; };
  const lerp = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t];
  const pts = (arr) => arr.map((p) => r2(p[0]) + ',' + r2(p[1])).join(' ');
  const line = (a, b, col, w, extra = '') =>
    `<line x1="${r2(a[0])}" y1="${r2(a[1])}" x2="${r2(b[0])}" y2="${r2(b[1])}" stroke="${col}" stroke-width="${r2(w)}"${extra}/>`;
  const circle = (c, r, fill, stroke, w) =>
    `<circle cx="${r2(c[0])}" cy="${r2(c[1])}" r="${r2(r)}" fill="${fill}"${stroke ? ` stroke="${stroke}" stroke-width="${r2(w)}"` : ''}/>`;
  const poly = (arr, fill, stroke, w) =>
    `<polygon points="${pts(arr)}" fill="${fill}"${stroke ? ` stroke="${stroke}" stroke-width="${r2(w)}" stroke-linejoin="round"` : ''}/>`;

  ISO.svgUtil = { esc, r2, add, sub, norm, lerp };

  /** Screen direction of a 3D axis under projection P. */
  const screenDir = (P, v) => norm(sub(P(v), P([0, 0, 0])));

  /** Geometry of a pipe on screen. */
  ISO.pipeGeom = (doc, pipe, P) => {
    const [a, b] = ISO.pipeEnds(doc, pipe);
    const A = P(a), B = P(b);
    const d = norm(sub(B, A));
    const ax = ISO.axisOf(a, b);
    const n = [-d[1], d[0]];
    let p = n;
    if (ax) p = screenDir(P, ISO.symPerp(ax.v));
    else {
      // 45° pipe: use the 3D axis perpendicular to it that looks most perpendicular on screen
      const L = Math.hypot(b[0] - a[0], b[1] - a[1], b[2] - a[2]) || 1;
      const dv = [(b[0] - a[0]) / L, (b[1] - a[1]) / L, (b[2] - a[2]) / L];
      let best = 0.8;
      [[0, 0, 1], [1, 0, 0], [0, 1, 0]].forEach((v) => {
        if (Math.abs(v[0] * dv[0] + v[1] * dv[1] + v[2] * dv[2]) > 1e-6) return;
        const sd = screenDir(P, v);
        const dot = Math.abs(sd[0] * d[0] + sd[1] * d[1]);
        if (dot < best) { best = dot; p = sd; }
      });
    }
    const o = ax ? screenDir(P, ISO.dimPerp(ax.v)) : n;
    return { A, B, d, p, o, n, axis: ax };
  };

  /**
   * Draw a component symbol centred on c.
   * d = unit direction along the pipe, p = unit "width" direction, n = screen normal, s = symbol size.
   * flip reverses the direction along the pipe; side (+1/-1) picks which side of the pipe
   * stems, levers, flat sides, clamps and tie rods are drawn on.
   */
  ISO.drawFitting = (type, c, d, p, n, s, st, flip, side) => {
    const col = st.col, bg = st.bg, w = st.thin * 1.5;
    const sd = side === -1 ? -1 : 1, fd = flip ? -1 : 1;
    const dd = [d[0] * fd, d[1] * fd];
    const sa = st.sa || s;                                    // half-length along the pipe (components stretch to their length)
    const at = (u, v) => add(add(c, d, u * sa), p, v * s);  // u along pipe, v across
    const atW = (u, v) => add(add(c, d, u * s), p, v * s);  // fixed-size details (handwheel, lever)
    const atS = (u, v) => at(u, v * sd);                      // v > 0 = chosen side
    const atD = (u, v) => at(u * fd, v);                      // u > 0 = chosen direction
    const atSD = (u, v) => at(u * fd, v * sd);
    const L = (a, b, k = 1) => line(a, b, col, w * k);
    const bowtie = (fillUp = bg, fillDown = bg) =>
      poly([c, atD(-1, 0.62), atD(-1, -0.62)], fillUp, col, w) + poly([c, atD(1, 0.62), atD(1, -0.62)], fillDown, col, w);
    const handwheel = () => L(c, atS(0, 1.3)) + L(atW(-0.55, 1.3 * sd), atW(0.55, 1.3 * sd), 1.5);
    const lever = () => L(c, atS(0, 1.1)) + L(atS(0, 1.1), atW(1.1 * fd, 1.1 * sd), 1.4);
    // Circle around the pipe, in the plane across it (spanned by p and the third axis q): an ellipse in isometric view.
    // On an isometric drawing the three axes satisfy E − N + U = 0, so q is d + p or d − p (whichever has unit length).
    const ring = () => {
      let q = [d[0] + p[0], d[1] + p[1]];
      if (Math.abs(Math.hypot(q[0], q[1]) - 1) > 0.05) q = [d[0] - p[0], d[1] - p[1]];
      if (Math.abs(Math.hypot(q[0], q[1]) - 1) > 0.05) q = [d[0] * 0.45, d[1] * 0.45]; // 45° pipes, palette icon
      let z = '';
      for (let i = 0; i < 24; i++) {
        const t = (i / 24) * 2 * Math.PI, pt = add(add(c, p, Math.cos(t) * 0.75 * s), q, Math.sin(t) * 0.75 * s);
        z += (i ? 'L' : 'M') + r2(pt[0]) + ' ' + r2(pt[1]);
      }
      return `<path d="${z}Z" fill="none" stroke="${col}" stroke-width="${r2(w * 1.1)}"/>`;
    };
    switch (type) {
      case 'gate': return handwheel() + bowtie();
      case 'globe': return handwheel() + bowtie() + circle(c, 0.27 * s, col);
      case 'ball': return lever() + bowtie() + circle(c, 0.34 * s, bg, col, w);
      case 'check': return bowtie(bg, col) + circle(atSD(-1, 0.62), 0.2 * s, col);
      case 'needle':
        return L(c, atS(0, 1.35)) + L(atW(-0.4, 1.35 * sd), atW(0.4, 1.35 * sd), 1.5) + bowtie() +
          poly([c, atW(-0.22, 0.6 * sd), atW(0.22, 0.6 * sd)], col);
      case 'relief': {
        let z = '';
        for (let i = 0; i <= 6; i++) { const q = atW(i % 2 ? 0.28 : -0.28, (0.45 + i * 0.16) * sd); z += (i ? 'L' : 'M') + r2(q[0]) + ' ' + r2(q[1]); }
        return L(c, atS(0, 0.45)) + `<path d="${z}" fill="none" stroke="${col}" stroke-width="${r2(w)}"/>` +
          L(atW(-0.4, 1.5 * sd), atW(0.4, 1.5 * sd), 1.5) + bowtie(bg, col);
      }
      case 'silencer': {
        const inner = [-0.5, 0, 0.5].map((u) => L(at(u, 0.42), at(u, -0.42), 0.8)).join('');
        return poly([at(-0.95, 0.7), at(0.95, 0.7), at(0.95, -0.7), at(-0.95, -0.7)], bg, col, w) + inner +
          L(atD(0.95, 0.35), add(atD(0.95, 0.35), add([dd[0] * 0.3 * s, dd[1] * 0.3 * s], p, 0.25 * s))) +
          L(atD(0.95, -0.35), add(atD(0.95, -0.35), add([dd[0] * 0.3 * s, dd[1] * 0.3 * s], p, -0.25 * s)));
      }
      case 'butterfly':
        return lever() + L(at(-0.35, 0.8), at(-0.35, -0.8), 1.3) + L(at(0.35, 0.8), at(0.35, -0.8), 1.3) +
          L(atS(-0.35, -0.8), atS(0.35, 0.8));
      case 'flange':
        return L(at(-0.2, 0.75), at(-0.2, -0.75), 1.4) + L(at(0.2, 0.75), at(0.2, -0.75), 1.4) +
          `<polyline points="${pts([atS(-0.34, 0.75), atS(-0.34, 1.02), atS(0.34, 1.02), atS(0.34, 0.75)])}" fill="none" stroke="${col}" stroke-width="${r2(w)}"/>`;
      case 'flange1':
        return poly([atD(0, 0.42), atD(-0.5, 0.22), atD(-0.5, -0.22), atD(0, -0.42)], bg, col, w) + L(atD(0, 0.8), atD(0, -0.8), 1.8);
      case 'blind':
        return L(atD(-0.12, 0.75), atD(-0.12, -0.75), 1.4) + poly([atD(0, 0.85), atD(0.28, 0.85), atD(0.28, -0.85), atD(0, -0.85)], col, col, w);
      case 'reducer':
        return poly([atD(-0.9, 0.6), atD(0.9, 0.32), atD(0.9, -0.32), atD(-0.9, -0.6)], bg, col, w);
      case 'reducerEcc':
        return poly([atSD(-0.9, 0.6), atSD(0.9, 0.6), atSD(0.9, 0.04), atSD(-0.9, -0.6)], bg, col, w);
      case 'bellows': {
        let top = '', bot = '';
        for (let i = 0; i <= 6; i++) {
          const u = -0.72 + i * 0.24, v = i % 2 ? 0.38 : 0.72;
          const a = at(u, v), b = at(u, -v);
          top += (i ? 'L' : 'M') + r2(a[0]) + ' ' + r2(a[1]);
          bot += (i ? 'L' : 'M') + r2(b[0]) + ' ' + r2(b[1]);
        }
        return poly([at(-0.72, 0.72), at(0.72, 0.72), at(0.72, -0.72), at(-0.72, -0.72)], bg) +
          `<path d="${top}${bot}" fill="none" stroke="${col}" stroke-width="${r2(w)}" stroke-linejoin="round"/>` +
          L(atD(-0.95, 0.85), atD(-0.95, -0.85), 1.4) + L(atD(0.95, 0.85), atD(0.95, -0.85), 2.8) +
          `<polyline points="${pts([atS(-0.95, 0.85), atS(-0.95, 1.08), atS(0.95, 1.08), atS(0.95, 0.85)])}" fill="none" stroke="${col}" stroke-width="${r2(w)}" stroke-dasharray="${r2(s * 0.22)} ${r2(s * 0.12)}"/>`;
      }
      case 'hose': {
        let d2 = '';
        for (let i = 0; i <= 24; i++) {
          const u = -1.1 + (2.2 * i) / 24;
          const q = atS(u, 0.1 + 0.3 * Math.sin((u + 1.1) * Math.PI * 1.37));
          d2 += (i ? 'L' : 'M') + r2(q[0]) + ' ' + r2(q[1]);
        }
        const lw = st.lw || w * 2;
        return line(at(-1.1, 0), at(1.1, 0), bg, lw * 1.8) +
          `<path d="${d2}" fill="none" stroke="${col}" stroke-width="${r2(lw * 0.8)}" stroke-linecap="round"/>` +
          L(atD(-1.1, 0.42), atD(-1.1, -0.42), 1.3) + L(atD(1.1, 0.62), atD(1.1, -0.62), 2.2);
      }
      case 'clamp': {
        // ring around the pipe (a circle across the pipe, an ellipse in isometric view) with two bolt lugs on the chosen side
        const P = [p[0] * sd, p[1] * sd];
        return ring() + L(add(add(c, P, 0.75 * s), d, -0.2 * s), add(add(c, P, 1.25 * s), d, -0.2 * s), 1.1) +
          L(add(add(c, P, 0.75 * s), d, 0.2 * s), add(add(c, P, 1.25 * s), d, 0.2 * s), 1.1);
      }
      case 'weldclamp': {
        // ring with a stem to a base plate, welded on with fillet welds (filled triangles) on both sides of the stem
        const P = [p[0] * sd, p[1] * sd];
        const J = add(c, P, 1.55 * s);
        const tri = (k) => poly([add(J, d, 0.07 * k * s), add(J, d, 0.5 * k * s), add(add(J, d, 0.07 * k * s), P, -0.42 * s)], col);
        return ring() + L(add(c, P, 0.75 * s), J, 1.1) + L(add(J, d, -0.8 * s), add(J, d, 0.8 * s), 2.2) + tri(-1) + tri(1);
      }
      case 'weld': return circle(c, 0.3 * s, col);
      case 'fieldweld': {
        const r = 0.42 * s, k = r * 0.7;
        return circle(c, r, bg, col, w) + L([c[0] - k, c[1] - k], [c[0] + k, c[1] + k]) + L([c[0] - k, c[1] + k], [c[0] + k, c[1] - k]);
      }
      case 'flow':
        return poly([add(c, dd, s * 0.95), add(add(c, dd, -s * 0.55), n, 0.5 * s), add(add(c, dd, -s * 0.55), n, -0.5 * s)], col);
      default: return '';
    }
  };

  /** Reading angle (deg) for text running along d, kept upright. */
  const textAngle = (d) => {
    let a = (Math.atan2(d[1], d[0]) * 180) / Math.PI;
    if (a > 90.5) a -= 180;
    if (a <= -90.5) a += 180;
    return a;
  };

  ISO.labelPos = (doc, lab, P, sym) => {
    const pipe = ISO.byId(doc.pipes, lab.pipeId);
    const g = ISO.pipeGeom(doc, pipe, P);
    const anchor = lerp(g.A, g.B, lab.t);
    return { anchor, pos: [anchor[0] + lab.ox * sym, anchor[1] + lab.oy * sym] };
  };

  /** Approximate label text box (for hit testing). */
  ISO.labelBox = (lab, pos, font) => {
    const lines = String(lab.text || ' ').split('\n');
    const w = Math.max(...lines.map((l) => l.length)) * font * 0.58 + font * 0.4;
    const h = lines.length * font * 1.2;
    const x = lab.ox >= 0 ? pos[0] : pos[0] - w;
    return { x, y: pos[1] - font * 0.8, w, h };
  };

  /** Chain dimension of the supports on a pipe, in mm from the pipe start: pipe start → support (its width) → … → pipe end.
   *  Returns { L, segs: [{ a, b, fid, field }] } (field: 'pos' = distance to the support, 'w' = its width), or null. */
  ISO.supportChain = (doc, pipe) => {
    const L = ISO.pipeLen(doc, pipe);
    const sup = doc.fittings.filter((f) => f.pipeId === pipe.id && ISO.FITTINGS[f.type] && ISO.FITTINGS[f.type].support).sort((x, y) => x.t - y.t);
    if (!sup.length || L < 1) return null;
    const segs = [];
    let prev = 0;
    sup.forEach((f) => {
      const w = Math.min(ISO.supportWidth(f), L), c = f.t * L;
      const e1 = Math.max(prev, Math.min(L, c - w / 2)), e2 = Math.max(e1, Math.min(L, c + w / 2));
      segs.push({ a: prev, b: e1, fid: f.id, field: 'pos' }, { a: e1, b: e2, fid: f.id, field: 'w' });
      prev = e2;
    });
    segs.push({ a: prev, b: L, fid: sup[sup.length - 1].id, field: 'pos' });
    return { L, segs };
  };
  /** Screen geometry of a support chain: the dimension line runs on the side opposite the pipe's length dimension.
   *  Returns { off2, gap, at(mm) → point on the line, text(seg) → { pos, out } }. */
  ISO.chainGeom = (pipe, g, sym, font, L) => {
    const { off, gap } = ISO.dimGeom(pipe, g, sym);
    const off2 = [-off[0], -off[1]];
    const at = (mm) => add(lerp(g.A, g.B, mm / L), off2, gap);
    const text = (seg) => {
      const a = at(seg.a), b = at(seg.b);
      const narrow = Math.hypot(b[0] - a[0], b[1] - a[1]) < font * 2.2; // too short for its number: put the number further out
      return { pos: add(lerp(a, b, 0.5), off2, font * (narrow ? 2.1 : 0.85)), narrow };
    };
    return { off2, gap, at, text };
  };

  /** Where a pipe's dimension line sits on screen: A2-B2 is the line, off the side it is on (flipped with pipe.dimFlip). */
  ISO.dimGeom = (pipe, g, sym) => {
    const off = pipe.dimFlip ? [-g.o[0], -g.o[1]] : g.o;
    const gap = sym * 2.6;
    return { off, gap, A2: add(g.A, off, gap), B2: add(g.B, off, gap) };
  };

  /** Elbows: points where exactly two pipes meet at an angle. Returns [{ id, n, u, v, len, th, deg }]
   *  (n = the point, u / v = unit directions to the far pipe ends, th / deg = the true angle between the pipes). */
  ISO.elbowAngles = (doc) => {
    const v3 = ISO.v3, res = [];
    Object.keys(doc.nodes).forEach((id) => {
      const ps = ISO.pipesAt(doc, id);
      if (ps.length !== 2) return;
      const n = ISO.nodePt(doc, id);
      const far = ps.map((p) => v3.sub(ISO.nodePt(doc, p.a === id ? p.b : p.a), n));
      const len = far.map(v3.len);
      if (len.some((l) => l < 1)) return;
      const u = v3.scale(far[0], 1 / len[0]), v = v3.scale(far[1], 1 / len[1]);
      const th = Math.acos(Math.max(-1, Math.min(1, u[0] * v[0] + u[1] * v[1] + u[2] * v[2])));
      const deg = (th * 180) / Math.PI;
      if (deg > 179.5 || deg < 0.5) return; // straight on: no angle
      res.push({ id, n, u, v, len, th, deg });
    });
    return res;
  };
  ISO.isRightAngle = (deg) => Math.abs(deg - 90) < 0.05;

  /**
   * Render the drawing to SVG markup.
   * o = { P, sym, font, lw, thin, col, bg, dimCol, selCol, sel, hover }
   */
  ISO.renderDrawing = (doc, o) => {
    // Parts are collected per layer (used as layer names in the DXF export)
    const lay = { dims: [], angles: [], pipes: [], comps: [], marks: [], labels: [], sel: [] };
    let out = lay.dims;
    const st = { col: o.col, bg: o.bg, thin: o.thin, lw: o.lw };
    const isSel = (type, id) => o.sel && o.sel.type === type && o.sel.id === id;
    const isHover = (type, id) => o.hover && o.hover.type === type && o.hover.id === id;
    const geoms = new Map(doc.pipes.map((p) => [p.id, ISO.pipeGeom(doc, p, o.P)]));

    // Dimensions
    if (doc.settings.showDims) {
      doc.pipes.forEach((pipe) => {
        if (pipe.hideDim) return;
        const g = geoms.get(pipe.id);
        const L = ISO.pipeLen(doc, pipe);
        if (L < 1) return;
        const dc = isHover('dim', pipe.id) ? o.hoverCol : o.dimCol || o.col; // highlighted when it can be clicked
        const { A2, B2, off, gap } = ISO.dimGeom(pipe, g, o.sym);
        const tw = o.thin;
        out.push(line(add(g.A, off, o.sym * 0.9), add(g.A, off, gap + o.sym * 0.6), dc, tw));
        out.push(line(add(g.B, off, o.sym * 0.9), add(g.B, off, gap + o.sym * 0.6), dc, tw));
        out.push(line(A2, B2, dc, tw));
        const tk = norm(add(g.d, off));
        [A2, B2].forEach((q) => out.push(line(add(q, tk, -o.sym * 0.45), add(q, tk, o.sym * 0.45), dc, tw * 1.6)));
        const mid = add(lerp(A2, B2, 0.5), off, o.font * 0.85);
        const ang = r2(textAngle(g.d));
        out.push(`<text x="${r2(mid[0])}" y="${r2(mid[1])}" transform="rotate(${ang} ${r2(mid[0])} ${r2(mid[1])})" ` +
          `font-size="${r2(o.font)}" fill="${dc}" text-anchor="middle" dominant-baseline="central">${Math.round(L)}</text>`);

        // Supports on this pipe: chain dimension on the other side (pipe start → support width → … → pipe end)
        const ch = ISO.supportChain(doc, pipe);
        if (!ch) return;
        const cg = ISO.chainGeom(pipe, g, o.sym, o.font, L), dc2 = o.dimCol || o.col;
        const marks = [0].concat(ch.segs.map((sg) => sg.b));
        marks.forEach((mm, i) => {
          const base = lerp(g.A, g.B, mm / L);
          out.push(line(add(base, cg.off2, o.sym * (i === 0 || i === marks.length - 1 ? 0.9 : 1.6)), add(base, cg.off2, gap + o.sym * 0.6), dc2, tw));
        });
        const tk2 = norm(add(g.d, cg.off2));
        marks.forEach((mm) => { const q = cg.at(mm); out.push(line(add(q, tk2, -o.sym * 0.45), add(q, tk2, o.sym * 0.45), dc2, tw * 1.6)); });
        ch.segs.forEach((sg) => {
          if (sg.b - sg.a < 0.5) return;
          out.push(line(cg.at(sg.a), cg.at(sg.b), dc2, tw));
          const tx = cg.text(sg), m2 = tx.pos;
          out.push(`<text x="${r2(m2[0])}" y="${r2(m2[1])}" transform="rotate(${ang} ${r2(m2[0])} ${r2(m2[1])})" ` +
            `font-size="${r2(o.font * (tx.narrow ? 0.85 : 1))}" fill="${dc2}" text-anchor="middle" dominant-baseline="central">${Math.round(sg.b - sg.a)}</text>`);
        });
      });
    }

    // Angle between the two pipes at each elbow: the true angle in 3D, drawn as an arc in the plane of the two pipes
    if (doc.settings.showAngles !== false) {
      const v3 = ISO.v3, dc = o.dimCol || o.col;
      const k1 = Math.hypot(...sub(o.P([1, 0, 0]), o.P([0, 0, 0]))) || 1; // drawing units per mm along an axis
      ISO.elbowAngles(doc).forEach(({ n, u, v, len, th, deg }) => {
        const r = Math.min((o.sym * 2.2) / k1, Math.min(...len) * 0.4);
        const pts = [];
        for (let i = 0; i <= 16; i++) {
          const t = i / 16, a = Math.sin((1 - t) * th) / Math.sin(th), b = Math.sin(t * th) / Math.sin(th);
          pts.push(o.P(v3.add(n, v3.scale(v3.add(v3.scale(u, a), v3.scale(v, b)), r))));
        }
        lay.angles.push(`<path d="M${pts.map((p) => r2(p[0]) + ' ' + r2(p[1])).join('L')}" fill="none" stroke="${dc}" stroke-width="${r2(o.thin)}"/>`);
        if (ISO.isRightAngle(deg)) {
          // right angle: the usual mark, a dot inside the arc (no number)
          const bis = v3.add(u, v), bl = v3.len(bis);
          lay.angles.push(circle(o.P(v3.add(n, v3.scale(bis, (r * 0.45) / bl))), o.sym * 0.2, dc));
          return;
        }
        const N = o.P(n), mid = pts[8];
        const tp = add(mid, norm(sub(mid, N)), o.font * 1.1);
        const rd = Math.round(deg * 10) / 10;
        lay.angles.push(`<text x="${r2(tp[0])}" y="${r2(tp[1])}" font-size="${r2(o.font * 0.85)}" fill="${dc}" text-anchor="middle" dominant-baseline="central" ` +
          `stroke="${o.bg}" stroke-width="${r2(o.font * 0.3)}" paint-order="stroke">${rd % 1 ? rd.toFixed(1) : rd}°</text>`);
      });
    }

    // Pipes and components in the line
    doc.pipes.forEach((pipe) => {
      const g = geoms.get(pipe.id);
      const col = isSel('pipe', pipe.id) ? o.selCol : isHover('pipe', pipe.id) ? o.hoverCol : o.col;
      const k = (ISO.STANDARDS[pipe.std] || { lw: 1 }).lw;
      if (!pipe.comp) { lay.pipes.push(line(g.A, g.B, col, o.lw * k, ' stroke-linecap="round"')); return; }
      const cp = pipe.comp;
      const c = lerp(g.A, g.B, 0.5);
      const half = Math.hypot(g.B[0] - g.A[0], g.B[1] - g.A[1]) / 2;
      const ext = { hose: 1.1, bellows: 0.95, reducer: 0.9, reducerEcc: 0.9 }[cp.type] || 1;
      const sa = Math.max(half / ext, o.sym * 0.9); // stretch over the component's length (but never tiny)
      lay.comps.push(ISO.drawFitting(cp.type, c, g.d, g.p, g.n, o.sym, Object.assign({}, st, { col, sa, lw: o.lw * k }), !!cp.flip, cp.side));
      if (doc.settings.showCompSizes !== false) {
        // size text on the side away from the dimension line
        const od = pipe.dimFlip ? g.o : [-g.o[0], -g.o[1]];
        const tp = add(c, od, o.sym * 2.3);
        lay.comps.push(`<text x="${r2(tp[0])}" y="${r2(tp[1])}" font-size="${r2(o.font * 0.85)}" fill="${col}" text-anchor="middle" dominant-baseline="central" ` +
          `stroke="${o.bg}" stroke-width="${r2(o.font * 0.3)}" paint-order="stroke">${esc(ISO.compSizeText(pipe))}</text>`);
      }
    });

    // Welds at elbows / tees
    out = lay.marks;
    if (doc.settings.showWelds) {
      Object.keys(doc.nodes).forEach((id) => {
        const ps = ISO.pipesAt(doc, id);
        if (ps.length < 2 || ps.some((x) => x.comp)) return;
        const c = o.P(ISO.nodePt(doc, id));
        ps.forEach((pipe) => {
          const g = geoms.get(pipe.id);
          const dir = pipe.a === id ? g.d : [-g.d[0], -g.d[1]];
          out.push(circle(add(c, dir, o.sym * 1.1), o.sym * 0.3, o.col));
        });
      });
    }

    // Flanges at pipe ends: chosen per pipe (none / start / end / both), else the automatic rule in Settings
    {
      const deg = ISO.nodeDegrees(doc);
      doc.pipes.forEach((pipe) => {
        if (pipe.comp) return; // components bring their own flanges
        const g = geoms.get(pipe.id);
        const screenLen = Math.hypot(g.B[0] - g.A[0], g.B[1] - g.A[1]);
        const ends = ISO.pipeFlanges(doc, pipe, deg);
        [[pipe.a, g.A, g.d], [pipe.b, g.B, [-g.d[0], -g.d[1]]]].forEach(([nid, E, dir], i) => {
          if (!ends[i]) return;
          // at open ends right at the end, at joints just before the elbow / tee (closer on very short pipes)
          const off = deg[nid] === 1 ? 0.12 : Math.min(0.9, (screenLen / o.sym) * 0.3);
          const q = add(E, dir, o.sym * off);
          out.push(line(add(q, g.p, o.sym * 0.78), add(q, g.p, -o.sym * 0.78), o.col, o.thin * 2.2));
        });
      });
    }

    // Fittings
    doc.fittings.forEach((f) => {
      const pipe = ISO.byId(doc.pipes, f.pipeId);
      if (!pipe) return;
      const g = geoms.get(pipe.id);
      const c = lerp(g.A, g.B, f.t);
      const col = isSel('fitting', f.id) ? o.selCol : isHover('fitting', f.id) ? o.hoverCol : o.col;
      out.push(ISO.drawFitting(f.type, c, g.d, g.p, g.n, o.sym, Object.assign({}, st, { col }), !!f.flip, f.side));
    });

    // Labels
    out = lay.labels;
    doc.labels.forEach((lab) => {
      if (!ISO.byId(doc.pipes, lab.pipeId)) return;
      const { anchor, pos } = ISO.labelPos(doc, lab, o.P, o.sym);
      const col = isSel('label', lab.id) ? o.selCol : isHover('label', lab.id) ? o.hoverCol : o.col;
      out.push(line(anchor, pos, col, o.thin));
      out.push(circle(anchor, o.sym * 0.22, col));
      const lines = String(lab.text || '').split('\n');
      const anchorTxt = lab.ox >= 0 ? 'start' : 'end';
      const tx = pos[0] + (lab.ox >= 0 ? 1 : -1) * o.font * 0.25;
      const tsp = lines.map((l, i) => `<tspan x="${r2(tx)}" dy="${i ? r2(o.font * 1.2) : 0}">${esc(l) || ' '}</tspan>`).join('');
      out.push(`<text x="${r2(tx)}" y="${r2(pos[1])}" font-size="${r2(o.font)}" fill="${col}" text-anchor="${anchorTxt}" ` +
        `dominant-baseline="central" stroke="${o.bg}" stroke-width="${r2(o.font * 0.3)}" paint-order="stroke">${tsp}</text>`);
    });

    // Selected node marker
    if (o.sel && o.sel.type === 'node' && doc.nodes[o.sel.id]) {
      lay.sel.push(circle(o.P(ISO.nodePt(doc, o.sel.id)), o.sym * 0.55, 'none', o.selCol, o.thin * 2));
    }
    const grp = (name, arr) => (arr.length ? `<g data-layer="${name}">${arr.join('')}</g>` : '');
    return grp('DIMENSIONS', lay.dims) + grp('ANGLES', lay.angles) + grp('PIPES', lay.pipes) + grp('COMPONENTS', lay.comps.concat(lay.marks)) +
      grp('LABELS', lay.labels) + lay.sel.join('');
  };

  /**
   * Isometric paper: triangular grid in the three iso directions.
   * Screen rect (x0,y0)-(x1,y1); world->screen is s = w*z + (px,py); g = grid step (mm).
   * Returns SVG path data for minor lines, major lines (every `major` cells) and dots (lattice points).
   */
  ISO.isoGridPaths = (x0, y0, x1, y1, z, px, py, g, major = 5, withDots = false) => {
    const C = ISO.C;
    const toW = (sx, sy) => [(sx - px) / z, (sy - py) / z];
    const toS = (wx, wy) => r2(wx * z + px) + ' ' + r2(wy * z + py);
    const cs = [toW(x0, y0), toW(x1, y0), toW(x0, y1), toW(x1, y1)];
    const xL = cs[0][0], xR = cs[1][0], yT = cs[0][1], yB = cs[2][1];
    let minor = '', majorD = '', dots = '';
    const fam = (fn, line) => {
      const vals = cs.map(fn);
      for (let k = Math.ceil(Math.min(...vals) / g); k <= Math.floor(Math.max(...vals) / g); k++) {
        const seg = line(k * g);
        if (k % major === 0) majorD += seg; else minor += seg;
      }
    };
    // lines of constant North (run East), constant East (run North), and verticals
    fam((c) => c[0] / (2 * C) - c[1], (n) => `M${toS(xL, xL / (2 * C) - n)}L${toS(xR, xR / (2 * C) - n)}`);
    fam((c) => c[1] + c[0] / (2 * C), (e) => `M${toS(xL, e - xL / (2 * C))}L${toS(xR, e - xR / (2 * C))}`);
    fam((c) => c[0] / C, (m) => `M${toS(m * C, yT)}L${toS(m * C, yB)}`);
    if (withDots) {
      // lattice points: wx = m*g*C, wy = (j + m/2)*g  (every vertical line, half-step offset on odd m)
      const m0 = Math.ceil(xL / (g * C)), m1 = Math.floor(xR / (g * C));
      for (let m = m0; m <= m1; m++) {
        const off = (m & 1) / 2;
        for (let j = Math.ceil(yT / g - off); j <= Math.floor(yB / g - off); j++) dots += `M${toS(m * g * C, (j + off) * g)}h0`;
      }
    }
    return { minor, major: majorD, dots };
  };

  /** Pick a grid step (multiple of base) so cells are at least minPx apart on screen. */
  ISO.gridStepFor = (base, z, minPx) => {
    let g = base > 0 ? base : 1000;
    const mult = [2, 2.5, 2];
    let i = 0;
    while (g * z < minPx) g *= mult[i++ % 3];
    return g;
  };

  ISO.PAPER = { bg: '#fbfdff', minor: '#d4e6f3', major: '#a9cbe4', dot: '#5f9cc9' };

  /** Mix two #rrggbb colours: k = 0 gives a, k = 1 gives b. */
  const mix = (a, b, k) => '#' + [1, 3, 5].map((i) => {
    const v = Math.round(parseInt(a.substr(i, 2), 16) * (1 - k) + parseInt(b.substr(i, 2), 16) * k);
    return v.toString(16).padStart(2, '0');
  }).join('');
  ISO.isHexColor = (c) => typeof c === 'string' && /^#[0-9a-f]{6}$/i.test(c);
  ISO.mixColor = mix;
  /** Colours of the isometric paper: the line colour chosen in Settings, or the default blue. */
  ISO.paperColors = () => {
    const c = ISO.profile ? ISO.profile.get().gridColor : '';
    if (!ISO.isHexColor(c) || c.toLowerCase() === ISO.PAPER.major) return ISO.PAPER;
    return { bg: ISO.PAPER.bg, major: c, minor: mix(c, '#ffffff', 0.5), dot: mix(c, '#000000', 0.3) };
  };

  /** North arrow + axis hint. */
  ISO.northArrow = (x, y, s, col, font) => {
    const d = ISO.iso([0, 1, 0]); // north in screen
    const tip = [x + d[0] * s, y + d[1] * s];
    const n = [-d[1], d[0]];
    const base = [x + d[0] * s * 0.45, y + d[1] * s * 0.45];
    return line([x, y], tip, col, s * 0.05) +
      poly([tip, add(base, n, s * 0.16), add(base, n, -s * 0.16)], col) +
      `<text x="${r2(tip[0] + font * 0.5)}" y="${r2(tip[1] - font * 0.3)}" font-size="${r2(font)}" font-weight="700" fill="${col}">N</text>`;
  };

  /**
   * Bill of materials together with the legend, for the notes field of the sheet.
   * Rows: { icon: { std | type | kind } | null, label, size, qty, pos: true when it is a part (numbered), total: true for sums }.
   * Order: pipes (length per size), elbows / tees, components and fittings in palette order (pipe-end flanges and the
   * flange total after the flanges), welds, then marks that are only explained (flow arrow, angle marks; quantity "–").
   */
  ISO.bomRows = (doc) => {
    const T = ISO.t, rows = [];
    const de = ISO.getLang && ISO.getLang() === 'de';
    const metres = (mm) => { const s = (mm / 1000).toFixed(2); return (de ? s.replace('.', ',') : s) + ' m'; };
    const stdName = (k) => (ISO.STANDARDS[k] ? ISO.STANDARDS[k].name : '');
    const dnTxt = (std, dn) => `DN${dn} ${stdName(std)}`.trim();
    const sortBySize = (a, b) => Object.keys(ISO.STANDARDS).indexOf(a.std) - Object.keys(ISO.STANDARDS).indexOf(b.std) || a.dn - b.dn;
    /** Count things by a key; returns [{ key, n, first }] in order of first appearance. */
    const tally = (arr, keyFn) => {
      const m = new Map();
      arr.forEach((x) => { const k = keyFn(x); const e = m.get(k); if (e) e.n++; else m.set(k, { key: k, n: 1, first: x }); });
      return [...m.values()];
    };
    const live = new Set(doc.pipes.map((p) => p.id));
    const pipeOf = (f) => ISO.byId(doc.pipes, f.pipeId);

    // Pipes: total length per standard and size
    const plain = doc.pipes.filter((p) => !p.comp);
    const lens = new Map();
    plain.forEach((p) => {
      const k = p.std + ':' + p.dn;
      const e = lens.get(k) || { std: p.std, dn: p.dn, mm: 0 };
      e.mm += ISO.pipeLen(doc, p);
      lens.set(k, e);
    });
    const pipeRows = [...lens.values()].sort(sortBySize);
    pipeRows.forEach((e) => rows.push({ icon: { std: e.std }, label: T('sb.pipe'), size: dnTxt(e.std, e.dn), qty: metres(e.mm), pos: true }));
    if (pipeRows.length > 1) rows.push({ icon: null, label: T('bom.pipeTotal'), size: '', qty: metres(pipeRows.reduce((s, e) => s + e.mm, 0)), total: true });

    // Elbows (bend angle = 180° − angle between the pipes), tees and crosses
    const sizeAt = (ps) => {
      const s = [...new Set(ps.map((p) => p.std + ':' + p.dn))].map((k) => { const [std, dn] = k.split(':'); return { std, dn: +dn }; }).sort(sortBySize).reverse();
      return s.length === 1 ? dnTxt(s[0].std, s[0].dn) : s.map((x) => 'DN' + x.dn).join(' × ');
    };
    const bends = ISO.elbowAngles(doc).map((a) => ({ bend: Math.round((180 - a.deg) * 10) / 10, size: sizeAt(ISO.pipesAt(doc, a.id)) }));
    tally(bends, (b) => b.bend + '|' + b.size).sort((x, y) => y.first.bend - x.first.bend).forEach((e) =>
      rows.push({ icon: { kind: 'elbow' }, label: T('bom.elbow', { a: e.first.bend }), size: e.first.size, qty: String(e.n), pos: true }));
    const deg = ISO.nodeDegrees(doc);
    const junctions = Object.keys(doc.nodes).filter((id) => deg[id] >= 3).map((id) => ({ n: deg[id], size: sizeAt(ISO.pipesAt(doc, id)) }));
    tally(junctions, (j) => (j.n === 3 ? 'tee' : 'cross') + '|' + j.size).forEach((e) =>
      rows.push({ icon: { kind: e.first.n === 3 ? 'tee' : 'cross' }, label: T(e.first.n === 3 ? 'bom.tee' : 'bom.cross'), size: e.first.size, qty: String(e.n), pos: true }));

    // Components in the line and fittings on the pipes, in palette order, per size
    let flanges = 0;
    const FLANGE_PER = { flange: 2, flange1: 1, blind: 1 }; // a flange pair is two flanges
    const markOnly = { flow: true }; // symbols that are explained but not ordered
    ISO.CATEGORIES.forEach((cat) => {
      const types = cat.groups ? cat.groups.flatMap((g) => g.items) : cat.items;
      types.forEach((type) => {
        if (ISO.FITTINGS[type] && ISO.FITTINGS[type].support) {
          // supports: on a pipe, or added into the line at a pipe end – counted together per size and width
          const all = doc.pipes.filter((p) => p.comp && p.comp.type === type).map((p) => ({ p, w: ISO.pipeLen(doc, p) }))
            .concat(doc.fittings.filter((f) => f.type === type && live.has(f.pipeId)).map((f) => ({ p: pipeOf(f), w: ISO.supportWidth(f) })));
          tally(all, (x) => `${dnTxt(x.p.std, x.p.dn)}, ${Math.round(x.w)} mm`).forEach((e) =>
            rows.push({ icon: { type }, label: ISO.fitName(type), size: e.key, qty: String(e.n), pos: true }));
          return;
        }
        const comps = doc.pipes.filter((p) => p.comp && p.comp.type === type);
        tally(comps, (p) => ISO.compSizeText(p) + ' ' + stdName(p.std)).forEach((e) =>
          rows.push({ icon: { type }, label: ISO.fitName(type), size: e.key.trim(), qty: String(e.n), pos: true }));
        const fits = doc.fittings.filter((f) => f.type === type && live.has(f.pipeId));
        if (FLANGE_PER[type]) flanges += fits.length * FLANGE_PER[type];
        tally(fits, (f) => { const p = pipeOf(f); const w = ISO.FITTINGS[type].support ? `, ${Math.round(ISO.supportWidth(f))} mm` : ''; return dnTxt(p.std, p.dn) + w; }).forEach((e) =>
          rows.push({ icon: { type }, label: ISO.fitName(type), size: markOnly[type] ? '' : e.key, qty: markOnly[type] ? '–' : String(e.n), pos: !markOnly[type] }));
      });
      if (cat.id === 'flanges') {
        // flanges at pipe ends (chosen per pipe or by the automatic rule)
        const ends = [];
        plain.forEach((p) => ISO.pipeFlanges(doc, p, deg).forEach((on) => { if (on) ends.push(p); }));
        flanges += ends.length;
        tally(ends, (p) => p.std + ':' + p.dn).map((e) => e.first).sort(sortBySize).forEach((p) => {
          const n = ends.filter((x) => x.std === p.std && x.dn === p.dn).length;
          rows.push({ icon: { kind: 'pipeFlange' }, label: T('bom.endFlange'), size: dnTxt(p.std, p.dn), qty: String(n), pos: true });
        });
        if (flanges) rows.push({ icon: null, label: T('bom.flTotal'), size: '', qty: String(flanges), total: true });
      }
    });

    // Welds at elbows and tees (when shown)
    if (doc.settings.showWelds) {
      const n = Object.keys(doc.nodes).reduce((s, id) => { const ps = ISO.pipesAt(doc, id); return s + (ps.length >= 2 && !ps.some((x) => x.comp) ? ps.length : 0); }, 0);
      if (n) rows.push({ icon: { kind: 'elbowWeld' }, label: T('lg.elbowWeld'), size: '', qty: String(n), pos: true });
    }
    // Marks that are only explained
    if (doc.settings.showAngles !== false) {
      const ang = ISO.elbowAngles(doc);
      if (ang.some((a) => ISO.isRightAngle(a.deg))) rows.push({ icon: { kind: 'right' }, label: T('lg.right'), size: '', qty: '–' });
      if (ang.some((a) => !ISO.isRightAngle(a.deg))) rows.push({ icon: { kind: 'angle' }, label: T('lg.angle'), size: '', qty: '–' });
    }
    return rows;
  };

  /** Small picture of a legend item, centred on c; s = symbol size (mm). */
  function legendIcon(it, c, s, col, bg, pipeW) {
    const half = s * 1.55;
    const pipe = (w) => line([c[0] - half, c[1]], [c[0] + half, c[1]], col, w);
    if (it.std) return pipe(pipeW * ISO.STANDARDS[it.std].lw);
    if (it.type) return pipe(pipeW * 0.55) + ISO.drawFitting(it.type, c, [1, 0], [0, -1], [0, 1], s, { col, bg, thin: 0.12, lw: pipeW * 0.55 }, false, 1);
    if (it.kind === 'autoFlange' || it.kind === 'pipeFlange') return pipe(pipeW * 0.55) + line([c[0] + s * 0.6, c[1] - s * 0.78], [c[0] + s * 0.6, c[1] + s * 0.78], col, 0.4);
    if (it.kind === 'tee' || it.kind === 'cross') {
      return pipe(pipeW * 0.7) + line([c[0], c[1]], [c[0], c[1] - s * 1.2], col, pipeW * 0.7) + (it.kind === 'cross' ? line([c[0], c[1]], [c[0], c[1] + s * 1.2], col, pipeW * 0.7) : '');
    }
    if (it.kind === 'elbow') {
      const k0 = [c[0] - s * 0.6, c[1] + s * 0.8];
      return `<polyline points="${r2(k0[0] + s * 2)},${r2(k0[1])} ${r2(k0[0])},${r2(k0[1])} ${r2(k0[0])},${r2(k0[1] - s * 1.7)}" fill="none" stroke="${col}" stroke-width="${r2(pipeW * 0.7)}" stroke-linejoin="round"/>`;
    }
    // corner of two pipes for welds and angles
    const k = [c[0] - s * 0.5, c[1] + s * 0.75];
    const a2 = it.kind === 'angle' ? (135 * Math.PI) / 180 : Math.PI / 2;
    const e1 = [k[0] + s * 2, k[1]], e2 = [k[0] + Math.cos(a2) * s * 1.8, k[1] - Math.sin(a2) * s * 1.8];
    let h = line(k, e1, col, pipeW * 0.55) + line(k, e2, col, pipeW * 0.55);
    if (it.kind === 'elbowWeld') return h + circle([k[0] + s * 0.75, k[1]], s * 0.22, col);
    const r = s * 0.95, pts = [];
    for (let i = 0; i <= 12; i++) { const t = (a2 * i) / 12; pts.push([k[0] + Math.cos(t) * r, k[1] - Math.sin(t) * r]); }
    h += `<polyline points="${pts.map((p) => r2(p[0]) + ',' + r2(p[1])).join(' ')}" fill="none" stroke="${col}" stroke-width="0.15"/>`;
    if (it.kind === 'right') h += circle([k[0] + Math.cos(Math.PI / 4) * r * 0.45, k[1] - Math.sin(Math.PI / 4) * r * 0.45], s * 0.13, col);
    return h;
  }

  ISO.PAPERS = {
    A3: { W: 420, H: 297, tbW: 190, rh: 8, head: 16, sym: 3.4, font: 3, lw: 0.8, notesFs: 2.6 },
    A4: { W: 297, H: 210, tbW: 172, rh: 7, head: 14, sym: 2.8, font: 2.5, lw: 0.7, notesFs: 2.3 },
  };

  /**
   * Full landscape sheet (A3 or A4) with frame, title block (company logo, website, creator)
   * and the drawing fitted in. Returns an SVG document string.
   * opts: { paper: 'A3'|'A4', pxWidth }
   */
  ISO.renderSheet = (doc, opts = {}) => {
    const prof = ISO.profile ? ISO.profile.get() : {};
    const paper = ISO.PAPERS[opts.paper || prof.paper] ? (opts.paper || prof.paper) : 'A3';
    const PP = ISO.PAPERS[paper];
    const W = PP.W, H = PP.H, M = 10, rh = PP.rh;
    const tbW = PP.tbW, tbH = PP.head + rh * 7;
    const tbX = W - M - tbW, tbY = H - M - tbH;
    const col = '#000', bg = '#fff';
    const out = [];
    out.push(`<rect x="0" y="0" width="${W}" height="${H}" fill="${bg}"/>`);
    out.push(`<g data-layer="FRAME"><rect x="${M}" y="${M}" width="${W - 2 * M}" height="${H - 2 * M}" fill="none" stroke="${col}" stroke-width="0.6"/></g>`);

    // Drawing area (leaves room for the north arrow, which is left out when the compass is switched off in Settings)
    const showNorth = prof.showCompass !== false;
    const area = showNorth ? { x: M + 46, y: M + 22, w: W - 2 * M - 62, h: tbY - M - 36 }
      : { x: M + 16, y: M + 16, w: W - 2 * M - 32, h: tbY - M - 30 };
    const b = ISO.isoBounds(doc);
    if (b) {
      const bw = Math.max(b.x1 - b.x0, 1), bh = Math.max(b.y1 - b.y0, 1);
      const k = Math.min(area.w / bw, area.h / bh, 0.25);
      const cx = (b.x0 + b.x1) / 2, cy = (b.y0 + b.y1) / 2;
      const ox = area.x + area.w / 2, oy = area.y + area.h / 2;
      const P = (pt) => { const w = ISO.iso(pt); return [ox + (w[0] - cx) * k, oy + (w[1] - cy) * k]; };
      // Grid lines (isometric paper) in the export: on unless switched off in Settings → Export
      if (prof.exportGrid !== false) {
        const gx0 = M, gy0 = M, gx1 = W - M, gy1 = tbY;
        // Paper cell between 5 and 10 mm, aligned with the model grid
        let g = doc.settings.gridStep > 0 ? doc.settings.gridStep : 1000;
        while (g * k > 10) g /= 2;
        while (g * k < 5) g *= 2;
        const gp = ISO.isoGridPaths(gx0, gy0, gx1, gy1, k, ox - cx * k, oy - cy * k, g);
        const pc = ISO.paperColors();
        // a little stronger than on screen, so the fine lines survive printing
        out.push(`<clipPath id="paperClip"><rect x="${gx0}" y="${gy0}" width="${gx1 - gx0}" height="${gy1 - gy0}"/></clipPath>` +
          `<g data-layer="GRID" clip-path="url(#paperClip)" fill="none"><path d="${gp.minor}" stroke="${mix(pc.major, '#ffffff', 0.3)}" stroke-width="0.15"/>` +
          `<path d="${gp.major}" stroke="${mix(pc.major, '#000000', 0.12)}" stroke-width="0.25"/></g>`);
      }
      out.push(ISO.renderDrawing(doc, { P, sym: PP.sym, font: PP.font, lw: PP.lw, thin: 0.18, col, bg, dimCol: col, selCol: col, hoverCol: col }));
    }
    const na = paper === 'A4' ? 13 : 16;
    out.push('<g data-layer="ANNOTATION">' + (showNorth ? ISO.northArrow(M + 12, M + 26, na, col, paper === 'A4' ? 3.4 : 4) : ''));
    out.push(`<text x="${M + 5}" y="${showNorth ? M + 34 : M + 6}" font-size="${paper === 'A4' ? 2 : 2.4}" fill="${col}">${esc(ISO.t('sh.nts'))}</text></g>`);

    // Title block
    out.push('<g data-layer="TITLEBLOCK">');
    const t = doc.title;
    const capFs = paper === 'A4' ? 1.6 : 1.8, valMax = paper === 'A4' ? 2.8 : 3.1, bigMax = paper === 'A4' ? 3.7 : 4.2;
    const cell = (x, y, w, h, cap, val, big) => {
      const v = String(val || '');
      const fs = Math.min(big ? bigMax : valMax, (w - 3) / Math.max(1, v.length * 0.56));
      return `<rect x="${r2(x)}" y="${r2(y)}" width="${r2(w)}" height="${r2(h)}" fill="none" stroke="${col}" stroke-width="0.3"/>` +
        (cap ? `<text x="${r2(x + 1)}" y="${r2(y + capFs + 0.5)}" font-size="${capFs}" fill="#444">${esc(cap.toUpperCase())}</text>` : '') +
        `<text x="${r2(x + 1.2)}" y="${r2(y + h - 1.5)}" font-size="${r2(fs)}" fill="${col}"${big ? ' font-weight="700"' : ''}>${esc(v)}</text>`;
    };
    const c3 = tbW / 3, c2 = tbW / 2;
    let y = tbY;
    out.push(`<rect x="${tbX}" y="${tbY}" width="${tbW}" height="${tbH}" fill="${bg}" stroke="${col}" stroke-width="0.6"/>`);
    const T = (k) => ISO.t('tf.' + k);

    // Header: company logo | website + creator
    const lw = tbW * 0.42;
    out.push(`<rect x="${tbX}" y="${y}" width="${r2(lw)}" height="${PP.head}" fill="none" stroke="${col}" stroke-width="0.3"/>`);
    if (prof.logoSvg && ISO.logoMarkup) {
      out.push(`<g data-layer="LOGO">${ISO.logoMarkup(prof.logoSvg, r2(tbX + 1.5), r2(y + 1.5), r2(lw - 3), r2(PP.head - 3))}</g>`);
    }
    const hx = tbX + lw, hw = tbW - lw;
    out.push(`<rect x="${r2(hx)}" y="${y}" width="${r2(hw)}" height="${PP.head}" fill="none" stroke="${col}" stroke-width="0.3"/>`);
    if (prof.site) {
      const fs = Math.min(valMax, (hw - 3) / Math.max(1, prof.site.length * 0.55));
      out.push(`<text x="${r2(hx + 1.5)}" y="${r2(y + PP.head * 0.42)}" font-size="${r2(fs)}" font-weight="700" fill="${col}">${esc(prof.site)}</text>`);
    }
    if (prof.creator) {
      out.push(`<text x="${r2(hx + 1.5)}" y="${r2(y + PP.head - 2)}" font-size="${r2(capFs * 1.25)}" fill="#444">${esc(ISO.t('sh.creator').toUpperCase())}: <tspan fill="${col}">${esc(prof.creator)}</tspan></text>`);
    }
    y += PP.head;
    out.push(cell(tbX, y, tbW, rh, '', ISO.t('sh.title'), true)); y += rh;
    out.push(cell(tbX, y, tbW, rh, T('project'), t.project)); y += rh;
    out.push(cell(tbX, y, c2, rh, T('client'), t.client) + cell(tbX + c2, y, c2, rh, T('lineNo'), t.lineNo)); y += rh;
    out.push(cell(tbX, y, c3, rh, T('spec'), t.spec) + cell(tbX + c3, y, c3, rh, T('material'), t.material) + cell(tbX + 2 * c3, y, c3, rh, T('insulation'), t.insulation)); y += rh;
    out.push(cell(tbX, y, c3, rh, T('testPressure'), t.testPressure) + cell(tbX + c3, y, c3, rh, T('drawnBy'), t.drawnBy) + cell(tbX + 2 * c3, y, c3, rh, T('checkedBy'), t.checkedBy)); y += rh;
    const q = (tbW - c2) / 2;
    out.push(cell(tbX, y, c2, rh * 2, T('drawingNo'), t.drawingNo, true));
    out.push(cell(tbX + c2, y, q, rh, T('date'), t.date) + cell(tbX + c2 + q, y, q, rh, T('units'), 'mm'));
    out.push(cell(tbX + c2, y + rh, q, rh, T('rev'), t.rev) + cell(tbX + c2 + q, y + rh, q, rh, T('sheet'), `${t.sheet} · ${paper}`));

    // Notes box: your notes, and the parts list (BOM) with the legend of the symbols used (Settings → Export)
    const nx = M, nw = tbX - M - 6;
    const nfs = PP.notesFs;
    const bom = prof.exportLegend !== false ? ISO.bomRows(doc) : [];
    const hasNotes = !!String(t.notes || '').trim();
    const notesW = bom.length ? (hasNotes ? nw * 0.3 : 0) : nw;
    out.push(`<rect x="${nx}" y="${tbY}" width="${nw}" height="${tbH}" fill="none" stroke="${col}" stroke-width="0.3"/>`);
    if (notesW > 0) out.push(`<text x="${nx + 2}" y="${tbY + 4.5}" font-size="${r2(nfs + 0.2)}" font-weight="700" fill="${col}">${esc(ISO.t('sh.notes'))}</text>`);
    if (bom.length) {
      const lx = nx + notesW, lw2 = nw - notesW;
      if (notesW > 0) out.push(line([lx, tbY], [lx, tbY + tbH], col, 0.3));
      out.push(`<text x="${r2(lx + 2)}" y="${tbY + 4.5}" font-size="${r2(nfs + 0.2)}" font-weight="700" fill="${col}">${esc(ISO.t('sh.bom'))}</text>`);
      // Table: Pos | Symbol | Item | Size | Qty. Several tables side by side when the rows don't fit;
      // rows get tighter before a table gets too narrow.
      const top = tbY + 6.2, avail = tbY + tbH - top - 0.8;
      const minColW = paper === 'A4' ? 62 : 82, maxCols = Math.max(1, Math.floor((lw2 - 2) / minColW));
      let rowH = paper === 'A4' ? 3.6 : 4.2, per, cols;
      const fit = () => { per = Math.max(1, Math.floor(avail / rowH) - 1); cols = Math.ceil(bom.length / per); };
      fit();
      while (cols > maxCols && rowH > 2.8) { rowH -= 0.2; fit(); }
      cols = Math.min(cols, maxCols);
      const tw = (lw2 - 2) / cols, fs0 = Math.min(nfs * 0.85, rowH * 0.56);
      const CW = [0.08, 0.12, 0.42, 0.22, 0.16]; // column widths (share of a table)
      const cellText = (x, w, yc, str, opts = {}) => {
        const s = String(str);
        if (!s) return '';
        const fs = Math.max(1.1, Math.min(fs0, (w - 1) / Math.max(1, s.length * 0.53)));
        const ax = opts.end ? x + w - 0.7 : x + 0.7;
        return `<text x="${r2(ax)}" y="${r2(yc)}" font-size="${r2(fs)}" fill="${col}" dominant-baseline="central"${opts.end ? ' text-anchor="end"' : ''}${opts.bold ? ' font-weight="700"' : ''}>${esc(s)}</text>`;
      };
      let posNo = 0;
      const numbered = bom.map((r) => (r.pos ? ++posNo : ''));
      for (let c = 0; c < cols; c++) {
        const x0 = lx + 1 + c * tw, part = bom.slice(c * per, (c + 1) * per);
        if (!part.length) break;
        const xs = [x0];
        CW.forEach((k) => xs.push(xs[xs.length - 1] + k * tw));
        const yEnd = top + rowH * (part.length + 1);
        // header
        const heads = ['bom.pos', 'bom.sym', 'bom.item', 'bom.size', 'bom.qty'].map((k) => ISO.t(k));
        heads.forEach((hd, i) => out.push(cellText(xs[i], xs[i + 1] - xs[i], top + rowH / 2, hd, { bold: true, end: i === 4 })));
        out.push(line([x0, top + rowH], [x0 + tw - 1, top + rowH], col, 0.25));
        // rows
        part.forEach((r, i) => {
          const idx = c * per + i, yc = top + rowH * (i + 1.5);
          const last = c === cols - 1 && i === part.length - 1 && (c + 1) * per < bom.length;
          if (last) { out.push(cellText(xs[2], xs[3] - xs[2], yc, '…')); return; }
          out.push(cellText(xs[0], xs[1] - xs[0], yc, numbered[idx]));
          if (r.icon) out.push(legendIcon(r.icon, [(xs[1] + xs[2]) / 2, yc], rowH * 0.3, col, bg, PP.lw * 0.9));
          out.push(cellText(xs[2], xs[3] - xs[2], yc, r.label, { bold: r.total }));
          out.push(cellText(xs[3], xs[4] - xs[3], yc, r.size));
          out.push(cellText(xs[4], xs[5] - xs[4], yc, r.qty, { end: true, bold: r.total }));
          if (i < part.length - 1) out.push(line([x0, top + rowH * (i + 2)], [x0 + tw - 1, top + rowH * (i + 2)], col, 0.08));
        });
        // column lines
        xs.slice(1, 5).forEach((xx) => out.push(line([xx, top], [xx, yEnd], col, 0.1)));
        if (c > 0) out.push(line([x0 - 0.5, top], [x0 - 0.5, tbY + tbH], col, 0.25));
      }
    }
    const wrap = (str, n) => {
      const res = [];
      String(str || '').split('\n').forEach((para) => {
        let cur = '';
        para.split(' ').forEach((wd) => {
          if ((cur + ' ' + wd).trim().length > n) { if (cur) res.push(cur); cur = wd; } else cur = (cur + ' ' + wd).trim();
        });
        res.push(cur);
      });
      return res;
    };
    const lh = nfs * 2.4;
    if (notesW > 0) {
      wrap(t.notes, Math.floor((notesW - 4) / (nfs * 0.56))).slice(0, Math.floor((tbH - 8) / lh)).forEach((l, i) =>
        out.push(`<text x="${nx + 2}" y="${r2(tbY + 10 + i * lh)}" font-size="${nfs}" fill="${col}">${esc(l)}</text>`));
    }
    out.push('</g>');

    const wAttr = opts.pxWidth ? `width="${opts.pxWidth}" height="${Math.round((opts.pxWidth * H) / W)}"` : `width="${W}mm" height="${H}mm"`;
    return `<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" ${wAttr} viewBox="0 0 ${W} ${H}" font-family="Arial, Helvetica, sans-serif">${out.join('')}</svg>`;
  };
})();
