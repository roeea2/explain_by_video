// Link-preview card (1200x630) for the site: a frame of the demo film beside the title.
// usage: node tools/make_og.cjs
const path = require('path');
const { loadPlaywright, openFilm } = require('../skill/animation-explainer-creator/scripts/_common.cjs');
(async () => {
  const site = path.resolve(__dirname, '..', 'site');
  const { chromium } = loadPlaywright();
  const browser = await chromium.launch();
  const { page } = await openFilm(browser, path.join(site, 'demo'));
  const frame = await page.evaluate(() => {
    const f = window.Film.current, s = f.scenes.find(x => x.key === 'graph'), cv = document.createElement('canvas');
    cv.width = 1600; cv.height = 900; f.renderFrame(cv, s.end - 0.1, { captions: 'none' });
    return cv.toDataURL('image/png');
  });
  const card = await browser.newPage({ viewport: { width: 1200, height: 630 }, deviceScaleFactor: 1 });
  await card.setContent(`<!doctype html><html dir="rtl"><head><link href="https://fonts.googleapis.com/css2?family=IBM+Plex+Sans+Hebrew:wght@500;700&family=IBM+Plex+Sans:wght@600;700&display=swap" rel="stylesheet">
  <style>body{margin:0;width:1200px;height:630px;background:#0e1821;color:#eaf1f6;font-family:"IBM Plex Sans Hebrew",sans-serif;display:grid;grid-template-columns:1fr 640px;align-items:center;gap:36px;padding:0 48px;box-sizing:border-box;
  background-image:linear-gradient(rgba(140,190,210,.07) 1px,transparent 1px),linear-gradient(90deg,rgba(140,190,210,.07) 1px,transparent 1px);background-size:40px 40px}
  .k{color:#ff9d4d;font-weight:500;font-size:24px;margin:0 0 14px}.t{font-size:58px;font-weight:700;line-height:1.05;margin:0}.en{direction:ltr;text-align:right;font-family:"IBM Plex Sans";font-weight:600;color:#93a7b8;font-size:24px;margin:18px 0 0}
  img{width:640px;border-radius:14px;box-shadow:0 20px 50px rgba(0,0,0,.5);border:1px solid rgba(255,255,255,.12)}</style></head>
  <body><div><p class="k">סקיל ל-Claude Code</p><p class="t">סרטוני הסבר מונפשים, מצוירים בקוד, עם קריינות</p><p class="en">Animation Explainer Creator</p></div><img src="${frame}"></body></html>`, { waitUntil: 'networkidle' });
  await card.evaluate(() => document.fonts.ready);
  await card.screenshot({ path: path.join(site, 'og.jpg'), type: 'jpeg', quality: 86 });
  await browser.close();
  console.log('site/og.jpg');
})();
