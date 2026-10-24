/* PipeIso – interactive editor (tools, mouse/touch/keyboard handling, side panel, edit popup). */
(function () {
  'use strict';
  const ISO = window.ISO;
  const v3 = ISO.v3;
  const T = ISO.t;
  const { add, sub, lerp, esc, r2 } = ISO.svgUtil;
  const $ = (s) => document.querySelector(s);

  const svg = $('#canvas');
  const wrap = $('#canvasWrap');
  const sidebar = $('#sidebar');
  const sidebarWrap = $('#sidebarWrap');
  const statusEl = $('#status');
  const coordsEl = $('#coords');
  const typedEl = $('#typed');
  const popupEl = $('#popup');
  const finishBtn = $('#finishBtn');

  const STYLE = { sym: 10, font: 11.5, lw: 3, thin: 1, col: '#1d2733', bg: '#ffffff', dimCol: '#5b6b7c', selCol: '#0b63ce', hoverCol: '#4a90e2' };
  const STORE_KEY = 'pipeiso.autosave.v1';
  const mobileMQ = window.matchMedia('(max-width: 760px)');

  let doc = loadAutosave() || ISO.newDoc();
  const view = { zoom: 0.08, panX: 0, panY: 0 };
  let tool = 'select';
  let pipeStd = doc.settings.defaultStd || 'KF'; // standard used by the pipe tool
  let sel = null;       // {type, id}
  let hover = null;
  let run = null;       // active pipe run: {start:{pt, ref}, spec}
  let preview = null;   // tool-specific preview state
  let typed = '';       // length typed while drawing
  let mouse = null;     // last pointer position (screen px)
  let drag = null;
  let spaceDown = false;
  let plane = 'axes';   // active plane for 45° pipes: axes | h | xz | yz
  let lastPtr = 'mouse';
  let popup = null;     // edit popup state: {kind, id, at:[x,y], t, msg}
  const newLen = {};    // face-to-face length chosen for new components, per type (empty = typical length)
  const isInline = (t) => !!(ISO.FITTINGS[t] && ISO.FITTINGS[t].inline);
  const undoStack = [];
  const redoStack = [];

  // ---------- helpers ----------
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const snapV = (v, step) => Math.round(v / step) * step;
  const dist = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1]);
  const fmt = (n) => String(Math.round(n));
  const fmtPt = (p) => T('coord', { e: fmt(p[0]), n: fmt(p[1]), z: fmt(p[2]) });
  const tm = () => (lastPtr === 'touch' ? 2.2 : 1); // bigger hit areas for fingers
  const isMobile = () => mobileMQ.matches;

  function P(pt) {
    const w = ISO.iso(pt);
    return [w[0] * view.zoom + view.panX, w[1] * view.zoom + view.panY];
  }
  function screenToGround(s) {
    const wx = (s[0] - view.panX) / view.zoom, wy = (s[1] - view.panY) / view.zoom;
    return [(wx / ISO.C + 2 * wy) / 2, (wx / ISO.C - 2 * wy) / 2, 0];
  }
  function evPos(e) {
    const r = svg.getBoundingClientRect();
    return [e.clientX - r.left, e.clientY - r.top];
  }
  function distSeg(p, a, b) {
    const ab = sub(b, a), ap = sub(p, a);
    const L2 = ab[0] * ab[0] + ab[1] * ab[1];
    const t = L2 ? clamp((ap[0] * ab[0] + ap[1] * ab[1]) / L2, 0, 1) : 0;
    return { d: dist(p, [a[0] + ab[0] * t, a[1] + ab[1] * t]), t };
  }
  const snapT = (t) => (Math.abs(t - 0.5) < 0.07 ? 0.5 : clamp(t, 0.04, 0.96));

  // ---------- standard scales ----------
  // Zooming only uses standard drawing scales. view.zoom is screen pixels per mm of the model;
  // at the standard 96 dpi one CSS pixel is 25.4/96 mm, so the scale 1:n is zoom = (96 / 25.4) / n.
  const SCALES = [1, 2, 5, 10, 20, 25, 50, 100, 200, 250, 500, 1000, 2000];
  const PX_PER_MM = 96 / 25.4;
  const zoomOf = (n) => PX_PER_MM / n;
  /** Index of the standard scale closest to a zoom factor. */
  function scaleIndex(z) {
    let best = 0;
    SCALES.forEach((n, i) => { if (Math.abs(Math.log(zoomOf(n) / z)) < Math.abs(Math.log(zoomOf(SCALES[best]) / z))) best = i; });
    return best;
  }
  /** Zoom to standard scale number i, keeping screen point s (default: the centre) in place. */
  function setScale(i, s) {
    const z = zoomOf(SCALES[clamp(i, 0, SCALES.length - 1)]);
    const c = s || [wrap.clientWidth / 2, wrap.clientHeight / 2];
    view.panX = c[0] - ((c[0] - view.panX) * z) / view.zoom;
    view.panY = c[1] - ((c[1] - view.panY) * z) / view.zoom;
    view.zoom = z;
  }

  // ---------- persistence & history ----------
  let saveTimer;
  function autosave() {
    clearTimeout(saveTimer);
    saveTimer = setTimeout(() => {
      try { localStorage.setItem(STORE_KEY, JSON.stringify(doc)); } catch (e) { /* storage unavailable */ }
    }, 300);
  }
  function loadAutosave() {
    try {
      const s = localStorage.getItem(STORE_KEY);
      return s ? ISO.migrate(JSON.parse(s)) : null;
    } catch (e) { return null; }
  }
  const snapshot = () => JSON.stringify(doc);
  function pushHistory() {
    undoStack.push(snapshot());
    if (undoStack.length > 200) undoStack.shift();
    redoStack.length = 0;
  }
  function changed(opts = {}) {
    autosave();
    render();
    if (opts.sidebar !== false) renderSidebar();
    if (popup) renderPopup();
    updateButtons();
    updateStatus();
  }
  function commit(fn, opts) {
    pushHistory();
    const r = fn();
    changed(opts);
    return r;
  }
  function exists(ref) {
    if (!ref) return false;
    if (ref.type === 'node') return !!doc.nodes[ref.id];
    const arr = { pipe: doc.pipes, fitting: doc.fittings, label: doc.labels }[ref.type];
    return !!(arr && ISO.byId(arr, ref.id));
  }
  function restore(json) {
    doc = JSON.parse(json);
    if (!exists(sel)) sel = null;
    if (popup && !exists({ type: popup.kind, id: popup.id })) { popup = null; popupEl.hidden = true; }
    hover = null; run = null; preview = null; typed = '';
    updatePlanebar();
    changed();
  }
  function undo() { if (undoStack.length) { redoStack.push(snapshot()); restore(undoStack.pop()); } }
  function redo() { if (redoStack.length) { undoStack.push(snapshot()); restore(redoStack.pop()); } }

  // ---------- hit testing ----------
  function hitTest(s, kinds = ['label', 'fitting', 'node', 'pipe'], radius = {}) {
    const k = tm();
    const rNode = (radius.node || 6) * k, rPipe = (radius.pipe || 7) * k;
    const plain = !!radius.plain; // only real pipes, not components in the line
    for (const kind of kinds) {
      if (kind === 'label') {
        for (let i = doc.labels.length - 1; i >= 0; i--) {
          const lab = doc.labels[i];
          if (!ISO.byId(doc.pipes, lab.pipeId)) continue;
          const { pos } = ISO.labelPos(doc, lab, P, STYLE.sym);
          const b = ISO.labelBox(lab, pos, STYLE.font);
          const pad = 3 * k;
          if (s[0] >= b.x - pad && s[0] <= b.x + b.w + pad && s[1] >= b.y - pad && s[1] <= b.y + b.h + pad) return { type: 'label', id: lab.id };
        }
      } else if (kind === 'fitting') {
        let best = null;
        for (const f of doc.fittings) {
          const pipe = ISO.byId(doc.pipes, f.pipeId);
          if (!pipe) continue;
          const g = ISO.pipeGeom(doc, pipe, P);
          const d = dist(lerp(g.A, g.B, f.t), s);
          if (d < STYLE.sym * 1.4 * k && (!best || d < best.d)) best = { type: 'fitting', id: f.id, d };
        }
        if (best) return best;
      } else if (kind === 'node') {
        let best = null;
        for (const id of Object.keys(doc.nodes)) {
          const d = dist(P(ISO.nodePt(doc, id)), s);
          if (d < rNode && (!best || d < best.d)) best = { type: 'node', id, d };
        }
        if (best) return best;
      } else if (kind === 'pipe') {
        let best = null;
        for (const pipe of doc.pipes) {
          if (plain && pipe.comp) continue;
          const g = ISO.pipeGeom(doc, pipe, P);
          const r = distSeg(s, g.A, g.B);
          if (r.d < rPipe && (!best || r.d < best.d)) best = { type: 'pipe', id: pipe.id, t: r.t, d: r.d };
        }
        if (best) return best;
      }
    }
    return null;
  }

  // ---------- component orientation (outward / inward) ----------
  /** Centre of the drawing on screen; "outward" means away from it. */
  function drawingCenter() {
    const b = ISO.isoBounds(doc);
    if (!b) return [0, 0];
    return [((b.x0 + b.x1) / 2) * view.zoom + view.panX, ((b.y0 + b.y1) / 2) * view.zoom + view.panY];
  }
  /** Side and direction for a component placed at parameter t of a pipe, picked from the pointer position. */
  function orientFor(pipeId, t, s) {
    const pipe = ISO.byId(doc.pipes, pipeId);
    const g = ISO.pipeGeom(doc, pipe, P);
    const c = lerp(g.A, g.B, t);
    let across = (s[0] - c[0]) * g.p[0] + (s[1] - c[1]) * g.p[1];
    if (Math.abs(across) < 3) { // pointer right on the pipe: default to the outward side
      const ctr = drawingCenter();
      across = (c[0] - ctr[0]) * g.p[0] + (c[1] - ctr[1]) * g.p[1] || 1;
    }
    return { side: across >= 0 ? 1 : -1, flip: t < 0.5 }; // point toward the nearer pipe end
  }
  /** Is the side / direction of a component currently outward (away from the drawing centre)? */
  function orientationAt(pipe, t, side, flip) {
    const g = ISO.pipeGeom(doc, pipe, P);
    const c = lerp(g.A, g.B, t);
    const ctr = drawingCenter();
    const sideOut = ((c[0] - ctr[0]) * g.p[0] + (c[1] - ctr[1]) * g.p[1]) * (side === -1 ? -1 : 1) >= 0;
    const tip = flip ? g.A : g.B, tail = flip ? g.B : g.A;
    return { sideOut, dirOut: dist(tip, ctr) >= dist(tail, ctr) };
  }
  /** Component behind a reference: a point fitting, or a component segment in the line. */
  function compOf(ref) {
    if (!ref) return null;
    if (ref.type === 'fitting') {
      const f = ISO.byId(doc.fittings, ref.id);
      return f && { obj: f, type: f.type, pipe: ISO.byId(doc.pipes, f.pipeId), t: f.t };
    }
    if (ref.type === 'pipe') {
      const p = ISO.byId(doc.pipes, ref.id);
      return p && p.comp ? { obj: p.comp, type: p.comp.type, pipe: p, t: 0.5 } : null;
    }
    return null;
  }
  function flipItem(ref, what) {
    const c = compOf(ref);
    if (!c) return;
    const def = ISO.FITTINGS[c.type];
    if ((what === 'side' && !def.side) || (what === 'dir' && !def.dir)) return;
    commit(() => { if (what === 'side') c.obj.side = c.obj.side === -1 ? 1 : -1; else c.obj.flip = !c.obj.flip; });
  }
  function orientRows(ref, prefix) {
    const c = compOf(ref);
    if (!c) return '';
    const def = ISO.FITTINGS[c.type];
    const o = orientationAt(c.pipe, c.t, c.obj.side, c.obj.flip);
    let h = '';
    if (def.side) h += `<div class="orient"><span>${esc(T('sb.side'))}: <b>${esc(T(o.sideOut ? 'o.out' : 'o.in'))}</b></span><button data-flip="side" id="${prefix}-fside">${esc(T('btn.flip'))} <kbd>X</kbd></button></div>`;
    if (def.dir) h += `<div class="orient"><span>${esc(T('sb.dirOut'))}: <b>${esc(T(o.dirOut ? 'o.out' : 'o.in'))}</b></span><button data-flip="dir" id="${prefix}-fdir">${esc(T('btn.flip'))} <kbd>C</kbd></button></div>`;
    return h;
  }

  // ---------- pipe tool ----------
  const SNAP_R = 14;        // px: snap radius for points (nodes)
  const SNAP_PIPE = 9;      // px: snap radius for pipes
  const SNAP_ALIGN = 8;     // px: snap radius for alignment guides
  const SNAP_COL = '#15803d';
  const snapText = (kind) => T('snap.' + kind);

  /** Directions available for drawing right now. */
  function activeDirs() {
    if (doc.settings.angles !== '45') return ISO.PLANES.axes;
    return ISO.PLANES[plane] || ISO.PLANES.axes;
  }
  /** All directions that can be chosen in the edit popup. */
  function allDirs() {
    const list = ISO.PLANES.axes.slice();
    if (doc.settings.angles === '45') {
      ['h', 'xz', 'yz'].forEach((k) => ISO.PLANES[k].forEach((D) => { if (!list.some((x) => x.key === D.key)) list.push(D); }));
    }
    return list;
  }
  function setPlane(p) {
    plane = p;
    updatePlanebar();
    if (tool === 'pipe' && run && mouse) preview = runPreview(mouse);
    render(); updateStatus();
  }
  function updatePlanebar() {
    const bar = $('#planebar');
    if (doc.settings.angles !== '45') plane = 'axes';
    const showPlanes = tool === 'pipe' && doc.settings.angles === '45';
    const showLen = isInline(tool);
    bar.hidden = !(showPlanes || showLen);
    if (showPlanes) {
      bar.innerHTML = ISO.PLANE_ORDER.map((k) => `<button data-plane="${k}" class="${k === plane ? 'active' : ''}">${esc(T('plane.' + k))}</button>`).join('');
    } else if (showLen) {
      bar.innerHTML = `<label class="lenbar">${esc(T('bar.len', { name: ISO.fitName(tool) }))} ` +
        `<input type="number" inputmode="decimal" min="1" step="1" id="newLen" value="${esc(newLen[tool] || '')}" placeholder="${esc(T('bar.auto'))}"></label>`;
      const inp = $('#newLen');
      inp.addEventListener('input', () => { const v = parseFloat(inp.value); newLen[tool] = v > 0 ? v : ''; updateStatus(); });
    }
    finishBtn.hidden = !(tool === 'pipe' && run);
  }
  /** Length a new component of this type would get on this pipe. */
  function insertLength(type, pipe) {
    return newLen[type] > 0 ? newLen[type] : ISO.compDefaultLength(type, pipe ? pipe.dn : ISO.defaultSpec(doc, pipeStd).dn);
  }
  /** Where (mm from pipe.a) a component would be added for pointer parameter t. */
  function insertAt(pipe, t) {
    const Lp = ISO.pipeLen(doc, pipe), step = doc.settings.snap;
    let dq = clamp(snapV(t * Lp, step), 0, Lp);
    if (dq < step * 0.5) dq = 0;
    if (Lp - dq < step * 0.5) dq = Lp;
    return dq;
  }
  let flashTimer = null;
  function flash(msg) {
    statusEl.innerHTML = `<b style="color:var(--danger)">${esc(msg)}</b>`;
    clearTimeout(flashTimer);
    flashTimer = setTimeout(updateStatus, 3500);
  }
  $('#planebar').addEventListener('click', (e) => { const b = e.target.closest('[data-plane]'); if (b) { setPlane(b.dataset.plane); svg.focus(); } });

  /** Distance l where the ray start + dv*l meets the interior of segment a-b (3D), or null. */
  function rayHitsSegment(start, dv, a, b) {
    const d2 = v3.sub(b, a);
    const w0 = v3.sub(start, a);
    const dot = (x, y) => x[0] * y[0] + x[1] * y[1] + x[2] * y[2];
    const a11 = dot(dv, dv), a12 = dot(dv, d2), a22 = dot(d2, d2), b1 = dot(dv, w0), b2 = dot(d2, w0);
    const den = a11 * a22 - a12 * a12;
    if (Math.abs(den) < 1e-9) return null;
    const l = (a12 * b2 - a22 * b1) / den;
    const u = (a11 * b2 - a12 * b1) / den;
    const L = Math.sqrt(a22);
    if (l <= 0.5 || u * L <= 0.5 || (1 - u) * L <= 0.5) return null;
    const p1 = v3.add(start, v3.scale(dv, l)), p2 = v3.add(a, v3.scale(d2, u));
    return v3.eq(p1, p2, 0.5) ? l : null;
  }

  function startCandidate(s) {
    const h = hitTest(s, ['node', 'pipe'], { node: SNAP_R, pipe: SNAP_PIPE });
    if (h && h.type === 'node') return { pt: ISO.nodePt(doc, h.id), ref: { type: 'node', id: h.id }, snap: { kind: 'end' } };
    const step = doc.settings.snap;
    if (h && h.type === 'pipe' && ISO.byId(doc.pipes, h.id).comp) return startCandidate.free(s, step);
    if (h && h.type === 'pipe') {
      const pipe = ISO.byId(doc.pipes, h.id);
      const L = ISO.pipeLen(doc, pipe);
      const l = L <= 2 * step ? L / 2 : clamp(snapV(h.t * L, step), step, L - step);
      return { pt: ISO.pipeAt(doc, pipe, l / L), ref: { type: 'pipe', id: h.id }, snap: { kind: 'tee' } };
    }
    return startCandidate.free(s, step);
  }
  startCandidate.free = (s, step) => {
    const gp = gridPointNear(s);
    if (gp) return { pt: gp, ref: null, snap: { kind: 'grid' } };
    const g = screenToGround(s);
    return { pt: [snapV(g[0], step), snapV(g[1], step), 0], ref: null, snap: null };
  };

  // ---------- snapping to the isometric paper ----------
  /** Grid step currently drawn on screen (it grows when zoomed out). */
  const visibleGrid = () => ISO.gridStepFor(doc.settings.gridStep, view.zoom, (doc.settings.gridStyle || 'lines') === 'dots' ? 16 : 14);
  const gridOn = () => doc.settings.gridSnap !== false && (doc.settings.gridStyle || 'lines') !== 'none';
  /** Nearest intersection of the paper lines to an iso world point (mm), as [e, n] ground coordinates. */
  function nearestLattice(wx, wy, g) {
    const e = (wx / ISO.C + 2 * wy) / 2, n = (wx / ISO.C - 2 * wy) / 2;
    let best = null;
    for (const ee of [Math.floor(e / g), Math.ceil(e / g)]) {
      for (const nn of [Math.floor(n / g), Math.ceil(n / g)]) {
        const w = ISO.iso([ee * g, nn * g, 0]);
        const d = Math.hypot(w[0] - wx, w[1] - wy);
        if (!best || d < best.d) best = { e: ee * g, n: nn * g, w, d };
      }
    }
    return best;
  }
  /** Grid intersection (on the ground plane) under the pointer, or null. */
  function gridPointNear(s) {
    if (!gridOn()) return null;
    const g = visibleGrid();
    const wx = (s[0] - view.panX) / view.zoom, wy = (s[1] - view.panY) / view.zoom;
    const L = nearestLattice(wx, wy, g);
    return L.d * view.zoom < 12 * tm() ? [L.e, L.n, 0] : null;
  }
  /** Length along dir (from start) that ends on a grid intersection near the pointer, or null. */
  function gridLengthNear(start, dir, s) {
    if (!gridOn()) return null;
    const g = visibleGrid();
    const wx = (s[0] - view.panX) / view.zoom, wy = (s[1] - view.panY) / view.zoom;
    const L = nearestLattice(wx, wy, g);
    if (L.d * view.zoom > 12 * tm()) return null;
    const W0 = ISO.iso(start), sv = ISO.iso(dir.v);
    const k2 = sv[0] * sv[0] + sv[1] * sv[1];
    const l = ((L.w[0] - W0[0]) * sv[0] + (L.w[1] - W0[1]) * sv[1]) / k2;
    if (l <= 0.5) return null;
    const off = Math.hypot(W0[0] + sv[0] * l - L.w[0], W0[1] + sv[1] * l - L.w[1]);
    return off < 0.5 ? l : null; // the intersection must lie exactly on the pipe's line
  }

  /** Pipe spec for a new run: continue the size of the pipe we start from if it has the same standard. */
  function specFrom(ref) {
    let src = null;
    if (ref && ref.type === 'pipe') src = ISO.byId(doc.pipes, ref.id);
    if (ref && ref.type === 'node') { const ps = ISO.pipesAt(doc, ref.id); src = ps.find((x) => !x.comp) || ps[0]; }
    if (src && src.comp && ISO.isReducer(src.comp.type)) src = null;
    if (src && src.std === pipeStd) return { std: src.std, dn: src.dn };
    return ISO.defaultSpec(doc, pipeStd);
  }

  /** Orthogonal route from a to b: first along the preferred axis, then horizontal, then vertical. */
  function orthoRoute(a, b, prefAxis) {
    const order = [prefAxis, 0, 1, 2].filter((v, i, arr) => arr.indexOf(v) === i);
    const pts = [];
    let cur = a.slice();
    order.forEach((i) => {
      if (Math.abs(b[i] - cur[i]) > 0.5) { cur = cur.slice(); cur[i] = b[i]; pts.push(cur); }
    });
    return pts;
  }

  function runPreview(s) {
    const start = run.start.pt;
    const S0 = P(start);
    const v = sub(s, S0);
    let dir = null, bd = -Infinity;
    for (const D of activeDirs()) {
      const dt = v[0] * D.s[0] + v[1] * D.s[1];
      if (dt > bd) { bd = dt; dir = D; }
    }
    const k = Math.hypot(...ISO.iso(dir.v)); // screen length of 1 mm along this direction (per zoom)
    const step = doc.settings.snap;
    let len = Math.max(step, snapV(bd / (view.zoom * k), step));
    let snap = null;
    const t = parseFloat(typed);
    const R = tm();

    if (typed && t > 0) {
      len = t;
    } else {
      // 1) Snap to the nearest existing point (pipe end, elbow, tee)
      let near = null;
      for (const id of Object.keys(doc.nodes)) {
        const q = ISO.nodePt(doc, id);
        if (v3.eq(q, start)) continue;
        const d = dist(P(q), s);
        if (d < SNAP_R * R && (!near || d < near.d)) near = { id, q, d };
      }
      if (near) {
        const od = ISO.dirOf(start, near.q);
        const dd = od && activeDirs().find((D) => D.key === od.key);
        if (dd) return { dir: dd, len: v3.len(v3.sub(near.q, start)), pt: near.q, route: [near.q], snap: { kind: 'end', id: near.id } };
        // Not in line: connect with an orthogonal route (elbows added automatically)
        const pref = dir.v.map(Math.abs).indexOf(Math.max(...dir.v.map(Math.abs)));
        return { dir, len: null, pt: near.q, route: orthoRoute(start, near.q, pref), snap: { kind: 'route', id: near.id } };
      }
      // 2) Snap onto an existing pipe crossing this direction (creates a tee)
      for (const pipe of doc.pipes) {
        if (pipe.comp) continue;
        const [a, b] = ISO.pipeEnds(doc, pipe);
        const l = rayHitsSegment(start, dir.v, a, b);
        if (l == null) continue;
        const q = v3.add(start, v3.scale(dir.v, l));
        if (dist(P(q), s) < (SNAP_PIPE + 1) * R) { len = l; snap = { kind: 'tee' }; break; }
      }
      // 3) Align with any existing point along this direction
      if (!snap) {
        let best = null;
        for (const id of Object.keys(doc.nodes)) {
          const q = ISO.nodePt(doc, id);
          for (let i = 0; i < 3; i++) {
            if (Math.abs(dir.v[i]) < 1e-6) continue;
            const l = (q[i] - start[i]) / dir.v[i];
            if (l <= 0.5) continue;
            const c = v3.add(start, v3.scale(dir.v, l));
            if (v3.eq(c, q)) continue;
            const d = dist(P(c), s);
            if (d < SNAP_ALIGN * R && (!best || d < best.d)) best = { l, q, d };
          }
        }
        if (best) { len = best.l; snap = { kind: 'align', from: best.q }; }
      }
      // 4) Intersections of the isometric paper lines
      if (!snap) {
        const gl = gridLengthNear(start, dir, s);
        if (gl) { len = Math.round(gl * 1000) / 1000; snap = { kind: 'grid' }; }
      }
    }
    const pt = v3.add(start, v3.scale(dir.v, len));
    return { dir, len, pt, route: [pt], snap };
  }

  function commitSegment() {
    if (!run || !preview || !preview.route) return;
    const pts = [run.start.pt].concat(preview.route);
    if (pts.length < 2 || v3.eq(pts[0], pts[pts.length - 1])) return;
    const before = snapshot();
    let prev = ISO.resolvePoint(doc, pts[0]);
    let connects = false;
    for (let i = 1; i < pts.length; i++) {
      if (i === pts.length - 1) connects = !!ISO.findNode(doc, pts[i]) || !!ISO.pointOnPipe(doc, pts[i]);
      const id = ISO.resolvePoint(doc, pts[i]);
      if (!ISO.addPipe(doc, prev, id, run.spec)) { doc = JSON.parse(before); return; }
      prev = id;
    }
    undoStack.push(before);
    redoStack.length = 0;
    typed = '';
    run = connects ? null : { start: { pt: pts[pts.length - 1], ref: { type: 'node', id: prev } }, spec: run.spec };
    updatePlanebar();
    changed({ sidebar: false });
  }

  function beginRun(c) {
    run = { start: c, spec: specFrom(c.ref) };
    updatePlanebar();
  }
  function endRun() {
    run = null; typed = '';
    preview = mouse && tool === 'pipe' && lastPtr !== 'touch' ? startCandidate(mouse) : null;
    updatePlanebar(); render(); updateStatus();
  }

  /** Start a new pipe run from an existing point. */
  function startRunAt(nodeId) {
    if (!doc.nodes[nodeId]) return;
    const ps = ISO.pipesAt(doc, nodeId);
    if (ps.length && ISO.STANDARDS[ps[0].std]) pipeStd = ps[0].std;
    tool = 'pipe';
    closePopup();
    sel = null; hover = null; typed = '';
    beginRun({ pt: ISO.nodePt(doc, nodeId), ref: { type: 'node', id: nodeId }, snap: { kind: 'end' } });
    preview = mouse && lastPtr !== 'touch' ? runPreview(mouse) : null;
    markActiveTool(); updatePlanebar(); renderSidebar(); render(); updateStatus();
    svg.focus({ preventScroll: true });
  }

  // ---------- rendering ----------
  let gridKey = '';
  function renderGrid(w, h) {
    const st = doc.settings;
    const style = st.gridStyle || 'lines';
    const pp = ISO.paperColors();
    const key = [w, h, view.zoom, view.panX, view.panY, st.gridStep, style, pp.major].join('|');
    if (key === gridKey) return;
    gridKey = key;
    let out = `<rect width="${w}" height="${h}" fill="${style === 'none' ? '#fff' : pp.bg}"/>`;
    if (style !== 'none') {
      const g = ISO.gridStepFor(st.gridStep, view.zoom, style === 'dots' ? 16 : 14);
      const gp = ISO.isoGridPaths(0, 0, w, h, view.zoom, view.panX, view.panY, g, 5, style === 'dots');
      if (style === 'dots') out += `<path d="${gp.dots}" stroke="${pp.dot}" stroke-width="3.2" stroke-linecap="round"/>`;
      else out += `<path d="${gp.minor}" stroke="${pp.minor}" stroke-width="1" fill="none"/><path d="${gp.major}" stroke="${pp.major}" stroke-width="1.3" fill="none"/>`;
    }
    gridLayer.innerHTML = out;
  }

  const tag = (x, y, txt, bg) => {
    const tw = txt.length * 6.6 + 12;
    return `<g transform="translate(${r2(x)} ${r2(y)})"><rect x="0" y="-11" width="${r2(tw)}" height="20" rx="4" fill="${bg}" opacity=".9"/>` +
      `<text x="6" y="3" font-size="12" fill="#fff">${esc(txt)}</text></g>`;
  };
  const ring = (c, r, col, w = 2) => `<circle cx="${r2(c[0])}" cy="${r2(c[1])}" r="${r}" fill="none" stroke="${col}" stroke-width="${w}"/>`;
  const dot = (c, r, col) => `<circle cx="${r2(c[0])}" cy="${r2(c[1])}" r="${r}" fill="${col}"/>`;

  function overlaySvg() {
    const o = [];
    const sc = STYLE.selCol;
    if (tool === 'pipe') {
      Object.keys(doc.nodes).forEach((id) => {
        const c = P(ISO.nodePt(doc, id));
        o.push(`<circle cx="${r2(c[0])}" cy="${r2(c[1])}" r="3.5" fill="#fff" stroke="#64707d" stroke-width="1.4"/>`);
      });
    }
    if (tool === 'pipe' && run && !preview) {
      const A = P(run.start.pt);
      o.push(ring(A, 8, sc, 2) + dot(A, 4, sc));
    }
    if (tool === 'pipe' && preview) {
      if (run) {
        const A = P(run.start.pt);
        const route = preview.route.map(P);
        const d = 'M' + [A].concat(route).map((p) => r2(p[0]) + ' ' + r2(p[1])).join('L');
        const B = route[route.length - 1];
        const snap = preview.snap;
        if (snap && snap.kind === 'align') {
          const F = P(snap.from);
          o.push(`<line x1="${r2(F[0])}" y1="${r2(F[1])}" x2="${r2(B[0])}" y2="${r2(B[1])}" stroke="${SNAP_COL}" stroke-width="1" stroke-dasharray="4 4"/>`);
          o.push(ring(F, 5, SNAP_COL, 1.5));
        }
        o.push(`<path d="${d}" fill="none" stroke="${sc}" stroke-width="${STYLE.lw}" stroke-dasharray="8 5" stroke-linecap="round" stroke-linejoin="round" opacity=".75"/>`);
        o.push(dot(A, 4, sc));
        route.slice(0, -1).forEach((p) => o.push(dot(p, 3, sc)));
        if (snap && snap.kind === 'grid') o.push(ring(B, 6, SNAP_COL, 2) + dot(B, 2.5, SNAP_COL));
        else if (snap) o.push(ring(B, 8, SNAP_COL, 2.5) + dot(B, 2.5, SNAP_COL));
        else o.push(dot(B, 4, sc));
        const txt = preview.len == null ? T('tag.pipes', { n: route.length }) : `${ISO.dirName(preview.dir)} ${fmt(preview.len)} mm`;
        const mid = lerp(A, route[0], 0.5);
        o.push(tag(mid[0] + 12, mid[1] - 14, txt, '#1d2733'));
        if (snap && snap.kind !== 'grid') o.push(tag(B[0] + 14, B[1] + 18, snapText(snap.kind), SNAP_COL));
      } else {
        const A = P(preview.pt);
        if (preview.snap && preview.snap.kind === 'grid') {
          o.push(ring(A, 6, SNAP_COL, 2) + dot(A, 2, SNAP_COL));
        } else if (preview.snap) {
          o.push(ring(A, 8, SNAP_COL, 2.5) + dot(A, 2.5, SNAP_COL));
          o.push(tag(A[0] + 14, A[1] + 18, snapText(preview.snap.kind), SNAP_COL));
        } else {
          o.push(ring(A, 6, sc) + dot(A, 1.8, sc));
        }
      }
    }
    if (ISO.FITTINGS[tool] && preview && preview.pipeId) {
      const pipe = ISO.byId(doc.pipes, preview.pipeId);
      if (pipe) {
        const g = ISO.pipeGeom(doc, pipe, P);
        const c = lerp(g.A, g.B, preview.t);
        const st = { col: sc, bg: '#fff', thin: STYLE.thin, lw: STYLE.lw };
        if (preview.len) {
          // the component is added here and pushes the rest of the line along
          const half = (preview.len * view.zoom) / 2;
          st.sa = Math.max(half, STYLE.sym * 0.9);
          const cc = add(c, g.d, half);
          o.push(`<g opacity=".6">${ISO.drawFitting(tool, cc, g.d, g.p, g.n, STYLE.sym, st, preview.flip, preview.side)}</g>`);
          o.push(dot(c, 3, sc));
          o.push(tag(c[0] + 12, c[1] + 22, T('tag.insert', { len: fmt(preview.len) }), sc));
        } else {
          o.push(`<g opacity=".55">${ISO.drawFitting(tool, c, g.d, g.p, g.n, STYLE.sym, st, preview.flip, preview.side)}</g>`);
        }
      }
    }
    if (popup && popup.kind === 'pipe' && popup.t != null) {
      const pipe = ISO.byId(doc.pipes, popup.id);
      if (pipe) { const g = ISO.pipeGeom(doc, pipe, P); o.push(ring(lerp(g.A, g.B, popup.t), 5, sc, 1.5)); }
    }
    return o.join('');
  }

  svg.innerHTML = '<g id="gridLayer"></g><g id="drawLayer"></g>';
  const gridLayer = svg.querySelector('#gridLayer');
  const drawLayer = svg.querySelector('#drawLayer');

  function render() {
    const w = wrap.clientWidth, h = wrap.clientHeight;
    svg.setAttribute('viewBox', `0 0 ${w} ${h}`);
    renderGrid(w, h);
    const psel = popup ? { type: popup.kind, id: popup.id } : sel;
    drawLayer.innerHTML = ISO.renderDrawing(doc, Object.assign({ P, sel: psel, hover }, STYLE)) + overlaySvg();
    if (run && typed && mouse) {
      typedEl.hidden = false;
      typedEl.textContent = `${typed} mm  ↵`;
      typedEl.style.left = mouse[0] + 18 + 'px';
      typedEl.style.top = mouse[1] + 16 + 'px';
    } else typedEl.hidden = true;
    let cur = 'default';
    if (tool === 'pan' || spaceDown) cur = drag && drag.kind === 'pan' ? 'grabbing' : 'grab';
    else if (tool === 'pipe' || tool === 'label' || ISO.FITTINGS[tool]) cur = 'crosshair';
    else if (hover) cur = 'pointer';
    svg.style.cursor = cur;
    syncProject();
    const sv = String(SCALES[scaleIndex(view.zoom)]);
    if (scaleSel.value !== sv) scaleSel.value = sv;
  }

  // Scale selector (bottom left of the drawing)
  const scaleSel = $('#scaleSel');
  scaleSel.innerHTML = SCALES.map((n) => `<option value="${n}">1:${n}</option>`).join('');
  scaleSel.addEventListener('change', () => {
    setScale(SCALES.indexOf(parseInt(scaleSel.value, 10)));
    render(); updateStatus();
    svg.focus({ preventScroll: true });
  });

  // ---------- project name (next to the compass) and compass on/off ----------
  const projInput = $('#projName');
  /** Show the drawing's project name in the field (unless it is being typed in). */
  function syncProject() {
    const v = doc.title.project || '';
    if (document.activeElement !== projInput && projInput.value !== v) projInput.value = v;
  }
  let projPending = true; // one undo step per editing session
  projInput.addEventListener('focus', () => { projPending = true; });
  projInput.addEventListener('input', () => {
    if (projPending) { pushHistory(); projPending = false; updateButtons(); }
    doc.title.project = projInput.value;
    const sb = document.getElementById('t-project');
    if (sb && sb !== document.activeElement) sb.value = projInput.value;
    autosave();
  });
  projInput.addEventListener('change', () => { projPending = true; });
  projInput.addEventListener('keydown', (e) => { if (e.key === 'Enter') { projInput.blur(); svg.focus({ preventScroll: true }); } });
  function applyDisplay() {
    wrap.classList.toggle('no-compass', ISO.profile.get().showCompass === false);
    projInput.placeholder = T('prj.ph');
  }

  function updateStatus() {
    let s = '';
    if (tool === 'select') s = T('st.select');
    else if (tool === 'edit') s = T('st.edit');
    else if (tool === 'pipe') {
      const snapTxt = preview && preview.snap ? T('st.snap', { s: snapText(preview.snap.kind) }) : '';
      const planeTxt = doc.settings.angles === '45' ? T('st.plane', { p: T('plane.' + plane) }) : '';
      if (run && preview && preview.len == null) s = T('st.pipeRoute', { n: preview.route.length }) + snapTxt;
      else if (run && preview) s = T('st.pipeRun', { dir: ISO.dirName(preview.dir), len: fmt(preview.len) }) + snapTxt + planeTxt;
      else s = T('st.pipeStart') + snapTxt + planeTxt;
    } else if (tool === 'label') s = T('st.label');
    else if (tool === 'pan') s = T('st.pan');
    else if (isInline(tool)) {
      const pp = preview && preview.pipeId ? ISO.byId(doc.pipes, preview.pipeId) : null;
      s = T('st.insert', { name: esc(ISO.fitName(tool)), len: fmt(insertLength(tool, pp)) });
    } else if (ISO.FITTINGS[tool]) s = T('st.fitting', { name: esc(ISO.fitName(tool)) });
    statusEl.innerHTML = s;
    let c = '';
    if (tool === 'pipe' && preview && preview.pt) c = fmtPt(preview.pt);
    else if (hover && hover.type === 'node' && doc.nodes[hover.id]) c = fmtPt(ISO.nodePt(doc, hover.id));
    coordsEl.textContent = c;
  }

  function updateButtons() {
    document.querySelector('[data-cmd=undo]').disabled = !undoStack.length;
    document.querySelector('[data-cmd=redo]').disabled = !redoStack.length;
  }

  function fit() {
    const b = ISO.isoBounds(doc);
    const w = wrap.clientWidth, h = wrap.clientHeight;
    if (!b) { view.zoom = zoomOf(isMobile() ? 100 : 50); view.panX = w / 2; view.panY = h / 2; render(); return; }
    const pad = isMobile() ? 50 : 90;
    const bw = Math.max(b.x1 - b.x0, 1), bh = Math.max(b.y1 - b.y0, 1);
    // the largest standard scale (closest view, at most 1:10) at which the whole drawing fits
    const zf = Math.min((w - 2 * pad) / bw, (h - 2 * pad) / bh);
    const i = SCALES.findIndex((n) => n >= 10 && zoomOf(n) <= zf);
    view.zoom = zoomOf(SCALES[i < 0 ? SCALES.length - 1 : i]);
    view.panX = w / 2 - ((b.x0 + b.x1) / 2) * view.zoom;
    view.panY = h / 2 - ((b.y0 + b.y1) / 2) * view.zoom;
    render();
  }

  // ---------- tools & palette ----------
  const ICONS = {
    select: '<path d="M9 5v19l5-5 3.6 7.2 2.6-1.3-3.5-7H23z" fill="currentColor"/>',
    edit: '<g fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"><path d="M5 21L21 5"/><path d="M8 18l2 2M11 15l1.5 1.5M14 12l2 2M17 9l1.5 1.5"/><path d="M4 26h22" stroke-width="1.2"/><path d="M4 23v6M26 23v6" stroke-width="1.2"/></g>',
    label: '<path d="M5 25l6-6" stroke="currentColor" stroke-width="1.5"/><circle cx="5" cy="25" r="1.8" fill="currentColor"/><text x="11" y="17" font-size="13" font-weight="700" fill="currentColor" font-family="Arial">Aa</text>',
    pan: '<path d="M15 4v22M4 15h22M15 4l-3 3m3-3l3 3M15 26l-3-3m3 3l3-3M4 15l3-3m-3 3l3 3M26 15l-3-3m3 3l-3 3" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/>',
    pipeKF: '<path d="M4 22l8-4.6V8l13 7.5" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linejoin="round" stroke-linecap="round"/><text x="17" y="27" font-size="8" font-weight="700" fill="currentColor" font-family="Arial">KF</text>',
    pipeK: '<path d="M4 22l8-4.6V8l13 7.5" fill="none" stroke="currentColor" stroke-width="3.4" stroke-linejoin="round" stroke-linecap="round"/><text x="19" y="27" font-size="8" font-weight="700" fill="currentColor" font-family="Arial">K</text>',
  };
  const DRAW_TOOLS = [['select', 'v'], ['edit', 'e'], ['label', 't'], ['pan', 'h']];
  let collapsed = new Set();
  try { collapsed = new Set(JSON.parse(localStorage.getItem('pipeiso.cats') || '[]')); } catch (e) { /* ignore */ }

  function fittingIcon(type) {
    return '<line x1="2" y1="16" x2="28" y2="16" stroke="currentColor" stroke-width="2"/>' +
      ISO.drawFitting(type, [15, 16], [1, 0], [0, -1], [0, 1], 7.5, { col: 'currentColor', bg: '#fff', thin: 1.1, lw: 2 }, false, 1);
  }

  // ---------- palette: categories, valve sub-groups (slide-out), favorites ----------
  const flyout = document.createElement('div');
  flyout.className = 'flyout';
  flyout.hidden = true;
  document.body.appendChild(flyout);
  const groupLast = {};  // last item picked in each sub-group

  /** Everything a palette button needs for one item id (tool, pipe:KF, gate, …). */
  function itemDef(id) {
    if (id === 'pipe:KF' || id === 'pipe:K') {
      const std = id.slice(5);
      return { id, tool: 'pipe', std, name: T('tool.pipe' + std), icon: ICONS['pipe' + std], title: T('tool.pipe' + std) + (std === 'KF' ? ' (P)' : '') };
    }
    const dt = DRAW_TOOLS.find((x) => x[0] === id);
    if (dt) return { id, tool: id, name: T('tool.' + id), icon: ICONS[id], title: id === 'edit' ? T('tip.edit') : `${T('tool.' + id)} (${dt[1].toUpperCase()})` };
    const f = ISO.FITTINGS[id];
    if (f) return { id, tool: id, name: T('fits.' + id), icon: fittingIcon(id), title: ISO.fitName(id) + (f.key ? ` (${f.key.toUpperCase()})` : '') };
    return null;
  }
  const favs = () => (ISO.profile.get().favs || []).filter((id) => itemDef(id));
  function toggleFav(id) {
    const list = favs();
    const i = list.indexOf(id);
    if (i >= 0) list.splice(i, 1); else list.push(id);
    ISO.profile.set({ favs: list });
    buildPalette();
    const fg = flyout.hidden ? '' : flyout.dataset.fgroup;
    if (fg && fg.startsWith('cat:')) openCatPanel(fg.slice(4), null);
    else if (fg) openFlyout(fg, null);
  }
  function toolBtn(id) {
    const d = itemDef(id);
    const on = favs().includes(id);
    return `<button class="tool" data-item="${id}" data-tool="${d.tool}"${d.std ? ` data-std="${d.std}"` : ''} title="${esc(d.title)}">` +
      `<svg viewBox="0 0 30 30">${d.icon}</svg>${esc(d.name)}<span class="fav-star${on ? ' on' : ''}" data-fav="${id}" title="${esc(T('fav.toggle'))}">${on ? '★' : '☆'}</span></button>`;
  }
  function groupOf(id) {
    for (const c of ISO.CATEGORIES) for (const g of c.groups || []) if (g.items.includes(id)) return g;
    return null;
  }

  // On phones the parts are grouped: one button per category (pipes, valves, flanges, …).
  // Tapping it opens the list of its parts; a long press lets you drag the button to another place.
  const MOBILE_CATS = ['pipes'].concat(ISO.CATEGORIES.map((c) => c.id));
  const catLast = {};   // last part picked in each category (shown on its button)
  let paletteMobile = null; // layout the palette was last built for
  function catItems(id) {
    if (id === 'pipes') return ['pipe:KF', 'pipe:K'];
    const c = ISO.CATEGORIES.find((x) => x.id === id);
    return !c ? [] : c.groups ? c.groups.flatMap((g) => g.items) : c.items;
  }
  const catOfItem = (item) => MOBILE_CATS.find((id) => catItems(id).includes(item)) || null;
  function catOrder() {
    const saved = (ISO.profile.get().catOrder || []).filter((id) => MOBILE_CATS.includes(id));
    return saved.concat(MOBILE_CATS.filter((id) => !saved.includes(id)));
  }
  function catBtn(id) {
    const d = itemDef(catLast[id] || catItems(id)[0]);
    return `<button class="tool cat-btn" data-mcat="${id}" title="${esc(T('cat.' + id))} – ${esc(T('tip.catBtn'))}">` +
      `<svg viewBox="0 0 30 30">${d.icon}</svg>${esc(T('cats.' + id))}<span class="chev-u">▴</span></button>`;
  }
  /** Phone: open the list of parts of one category above the bottom bar. */
  function openCatPanel(id, anchor) {
    const c = ISO.CATEGORIES.find((x) => x.id === id);
    const inner = c && c.groups
      ? c.groups.map((g) => `<div class="flyout-sub">${esc(T('grp.' + g.id))}</div><div class="flyout-items">${g.items.map(toolBtn).join('')}</div>`).join('')
      : `<div class="flyout-items">${catItems(id).map(toolBtn).join('')}</div>`;
    flyout.className = 'flyout catpanel';
    flyout.dataset.fgroup = 'cat:' + id;
    flyout.innerHTML = `<div class="flyout-head">${esc(T('cat.' + id))}</div>${inner}<div class="flyout-hint">${esc(T('fav.hintShort'))}</div>`;
    flyout.hidden = false;
    markActiveTool();
    const btn = anchor || document.querySelector(`[data-mcat="${id}"]`);
    if (!btn) return;
    const r = btn.getBoundingClientRect();
    const pal = $('#palette').getBoundingClientRect();
    const fw = flyout.offsetWidth, fh = flyout.offsetHeight;
    flyout.style.left = clamp(r.left + r.width / 2 - fw / 2, 6, window.innerWidth - fw - 6) + 'px';
    flyout.style.top = Math.max(6, pal.top - fh - 6) + 'px';
  }

  function buildPalette() {
    const cat = (id, inner) =>
      `<div class="cat${collapsed.has(id) ? ' collapsed' : ''}" data-cat="${id}"><button class="cat-head" data-cathead="${id}">${esc(T('cat.' + id))}<span class="chev">▾</span></button><div class="cat-items">${inner}</div></div>`;
    const fl = favs();
    paletteMobile = isMobile();
    if (paletteMobile) {
      let m = fl.length ? cat('favs', fl.map(toolBtn).join('')) : '';
      m += cat('draw', DRAW_TOOLS.map(([id]) => toolBtn(id)).join(''));
      m += `<div class="cat cat-groups" id="catGroups">${catOrder().map(catBtn).join('')}</div>`;
      $('#palette').innerHTML = m;
      markActiveTool();
      return;
    }
    let h = cat('favs', fl.length ? fl.map(toolBtn).join('') : `<div class="fav-hint">${esc(T('fav.hint'))}</div>`);
    h += cat('draw', DRAW_TOOLS.map(([id]) => toolBtn(id)).join(''));
    h += cat('pipes', toolBtn('pipe:KF') + toolBtn('pipe:K'));
    ISO.CATEGORIES.forEach((c) => {
      if (c.groups) {
        h += cat(c.id, c.groups.map((g) => {
          const show = groupLast[g.id] || g.items[0];
          return `<button class="tool group-btn" data-group="${g.id}" title="${esc(T('grp.' + g.id))}: ${esc(g.items.map(ISO.fitName).join(', '))}">` +
            `<svg viewBox="0 0 30 30">${fittingIcon(show)}</svg>${esc(T('grp.' + g.id))}<span class="chev-r">▸</span></button>`;
        }).join(''));
      } else {
        h += cat(c.id, c.items.map(toolBtn).join(''));
      }
    });
    $('#palette').innerHTML = h;
    markActiveTool();
  }

  function openFlyout(gid, anchor) {
    const g = ISO.CATEGORIES.flatMap((c) => c.groups || []).find((x) => x.id === gid);
    if (!g) return;
    flyout.className = 'flyout';
    flyout.dataset.fgroup = gid;
    flyout.innerHTML = `<div class="flyout-head">${esc(T('grp.' + gid))}</div><div class="flyout-items">${g.items.map(toolBtn).join('')}</div>`;
    flyout.hidden = false;
    markActiveTool();
    const btn = anchor || document.querySelector(`[data-group="${gid}"]`);
    if (!btn) return;
    const r = btn.getBoundingClientRect();
    const pal = $('#palette').getBoundingClientRect();
    const fw = flyout.offsetWidth, fh = flyout.offsetHeight;
    if (isMobile()) {
      flyout.style.left = clamp(r.left + r.width / 2 - fw / 2, 6, window.innerWidth - fw - 6) + 'px';
      flyout.style.top = Math.max(6, pal.top - fh - 6) + 'px';
    } else {
      flyout.style.left = pal.right + 6 + 'px';
      flyout.style.top = clamp(r.top - 8, 6, window.innerHeight - fh - 6) + 'px';
    }
  }
  function closeFlyout() { flyout.hidden = true; flyout.dataset.fgroup = ''; }
  document.addEventListener('pointerdown', (e) => {
    if (!flyout.hidden && !flyout.contains(e.target) && !e.target.closest('[data-group], [data-mcat]')) closeFlyout();
  });
  $('#palette').addEventListener('scroll', () => { if (!moving) closeFlyout(); }, { passive: true });

  // Long press: on a part toggles it as a favorite; on a category button (phone) lets you move the button
  let pressTimer = null, pressFired = false, pressAt = null;
  function onPressStart(e) {
    const b = e.target.closest('[data-item], [data-mcat]');
    pressFired = false;
    if (!b) return;
    clearTimeout(pressTimer);
    pressAt = [e.clientX, e.clientY];
    pressTimer = setTimeout(() => {
      pressFired = true;
      if (b.dataset.mcat) startMove(b); else toggleFav(b.dataset.item);
      if (navigator.vibrate) navigator.vibrate(15);
    }, 550);
  }
  const onPressEnd = () => clearTimeout(pressTimer);
  function onPressMove(e) { if (pressAt && Math.hypot(e.clientX - pressAt[0], e.clientY - pressAt[1]) > 10) clearTimeout(pressTimer); }

  // ---------- moving a category button (phone) ----------
  let moving = null;
  function startMove(btn) {
    closeFlyout();
    moving = btn;
    btn.classList.add('moving');
    $('#palette').classList.add('reordering');
    window.addEventListener('pointermove', moveTo);
    window.addEventListener('pointerup', endMove);
    window.addEventListener('pointercancel', endMove);
  }
  function moveTo(e) {
    if (!moving) return;
    const bar = $('#catGroups');
    if (!bar) return;
    const x = e.clientX;
    const others = [...bar.querySelectorAll('[data-mcat]')].filter((b) => b !== moving);
    const before = others.find((b) => { const r = b.getBoundingClientRect(); return x < r.left + r.width / 2; });
    if (before) { if (moving.nextElementSibling !== before) bar.insertBefore(moving, before); }
    else if (bar.lastElementChild !== moving) bar.appendChild(moving);
    // scroll the bar when the finger is near its edge
    const pal = $('#palette'), pr = pal.getBoundingClientRect();
    if (x < pr.left + 36) pal.scrollLeft -= 10; else if (x > pr.right - 36) pal.scrollLeft += 10;
  }
  function endMove() {
    window.removeEventListener('pointermove', moveTo);
    window.removeEventListener('pointerup', endMove);
    window.removeEventListener('pointercancel', endMove);
    if (!moving) return;
    moving.classList.remove('moving');
    $('#palette').classList.remove('reordering');
    moving = null;
    const bar = $('#catGroups');
    if (bar) ISO.profile.set({ catOrder: [...bar.querySelectorAll('[data-mcat]')].map((b) => b.dataset.mcat) });
  }
  // While moving, the finger must not scroll the bar
  $('#palette').addEventListener('touchmove', (e) => { if (moving) e.preventDefault(); }, { passive: false });

  function onPaletteClick(e) {
    if (pressFired) { pressFired = false; e.preventDefault(); return; }
    const mc = e.target.closest('[data-mcat]');
    if (mc) {
      const id = mc.dataset.mcat;
      if (!flyout.hidden && flyout.dataset.fgroup === 'cat:' + id) closeFlyout(); else openCatPanel(id, mc);
      return;
    }
    const star = e.target.closest('[data-fav]');
    if (star) { e.stopPropagation(); toggleFav(star.dataset.fav); return; }
    const head = e.target.closest('[data-cathead]');
    if (head) {
      const id = head.dataset.cathead;
      if (collapsed.has(id)) collapsed.delete(id); else collapsed.add(id);
      head.parentElement.classList.toggle('collapsed', collapsed.has(id));
      try { localStorage.setItem('pipeiso.cats', JSON.stringify([...collapsed])); } catch (err) { /* ignore */ }
      return;
    }
    const gb = e.target.closest('[data-group]');
    if (gb) { if (!flyout.hidden && flyout.dataset.fgroup === gb.dataset.group) closeFlyout(); else openFlyout(gb.dataset.group, gb); return; }
    const b = e.target.closest('[data-tool]');
    if (b) {
      const g = groupOf(b.dataset.item);
      if (g) groupLast[g.id] = b.dataset.item;
      const ci = catOfItem(b.dataset.item);
      if (ci && flyout.contains(b)) catLast[ci] = b.dataset.item;
      setTool(b.dataset.tool, b.dataset.std);
      if (flyout.contains(b)) { closeFlyout(); buildPalette(); }
    }
  }
  [$('#palette'), flyout].forEach((el) => {
    el.addEventListener('click', onPaletteClick);
    el.addEventListener('pointerdown', onPressStart);
    el.addEventListener('pointermove', onPressMove);
    ['pointerup', 'pointerleave', 'pointercancel'].forEach((ev) => el.addEventListener(ev, onPressEnd));
    el.addEventListener('contextmenu', (e) => { if (e.target.closest('[data-item], [data-mcat]')) e.preventDefault(); });
  });

  function markActiveTool() {
    document.querySelectorAll('.tool[data-tool]').forEach((b) => {
      const on = b.dataset.tool === tool && (tool !== 'pipe' || b.dataset.std === pipeStd);
      b.classList.toggle('active', on);
    });
    const curItem = tool === 'pipe' ? 'pipe:' + pipeStd : tool;
    document.querySelectorAll('[data-mcat]').forEach((b) => b.classList.toggle('active', catItems(b.dataset.mcat).includes(curItem)));
    document.querySelectorAll('[data-group]').forEach((b) => {
      const g = ISO.CATEGORIES.flatMap((c) => c.groups || []).find((x) => x.id === b.dataset.group);
      b.classList.toggle('active', !!(g && g.items.includes(tool)));
    });
  }

  function buildCompass() {
    const c = [52, 56], L = 30;
    const axes = [['E', [1, 0, 0]], ['N', [0, 1, 0]], ['U', [0, 0, 1]]];
    let h = '';
    axes.forEach(([n, v]) => {
      const d = ISO.iso(v);
      const e = [c[0] + d[0] * L, c[1] + d[1] * L];
      h += `<line x1="${c[0]}" y1="${c[1]}" x2="${r2(e[0])}" y2="${r2(e[1])}" stroke="${n === 'N' ? '#0b63ce' : '#64707d'}" stroke-width="${n === 'N' ? 2.4 : 1.6}"/>`;
      h += `<text x="${r2(c[0] + d[0] * (L + 10))}" y="${r2(c[1] + d[1] * (L + 10) + 4)}" font-size="12" font-weight="${n === 'N' ? 700 : 400}" text-anchor="middle" fill="${n === 'N' ? '#0b63ce' : '#64707d'}" font-family="Segoe UI, Arial">${esc(T('cmp.' + n))}</text>`;
    });
    $('#compass').innerHTML = h;
  }

  function setTool(t, std) {
    tool = t;
    if (t === 'pipe' && ISO.STANDARDS[std]) pipeStd = std;
    run = null; typed = ''; hover = null;
    if (t !== 'edit') closePopup();
    preview = t === 'pipe' && mouse && lastPtr !== 'touch' ? startCandidate(mouse) : null;
    markActiveTool();
    updatePlanebar();
    render(); updateStatus();
  }

  // ---------- side panel ----------
  const field = (label, inner) => `<label class="field"><span>${esc(label)}</span>${inner}</label>`;
  const text = (id, val, extra = '') => `<input type="text" id="${id}" value="${esc(val == null ? '' : val)}" ${extra}>`;
  const num = (id, val, extra = '') => `<input type="number" inputmode="decimal" id="${id}" value="${esc(val)}" ${extra}>`;
  const check = (id, label, on) => `<label class="check"><input type="checkbox" id="${id}"${on ? ' checked' : ''}> ${esc(label)}</label>`;
  const select = (id, val, opts) => `<select id="${id}">${opts.map(([k, l]) => `<option value="${k}"${String(k) === String(val) ? ' selected' : ''}>${esc(l)}</option>`).join('')}</select>`;
  const stdOpts = () => Object.entries(ISO.STANDARDS).map(([k, s]) => [k, s.name]);
  const dnOpts = (std) => ISO.STANDARDS[std].dns.map((d) => [d, 'DN' + d]);
  const help = () => `<div class="help">${T('help')}</div>`;

  /** Bind an input so edits are applied to the document with one undo step per editing session. */
  function bind(id, apply, live = false) {
    const el = document.getElementById(id);
    if (!el) return;
    let pending = true;
    el.addEventListener('focus', () => (pending = true));
    const run_ = () => {
      const wasPending = pending;
      if (pending) { pushHistory(); pending = false; }
      const val = el.type === 'checkbox' ? el.checked : el.value;
      const err = apply(val, el);
      const msg = document.getElementById(id + '-msg');
      if (msg) msg.textContent = err || '';
      if (err && wasPending) { undoStack.pop(); pending = true; }
      autosave(); render(); updateButtons();
    };
    if (live) el.addEventListener('input', run_);
    el.addEventListener('change', () => { run_(); pending = true; });
  }

  const pointTypes = () => Object.keys(ISO.FITTINGS).filter((k) => !isInline(k)).map((k) => [k, ISO.fitName(k)]);
  const inlineTypes = () => Object.keys(ISO.FITTINGS).filter(isInline).map((k) => [k, ISO.fitName(k)]);
  const sizeOpts = () => ISO.allSizes().map(([k, d]) => [k + ':' + d, `DN${d} ${ISO.STANDARDS[k].name}`]);

  /** Fields for a component in the line: type, face-to-face length, sizes, orientation. */
  function compFields(pipe, prefix) {
    const c = pipe.comp;
    let h = field(T('sb.type'), select(prefix + '-ctype', c.type, inlineTypes()));
    h += field(T('sb.ftf'), num(prefix + '-clen', Math.round(ISO.pipeLen(doc, pipe)), 'min="1" step="1"')) + `<div class="msg" id="${prefix}-clen-msg"></div>`;
    h += '<div class="row2">' + field(T('sb.standard'), select(prefix + '-cstd', pipe.std, stdOpts())) +
      field(ISO.isReducer(c.type) ? T('sb.dnMain') : T('sb.dn'), select(prefix + '-cdn', pipe.dn, dnOpts(pipe.std))) + '</div>';
    if (ISO.isReducer(c.type)) h += field(T('sb.dnSmall'), select(prefix + '-csmall', `${c.std2}:${c.dn2}`, sizeOpts()));
    h += orientRows({ type: 'pipe', id: pipe.id }, prefix);
    return h;
  }
  function bindComp(prefix, id) {
    const get = () => ISO.byId(doc.pipes, id);
    const on = (sfx, fn) => { const el = document.getElementById(prefix + sfx); if (el) el.addEventListener('change', () => fn(el.value)); };
    on('-ctype', (v) => commit(() => {
      const p = get(); p.comp.type = v;
      if (ISO.isReducer(v) && !p.comp.dn2) { const o = ISO.nextSmaller(p.std, p.dn); p.comp.std2 = o.std; p.comp.dn2 = o.dn; }
    }));
    on('-clen', (v) => {
      const before = snapshot();
      const err = ISO.setPipeLength(doc, get(), parseFloat(v));
      const msg = document.getElementById(prefix + '-clen-msg');
      if (err) { doc = JSON.parse(before); if (msg) msg.textContent = err; return; }
      undoStack.push(before); redoStack.length = 0; changed();
    });
    on('-cstd', (v) => commit(() => { const p = get(); p.std = v; p.dn = ISO.defaultSpec(doc, v).dn; }));
    on('-cdn', (v) => commit(() => { get().dn = parseInt(v, 10); }));
    on('-csmall', (v) => commit(() => { const [k, d] = v.split(':'); const p = get(); p.comp.std2 = k; p.comp.dn2 = parseInt(d, 10); }));
    const root = prefix === 'pp' ? popupEl : sidebar;
    root.querySelectorAll('[data-flip]').forEach((b) => b.addEventListener('click', () => flipItem({ type: 'pipe', id }, b.dataset.flip)));
  }

  /** Drawing options (stored in the drawing file). */
  function drawingSettingsHtml() {
    const st = doc.settings;
    let h = '';
    h += field(T('sb.angles'), select('s-angles', st.angles || '90', [['90', T('ang.90')], ['45', T('ang.45')]]));
    h += field(T('sb.autoFlange'), select('s-flange', st.autoFlange || 'off', [['off', T('af.off')], ['ends', T('af.ends')], ['all', T('af.all')]]));
    h += '<div class="row2">' + field(T('sb.defaultKF'), select('s-dnKF', st.defaultDnKF, dnOpts('KF'))) +
      field(T('sb.defaultK'), select('s-dnK', st.defaultDnK, dnOpts('K'))) + '</div>';
    h += '<div class="row2">' + field(T('sb.grid'), num('s-grid', st.gridStep, 'min="10" step="10"')) +
      field(T('sb.snap'), num('s-snap', st.snap, 'min="1" step="1"')) + '</div><div class="msg" id="s-grid-msg"></div><div class="msg" id="s-snap-msg"></div>';
    h += field(T('sb.background'), select('s-gridstyle', st.gridStyle || 'lines', [['lines', T('bg.lines')], ['dots', T('bg.dots')], ['none', T('bg.none')]]));
    h += check('s-dims', T('sb.showDims'), st.showDims);
    h += check('s-csizes', T('sb.showCompSizes'), st.showCompSizes !== false);
    h += check('s-gsnap', T('sb.gridSnap'), st.gridSnap !== false);
    h += check('s-welds', T('sb.showWelds'), st.showWelds);
    return h;
  }
  function bindDrawingSettings() {
    bind('s-angles', (v) => { doc.settings.angles = v; if (v === '45' && plane === 'axes') plane = 'h'; updatePlanebar(); updateStatus(); });
    bind('s-flange', (v) => { doc.settings.autoFlange = v; });
    bind('s-dnKF', (v) => { doc.settings.defaultDnKF = parseInt(v, 10); });
    bind('s-dnK', (v) => { doc.settings.defaultDnK = parseInt(v, 10); });
    bind('s-grid', (v) => { const n = parseFloat(v); if (!(n >= 10)) return T('err.min', { n: 10 }); doc.settings.gridStep = n; });
    bind('s-snap', (v) => { const n = parseFloat(v); if (!(n >= 1)) return T('err.min', { n: 1 }); doc.settings.snap = n; });
    bind('s-gridstyle', (v) => { doc.settings.gridStyle = v; });
    bind('s-paper', (v) => { doc.settings.paperOnSheet = v; });
    bind('s-dims', (v) => { doc.settings.showDims = v; });
    bind('s-csizes', (v) => { doc.settings.showCompSizes = v; });
    bind('s-gsnap', (v) => { doc.settings.gridSnap = v; });
    bind('s-welds', (v) => { doc.settings.showWelds = v; });
  }

  function renderSidebar() {
    let h = '';
    const obj = sel && (sel.type === 'node' ? doc.nodes[sel.id] : ISO.byId({ pipe: doc.pipes, fitting: doc.fittings, label: doc.labels }[sel.type], sel.id));
    if (!obj) sel = null;
    const st = doc.settings;

    if (!sel) {
      h += `<h3>${esc(T('sb.drawing'))}</h3>`;
      if (!doc.pipes.length) h += help();
      h += `<h4>${esc(T('sb.titleBlock'))}</h4>`;
      const tf = ISO.TITLE_FIELDS;
      for (let i = 0; i < tf.length; i += 2) {
        h += '<div class="row2">' + tf.slice(i, i + 2).map((k) => field(T('tf.' + k), text('t-' + k, doc.title[k]))).join('') + '</div>';
      }
      h += field(T('sb.notes'), `<textarea id="t-notes" rows="3">${esc(doc.title.notes)}</textarea>`);
      h += `<p><button id="openSettings">${esc(T('btn.settings'))}…</button></p>`;
      if (doc.pipes.length) h += `<h4>${esc(T('sb.help'))}</h4>` + help();
    } else if (sel.type === 'pipe' && obj.comp) {
      h += `<h3>${esc(ISO.fitName(obj.comp.type))} · ${esc(ISO.compSizeText(obj))}</h3>`;
      h += compFields(obj, 'sc');
      h += check('p-dim', T('sb.showDim'), !obj.hideDim);
      h += check('p-flip', T('sb.dimFlip'), !!obj.dimFlip);
      h += `<p><button class="danger" id="del">${esc(T('sb.delete'))}</button></p>`;
    } else if (sel.type === 'pipe') {
      const pipe = obj;
      const [a, b] = ISO.pipeEnds(doc, pipe);
      const dd = ISO.dirOf(a, b);
      h += `<h3>${esc(T('sb.pipe'))} · ${esc(ISO.sizeLabel(pipe))}</h3>`;
      h += `<div class="readonly">${esc(T('sb.direction'))}: <b>${esc(dd ? ISO.dirName(dd) : T('sb.oblique'))}</b><br>${esc(T('sb.from'))} ${fmtPt(a)}<br>${esc(T('sb.to'))} ${fmtPt(b)}</div>`;
      h += field(T('sb.length'), num('p-len', Math.round(ISO.pipeLen(doc, pipe)), 'min="1" step="1"')) + '<div class="msg" id="p-len-msg"></div>';
      h += '<div class="row2">' + field(T('sb.standard'), select('p-std', pipe.std, stdOpts())) + field(T('sb.dn'), select('p-dn', pipe.dn, dnOpts(pipe.std))) + '</div>';
      h += check('p-dim', T('sb.showDim'), !pipe.hideDim);
      h += check('p-flip', T('sb.dimFlip'), !!pipe.dimFlip);
      h += `<p><button class="danger" id="del">${esc(T('sb.delPipe'))}</button></p>`;
    } else if (sel.type === 'fitting') {
      const f = obj;
      h += `<h3>${esc(ISO.fitName(f.type))}</h3>`;
      h += field(T('sb.type'), select('f-type', f.type, pointTypes()));
      h += field(T('sb.pos'), num('f-pos', Math.round(f.t * 100), 'min="1" max="99" step="1"')) + '<div class="msg" id="f-pos-msg"></div>';
      h += orientRows({ type: 'fitting', id: f.id }, 'sb');
      h += `<p><button class="danger" id="del">${esc(T('sb.delete'))}</button></p>`;
    } else if (sel.type === 'label') {
      h += `<h3>${esc(T('sb.label'))}</h3>`;
      h += field(T('sb.text'), `<textarea id="l-text" rows="3">${esc(obj.text)}</textarea>`);
      h += `<div class="help">${esc(T('sb.dragLabel'))}</div>`;
      h += `<p><button class="danger" id="del">${esc(T('sb.delLabel'))}</button></p>`;
    } else if (sel.type === 'node') {
      const deg = ISO.pipesAt(doc, sel.id).length;
      h += `<h3>${esc(T('sb.point'))}</h3><div class="readonly">${esc(T('kind.' + Math.min(deg, 4)))}<br>${fmtPt(ISO.nodePt(doc, sel.id))}</div>`;
      h += `<p><button id="cont">${esc(T('sb.continue'))}</button></p>`;
      h += `<div class="help">${esc(T('sb.delNodeHelp'))}</div>`;
      h += `<p><button class="danger" id="del">${esc(T('sb.delPoint'))}</button></p>`;
    }
    sidebar.innerHTML = h;
    const pb = document.querySelector('[data-cmd=props]');
    if (pb) pb.classList.toggle('has-sel', !!sel);

    if (!sel) {
      ISO.TITLE_FIELDS.forEach((k) => bind('t-' + k, (v) => { doc.title[k] = v; }));
      bind('t-notes', (v) => { doc.title.notes = v; });
      document.getElementById('openSettings').addEventListener('click', openSettings);
    } else if (sel.type === 'pipe' && ISO.byId(doc.pipes, sel.id).comp) {
      const id = sel.id;
      bindComp('sc', id);
      bind('p-dim', (v) => { ISO.byId(doc.pipes, id).hideDim = !v; });
      bind('p-flip', (v) => { ISO.byId(doc.pipes, id).dimFlip = v; });
    } else if (sel.type === 'pipe') {
      const id = sel.id;
      bind('p-len', (v) => ISO.setPipeLength(doc, ISO.byId(doc.pipes, id), parseFloat(v)));
      bind('p-std', (v) => { const p = ISO.byId(doc.pipes, id); p.std = v; p.dn = ISO.defaultSpec(doc, v).dn; setTimeout(renderSidebar); });
      bind('p-dn', (v) => { ISO.byId(doc.pipes, id).dn = parseInt(v, 10); setTimeout(renderSidebar); });
      bind('p-dim', (v) => { ISO.byId(doc.pipes, id).hideDim = !v; });
      bind('p-flip', (v) => { ISO.byId(doc.pipes, id).dimFlip = v; });
    } else if (sel.type === 'fitting') {
      const id = sel.id;
      bind('f-type', (v) => { ISO.byId(doc.fittings, id).type = v; setTimeout(renderSidebar); });
      bind('f-pos', (v) => { const n = parseFloat(v); if (!(n > 0 && n < 100)) return T('err.pos'); ISO.byId(doc.fittings, id).t = n / 100; });
      sidebar.querySelectorAll('[data-flip]').forEach((b) => b.addEventListener('click', () => flipItem({ type: 'fitting', id }, b.dataset.flip)));
    } else if (sel.type === 'label') {
      const id = sel.id;
      bind('l-text', (v) => { ISO.byId(doc.labels, id).text = v; }, true);
    } else if (sel.type === 'node') {
      const id = sel.id;
      document.getElementById('cont').addEventListener('click', () => { closeSheet(); startRunAt(id); });
    }
    const del = document.getElementById('del');
    if (del) del.addEventListener('click', deleteSelected);
  }

  function openSheet() { sidebarWrap.classList.add('open'); }
  function closeSheet() { sidebarWrap.classList.remove('open'); }
  $('#sheetClose').addEventListener('click', closeSheet);

  function deleteSelected() {
    const s = popup ? { type: popup.kind, id: popup.id } : sel;
    if (!s) return;
    closePopup();
    commit(() => {
      if (s.type === 'pipe') ISO.removePipe(doc, s.id);
      else if (s.type === 'node') ISO.removeNode(doc, s.id);
      else if (s.type === 'fitting') ISO.removeFitting(doc, s.id);
      else if (s.type === 'label') ISO.removeLabel(doc, s.id);
      sel = null; hover = null;
    });
    if (isMobile()) closeSheet();
  }

  // ---------- edit popup (length, angle, diameter, orientation) ----------
  function openPopup(kind, id, at, t) {
    popup = { kind, id, at, t: t == null ? null : t, msg: '' };
    renderPopup();
    render();
  }
  function closePopup() {
    if (!popup) return;
    popup = null;
    popupEl.hidden = true;
    render();
  }
  function placePopup() {
    if (isMobile()) { popupEl.style.left = ''; popupEl.style.top = ''; return; }
    const w = wrap.clientWidth, h = wrap.clientHeight;
    const pw = popupEl.offsetWidth || 270, ph = popupEl.offsetHeight || 260;
    let x = popup.at[0] + 18;
    const y = popup.at[1] + 18;
    if (x + pw > w - 8) x = popup.at[0] - pw - 18;
    popupEl.style.left = clamp(x, 8, Math.max(8, w - pw - 8)) + 'px';
    popupEl.style.top = clamp(y, 8, Math.max(8, h - ph - 8)) + 'px';
  }
  function renderPopup() {
    if (!popup) return;
    const close = `<button data-pp="close" title="${esc(T('pp.close'))}">✕</button>`;
    let h = '';
    const ppipe = popup.kind === 'pipe' ? ISO.byId(doc.pipes, popup.id) : null;
    if (ppipe && ppipe.comp) {
      h += `<h3>${esc(ISO.fitName(ppipe.comp.type))} · ${esc(ISO.compSizeText(ppipe))} ${close}</h3>`;
      h += compFields(ppipe, 'pp');
      h += `<div class="actions"><button class="danger" id="pp-del">${esc(T('sb.delete'))}</button></div>`;
    } else if (popup.kind === 'pipe') {
      const pipe = ppipe;
      if (!pipe) { closePopup(); return; }
      const [a, b] = ISO.pipeEnds(doc, pipe);
      const cur = ISO.dirOf(a, b);
      const dirs = allDirs();
      if (cur && !dirs.some((D) => D.key === cur.key)) dirs.push(cur);
      h += `<h3>${esc(T('sb.pipe'))} · ${esc(ISO.sizeLabel(pipe))} ${close}</h3>`;
      h += field(T('sb.length'), num('pp-len', Math.round(ISO.pipeLen(doc, pipe)), 'min="1" step="1"'));
      h += field(T('pp.angle'), select('pp-dir', cur ? cur.key : '', (cur ? [] : [['', T('sb.oblique')]]).concat(dirs.map((D) => [D.key, ISO.dirName(D)]))));
      if (doc.settings.angles !== '45') h += `<div class="note">${esc(T('pp.hint45'))}</div>`;
      h += '<div class="row2">' + field(T('sb.standard'), select('pp-std', pipe.std, stdOpts())) + field(T('sb.dn'), select('pp-dn', pipe.dn, dnOpts(pipe.std))) + '</div>';
      h += `<div class="msg" id="pp-msg">${esc(popup.msg || '')}</div>`;
      h += `<div class="actions"><button class="danger" id="pp-del">${esc(T('sb.delete'))}</button>${popup.t != null ? `<button id="pp-bend">${esc(T('pp.bend'))}</button>` : ''}<span style="flex:1"></span><button class="primary" id="pp-apply">${esc(T('pp.apply'))}</button></div>`;
    } else if (popup.kind === 'fitting') {
      const f = ISO.byId(doc.fittings, popup.id);
      if (!f) { closePopup(); return; }
      h += `<h3>${esc(ISO.fitName(f.type))} ${close}</h3>`;
      h += field(T('sb.type'), select('pp-type', f.type, pointTypes()));
      h += field(T('pp.position'), num('pp-pos', Math.round(f.t * 100), 'min="1" max="99" step="1"'));
      h += orientRows({ type: 'fitting', id: f.id }, 'pp');
      h += `<div class="msg" id="pp-msg">${esc(popup.msg || '')}</div>`;
      h += `<div class="actions"><button class="danger" id="pp-del">${esc(T('sb.delete'))}</button></div>`;
    }
    popupEl.innerHTML = h;
    popupEl.hidden = false;
    placePopup();

    popupEl.querySelector('[data-pp=close]').addEventListener('click', closePopup);
    const id = popup.id;
    if (ppipe && ppipe.comp) {
      bindComp('pp', id);
      $('#pp-del').addEventListener('click', deleteSelected);
    } else if (popup.kind === 'pipe') {
      const stdSel = $('#pp-std'), dnSel = $('#pp-dn');
      stdSel.addEventListener('change', () => {
        const d = ISO.defaultSpec(doc, stdSel.value).dn;
        dnSel.innerHTML = dnOpts(stdSel.value).map(([k, l]) => `<option value="${k}"${k === d ? ' selected' : ''}>${l}</option>`).join('');
      });
      $('#pp-apply').addEventListener('click', () => applyPipePopup(id));
      $('#pp-del').addEventListener('click', deleteSelected);
      popupEl.querySelectorAll('input').forEach((el) => el.addEventListener('keydown', (e) => { if (e.key === 'Enter') applyPipePopup(id); }));
      const bend = $('#pp-bend');
      if (bend) bend.addEventListener('click', () => addBend(id));
    } else {
      $('#pp-type').addEventListener('change', (e) => commit(() => { ISO.byId(doc.fittings, id).type = e.target.value; }));
      $('#pp-pos').addEventListener('change', (e) => {
        const n = parseFloat(e.target.value);
        if (!(n > 0 && n < 100)) { popup.msg = T('err.pos'); renderPopup(); return; }
        commit(() => { ISO.byId(doc.fittings, id).t = n / 100; });
      });
      popupEl.querySelectorAll('[data-flip]').forEach((b) => b.addEventListener('click', () => flipItem({ type: 'fitting', id }, b.dataset.flip)));
      $('#pp-del').addEventListener('click', deleteSelected);
    }
  }

  function applyPipePopup(id) {
    const pipe = ISO.byId(doc.pipes, id);
    if (!pipe) return;
    const before = snapshot();
    const len = parseFloat($('#pp-len').value);
    const dkey = $('#pp-dir').value;
    pipe.std = $('#pp-std').value;
    pipe.dn = parseInt($('#pp-dn').value, 10);
    const [a, b] = ISO.pipeEnds(doc, pipe);
    if (!(len > 0)) { doc = JSON.parse(before); popup.msg = T('err.len'); renderPopup(); return; }
    const D = allDirs().find((x) => x.key === dkey) || ISO.dirOf(a, b);
    const cur = v3.sub(b, a);
    const vec = D ? v3.scale(D.v, len) : v3.scale(cur, len / v3.len(cur));
    const err = v3.eq(v3.add(a, vec), b) ? null : ISO.setPipeVector(doc, pipe, vec);
    if (err) { doc = JSON.parse(before); popup.msg = err; renderPopup(); return; }
    undoStack.push(before);
    redoStack.length = 0;
    popup.msg = '';
    popup.t = null;
    changed();
  }

  /** Split the pipe at the popup point so the second part can be turned (adds a bend). */
  function addBend(id) {
    const pipe = ISO.byId(doc.pipes, id);
    if (!pipe || popup.t == null) return;
    const L = ISO.pipeLen(doc, pipe);
    const step = doc.settings.snap;
    if (L < 2 * step) { popup.msg = T('err.short'); renderPopup(); return; }
    const l = clamp(snapV(popup.t * L, step), step, L - step);
    const at = popup.at;
    let newId = null;
    commit(() => {
      ISO.splitPipe(doc, pipe, ISO.pipeAt(doc, pipe, l / L));
      newId = doc.pipes[doc.pipes.length - 1].id;
    });
    popup = { kind: 'pipe', id: newId, at, t: null, msg: T('pp.bendDone') };
    renderPopup(); render();
    const ds = $('#pp-dir'); if (ds) ds.focus();
  }

  // ---------- primary action (mouse click or finger tap) ----------
  let lastDown = null;
  function onDoubleClick(s) {
    const h = hitTest(s, ['label', 'node', 'pipe'], { node: SNAP_R });
    if (!h) return;
    if (h.type === 'label') {
      sel = { type: 'label', id: h.id }; renderSidebar(); render();
      if (isMobile()) openSheet();
      setTimeout(() => { const ta = document.getElementById('l-text'); if (ta) { ta.focus(); ta.select(); } }, 30);
    } else if (h.type === 'node') {
      startRunAt(h.id);
    } else if (h.type === 'pipe') {
      const pipe = ISO.byId(doc.pipes, h.id);
      if (h.t <= 0.3) startRunAt(pipe.a);
      else if (h.t >= 0.7) startRunAt(pipe.b);
    }
  }

  function primaryAction(s, e) {
    // A popup opened by a long press closes with the next tap outside it
    if (popup && tool !== 'edit') { closePopup(); if (tool === 'select') return; }
    const now = performance.now();
    const isDouble = lastDown && lastDown.tool === tool && now - lastDown.t < 450 && dist(s, lastDown.s) < 8 * tm();
    lastDown = isDouble ? null : { t: now, s, tool };

    if (tool === 'select') {
      if (isDouble) { drag = null; onDoubleClick(s); return; }
      const h = hitTest(s);
      sel = h ? { type: h.type, id: h.id } : null;
      if (h && (h.type === 'fitting' || h.type === 'label') && e) {
        drag = { kind: h.type, id: h.id, s0: s, moved: false };
        svg.setPointerCapture(e.pointerId);
      }
      render(); renderSidebar();
      if (isMobile() && !sel) closeSheet();
    } else if (tool === 'edit') {
      const h = hitTest(s, ['fitting', 'pipe']);
      if (!h) { closePopup(); return; }
      if (h.type === 'fitting') openPopup('fitting', h.id, s);
      else openPopup('pipe', h.id, s, h.t);
    } else if (tool === 'pipe') {
      if (!run) {
        beginRun(startCandidate(s));
        run.lastClick = s;
        preview = lastPtr === 'touch' ? null : runPreview(s);
      } else if (dist(s, P(run.start.pt)) < 6 * tm() || (run.lastClick && dist(s, run.lastClick) < 5 * tm())) {
        endRun(); // clicking the current point again (e.g. double-click) finishes the run
        return;
      } else {
        preview = runPreview(s);
        commitSegment();
        if (run) run.lastClick = s;
        if (lastPtr === 'touch') preview = null;
        else preview = run ? runPreview(s) : startCandidate(s);
      }
      render(); updateStatus();
    } else if (tool === 'label') {
      const h = hitTest(s, ['pipe']);
      if (!h) return;
      const pipe = ISO.byId(doc.pipes, h.id);
      commit(() => {
        const lab = { id: ISO.uid(doc, 'l'), pipeId: h.id, t: snapT(h.t), text: (pipe.comp ? [ISO.fitName(pipe.comp.type), ISO.compSizeText(pipe)] : [ISO.sizeLabel(pipe), doc.title.lineNo]).filter(Boolean).join(' – ') || T('lbl.default'), ox: 3, oy: -3.5 };
        doc.labels.push(lab);
        sel = { type: 'label', id: lab.id };
        tool = 'select';
        markActiveTool();
      });
      if (isMobile()) openSheet();
      setTimeout(() => { const ta = document.getElementById('l-text'); if (ta) { ta.focus(); ta.select(); } }, 30);
    } else if (isInline(tool)) {
      const h = hitTest(s, ['pipe'], { plain: true });
      if (!h) return;
      const pipe = ISO.byId(doc.pipes, h.id);
      const o = orientFor(h.id, h.t, s);
      const before = snapshot();
      const res = ISO.insertComponent(doc, pipe, insertAt(pipe, h.t), tool, { length: insertLength(tool, pipe), side: o.side, flip: o.flip });
      if (res.err) { doc = JSON.parse(before); flash(res.err); return; }
      undoStack.push(before);
      redoStack.length = 0;
      preview = null;
      changed({ sidebar: false });
    } else if (ISO.FITTINGS[tool]) {
      const h = hitTest(s, ['pipe'], { plain: true });
      if (!h) return;
      const o = orientFor(h.id, h.t, s);
      commit(() => { doc.fittings.push({ id: ISO.uid(doc, 'f'), type: tool, pipeId: h.id, t: snapT(h.t), flip: o.flip, side: o.side }); }, { sidebar: false });
    }
  }

  // ---------- drag helpers ----------
  function dragMove(s) {
    if (!drag.moved) {
      if (dist(s, drag.s0) < (lastPtr === 'touch' ? 8 : 3)) return;
      pushHistory();
      drag.moved = true;
    }
    if (drag.kind === 'fitting') {
      const f = ISO.byId(doc.fittings, drag.id);
      const g = ISO.pipeGeom(doc, ISO.byId(doc.pipes, f.pipeId), P);
      f.t = clamp(distSeg(s, g.A, g.B).t, 0.02, 0.98);
    } else if (drag.kind === 'label') {
      const lab = ISO.byId(doc.labels, drag.id);
      const { anchor } = ISO.labelPos(doc, lab, P, STYLE.sym);
      lab.ox = (s[0] - anchor[0]) / STYLE.sym;
      lab.oy = (s[1] - anchor[1]) / STYLE.sym;
    }
    render();
  }
  function finishDrag() {
    const d = drag;
    drag = null;
    if (d && d.moved) changed(); else render();
  }

  // ---------- pointer events (mouse, pen and touch) ----------
  const touches = new Map();
  let pinch = null;
  let tap = null;

  // Long press with one finger on a pipe or component opens the edit popup (length, size, type)
  let longPress = null; // { timer, s }
  function armLongPress(s) {
    cancelLongPress();
    longPress = { s, timer: setTimeout(() => onLongPress(s), 500) };
  }
  function cancelLongPress() { if (longPress) { clearTimeout(longPress.timer); longPress = null; } }
  function onLongPress(s) {
    longPress = null;
    if (touches.size !== 1) return;
    const h = hitTest(s, ['label', 'fitting', 'pipe']);
    if (!h) return;
    tap = null;            // the finger lifting must not also place or select something
    if (drag && drag.moved) return;
    drag = null;
    if (navigator.vibrate) navigator.vibrate(20);
    closeFlyout();
    if (h.type === 'label') {
      sel = { type: 'label', id: h.id }; renderSidebar(); render(); openSheet();
      return;
    }
    openPopup(h.type === 'fitting' ? 'fitting' : 'pipe', h.id, s, h.type === 'pipe' ? h.t : null);
  }

  svg.addEventListener('contextmenu', (e) => e.preventDefault());

  svg.addEventListener('pointerdown', (e) => {
    lastPtr = e.pointerType || 'mouse';
    svg.focus({ preventScroll: true });
    const s = evPos(e);

    if (lastPtr === 'touch') {
      touches.set(e.pointerId, s);
      try { svg.setPointerCapture(e.pointerId); } catch (err) { /* ignore */ }
      if (touches.size === 2) {
        tap = null;
        cancelLongPress();
        if (drag) finishDrag();
        const [p1, p2] = [...touches.values()];
        pinch = { d0: Math.max(dist(p1, p2), 1), z0: view.zoom, m0: lerp(p1, p2, 0.5), pan0: [view.panX, view.panY] };
        return;
      }
      if (touches.size > 2) return;
      mouse = s;
      hover = null;
      armLongPress(s);
      if (tool === 'select') {
        const h = hitTest(s, ['label', 'fitting']);
        if (h) {
          sel = { type: h.type, id: h.id };
          drag = { kind: h.type, id: h.id, s0: s, moved: false };
          render(); renderSidebar();
          return;
        }
      }
      tap = { s0: s, pan0: [view.panX, view.panY], moved: false };
      return;
    }

    mouse = s;
    if (e.button === 1 || (e.button === 0 && (spaceDown || tool === 'pan'))) {
      e.preventDefault();
      drag = { kind: 'pan', s0: s, pan0: [view.panX, view.panY] };
      svg.setPointerCapture(e.pointerId);
      render();
      return;
    }
    if (e.button === 2) { if (run) endRun(); return; }
    if (e.button === 0) primaryAction(s, e);
  });

  svg.addEventListener('pointermove', (e) => {
    const s = evPos(e);
    if (e.pointerType === 'touch') {
      if (!touches.has(e.pointerId)) return;
      touches.set(e.pointerId, s);
      if (longPress && dist(s, longPress.s) > 10) cancelLongPress();
      if (pinch && touches.size >= 2) {
        const [p1, p2] = [...touches.values()];
        const z = zoomOf(SCALES[scaleIndex((pinch.z0 * dist(p1, p2)) / pinch.d0)]); // only standard scales
        const m = lerp(p1, p2, 0.5);
        const wx = (pinch.m0[0] - pinch.pan0[0]) / pinch.z0, wy = (pinch.m0[1] - pinch.pan0[1]) / pinch.z0;
        view.zoom = z; view.panX = m[0] - wx * z; view.panY = m[1] - wy * z;
        render();
        return;
      }
      if (drag) { dragMove(s); return; }
      if (tap) {
        if (!tap.moved && dist(s, tap.s0) > 10) tap.moved = true;
        if (tap.moved) {
          view.panX = tap.pan0[0] + s[0] - tap.s0[0];
          view.panY = tap.pan0[1] + s[1] - tap.s0[1];
          render();
        }
      }
      return;
    }

    mouse = s;
    if (drag) {
      if (drag.kind === 'pan') {
        view.panX = drag.pan0[0] + s[0] - drag.s0[0];
        view.panY = drag.pan0[1] + s[1] - drag.s0[1];
        render();
        return;
      }
      dragMove(s);
      return;
    }
    if (tool === 'select' || tool === 'edit') hover = hitTest(s, tool === 'edit' ? ['fitting', 'pipe'] : undefined);
    else if (tool === 'pipe') preview = run ? runPreview(s) : startCandidate(s);
    else if (tool === 'label') {
      const h = hitTest(s, ['pipe']);
      hover = h ? { type: 'pipe', id: h.id } : null;
      preview = null;
    } else if (ISO.FITTINGS[tool]) {
      const h = hitTest(s, ['pipe'], { plain: true });
      hover = h ? { type: 'pipe', id: h.id } : null;
      preview = null;
      if (h) {
        const pipe = ISO.byId(doc.pipes, h.id);
        if (isInline(tool)) {
          const dq = insertAt(pipe, h.t);
          const t = dq / ISO.pipeLen(doc, pipe);
          preview = Object.assign({ pipeId: h.id, t, len: insertLength(tool, pipe) }, orientFor(h.id, h.t, s));
        } else {
          preview = Object.assign({ pipeId: h.id, t: snapT(h.t) }, orientFor(h.id, h.t, s));
        }
      }
    }
    render();
    updateStatus();
  });

  function endTouch(e, cancelled) {
    const s = evPos(e);
    touches.delete(e.pointerId);
    cancelLongPress();
    if (pinch) {
      if (touches.size < 2) pinch = null;
      tap = null;
      return;
    }
    if (drag) { finishDrag(); return; }
    if (tap && !tap.moved && !cancelled) { mouse = s; primaryAction(s, null); }
    tap = null;
  }

  svg.addEventListener('pointerup', (e) => {
    if (e.pointerType === 'touch') { endTouch(e, false); return; }
    if (drag) finishDrag();
  });
  svg.addEventListener('pointercancel', (e) => {
    if (e.pointerType === 'touch') { endTouch(e, true); return; }
    if (drag) finishDrag();
  });

  svg.addEventListener('pointerleave', (e) => {
    if (drag || e.pointerType === 'touch') return;
    hover = null;
    if (!run) preview = null;
    render();
  });

  // Mouse wheel: one notch = one standard scale (touchpads add up small steps first)
  let wheelAcc = 0;
  svg.addEventListener('wheel', (e) => {
    e.preventDefault();
    const s = evPos(e);
    const dy = e.deltaMode === 1 ? e.deltaY * 33 : e.deltaY;
    if (Math.sign(dy) !== Math.sign(wheelAcc)) wheelAcc = 0;
    wheelAcc += dy;
    if (Math.abs(wheelAcc) < 40) return;
    setScale(scaleIndex(view.zoom) + (wheelAcc > 0 ? 1 : -1), s);
    wheelAcc = 0;
    if (tool === 'pipe' && mouse) preview = run ? runPreview(mouse) : startCandidate(mouse);
    render();
    updateStatus();
  }, { passive: false });

  finishBtn.addEventListener('click', () => { endRun(); svg.focus({ preventScroll: true }); });

  // ---------- keyboard ----------
  window.addEventListener('keydown', (e) => {
    const k = e.key;
    const ctrl = e.ctrlKey || e.metaKey;
    if (ctrl) {
      const lk = k.toLowerCase();
      const map = { z: e.shiftKey ? redo : undo, y: redo, s: () => ISO.exporter.saveJSON(doc), p: () => ISO.exporter.print(doc) };
      if (map[lk]) { e.preventDefault(); map[lk](); }
      return;
    }
    if (e.target.matches('input, textarea, select')) {
      if (k === 'Escape' && !e.target.closest('dialog')) e.target.blur();
      return;
    }
    if (settingsDlg.open || shareDlg.open) return;
    if (k === '+' || k === '=' || k === '-') {
      e.preventDefault();
      setScale(scaleIndex(view.zoom) + (k === '-' ? 1 : -1), mouse);
      if (tool === 'pipe' && mouse) preview = run ? runPreview(mouse) : startCandidate(mouse);
      render(); updateStatus();
      return;
    }
    if (k === ' ') { spaceDown = true; e.preventDefault(); render(); return; }
    if (k === 'Tab' && tool === 'pipe' && doc.settings.angles === '45') {
      e.preventDefault();
      const i = ISO.PLANE_ORDER.indexOf(plane);
      setPlane(ISO.PLANE_ORDER[(i + (e.shiftKey ? ISO.PLANE_ORDER.length - 1 : 1)) % ISO.PLANE_ORDER.length]);
      return;
    }
    if (run && tool === 'pipe') {
      if (/^[0-9.]$/.test(k)) { typed += k; }
      else if (k === 'Backspace') { typed = typed.slice(0, -1); }
      else if (k === 'Enter') {
        if (!preview && mouse) preview = runPreview(mouse);
        commitSegment();
      } else if (k === 'Escape') { endRun(); return; }
      else return;
      e.preventDefault();
      if (run && mouse) preview = runPreview(mouse);
      else if (!run) preview = mouse ? startCandidate(mouse) : null;
      render(); updateStatus();
      return;
    }
    const lk = k.toLowerCase();
    // Flip the selected component: X = side, C = direction
    const fref = popup ? { type: popup.kind, id: popup.id } : sel;
    if (compOf(fref) && (lk === 'x' || lk === 'c')) { flipItem(fref, lk === 'x' ? 'side' : 'dir'); return; }
    if (k === 'Escape' && !flyout.hidden) { closeFlyout(); return; }
    if (k === 'Escape') {
      if (popup) closePopup();
      else if (tool !== 'select') setTool('select');
      else { sel = null; render(); renderSidebar(); closeSheet(); }
      return;
    }
    if (k === 'Delete' || k === 'Backspace') { e.preventDefault(); deleteSelected(); return; }
    if (k === 'Home') { fit(); return; }
    if (lk === 'p') { setTool('pipe', pipeStd); return; }
    const t = DRAW_TOOLS.find((x) => x[1] === lk);
    if (t) { setTool(t[0]); return; }
    const f = Object.entries(ISO.FITTINGS).find(([, d]) => d.key === lk);
    if (f) setTool(f[0]);
  });
  window.addEventListener('keyup', (e) => { if (e.key === ' ') { spaceDown = false; render(); } });
  window.addEventListener('blur', () => { spaceDown = false; });
  window.addEventListener('resize', () => {
    if (isMobile() !== paletteMobile) { closeFlyout(); buildPalette(); gridKey = ''; }
    render(); if (popup) placePopup();
  });

  // ---------- settings dialog ----------
  const settingsDlg = $('#settingsDlg');
  const shareDlg = $('#shareDlg');
  let installPrompt = null; // deferred "install app" prompt (Chrome / Edge / Android)
  const isStandalone = () => window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone === true;

  function updatePaperTag() { const el = $('#paperTag'); if (el) el.textContent = ISO.exporter.paperOf(); }

  function openSettings() {
    renderSettings();
    if (!settingsDlg.open) settingsDlg.showModal();
  }
  function renderSettings() {
    const pr = ISO.profile.get();
    const paper = ISO.exporter.paperOf();
    let h = `<div class="dlg-head"><h2>${esc(T('set.title'))}</h2><button data-close>✕</button></div><div class="dlg-body">`;
    h += `<h4>${esc(T('set.company'))}</h4>`;
    const hasLogo = !!pr.logoSvg;
    h += `<label class="field"><span>${esc(T('set.logo'))}</span></label><div class="logo-row"><div class="logo-box" id="logoBox">${hasLogo ? logoImg(pr.logoSvg) : esc(T('set.noLogo'))}</div>` +
      `<div class="logo-actions"><button id="logoUp">${esc(T('set.logoUpload'))}</button>${hasLogo || pr.logo ? `<button class="danger" id="logoDel">${esc(T('set.logoRemove'))}</button>` : ''}` +
      `<input type="file" id="logoFile" accept=".svg,image/svg+xml" hidden></div></div><div class="msg" id="logoMsg">${!hasLogo && pr.logo ? esc(T('set.logoOldPng')) : ''}</div>`;
    h += `<div class="note-box" style="margin:-2px 0 10px">${esc(T('set.logoHint'))}</div>`;
    h += field(T('set.site'), text('pf-site', pr.site, 'placeholder="www.example.com" inputmode="url" autocomplete="url"'));
    h += field(T('set.creator'), text('pf-creator', pr.creator, 'autocomplete="name"'));
    h += `<div class="note-box">${esc(T('set.creatorHint'))} ${esc(T('set.profileNote'))}</div>`;
    h += `<h4>${esc(T('set.tpl'))}</h4>`;
    const tpl = pr.titleTpl || {};
    const tf = ISO.TEMPLATE_FIELDS.filter((k) => k !== 'notes');
    for (let i = 0; i < tf.length; i += 2) {
      h += '<div class="row2">' + tf.slice(i, i + 2).map((k) => field(T('tf.' + k), text('tpl-' + k, tpl[k] || '', 'data-tpl="' + k + '"'))).join('') + '</div>';
    }
    h += field(T('sb.notes'), `<textarea id="tpl-notes" data-tpl="notes" rows="2">${esc(tpl.notes || '')}</textarea>`);
    h += `<div class="btn-row"><button id="tplFromDoc">${esc(T('set.tplFromDoc'))}</button><button id="tplApply">${esc(T('set.tplApply'))}</button>` +
      `<button class="danger" id="tplClear">${esc(T('set.tplClear'))}</button></div><div class="ok-msg" id="tplMsg"></div>`;
    h += `<div class="note-box">${esc(T('set.tplHint'))}</div>`;
    h += `<h4>${esc(T('set.export'))}</h4>`;
    h += `<label class="field"><span>${esc(T('set.paper'))}</span></label><div class="seg" id="paperSeg">` +
      ['A4', 'A3'].map((k) => `<button data-paper="${k}" class="${k === paper ? 'active' : ''}">DIN ${k}</button>`).join('') + '</div>';
    h += `<div style="margin-top:12px">${check('s-paper', T('sb.paperOnSheet'), !!doc.settings.paperOnSheet)}</div>`;
    h += `<h4>${esc(T('set.lengths'))}</h4>`;
    h += field(T('set.lenType'), select('len-type', lenType, inlineTypes()));
    h += `<div class="len-grid" id="lenGrid">${lenGridHtml()}</div>`;
    h += `<p><button id="lenReset">${esc(T('set.lenReset'))}</button></p>`;
    h += field(T('set.redStep'), select('pf-redstep', pr.reducerStep || 1, [[1, T('set.red1')], [2, T('set.red2')]]));
    h += `<div class="note-box">${esc(T('set.lenHint'))}</div>`;
    h += `<h4>${esc(T('set.display'))}</h4>`;
    const gc = ISO.paperColors().major;
    h += `<label class="field"><span>${esc(T('set.gridColor'))}</span></label><div class="color-row">` +
      GRID_SWATCHES.map((c) => `<button class="swatch${c === gc ? ' active' : ''}" data-gc="${c}" style="background:${c}" title="${c}"></button>`).join('') +
      `<input type="color" id="pf-gridcolor" value="${gc}"><button id="pf-gridreset">${esc(T('set.default'))}</button></div>`;
    h += `<div class="note-box" style="margin:-4px 0 10px">${esc(T('set.gridColorHint'))}</div>`;
    h += check('pf-compass', T('set.showCompass'), pr.showCompass !== false);
    h += `<h4>${esc(T('set.drawing'))}</h4>` + drawingSettingsHtml();
    h += `<h4>${esc(T('set.app'))}</h4>`;
    h += field(T('set.language'), select('pf-lang', ISO.getLang(), ISO.LANGS));
    h += `<div class="note-box">PipeIso · ${esc(T('set.version'))} ${esc(ISO.VERSION)}</div>`;
    if (isStandalone()) h += `<div class="note-box">${esc(T('set.installed'))}</div>`;
    else {
      h += `<label class="field"><span>${esc(T('set.installHow'))}</span></label>`;
      if (installPrompt) h += `<p><button class="primary" id="pf-install">${esc(T('btn.install'))}</button></p>`;
      h += `<div class="note-box">${esc(T('set.installText'))}</div>`;
    }
    h += `<h4>${esc(T('set.backup'))}</h4>`;
    h += `<div class="btn-row"><button id="setExport">${esc(T('set.exportSettings'))}</button><button id="setImport">${esc(T('set.importSettings'))}</button></div>`;
    h += `<div class="ok-msg" id="setMsg"></div><div class="note-box">${esc(T('set.backupHint'))}</div>`;
    h += `</div><div class="dlg-foot"><button class="primary" data-close>${esc(T('set.close'))}</button></div>`;
    settingsDlg.innerHTML = h;

    settingsDlg.querySelectorAll('[data-close]').forEach((b) => b.addEventListener('click', () => settingsDlg.close()));
    const file = $('#logoFile');
    $('#logoUp').addEventListener('click', () => file.click());
    file.addEventListener('change', () => { const f = file.files[0]; file.value = ''; if (f) loadLogo(f); });
    const del = $('#logoDel');
    if (del) del.addEventListener('click', () => { ISO.profile.set({ logoSvg: '', logo: '' }); renderSettings(); });
    $('#pf-site').addEventListener('change', (e) => ISO.profile.set({ site: e.target.value.trim() }));
    $('#pf-creator').addEventListener('change', (e) => {
      const v = e.target.value.trim();
      ISO.profile.set({ creator: v });
      if (v && !doc.title.drawnBy) { doc.title.drawnBy = v; autosave(); renderSidebar(); }
    });
    $('#paperSeg').addEventListener('click', (e) => {
      const b = e.target.closest('[data-paper]');
      if (!b) return;
      ISO.profile.set({ paper: b.dataset.paper });
      settingsDlg.querySelectorAll('[data-paper]').forEach((x) => x.classList.toggle('active', x === b));
      updatePaperTag();
    });
    $('#pf-lang').addEventListener('change', (e) => { langSel.value = e.target.value; langSel.dispatchEvent(new Event('change')); renderSettings(); });
    const inst = $('#pf-install');
    if (inst) inst.addEventListener('click', () => COMMANDS.install());
    $('#len-type').addEventListener('change', (e) => { lenType = e.target.value; $('#lenGrid').innerHTML = lenGridHtml(); bindLenGrid(); });
    $('#lenReset').addEventListener('click', () => {
      const lengths = JSON.parse(JSON.stringify(ISO.profile.get().lengths || {}));
      delete lengths[lenType];
      ISO.profile.set({ lengths });
      $('#lenGrid').innerHTML = lenGridHtml(); bindLenGrid();
    });
    $('#pf-redstep').addEventListener('change', (e) => ISO.profile.set({ reducerStep: parseInt(e.target.value, 10) }));
    bindLenGrid();
    bindDrawingSettings();

    // Title block template
    settingsDlg.querySelectorAll('[data-tpl]').forEach((el) => el.addEventListener('input', () => {
      const t = Object.assign({}, ISO.profile.get().titleTpl || {});
      t[el.dataset.tpl] = el.value;
      ISO.profile.set({ titleTpl: t });
    }));
    $('#tplFromDoc').addEventListener('click', () => {
      const t = {};
      ISO.TEMPLATE_FIELDS.forEach((k) => { t[k] = doc.title[k] || ''; });
      ISO.profile.set({ titleTpl: t });
      renderSettings();
    });
    $('#tplApply').addEventListener('click', () => {
      const t = ISO.profile.get().titleTpl || {};
      commit(() => { ISO.TEMPLATE_FIELDS.forEach((k) => { if (typeof t[k] === 'string' && t[k].trim()) doc.title[k] = t[k]; }); });
      $('#tplMsg').textContent = T('set.tplApplied');
    });
    $('#tplClear').addEventListener('click', () => { ISO.profile.set({ titleTpl: {} }); renderSettings(); });

    // Display: paper line colour and compass
    const setGridColor = (c) => {
      ISO.profile.set({ gridColor: c });
      gridKey = '';
      render();
      const cur = ISO.paperColors().major;
      settingsDlg.querySelectorAll('[data-gc]').forEach((b) => b.classList.toggle('active', b.dataset.gc === cur));
      $('#pf-gridcolor').value = cur;
    };
    settingsDlg.querySelectorAll('[data-gc]').forEach((b) => b.addEventListener('click', () => setGridColor(b.dataset.gc)));
    $('#pf-gridcolor').addEventListener('input', (e) => setGridColor(e.target.value));
    $('#pf-gridreset').addEventListener('click', () => setGridColor(''));
    $('#pf-compass').addEventListener('change', (e) => { ISO.profile.set({ showCompass: e.target.checked }); applyDisplay(); });

    // Settings backup
    $('#setExport').addEventListener('click', () => ISO.exporter.saveSettings(settingsBackup()));
    $('#setImport').addEventListener('click', () => settingsInput.click());
  }

  const GRID_SWATCHES = [ISO.PAPER.major, '#c3c9d1', '#a8d5b9', '#f2c9a0', '#e4b3c4'];

  // ---------- settings backup (export / import) ----------
  const DRAWING_KEYS = Object.keys(ISO.newDoc(false).settings);
  function settingsBackup() {
    const drawing = {};
    DRAWING_KEYS.forEach((k) => { drawing[k] = doc.settings[k]; });
    const profile = Object.assign({}, ISO.profile.get());
    delete profile.logo; // old PNG logo, no longer used
    return { app: 'PipeIso', kind: 'settings', version: 2, profile, lang: ISO.getLang(), drawing };
  }
  /** Only known, well-formed values are taken over from a settings file. */
  function cleanProfile(p) {
    const out = {};
    const str = (v, max = 500) => (typeof v === 'string' ? v.slice(0, max) : null);
    if (p.logoSvg === '') out.logoSvg = '';
    else if (typeof p.logoSvg === 'string' && p.logoSvg.length <= ISO.LOGO_MAX_BYTES) {
      try { out.logoSvg = ISO.cleanLogoSvg(p.logoSvg); out.logo = ''; } catch (e) { /* unusable logo: keep the current one */ }
    }
    ['site', 'creator'].forEach((k) => { const v = str(p[k]); if (v !== null) out[k] = v; });
    if (ISO.PAPERS[p.paper]) out.paper = p.paper;
    if (p.reducerStep === 1 || p.reducerStep === 2) out.reducerStep = p.reducerStep;
    if (Array.isArray(p.favs)) out.favs = p.favs.filter((x) => typeof x === 'string' && itemDef(x));
    if (p.gridColor === '' || ISO.isHexColor(p.gridColor)) out.gridColor = p.gridColor;
    if (typeof p.showCompass === 'boolean') out.showCompass = p.showCompass;
    if (Array.isArray(p.catOrder)) out.catOrder = p.catOrder.filter((x) => MOBILE_CATS.includes(x));
    if (p.titleTpl && typeof p.titleTpl === 'object') {
      out.titleTpl = {};
      ISO.TEMPLATE_FIELDS.forEach((k) => { const v = str(p.titleTpl[k], 2000); if (v !== null) out.titleTpl[k] = v; });
    }
    if (p.lengths && typeof p.lengths === 'object') {
      out.lengths = {};
      Object.keys(p.lengths).forEach((type) => {
        if (!isInline(type) || !p.lengths[type] || typeof p.lengths[type] !== 'object') return;
        const t = {};
        Object.keys(p.lengths[type]).forEach((dn) => { const v = p.lengths[type][dn]; if (/^\d+$/.test(dn) && typeof v === 'number' && v > 0) t[dn] = v; });
        out.lengths[type] = t;
      });
    }
    return out;
  }
  function cleanDrawing(d) {
    const out = {};
    const def = ISO.newDoc(false).settings;
    const enums = { gridStyle: ['lines', 'dots', 'none'], angles: ['90', '45'], autoFlange: ['off', 'ends', 'all'], defaultStd: Object.keys(ISO.STANDARDS) };
    DRAWING_KEYS.forEach((k) => {
      const v = d[k];
      if (typeof v !== typeof def[k]) return;
      if (enums[k] && !enums[k].includes(v)) return;
      if (k === 'defaultDnKF' || k === 'defaultDnK') { if (!ISO.STANDARDS[k.slice(9)].dns.includes(v)) return; }
      if (typeof v === 'number' && !(v > 0)) return;
      out[k] = v;
    });
    return out;
  }
  const settingsInput = $('#settingsInput');
  settingsInput.addEventListener('change', async () => {
    const f = settingsInput.files[0];
    settingsInput.value = '';
    if (!f) return;
    let data = null;
    try { data = JSON.parse(await f.text()); } catch (e) { data = null; }
    if (!data || data.app !== 'PipeIso' || data.kind !== 'settings' || !data.profile || typeof data.profile !== 'object') {
      alert(T('err.settingsFile'));
      return;
    }
    if (!ISO.profile.set(cleanProfile(data.profile))) { alert(T('err.logoSave')); return; }
    if (data.drawing && typeof data.drawing === 'object') {
      const ds = cleanDrawing(data.drawing);
      if (Object.keys(ds).length) commit(() => { Object.assign(doc.settings, ds); });
    }
    if (ISO.LANGS.some(([k]) => k === data.lang) && data.lang !== ISO.getLang()) { langSel.value = data.lang; langSel.dispatchEvent(new Event('change')); }
    gridKey = '';
    applyDisplay(); updatePaperTag(); buildPalette(); updatePlanebar(); render(); updateStatus();
    if (settingsDlg.open) { renderSettings(); $('#setMsg').textContent = T('set.imported'); }
  });

  let lenType = 'gate';
  function lenGridHtml() {
    const own = (ISO.profile.get().lengths || {})[lenType] || {};
    return ISO.allSizes().map(([k, d]) => `<label><span>DN${d} ${esc(ISO.STANDARDS[k].name)}</span>` +
      `<input type="number" inputmode="decimal" min="1" step="1" data-dn="${d}" value="${own[d] || ''}" placeholder="${ISO.typicalLength(lenType, d)}"></label>`).join('');
  }
  function bindLenGrid() {
    $('#lenGrid').querySelectorAll('input[data-dn]').forEach((inp) => inp.addEventListener('change', () => {
      const lengths = JSON.parse(JSON.stringify(ISO.profile.get().lengths || {}));
      const t = (lengths[lenType] = lengths[lenType] || {});
      const v = parseFloat(inp.value);
      if (v > 0) t[inp.dataset.dn] = v; else delete t[inp.dataset.dn];
      ISO.profile.set({ lengths });
    }));
  }

  /** Read an SVG file, clean it and keep it as the company logo. */
  async function loadLogo(file) {
    const msg = $('#logoMsg');
    if (file.type !== 'image/svg+xml' && !/\.svg$/i.test(file.name)) { msg.textContent = T('err.logoType'); return; }
    if (file.size > ISO.LOGO_MAX_BYTES) { msg.textContent = T('err.logoBig'); return; }
    let svgText;
    try { svgText = ISO.cleanLogoSvg(await file.text()); } catch (e) { msg.textContent = T(e.message.startsWith('err.') ? e.message : 'err.logoType'); return; }
    if (!ISO.profile.set({ logoSvg: svgText, logo: '' })) { msg.textContent = T('err.logoSave'); return; }
    renderSettings();
  }
  /** Logo as an <img> for previews (an image can't run anything inside the SVG). */
  const logoImg = (svgText) => `<img src="data:image/svg+xml;charset=utf-8,${encodeURIComponent(svgText)}" alt="">`;

  // ---------- share dialog ----------
  function openShare() {
    const paper = ISO.exporter.paperOf();
    const item = (kind, title, sub) => `<button data-share="${kind}"><span><b>${esc(title)}</b><br><small>${esc(sub)}</small></span><span>›</span></button>`;
    let h = `<div class="dlg-head"><h2>${esc(T('sh2.title'))}</h2><button data-close>✕</button></div><div class="dlg-body"><div class="share-list" style="margin-top:12px">`;
    h += item('pdf', T('sh2.pdf', { paper: 'DIN ' + paper }), T('sh2.pdfSub'));
    h += item('dxf', T('sh2.dxf', { paper: 'DIN ' + paper }), T('sh2.dxfSub'));
    h += item('json', T('sh2.json'), T('sh2.jsonSub'));
    h += '</div>';
    if (!ISO.exporter.canShareFiles()) h += `<div class="note-box">${esc(T('sh2.noShare'))}</div>`;
    h += '<div class="msg" id="shareMsg" style="color:var(--muted);margin-top:8px"></div></div>';
    shareDlg.innerHTML = h;
    shareDlg.querySelector('[data-close]').addEventListener('click', () => shareDlg.close());
    shareDlg.querySelectorAll('[data-share]').forEach((b) => b.addEventListener('click', async () => {
      const msg = $('#shareMsg');
      msg.textContent = T('sh2.working');
      shareDlg.querySelectorAll('[data-share]').forEach((x) => (x.disabled = true));
      try {
        const res = await ISO.exporter.share(doc, b.dataset.share);
        msg.textContent = res === 'shared' ? T('sh2.done') : res === 'downloaded' ? T('sh2.downloaded', { name: '' }).replace(/:\s*$/, '') : '';
        if (res === 'shared') setTimeout(() => shareDlg.open && shareDlg.close(), 700);
      } catch (err) {
        msg.textContent = err.message;
      }
      shareDlg.querySelectorAll('[data-share]').forEach((x) => (x.disabled = false));
    }));
    if (!shareDlg.open) shareDlg.showModal();
  }

  // close dialogs by clicking the backdrop
  [settingsDlg, shareDlg].forEach((d) => d.addEventListener('click', (e) => { if (e.target === d) d.close(); }));

  // ---------- installable web app ----------
  if ('serviceWorker' in navigator && /^https?:$/.test(location.protocol)) {
    window.addEventListener('load', () => { navigator.serviceWorker.register('sw.js', { updateViaCache: 'none' }).catch(() => { /* offline support unavailable */ }); });
  }
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    installPrompt = e;
    $('#installBtn').hidden = false;
  });
  window.addEventListener('appinstalled', () => { installPrompt = null; $('#installBtn').hidden = true; });

  // ---------- commands ----------
  const fileInput = $('#fileInput');
  fileInput.addEventListener('change', () => {
    const f = fileInput.files[0];
    fileInput.value = '';
    if (!f) return;
    ISO.exporter.openJSON(f).then((d) => {
      pushHistory();
      doc = d; sel = null; run = null; preview = null; popup = null; popupEl.hidden = true;
      updatePlanebar(); changed(); fit();
    }).catch((err) => alert(T('err.open', { m: err.message })));
  });

  const COMMANDS = {
    new: () => {
      if (doc.pipes.length && !confirm(T('confirm.new'))) return;
      pushHistory();
      doc = ISO.newDoc(); sel = null; run = null; preview = null; popup = null; popupEl.hidden = true;
      updatePlanebar(); changed(); fit();
    },
    open: () => fileInput.click(),
    save: () => ISO.exporter.saveJSON(doc),
    undo, redo, fit,
    exportDxf: () => { try { ISO.exporter.exportDXF(doc); } catch (err) { alert(err.message); } },
    exportPdf: () => ISO.exporter.exportPDF(doc).catch((err) => alert(err.message)),
    share: openShare,
    settings: openSettings,
    install: async () => {
      if (installPrompt) {
        installPrompt.prompt();
        try { await installPrompt.userChoice; } catch (e) { /* ignore */ }
        installPrompt = null;
        $('#installBtn').hidden = true;
      } else openSettings();
    },
    print: () => ISO.exporter.print(doc),
    props: () => { if (sidebarWrap.classList.contains('open')) closeSheet(); else openSheet(); },
  };
  document.querySelector('.topbar').addEventListener('click', (e) => {
    const b = e.target.closest('[data-cmd]');
    if (b && COMMANDS[b.dataset.cmd]) COMMANDS[b.dataset.cmd]();
  });

  // ---------- language ----------
  const langSel = $('#langSel');
  langSel.innerHTML = ISO.LANGS.map(([k, l]) => `<option value="${k}"${k === ISO.getLang() ? ' selected' : ''}>${l}</option>`).join('');
  langSel.addEventListener('change', () => {
    ISO.setLang(langSel.value);
    buildPalette(); buildCompass(); applyDisplay(); updatePlanebar(); renderSidebar(); renderPopup(); render(); updateStatus();
    if (settingsDlg.open) renderSettings();
  });

  // ---------- init ----------
  ISO.applyStatic();
  applyDisplay();
  updatePaperTag();
  buildPalette();
  buildCompass();
  setTool('select');
  fit();
  renderSidebar();
  updateButtons();
  updateStatus();
  mobileMQ.addEventListener('change', () => { gridKey = ''; closeFlyout(); buildPalette(); render(); if (popup) placePopup(); });

  // Exposed for debugging / automated tests
  window.PipeIso = { get doc() { return doc; }, view, setTool, setPlane, fit, undo, redo };
})();
