// Build the skill zip (one top folder) from skill/animation-explainer-creator.
// Vercel runs this on every deploy (site/vercel.json), so the zip always matches the skill in the repo.
// No dependencies: a plain deflate zip written with node:zlib.
// usage: node tools/build_zip.cjs                  -> site/animation-explainer-creator.zip (local preview)
//        node tools/build_zip.cjs --publish dist   -> copy site/ to site/dist (without vercel.json) plus the zip
const fs = require('fs'), path = require('path'), zlib = require('zlib');

const NAME = 'animation-explainer-creator';
const ROOT = path.resolve(__dirname, '..');
const SITE = path.join(ROOT, 'site');
const SRC = path.join(ROOT, 'skill', NAME);
const pub = process.argv.indexOf('--publish');
const OUTDIR = pub > 0 ? path.join(SITE, process.argv[pub + 1] || 'dist') : SITE;
if (OUTDIR !== SITE) {
  fs.rmSync(OUTDIR, { recursive: true, force: true });
  const skip = new Set(['vercel.json', path.basename(OUTDIR), NAME + '.zip', '.vercel', 'work']);
  fs.mkdirSync(OUTDIR, { recursive: true });
  for (const e of fs.readdirSync(SITE)) {   // entry by entry: OUTDIR sits inside SITE
    if (skip.has(e)) continue;
    fs.cpSync(path.join(SITE, e), path.join(OUTDIR, e), { recursive: true, filter: s => !skip.has(path.basename(s)) });
  }
}
const OUT = path.join(OUTDIR, NAME + '.zip');
const SKIP = new Set(['.tools', '__pycache__', 'node_modules', '.DS_Store', '.git']);

const crcTable = Array.from({ length: 256 }, (_, n) => { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; return c >>> 0; });
const crc32 = zlib.crc32 || (buf => { let c = 0xffffffff; for (const b of buf) c = crcTable[(c ^ b) & 0xff] ^ (c >>> 8); return (c ^ 0xffffffff) >>> 0; });

function walk(dir, rel) {
  const out = [];
  for (const e of fs.readdirSync(dir, { withFileTypes: true }).sort((a, b) => (a.name < b.name ? -1 : 1))) {
    if (SKIP.has(e.name)) continue;
    const p = path.join(dir, e.name), q = rel + '/' + e.name;
    if (e.isDirectory()) out.push(...walk(p, q));
    else if (e.isFile()) out.push([p, q]);
  }
  return out;
}

if (!fs.existsSync(path.join(SRC, 'SKILL.md'))) { console.error('build_zip: no skill at ' + SRC); process.exit(1); }
const files = walk(SRC, NAME);
const DOS_TIME = 0, DOS_DATE = ((2026 - 1980) << 9) | (1 << 5) | 1;   // fixed date: same skill, same zip
const parts = [], central = [];
let offset = 0;
for (const [p, q] of files) {
  const data = fs.readFileSync(p), comp = zlib.deflateRawSync(data, { level: 9 }), crc = crc32(data) >>> 0;
  const name = Buffer.from(q, 'utf8'), mode = fs.statSync(p).mode & 0o111 ? 0o100755 : 0o100644;
  const lh = Buffer.alloc(30);
  lh.writeUInt32LE(0x04034b50, 0); lh.writeUInt16LE(20, 4); lh.writeUInt16LE(0x0800, 6); lh.writeUInt16LE(8, 8);
  lh.writeUInt16LE(DOS_TIME, 10); lh.writeUInt16LE(DOS_DATE, 12); lh.writeUInt32LE(crc, 14);
  lh.writeUInt32LE(comp.length, 18); lh.writeUInt32LE(data.length, 22); lh.writeUInt16LE(name.length, 26); lh.writeUInt16LE(0, 28);
  const ch = Buffer.alloc(46);
  ch.writeUInt32LE(0x02014b50, 0); ch.writeUInt16LE((3 << 8) | 20, 4); ch.writeUInt16LE(20, 6); ch.writeUInt16LE(0x0800, 8);
  ch.writeUInt16LE(8, 10); ch.writeUInt16LE(DOS_TIME, 12); ch.writeUInt16LE(DOS_DATE, 14); ch.writeUInt32LE(crc, 16);
  ch.writeUInt32LE(comp.length, 20); ch.writeUInt32LE(data.length, 24); ch.writeUInt16LE(name.length, 28);
  ch.writeUInt32LE((mode << 16) >>> 0, 38); ch.writeUInt32LE(offset, 42);
  parts.push(lh, name, comp); central.push(ch, name);
  offset += lh.length + name.length + comp.length;
}
const cd = Buffer.concat(central), end = Buffer.alloc(22);
end.writeUInt32LE(0x06054b50, 0); end.writeUInt16LE(files.length, 8); end.writeUInt16LE(files.length, 10);
end.writeUInt32LE(cd.length, 12); end.writeUInt32LE(offset, 16);
fs.writeFileSync(OUT, Buffer.concat([...parts, cd, end]));
console.log(`build_zip: ${files.length} files, ${Math.round(fs.statSync(OUT).size / 1024)} KB -> ${path.relative(ROOT, OUT)}`);
