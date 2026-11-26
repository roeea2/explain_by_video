/* scenes.js - demo film made with animation-explainer-creator: the simple pendulum (Hebrew).
   Scene: { id, title, dur, cap: [[t, onScreenHtml, spokenText]], draw(g, t) }. The canvas is 1600 x 900. */
(function () {
  const { seg, ease, clamp, lerp } = Film;
  const DEG = Math.PI / 180, T0 = 1.42;               // period of a 0.50 m pendulum, s
  const DATA = { L: [0.2, 0.4, 0.6, 0.8, 1.0], T: [0.91, 1.26, 1.56, 1.80, 2.01] };
  DATA.T2 = DATA.T.map(t => Math.round(t * t * 100) / 100);
  const SLOPE = DATA.L.reduce((a, l, i) => a + l * DATA.T2[i], 0) / DATA.L.reduce((a, l) => a + l * l, 0);  // 4.04

  /* a pendulum hanging from a lab stand. theta in radians, positive to the right. Returns pivot and bob. */
  function pendulum(g, x, floor, L, theta, o = {}) {
    const C = g.C, hook = g.stand(x, floor, L + 220, { arm: o.arm == null ? 190 : o.arm });
    const bob = { x: hook.x + Math.sin(theta) * L, y: hook.y + Math.cos(theta) * L };
    (o.trail || []).forEach((th, k) => {
      const tx = hook.x + Math.sin(th) * L, ty = hook.y + Math.cos(th) * L;
      g.circle(tx, ty, 22, { fill: C.orange, alpha: 0.12 * (1 - k / o.trail.length) });
    });
    g.line(hook.x, hook.y, bob.x, bob.y, { color: '#d9e2ea', w: 2.5 });
    g.circle(bob.x, bob.y, 24, { fill: C.orange, stroke: '#ffd2a8', w: 2 });
    g.circle(hook.x, hook.y, 5, { fill: C.metal });
    return { hook, bob, L };
  }
  /* angle arc between the vertical and the string */
  function angleArc(g, P, theta, label, o = {}) {
    const C = g.C, r = o.r || 120, a0 = Math.PI / 2 - theta, a1 = Math.PI / 2;
    g.line(P.hook.x, P.hook.y, P.hook.x, P.hook.y + P.L + 40, { color: C.dim, w: 2, dash: [8, 8], alpha: o.alpha });
    g.circle(P.hook.x, P.hook.y, r, { stroke: C.yellow, w: 3, a0: Math.min(a0, a1), a1: Math.max(a0, a1), alpha: o.alpha });
    const am = Math.PI / 2 - theta / 2;
    if (label) g.math(label, P.hook.x + Math.cos(am) * (r + 46), P.hook.y + Math.sin(am) * (r + 46), { size: 30, color: C.yellow, alpha: o.alpha });
  }
  const swing = (amp, t, phase = 0) => amp * Math.sin(2 * Math.PI * (t - phase) / T0);
  const trail = (f, t) => [1, 2, 3, 4, 5, 6].map(k => f(t - k * 0.035));

  window.FILM = {
    title: 'המטוטלת הפשוטה',
    kicker: 'פיזיקה · מכניקה · סרטון לדוגמה',
    lede: 'ממה תלוי זמן המחזור של מטוטלת, איך מודדים אותו בדיוק, ואיך מוצאים ממנו את תאוצת הנפילה החופשית.',
    lang: 'he',
    footer: 'נוצר עם הסקיל <a href="https://animation-explainer-creator.vercel.app">animation-explainer-creator</a> ל-Claude Code.',
    scenes: [
      {
        id: 'intro', title: 'פתיחה', dur: 10,
        cap: [[0, 'מטוטלת פשוטה: משקולת קטנה שתלויה על חוט. ממה תלוי הזמן של תנודה אחת?',
          'מטוטלת פשוטה היא משקולת קטנה שתלויה על חוט. השאלה שלנו היא: ממה תלוי הזמן שלוקח לה לעשות תנודה אחת?']],
        draw(g, t) {
          const f = tt => 15 * DEG * Math.cos(2 * Math.PI * tt / T0);
          pendulum(g, 300, 800, 400, f(t), { trail: trail(f, t) });
          g.title('פיזיקה · מכניקה', 'המטוטלת הפשוטה', 'ממה תלוי זמן המחזור, ואיך מוצאים ממנו את g', t, { x: 1010, size: 100, subW: 860 });
        }
      },
      {
        id: 'setup', title: 'המערכת', dur: 20,
        cap: [
          [0, 'תולים משקולת על חוט באורך <span class="math">L</span>. את <span class="math">L</span> מודדים מנקודת התלייה ועד מרכז המשקולת.',
            'תולים משקולת על חוט. את אורך החוט מודדים מנקודת התלייה ועד מרכז המשקולת.'],
          [7, 'מסיטים את המשקולת בזווית קטנה, עד כ-<span class="num">10°</span>, ומשחררים.',
            'מסיטים את המשקולת בזווית קטנה, עד בערך עשר מעלות, ומשחררים.'],
          [13.5, 'זמן המחזור <span class="math">T</span> הוא הזמן של הלוך ושוב שלם, עד שהמשקולת חוזרת לנקודה שממנה יצאה.',
            'זמן המחזור הוא הזמן של הלוך ושוב שלם, עד שהמשקולת חוזרת בדיוק לנקודה שממנה יצאה.']
        ],
        draw(g, t, s) {
          const C = g.C, A = 10 * DEG, c = s.cap.map(x => x[0]), rel = c[1] + 4.6;   // rel: the moment of release
          const th = tt => (tt < c[1] + 0.3 ? 0 : tt < rel ? A * ease.io(seg(tt, c[1] + 0.3, c[1] + 1.8)) : A * Math.cos(2 * Math.PI * (tt - rel) / T0));
          const P = pendulum(g, 560, 830, 420, th(t), { trail: t > rel ? trail(th, t) : [] });
          // part 1: what L is
          g.alpha(seg(t, 0.4, 1.2) * (1 - seg(t, c[1] - 0.4, c[1] + 0.2)), () => {
            const x = P.hook.x - 70;
            g.dim(x, P.hook.y, x, P.hook.y + P.L, null, { color: C.yellow });
            g.math('L', x - 34, P.hook.y + P.L / 2, { size: 40, color: C.yellow });
            g.callout(P.hook.x + 6, P.hook.y, 1120, P.hook.y, 'נקודת התלייה', { color: C.yellow });
            g.callout(P.bob.x + 6, P.bob.y, 1120, P.bob.y, 'מרכז המשקולת', { color: C.yellow });
          });
          // part 2: the angle
          g.alpha(seg(t, c[1] + 0.6, c[1] + 1.4) * (1 - seg(t, c[2] - 0.4, c[2] + 0.2)), () => {
            angleArc(g, P, Math.max(th(t), 0.001), 'θ', { r: 150 });
            g.label('זווית קטנה: עד כ-10°', 1120, 330, { size: 28, border: C.yellow });
          });
          g.alpha(seg(t, rel - 0.2, rel + 0.2) * (1 - seg(t, c[2] - 0.2, c[2] + 0.2)), () => g.label('משחררים', 1120, 430, { size: 28, color: C.ink, border: C.orange }));
          // part 3: one period = there and back
          g.alpha(seg(t, c[2] + 0.3, c[2] + 1.2), () => {
            const r = P.L, a = A * 1.05, pts = [];
            for (let i = 0; i <= 40; i++) { const an = -a + 2 * a * i / 40; pts.push([P.hook.x + Math.sin(an) * r, P.hook.y + Math.cos(an) * r]); }
            g.poly(pts, { color: C.blue, w: 4, dash: [12, 8] });
            g.label('מחזור אחד = הלוך ושוב', 1120, 330, { size: 28, border: C.blue });
            g.math('T ≈ {1.4 s}', 1120, 420, { size: 44, color: C.blue });
            const k = ((t - rel) % T0) / T0;
            g.text('מהנקודה הימנית, שמאלה, ובחזרה', 1120, 500, { size: 24, color: C.dim });
            g.circle(1120 - 150 + 300 * k, 560, 9, { fill: C.blue });
            g.line(970, 560, 1270, 560, { color: C.faint, w: 3 });
          });
        }
      },
      {
        id: 'measure', title: 'מדידה', dur: 29.5,
        cap: [
          [0, 'במקום למדוד תנודה אחת, מודדים את הזמן של עשר תנודות רצופות.',
            'במקום למדוד תנודה אחת, מודדים את הזמן של עשר תנודות רצופות.'],
          [5.5, 'מפעילים את שעון העצר כשהמשקולת עוברת בנקודה הנמוכה, שם היא הכי מהירה וקל לזהות את הרגע.',
            'מפעילים את שעון העצר כשהמשקולת עוברת בנקודה הנמוכה ביותר. שם היא הכי מהירה, וקל לזהות את הרגע. וסופרים עשר תנודות.'],
          [17, 'מחלקים בעשר: <span class="num">T = 14.2 s / 10 = 1.42 s</span>. כך גם שגיאת התגובה, כ-<span class="num">0.2 s</span>, מתחלקת בעשר.',
            'עכשיו מחלקים בעשר, ומקבלים זמן מחזור של אחת נקודה ארבעים ושתיים שניות. ככה גם הטעות של זמן התגובה שלנו, בערך שתי עשיריות שנייה, מתחלקת בעשר.']
        ],
        draw(g, t, s) {
          const C = g.C, A = 10 * DEG, c = s.cap.map(x => x[0]), FF = 3, start = c[1] + 0.5, stop = start + 14.2 / FF;
          const real = tt => (tt < start ? tt - start : tt < stop ? (tt - start) * FF : 14.2 + (tt - stop));
          const th = tt => swing(A, real(tt));
          const P = pendulum(g, 380, 830, 420, th(t), { trail: trail(th, t) });
          const clock = clamp((t - start) * FF, 0, 14.2), n = Math.min(10, Math.floor(clock / T0 + 1e-6));
          g.stopwatch(1150, 300, 130, clock, { fmt: s => s.toFixed(2) + ' s' });
          g.label(`תנודות: ${n} / 10`, 1150, 530, { size: 30, border: n === 10 ? C.green : C.faint, color: n === 10 ? C.green : C.ink });
          g.alpha(seg(t, start - 0.3, start + 0.1) * (1 - seg(t, start + 1.7, start + 2.3)), () => { g.pulse(P.hook.x, P.hook.y + P.L, 30, t, C.yellow); g.callout(P.hook.x + 30, P.hook.y + P.L, 760, 640, 'הנקודה הנמוכה: מתחילים כאן', { color: C.yellow }); });
          g.alpha(t > start && t < stop + 0.4 ? 1 : 0, () => g.label('הרצה מהירה', 1150, 92, { size: 24, color: C.orange, border: C.orange }));
          g.alpha(seg(t, c[2] + 0.2, c[2] + 1), () => {
            g.math('T = {14.2 s} / 10 = {1.42 s}', 1150, 640, { size: 46, color: C.yellow });
          });
          g.alpha(seg(t, c[2] + 5.5, c[2] + 6.3), () => {
            g.text('שגיאת התגובה מתחלקת בעשר:', 1150, 730, { size: 26, color: C.dim });
            g.math('{0.2 s} / 10 = {0.02 s}', 1150, 790, { size: 36, color: C.ink });
          });
        }
      },
      {
        id: 'graph', title: 'הגרף', dur: 32,
        cap: [
          [0, 'לפי המודל <span class="math">T = 2π√(L/g)</span>. מעלים בריבוע: <span class="math">T² = (4π²/g)·L</span>.',
            'לפי המודל, זמן המחזור תלוי רק באורך החוט ובתאוצת הנפילה החופשית. אם מעלים את שני האגפים בריבוע, מקבלים קשר קווי בין ריבוע זמן המחזור לבין האורך.'],
          [11.6, 'חוזרים על המדידה בחמישה אורכים ומשרטטים <span class="math">T²</span> כפונקציה של <span class="math">L</span>.',
            'חוזרים על המדידה בחמישה אורכים שונים, ומשרטטים את ריבוע זמן המחזור כפונקציה של אורך החוט.'],
          [20, 'הנקודות על קו ישר דרך הראשית. השיפוע הוא <span class="math">4π²/g</span>, ולכן <span class="num">g = 4π² / 4.04 ≈ 9.8 m/s²</span>.',
            'הנקודות יושבות על קו ישר שעובר דרך הראשית. השיפוע שווה לארבע פאי בריבוע חלקי תאוצת הנפילה, ומכאן מקבלים בערך תשע נקודה שמונה מטר לשנייה בריבוע.']
        ],
        draw(g, t, s) {
          const C = g.C, c = s.cap.map(x => x[0]);
          // the model, then the graph
          g.alpha(1 - seg(t, c[1], c[1] + 0.6), () => {
            g.text('המודל', 800, 220, { size: 30, weight: 600, color: C.orange });
            g.math('T = 2π √(L / g)', 800, 330, { size: 64 });
            g.alpha(seg(t, 5.5, 6.3), () => {
              g.arrow(800, 390, 800, 470, { color: C.dim, w: 3 });
              g.text('מעלים בריבוע', 900, 430, { size: 24, color: C.dim, align: 'left' });
              g.math('T^2 = (4π^2 / g) · L', 800, 540, { size: 64, color: C.yellow });
            });
            g.alpha(seg(t, 8.5, 9.3), () => g.label('קו ישר דרך הראשית, השיפוע 4π²/g', 800, 650, { size: 28, border: C.yellow }));
          });
          const a = seg(t, c[1] + 0.3, c[1] + 1);
          if (a <= 0) return;
          g.alpha(a, () => {
            const P = g.plot({ x: 170, y: 190, w: 700, h: 520 }, { xmin: 0, xmax: 1.1, ymin: 0, ymax: 4.6, xticks: [0, 0.2, 0.4, 0.6, 0.8, 1], yticks: [0, 1, 2, 3, 4], xfmt: v => v.toFixed(1), xlab: 'L (m)', ylab: 'T² (s²)' });
            g.table(1060, 200, [
              { head: 'L (m)', vals: DATA.L.map(v => v.toFixed(2)) },
              { head: 'T (s)', vals: DATA.T.map(v => v.toFixed(2)) },
              { head: 'T² (s²)', vals: DATA.T2.map(v => v.toFixed(2)) }
            ], { dir: 'rtl', upto: (t - c[1] - 0.5) / 0.7 });
            g.pts(P, DATA.L.map((l, i) => [l, DATA.T2[i]]), { upto: (t - c[1] - 1.2) / 0.7, color: C.blue });
            g.fn(P, x => SLOPE * x, 0, 1.08, { progress: seg(t, c[2] + 0.2, c[2] + 1.6), color: C.orange, w: 4 });
            g.alpha(seg(t, c[2] + 3.5, c[2] + 4.3), () => g.label(`שיפוע = ${SLOPE.toFixed(2)} s²/m`, P.X(0.62), P.Y(3.9), { size: 26, border: C.orange }));
            g.alpha(seg(t, c[2] + 6.5, c[2] + 7.3), () => {
              g.panel(1060, 520, 450, 210, { title: 'מה יוצא', accent: C.green });
              g.math('g = 4π^2 / {4.04}', 1285, 590, { size: 40 });
              g.math('g ≈ {9.8 m/s}^2', 1285, 670, { size: 44, color: C.green });
            });
          });
        }
      },
      {
        id: 'ideal', title: 'מודל מול מציאות', dur: 33.5,
        cap: [
          [0, 'הנוסחה נכונה בעולם אידיאלי. מה הנחנו בדרך?',
            'הנוסחה הזאת נכונה בעולם אידיאלי. בואו נראה מה הנחנו בדרך.'],
          [5.9, 'זווית קטנה: ב-<span class="num">10°</span> הסטייה בזמן המחזור כ-<span class="num">0.2%</span>, וב-<span class="num">30°</span> כבר כ-<span class="num">1.7%</span>.',
            'קודם כול, זווית קטנה. בעשר מעלות הטעות בזמן המחזור היא בערך שתי עשיריות האחוז, אבל בשלושים מעלות היא כבר כמעט שני אחוזים.'],
          [16.3, 'חוט קל שלא מתמתח ומשקולת קטנה: לכן מודדים את <span class="math">L</span> עד מרכז המשקולת.',
            'הנחנו גם שהחוט קל ולא מתמתח, ושהמשקולת קטנה כמו נקודה. בגלל זה מודדים את האורך עד מרכז המשקולת.'],
          [25.4, 'בלי התנגדות אוויר: במציאות התנודות הולכות וקטנות, אבל זמן המחזור כמעט לא משתנה.',
            'ולבסוף, הזנחנו את התנגדות האוויר. במציאות התנודות הולכות וקטנות, אבל זמן המחזור כמעט לא משתנה.']
        ],
        draw(g, t, s) {
          const C = g.C, c = s.cap.map(x => x[0]);
          const amp = tt => (tt < c[1] ? 10 : tt < c[2] ? lerp(10, 30, ease.io(seg(tt, c[1] + 0.3, c[1] + 1.8))) * (1 - seg(tt, c[2] - 0.8, c[2])) + 10 * seg(tt, c[2] - 0.8, c[2])
            : tt < c[3] ? 10 : 10 * Math.exp(-(tt - c[3]) / 2.6)) * DEG;
          const th = tt => amp(tt) * Math.sin(2 * Math.PI * tt / T0);
          const P = pendulum(g, 260, 830, 420, th(t), { trail: trail(th, t) });
          g.text('מה הנחנו?', 1500, 150, { size: 40, weight: 700, align: 'right' });
          g.bullets([
            { text: 'זווית קטנה: הסטייה כ-0.2% ב-10°, וכ-1.7% ב-30°', color: C.yellow },
            { text: 'חוט קל שלא מתמתח, משקולת קטנה: L נמדד עד מרכז המשקולת', color: C.blue },
            { text: 'בלי התנגדות אוויר: המשרעת קטנה, אבל T כמעט לא משתנה', color: C.green }
          ], 1500, 250, { size: 30, maxW: 720, gap: 34, upto: seg(t, c[1], c[1] + 0.8) + seg(t, c[2], c[2] + 0.8) + seg(t, c[3], c[3] + 0.8) });
          g.alpha(seg(t, c[1] + 1.6, c[1] + 2.4) * (1 - seg(t, c[2] - 1.2, c[2] - 0.4)), () => angleArc(g, P, Math.max(Math.abs(th(t)), 0.001) * Math.sign(th(t) || 1), null, { r: 140 }));
          g.alpha(seg(t, c[1] + 2, c[1] + 2.8) * (1 - seg(t, c[2] - 1.2, c[2] - 0.4)), () => g.label('30°: T ארוך בכ-1.7%', 450, 110, { size: 26, border: C.yellow }));
          g.alpha(seg(t, c[2] + 0.6, c[2] + 1.4) * (1 - seg(t, c[3] - 0.6, c[3])), () => g.callout(P.bob.x + 20, P.bob.y, 720, 780, 'L עד מרכז המשקולת', { color: C.blue }));
          g.alpha(seg(t, c[3] + 0.6, c[3] + 1.4), () => {
            const e = Math.exp(-(t - c[3]) / 2.6), x0 = P.hook.x, y0 = P.hook.y + P.L + 60, w = Math.sin(10 * DEG) * P.L;
            g.label('המשרעת קטנה, T נשאר', 450, 110, { size: 26, border: C.green });
            g.line(x0 - w, y0, x0 + w, y0, { color: C.faint, w: 3, dash: [6, 6] });
            g.line(x0 - w * e, y0, x0 + w * e, y0, { color: C.green, w: 5 });
            g.text('משרעת', x0, y0 + 30, { size: 22, color: C.dim });
          });
        }
      }
    ]
  };
})();
