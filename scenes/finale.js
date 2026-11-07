// Scene 7 — Diwali Finale (assets/videos/scene-07-diwali-finale.mp4, 8s)
// When this clip ends, the SceneManager moves to FINALE and reveals the greeting.
export default {
  key: 'finale',
  title: 'Diwali Finale',
  file: 'scene-07-diwali-finale.mp4',
  duration: 8,
  onEnter({ effects }) {
    effects?.setMode('fireworks');
    effects?.startFireworks(0.55);
  },
  onExit({ effects }) {
    effects?.stopFireworks();
  },
};
