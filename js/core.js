/* PipeIso – core geometry and document model.
 *
 * Model coordinates are in millimetres:
 *   x = East, y = North, z = Up (elevation).
 * Isometric projection (screen y grows downward):
 *   East  -> down-right (30°), North -> up-right (30°), Up -> straight up.
 */
(function () {
  'use strict';
  const ISO = (window.ISO = window.ISO || {});
  ISO.VERSION = '2026-10-29.1'; // shown in Settings; raise it with every release
  const C = Math.cos(Math.PI / 6);
  ISO.C = C;

  /** Project a 3D model point [x,y,z] to 2D isometric "world" coords (mm). */
  ISO.iso = (p) => [(p[0] + p[1]) * C, (p[0] - p[1]) / 2 - p[2]];

  ISO.DIRS = [
    { key: 'E', name: 'East', v: [1, 0, 0] },
    { key: 'W', name: 'West', v: [-1, 0, 0] },
    { key: 'N', name: 'North', v: [0, 1, 0] },
    { key: 'S', name: 'South', v: [0, -1, 0] },
    { key: 'U', name: 'Up', v: [0, 0, 1] },
    { key: 'D', name: 'Down', v: [0, 0, -1] },
  ];
  ISO.DIRS.forEach((d) => (d.s = ISO.iso(d.v))); // unit screen vectors

  const v3 = (ISO.v3 = {
    add: (a, b) => [a[0] + b[0], a[1] + b[1], a[2] + b[2]],
    sub: (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]],
    scale: (a, k) => [a[0] * k, a[1] * k, a[2] * k],
    len: (a) => Math.hypot(a[0], a[1], a[2]),
    eq: (a, b, tol = 0.5) =>
      Math.abs(a[0] - b[0]) <= tol && Math.abs(a[1] - b[1]) <= tol && Math.abs(a[2] - b[2]) <= tol,
  });

  /** Axis direction from a to b if the vector is orthogonal (along one axis), else null. */
  ISO.axisOf = (a, b) => {
    const d = v3.sub(b, a);
    const nz = d.map((c) => Math.abs(c) > 0.01);
    if (nz.filter(Boolean).length !== 1) return null;
    const v = d.map((c, i) => (nz[i] ? Math.sign(c) : 0));
    return ISO.DIRS.find((D) => D.v[0] === v[0] && D.v[1] === v[1] && D.v[2] === v[2]) || null;
  };

  /** 3D axis used to draw symbol "width" for a pipe along v. */
  ISO.symPerp = (v) => (v[2] === 0 ? [0, 0, 1] : [1, 0, 0]);
  /** 3D axis along which a pipe's dimension line is offset. */
  ISO.dimPerp = (v) => (v[0] !== 0 ? [0, -1, 0] : v[1] !== 0 ? [1, 0, 0] : [0, -1, 0]);

  // Components. Names come from translations: fit.<id> (long) / fits.<id> (palette).
  // side:   has an outward/inward side (stem, flat side, clamp, tie rod…)
  // dir:    has an outward/inward direction along the pipe
  // inline: has its own face-to-face length; it is added into the line (the pipe gets longer)
  //         instead of being drawn on top of the pipe
  ISO.FITTINGS = {
    gate: { key: 'g', side: true, inline: true },
    globe: { side: true, inline: true },
    needle: { side: true, inline: true },
    relief: { side: true, dir: true, inline: true },
    ball: { side: true, dir: true, inline: true },
    check: { side: true, dir: true, inline: true },
    butterfly: { side: true, dir: true, inline: true },
    flange: { key: 'f', side: true },
    flange1: { dir: true },
    blind: { dir: true },
    reducer: { key: 'r', dir: true, inline: true },
    reducerEcc: { side: true, dir: true, inline: true },
    bellows: { key: 'b', side: true, dir: true, inline: true },
    hose: { side: true, dir: true, inline: true },
    silencer: { dir: true, inline: true },
    weld: {},
    fieldweld: {},
    flow: { key: 'a', dir: true },
    // pipe supports: placed on a pipe (they don't make it longer); side = where the lugs / the welded base plate point;
    // support = they take up a width on the pipe and their position is dimensioned (chain dimension) and set in mm
    clamp: { side: true, support: true },
    weldclamp: { side: true, support: true },
  };
  /** Typical width of a support on the pipe (mm); your own values are set in Settings. */
  ISO.SUPPORT_WIDTH = { clamp: 50, weldclamp: 20 };
  /** Width of a support on the pipe (mm): its own value, else the standard from Settings, else the typical one. */
  ISO.supportWidth = (f) => {
    if (f.len > 0) return f.len;
    const own = ISO.profile && (ISO.profile.get().supLen || {})[f.type];
    return own > 0 ? own : ISO.SUPPORT_WIDTH[f.type] || 0;
  };

  // ---------- flanges at pipe ends ----------
  // pipe.fl: 'none' | 'start' | 'end' | 'both' chosen per pipe (start = pipe.a, end = pipe.b).
  // Without it the automatic rule in Settings applies (doc.settings.autoFlange: off / ends of runs / all ends).
  ISO.FLANGE_OPTS = ['none', 'start', 'end', 'both'];
  /** Number of pipes (and components) at each point. */
  ISO.nodeDegrees = (doc) => {
    const d = {};
    doc.pipes.forEach((p) => { d[p.a] = (d[p.a] || 0) + 1; d[p.b] = (d[p.b] || 0) + 1; });
    return d;
  };
  /** Which ends of a pipe get a flange: [at start, at end]. */
  ISO.pipeFlanges = (doc, pipe, deg) => {
    if (pipe.comp) return [false, false]; // components bring their own flanges
    if (ISO.FLANGE_OPTS.includes(pipe.fl)) return [pipe.fl === 'start' || pipe.fl === 'both', pipe.fl === 'end' || pipe.fl === 'both'];
    const af = doc.settings.autoFlange, d = deg || ISO.nodeDegrees(doc);
    return [pipe.a, pipe.b].map((n) => af === 'all' || (af === 'ends' && d[n] === 1));
  };
  const flOf = (s, e) => (s && e ? 'both' : s ? 'start' : e ? 'end' : 'none');
  /** Explicit flange choice at one end of a pipe (true / false), or null when the pipe follows the automatic rule. */
  const flAt = (pipe, nodeId) => (ISO.FLANGE_OPTS.includes(pipe.fl) ? (nodeId === pipe.a ? /start|both/.test(pipe.fl) : /end|both/.test(pipe.fl)) : null);
  // Palette categories. A category either lists items or has sub-groups (opened in a slide-out menu).
  ISO.CATEGORIES = [
    {
      id: 'valves',
      groups: [
        { id: 'shutoff', items: ['gate', 'ball', 'butterfly'] },
        { id: 'control', items: ['globe', 'needle'] },
        { id: 'nonreturn', items: ['check'] },
        { id: 'safety', items: ['relief'] },
      ],
    },
    { id: 'flanges', items: ['flange', 'flange1', 'blind'] },
    { id: 'reducers', items: ['reducer', 'reducerEcc'] },
    { id: 'flex', items: ['bellows', 'hose'] },
    { id: 'other', items: ['silencer'] },
    { id: 'supports', items: ['clamp', 'weldclamp'] },
    { id: 'marks', items: ['weld', 'fieldweld', 'flow'] },
  ];
  ISO.fitName = (type) => ISO.t('fit.' + type);

  // Direction sets for drawing. "axes" = the six 90° directions in 3D.
  // 45° pipes are drawn in one plane at a time, because in an isometric view
  // a 45° line in one plane looks identical to a 90° line in another.
  const mkDir = (keys) => {
    const v = keys.split('').reduce((acc, k) => v3.add(acc, ISO.DIRS.find((d) => d.key === k).v), [0, 0, 0]);
    const u = v3.scale(v, 1 / v3.len(v));
    return { key: keys, keys: keys.split(''), v: u, s: ISO.iso(u).map((c) => c / Math.hypot(...ISO.iso(u))) };
  };
  ISO.PLANES = {
    axes: ['E', 'W', 'N', 'S', 'U', 'D'],
    h: ['E', 'W', 'N', 'S', 'EN', 'ES', 'WN', 'WS'],
    xz: ['E', 'W', 'U', 'D', 'EU', 'ED', 'WU', 'WD'],
    yz: ['N', 'S', 'U', 'D', 'NU', 'ND', 'SU', 'SD'],
  };
  ISO.PLANE_ORDER = ['axes', 'h', 'xz', 'yz'];
  Object.keys(ISO.PLANES).forEach((k) => { ISO.PLANES[k] = ISO.PLANES[k].map(mkDir); });
  /** Display name of a direction, e.g. "East" or "North / East 45°". */
  ISO.dirName = (d) => d.keys.length === 1 ? ISO.t('dir.' + d.key) : d.keys.map((k) => ISO.t('dir.' + k)).join(' / ') + ' 45°';
  /** Direction (from any plane) matching the vector a->b, or null. */
  ISO.dirOf = (a, b) => {
    const d = v3.sub(b, a); const L = v3.len(d);
    if (L < 0.01) return null;
    for (const set of Object.values(ISO.PLANES)) {
      for (const D of set) {
        if ((d[0] * D.v[0] + d[1] * D.v[1] + d[2] * D.v[2]) / L > 0.99999) return D;
      }
    }
    return null;
  };

  // Vacuum flange standards and their nominal sizes (DN)
  ISO.STANDARDS = {
    KF: { name: 'ISO-KF', dns: [10, 16, 25, 40, 50], def: 40, lw: 1 },
    K: { name: 'ISO-K', dns: [63, 80, 100, 160, 200, 250, 320, 400, 500, 630], def: 100, lw: 1.4 },
  };
  ISO.sizeLabel = (p) => (p && p.std ? `DN${p.dn} ${ISO.STANDARDS[p.std].name}` : '');
  ISO.isReducer = (type) => type === 'reducer' || type === 'reducerEcc';
  /** Short size text for a component segment, e.g. "DN40" or "DN40 × DN25".
   *  A reducer segment's std/dn is its large size; comp.std2/dn2 is the small size,
   *  and comp.flip = true puts the small end toward the segment's start (a). */
  ISO.compSizeText = (p) => {
    if (!p.comp) return '';
    if (ISO.isReducer(p.comp.type)) return `DN${p.dn} × DN${p.comp.dn2}`;
    return `DN${p.dn}`;
  };
  /** All sizes of all standards, as [std, dn] pairs (used for reducer outlets). */
  ISO.allSizes = () => Object.entries(ISO.STANDARDS).flatMap(([k, s]) => s.dns.map((d) => [k, d]));
  /** Smaller size (any standard) for the small end of a new reducer: one or two sizes down (Settings). */
  ISO.nextSmaller = (std, dn) => {
    const all = ISO.allSizes();
    const steps = (ISO.profile && ISO.profile.get().reducerStep) || 1;
    const i = all.findIndex(([k, d]) => k === std && d === dn);
    const j = Math.max(0, i - steps);
    return i > 0 ? { std: all[j][0], dn: all[j][1] } : { std, dn };
  };
  /** Built-in typical face-to-face length (mm), rounded to 10 mm. */
  ISO.typicalLength = (type, dn) => {
    const r10 = (v) => Math.round(v / 10) * 10;
    if (type === 'hose') return 500;
    if (type === 'silencer') return r10(Math.max(150, dn * 3 + 60));
    if (type === 'bellows') return r10(Math.max(100, dn * 2.5 + 50));
    if (ISO.isReducer(type)) return r10(Math.max(50, dn * 1.2 + 30));
    return r10(Math.max(60, dn * 1.6 + 40)); // valves
  };
  /** Face-to-face length for a new component: your standard length from Settings, else the typical one. */
  ISO.compDefaultLength = (type, dn) => {
    const own = ISO.profile && ISO.profile.get().lengths;
    const v = own && own[type] && own[type][dn];
    return v > 0 ? v : ISO.typicalLength(type, dn);
  };

  // Settings of the app, kept in this browser (not in the drawing file): company details, export options,
  // title block template, standard lengths, display, and the drawing options (drawSettings)
  const PROFILE_KEY = 'pipeiso.profile.v1';
  ISO.profile = (() => {
    // logoSvg = company logo (cleaned SVG text); logo = old PNG logo, no longer used
    let data = { logoSvg: '', logo: '', site: '', creator: '', paper: 'A3', lengths: {}, reducerStep: 1, favs: [], gridColor: '', showCompass: true, exportGrid: true, exportLegend: true, titleTpl: {}, supLen: {} };
    try { Object.assign(data, JSON.parse(localStorage.getItem(PROFILE_KEY) || '{}')); } catch (e) { /* ignore */ }
    return {
      get: () => data,
      /** Save changes; returns false if the browser refused (e.g. storage full). */
      set(patch) {
        const next = Object.assign({}, data, patch);
        try { localStorage.setItem(PROFILE_KEY, JSON.stringify(next)); } catch (e) { return false; }
        data = next;
        return true;
      },
    };
  })();

  ISO.TITLE_FIELDS = ['project', 'client', 'lineNo', 'drawingNo', 'spec', 'material', 'insulation', 'testPressure',
    'rev', 'sheet', 'drawnBy', 'checkedBy', 'date'];

  // Title block fields that the template in Settings can fill in for new drawings
  // (not the project name, which is set per drawing, and not the date, which is always today)
  ISO.TEMPLATE_FIELDS = ISO.TITLE_FIELDS.filter((k) => k !== 'project' && k !== 'date').concat('notes');

  // Drawing options (grid, snap, default sizes, dimensions, angles, flanges, …) are settings of the app:
  // they are kept in this browser and apply to every drawing – new ones and opened ones.
  // A drawing file still carries a copy, so it can be read elsewhere.
  ISO.DRAW_DEFAULTS = {
    gridStep: 500, snap: 100, defaultStd: 'KF', defaultDnKF: 40, defaultDnK: 100, showDims: true, showAngles: true, showCompSizes: true,
    gridSnap: true, showWelds: false, gridStyle: 'lines', paperOnSheet: false, angles: '90', autoFlange: 'ends', newFlKF: 'auto', newFlK: 'auto',
  };
  /** The app's drawing options: the defaults with your own choices. */
  ISO.appDrawSettings = () => Object.assign({}, ISO.DRAW_DEFAULTS, (ISO.profile && ISO.profile.get().drawSettings) || {});

  /** New empty drawing. useTemplate = start the title block from the template in Settings. */
  ISO.newDoc = (useTemplate = true) => {
    const prof = ISO.profile ? ISO.profile.get() : {};
    const title = {
      project: '', client: '', lineNo: '', drawingNo: 'ISO-001', spec: '', material: '',
      insulation: '', testPressure: '', rev: '0', sheet: '1 of 1', drawnBy: prof.creator || '', checkedBy: '',
      date: new Date().toISOString().slice(0, 10), notes: '',
    };
    if (useTemplate) {
      const tpl = prof.titleTpl || {};
      ISO.TEMPLATE_FIELDS.forEach((k) => { if (typeof tpl[k] === 'string' && tpl[k].trim()) title[k] = tpl[k]; });
    }
    return {
      app: 'PipeIso',
      version: 1,
      settings: ISO.appDrawSettings(),
      title,
      nodes: {},
      pipes: [],
      fittings: [],
      labels: [],
      nextId: 1,
    };
  };

  /** Fill in missing fields so older / hand-edited files still load. */
  ISO.migrate = (raw) => {
    if (!raw || typeof raw !== 'object' || !raw.nodes || !Array.isArray(raw.pipes)) {
      throw new Error(ISO.t('err.notPipeIso'));
    }
    const d = ISO.newDoc(false); // the app's drawing options apply, not the ones saved in the file
    d.title = Object.assign(d.title, raw.title || {});
    d.nodes = raw.nodes;
    d.pipes = raw.pipes;
    d.fittings = raw.fittings || [];
    d.labels = raw.labels || [];
    let max = 0;
    const bump = (id) => { const n = parseInt(String(id).replace(/\D/g, ''), 10); if (n > max) max = n; };
    Object.keys(d.nodes).forEach(bump);
    d.pipes.forEach((p) => bump(p.id));
    d.fittings.forEach((f) => bump(f.id));
    d.labels.forEach((l) => bump(l.id));
    d.nextId = Math.max(raw.nextId || 1, max + 1);
    // Older drawings used inch sizes: move them to the vacuum standards
    d.pipes.forEach((p) => {
      if (!ISO.STANDARDS[p.std]) p.std = 'KF';
      if (!ISO.STANDARDS[p.std].dns.includes(p.dn)) p.dn = ISO.STANDARDS[p.std].def;
      delete p.size;
    });
    d.fittings.forEach((f) => { if (!ISO.FITTINGS[f.type]) f.type = 'flange'; if (f.side !== -1) f.side = 1; });
    delete d.settings.defaultSize;
    if (d.settings.showCompSizes === undefined) d.settings.showCompSizes = true;
    // Older drawings had valves, reducers and bellows drawn on top of a pipe:
    // turn them into real components in the line (without changing the drawing's size)
    d.fittings.filter((f) => ISO.FITTINGS[f.type].inline).forEach((f) => {
      const pipe = ISO.byId(d.pipes, f.pipeId);
      d.fittings = d.fittings.filter((x) => x !== f);
      if (!pipe || pipe.comp) return;
      const Lp = ISO.pipeLen(d, pipe);
      const L = Math.min(ISO.compDefaultLength(f.type, pipe.dn), Lp * 0.4);
      const start = clampN(f.t * Lp - L / 2, 0, Lp - L);
      ISO.replaceWithComponent(d, pipe, start, L, { type: f.type, side: f.side, flip: !!f.flip });
    });
    return d;
  };

  // ---------- model operations ----------
  ISO.uid = (doc, pre) => pre + doc.nextId++;
  ISO.nodePt = (doc, id) => { const n = doc.nodes[id]; return [n.x, n.y, n.z]; };
  ISO.pipeEnds = (doc, p) => [ISO.nodePt(doc, p.a), ISO.nodePt(doc, p.b)];
  ISO.pipeLen = (doc, p) => { const [a, b] = ISO.pipeEnds(doc, p); return v3.len(v3.sub(b, a)); };
  ISO.pipeAt = (doc, p, t) => { const [a, b] = ISO.pipeEnds(doc, p); return v3.add(a, v3.scale(v3.sub(b, a), t)); };
  ISO.byId = (arr, id) => arr.find((o) => o.id === id);
  ISO.pipesAt = (doc, nodeId) => doc.pipes.filter((p) => p.a === nodeId || p.b === nodeId);

  ISO.findNode = (doc, pt, tol = 0.5) =>
    Object.keys(doc.nodes).find((id) => v3.eq(ISO.nodePt(doc, id), pt, tol)) || null;

  /** Pipe whose interior contains pt (not its end points). */
  ISO.pointOnPipe = (doc, pt, tol = 0.5) => {
    for (const p of doc.pipes) {
      if (p.comp) continue; // components are never split
      const [a, b] = ISO.pipeEnds(doc, p);
      const ab = v3.sub(b, a);
      const L = v3.len(ab);
      if (L < 1) continue;
      const t = ((pt[0] - a[0]) * ab[0] + (pt[1] - a[1]) * ab[1] + (pt[2] - a[2]) * ab[2]) / (L * L);
      if (t * L <= tol || (1 - t) * L <= tol) continue;
      const q = v3.add(a, v3.scale(ab, t));
      if (v3.eq(q, pt, tol)) return { pipe: p, t };
    }
    return null;
  };

  ISO.addNode = (doc, pt) => {
    const found = ISO.findNode(doc, pt);
    if (found) return found;
    const id = ISO.uid(doc, 'n');
    doc.nodes[id] = { x: pt[0], y: pt[1], z: pt[2] };
    return id;
  };

  /** Split a pipe at pt (creating a tee point). Fittings and labels keep their positions. */
  ISO.splitPipe = (doc, pipe, pt) => {
    const [a, b] = ISO.pipeEnds(doc, pipe);
    const L = v3.len(v3.sub(b, a));
    const tp = v3.len(v3.sub(pt, a)) / L;
    const nid = ISO.addNode(doc, pt);
    const np = { id: ISO.uid(doc, 'p'), a: nid, b: pipe.b, std: pipe.std, dn: pipe.dn, hideDim: pipe.hideDim, dimFlip: pipe.dimFlip };
    if (ISO.FLANGE_OPTS.includes(pipe.fl)) { // the flanges stay at the old ends, none at the new point
      np.fl = flOf(false, flAt(pipe, pipe.b));
      pipe.fl = flOf(flAt(pipe, pipe.a), false);
    }
    pipe.b = nid;
    doc.pipes.push(np);
    const remap = (o) => {
      if (o.pipeId !== pipe.id) return;
      if (o.t <= tp) o.t = o.t / tp;
      else { o.pipeId = np.id; o.t = (o.t - tp) / (1 - tp); }
    };
    doc.fittings.forEach(remap);
    doc.labels.forEach(remap);
    return nid;
  };

  /** Node at pt: existing node, a new tee on an existing pipe, or a new free node. */
  ISO.resolvePoint = (doc, pt) => {
    const n = ISO.findNode(doc, pt);
    if (n) return n;
    const hit = ISO.pointOnPipe(doc, pt);
    if (hit) return ISO.splitPipe(doc, hit.pipe, pt);
    return ISO.addNode(doc, pt);
  };

  ISO.defaultSpec = (doc, std) => {
    const st = ISO.STANDARDS[std] ? std : doc.settings.defaultStd || 'KF';
    const dn = doc.settings['defaultDn' + st];
    return { std: st, dn: ISO.STANDARDS[st].dns.includes(dn) ? dn : ISO.STANDARDS[st].def };
  };
  ISO.addPipe = (doc, a, b, spec) => {
    if (a === b) return null;
    if (doc.pipes.some((p) => (p.a === a && p.b === b) || (p.a === b && p.b === a))) return null;
    const sp = spec && spec.std ? spec : ISO.defaultSpec(doc);
    const p = { id: ISO.uid(doc, 'p'), a, b, std: sp.std, dn: sp.dn };
    // Flanges for new pipes of this standard (Settings / bar above the drawing) – but never where pipes join:
    // a new pipe gets no flange at a point that already has a pipe (elbow / tee), and a pipe already there
    // loses its flange at that point (it was an open end before)
    const deg = ISO.nodeDegrees(doc);
    const fl = doc.settings['newFl' + sp.std];
    if (ISO.FLANGE_OPTS.includes(fl)) p.fl = flOf(/start|both/.test(fl) && !deg[a], /end|both/.test(fl) && !deg[b]);
    [a, b].forEach((n) => {
      if (!deg[n]) return;
      ISO.pipesAt(doc, n).forEach((q) => {
        if (q.comp || !flAt(q, n)) return;
        q.fl = n === q.a ? flOf(false, flAt(q, q.b)) : flOf(flAt(q, q.a), false);
      });
    });
    doc.pipes.push(p);
    return p;
  };

  ISO.cleanup = (doc) => {
    const used = new Set();
    doc.pipes.forEach((p) => { used.add(p.a); used.add(p.b); });
    Object.keys(doc.nodes).forEach((id) => { if (!used.has(id)) delete doc.nodes[id]; });
    const pids = new Set(doc.pipes.map((p) => p.id));
    doc.fittings = doc.fittings.filter((f) => pids.has(f.pipeId));
    doc.labels = doc.labels.filter((l) => pids.has(l.pipeId));
  };

  ISO.removePipe = (doc, id) => {
    const p = ISO.byId(doc.pipes, id);
    if (p && p.comp) { ISO.removeComponent(doc, p); return; }
    doc.pipes = doc.pipes.filter((x) => x.id !== id);
    ISO.cleanup(doc);
  };
  ISO.removeNode = (doc, id) => { doc.pipes = doc.pipes.filter((p) => p.a !== id && p.b !== id); ISO.cleanup(doc); };
  ISO.removeFitting = (doc, id) => { doc.fittings = doc.fittings.filter((f) => f.id !== id); };
  ISO.removeLabel = (doc, id) => { doc.labels = doc.labels.filter((l) => l.id !== id); };

  // ---------- components in the line ----------
  function clampN(v, a, b) { return Math.max(a, Math.min(b, v)); }

  /** Nodes reachable from `from` without using pipe `skip`; null if that reaches `stop` (closed loop). */
  function sideOf(doc, from, skip, stop) {
    const seen = new Set([from]);
    const stack = [from];
    while (stack.length) {
      const n = stack.pop();
      for (const p of doc.pipes) {
        if (p === skip || (p.a !== n && p.b !== n)) continue;
        const o = p.a === n ? p.b : p.a;
        if (o === stop) return null;
        if (!seen.has(o)) { seen.add(o); stack.push(o); }
      }
    }
    return seen;
  }

  /**
   * Turn the part [start, start+L] (mm from pipe.a) of a pipe into a component segment.
   * Returns the new component segment. Point fittings and labels keep their positions.
   */
  ISO.replaceWithComponent = (doc, pipe, start, L, comp, spec) => {
    const [a] = ISO.pipeEnds(doc, pipe);
    const Lp = ISO.pipeLen(doc, pipe);
    const dir = v3.scale(v3.sub(ISO.nodePt(doc, pipe.b), a), 1 / Lp);
    const att = doc.fittings.concat(doc.labels).filter((x) => x.pipeId === pipe.id).map((x) => ({ x, d: x.t * Lp }));
    const sp = spec || { std: pipe.std, dn: pipe.dn };
    const endB = pipe.b;
    const n1 = start > 0.5 ? ISO.addNode(doc, v3.add(a, v3.scale(dir, start))) : pipe.a;
    const n2 = start + L < Lp - 0.5 ? ISO.addNode(doc, v3.add(a, v3.scale(dir, start + L))) : endB;
    const c = Object.assign({ id: ISO.uid(doc, 'p'), a: n1, b: n2 }, { std: sp.std, dn: sp.dn, comp });
    if (ISO.isReducer(comp.type) && !comp.dn2) { const o = ISO.nextSmaller(sp.std, sp.dn); comp.std2 = o.std; comp.dn2 = o.dn; }
    const flS = flAt(pipe, pipe.a), flE = flAt(pipe, endB); // flange choice at the old ends (null = automatic)
    let head = null, tail = null;
    if (n1 !== pipe.a) { head = pipe; pipe.b = n1; }
    if (n2 !== endB) {
      if (head) { tail = { id: ISO.uid(doc, 'p'), a: n2, b: endB, std: pipe.std, dn: pipe.dn }; doc.pipes.push(tail); }
      else { tail = pipe; pipe.a = n2; }
    }
    if (!head && !tail) doc.pipes = doc.pipes.filter((p) => p !== pipe);
    if (flS !== null) { // keep flanges at the old pipe ends, none next to the new component
      if (head) head.fl = flOf(flS, false);
      if (tail) tail.fl = flOf(false, flE);
    }
    doc.pipes.push(c);
    att.forEach(({ x, d }) => {
      if (d < start && head) { x.pipeId = head.id; x.t = clampN(d / start, 0.02, 0.98); }
      else if (tail) { const lt = Lp - start - L; x.pipeId = tail.id; x.t = clampN((d - start - L) / Math.max(lt, 1), 0.02, 0.98); }
      else if (head) { x.pipeId = head.id; x.t = 0.9; }
    });
    return { comp: c, head, tail };
  };

  /**
   * Add a component into an existing pipe at distance dq (mm from pipe.a).
   * The pipe gets longer by the component's length: everything beyond moves along.
   * opts: { length, side, flip }. Returns { comp } or { err }.
   */
  ISO.insertComponent = (doc, pipe, dq, type, opts = {}) => {
    if (pipe.comp) return { err: ISO.t('err.insertComp') };
    const [a, b] = ISO.pipeEnds(doc, pipe);
    const Lp = v3.len(v3.sub(b, a));
    const dir = v3.scale(v3.sub(b, a), 1 / Lp);
    const L = opts.length > 0 ? opts.length : ISO.compDefaultLength(type, pipe.dn);
    const moving = sideOf(doc, pipe.b, pipe, pipe.a);
    if (!moving) return { err: ISO.t('err.insertLoop') };
    // Remember where point fittings and labels sit before the pipe grows
    const att = doc.fittings.concat(doc.labels).filter((x) => x.pipeId === pipe.id).map((x) => ({ x, d: x.t * Lp }));
    const delta = v3.scale(dir, L);
    moving.forEach((id) => { const n = doc.nodes[id]; n.x += delta[0]; n.y += delta[1]; n.z += delta[2]; });
    att.forEach(({ x, d }) => { x.t = (d < dq ? d : d + L) / (Lp + L); });
    const comp = { type, side: opts.side === -1 ? -1 : 1, flip: !!opts.flip };
    const res = ISO.replaceWithComponent(doc, pipe, clampN(dq, 0, Lp), L, comp);
    // A reducer changes the size of the pipe piece on its small side
    if (ISO.isReducer(type)) {
      const small = comp.flip ? res.head : res.tail;
      if (small) { small.std = comp.std2; small.dn = comp.dn2; }
    }
    return { comp: res.comp };
  };

  /** Remove a component segment and close the gap (the line gets shorter again). */
  ISO.removeComponent = (doc, c) => {
    const [a, b] = ISO.pipeEnds(doc, c);
    const moving = sideOf(doc, c.b, c, c.a);
    doc.pipes = doc.pipes.filter((p) => p !== c);
    if (!moving) { ISO.cleanup(doc); return; } // closed loop: just leave the gap
    const delta = v3.sub(a, b);
    moving.forEach((id) => { const n = doc.nodes[id]; n.x += delta[0]; n.y += delta[1]; n.z += delta[2]; });
    // merge node b into a
    doc.pipes.forEach((p) => { if (p.a === c.b) p.a = c.a; if (p.b === c.b) p.b = c.a; });
    delete doc.nodes[c.b];
    // join two straight pipes of the same size back into one
    const ps = ISO.pipesAt(doc, c.a).filter((p) => !p.comp);
    if (ps.length === 2 && ISO.pipesAt(doc, c.a).length === 2 && ps[0].std === ps[1].std && ps[0].dn === ps[1].dn) {
      const [p, q] = ps;
      const pe = p.a === c.a ? p.b : p.a, qe = q.a === c.a ? q.b : q.a;
      const dp = ISO.dirOf(ISO.nodePt(doc, pe), ISO.nodePt(doc, c.a)), dq2 = ISO.dirOf(ISO.nodePt(doc, c.a), ISO.nodePt(doc, qe));
      if (dp && dq2 && dp.key === dq2.key) {
        const Lp = ISO.pipeLen(doc, p), Lq = ISO.pipeLen(doc, q);
        const toNew = (x, onP) => {
          const d = onP ? (p.a === c.a ? (1 - x.t) * Lp : x.t * Lp) : Lp + (q.a === c.a ? x.t * Lq : (1 - x.t) * Lq);
          x.pipeId = p.id; x.t = d / (Lp + Lq);
        };
        doc.fittings.concat(doc.labels).forEach((x) => { if (x.pipeId === p.id) toNew(x, true); else if (x.pipeId === q.id) toNew(x, false); });
        const fs = flAt(p, pe), fe = flAt(q, qe);
        if (fs !== null || fe !== null) p.fl = flOf(!!fs, !!fe);
        p.a = pe; p.b = qe;
        doc.pipes = doc.pipes.filter((x) => x !== q);
        delete doc.nodes[c.a];
      }
    }
    ISO.cleanup(doc);
  };

  /** Move a pipe's end so that b = a + vec, moving everything connected beyond b with it.
   *  Returns an error message or null. */
  ISO.setPipeVector = (doc, pipe, vec) => {
    if (!(v3.len(vec) > 0.5)) return ISO.t('err.len');
    const [a, b] = ISO.pipeEnds(doc, pipe);
    const seen = new Set([pipe.b]);
    const stack = [pipe.b];
    while (stack.length) {
      const n = stack.pop();
      for (const p of doc.pipes) {
        if (p === pipe || (p.a !== n && p.b !== n)) continue;
        const o = p.a === n ? p.b : p.a;
        if (o === pipe.a) return ISO.t('err.loop');
        if (!seen.has(o)) { seen.add(o); stack.push(o); }
      }
    }
    const delta = v3.sub(v3.add(a, vec), b);
    seen.forEach((id) => {
      const n = doc.nodes[id];
      n.x += delta[0]; n.y += delta[1]; n.z += delta[2];
    });
    return null;
  };

  /** Change a pipe's length (keeps its direction). */
  ISO.setPipeLength = (doc, pipe, L) => {
    if (!(L > 0)) return ISO.t('err.len');
    const [a, b] = ISO.pipeEnds(doc, pipe);
    const d = v3.sub(b, a);
    return ISO.setPipeVector(doc, pipe, v3.scale(d, L / v3.len(d)));
  };

  /** Bounding box of the drawing in iso world coords, or null when empty. */
  ISO.isoBounds = (doc) => {
    const ids = Object.keys(doc.nodes);
    if (!ids.length) return null;
    let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
    ids.forEach((id) => {
      const w = ISO.iso(ISO.nodePt(doc, id));
      x0 = Math.min(x0, w[0]); y0 = Math.min(y0, w[1]);
      x1 = Math.max(x1, w[0]); y1 = Math.max(y1, w[1]);
    });
    return { x0, y0, x1, y1 };
  };
})();
