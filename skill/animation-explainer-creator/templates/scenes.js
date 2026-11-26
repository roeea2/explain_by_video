/* scenes.js - the film. Replace this starter with the real script and drawings.
   Scene: { id, title, dur, cap: [[t, onScreenHtml, spokenText], ...], draw(g, t, s) }
     id     stable short name (narration files are keyed by it, so keep it when you reorder scenes)
     dur    the scene's written length in seconds (segments stretch later to fit the recorded voice)
     cap    captions: start time, the caption shown under the film (HTML), and the line the narrator says
     draw   paints one frame at local time t. Depend on t only. The canvas is 1600 x 900.
   See references/engine-api.md for every g.* helper and references/scene-craft.md for timing and layout. */
window.FILM = {
  title: '{{TITLE}}',
  kicker: '{{KICKER}}',
  lede: '{{DESCRIPTION}}',
  lang: '{{LANG}}',
  scenes: [
    {
      id: 'intro', title: '{{TITLE}}', dur: 6,
      cap: [[0, '{{TITLE}}', '{{TITLE}}']],
      draw(g, t) {
        g.title('{{KICKER}}', '{{TITLE}}', '{{DESCRIPTION}}', t);
      }
    },
    {
      id: 'idea', title: '{{IDEA}}', dur: 9,
      cap: [
        [0, '{{IDEA}}', '{{IDEA}}'],
        [4.5, '{{IDEA}}', '{{IDEA}}']
      ],
      draw(g, t) {
        const C = g.C;
        g.panel(200, 200, 1200, 460, { title: '{{IDEA}}', accent: C.blue });
        g.alpha(g.seg(t, 0.3, 1.2), () => g.math('y = ax^2 + b', 800, 360, { size: 64 }));
        g.alpha(g.seg(t, 4.5, 5.4), () => g.arrow(600, 520, 1000, 520, { color: C.orange, w: 5 }));
      }
    }
  ]
};
