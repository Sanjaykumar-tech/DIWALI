// Scene 6 — Grand Fireworks (assets/videos/scene-06-grand-fireworks.mp4, 12s)
export default {
  key: 'fireworks',
  title: 'Grand Fireworks',
  file: 'scene-06-grand-fireworks.mp4',
  duration: 12,
  onEnter({ effects }) {
    effects?.setMode('fireworks');
    effects?.startFireworks(1);
  },
  onExit({ effects }) {
    effects?.stopFireworks();
  },
};
