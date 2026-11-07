// Scene 2 — Matchstick Ignition (assets/videos/scene-02-matchstick-ignition.mp4, 8s)
export default {
  key: 'ignition',
  title: 'Matchstick Ignition',
  file: 'scene-02-matchstick-ignition.mp4',
  duration: 8,
  onEnter({ effects }) {
    // A little extra ember glow while the fuse burns; the footage stays dominant.
    effects?.setMode('overlay', { embers: 0.7 });
  },
  onExit() {},
};
