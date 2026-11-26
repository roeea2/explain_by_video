# Hebrew, Arabic, numbers and formulas

## On the canvas

- Write Hebrew strings naturally: `g.text('הסטייה כ-0.2% ב-10°', ...)`. The engine detects right-to-left text,
  sets the canvas direction, and wraps every run of Latin letters, digits and math symbols ("0.02 s", "a < g",
  "9.8 m/s²", "T²") in invisible isolates so the bidi algorithm keeps the run in order.
- Formulas go through `g.math`, not `g.text`: `g.math('T = 2π √(L / g)', x, y)`. It is always
  left-to-right, italicises variables, and handles `x_1`, `t^2`, `{m/s}^2` (upright units).
- Mixed Hebrew + formula on one line: draw them as two pieces, the Hebrew with `g.text` and the formula with
  `g.math` beside it (measure with `g.measure` / `g.mathWidth`), rather than one string.
- Tables: `g.table` lays columns right-to-left when a header is Hebrew, or with `dir: 'rtl'`.
- Lists: `g.bullets(items, x, ...)` with x = the right edge for Hebrew.
- Arrows in text: avoid "→" between Hebrew and numbers (its direction flips); use words or draw a real arrow.
- If a string still renders in the wrong order, split it into separately placed pieces. Always check frames.

## In HTML captions and the page

- Numbers with units: `<span class="num">14.2 s</span>`; formulas: `<span class="math">T = 2π√(L/g)</span>`.
  Both classes are isolated left-to-right and nowrap in film.css, so "7 / 8", "−3" and "1.42 s" never reverse.
- Use the real minus sign (−, U+2212) in formulas, a normal hyphen elsewhere.
- Hebrew punctuation after a number span is fine; do not put an isolated span at the very start of a caption
  if you can avoid it (start with a word).

## In the spoken line

- No digits, no symbols: "תשע נקודה שמונה מטר לשנייה בריבוע", "שתי עשיריות האחוז".
- Avoid bare letter names (L, g, T): say what they are ("אורך החוט", "תאוצת הנפילה החופשית", "זמן המחזור").
- Units in full ("שניות", "מטר"), gender agreement for numbers (שתי עשיריות, שני אחוזים).
- Acronyms the voice may misread (כא"מ) should be said in full ("הכוח האלקטרומניע") or spelled the way they
  are pronounced.

## Other right-to-left languages

Arabic, Persian and Urdu work the same way (detection covers the Arabic block). Add the matching font to
index.html (for example IBM Plex Sans Arabic) and set `lang` in scenes.js and film.json.
