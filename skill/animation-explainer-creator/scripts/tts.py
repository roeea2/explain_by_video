#!/usr/bin/env python3
"""Record the film's narration with Gemini TTS and check every clip by transcribing it back.

  python3 tts.py <film>                          record every changed line of work/captions.json
  python3 tts.py <film> --dry-run                list what would be recorded
  python3 tts.py <film> --sample "a line" [--voices Sulafat,Achird,Kore]
                                                 the same line in several voices -> work/voices/ (to choose a voice)

Run scripts/extract_captions.cjs first. Settings come from film.json ("tts": model, voice, style, check_model).
Needs ffmpeg and a Gemini API key in GEMINI_API_KEY (or GOOGLE_AI_API_KEY / GOOGLE_API_KEY). The script sends the
spoken lines to Google's API, so ask the user before the first run.

Clips are content-addressed: audio/<hash>.mp3, hash of model + voice + style + text. Unchanged lines are never
recorded again, even when scenes move. narration.js maps "<scene id>-<caption>" -> [file, seconds]; clips no
longer used are deleted. A clip is accepted when its transcript matches the text (>= 0.88) and the pace is
natural; otherwise it is recorded again (up to 4 takes, the best one is kept and flagged).
"""
import argparse, base64, difflib, hashlib, json, os, re, shutil, subprocess, sys, time, unicodedata
import urllib.request, urllib.error
from concurrent.futures import ThreadPoolExecutor

URL = 'https://generativelanguage.googleapis.com/v1beta/models/%s:generateContent'
PROMPT = "### DIRECTOR'S NOTES\n%s\n\n#### TRANSCRIPT\n%s"   # only the transcript is spoken; a plain instruction prefix gets read aloud
LANGS = {'he': 'Hebrew', 'en': 'English', 'ar': 'Arabic', 'ru': 'Russian', 'fr': 'French', 'es': 'Spanish',
         'de': 'German', 'it': 'Italian', 'pt': 'Portuguese', 'am': 'Amharic', 'fa': 'Persian', 'tr': 'Turkish'}
RATE = (1.2, 3.6)          # words per second that sound natural
MATCH = 0.88


def api_key():
    for k in ('GEMINI_API_KEY', 'GOOGLE_AI_API_KEY', 'GOOGLE_API_KEY'):
        if os.environ.get(k):
            return os.environ[k]
    sys.exit('No Gemini API key: set GEMINI_API_KEY (or GOOGLE_AI_API_KEY) in the environment.')


def post(model, body, timeout=120):
    req = urllib.request.Request(URL % model, data=json.dumps(body).encode(), method='POST',
                                 headers={'Content-Type': 'application/json', 'x-goog-api-key': api_key()})
    with urllib.request.urlopen(req, timeout=timeout) as r:
        return json.load(r)


def synth(text, tts):
    body = {'contents': [{'parts': [{'text': PROMPT % (tts['style'], text)}]}],
            'generationConfig': {'responseModalities': ['AUDIO'],
                                 'speechConfig': {'voiceConfig': {'prebuiltVoiceConfig': {'voiceName': tts['voice']}}}}}
    for attempt in range(6):
        try:
            part = post(tts['model'], body)['candidates'][0]['content']['parts'][0]['inlineData']
            return base64.b64decode(part['data']), part.get('mimeType', '')
        except urllib.error.HTTPError as e:
            msg = e.read().decode(errors='replace')[:300]
            if e.code in (429, 500, 502, 503, 504) and attempt < 5:
                time.sleep(4 * 2 ** attempt); continue
            raise RuntimeError('HTTP %s: %s' % (e.code, msg))
        except (KeyError, IndexError, urllib.error.URLError, TimeoutError):
            if attempt < 5:
                time.sleep(3); continue
            raise RuntimeError('no audio in the response')


def to_mp3(data, mime, out):
    """WAV or raw 16-bit PCM in; trims the silence at both ends, normalises loudness, writes a small mono mp3."""
    trim = ('silenceremove=start_periods=1:start_threshold=-50dB:start_silence=0.05,areverse,'
            'silenceremove=start_periods=1:start_threshold=-50dB:start_silence=0.15,areverse,'
            'loudnorm=I=-17:TP=-1.5:LRA=11')
    if 'wav' in mime or data[:4] == b'RIFF':
        src = ['-f', 'wav', '-i', 'pipe:0']
    else:
        rate = mime.split('rate=')[1].split(';')[0] if 'rate=' in mime else '24000'
        src = ['-f', 's16le', '-ar', rate, '-ac', '1', '-i', 'pipe:0']
    subprocess.run(['ffmpeg', '-y', '-loglevel', 'error'] + src +
                   ['-af', trim, '-ar', '24000', '-ac', '1', '-c:a', 'libmp3lame', '-b:a', '64k', '-map_metadata', '-1', out],
                   input=data, check=True)
    return duration(out)


def duration(f):
    p = subprocess.run(['ffprobe', '-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', f],
                       capture_output=True, text=True, check=True)
    return float(p.stdout.strip())


def transcribe(mp3, tts, lang):
    name = LANGS.get(lang[:2], lang)
    body = {'contents': [{'parts': [
        {'inlineData': {'mimeType': 'audio/mpeg', 'data': base64.b64encode(open(mp3, 'rb').read()).decode()}},
        {'text': 'Transcribe this %s audio verbatim. Write numbers as words. Output only the transcript.' % name}]}]}
    for attempt in range(5):
        try:
            return post(tts.get('check_model', 'gemini-3.8-flash'), body)['candidates'][0]['content']['parts'][0]['text']
        except Exception:
            time.sleep(3 * 2 ** attempt)
    return ''


def words(s):
    s = ''.join(c for c in unicodedata.normalize('NFKD', s.lower()) if unicodedata.category(c) != 'Mn')
    return re.sub(r'[^\w\s]', ' ', s).split()


