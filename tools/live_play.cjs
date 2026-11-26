// Press play on the live landing page and confirm the film advances with the narration playing.
const { loadPlaywright } = require('../skill/animation-explainer-creator/scripts/_common.cjs');
(async () => {
  const { chromium } = loadPlaywright(), b = await chromium.launch({ args: ['--autoplay-policy=no-user-gesture-required'] });
  const p = await b.newPage(), errs = [];
  p.on('pageerror', e => errs.push(e.message));
  await p.goto('https://animation-explainer-creator.vercel.app/', { waitUntil: 'networkidle' });
  await p.click('.film-big');
  await p.waitForTimeout(4000);
  const r = await p.evaluate(() => { const a = [...document.querySelectorAll('audio')]; return { t: Film.current.time.toFixed(2), narrated: Film.current.narrated, cap: document.querySelector('.film-cap').textContent.slice(0, 40) }; });
  console.log(JSON.stringify(r), errs.length ? 'errors: ' + errs.join('; ') : 'no errors');
  await b.close();
})();
