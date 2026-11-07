// Scene 3 — Countdown (assets/videos/scene-03-countdown.mp4, 8s)
export default {
  key: 'countdown',
  title: 'Countdown',
  file: 'scene-03-countdown.mp4',
  duration: 8,
  onEnter({ effects }) {
    effects?.setMode('overlay');
  },
  onExit() {},
};
