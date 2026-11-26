---
name: animation-explainer-creator
description: Creates narrated animated explainer films that are drawn in code on an HTML canvas (no video model, no footage) - chapters, captions, natural recorded narration (Gemini TTS, every clip checked by transcription), a ready web page with player and transcript, and an MP4 export with subtitles. Built for teachers, first-class in Hebrew and other right-to-left languages, with formulas and units typeset correctly. Use it whenever the user asks for an animated explainer, an explanation video, a lesson, lab or experiment video, an animation that explains a concept, process, law, algorithm or system, a narrated walkthrough, or "סרטון הסבר", "סרטון מונפש", "אנימציה שמסבירה", or wants to turn a topic, worksheet, lab brief, article or notes into a short film, even if they do not say "animation". Not for editing existing video footage.
---

# Animation explainer creator

Make a short explainer film the way the "מעבדות חקר" lab films were made: every frame is drawn by JavaScript on a
canvas, the narration is recorded with a natural neural voice, and the picture waits for the voice so the two stay in
sync. The result is a folder with a web page (player, chapters, captions, transcript) that works offline and on any
static host, and optionally an MP4 with burned-in captions and an .srt file.

Requirements: Node 18+, Python 3.10+, ffmpeg, and Playwright for the checks and the MP4 export (the scripts find an
existing copy or print the one-line install). Narration needs a Gemini API key (`GEMINI_API_KEY` or
`GOOGLE_AI_API_KEY`); without one the film is silent with captions.

`<skill>` below means this skill's folder.

## Workflow

### 1. Brief (one round of questions)

Ask only what you cannot infer, in one AskUserQuestion round:
- topic and source material (a file, a lab brief, notes, a URL, or "from your knowledge")
- audience (age or grade, prior knowledge)
- language (default: the language the user writes in)
- length (default 2-3 minutes, 4-7 chapters)
- narration: recorded voice (needs their Gemini key, and their OK to send the spoken lines to Google) or silent
- deliverables: web page (always), MP4, publish to Vercel
- where to save (default: a new folder in the current project, named after the topic)

### 2. Script before pictures

Read the material, then plan the chapters and write every caption: the short on-screen text and the spoken line.
Show the user the chapter list with the spoken lines and get an OK before drawing, unless they said to just go
ahead. The script is cheap to change now and expensive later. Rules in `references/scene-craft.md`; the most
important:
- one idea per caption; a caption is 1-2 sentences; a chapter has 2-4 captions
- spoken lines sound like a teacher next to the student: short sentences, numbers and symbols written as words,
  no letter names that the voice may misread (say "אורך החוט", not "אל")
- for science and lab topics, end with a chapter "model vs reality" (מודל מול מציאות): every assumption, what the
  real lab adds, and how the data shows it (`references/scene-craft.md`, "Model vs reality")
- every number in the film, captions and transcript must agree; compute data in code, never type it twice

### 3. Scaffold

```bash
python3 <skill>/scripts/new_film.py "<folder>" --title "..." --lang he --kicker "..." --description "..."
```

It copies the engine (film.js, film.css), the page (index.html), a starter scenes.js and film.json into the folder.

### 4. Draw the scenes

Write `scenes.js` (`window.FILM = { title, kicker, lede, lang, scenes: [...] }`). The full drawing kit is in
`references/engine-api.md`; a complete finished film to learn from is `examples/pendulum-he/scenes.js`.

- `draw(g, t, s)` depends on `t` only. No state between frames, no `Math.random()` without a fixed seed.
- Tie every timing to the caption starts: `const c = s.cap.map(x => x[0])`, then `seg(t, c[1] + 0.3, c[1] + 1.1)`.
  Re-timing after the voice is recorded then means editing only the caption times.
- Give every scene a stable `id`; narration files are keyed by it.
- Draw formulas with `g.math`, Hebrew or other text with `g.text` / `g.label` / `g.para` / `g.bullets`.
- The first frame of the first scene is the poster: make it fully visible at t = 0.

After every one or two scenes run the checker and look at the frames:

```bash
node <skill>/scripts/check.cjs "<folder>" --frames
```

It reports page and draw errors, text outside the frame, overlapping text and labels, and phone overflow, and
renders the settled end of every caption to `work/frames/` plus contact sheets (`sheet-1.png`, ...). Open the
sheets with the Read tool every time; the checker cannot judge composition, wrong arrows or wrong physics.

### 5. Narration

```bash
node <skill>/scripts/extract_captions.cjs "<folder>"     # lints the script, writes work/captions.json
python3 <skill>/scripts/tts.py "<folder>" --dry-run       # what will be recorded
python3 <skill>/scripts/tts.py "<folder>"                 # record, transcribe back, retry bad takes
node <skill>/scripts/check.cjs "<folder>" --frames
```

Fix the linter warnings first (digits or symbols in a spoken line, a line too long for its caption). The recorder
accepts a clip when its transcript matches the text and the pace is natural, retries up to 4 times, and flags what
it could not fix: listen to flagged clips or rephrase the line. Then apply the checker's `retime scene ...`
suggestions (new caption times and `dur`) so no animation is slowed down, and check again. To let the user choose
a voice: `tts.py "<folder>" --sample "<one line>" --voices Sulafat,Achird,Kore` writes `work/voices/*.mp3`.
Details and voice tips: `references/narration.md`.

Never use the browser's or the operating system's speech synthesis: it sounds robotic, especially in Hebrew.
Recorded neural TTS or no voice at all.

### 6. Review

Open `index.html` in the browser (it works from the file system) and watch it once with sound, or at least go
through the contact sheets and the transcript. Check facts, units, signs and directions of arrows, and that each
picture appears when the narrator mentions it.

### 7. Deliver

- MP4: `node <skill>/scripts/export_mp4.cjs "<folder>"` -> `export/<slug>.mp4` + `.srt`
  (`--captions band|overlay|none`, `--size 1920x1080`, `--fps 30`). About 30 s of work per minute of film.
- Publish (only when asked): `vercel deploy --prod --yes` from the film folder (`.vercelignore` keeps `work/` out).
  Before any upload, audit the folder for secrets, personal data and file metadata, and report the result.
- Tell the user where the folder is, the length and chapters, what was checked, and anything still open.

## Editing a film later

Change captions or drawings in scenes.js, then run steps 5-6 again: only changed spoken lines are recorded again
(clips are named by a hash of their text and voice, unused ones are deleted). Refresh the engine in an old film
with `new_film.py "<folder>"` (keeps scenes.js, index.html and film.json).

## Files

```
engine/film.js, film.css          the player, the drawing kit, the page builder (copied into every film)
templates/                        index.html and a starter scenes.js
scripts/new_film.py               scaffold a film folder
scripts/extract_captions.cjs      captions -> work/captions.json, lints the spoken lines and timing
scripts/tts.py                    Gemini TTS narration with transcription check -> audio/, narration.js
scripts/check.cjs                 errors, layout, overflow, timing; --frames renders frames and contact sheets
scripts/export_mp4.cjs            MP4 (H.264 + AAC) with captions and .srt
references/engine-api.md          scene format and every g.* helper
references/scene-craft.md         script, storyboard, layout, timing, model vs reality
references/rtl-and-math.md        Hebrew / Arabic text, numbers and formulas
references/narration.md           spoken lines, voices, the recording pipeline
examples/pendulum-he/scenes.js    a complete 5-chapter film (Hebrew, physics)
```
