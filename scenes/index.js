// Central scene registry. Order here IS the playback order.
// Filenames match the original Google Flow exports exactly — do not rename them.
import intro from './intro.js';
import ignition from './ignition.js';
import countdown from './countdown.js';
import launch from './launch.js';
import ascent from './ascent.js';
import fireworks from './fireworks.js';
import finale from './finale.js';

export const VIDEO_BASE = 'assets/videos/';

export const SCENES = [intro, ignition, countdown, launch, ascent, fireworks, finale].map((scene, index) => ({
  ...scene,
  index,
  src: VIDEO_BASE + scene.file,
}));

export const TOTAL_DURATION = SCENES.reduce((sum, s) => sum + s.duration, 0); // 60 seconds
