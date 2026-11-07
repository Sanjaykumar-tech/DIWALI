// Scene 5 — Rocket Ascent (assets/videos/scene-05-rocket-ascent.mp4, 8s)
export default {
  key: 'ascent',
  title: 'Rocket Ascent',
  file: 'scene-05-rocket-ascent.mp4',
  duration: 8,
  onEnter({ effects }) {
    effects?.setMode('overlay', { dust: 0.38, embers: 0.2 });
  },
  onExit() {},
};
