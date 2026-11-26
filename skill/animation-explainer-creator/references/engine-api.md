# Engine API (film.js)

## scenes.js

```js
window.FILM = {
  title: 'המטוטלת הפשוטה',          // page h1 and the film's accessible name
  kicker: 'פיזיקה · מכניקה',         // small line above the title (optional)
  lede: '...',                       // one-sentence summary under the title (optional)
  lang: 'he',                        // he | en | ar | ... ; sets direction, player labels, fonts
  grid: true,                        // faint grid background (default true)
  palette: { orange: '#ff9d4d' },    // override palette colours (optional)
  transcript: true,                  // transcript under the player (default true)
  footer: 'html',                    // optional footer line
  scenes: [ /* ... */ ]
};
```

Scene:

```js
{
  id: 'setup',                       // stable, short, unique: narration files are keyed "<id>-<caption index>"
  title: 'המערכת',                   // chapter name (chapter list, top-corner label)
  dur: 20,                           // written length in seconds
  cap: [                             // [start, on-screen HTML, spoken line]
    [0,   'תולים משקולת על חוט באורך <span class="math">L</span>.', 'תולים משקולת על חוט.'],
    [7,   '...', '...']
  ],
  draw(g, t, s) {                    // one frame at local time t (seconds, unstretched)
    const c = s.cap.map(x => x[0]);  // caption starts: tie timings to them
    g.alpha(Film.seg(t, c[1] + 0.3, c[1] + 1.1), () => g.label('...', 1100, 300));
  }
}
```

Timing model: each caption starts a segment. A recorded clip longer than its segment stretches that segment (the
animation inside it runs slower) and the clip becomes the clock. `check.cjs` prints the stretch and the caption
times that would avoid it.

Wrap the file in `(function () { ... })();` when it defines helpers, so nothing leaks into the page.

## Time helpers (Film.* and g.*)

| helper | meaning |
|---|---|
| `seg(t, a, b)` | 0 before a, 1 after b, linear in between: the workhorse for fades and moves |
| `ease.io / ease.out / ease.in / ease.back` | easing curves on 0..1 |
| `lerp(a, b, p)` | a + (b - a) p |
| `clamp(v, a, b)` | limit v to [a, b] |

Patterns: fade in `g.alpha(seg(t, 2, 2.6), () => ...)`; fade in and out `seg(t, 2, 2.6) * (1 - seg(t, 7, 7.6))`;
move `lerp(x0, x1, ease.io(seg(t, 3, 4.5)))`; reveal a list `upto: seg(t, c[1], c[1] + 0.8) + seg(t, c[2], ...)`;
periodic motion `A * Math.sin(2 * Math.PI * t / T)`.

## Canvas and style

The canvas is 1600 x 900 (`g.W`, `g.H`), origin top left, y down. Colours `g.C`: `bg bg2 ink dim faint blue orange
green red yellow violet metal metalDark wood woodDark paper paperInk ruler rulerInk chip panel`. Fonts `g.F`:
`text` (IBM Plex Sans Hebrew / Plex Sans / Arial), `mono` (IBM Plex Mono), `math` (Times-like serif).

Use colour for meaning and keep it consistent through the film (for example blue = measured data, orange = the
moving object or the model, yellow = annotations and highlights, green = results).

## Drawing kit (g)

Every helper takes an options object `o`; `o.alpha` multiplies opacity where it makes sense.

**Structure**
- `g.alpha(a, fn)` draw fn with opacity a. `g.at(x, y, angle, fn)` translate and rotate. `g.clip(x, y, w, h, fn)`.
- `g.bg({ color, grid })` background (drawn automatically before every scene).

**Shapes**
- `g.line(x1, y1, x2, y2, { color, w, dash, cap })`
- `g.poly([[x, y], ...], { color, w, fill, close, dash })` (`color: 'none'` for fill only)
- `g.rect(x, y, w, h, { fill, stroke, w, r, dash })`
- `g.circle(x, y, r, { fill, stroke, w, a0, a1, dash })` (a0/a1 = arc in radians, canvas angles)
- `g.dot(x, y, r, color)`; `g.pulse(x, y, r, t, color)` expanding ring that repeats

