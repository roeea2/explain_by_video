// Screenshot the landing page on desktop (light) and phone (dark); report errors and overflow.
const path = require('path');
const { loadPlaywright, fileUrl } = require('../skill/animation-explainer-creator/scripts/_common.cjs');
(async () => {
  const site = path.resolve(__dirname, '..', 'site'), out = path.resolve(__dirname, '..', 'checks');
  require('fs').mkdirSync(out, { recursive: true });
  const { chromium } = loadPlaywright(), b = await chromium.launch(), bad = [];
  for (const v of [{ w: 1280, h: 900, s: 'light', n: 'desktop' }, { w: 390, h: 844, s: 'dark', n: 'phone' }]) {
    const p = await b.newPage({ viewport: { width: v.w, height: v.h }, colorScheme: v.s, deviceScaleFactor: 1 });
    p.on('console', m => { if (m.type() === 'error') bad.push(`[${v.n}] ${m.text()}`); });
    p.on('pageerror', e => bad.push(`[${v.n}] ${e.message}`));
    await p.goto(fileUrl(path.join(site, 'index.html')), { waitUntil: 'load' }); await p.waitForTimeout(800);
    const ov = await p.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    if (ov > 1) bad.push(`[${v.n}] overflow ${ov}px`);
    await p.screenshot({ path: path.join(out, `landing-${v.n}.png`), fullPage: true });
  }
  await b.close();
  console.log(bad.length ? 'PROBLEMS:\n' + bad.join('\n') : 'landing OK: no errors, no overflow');
})();
