# Scene craft: script, storyboard, layout, timing

## The script

- Start from the question the film answers ("ממה תלוי זמן המחזור?") and end with the answer and its limits.
- 4-7 chapters for 2-3 minutes. A typical shape: opening question, the setup or the parts, the process or the
  measurement, the result or the graph, model vs reality or common mistakes, (optional) summary.
- One idea per caption. 2-4 captions per chapter. Each caption has two texts:
  - on screen: short and precise, with numbers and formulas (`<span class="num">1.42 s</span>`,
    `<span class="math">T²</span>`), what a student would copy into a notebook
  - spoken: what a teacher says next to the student, a little longer and warmer, numbers and symbols as words
    ("אחת נקודה ארבעים ושתיים שניות"), no bare letter names, no "as you can see in the figure above"
- About 2.2 spoken words per second. A caption's room in the scene (until the next caption) should be at least
  words / 2.2 + 0.5 seconds; `extract_captions.cjs` warns when it is not.
- Use the learner's vocabulary; define a term the first time it appears; one term per concept for the whole film.

## Model vs reality (science and labs)

Physics is taught in an ideal world, labs happen in the real one. For any science or lab film, the last content
chapter shows where they differ:
1. state every assumption of the model: what is neglected (friction, air, the string's mass), what is assumed
   constant, what is assumed small (angles, currents, heating)
2. when the classroom equation comes from a derivation, derive it on screen step by step
3. say what the real lab adds and how big the effect is (a number, not "a little")
4. show how the data reveals it: an intercept that is not zero, a slope a few percent off, a drifting value
5. what you do about it in the lab

Draw the apparatus the way schools actually set it up, and keep the sample data consistent with the effects you
describe.

## Layout on the 1600 x 900 canvas

- Margins: keep text at least 60 px from the edges. The chapter label sits in the top corner on the reading side
  (top right in Hebrew, top left in English), about 50 px tall: keep that corner free from y = 0 to 80.
- Split the frame by role: the apparatus or diagram on one side (in Hebrew usually the left), annotations and
  results on the reading side (right). Graphs: plot box about 700 x 520 with the table or result card beside it.
- Text sizes: titles 64-104, labels 24-30, body 28-34, never below 20 (it must be readable on a phone and in a
  projected classroom).
- Put a label close to what it names, or use `g.callout` with a line. Never let a label cross a moving object's
  path; check the extreme positions of anything that moves.
- One focus at a time: fade out the previous caption's annotations as the next caption starts
  (`* (1 - seg(t, c[2] - 0.4, c[2] + 0.2))`).

## Animation patterns

| want | do |
|---|---|
| introduce a part | fade in 0.6-0.8 s, or a callout appearing when the narrator names it |
| build up a formula | show each step on its own line, fade the next one in with a small arrow |
| a process over time | real physics as a function of t (free fall `d = ½ a t²`, oscillation `A sin(2πt/T)`) |
| slow motion / fast forward | map scene time to physical time, show a label ("הילוך איטי", "הרצה מהירה") |
| compare two cases | split screen, same scale, different colour, identical layout |
| a measurement | show the instrument and its reading changing (`g.stopwatch`, `g.meter` with `reading`) |
| data and fit | table rows reveal (`upto`), points pop (`g.pts`), then the fit line draws (`g.fn` with `progress`) |
| emphasis | `g.pulse` ring, a yellow label, or dim everything else to 30 % |
| motion trail | draw the object at t - 0.035 k (k = 1..6) with falling opacity |

## Timing and sync with the voice

- Time everything from the caption starts: `const c = s.cap.map(x => x[0])`. After recording, the checker's
  `retime scene ...` line gives caption times that fit every clip; paste them in and nothing else changes.
- A picture should appear when the narrator mentions it: within a caption, estimate the moment as
  (words before the mention) / 2.2 seconds after the caption start.
- Leave 0.4-0.6 s between the end of one caption's action and the next caption.
- A moving demonstration (a swing, a fall) can keep running under the next caption: compute it from the scene's
  own time so it stays continuous.

## Poster and opening

The paused first frame is what people see before pressing play and what an OG image or thumbnail shows: the
opening scene must be complete at t = 0 (`g.title` is). Give it something that moves gently (a swinging
pendulum, a slow drift) so the first seconds feel alive.

## Accessibility

Captions are always on under the film; the transcript lists every caption with its time and jumps to it. Do not
encode meaning by colour alone: label the curves and the arrows. Keep contrast high on the dark screen.
