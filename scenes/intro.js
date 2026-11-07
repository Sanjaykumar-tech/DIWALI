// Scene 1 — Cosmic Intro (assets/videos/scene-01-cosmic-intro.mp4, 8s)
export default {
  key: 'intro',
  title: 'Cosmic Intro',
  file: 'scene-01-cosmic-intro.mp4',
  duration: 8,
  onEnter({ effects }) {
    effects?.setMode('overlay');
  },
  onExit() {},
};
