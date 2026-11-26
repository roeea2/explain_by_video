// Shared helpers for the Node tools: find Playwright, load a film folder, small file utilities.
const fs = require('fs');
const path = require('path');
const os = require('os');

/* Playwright: a normal require first, then copies that npx or a previous install left on this machine. */
function loadPlaywright() {
  const tries = [() => require('playwright'), () => require('playwright-core')];
  const roots = [path.join(__dirname, '..', '.tools', 'node_modules')];
  try {
    const npx = path.join(os.homedir(), '.npm', '_npx');
    for (const d of fs.readdirSync(npx)) roots.push(path.join(npx, d, 'node_modules'));
  } catch (e) { /* no npx cache */ }
  for (const r of roots) { tries.push(() => require(path.join(r, 'playwright'))); tries.push(() => require(path.join(r, 'playwright-core'))); }
  for (const t of tries) { try { const m = t(); if (m && m.chromium) return m; } catch (e) { /* next */ } }
  console.error('Playwright was not found. Install it once, inside the skill folder:\n' +
    `  npm install --prefix "${path.join(__dirname, '..', '.tools')}" playwright && npx --prefix "${path.join(__dirname, '..', '.tools')}" playwright install chromium`);
  process.exit(2);
}

function filmDir(arg) {
  const dir = path.resolve(arg || '.');
  if (!fs.existsSync(path.join(dir, 'scenes.js')) || !fs.existsSync(path.join(dir, 'index.html'))) {
    console.error(`${dir} is not a film folder (needs index.html and scenes.js). Create one with scripts/new_film.py.`);
    process.exit(2);
  }
  return dir;
}

function readJSON(f, dflt) { try { return JSON.parse(fs.readFileSync(f, 'utf8')); } catch (e) { return dflt; } }

function fileUrl(f) { return 'file://' + path.resolve(f).split(path.sep).map(encodeURIComponent).join('/'); }

/* open the film page headless and wait until the player and fonts are ready */
async function openFilm(browser, dir, opts = {}) {
  const page = await browser.newPage(Object.assign({ viewport: { width: 1280, height: 900 }, deviceScaleFactor: 1 }, opts));
  const problems = [];
  page.on('console', m => { if (m.type() === 'error') problems.push('console: ' + m.text()); if (m.type() === 'warning' && m.text().startsWith('[film]')) problems.push(m.text()); });
  page.on('pageerror', e => problems.push('pageerror: ' + e.message));
  await page.goto(fileUrl(path.join(dir, 'index.html')), { waitUntil: 'load' });
  await page.waitForFunction(() => window.Film && window.Film.current, null, { timeout: 15000 }).catch(() => {});
  await page.evaluate(() => (document.fonts ? document.fonts.ready : null)).catch(() => {});
  await page.waitForTimeout(300);
  return { page, problems };
}

module.exports = { loadPlaywright, filmDir, readJSON, fileUrl, openFilm };
