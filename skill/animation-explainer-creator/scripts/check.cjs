// Check a film: page errors, draw errors, layout (text outside the frame, overlapping text), missing audio,
// scenes slowed down too much by the narration, phone layout. With --frames it also renders the settled end
// of every caption to work/frames/ plus contact sheets (sheet-1.png, ...) to look at.
// usage: node check.cjs <film folder> [--frames] [--quiet]
const fs = require('fs');
const path = require('path');
const { loadPlaywright, filmDir, openFilm } = require('./_common.cjs');

(async () => {
  const dir = filmDir(process.argv[2]);
  const frames = process.argv.includes('--frames');
  const { chromium } = loadPlaywright();
  const browser = await chromium.launch();
  const out = path.join(dir, 'work', 'check');
  fs.mkdirSync(out, { recursive: true });
  const problems = [], notes = [];

  // ---- desktop: the film itself ----
  const desk = await openFilm(browser, dir, { viewport: { width: 1280, height: 900 }, colorScheme: 'light' });
  const page = desk.page;
  const info = await page.evaluate(() => {
    const f = window.Film && window.Film.current;
    if (!f) return null;
    return { total: f.total, scenes: f.scenes.map(s => ({ key: s.key, title: s.title, start: s.start, ndur: s.ndur, segs: s.segs.map(x => ({ n0: x.n0, nl: x.nl, ci: x.ci })) })),
      cues: f.cues(), stretch: f.stretch(), issues: f.issues, narrated: f.narrated, overflow: document.documentElement.scrollWidth - document.documentElement.clientWidth };
  });
  if (!info) { console.log('PROBLEMS:\n  the player did not start (see errors below)\n  ' + desk.problems.join('\n  ')); await browser.close(); process.exit(1); }
  console.log(`${path.basename(dir)}: ${info.scenes.length} scenes, ${Math.floor(info.total / 60)}:${String(Math.round(info.total % 60)).padStart(2, '0')} min, ${info.cues.length} narration clips${info.narrated ? '' : ' (no narration yet)'}`);

  // step through the whole film; draw errors surface as console errors
  await page.evaluate(() => { const f = window.Film.current; for (let t = 0; t <= f.total; t += 0.25) f.seek(t); f.seek(0); });

  // layout at the settled end and the middle of every caption segment
  const times = [];
  info.scenes.forEach(s => s.segs.forEach(sg => { times.push(s.start + sg.n0 + sg.nl * 0.5); times.push(s.start + sg.n0 + Math.max(0, sg.nl - 0.08)); }));
  const layout = await page.evaluate(ts => { const f = window.Film.current, all = new Set(); ts.forEach(t => f.inspect(t).forEach(m => all.add(m))); return [...all]; }, times);
  // report each distinct problem once (the same overlap shows up in several frames)
  const seen = new Set();
  layout.forEach(m => { const k = m.replace(/ at [\d.]+ s/, ''); if (!seen.has(k)) { seen.add(k); problems.push('layout: ' + m); } });

  // audio files present?
  info.cues.forEach(c => { if (!fs.existsSync(path.join(dir, 'audio', c.file))) problems.push(`missing audio file audio/${c.file} (${c.key})`); });
  // segments slowed down a lot to fit their voice clip, with caption times that would fit every clip
  info.stretch.filter(s => s.factor > 1.3).forEach(s => notes.push(`${s.key}: animation slowed x${s.factor} to fit its ${s.clip} s clip (written ${s.written} s)`));
  const retime = await page.evaluate(() => window.Film.current.scenes.map(s => {
    const c = s.cap.map(x => x[0]), clip = i => { const sg = s.segs.find(x => x.ci === i && x.key); return sg ? sg.ad + 0.5 : 0; };
    if (!c.length) return null;
    const out = [c[0]]; let changed = false;
    for (let i = 0; i < c.length; i++) {
      const room = (i + 1 < c.length ? c[i + 1] : s.dur) - c[i], need = Math.max(room, clip(i));
      if (need - room > 0.3) changed = true;
      out.push(+(out[out.length - 1] + need).toFixed(1));
    }
    return changed ? { key: s.key, cap: out.slice(0, -1), dur: out[out.length - 1] } : null;
  }).filter(Boolean));
  retime.forEach(r => notes.push(`retime scene ${r.key}: caption times [${r.cap.join(', ')}], dur ${r.dur} (keep the draw() timings tied to s.cap[i][0], then nothing is slowed)`));
  if (info.overflow > 1) problems.push(`desktop page overflows horizontally by ${info.overflow}px`);
  await page.screenshot({ path: path.join(out, 'page-desktop.png'), fullPage: true });

  // ---- frames for review ----
  if (frames) {
    const fdir = path.join(dir, 'work', 'frames');
    fs.rmSync(fdir, { recursive: true, force: true }); fs.mkdirSync(fdir, { recursive: true });
    const shots = [];
    info.scenes.forEach((s, si) => s.segs.forEach((sg, k) => shots.push({ t: s.start + sg.n0 + Math.max(0, sg.nl - 0.08), name: `${String(si + 1).padStart(2, '0')}-${s.key}-${sg.ci < 0 ? 'x' + k : sg.ci}` })));
    const data = await page.evaluate(list => {
      const f = window.Film.current, cv = document.createElement('canvas'); cv.width = 1600; cv.height = 900;
      return list.map(x => { f.renderFrame(cv, x.t, { captions: 'none' }); return cv.toDataURL('image/png').split(',')[1]; });
    }, shots);
    shots.forEach((x, i) => fs.writeFileSync(path.join(fdir, x.name + '.png'), Buffer.from(data[i], 'base64')));
    // contact sheets: 3 x 4 frames, 1600 px wide, with labels
    const sheets = await page.evaluate(list => {
      const f = window.Film.current, per = 12, cols = 3, tw = 528, th = 297, pad = 8, lab = 26, out = [];
      const cv = document.createElement('canvas'); cv.width = 1600; cv.height = 900;
      for (let p = 0; p < list.length; p += per) {
        const part = list.slice(p, p + per), rows = Math.ceil(part.length / cols);
        const sh = document.createElement('canvas'); sh.width = cols * (tw + pad) + pad; sh.height = rows * (th + lab + pad) + pad;
        const c = sh.getContext('2d'); c.fillStyle = '#05090d'; c.fillRect(0, 0, sh.width, sh.height);
        part.forEach((x, i) => {
          f.renderFrame(cv, x.t, { captions: 'none' });
          const cx = pad + (i % cols) * (tw + pad), cy = pad + Math.floor(i / cols) * (th + lab + pad);
          c.drawImage(cv, cx, cy + lab, tw, th);
          c.fillStyle = '#ffd25e'; c.font = '600 18px ui-monospace, Menlo, monospace'; c.textBaseline = 'middle'; c.fillText(x.name + '  @' + x.t.toFixed(1) + 's', cx + 2, cy + lab / 2);
        });
        out.push(sh.toDataURL('image/png').split(',')[1]);
      }
      return out;
    }, shots);
    sheets.forEach((b, i) => fs.writeFileSync(path.join(fdir, `sheet-${i + 1}.png`), Buffer.from(b, 'base64')));
    console.log(`frames: ${shots.length} in work/frames/, contact sheets: ${sheets.map((_, i) => `work/frames/sheet-${i + 1}.png`).join(', ')}`);
  }
  desk.problems.forEach(p => problems.push('[desktop] ' + p));
  await page.close();

  // ---- phone, dark theme: page layout only ----
  const phone = await openFilm(browser, dir, { viewport: { width: 390, height: 844 }, colorScheme: 'dark', deviceScaleFactor: 2 });
  const ov = await phone.page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  if (ov > 1) problems.push(`phone page overflows horizontally by ${ov}px`);
  await phone.page.screenshot({ path: path.join(out, 'page-phone.png'), fullPage: true });
  phone.problems.forEach(p => problems.push('[phone] ' + p));
  await browser.close();

  const uniq = [...new Set(problems)];
  if (notes.length) console.log('NOTES:\n  ' + notes.join('\n  '));
  if (uniq.length) { console.log('PROBLEMS:\n  ' + uniq.join('\n  ')); process.exitCode = 1; }
  else console.log('OK: no errors, no layout problems, no overflow. Page screenshots in work/check/.');
})();
