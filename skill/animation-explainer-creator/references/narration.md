# Narration

## Why recorded, and why checked

The browser's built-in voices sound robotic, especially in Hebrew. The films use a neural voice recorded once
(Gemini TTS) and played back as small mp3 clips, one per caption. Neural TTS sometimes adds words, hesitates
("אה"), mispronounces an acronym or speaks far too slowly, so every clip is transcribed back and compared with its
text before it is accepted.

## Before the first recording

- The spoken lines are sent to Google's Gemini API. Ask the user before the first run and use their own key
  (`GEMINI_API_KEY` or `GOOGLE_AI_API_KEY` in the environment). Never write a key into a file of the film.
- Settings live in film.json under `tts`: `model` (default `gemini-3.8-flash-tts`), `voice` (default `Sulafat`,
  a warm female voice; `Achird`, `Sadaltager` and `Kore` are good alternatives), `style`, `check_model`.
- Let the user choose a voice when they care: `tts.py <film> --sample "<one line>" --voices Sulafat,Achird,Kore`
  writes `work/voices/<voice>.mp3`.

## How tts.py works

1. Reads `work/captions.json` (from `extract_captions.cjs`).
2. Each line's file name is a hash of model + voice + style + text: unchanged lines are never recorded again,
   even when scenes move; clips no longer used are deleted.
3. The request puts the style in a director's-notes block and the line in a transcript block:
   `### DIRECTOR'S NOTES\n<style>\n\n#### TRANSCRIPT\n<line>`. A plain instruction in front of the text gets read
   aloud, so do not change this format.
4. The audio (WAV or raw PCM) is trimmed, loudness-normalised and saved as a 64 kbps mono mp3.
5. The clip is transcribed with `check_model`. Accepted when the word match is at least 0.88 and the pace is
   1.2-3.6 words per second; otherwise recorded again, up to 4 takes, keeping the best and flagging it.
6. `narration.js` is written: `window.NARRATION = { "<scene id>-<caption>": [file, seconds] }`.

## When a clip is flagged

- Listen to it (`audio/<file>.mp3`; the file name is in narration.js).
- Usual fixes: write numbers as words, spell out acronyms, split a long sentence, remove a letter name, replace a
  rare word. Then run tts.py again; only that line is recorded.
- A low match can also be a transcription quirk on a correct clip (for example numbers transcribed as digits).
  If it sounds right, keep it.

## Style prompt

The default style for Hebrew: "A warm, friendly Israeli teacher explaining to a student sitting next to them.
Natural, fluent Israeli Hebrew with a native accent, relaxed pace, lively natural intonation, short pauses at
commas." Adapt it to the audience (younger children: slower, more playful; adults: brisker). Changing the style
changes every hash, so the whole film is recorded again.

## Without a key

The film works silently: captions advance with the written timing, the narration button is hidden, and the MP4
has no audio track. Do not fall back to browser speech.
