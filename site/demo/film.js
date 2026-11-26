/* film.js - animation-explainer-creator engine. MIT License, (c) 2026 RoeeAI.

   A narrated explainer "film" drawn live on a <canvas>. No video files: every frame is drawn by code.
     - A film is a list of scenes. A scene is { id, title, dur, cap: [[t, onScreenHtml, spokenText]], draw(g, t, s) }.
     - draw() paints one frame of the scene at local time t (seconds). It must depend on t only (no state between
       frames), so seeking, chapters and MP4 export all work.
     - Every caption starts a segment. When a recorded narration clip is longer than its segment, the segment is
       stretched to fit it, and while the clip plays the audio is the clock, so picture and voice stay in sync.
     - Everything is drawn on a virtual 1600x900 canvas and scaled to the screen.

   API
     Film.page(FILM)           build a whole page (header, player, transcript) from scenes.js -> player
     Film.mount(el, cfg)       just the player. cfg: { scenes, lang, label, narration: { base, dur }, ui, grid }
     Film.makeG(ctx)           the drawing kit, see references/engine-api.md
     player.renderFrame(canvas, t, { captions: 'band' | 'overlay' | 'none' })   one frame at any size (MP4 export)
     player.inspect(t)         layout warnings for the frame at t (text outside the frame, overlapping text)
     player.cues() / player.captions() / player.stretch()                         timing data for tools */
