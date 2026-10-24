/* PipeIso – company logo (SVG).
 * The uploaded SVG is cleaned before it is stored and placed in the title block:
 * - anything that could run code or load things from elsewhere is removed (scripts, links, embedded pages and pictures),
 * - CSS styles are turned into plain attributes, so the logo's styles can't change the rest of the sheet,
 * - ids get a prefix, so they can't clash with the sheet's own ids,
 * - the root gets a viewBox and no fixed size, so it can be fitted into the title block. */
(function () {
  'use strict';
  const ISO = window.ISO;
  const SVG_NS = 'http://www.w3.org/2000/svg';
  const XLINK = 'http://www.w3.org/1999/xlink';

  ISO.LOGO_MAX_BYTES = 1500 * 1024; // upload limit before cleaning

  const DROP = ['script', 'foreignObject', 'iframe', 'object', 'embed', 'image', 'audio', 'video', 'canvas',
    'animate', 'animateTransform', 'animateMotion', 'animateColor', 'set', 'metadata', 'title', 'desc'];
  const SHAPES = ['path', 'rect', 'circle', 'ellipse', 'line', 'polyline', 'polygon', 'text', 'tspan', 'g', 'use', 'svg', 'symbol'];
  // computed style -> attribute (only values that differ from the SVG defaults are written)
  const PROPS = { fill: 'rgb(0, 0, 0)', 'fill-opacity': '1', 'fill-rule': 'nonzero', stroke: 'none', 'stroke-width': '1px',
    'stroke-opacity': '1', 'stroke-linecap': 'butt', 'stroke-linejoin': 'miter', 'stroke-miterlimit': '4', opacity: '1',
    'font-family': null, 'font-size': null, 'font-weight': '400', 'font-style': 'normal', 'text-anchor': 'start', 'letter-spacing': 'normal' };

  /** Clean an uploaded SVG (text). Returns the cleaned SVG text; throws Error(message key) if it is not usable. */
  ISO.cleanLogoSvg = (text) => {
    if (typeof text !== 'string' || !text.trim()) throw new Error('err.logoType');
    const docx = new DOMParser().parseFromString(text, 'image/svg+xml');
    const src = docx.documentElement;
    if (!src || src.localName !== 'svg' || docx.getElementsByTagName('parsererror').length) throw new Error('err.logoType');

    // 1) remove unsafe or unneeded elements; unwrap links (keep what is inside)
    DROP.forEach((n) => Array.from(src.getElementsByTagName(n)).forEach((e) => e.remove()));
    Array.from(src.getElementsByTagName('a')).forEach((a) => { while (a.firstChild) a.parentNode.insertBefore(a.firstChild, a); a.remove(); });
    // 2) remove event handlers and links to anything outside the logo
    const inner = (s) => s.trim().replace(/^['"]|['"]$/g, '').trim();
    const hasOutsideUrl = (v) => (v.match(/url\(([^)]*)\)/gi) || []).some((m) => !inner(m.slice(4, -1)).startsWith('#'));
    const all = [src].concat(Array.from(src.getElementsByTagName('*')));
    all.forEach((e) => Array.from(e.attributes).forEach((at) => {
      const n = at.name.toLowerCase(), v = at.value.trim();
      if (n.startsWith('on')) e.removeAttributeNode(at);
      else if ((n === 'href' || n === 'xlink:href') && !v.startsWith('#')) e.removeAttributeNode(at);
      else if (hasOutsideUrl(v) || /javascript:/i.test(v)) e.removeAttributeNode(at);
    }));
    Array.from(src.getElementsByTagName('style')).forEach((st) => {
      st.textContent = st.textContent.replace(/@import[^;]*;?/gi, '')
        .replace(/url\(([^)]*)\)/gi, (m, u) => (inner(u).startsWith('#') ? m : 'none'));
    });

    // 3) turn styles into attributes: place a copy in the page for a moment and read the computed styles
    const holder = document.createElement('div');
    // off-screen, not "visibility: hidden" (that would be inherited and make every shape look hidden)
    holder.style.cssText = 'position:absolute;left:-10000px;top:0;width:400px;height:400px;overflow:hidden;pointer-events:none;' +
      'font:16px Arial,sans-serif;color:#000;letter-spacing:normal';
    const live = document.importNode(src, true);
    holder.appendChild(live);
    document.body.appendChild(holder);
    try {
      let box = null;
      try { box = live.getBBox(); } catch (e) { box = null; }
      const els = Array.from(live.getElementsByTagName('*'));
      const removeList = [];
      els.forEach((e) => {
        if (e.closest('defs, clipPath, mask, pattern, linearGradient, radialGradient, marker') && e.localName !== 'stop' && !SHAPES.includes(e.localName)) return;
        const cs = getComputedStyle(e);
        if (e.localName === 'stop') {
          e.setAttribute('stop-color', cs.stopColor); e.setAttribute('stop-opacity', cs.stopOpacity);
          return;
        }
        if (!SHAPES.includes(e.localName)) return;
        if (cs.display === 'none' || cs.visibility === 'hidden') { removeList.push(e); return; }
        const isText = e.localName === 'text' || e.localName === 'tspan';
        Object.keys(PROPS).forEach((p) => {
          if (!isText && (p.startsWith('font') || p === 'text-anchor' || p === 'letter-spacing')) return;
          const v = cs.getPropertyValue(p);
          if (!v || v === PROPS[p]) return;
          e.setAttribute(p, /^(stroke-width|font-size|letter-spacing)$/.test(p) ? String(parseFloat(v)) : v.replace(/"/g, "'"));
        });
        if (!e.hasAttribute('fill') && !['svg', 'g', 'use', 'symbol'].includes(e.localName)) e.setAttribute('fill', cs.fill);
      });
      removeList.forEach((e) => e.remove());
      // 4) styles are now attributes: drop style sheets, classes and style attributes
      Array.from(live.getElementsByTagName('style')).forEach((s) => s.remove());
      [live].concat(Array.from(live.getElementsByTagName('*'))).forEach((e) => { e.removeAttribute('class'); e.removeAttribute('style'); });

      // 5) prefix ids and fix every reference to them
      const ids = {};
      // (ids that already have the prefix stay as they are, so cleaning twice gives the same result)
      Array.from(live.querySelectorAll('[id]')).forEach((e) => { const n = e.id.startsWith('lg-') ? e.id : 'lg-' + e.id; ids[e.id] = n; e.id = n; });
      const fixRef = (v) => v.replace(/url\(\s*['"]?#([^'")\s]+)['"]?\s*\)/g, (m, id) => (ids[id] ? `url(#${ids[id]})` : 'none'));
      Array.from(live.getElementsByTagName('*')).forEach((e) => Array.from(e.attributes).forEach((at) => {
        if (at.name === 'href' || at.name === 'xlink:href') {
          const id = at.value.slice(1);
          if (ids[id]) e.setAttributeNS(at.namespaceURI, at.name, '#' + ids[id]); else e.removeAttributeNode(at);
        } else if (at.value.includes('url(')) at.value = fixRef(at.value);
      }));
      // <use> without a (valid) reference draws nothing
      Array.from(live.getElementsByTagName('use')).forEach((u) => { if (!u.getAttribute('href') && !u.getAttributeNS(XLINK, 'href')) u.remove(); });

      // 6) root: viewBox, no fixed size, fitted into its box
      if (!live.getAttribute('viewBox')) {
        // width/height may carry units; the drawing inside is in pixels (96 per inch)
        const PX = { mm: 96 / 25.4, cm: 96 / 2.54, in: 96, pt: 4 / 3, pc: 16, px: 1, '': 1 };
        const len = (s) => { const m = /^\s*([\d.]+)\s*(mm|cm|in|pt|pc|px)?\s*$/.exec(s || ''); return m ? parseFloat(m[1]) * PX[m[2] || ''] : NaN; };
        const w = len(live.getAttribute('width')), h = len(live.getAttribute('height'));
        if (w > 0 && h > 0) live.setAttribute('viewBox', `0 0 ${w} ${h}`);
        else if (box && box.width > 0 && box.height > 0) live.setAttribute('viewBox', `${box.x} ${box.y} ${box.width} ${box.height}`);
        else throw new Error('err.logoEmpty');
      }
      ['width', 'height', 'x', 'y', 'id', 'version', 'enable-background', 'xml:space'].forEach((a) => live.removeAttribute(a));
      live.setAttribute('preserveAspectRatio', 'xMidYMid meet');
      if (!live.querySelector('path, rect, circle, ellipse, line, polyline, polygon, text, use')) throw new Error('err.logoEmpty');
    } finally {
      holder.remove();
    }
    let out = new XMLSerializer().serializeToString(live);
    out = out.replace(/<!--[\s\S]*?-->/g, '');
    if (!/^<svg[\s>]/.test(out)) throw new Error('err.logoType');
    if (!out.includes('xmlns="' + SVG_NS + '"')) out = out.replace(/^<svg/, `<svg xmlns="${SVG_NS}"`);
    if (out.includes('xlink:') && !out.includes('xmlns:xlink')) out = out.replace(/^<svg/, `<svg xmlns:xlink="${XLINK}"`);
    return out;
  };

  /** The logo placed into a box of the sheet (x, y, w, h in mm), or '' when there is none. */
  ISO.logoMarkup = (svgText, x, y, w, h) => {
    if (typeof svgText !== 'string' || !/^<svg[\s>]/.test(svgText)) return '';
    return svgText.replace(/^<svg/, `<svg x="${x}" y="${y}" width="${w}" height="${h}" overflow="hidden"`);
  };
})();
