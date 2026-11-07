// Scene 4 — Rocket Launch (assets/videos/scene-04-rocket-launch.mp4, 8s)
export default {
  key: 'launch',
  title: 'Rocket Launch',
  file: 'scene-04-rocket-launch.mp4',
  duration: 8,
  onEnter({ effects, anim }) {
    effects?.setMode('overlay', { embers: 0.85, dust: 0.3 });
    anim?.rumble(true); // very subtle camera rumble (disabled for reduced-motion)
  },
  onExit({ anim }) {
    anim?.rumble(false);
  },
};
