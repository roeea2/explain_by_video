// Export a film to MP4 (H.264 + AAC) with the narration and captions, plus an .srt subtitle file.
// usage: node export_mp4.cjs <film folder> [--fps 30] [--size 1920x1080] [--captions band|overlay|none]
//                            [--out export/<slug>.mp4] [--from 0] [--to <seconds>]
// Frames are drawn by the film's own renderFrame() at the exact time of each frame, so the video matches the
// player. Each narration clip is placed at its segment start. Needs ffmpeg and Playwright.
const fs = require('fs');
const path = require('path');
const { spawn, spawnSync } = require('child_process');
const { loadPlaywright, filmDir, readJSON, openFilm } = require('./_common.cjs');

const argv = process.argv.slice(2);
const opt = (name, d) => { const i = argv.indexOf('--' + name); return i >= 0 ? argv[i + 1] : d; };
const srtTime = s => { const ms = Math.round(s * 1000), h = Math.floor(ms / 3600000), m = Math.floor(ms / 60000) % 60, sec = Math.floor(ms / 1000) % 60; return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')},${String(ms % 1000).padStart(3, '0')}`; };

(async () => {
  const dir = filmDir(argv[0]);
  const cfg = readJSON(path.join(dir, 'film.json'), {});
  const fps = +opt('fps', 30), [W, H] = opt('size', '1920x1080').split('x').map(Number), mode = opt('captions', 'band');
  const slug = cfg.slug || path.basename(dir);
  const outFile = path.resolve(dir, opt('out', path.join('export', slug + '.mp4')));
  fs.mkdirSync(path.dirname(outFile), { recursive: true });
  if (spawnSync('ffmpeg', ['-version']).status !== 0) { console.error('ffmpeg is needed'); process.exit(2); }

  const { chromium } = loadPlaywright();
  const browser = await chromium.launch();
  const { page, problems } = await openFilm(browser, dir);
  const info = await page.evaluate(() => { const f = window.Film.current; return f && { total: f.total, cues: f.cues(), caps: f.captions() }; });
  if (!info) { console.error('the player did not start:\n' + problems.join('\n')); await browser.close(); process.exit(1); }
  const t0 = +opt('from', 0), t1 = Math.min(+opt('to', info.total), info.total), dur = t1 - t0, N = Math.round(dur * fps);

  // subtitles
  const srt = info.caps.filter(c => c.end > t0 && c.start < t1).map((c, i) => `${i + 1}\n${srtTime(Math.max(0, c.start - t0))} --> ${srtTime(Math.min(dur, c.end - t0) - 0.05)}\n${c.text}\n`).join('\n');
  fs.writeFileSync(outFile.replace(/\.mp4$/, '.srt'), srt);

  // audio: every clip delayed to its start, mixed without normalisation
  const cues = info.cues.filter(c => c.t + c.dur > t0 && c.t < t1 && fs.existsSync(path.join(dir, 'audio', c.file)));
  const args = ['-y', '-loglevel', 'error', '-f', 'image2pipe', '-framerate', String(fps), '-c:v', 'mjpeg', '-i', 'pipe:0'];
  cues.forEach(c => { if (c.t < t0) args.push('-ss', (t0 - c.t).toFixed(3)); args.push('-i', path.join(dir, 'audio', c.file)); });
  if (cues.length) {
    const parts = cues.map((c, i) => `[${i + 1}:a]aresample=48000,aformat=channel_layouts=stereo,adelay=${Math.max(0, Math.round((c.t - t0) * 1000))}:all=1[a${i}]`);
    args.push('-filter_complex', parts.join(';') + ';' + cues.map((_, i) => `[a${i}]`).join('') + `amix=inputs=${cues.length}:normalize=0:dropout_transition=0,apad[aout]`,
      '-map', '0:v', '-map', '[aout]', '-c:a', 'aac', '-b:a', '160k');
  } else args.push('-map', '0:v');
  args.push('-c:v', 'libx264', '-preset', 'medium', '-crf', '20', '-pix_fmt', 'yuv420p', '-r', String(fps), '-t', dur.toFixed(3), '-movflags', '+faststart', outFile);
  const ff = spawn('ffmpeg', args, { stdio: ['pipe', 'inherit', 'inherit'] });
  const write = buf => new Promise(res => (ff.stdin.write(buf) ? res() : ff.stdin.once('drain', res)));

  console.log(`exporting ${N} frames (${dur.toFixed(1)} s, ${W}x${H}, ${fps} fps, captions: ${mode}, ${cues.length} clips)`);
  const B = 12; let lastPct = -1;
  await page.evaluate(([w, h]) => { window.__cv = document.createElement('canvas'); window.__cv.width = w; window.__cv.height = h; }, [W, H]);
  for (let i = 0; i < N; i += B) {
    const batch = await page.evaluate(([i0, n, fps, t0, mode]) => {
      const f = window.Film.current, out = [];
      for (let k = 0; k < n; k++) { f.renderFrame(window.__cv, t0 + (i0 + k) / fps, { captions: mode }); out.push(window.__cv.toDataURL('image/jpeg', 0.93).split(',')[1]); }
      return out;
    }, [i, Math.min(B, N - i), fps, t0, mode]);
    for (const b of batch) await write(Buffer.from(b, 'base64'));
    const pct = Math.floor((i + batch.length) / N * 10) * 10;
    if (pct !== lastPct) { lastPct = pct; process.stdout.write(pct + '% '); }
  }
  ff.stdin.end();
  const code = await new Promise(res => ff.on('close', res));
  await browser.close();
  console.log('');
  if (code !== 0) { console.error('ffmpeg failed with code ' + code); process.exit(1); }
  const probe = spawnSync('ffprobe', ['-v', 'error', '-show_entries', 'format=duration,size', '-of', 'csv=p=0', outFile], { encoding: 'utf8' }).stdout.trim().split(',');
  console.log(`${path.relative(dir, outFile)}: ${(+probe[0]).toFixed(1)} s, ${(+probe[1] / 1e6).toFixed(1)} MB, subtitles in ${path.relative(dir, outFile.replace(/\.mp4$/, '.srt'))}`);
  if (problems.length) console.log('page problems during export:\n  ' + problems.join('\n  '));
})();