(function (root) {
  'use strict';

  /* ---------- constants and helpers ---------- */
  const VW = 1600, VH = 900;
  const PAL = {
    bg: '#0e1821', bg2: '#16232f', grid: 'rgba(140,190,210,0.06)', grid2: 'rgba(140,190,210,0.11)',
    ink: '#eaf1f6', dim: '#93a7b8', faint: '#566b7c',
    blue: '#5cb8ff', orange: '#ff9d4d', green: '#58dca0', red: '#ff6b5e', yellow: '#ffd25e', violet: '#b8a4ff',
    metal: '#a9b8c4', metalDark: '#62727e', wood: '#b88655', woodDark: '#86603c',
    paper: '#efe9d8', paperInk: '#2a2f38', ruler: '#e3cd84', rulerInk: '#3a3222',
    chip: 'rgba(10,19,27,0.86)', panel: 'rgba(255,255,255,0.045)'
  };
  const FONT = {
    text: '"IBM Plex Sans Hebrew", "IBM Plex Sans", "IBM Plex Sans Arabic", "Arial Hebrew", "Noto Sans Hebrew", Arial, sans-serif',
    mono: '"IBM Plex Mono", ui-monospace, Menlo, Consolas, monospace',
    math: '"Times New Roman", "STIX Two Text", Times, serif'
  };
  FONT.he = FONT.text; // older scenes use font: 'he'
  const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
  const lerp = (a, b, p) => a + (b - a) * p;
  const seg = (t, a, b) => clamp((t - a) / (b - a), 0, 1);
  const ease = {
    io: p => (p < 0.5 ? 2 * p * p : 1 - Math.pow(-2 * p + 2, 2) / 2),
    out: p => 1 - Math.pow(1 - p, 3),
    in: p => p * p * p,
    back: p => { const c = 1.70158; return 1 + (c + 1) * Math.pow(p - 1, 3) + c * Math.pow(p - 1, 2); }
  };
  const RTL = /[֐-ࣿיִ-﷿ﹰ-﻿]/;
  const RTL_LANGS = /^(he|iw|ar|fa|ur|yi)\b/i;
  const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const plain = html => String(html).replace(/<[^>]*>/g, '').replace(/&nbsp;/g, ' ').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"').replace(/&amp;/g, '&').replace(/\s+/g, ' ').trim();
  const fmtTime = s => { s = Math.max(0, Math.round(s)); return Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0'); };

  const UI = {
    he: { play: 'נגן', pause: 'השהה', replay: 'נגן שוב', bigPlay: 'נגן את הסרטון', seek: 'מיקום בסרטון', speed: 'מהירות הניגון',
      voice: 'קריינות', voiceTitle: 'הפעלה או השתקה של הקריינות', full: 'מסך מלא', film: 'סרטון מונפש', transcript: 'תמליל הסרטון',
      note: 'סרטון מונפש עם קריינות וכתוביות. אפשר לקפוץ לכל פרק, ולהשתיק את הקריינות בכפתור "קריינות".',
      noteSilent: 'סרטון מונפש עם כתוביות. אפשר לקפוץ לכל פרק.' },
    en: { play: 'Play', pause: 'Pause', replay: 'Play again', bigPlay: 'Play the film', seek: 'Position in the film', speed: 'Playback speed',
      voice: 'Narration', voiceTitle: 'Turn the narration on or off', full: 'Full screen', film: 'Animated film', transcript: 'Transcript',
      note: 'An animated film with narration and captions. Jump to any chapter, or mute the narration with the "Narration" button.',
      noteSilent: 'An animated film with captions. Jump to any chapter.' },
    ar: { play: 'تشغيل', pause: 'إيقاف مؤقت', replay: 'إعادة التشغيل', bigPlay: 'شغّل الفيلم', seek: 'الموضع في الفيلم', speed: 'سرعة التشغيل',
      voice: 'التعليق الصوتي', voiceTitle: 'تشغيل التعليق الصوتي أو كتمه', full: 'ملء الشاشة', film: 'فيلم متحرك', transcript: 'نص الفيلم',
      note: 'فيلم متحرك مع تعليق صوتي وترجمة. يمكن الانتقال إلى أي فصل وكتم التعليق الصوتي.',
      noteSilent: 'فيلم متحرك مع ترجمة. يمكن الانتقال إلى أي فصل.' }
  };
  const ui = (lang, over) => Object.assign({}, UI[String(lang || 'en').slice(0, 2)] || UI.en, over || {});

  /* ---------- drawing kit (virtual 1600x900 canvas) ---------- */
  function makeG(ctx) {
    const g = { ctx, W: VW, H: VH, C: PAL, F: FONT, seg, ease, lerp, clamp, k: 1, ox: 0, oy: 0, gridOn: true, dbg: null };
    let owner = 0;

    /* debug: remember where text lands, in film coordinates (used by player.inspect) */
    function rec(x0, y0, x1, y1, s, kind, own, alpha) {
      if (!g.dbg || alpha < 0.05) return;
      const m = ctx.getTransform(), P = [[x0, y0], [x1, y0], [x0, y1], [x1, y1]].map(([x, y]) => [(m.a * x + m.c * y + m.e - g.ox) / g.k, (m.b * x + m.d * y + m.f - g.oy) / g.k]);
      const xs = P.map(p => p[0]), ys = P.map(p => p[1]);
      g.dbg.push({ x0: Math.min(...xs), y0: Math.min(...ys), x1: Math.max(...xs), y1: Math.max(...ys), s: String(s), kind, own });
    }

    g.alpha = (a, fn) => { ctx.save(); ctx.globalAlpha *= clamp(a, 0, 1); fn(); ctx.restore(); };
    g.at = (x, y, ang, fn) => { ctx.save(); ctx.translate(x, y); if (ang) ctx.rotate(ang); fn(); ctx.restore(); };
    g.clip = (x, y, w, h, fn) => { ctx.save(); ctx.beginPath(); ctx.rect(x, y, w, h); ctx.clip(); fn(); ctx.restore(); };

    g.bg = (o = {}) => {
      ctx.fillStyle = o.color || PAL.bg; ctx.fillRect(0, 0, VW, VH);
      if (o.grid === false || (!g.gridOn && !o.grid)) return;
      ctx.lineWidth = 1;
      for (let x = 0; x <= VW; x += 40) { ctx.strokeStyle = x % 200 === 0 ? PAL.grid2 : PAL.grid; ctx.beginPath(); ctx.moveTo(x + 0.5, 0); ctx.lineTo(x + 0.5, VH); ctx.stroke(); }
      for (let y = 0; y <= VH; y += 40) { ctx.strokeStyle = y % 200 === 100 ? PAL.grid2 : PAL.grid; ctx.beginPath(); ctx.moveTo(0, y + 0.5); ctx.lineTo(VW, y + 0.5); ctx.stroke(); }
    };

    function stroke(o, defW) {
      ctx.strokeStyle = o.color || PAL.ink; ctx.lineWidth = o.w || defW || 3;
      ctx.lineCap = o.cap || 'round'; ctx.lineJoin = 'round';
      if (o.dash) ctx.setLineDash(o.dash);
      if (o.alpha != null) ctx.globalAlpha *= o.alpha;
    }
    g.line = (x1, y1, x2, y2, o = {}) => { ctx.save(); stroke(o); ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.stroke(); ctx.restore(); };
    g.poly = (pts, o = {}) => {
      if (!pts.length) return;
      ctx.save(); stroke(o); ctx.beginPath(); ctx.moveTo(pts[0][0], pts[0][1]);
      for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i][0], pts[i][1]);
      if (o.close) ctx.closePath();
      if (o.fill) { ctx.fillStyle = o.fill; ctx.fill(); }
      if (o.color !== 'none') ctx.stroke();
      ctx.restore();
    };
    g.rect = (x, y, w, h, o = {}) => {
      ctx.save(); if (o.alpha != null) ctx.globalAlpha *= o.alpha;
      ctx.beginPath();
      const r = Math.min(o.r || 0, Math.abs(w) / 2, Math.abs(h) / 2);
      if (ctx.roundRect && r) ctx.roundRect(x, y, w, h, r); else ctx.rect(x, y, w, h);
      if (o.fill) { ctx.fillStyle = o.fill; ctx.fill(); }
      if (o.stroke) { ctx.strokeStyle = o.stroke; ctx.lineWidth = o.w || 2; if (o.dash) ctx.setLineDash(o.dash); ctx.stroke(); }
      ctx.restore();
    };
    g.circle = (x, y, r, o = {}) => {
      if (r <= 0) return;
      ctx.save(); if (o.alpha != null) ctx.globalAlpha *= o.alpha;
      ctx.beginPath(); ctx.arc(x, y, r, o.a0 || 0, o.a1 == null ? Math.PI * 2 : o.a1);
      if (o.fill) { ctx.fillStyle = o.fill; ctx.fill(); }
      if (o.stroke) { ctx.strokeStyle = o.stroke; ctx.lineWidth = o.w || 2; if (o.dash) ctx.setLineDash(o.dash); ctx.stroke(); }
      ctx.restore();
    };

    /* ----- text ----- */
    function font(o) {
      const size = o.size || 34;
      return `${o.italic ? 'italic ' : ''}${o.weight || 500} ${size}px ${FONT[o.font || 'text'] || FONT.text}`;
    }
    /* Inside right-to-left strings, wrap runs of Latin letters, numbers and symbols ("0.02 s", "a < g", "9.8 m/s²")
       in LRI..PDI isolates, so the canvas bidi algorithm keeps their order. */
    const LTR_RUN = /[A-Za-z0-9Α-Ωα-ω(⁰-₟−][A-Za-z0-9Α-Ωα-ω⁰-₟ .,:=+\-−·×÷/²³°()≈%~|<>≤≥]*[A-Za-z0-9Α-Ωα-ω⁰-₟²³°)%|]|[A-Za-z0-9Α-Ωα-ω]/g;
    const iso = s => (RTL.test(s) ? s.replace(LTR_RUN, m => '\u2066' + m + '\u2069') : s);
    g.iso = iso;
    g.text = (s, x, y, o = {}) => {
      const raw = String(s); s = iso(raw);
      ctx.save(); ctx.font = font(o);
      const align = o.align || 'center', base = o.base || 'middle', size = o.size || 34;
      ctx.fillStyle = o.color || PAL.ink; ctx.textAlign = align; ctx.textBaseline = base;
      ctx.direction = RTL.test(s) ? 'rtl' : 'ltr';
      if (o.alpha != null) ctx.globalAlpha *= o.alpha;
      if (g.dbg) {
        const w = Math.min(ctx.measureText(s).width, o.maxW || 1e9);
        const l = ctx.direction === 'rtl' ? { left: x, right: x - w, start: x - w, end: x, center: x - w / 2 } : { left: x, right: x - w, start: x, end: x - w, center: x - w / 2 };
        const x0 = align === 'center' ? x - w / 2 : align === 'left' ? x : align === 'right' ? x - w : (l[align] != null ? l[align] : x - w / 2);
        const y0 = base === 'top' || base === 'hanging' ? y : base === 'middle' ? y - size * 0.55 : y - size;
        rec(x0, y0, x0 + w, y0 + size * 1.1, raw, 'text', o._own || 0, ctx.globalAlpha);
      }
      if (o.maxW) ctx.fillText(s, x, y, o.maxW); else ctx.fillText(s, x, y);
      ctx.restore();
    };
    g.measure = (s, o = {}) => { s = iso(String(s)); ctx.save(); ctx.font = font(o); ctx.direction = RTL.test(s) ? 'rtl' : 'ltr'; const w = ctx.measureText(s).width; ctx.restore(); return w; };
    /* text inside a rounded pill. Returns its box. */
    g.label = (s, x, y, o = {}) => {
      const size = o.size || 28, pad = o.pad == null ? 14 : o.pad, own = ++owner;
      const w = g.measure(s, Object.assign({}, o, { size })) + pad * 2, h = size + pad * 1.1;
      const bx = o.align === 'left' ? x : o.align === 'right' ? x - w : x - w / 2;
      g.rect(bx, y - h / 2, w, h, { r: o.radius == null ? 10 : o.radius, fill: o.bg || PAL.chip, stroke: o.border || o.color || PAL.faint, w: 2, alpha: o.alpha });
      rec(bx, y - h / 2, bx + w, y + h / 2, s, 'pill', own, ctx.globalAlpha * (o.alpha == null ? 1 : o.alpha));
      g.text(s, bx + w / 2, y + 1, Object.assign({}, o, { size, align: 'center', _own: own }));
      return { x: bx, y: y - h / 2, w, h };
    };
    /* word-wrap a string to lines no wider than maxW */
    g.wrap = (s, maxW, o = {}) => {
      const words = String(s).split(/\s+/).filter(Boolean), lines = []; let cur = '';
      for (const w of words) { const next = cur ? cur + ' ' + w : w; if (cur && g.measure(next, o) > maxW) { lines.push(cur); cur = w; } else cur = next; }
      if (cur) lines.push(cur);
      return lines;
    };
    /* a wrapped paragraph. o.maxW (default 900), o.lineH (x size, default 1.4), o.valign 'top' | 'middle'. Returns { lines, h }. */
    g.para = (s, x, y, o = {}) => {
      const size = o.size || 32, lh = (o.lineH || 1.4) * size, lines = g.wrap(s, o.maxW || 900, Object.assign({}, o, { size }));
      const y0 = o.valign === 'middle' ? y - (lines.length - 1) * lh / 2 : y;
      lines.forEach((ln, i) => g.text(ln, x, y0 + i * lh, Object.assign({}, o, { size })));
      return { lines: lines.length, h: lines.length * lh };
    };
    /* bulleted list. x is the start edge (the right edge for right-to-left text). o.upto (fractional) reveals items
       one by one, o.numbered draws numbers, o.maxW wraps long items. Items: strings or { text, color }. Returns the y after the list. */
    g.bullets = (items, x, y, o = {}) => {
      const size = o.size || 30, gap = o.gap || size * 0.75, lh = (o.lineH || 1.3) * size, maxW = o.maxW || 1000;
      const upto = o.upto == null ? items.length : o.upto;
      const rtl = o.dir ? o.dir === 'rtl' : RTL.test(items.map(it => (typeof it === 'string' ? it : it.text)).join(' '));
      const sgn = rtl ? -1 : 1;
      let yy = y;
      items.forEach((it, i) => {
        const txt = typeof it === 'string' ? it : it.text, col = (typeof it === 'object' && it.color) || o.mark || PAL.orange;
        const lines = g.wrap(txt, maxW, { size, weight: o.weight });
        const k = clamp(upto - i, 0, 1);
        if (k > 0) g.alpha(ease.out(k), () => {
          const bx = x + (1 - ease.out(k)) * 24 * sgn;
          if (o.numbered) { g.circle(bx + sgn * size * 0.5, yy, size * 0.5, { fill: col }); g.text(String(i + 1), bx + sgn * size * 0.5, yy + 1, { size: size * 0.6, weight: 700, color: PAL.bg, font: 'mono' }); }
          else g.circle(bx + sgn * size * 0.3, yy, size * 0.17, { fill: col });
          lines.forEach((ln, j) => g.text(ln, bx + sgn * size * 1.25, yy + j * lh, { size, align: rtl ? 'right' : 'left', color: o.color || PAL.ink, weight: o.weight }));
        });
        yy += lines.length * lh + gap;
      });
      return yy;
    };
    /* card with an optional title chip on its top edge */
    g.panel = (x, y, w, h, o = {}) => {
      g.rect(x, y, w, h, { r: o.r == null ? 14 : o.r, fill: o.fill || PAL.panel, stroke: o.stroke || 'rgba(255,255,255,0.12)', w: 2, alpha: o.alpha });
      if (o.accent) g.rect(RTL.test(o.title || '') ? x + w - 6 : x, y + 14, 6, h - 28, { r: 3, fill: o.accent, alpha: o.alpha });
      if (o.title) g.label(o.title, RTL.test(o.title) ? x + w - 24 : x + 24, y, { align: RTL.test(o.title) ? 'right' : 'left', size: o.titleSize || 24, color: o.titleColor || PAL.ink, border: o.accent || PAL.faint, alpha: o.alpha });
    };
    /* point at (px, py) with a line to a label centred at (lx, ly) */
    g.callout = (px, py, lx, ly, s, o = {}) => {
      const c = o.color || PAL.yellow;
      g.line(px, py, lx, ly, { color: c, w: o.w || 2.5, alpha: o.alpha, dash: o.dash });
      g.circle(px, py, o.r || 6, { fill: c, alpha: o.alpha });
      return g.label(s, lx, ly, Object.assign({ size: 24, border: c }, o, { color: o.textColor || PAL.ink }));
    };

    /* mini math typesetting: Latin letters italic, x_n or x_{n+1} subscripts, t^2 or t^{-1} superscripts,
       {m/s} = upright group for units. o.align left|center|right (default center), o.roman = no italics. Returns width. */
    function mathRuns(str, size, roman) {
      const runs = []; let i = 0;
      const isIt = ch => !roman && /[A-Za-zαβγεθλμρστφωπ]/.test(ch);
      while (i < str.length) {
        const ch = str[i];
        if (ch === '{') {
          const j = str.indexOf('}', i + 1), grp = str.slice(i + 1, j < 0 ? str.length : j);
          for (const c of grp) runs.push({ s: c, sz: size, dy: 0, it: false });
          i = j < 0 ? str.length : j + 1;
        } else if ((ch === '_' || ch === '^') && i + 1 < str.length) {
          let grp;
          if (str[i + 1] === '{') { const j = str.indexOf('}', i + 2); grp = str.slice(i + 2, j < 0 ? str.length : j); i = j < 0 ? str.length : j + 1; }
          else { grp = str[i + 1]; i += 2; }
          for (const c of grp) runs.push({ s: c, sz: size * 0.64, dy: ch === '_' ? size * 0.3 : -size * 0.4, it: isIt(c) });
        } else { runs.push({ s: ch, sz: size, dy: 0, it: isIt(ch) }); i++; }
      }
      return runs;
    }
    g.mathWidth = (str, o = {}) => {
      const size = o.size || 40; let w = 0;
      ctx.save(); ctx.direction = 'ltr';
      mathRuns(String(str), size, o.roman).forEach(r => { ctx.font = `${r.it ? 'italic ' : ''}400 ${r.sz}px ${FONT.math}`; w += ctx.measureText(r.s).width + (r.it ? r.sz * 0.03 : 0); });
      ctx.restore(); return w;
    };
    g.math = (str, x, y, o = {}) => {
      const size = o.size || 40, runs = mathRuns(String(str), size, o.roman), w = g.mathWidth(str, o);
      let cx = o.align === 'left' ? x : o.align === 'right' ? x - w : x - w / 2;
      ctx.save(); ctx.direction = 'ltr'; ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
      ctx.fillStyle = o.color || PAL.ink; if (o.alpha != null) ctx.globalAlpha *= o.alpha;
      rec(cx, y - size * 0.6, cx + w, y + size * 0.6, str, 'text', o._own || 0, ctx.globalAlpha);
      runs.forEach(r => { ctx.font = `${r.it ? 'italic ' : ''}400 ${r.sz}px ${FONT.math}`; ctx.fillText(r.s, cx, y + r.dy); cx += ctx.measureText(r.s).width + (r.it ? r.sz * 0.03 : 0); });
      ctx.restore(); return w;
    };
    /* stacked fraction (math strings). x = centre of the bar */
    g.frac = (num, den, x, y, o = {}) => {
      const size = o.size || 36, c = o.color || PAL.ink;
      const w = Math.max(g.mathWidth(num, { size, roman: o.roman }), g.mathWidth(den, { size, roman: o.roman })) + 16;
      g.math(num, x, y - size * 0.62, { size, color: c, roman: o.roman, alpha: o.alpha });
      g.line(x - w / 2, y, x + w / 2, y, { color: c, w: 2.5, alpha: o.alpha });
      g.math(den, x, y + size * 0.68, { size, color: c, roman: o.roman, alpha: o.alpha });
      return w;
    };

    /* ----- arrows and annotations ----- */
    g.arrow = (x1, y1, x2, y2, o = {}) => {
      const c = o.color || PAL.ink, w = o.w || 4, hl = o.head || 10 + w * 2.5;
      const a = Math.atan2(y2 - y1, x2 - x1), len = Math.hypot(x2 - x1, y2 - y1);
      if (len < 2) return;
      const h = Math.min(hl, len);
      g.line(x1, y1, x2 - Math.cos(a) * h * 0.7, y2 - Math.sin(a) * h * 0.7, { color: c, w, dash: o.dash, alpha: o.alpha });
      ctx.save(); if (o.alpha != null) ctx.globalAlpha *= o.alpha; ctx.fillStyle = c; ctx.beginPath(); ctx.moveTo(x2, y2);
      ctx.lineTo(x2 - Math.cos(a - 0.42) * h, y2 - Math.sin(a - 0.42) * h);
      ctx.lineTo(x2 - Math.cos(a + 0.42) * h, y2 - Math.sin(a + 0.42) * h);
      ctx.closePath(); ctx.fill(); ctx.restore();
      if (o.label) {
        if (!o.font || o.font === 'math') g.math(o.label, x2 + (o.lx || 0), y2 + (o.ly || 0), { color: o.labelColor || c, size: o.size || 32, alpha: o.alpha });
        else g.text(o.label, x2 + (o.lx || 0), y2 + (o.ly || 0), { color: o.labelColor || c, size: o.size || 30, weight: 600, font: o.font, alpha: o.alpha });
      }
    };
    /* double-headed dimension line with label */
    g.dim = (x1, y1, x2, y2, label, o = {}) => {
      const c = o.color || PAL.yellow;
      g.arrow((x1 + x2) / 2, (y1 + y2) / 2, x1, y1, { color: c, w: 2.5, head: 14, alpha: o.alpha });
      g.arrow((x1 + x2) / 2, (y1 + y2) / 2, x2, y2, { color: c, w: 2.5, head: 14, alpha: o.alpha });
      if (label) g.label(label, (x1 + x2) / 2 + (o.lx || 0), (y1 + y2) / 2 + (o.ly || 0), { size: o.size || 24, color: c, font: o.font || 'mono', border: c, alpha: o.alpha });
    };
    g.dot = (x, y, r = 7, c) => g.circle(x, y, r, { fill: c || PAL.ink });
    g.pulse = (x, y, r, t, c) => {
      const k = (t % 1.4) / 1.4;
      g.circle(x, y, r + k * r * 0.9, { stroke: c || PAL.yellow, w: 4, alpha: 1 - k });
    };

    /* ----- graphs ----- */
    /* axes: b = inner plot box {x,y,w,h}; o: xmin xmax ymin ymax xticks yticks xfmt yfmt xlab ylab grid alpha. Returns mapping { X, Y, b }. */
    g.plot = (b, o) => {
      const X = v => b.x + (v - o.xmin) / (o.xmax - o.xmin) * b.w;
      const Y = v => b.y + b.h - (v - o.ymin) / (o.ymax - o.ymin) * b.h;
      const a = o.alpha == null ? 1 : o.alpha;
      const axisLabel = (s, x, y) => (RTL.test(s) ? g.text(s, x, y, { size: 24, color: PAL.ink, align: 'left' }) : g.text(s, x, y, { size: 26, color: PAL.ink, font: 'math', italic: true, align: 'left' }));
      g.alpha(a, () => {
        (o.xticks || []).forEach(v => {
          if (o.grid !== false) g.line(X(v), b.y, X(v), b.y + b.h, { color: 'rgba(255,255,255,0.07)', w: 1.5 });
          g.text(o.xfmt ? o.xfmt(v) : v, X(v), b.y + b.h + 26, { size: 21, font: 'mono', color: PAL.dim });
        });
        (o.yticks || []).forEach(v => {
          if (o.grid !== false) g.line(b.x, Y(v), b.x + b.w, Y(v), { color: 'rgba(255,255,255,0.07)', w: 1.5 });
          g.text(o.yfmt ? o.yfmt(v) : v, b.x - 14, Y(v), { size: 21, font: 'mono', color: PAL.dim, align: 'right' });
        });
        g.arrow(b.x, b.y + b.h, b.x + b.w + 34, b.y + b.h, { color: PAL.dim, w: 3, head: 16 });
        g.arrow(b.x, b.y + b.h, b.x, b.y - 34, { color: PAL.dim, w: 3, head: 16 });
        if (o.xlab) axisLabel(o.xlab, b.x + b.w + 30, b.y + b.h + 30);
        if (o.ylab) axisLabel(o.ylab, b.x + 14, b.y - 40);
      });
      return { X, Y, b, o };
    };
    /* scatter points; o.upto (fractional) pops points in one by one */
    g.pts = (P, pts, o = {}) => {
      const n = o.upto == null ? pts.length : o.upto;
      pts.forEach((p, i) => {
        const k = clamp(n - i, 0, 1); if (k <= 0) return;
        g.circle(P.X(p[0]), P.Y(p[1]), (o.r || 10) * ease.back(k), { fill: o.color || PAL.blue, stroke: PAL.bg, w: 3 });
      });
    };
    /* function curve on a plot, clipped to its box; o.progress draws it left to right */
    g.fn = (P, f, x0, x1, o = {}) => {
      const pr = o.progress == null ? 1 : clamp(o.progress, 0, 1); if (pr <= 0) return;
      const xe = x0 + (x1 - x0) * pr, b = P.b;
      ctx.save(); ctx.beginPath(); ctx.rect(b.x - 4, b.y - 40, b.w + 44, b.h + 44); ctx.clip();
      stroke(o, 4); ctx.beginPath();
      for (let i = 0; i <= 120; i++) { const x = x0 + (xe - x0) * i / 120, px = P.X(x), py = P.Y(f(x)); if (i) ctx.lineTo(px, py); else ctx.moveTo(px, py); }
      ctx.stroke(); ctx.restore();
    };
    /* bars on a plot: data [[x, y, color?]], o.bw bar width in x units, o.upto grows them one by one, o.values prints values */
    g.bars = (P, data, o = {}) => {
      const upto = o.upto == null ? data.length : o.upto, bw = o.bw || 0.6, base = o.base || 0;
      data.forEach((d, i) => {
        const k = ease.out(clamp(upto - i, 0, 1)); if (k <= 0) return;
        const x0 = P.X(d[0] - bw / 2), x1 = P.X(d[0] + bw / 2), y0 = P.Y(base), y1 = P.Y(base + (d[1] - base) * k);
        g.rect(x0, Math.min(y0, y1), x1 - x0, Math.abs(y1 - y0), { fill: d[2] || o.color || PAL.blue, r: 4 });
        if (o.values) g.text(o.fmt ? o.fmt(d[1]) : d[1], (x0 + x1) / 2, y1 - 22, { size: 22, font: 'mono', alpha: k, color: PAL.ink });
      });
    };
    /* small table. cols: [{ head, vals }]. Right-to-left when any head is right-to-left (or o.dir). o.upto reveals rows, o.hiRow highlights one. */
    g.table = (x, y, cols, o = {}) => {
      const cw = o.colW || 150, rh = o.rowH || 46, rows = Math.max(...cols.map(c => c.vals.length));
      const upto = o.upto == null ? rows : o.upto, W = cw * cols.length;
      const rtl = o.dir ? o.dir === 'rtl' : cols.some(c => RTL.test(c.head));
      g.rect(x, y, W, rh * (rows + 1), { fill: 'rgba(255,255,255,0.04)', stroke: PAL.faint, w: 2, r: 8 });
      g.rect(x, y, W, rh, { fill: 'rgba(92,184,255,0.12)', r: 8 });
      cols.forEach((c, i) => {
        const cx = rtl ? x + W - cw * (i + 0.5) : x + cw * (i + 0.5);
        if (i) { const lx = rtl ? x + W - cw * i : x + cw * i; g.line(lx, y + 6, lx, y + rh * (rows + 1) - 6, { color: PAL.faint, w: 1.5 }); }
        g.text(c.head, cx, y + rh / 2, { size: o.headSize || 22, weight: 600, font: RTL.test(c.head) ? 'text' : 'mono', color: PAL.ink });
        c.vals.forEach((v, r) => {
          const k = clamp(upto - r, 0, 1); if (k <= 0 || v == null || v === '') return;
          g.text(v, cx, y + rh * (r + 1.5), { size: o.size || 22, font: RTL.test(String(v)) ? 'text' : 'mono', color: (o.hiRow === r) ? PAL.yellow : PAL.ink, alpha: k });
        });
      });
    };

    /* ----- science apparatus ----- */
    g.spring = (x1, y1, x2, y2, o = {}) => {
      const n = o.coils || 10, amp = o.amp || 18, lead = o.lead == null ? 14 : o.lead;
      const L = Math.hypot(x2 - x1, y2 - y1); if (L < 1) return;
      const ux = (x2 - x1) / L, uy = (y2 - y1) / L, px = -uy, py = ux;
      ctx.save(); ctx.strokeStyle = o.color || PAL.metal; ctx.lineWidth = o.w || 4; ctx.lineJoin = 'round'; ctx.lineCap = 'round';
      ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x1 + ux * lead, y1 + uy * lead);
      const body = L - 2 * lead, steps = n * 2;
      for (let i = 1; i < steps; i++) { const s = lead + body * i / steps, side = (i % 2 ? 1 : -1) * amp; ctx.lineTo(x1 + ux * s + px * side, y1 + uy * s + py * side); }
      ctx.lineTo(x2 - ux * lead, y2 - uy * lead); ctx.lineTo(x2, y2); ctx.stroke(); ctx.restore();
    };
    g.resistor = (x1, y1, x2, y2, o = {}) => g.spring(x1, y1, x2, y2, { coils: o.zig || 6, amp: o.amp || 14, lead: o.lead == null ? 18 : o.lead, color: o.color || PAL.ink, w: o.w || 4 });
    /* cell drawn horizontally at (x,y). Long plate (+) on the left unless o.flip. */
    g.battery = (x, y, o = {}) => {
      const c = o.color || PAL.ink, gap = o.gap || 16, hl = o.long || 50, hs = o.short || 26;
      const s = o.flip ? 1 : -1, xl = x + s * gap / 2, xs = x - s * gap / 2;
      g.line(xl, y - hl / 2, xl, y + hl / 2, { color: c, w: 4 });
      g.line(xs, y - hs / 2, xs, y + hs / 2, { color: c, w: 8, cap: 'butt' });
      if (o.signs !== false) { g.text('+', xl + s * 18, y - hl / 2 + 2, { size: 26, color: c }); g.text('−', xs - s * 18, y - hl / 2 + 2, { size: 26, color: c }); }
      if (o.label) g.text(o.label, x, y + hl / 2 + 24, { size: 26, color: o.labelColor || PAL.dim, font: 'math', italic: true });
    };
    g.meter = (x, y, letter, o = {}) => {
      const r = o.r || 34, c = o.color || PAL.ink;
      g.circle(x, y, r, { fill: PAL.bg2, stroke: c, w: 4 });
      g.text(letter, x, y + 2, { size: r * 1.05, weight: 600, font: 'math', color: c });
      if (o.reading != null) g.label(o.reading, x + (o.rx || 0), y + (o.ry == null ? r + 30 : o.ry), { size: 24, font: 'mono', color: PAL.yellow, border: PAL.faint });
    };
    /* polyline wire; o.flow = phase in px draws moving charge dots along it */
    g.wire = (pts, o = {}) => {
      g.poly(pts, { color: o.color || PAL.ink, w: o.w || 4 });
      if (o.flow == null || o.flow === false) return;
      const sp = o.spacing || 46, lens = [];
      let total = 0;
      for (let i = 1; i < pts.length; i++) { const l = Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]); lens.push(l); total += l; }
      for (let d = ((o.flow % sp) + sp) % sp; d < total; d += sp) {
        let k = 0, acc = 0;
        while (k < lens.length - 1 && acc + lens[k] < d) { acc += lens[k]; k++; }
        const f = lens[k] ? (d - acc) / lens[k] : 0;
        g.circle(lerp(pts[k][0], pts[k + 1][0], f), lerp(pts[k][1], pts[k + 1][1], f), o.dotR || 5, { fill: o.dotColor || PAL.yellow });
      }
    };
    /* ruler: x,y top-left, len px, o.cm px per cm; o.vertical draws downward from (x,y) */
    g.ruler = (x, y, len, o = {}) => {
      const cm = o.cm || 40, th = o.h || 44, start = o.start || 0;
      if (o.vertical) {
        g.rect(x, y, th, len, { fill: PAL.ruler, r: 3 });
        const n = Math.floor(len / (cm / 10));
        for (let i = 0; i <= n; i++) {
          const yy = y + i * cm / 10, l = i % 10 === 0 ? th * 0.5 : i % 5 === 0 ? th * 0.34 : th * 0.2;
          if (cm >= 24 || i % 5 === 0) g.line(x, yy, x + l, yy, { color: PAL.rulerInk, w: i % 10 === 0 ? 2 : 1.2 });
          if (i % 10 === 0) g.text(start + i / 10, x + th * 0.76, yy, { size: 16, font: 'mono', color: PAL.rulerInk });
        }
        return;
      }
      g.rect(x, y, len, th, { fill: PAL.ruler, r: 3 });
      const n = Math.floor(len / (cm / 10));
      for (let i = 0; i <= n; i++) {
        const xx = x + i * cm / 10, l = i % 10 === 0 ? th * 0.5 : i % 5 === 0 ? th * 0.34 : th * 0.2;
        if (cm >= 24 || i % 5 === 0) g.line(xx, y, xx, y + l, { color: PAL.rulerInk, w: i % 10 === 0 ? 2 : 1.2 });
        if (i % 10 === 0) g.text(start + i / 10, xx, y + th * 0.75, { size: 16, font: 'mono', color: PAL.rulerInk });
      }
    };
    /* lab stand: base centred at x on floor y, rod height h, arm length o.arm (+ right / - left). Returns the hook point. */
    g.stand = (x, y, h, o = {}) => {
      const arm = o.arm == null ? 170 : o.arm, ay = y - h + 34;
      g.rect(x - 95, y - 18, 190, 18, { fill: PAL.metalDark, r: 4 });
      g.rect(x - 7, y - h, 14, h - 16, { fill: PAL.metal, r: 3 });
      g.rect(Math.min(x, x + arm), ay - 6, Math.abs(arm), 12, { fill: PAL.metal, r: 3 });
      g.rect(x - 17, ay - 17, 34, 34, { fill: PAL.metalDark, r: 5 });
      const hx = x + arm - Math.sign(arm) * 14;
      g.line(hx, ay + 6, hx, ay + 22, { color: PAL.metal, w: 4 });
      return { x: hx, y: ay + 22 };
    };
    /* hanging mass with hook at (x, yTop); returns the bottom y */
    g.mass = (x, yTop, o = {}) => {
      const w = o.w || 70, h = o.h || 54;
      g.circle(x, yTop + 6, 7, { stroke: PAL.metal, w: 3 });
      g.line(x, yTop + 12, x, yTop + 22, { color: PAL.metal, w: 4 });
      g.rect(x - w / 2, yTop + 22, w, h, { fill: o.fill || '#7f8d98', stroke: '#c5d0d8', w: 2, r: 6 });
      if (o.label) g.text(o.label, x, yTop + 22 + h / 2 + 1, { size: o.size || 22, weight: 600, color: '#0e1821', font: o.font || 'mono' });
      return yTop + 22 + h;
    };
    /* compass seen from above; deg = needle direction, clockwise from screen-up */
    g.compass = (x, y, r, deg, o = {}) => {
      g.circle(x, y, r, { fill: '#162633', stroke: PAL.metal, w: 5 });
      for (let a = 0; a < 360; a += 10) {
        const rad = a * Math.PI / 180, l = a % 30 === 0 ? 0.16 : 0.08;
        g.line(x + Math.sin(rad) * r * (0.92 - l), y - Math.cos(rad) * r * (0.92 - l), x + Math.sin(rad) * r * 0.92, y - Math.cos(rad) * r * 0.92, { color: PAL.dim, w: a % 30 === 0 ? 2.5 : 1.5 });
      }
      if (o.north !== false) g.text(o.northLabel || 'N', x, y - r * 0.62, { size: r * 0.2, color: PAL.dim, font: 'mono', weight: 600 });
      g.at(x, y, deg * Math.PI / 180, () => {
        const L = r * 0.78, wd = r * 0.1;
        g.poly([[0, -L], [wd, 0], [-wd, 0]], { close: true, fill: PAL.red, color: 'none' });
        g.poly([[0, L], [wd, 0], [-wd, 0]], { close: true, fill: '#dfe7ee', color: 'none' });
      });
      g.circle(x, y, r * 0.06, { fill: PAL.ink });
    };
    /* stopwatch face: seconds s, centre (x,y), radius r */
    g.stopwatch = (x, y, r, s, o = {}) => {
      g.rect(x - r * 0.18, y - r * 1.28, r * 0.36, r * 0.22, { fill: PAL.metal, r: 4 });
      g.circle(x, y, r, { fill: PAL.bg2, stroke: o.color || PAL.metal, w: 6 });
      for (let i = 0; i < 60; i += 5) { const a = i / 60 * Math.PI * 2; g.line(x + Math.sin(a) * r * 0.78, y - Math.cos(a) * r * 0.78, x + Math.sin(a) * r * 0.9, y - Math.cos(a) * r * 0.9, { color: PAL.dim, w: i % 15 === 0 ? 3 : 1.5 }); }
      const a = (s % 60) / 60 * Math.PI * 2;
      g.line(x, y, x + Math.sin(a) * r * 0.82, y - Math.cos(a) * r * 0.82, { color: o.hand || PAL.orange, w: 4 });
      g.circle(x, y, 6, { fill: o.hand || PAL.orange });
      if (o.digits !== false) g.label((o.fmt ? o.fmt(s) : s.toFixed(2) + ' s'), x, y + r + 34, { size: 26, font: 'mono', color: PAL.yellow, border: PAL.faint });
    };
    /* opening card. Fully visible at t = 0, so the paused first frame works as a poster. */
    g.title = (kicker, title, sub, t, o = {}) => {
      const y = o.y || 380, x = o.x || VW / 2, drift = Math.sin(t * 0.8) * 3;
      if (kicker) g.text(kicker, x, y - 120, { size: 30, weight: 600, color: o.kickerColor || PAL.orange, align: o.align });
      g.text(title, x, y + drift, { size: o.size || 104, weight: 700, align: o.align, maxW: o.maxW || 1460 });
      if (sub) g.text(sub, x, y + 108, { size: 34, color: PAL.dim, maxW: o.subW || 1300, align: o.align });
    };
    return g;
  }

  /* ---------- timeline ---------- */
  /* Splits each scene into caption segments and stretches a segment when its narration clip is longer.
     Clip key = "<scene id or index>-<caption index>". nar.dur[key] = seconds (file <key>.mp3) or [file, seconds]. */
  function timeline(scenes, nar, pad) {
    let acc = 0; const issues = [];
    scenes.forEach((s, si) => {
      s.cap = s.cap || [];
      s.key = s.id != null ? String(s.id) : String(si);
      s.cap.forEach((c, i) => {
        if (!(c[0] >= 0 && c[0] < s.dur)) issues.push(`scene ${s.key}: caption ${i} starts at ${c[0]} s, outside the scene (dur ${s.dur} s)`);
        if (i && c[0] <= s.cap[i - 1][0]) issues.push(`scene ${s.key}: caption ${i} does not start after caption ${i - 1}`);
      });
      const cuts = [...new Set([0, ...s.cap.map(c => c[0]).filter(x => x > 0 && x < s.dur), s.dur])].sort((a, b) => a - b);
      s.segs = []; let n0 = 0;
      for (let k = 0; k + 1 < cuts.length; k++) {
        const a = cuts[k], b = cuts[k + 1];
        let ci = -1; s.cap.forEach((c, i) => { if (c[0] <= a + 1e-6) ci = i; });
        const starts = ci >= 0 && Math.abs(s.cap[ci][0] - a) < 1e-6;
        const key = s.key + '-' + ci;
        let ad = 0, file = null;
        if (nar && nar.dur && starts) {
          const v = nar.dur[key];
          if (Array.isArray(v)) { file = v[0]; ad = +v[1]; } else if (v) { file = key; ad = +v; }
        }
        const nl = Math.max(b - a, ad ? ad + pad : 0);
        s.segs.push({ a, b, ci, key: ad ? key : null, file, ad, n0, nl });
        n0 += nl;
      }
      s.ndur = n0; s.start = acc; acc += n0; s.end = acc;
    });
    return { total: acc, issues };
  }

  /* ---------- film player ---------- */
  const ICON = {
    play: '<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M7 4.5v15l13-7.5z"/></svg>',
    pause: '<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M6 4h4.5v16H6zM13.5 4H18v16h-4.5z"/></svg>',
    replay: '<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M12 5V1.5L7 6l5 4.5V7a5 5 0 1 1-5 5H5a7 7 0 1 0 7-7z"/></svg>',
    full: '<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="none" stroke="currentColor" stroke-width="2" d="M4 9V4h5M15 4h5v5M20 15v5h-5M9 20H4v-5"/></svg>',
    voice: '<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M4 9h4l5-4v14l-5-4H4z"/><path fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" d="M16 9a4 4 0 0 1 0 6M18.5 6.5a7.5 7.5 0 0 1 0 11"/></svg>'
  };

  function mount(el, cfg) {
    const scenes = cfg.scenes, lang = cfg.lang || 'en', dir = RTL_LANGS.test(lang) ? 'rtl' : 'ltr', T = ui(lang, cfg.ui);
    const nar = cfg.narration && cfg.narration.dur && Object.keys(cfg.narration.dur).length ? cfg.narration : null;
    const PAD = cfg.pad == null ? 0.5 : cfg.pad;
    if (cfg.palette) Object.assign(PAL, cfg.palette);
    const tl = timeline(scenes, nar, PAD), total = tl.total;
    tl.issues.forEach(m => console.warn('[film]', m));
    const capOf = (s, ci) => (ci >= 0 ? s.cap[ci][1] : '');

    el.classList.add('film');
    el.setAttribute('tabindex', '-1');
    el.setAttribute('dir', dir);
    el.innerHTML =
      '<div class="film-screen">' +
        `<canvas class="film-canvas" role="img" aria-label="${esc(cfg.label || T.film)}"></canvas>` +
        `<button class="film-big" type="button" aria-label="${esc(T.bigPlay)}">${ICON.play}</button>` +
      '</div>' +
      '<div class="film-cap" aria-live="polite"></div>' +
      '<div class="film-bar">' +
        `<button class="film-btn film-play" type="button" aria-label="${esc(T.play)}">${ICON.play}</button>` +
        `<span class="film-time">0:00 / ${fmtTime(total)}</span>` +
        `<div class="film-track"><input type="range" class="film-seek" min="0" max="${total}" step="0.05" value="0" aria-label="${esc(T.seek)}"><div class="film-ticks">${scenes.slice(1).map(s => `<i style="left:${(s.start / total * 100).toFixed(3)}%"></i>`).join('')}</div></div>` +
        `<select class="film-speed" aria-label="${esc(T.speed)}"><option value="0.75">0.75×</option><option value="1" selected>1×</option><option value="1.25">1.25×</option><option value="1.5">1.5×</option></select>` +
        `<button class="film-btn film-voice" type="button" aria-pressed="${nar ? 'true' : 'false'}" title="${esc(T.voiceTitle)}"${nar ? '' : ' hidden'}>${ICON.voice}<span class="film-voice-t">${esc(T.voice)}</span></button>` +
        `<button class="film-btn film-full" type="button" aria-label="${esc(T.full)}">${ICON.full}</button>` +
      '</div>' +
      `<ol class="film-chapters">${scenes.map((s, i) => `<li><button type="button" data-i="${i}"><span class="n">${i + 1}</span><span class="t">${esc(s.title)}</span><span class="d">${fmtTime(s.ndur)}</span></button></li>`).join('')}</ol>`;

    const $ = sel => el.querySelector(sel);
    const canvas = $('.film-canvas'), ctx = canvas.getContext('2d'), g = makeG(ctx);
    g.gridOn = cfg.grid !== false;
    const capEl = $('.film-cap'), seek = $('.film-seek'), timeEl = $('.film-time'), playBtn = $('.film-play'), big = $('.film-big');
    const voiceBtn = $('.film-voice'), speedSel = $('.film-speed'), chapLis = [...el.querySelectorAll('.film-chapters li')];
    let t = 0, playing = false, last = 0, speed = 1, scale = 1, raf = 0, curKey = '', curChap = -1;
    let narrOn = !!nar, cur = null;
    const player = nar ? new Audio() : null, warm = {};
    const src = seg => nar.base + (seg.file || seg.key) + '.mp3';
    if (player) {
      player.preload = 'auto';
      player.addEventListener('loadedmetadata', () => { if (cur && cur.off > 0.05) { try { player.currentTime = cur.off; } catch (e) { /* keep start */ } } });
      player.addEventListener('playing', () => { if (cur && cur.state === 'wait') cur.state = 'play'; });
      player.addEventListener('ended', () => { if (cur) cur.state = 'done'; });
      player.addEventListener('error', () => { if (cur) cur.state = 'fail'; });
    }

    /* film time -> scene, segment and the scene's own (unstretched) local time */
    function locate(tt) {
      let si = scenes.length - 1;
      for (let i = 0; i < scenes.length; i++) if (tt < scenes[i].end) { si = i; break; }
      const s = scenes[si], lt = tt - s.start;
      let sg = s.segs[s.segs.length - 1];
      for (const x of s.segs) if (lt < x.n0 + x.nl) { sg = x; break; }
      return { si, s, seg: sg, lt: sg.a + clamp((lt - sg.n0) / sg.nl, 0, 1) * (sg.b - sg.a) };
    }

    /* paint the frame at tt into context c with kit gg, film scaled by k and offset by (ox, oy) */
    function paint(c, gg, tt, k, ox, oy) {
      const p = locate(tt), s = p.s;
      c.setTransform(k, 0, 0, k, ox || 0, oy || 0);
      c.globalAlpha = 1;
      gg.k = k; gg.ox = ox || 0; gg.oy = oy || 0;
      gg.bg();
      try { s.draw(gg, p.lt, s); } catch (e) { console.error('[film] scene', s.key, e); }
      c.globalAlpha = 1;
      if (p.si > 0 && cfg.chapterLabel !== false) {
        const lbl = `${p.si + 1}/${scenes.length} · ${s.title}`;
        if (dir === 'rtl') gg.label(lbl, VW - 36, 44, { align: 'right', size: 22, color: PAL.dim, border: 'rgba(255,255,255,0.12)' });
        else gg.label(lbl, 36, 44, { align: 'left', size: 22, color: PAL.dim, border: 'rgba(255,255,255,0.12)' });
      }
      return p;
    }

    function draw() {
      const p = paint(ctx, g, t, scale, 0, 0), i = p.si, s = p.s;
      const ci = p.seg.ci, key = i + ':' + ci;
      if (key !== curKey) { curKey = key; capEl.innerHTML = capOf(s, ci); }
      seek.value = t; seek.style.setProperty('--p', (t / total * 100) + '%');
      timeEl.textContent = fmtTime(t) + ' / ' + fmtTime(total);
      if (i !== curChap) { curChap = i; chapLis.forEach((li, k) => li.classList.toggle('on', k === i)); }
    }

    function stopAudio() { if (player) player.pause(); cur = null; }
    const allSegs = []; scenes.forEach(s => s.segs.forEach(x => { if (x.key) allSegs.push(x); }));
    function warmUp(sg) { if (!sg || warm[sg.key]) return; const a = new Audio(); a.preload = 'auto'; a.src = src(sg); warm[sg.key] = a; }
    /* start the clip of the current segment (also called inside click handlers, which unlocks audio on Safari) */
    function syncAudio(now) {
      if (!player || !narrOn || !playing) return;
      const p = locate(t), sg = p.seg;
      if (!sg.key) { if (cur) stopAudio(); return; }
      if (cur && cur.key === sg.key) return;
      const fstart = p.s.start + sg.n0, off = t - fstart;
      player.pause();
      if (off >= sg.ad - 0.05) { cur = { key: sg.key, state: 'done', fstart }; return; }
      cur = { key: sg.key, state: 'wait', since: now, fstart, off };
      player.src = src(sg);
      player.defaultPlaybackRate = speed; player.playbackRate = speed;
      const pr = player.play();
      if (pr && pr.catch) pr.catch(() => { if (cur && cur.key === sg.key) cur.state = 'fail'; });
      warmUp(allSegs[allSegs.indexOf(sg) + 1]);
    }
    function frame(now) {
      if (!playing) return;
      const dt = Math.min(0.1, (now - last) / 1000) * speed; last = now;
      syncAudio(now);
      if (cur && cur.state === 'wait') { if (now - cur.since > 3000) cur.state = 'fail'; }
      else if (cur && cur.state === 'play' && !player.paused) t = Math.min(total, Math.max(t, cur.fstart + player.currentTime));
      else t = Math.min(t + dt, total);
      draw();
      if (t >= total) { setPlaying(false); playBtn.innerHTML = ICON.replay; playBtn.setAttribute('aria-label', T.replay); }
      else raf = requestAnimationFrame(frame);
    }
    function setPlaying(v) {
      playing = v;
      playBtn.innerHTML = v ? ICON.pause : ICON.play;
      playBtn.setAttribute('aria-label', v ? T.pause : T.play);
      big.hidden = v || t > 0.01;
      if (v) {
        if (t >= total - 0.01) t = 0;
        last = performance.now(); cancelAnimationFrame(raf);
        syncAudio(last);
        raf = requestAnimationFrame(frame);
      } else { cancelAnimationFrame(raf); stopAudio(); }
    }
    const toggle = () => setPlaying(!playing);
    function seekTo(v) {
      t = clamp(v, 0, total); stopAudio();
      big.hidden = playing || t > 0.01;
      if (!playing && t < total) { playBtn.innerHTML = ICON.play; playBtn.setAttribute('aria-label', T.play); }
      draw();
      if (playing) syncAudio(performance.now());
    }

    playBtn.addEventListener('click', toggle);
    big.addEventListener('click', () => setPlaying(true));
    canvas.addEventListener('click', toggle);
    seek.addEventListener('input', () => seekTo(+seek.value));
    speedSel.addEventListener('change', () => { speed = +speedSel.value; if (player) { player.defaultPlaybackRate = speed; player.playbackRate = speed; } });
    el.querySelectorAll('.film-chapters button').forEach(b => b.addEventListener('click', () => { seekTo(scenes[+b.dataset.i].start + 0.001); setPlaying(true); }));
    $('.film-full').addEventListener('click', () => {
      try {
        if (document.fullscreenElement) document.exitFullscreen();
        else if (el.requestFullscreen) { const p = el.requestFullscreen(); if (p && p.catch) p.catch(() => {}); }
      } catch (e) { /* fullscreen is optional */ }
    });
    el.addEventListener('keydown', e => {
      const tag = (e.target.tagName || '').toLowerCase();
      if (tag === 'select' || tag === 'input' && e.key !== ' ') return;
      if (e.key === ' ' || e.key === 'k') { if (tag === 'button') return; e.preventDefault(); toggle(); }
      else if (e.key === 'ArrowRight') { e.preventDefault(); seekTo(t + (dir === 'rtl' ? -5 : 5)); }
      else if (e.key === 'ArrowLeft') { e.preventDefault(); seekTo(t + (dir === 'rtl' ? 5 : -5)); }
    });
    voiceBtn.addEventListener('click', () => {
      narrOn = !narrOn; voiceBtn.setAttribute('aria-pressed', String(narrOn));
      if (!narrOn) stopAudio(); else syncAudio(performance.now());
    });

    function resize() {
      const w = canvas.clientWidth || el.clientWidth || 800;
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = Math.max(320, Math.round(w * dpr));
      canvas.height = Math.round(canvas.width * VH / VW);
      scale = canvas.width / VW;
      draw();
    }
    if ('ResizeObserver' in window) new ResizeObserver(resize).observe(canvas); else window.addEventListener('resize', resize);
    resize();
    if (document.fonts) {
      document.fonts.load('600 40px "IBM Plex Sans Hebrew"').then(draw, () => {});
      document.fonts.load('600 40px "IBM Plex Sans"').then(draw, () => {});
      document.fonts.load('500 24px "IBM Plex Mono"').then(draw, () => {});
      document.fonts.ready.then(draw, () => {});
    }

    /* ----- data and offline rendering for the tools ----- */
    function captions() {
      const out = [];
      scenes.forEach((s, si) => {
        let open = null;
        s.segs.forEach(sg => {
          if (sg.ci < 0) return;
          if (!open || open.ci !== sg.ci) {
            if (open) open.end = s.start + sg.n0;
            open = { scene: si, sceneKey: s.key, ci: sg.ci, key: s.key + '-' + sg.ci, start: s.start + sg.n0, end: s.end, html: s.cap[sg.ci][1], text: plain(s.cap[sg.ci][1]), spoken: s.cap[sg.ci][2] || '' };
            out.push(open);
          }
        });
      });
      return out;
    }
    const cues = () => { const out = []; scenes.forEach(s => s.segs.forEach(sg => { if (sg.key) out.push({ t: s.start + sg.n0, key: sg.key, file: (sg.file || sg.key) + '.mp3', dur: sg.ad }); })); return out; };
    /* segments slowed down to fit their narration clip: factor = stretched / written length */
    const stretch = () => { const out = []; scenes.forEach(s => s.segs.forEach(sg => { const f = sg.nl / Math.max(0.001, sg.b - sg.a); if (sg.key) out.push({ key: sg.key, written: +(sg.b - sg.a).toFixed(2), clip: +sg.ad.toFixed(2), factor: +f.toFixed(2) }); })); return out; };
    const gs = new WeakMap();
    function renderFrame(cv, tt, o = {}) {
      const c2 = cv.getContext('2d'), W = cv.width, H = cv.height, mode = o.captions || 'none';
      let g2 = gs.get(cv); if (!g2) { g2 = makeG(c2); g2.gridOn = g.gridOn; gs.set(cv, g2); }
      const band = mode === 'band' ? Math.round(H * 0.16) : 0;
      const k = Math.min(W / VW, (H - band) / VH), fw = VW * k, fh = VH * k, ox = (W - fw) / 2, oy = (H - band - fh) / 2;
      c2.setTransform(1, 0, 0, 1, 0, 0); c2.globalAlpha = 1; c2.fillStyle = PAL.bg; c2.fillRect(0, 0, W, H);
      c2.save(); c2.beginPath(); c2.rect(ox, oy, fw, fh); c2.clip();
      const p = paint(c2, g2, tt, k, ox, oy);
      c2.restore();
      const text = plain(capOf(p.s, p.seg.ci));
      if (mode !== 'none' && text) {
        c2.setTransform(1, 0, 0, 1, 0, 0); g2.k = 1; g2.ox = 0; g2.oy = 0;
        const size = Math.round(H * (mode === 'band' ? 0.034 : 0.032)), lh = size * 1.32;
        const lines = g2.wrap(text, W * (mode === 'band' ? 0.86 : 0.8), { size });
        if (mode === 'band') {
          c2.fillStyle = PAL.bg2; c2.fillRect(0, H - band, W, band);
          const y0 = H - band / 2 - (lines.length - 1) * lh / 2;
          lines.forEach((ln, i) => g2.text(ln, W / 2, y0 + i * lh, { size, color: PAL.ink }));
        } else {
          const bh = lines.length * lh + size * 0.8, bw = Math.max(...lines.map(l => g2.measure(l, { size }))) + size * 1.6;
          g2.rect((W - bw) / 2, H - bh - H * 0.04, bw, bh, { r: 12, fill: 'rgba(8,14,20,0.82)' });
          const y0 = H - H * 0.04 - bh / 2 - (lines.length - 1) * lh / 2;
          lines.forEach((ln, i) => g2.text(ln, W / 2, y0 + i * lh, { size, color: PAL.ink }));
        }
      }
      return p;
    }
    /* layout warnings for one frame: text outside the frame, text overlapping text or another label */
    function inspect(tt) {
      const cv = document.createElement('canvas'); cv.width = VW; cv.height = VH;
      const c2 = cv.getContext('2d'), g2 = makeG(c2); g2.gridOn = g.gridOn; g2.dbg = [];
      const p = paint(c2, g2, tt, 1, 0, 0), B = g2.dbg, out = [];
      const where = `scene ${p.s.key} "${p.s.title}" at ${tt.toFixed(1)} s`;
      const short = s => (s.length > 40 ? s.slice(0, 38) + '...' : s);
      B.forEach(b => { if (b.kind === 'text' && (b.x0 < -2 || b.y0 < -2 || b.x1 > VW + 2 || b.y1 > VH + 2)) out.push(`${where}: text outside the frame: "${short(b.s)}"`); });
      for (let i = 0; i < B.length; i++) for (let j = i + 1; j < B.length; j++) {
        const a = B[i], b = B[j];
        if (a.own && a.own === b.own) continue; // a label's own text inside its own pill
        const w = Math.min(a.x1, b.x1) - Math.max(a.x0, b.x0), h = Math.min(a.y1, b.y1) - Math.max(a.y0, b.y0);
        if (w <= 0 || h <= 0) continue;
        const small = Math.min((a.x1 - a.x0) * (a.y1 - a.y0), (b.x1 - b.x0) * (b.y1 - b.y0));
        if (small > 0 && w * h / small > 0.2) out.push(`${where}: overlapping text: "${short(a.s)}" and "${short(b.s)}"`);
      }
      return out;
    }

    const api = { play: () => setPlaying(true), pause: () => setPlaying(false), seek: seekTo, get time() { return t; }, total, draw,
      narrated: !!nar, scenes, lang, dir, issues: tl.issues, captions, cues, stretch, renderFrame, inspect, locate };
    Film.current = api;
    return api;
  }

  /* ---------- whole page from scenes.js ---------- */
  function page(F) {
    const lang = F.lang || 'en', dir = RTL_LANGS.test(lang) ? 'rtl' : 'ltr', T = ui(lang, F.ui);
    document.documentElement.lang = lang; document.documentElement.dir = dir;
    const app = document.getElementById('app') || document.body;
    app.innerHTML =
      `<header class="fp-head">${F.kicker ? `<p class="fp-kicker">${F.kicker}</p>` : ''}<h1>${F.title || ''}</h1>${F.lede ? `<p class="fp-lede">${F.lede}</p>` : ''}</header>` +
      '<div class="fp-film"></div><p class="fp-note"></p>' +
      (F.transcript === false ? '' : `<details class="fp-transcript"><summary>${esc(T.transcript)}</summary><div class="fp-tr-body"></div></details>`) +
      (F.footer ? `<footer class="fp-foot">${F.footer}</footer>` : '');
    const dur = window.NARRATION;
    const film = mount(app.querySelector('.fp-film'), { scenes: F.scenes, lang, label: F.label || F.title, ui: F.ui, grid: F.grid, palette: F.palette,
      narration: dur && Object.keys(dur).length ? { base: F.audioBase || 'audio/', dur } : null });
    app.querySelector('.fp-note').textContent = film.narrated ? T.note : T.noteSilent;
    const body = app.querySelector('.fp-tr-body');
    if (body) {
      const caps = film.captions();
      body.innerHTML = F.scenes.map((s, si) => {
        const rows = caps.filter(c => c.scene === si);
        return `<section><h3><span class="fp-n">${si + 1}</span> ${esc(s.title)}</h3><ol>${rows.map(c => `<li><button type="button" class="fp-t" data-t="${c.start.toFixed(2)}">${fmtTime(c.start)}</button><span>${c.html}</span></li>`).join('')}</ol></section>`;
      }).join('');
      body.querySelectorAll('.fp-t').forEach(b => b.addEventListener('click', () => { film.seek(+b.dataset.t + 0.01); film.play(); app.querySelector('.fp-film').scrollIntoView({ behavior: 'smooth', block: 'center' }); }));
    }
    return film;
  }

  const Film = { mount, page, makeG, timeline, PAL, FONT, UI, seg, ease, lerp, clamp, plain, fmtTime, VW, VH, RTL, current: null };
  root.Film = Film;
})(typeof window !== 'undefined' ? window : this);