**Text** (right-to-left strings are detected; runs of numbers and Latin are isolated automatically)
- `g.text(s, x, y, { size, weight, color, align: center|left|right, base, font: text|mono|math, italic, maxW })`
- `g.label(s, x, y, { size, color, border, bg, align, pad, radius, font })` text in a rounded pill; returns its box
- `g.para(s, x, y, { size, maxW, lineH, align, valign: top|middle, color })` wrapped paragraph; returns `{ lines, h }`
- `g.wrap(s, maxW, { size })` -> array of lines; `g.measure(s, { size, weight, font })` -> width
- `g.bullets(items, x, y, { size, maxW, gap, upto, numbered, mark, dir })` list revealed item by item; x is the
  start edge (the right edge for Hebrew); items are strings or `{ text, color }`; returns the y below the list
- `g.panel(x, y, w, h, { title, accent, fill })` card with a title chip
- `g.callout(px, py, lx, ly, s, { color })` dot at a point, a line, and a label at (lx, ly)
- `g.title(kicker, title, sub, t, { x, y, size, align, maxW, subW })` opening card, visible at t = 0

**Math**
- `g.math(str, x, y, { size, color, align, roman })` mini typesetting: Latin letters italic, `x_n`, `x_{n+1}`,
  `t^2`, `t^{-1}`, `{m/s}` upright group for units. Greek: `θ` etc. Returns the width.
- `g.frac(num, den, x, y, { size, color })` stacked fraction; `g.mathWidth(str, o)`

**Arrows and dimensions**
- `g.arrow(x1, y1, x2, y2, { color, w, head, dash, label, lx, ly, size, font })` (label is math unless font is set)
- `g.dim(x1, y1, x2, y2, label, { color, lx, ly, font })` double-headed dimension line

**Graphs**
- `const P = g.plot({ x, y, w, h }, { xmin, xmax, ymin, ymax, xticks, yticks, xfmt, yfmt, xlab, ylab, grid })` axes; `P.X(v)`, `P.Y(v)` map data to pixels
- `g.pts(P, [[x, y], ...], { upto, color, r })` scatter points popping in
- `g.fn(P, x => ..., x0, x1, { progress, color, w, dash })` a curve drawn left to right
- `g.bars(P, [[x, y, color?], ...], { bw, upto, values, fmt, base })`
- `g.table(x, y, [{ head, vals }], { colW, rowH, upto, hiRow, dir, size })`

**Science apparatus**
- `g.stand(x, floorY, h, { arm })` lab stand, returns the hook point; `g.mass(x, yTop, { label, w, h })`
- `g.spring(x1, y1, x2, y2, { coils, amp, color })`; `g.resistor(...)`; `g.battery(x, y, { label, flip })`
- `g.meter(x, y, 'V', { reading })`; `g.wire(points, { flow })` with moving charges
- `g.ruler(x, y, len, { cm, vertical, start })`; `g.compass(x, y, r, deg)`; `g.stopwatch(x, y, r, seconds, { fmt })`

Need something else (a car, a cell, a planet orbit, a molecule)? Write a small function at the top of scenes.js
that draws it with these primitives and takes positions and angles as arguments, like `pendulum()` in the example.

## Page and player

- `Film.page(FILM)` builds the page into `#app` and returns the player. `index.html` calls it.
- `Film.mount(el, { scenes, lang, label, narration: { base: 'audio/', dur }, ui, grid, palette, pad })` the player only.
- Player: `play() pause() seek(t) time total draw() narrated scenes lang dir captions() cues() stretch()
  renderFrame(canvas, t, { captions: 'band'|'overlay'|'none' }) inspect(t) locate(t)`.
- `window.NARRATION` (from narration.js): `{ "<id>-<caption>": [file, seconds] }`; clips in `audio/<file>.mp3`.
- Keyboard: space or k play/pause, arrows seek 5 s. Chapters, speed 0.75-1.5x, narration on/off, full screen.