def similar(a, b):
    return difflib.SequenceMatcher(None, words(a), words(b)).ratio()


def load(film):
    cfg = json.load(open(os.path.join(film, 'film.json'), encoding='utf-8'))
    tts = cfg.get('tts', {})
    tts.setdefault('model', 'gemini-3.8-flash-tts'); tts.setdefault('voice', 'Sulafat')
    tts.setdefault('style', 'A warm, friendly teacher explaining to a student. Natural, fluent native speech, relaxed pace.')
    return cfg, tts


def sample(film, line, voices):
    cfg, tts = load(film)
    out = os.path.join(film, 'work', 'voices'); os.makedirs(out, exist_ok=True)
    for v in voices:
        data, mime = synth(line, dict(tts, voice=v))
        d = to_mp3(data, mime, os.path.join(out, v + '.mp3'))
        print('%-14s %.1f s -> work/voices/%s.mp3' % (v, d, v))


def record(film, dry=False, workers=4):
    cfg, tts = load(film)
    capf = os.path.join(film, 'work', 'captions.json')
    if not os.path.exists(capf):
        sys.exit('work/captions.json is missing: run scripts/extract_captions.cjs first.')
    caps = json.load(open(capf, encoding='utf-8'))
    lang = caps.get('lang') or cfg.get('lang', 'en')
    audio = os.path.join(film, 'audio'); os.makedirs(audio, exist_ok=True)
    cache_f = os.path.join(film, 'work', 'tts_cache.json')
    cache = json.load(open(cache_f, encoding='utf-8')) if os.path.exists(cache_f) else {}

    rows, jobs = [], {}
    for r in caps['rows']:
        h = hashlib.sha1((tts['model'] + tts['voice'] + tts['style'] + r['text']).encode()).hexdigest()[:12]
        rows.append((r['key'], h, r['text']))
        if not (h in cache and os.path.exists(os.path.join(audio, h + '.mp3'))):
            jobs[h] = r['text']
    print('%d lines, %d to record (%s, voice %s)' % (len(rows), len(jobs), tts['model'], tts['voice']))
    if dry:
        for h, text in jobs.items():
            print('  ', h, text[:90])
        return

    def run(item):
        h, text = item
        out, n, best = os.path.join(audio, h + '.mp3'), len(words(text)), None
        for attempt in range(4):
            data, mime = synth(text, tts)
            tmp = out + '.try.mp3'
            d = to_mp3(data, mime, tmp)
            sim, rate = similar(text, transcribe(tmp, tts, lang)), n / d
            ok = sim >= MATCH and RATE[0] <= rate <= RATE[1]
            score = sim - (0 if RATE[0] <= rate <= RATE[1] else 0.3)
            if best is None or score > best[0]:
                best = (score, sim, d, rate); shutil.move(tmp, out)
            if ok:
                break
            print('  retry %s (match %.2f, %.1f words/s)' % (h, sim, rate), flush=True)
        if os.path.exists(out + '.try.mp3'):
            os.remove(out + '.try.mp3')
        return h, best

    failed = []
    with ThreadPoolExecutor(workers) as ex:
        for item, fut in [(it, ex.submit(run, it)) for it in jobs.items()]:
            try:
                h, (score, sim, d, rate) = fut.result()
                flag = sim < MATCH or not (RATE[0] <= rate <= RATE[1])
                cache[h] = {'dur': round(d, 2), 'match': round(sim, 2), 'rate': round(rate, 2), 'text': item[1]}
                json.dump(cache, open(cache_f, 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
                key = next(k for k, hh, _ in rows if hh == h)
                print('%-18s %5.1f s  %.1f w/s  match %.2f%s' % (key, d, rate, sim, '   <-- CHECK THIS CLIP' if flag else ''), flush=True)
            except Exception as e:
                failed.append(item[0]); print('FAILED', item[1][:60], e)

    nar, used = {}, set()
    for key, h, _ in rows:
        if h in cache and os.path.exists(os.path.join(audio, h + '.mp3')):
            nar[key] = [h, cache[h]['dur']]; used.add(h)
    with open(os.path.join(film, 'narration.js'), 'w', encoding='utf-8') as fh:
        fh.write('/* recorded narration: { "<scene>-<caption>": [file, seconds] } (written by scripts/tts.py) */\n')
        fh.write('window.NARRATION = ' + json.dumps(nar, ensure_ascii=False, separators=(',', ':')) + ';\n')
    stale = [f for f in os.listdir(audio) if re.fullmatch(r'[0-9a-f]{12}\.mp3', f) and f[:-4] not in used]
    for f in stale:
        os.remove(os.path.join(audio, f))
    flagged = [k for k, h, _ in rows if h in cache and (cache[h]['match'] < MATCH or not (RATE[0] <= cache[h]['rate'] <= RATE[1]))]
    print('narration.js: %d clips, %.0f s of voice. removed %d unused clips.' % (len(nar), sum(v[1] for v in nar.values()), len(stale)))
    if flagged:
        print('flagged (listen, or rephrase the spoken line and run again):', ', '.join(flagged))
    if failed:
        print('failed:', len(failed)); sys.exit(1)


if __name__ == '__main__':
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument('film')
    ap.add_argument('--dry-run', action='store_true')
    ap.add_argument('--sample', metavar='LINE')
    ap.add_argument('--voices', default='Sulafat,Achird,Kore,Sadaltager')
    ap.add_argument('--workers', type=int, default=4)
    a = ap.parse_args()
    film = os.path.abspath(a.film)
    if a.sample:
        sample(film, a.sample, [v.strip() for v in a.voices.split(',') if v.strip()])
    else:
        record(film, a.dry_run, a.workers)
