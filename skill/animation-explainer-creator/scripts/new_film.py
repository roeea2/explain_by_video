#!/usr/bin/env python3
"""Create a new explainer-film project folder.

  python3 new_film.py <folder> --title "..." [--lang he] [--kicker "..."] [--description "..."] [--force]

The folder gets a copy of the engine (film.js, film.css), a page (index.html), a starter scenes.js, film.json
(language and narration settings), an empty narration.js, work/ for tool output, and .vercelignore (keeps work/
off a deployment). Running it again on an existing film only refreshes film.js and film.css (the engine), unless
--force is given.
"""
import argparse, json, os, re, shutil

HERE = os.path.dirname(os.path.abspath(__file__))
SKILL = os.path.dirname(HERE)
RTL = {'he', 'iw', 'ar', 'fa', 'ur', 'yi'}

STYLE = {
    'he': ('A warm, friendly Israeli teacher explaining to a student sitting next to them. Natural, fluent Israeli '
           'Hebrew with a native accent, relaxed pace, lively natural intonation, short pauses at commas.'),
    'en': ('A warm, friendly teacher explaining to a student sitting next to them. Natural, fluent speech, relaxed '
           'pace, lively natural intonation, short pauses at commas.'),
    'ar': ('A warm, friendly teacher explaining to a student sitting next to them. Natural, fluent Modern Standard '
           'Arabic with a clear native accent, relaxed pace, lively intonation, short pauses at commas.'),
}


def slugify(s):
    s = re.sub(r'[^a-z0-9]+', '-', s.lower()).strip('-')
    return s or 'film'


def fill(text, vals):
    for k, v in vals.items():
        text = text.replace('{{%s}}' % k, v)
    return text


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument('folder')
    ap.add_argument('--title', required=False, default='')
    ap.add_argument('--lang', default='he')
    ap.add_argument('--kicker', default='')
    ap.add_argument('--description', default='')
    ap.add_argument('--slug', default='')
    ap.add_argument('--force', action='store_true', help='overwrite index.html, scenes.js and film.json too')
    a = ap.parse_args()

    dest = os.path.abspath(a.folder)
    exists = os.path.exists(os.path.join(dest, 'scenes.js'))
    os.makedirs(os.path.join(dest, 'work'), exist_ok=True)
    os.makedirs(os.path.join(dest, 'audio'), exist_ok=True)
    for f in ('film.js', 'film.css'):
        shutil.copyfile(os.path.join(SKILL, 'engine', f), os.path.join(dest, f))
    if exists and not a.force:
        print('engine refreshed in', dest, '(scenes.js, index.html and film.json kept)')
        return

    title = a.title or os.path.basename(dest)
    lang = a.lang.lower()
    js = lambda s: s.replace('\\', '\\\\').replace("'", "\\'")
    vals = {'TITLE': title, 'LANG': lang, 'DIR': 'rtl' if lang[:2] in RTL else 'ltr', 'KICKER': a.kicker,
            'DESCRIPTION': a.description or title, 'IDEA': title}
    html = fill(open(os.path.join(SKILL, 'templates', 'index.html'), encoding='utf-8').read(),
                {k: v.replace('&', '&amp;').replace('"', '&quot;').replace('<', '&lt;') for k, v in vals.items()})
    open(os.path.join(dest, 'index.html'), 'w', encoding='utf-8').write(html)
    scenes = fill(open(os.path.join(SKILL, 'templates', 'scenes.js'), encoding='utf-8').read(),
                  {k: js(v) for k, v in vals.items()})
    open(os.path.join(dest, 'scenes.js'), 'w', encoding='utf-8').write(scenes)
    slug = a.slug or slugify(title if re.search('[a-z]', title.lower()) else os.path.basename(dest))
    cfg = {
        'slug': slug,
        'lang': lang,
        'tts': {
            'provider': 'gemini',
            'model': 'gemini-3.8-flash-tts',
            'voice': 'Sulafat',
            'check_model': 'gemini-3.8-flash',
            'style': STYLE.get(lang[:2], STYLE['en'].replace('Natural, fluent speech', 'Natural, fluent native speech in the language of the transcript')),
        },
    }
    json.dump(cfg, open(os.path.join(dest, 'film.json'), 'w', encoding='utf-8'), ensure_ascii=False, indent=2)
    open(os.path.join(dest, 'narration.js'), 'w', encoding='utf-8').write(
        '/* recorded narration: { "<scene>-<caption>": [file, seconds] } (written by scripts/tts.py) */\nwindow.NARRATION = {};\n')
    open(os.path.join(dest, '.vercelignore'), 'w').write('work\nfilm.json\n')
    print('new film in', dest)
    print('  edit scenes.js, then check it:  node <skill>/scripts/check.cjs "%s" --frames' % dest)


if __name__ == '__main__':
    main()
