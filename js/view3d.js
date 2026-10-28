/* PipeIso – 3D view (view only: turn, zoom, pan).
 * Built with three.js (js/vendor, MIT licence), which is loaded the first time the view is opened.
 * The drawing is shown as real tubes with their outside diameter, simple 3D shapes for the parts, and a floor
 * 300 mm below the lowest point with a dashed drop line from every elbow and a circle where it meets the floor. */
(function () {
  'use strict';
  const ISO = window.ISO;
  const S = 0.001; // drawing mm -> 3D units (metres)
  const FLOOR_GAP = 300; // mm below the lowest point

  // ---------- loading three.js ----------
  let loading = null;
  function loadThree() {
    if (window.THREE && window.THREE.OrbitControls) return Promise.resolve();
    if (loading) return loading;
    const add = (src) => new Promise((res, rej) => {
      const s = document.createElement('script');
      s.src = src; s.onload = res; s.onerror = () => rej(new Error(src));
      document.head.appendChild(s);
    });
    loading = add('js/vendor/three.min.js').then(() => add('js/vendor/OrbitControls.js')).catch((e) => { loading = null; throw e; });
    return loading;
  }

  // ---------- geometry helpers ----------
  /** Drawing point (x = East, y = North, z = Up, mm) -> 3D point (three.js: y is up, north is −z). */
  const V = (p) => new THREE.Vector3(p[0] * S, p[2] * S, -p[1] * S);
  /** Outside diameter of the tube (mm), close to the real ISO-KF / ISO-K tubes. */
  const OD = { KF: { 10: 14, 16: 20, 25: 28, 40: 42, 50: 54 }, K: { 63: 70, 80: 85, 100: 104, 160: 154, 200: 204, 250: 254, 320: 324, 400: 406, 500: 508, 630: 640 } };
  const odOf = (std, dn) => (OD[std] && OD[std][dn]) || dn * 1.05 + 4;
  const VALVES = ['gate', 'globe', 'ball', 'check', 'butterfly', 'needle', 'relief'];

  /** Build the 3D scene of a drawing. Returns { scene, box } (box = what the camera should fit). */
  function buildScene(doc, dark) {
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(dark ? 0x11161c : 0xf3f5f8);
    const model = new THREE.Group();
    scene.add(model);
    const M = (color, metal, rough) => new THREE.MeshStandardMaterial({ color, metalness: metal, roughness: rough });
    const mat = {
      pipe: M(0xb9c3cd, 0.55, 0.32),
      flange: M(0x8f9ba7, 0.65, 0.3),
      valve: M(0xea580c, 0.25, 0.45),
      body: M(0x5b6b7c, 0.4, 0.45),
      dark: M(0x2f3842, 0.3, 0.6),
      support: M(0x3b82f6, 0.3, 0.5),
      weld: M(0x1d2733, 0.2, 0.7),
    };
    const UP = new THREE.Vector3(0, 1, 0);
    const add = (geo, material, pos, quat) => {
      const m = new THREE.Mesh(geo, material);
      if (pos) m.position.copy(pos);
      if (quat) m.quaternion.copy(quat);
      model.add(m);
      return m;
    };
    /** Cylinder (or cone) from a to b: radius r1 at a, r2 at b. */
    const cyl = (a, b, r1, r2, material, open) => {
      const d = b.clone().sub(a), len = d.length();
      if (len < 1e-6) return null;
      const q = new THREE.Quaternion().setFromUnitVectors(UP, d.clone().normalize());
      return add(new THREE.CylinderGeometry(r2, r1, len, 32, 1, !!open), material, a.clone().add(b).multiplyScalar(0.5), q);
    };
    /** Disc of thickness th centred on c, facing dir. */
    const disc = (c, dir, r, th, material) => cyl(c.clone().addScaledVector(dir, -th / 2), c.clone().addScaledVector(dir, th / 2), r, r, material);
    const sphere = (c, r, material) => add(new THREE.SphereGeometry(r, 24, 16), material, c);
    /** Ring (torus) of radius R around axis dir at c. */
    const torus = (c, dir, R, tube, material) => add(new THREE.TorusGeometry(R, tube, 12, 40), material, c, new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 0, 1), dir.clone().normalize()));
    /** Box centred on c with its edges along x (sx), y (sy) and z = x × y (sz). */
    const box = (c, x, y, sx, sy, sz, material) => {
      const z = new THREE.Vector3().crossVectors(x, y).normalize();
      const m = add(new THREE.BoxGeometry(sx, sy, sz), material, c);
      m.setRotationFromMatrix(new THREE.Matrix4().makeBasis(x.clone().normalize(), y.clone().normalize(), z));
      return m;
    };
    /** 3D direction across the pipe on the chosen side (where stems, lugs and plates point). */
    const sideDir = (a3, b3, side) => {
      const ax = ISO.axisOf(a3, b3);
      const v = ax ? ISO.symPerp(ax.v) : [0, 0, 1];
      return V(v).normalize().multiplyScalar(side === -1 ? -1 : 1);
    };

    const deg = ISO.nodeDegrees(doc);
    const rOf = (p) => (odOf(p.std, p.dn) / 2) * S;
    const flangeR = (r) => r * 1.75 + 0.004, flangeT = 0.012;

    // pipes and components in the line
    doc.pipes.forEach((p) => {
      const [a3, b3] = ISO.pipeEnds(doc, p);
      const a = V(a3), b = V(b3), dir = b.clone().sub(a).normalize(), len = a.distanceTo(b);
      const r = rOf(p), c = a.clone().add(b).multiplyScalar(0.5);
      if (!p.comp) { cyl(a, b, r, r, mat.pipe); return; }
      const t = p.comp.type, side = sideDir(a3, b3, p.comp.side);
      const endFlanges = () => [a, b].forEach((e, i) => disc(e.clone().addScaledVector(dir, (i ? -1 : 1) * flangeT / 2), dir, flangeR(r), flangeT, mat.flange));
      if (VALVES.includes(t)) {
        cyl(a, b, r * 1.3, r * 1.3, mat.valve);
        endFlanges();
        if (t === 'check') { cyl(c.clone().addScaledVector(dir, -r * 0.8), c.clone().addScaledVector(dir, r * 0.8), r * 1.75, r * 0.6, mat.valve); return; }
        const top = c.clone().addScaledVector(side, r * 3.2);
        cyl(c, top, r * 0.22, r * 0.22, mat.body);
        if (t === 'ball' || t === 'butterfly') box(top.clone().addScaledVector(dir, r * 1.2), dir, side, r * 2.8, r * 0.35, r * 0.6, mat.body);
        else torus(top, side, r * 1.4, r * 0.16, mat.body);
      } else if (t === 'reducer' || t === 'reducerEcc') {
        const rs = (odOf(p.comp.std2, p.comp.dn2) / 2) * S;
        const ra = p.comp.flip ? rs : r, rb = p.comp.flip ? r : rs;
        if (t === 'reducer') cyl(a, b, ra, rb, mat.pipe);
        else { // eccentric: the flat side stays in line
          const off = (r - rs) / 2;
          cyl(a.clone().addScaledVector(side, ra < rb ? off : 0), b.clone().addScaledVector(side, rb < ra ? off : 0), ra, rb, mat.pipe);
        }
        endFlanges();
      } else if (t === 'bellows') {
        cyl(a, b, r * 1.05, r * 1.05, mat.pipe);
        const n = Math.max(3, Math.min(30, Math.floor(len / (r * 0.7))));
        for (let i = 1; i < n; i++) torus(a.clone().addScaledVector(dir, (len * i) / n), dir, r * 1.2, r * 0.22, mat.pipe);
        endFlanges();
      } else if (t === 'hose') {
        cyl(a, b, r * 1.15, r * 1.15, mat.dark);
        endFlanges();
      } else if (t === 'silencer') {
        cyl(a.clone().addScaledVector(dir, len * 0.12), b.clone().addScaledVector(dir, -len * 0.12), r * 2.2, r * 2.2, mat.body);
        cyl(a, a.clone().addScaledVector(dir, len * 0.12), r, r * 2.2, mat.body);
        cyl(b.clone().addScaledVector(dir, -len * 0.12), b, r * 2.2, r, mat.body);
        endFlanges();
      } else if (ISO.FITTINGS[t] && ISO.FITTINGS[t].support) {
        cyl(a, b, r, r, mat.pipe);
        support(c, dir, side, t, len, r);
      } else cyl(a, b, r, r, mat.pipe);
    });

    /** A pipe clamp (ring with bolt lugs) or weld-on clamp (ring, stem, base plate) of width w at c. */
    function support(c, dir, side, type, w, r) {
      const wd = Math.max(w, 0.008);
      cyl(c.clone().addScaledVector(dir, -wd / 2), c.clone().addScaledVector(dir, wd / 2), r * 1.18, r * 1.18, mat.support);
      if (type === 'clamp') {
        [-1, 1].forEach((k) => box(c.clone().addScaledVector(side, r * 1.7).addScaledVector(dir, k * wd * 0.22), dir, side, wd * 0.2, r * 1.2, r * 0.9, mat.support));
      } else {
        const foot = c.clone().addScaledVector(side, r * 3);
        cyl(c.clone().addScaledVector(side, r * 1.1), foot, r * 0.3, r * 0.3, mat.support);
        box(foot, dir, side, Math.max(wd * 1.8, r * 2), 0.008, r * 3, mat.support);
      }
    }

    // round joints at elbows and tees
    Object.keys(doc.nodes).forEach((id) => {
      if (!(deg[id] >= 2)) return;
      const ps = ISO.pipesAt(doc, id).filter((p) => !p.comp);
      if (ps.length < 2) return;
      sphere(V(ISO.nodePt(doc, id)), Math.max(...ps.map(rOf)), mat.pipe);
    });

    // flanges at pipe ends (chosen per pipe or by the automatic rule)
    doc.pipes.forEach((p) => {
      if (p.comp) return;
      const [a3, b3] = ISO.pipeEnds(doc, p);
      const a = V(a3), b = V(b3), dir = b.clone().sub(a).normalize(), r = rOf(p);
      ISO.pipeFlanges(doc, p, deg).forEach((on, i) => {
        if (!on) return;
        const e = i ? b : a;
        disc(e.clone().addScaledVector(dir, (i ? -1 : 1) * flangeT / 2), dir, flangeR(r), flangeT, mat.flange);
      });
    });

    // parts on the pipes
    doc.fittings.forEach((f) => {
      const p = ISO.byId(doc.pipes, f.pipeId);
      if (!p) return;
      const [a3, b3] = ISO.pipeEnds(doc, p);
      const a = V(a3), b = V(b3), dir = b.clone().sub(a).normalize(), r = rOf(p);
      const c = a.clone().lerp(b, f.t), side = sideDir(a3, b3, f.side);
      switch (f.type) {
        case 'flange': [-1, 1].forEach((k) => disc(c.clone().addScaledVector(dir, k * flangeT * 0.55), dir, flangeR(r), flangeT, mat.flange)); break;
        case 'flange1': disc(c, dir, flangeR(r), flangeT, mat.flange); break;
        case 'blind': {
          const k = f.flip ? -1 : 1;
          disc(c, dir, flangeR(r), flangeT, mat.flange);
          disc(c.clone().addScaledVector(dir, k * flangeT), dir, flangeR(r), flangeT, mat.body);
          break;
        }
        case 'weld': torus(c, dir, r * 1.02, r * 0.12, mat.weld); break;
        case 'fieldweld': torus(c, dir, r * 1.02, r * 0.16, mat.valve); break;
        case 'flow': {
          const k = f.flip ? -1 : 1, h = r * 2.6;
          const base = c.clone().addScaledVector(side, r * 2.2);
          cyl(base.clone().addScaledVector(dir, -k * h / 2), base.clone().addScaledVector(dir, k * h / 2), r * 0.8, 0, mat.valve);
          break;
        }
        case 'clamp': case 'weldclamp': support(c, dir, side, f.type, ISO.supportWidth(f) * S, r); break;
        default: break;
      }
    });

    // floor 300 mm below the lowest point, with a dashed drop line from every elbow and a circle on the floor
    const pts = Object.keys(doc.nodes).map((id) => ISO.nodePt(doc, id));
    const xs = pts.map((p) => p[0]), ys = pts.map((p) => p[1]), zs = pts.map((p) => p[2]);
    const floorZ = Math.min(...zs) - FLOOR_GAP, fy = floorZ * S;
    const margin = 1000;
    const x0 = Math.min(...xs) - margin, x1 = Math.max(...xs) + margin, y0 = Math.min(...ys) - margin, y1 = Math.max(...ys) + margin;
    const step = 500; // grid lines every 500 mm
    const gx0 = Math.floor(x0 / step) * step, gx1 = Math.ceil(x1 / step) * step, gy0 = Math.floor(y0 / step) * step, gy1 = Math.ceil(y1 / step) * step;
    const fw = (gx1 - gx0) * S, fd = (gy1 - gy0) * S;
    const floor = new THREE.Mesh(new THREE.PlaneGeometry(fw, fd), new THREE.MeshStandardMaterial({
      color: dark ? 0x1a2129 : 0xe6eaef, roughness: 0.95, metalness: 0, transparent: true, opacity: 0.92, side: THREE.DoubleSide,
    }));
    floor.rotation.x = -Math.PI / 2;
    floor.position.set(((gx0 + gx1) / 2) * S, fy, -((gy0 + gy1) / 2) * S);
    scene.add(floor);
    const gridPts = [];
    for (let x = gx0; x <= gx1; x += step) gridPts.push(new THREE.Vector3(x * S, fy + 0.0005, -gy0 * S), new THREE.Vector3(x * S, fy + 0.0005, -gy1 * S));
    for (let y = gy0; y <= gy1; y += step) gridPts.push(new THREE.Vector3(gx0 * S, fy + 0.0005, -y * S), new THREE.Vector3(gx1 * S, fy + 0.0005, -y * S));
    scene.add(new THREE.LineSegments(new THREE.BufferGeometry().setFromPoints(gridPts),
      new THREE.LineBasicMaterial({ color: dark ? 0x2a333d : 0xc9d1da })));

    const markCol = dark ? 0xb4c0cc : 0x2b3542;
    const dashMat = new THREE.LineDashedMaterial({ color: markCol, dashSize: 0.045, gapSize: 0.03 });
    const ringMat = new THREE.MeshBasicMaterial({ color: markCol, side: THREE.DoubleSide });
    ISO.elbowAngles(doc).forEach(({ n }) => {
      const top = V(n), foot = new THREE.Vector3(top.x, fy, top.z);
      const line = new THREE.Line(new THREE.BufferGeometry().setFromPoints([top, foot]), dashMat);
      line.computeLineDistances();
      scene.add(line);
      const ring = new THREE.Mesh(new THREE.RingGeometry(0.038, 0.05, 48), ringMat);
      ring.rotation.x = -Math.PI / 2;
      ring.position.set(foot.x, fy + 0.001, foot.z);
      scene.add(ring);
    });

    // north arrow on the floor
    const nBase = new THREE.Vector3(gx0 * S + 0.25, fy + 0.002, -gy0 * S - 0.15);
    scene.add(new THREE.ArrowHelper(new THREE.Vector3(0, 0, -1), nBase, 0.5, 0xea580c, 0.12, 0.07));
    scene.add(textSprite('N', nBase.clone().add(new THREE.Vector3(0, 0.02, -0.62)), dark));

    // light
    scene.add(new THREE.HemisphereLight(0xffffff, dark ? 0x202830 : 0x8a939c, dark ? 0.75 : 0.85));
    const sun = new THREE.DirectionalLight(0xffffff, 0.85);
    sun.position.set(4, 8, 5);
    scene.add(sun);
    const fill = new THREE.DirectionalLight(0xffffff, 0.3);
    fill.position.set(-5, 3, -4);
    scene.add(fill);

    const fitBox = new THREE.Box3().setFromObject(model);
    fitBox.expandByPoint(new THREE.Vector3(fitBox.min.x, fy, fitBox.min.z));
    return { scene, box: fitBox };
  }

  /** A flat text label that always faces the camera. */
  function textSprite(txt, pos, dark) {
    const cv = document.createElement('canvas');
    cv.width = 128; cv.height = 128;
    const x = cv.getContext('2d');
    x.font = 'bold 96px Arial'; x.textAlign = 'center'; x.textBaseline = 'middle';
    x.fillStyle = dark ? '#fb923c' : '#ea580c';
    x.fillText(txt, 64, 68);
    const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: new THREE.CanvasTexture(cv), depthTest: false }));
    sp.scale.set(0.22, 0.22, 1);
    sp.position.copy(pos);
    return sp;
  }

  // ---------- the view (overlay with its own toolbar) ----------
  let st = null; // { renderer, camera, controls, scene, box, raf, ro }
  const el = (id) => document.getElementById(id);
  const VIEWS = { iso: [1, 1, 1], top: [0, 1, 0.0001], front: [0, 0.0001, 1], side: [1, 0.0001, 0] };

  /** Look at the whole model from a direction (iso / top / front / side), or 'fit' = keep the direction. */
  function setView(name) {
    if (!st) return;
    const dir = name === 'fit'
      ? st.camera.position.clone().sub(st.controls.target).normalize()
      : new THREE.Vector3(...(VIEWS[name] || VIEWS.iso)).normalize();
    const sph = st.box.getBoundingSphere(new THREE.Sphere());
    const fov = (st.camera.fov * Math.PI) / 180;
    const fit = Math.max(sph.radius, 0.2) / Math.sin(Math.min(fov, fov * st.camera.aspect) / 2);
    st.camera.position.copy(sph.center).addScaledVector(dir, fit * 1.05);
    st.camera.near = Math.max(0.001, fit / 500); st.camera.far = fit * 50;
    st.camera.updateProjectionMatrix();
    st.controls.target.copy(sph.center);
    st.controls.update();
  }

  function message(txt) {
    const m = el('v3msg');
    m.textContent = txt || '';
    m.hidden = !txt;
  }

  async function open(doc, dark) {
    const T = ISO.t, wrap = el('view3d'), host = el('v3canvas');
    wrap.hidden = false;
    document.body.classList.add('v3-open');
    if (!doc.pipes.length) { message(T('v3.empty')); return; }
    message(T('v3.loading'));
    try { await loadThree(); } catch (e) { message(T('v3.loadErr')); return; }
    if (wrap.hidden) return; // closed while loading
    let renderer;
    try { renderer = new THREE.WebGLRenderer({ antialias: true }); } catch (e) { message(T('v3.noWebgl')); return; }
    message('');
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    host.innerHTML = '';
    host.appendChild(renderer.domElement);
    const { scene, box } = buildScene(doc, dark);
    const camera = new THREE.PerspectiveCamera(35, 1, 0.01, 1000);
    const controls = new THREE.OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.12;
    controls.screenSpacePanning = true;
    controls.touches = { ONE: THREE.TOUCH.ROTATE, TWO: THREE.TOUCH.DOLLY_PAN };
    st = { renderer, camera, controls, scene, box, raf: 0, ro: null };
    const resize = () => {
      const w = host.clientWidth || 1, h = host.clientHeight || 1;
      renderer.setSize(w, h, false);
      renderer.domElement.style.width = '100%'; renderer.domElement.style.height = '100%';
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
    };
    st.ro = new ResizeObserver(resize);
    st.ro.observe(host);
    resize();
    setView('iso');
    const loop = () => { if (!st) return; st.raf = requestAnimationFrame(loop); controls.update(); renderer.render(scene, camera); };
    loop();
  }

  function close() {
    el('view3d').hidden = true;
    document.body.classList.remove('v3-open');
    message('');
    if (!st) return;
    cancelAnimationFrame(st.raf);
    st.ro.disconnect();
    st.controls.dispose();
    st.scene.traverse((o) => {
      if (o.geometry) o.geometry.dispose();
      if (o.material) [].concat(o.material).forEach((m) => { if (m.map) m.map.dispose(); m.dispose(); });
    });
    st.renderer.dispose();
    st.renderer.domElement.remove();
    st = null;
  }

  // toolbar buttons and Esc
  document.addEventListener('click', (e) => {
    const b = e.target.closest('[data-v3]');
    if (!b) return;
    if (b.dataset.v3 === 'close') close();
    else setView(b.dataset.v3);
  });
  window.addEventListener('keydown', (e) => { if (e.key === 'Escape' && !el('view3d').hidden) { e.stopImmediatePropagation(); close(); } }, true);

  ISO.view3d = { open, close, isOpen: () => !el('view3d').hidden, _state: () => st }; // _state: for tests
})();
