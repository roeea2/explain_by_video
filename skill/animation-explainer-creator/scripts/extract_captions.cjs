// Pull every caption's spoken line out of scenes.js into work/captions.json, and lint the script.
// usage: node extract_captions.cjs <film folder>
// No browser needed: film.js and scenes.js are evaluated in a sandbox (scenes are data plus draw functions).
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const { filmDir, readJSON } = require('./_common.cjs');

const dir = filmDir(process.argv[2]);
const cfg = readJSON(path.join(dir, 'film.json'), {});
const sandbox = { console, Math, Date, JSON };
sandbox.window = sandbox; sandbox.self = sandbox;
vm.createContext(sandbox);
for (const f of ['film.js', 'scenes.js']) vm.runInContext(fs.readFileSync(path.join(dir, f), 'utf8'), sandbox, { filename: f });
const F = sandbox.FILM;
if (!F || !Array.isArray(F.scenes)) { console.error('scenes.js must set window.FILM = { scenes: [...] }'); process.exit(1); }

const plain = sandbox.Film.plain, rows = [], warn = [], ids = new Set();
const lang = String(F.lang || cfg.lang || 'en').slice(0, 2);
F.scenes.forEach((s, si) => {
  const key = s.id != null ? String(s.id) : String(si);
  if (s.id == null) warn.push(`scene ${si} ("${s.title}") has no id: give it one, so its narration files survive reordering`);
  if (ids.has(key)) warn.push(`scene id "${key}" is used twice`);
  ids.add(key);
  if (!(s.dur > 0)) warn.push(`scene ${key}: dur is missing`);
  (s.cap || []).forEach((c, ci) => {
    const own = typeof c[2] === 'string' && c[2].trim() !== '';
    const text = (own ? c[2] : plain(c[1])).trim();
    rows.push({ key: key + '-' + ci, text, own });
    if (!own) warn.push(`${key}-${ci}: no spoken line, the narrator would read the on-screen caption`);
    if (own && /[0-9]/.test(text) && lang !== 'en') warn.push(`${key}-${ci}: spoken line has digits, write numbers as words: "${text.slice(0, 60)}"`);
    if (own && /[=<>^_{}\\/]|\.\.\./.test(text)) warn.push(`${key}-${ci}: spoken line has symbols, say them in words: "${text.slice(0, 60)}"`);
    if (c[0] >= s.dur) warn.push(`${key}-${ci}: starts at ${c[0]} s, after the scene ends (dur ${s.dur})`);
    if (ci && c[0] <= s.cap[ci - 1][0]) warn.push(`${key}-${ci}: starts before the previous caption`);
    const words = text.split(/\s+/).length, next = ci + 1 < s.cap.length ? s.cap[ci + 1][0] : s.dur, room = next - c[0];
    if (room > 0 && words / room > 3.2) warn.push(`${key}-${ci}: ${words} words in ${room.toFixed(1)} s of animation; the scene will be slowed about x${(words / 2.4 / room).toFixed(1)} to fit the voice`);
  });
});
fs.mkdirSync(path.join(dir, 'work'), { recursive: true });
fs.writeFileSync(path.join(dir, 'work', 'captions.json'), JSON.stringify({ slug: cfg.slug || path.basename(dir), lang: F.lang || cfg.lang || 'en', rows }, null, 1));
console.log(`${rows.length} captions in ${F.scenes.length} scenes -> work/captions.json`);
if (warn.length) console.log('WARNINGS:\n  ' + warn.join('\n  '));
