// ============================================================================
// script.js — DIWALI COSMIC (SMOOTH & CLEAN)
// ============================================================================
import { SCENES } from './scenes/index.js';
import { VideoController } from './video-controller.js';
import { EffectsManager } from './effects-manager.js';
import { MatchstickInteraction } from './matchstick-interaction.js';
import { AnimationController } from './animation-controller.js';
import { UIController } from './ui-controller.js';
import { SceneManager } from './scene-manager.js';
import { AudioManager } from './audio-manager.js';

window.__DIWALI_BOOTED = true;
const bootFail = document.getElementById('boot-fail');
if (bootFail) bootFail.hidden = true;

const CONFIG = {
  shareUrl: null,
  shareMessage: '✨ HAPPY DIWALI TO ALL ✨\nMay your life be filled with endless light.\n\nDIWALI COSMIC — A Celebration Beyond the Stars',
};

const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const isMobile = window.matchMedia('(pointer: coarse)').matches || Math.min(window.innerWidth, window.innerHeight) < 600;

const ui = new UIController();
const audio = new AudioManager();
window.__diwali_audio = audio;

if (!window.gsap) {
  ui.showDialog({
    title: 'Animation library did not load',
    body: 'GSAP could not be downloaded. Check your internet connection and reload.',
    actions: [{ label: 'Reload', primary: true, onClick: () => location.reload() }],
  });
  throw new Error('GSAP not available');
}

try {
  const shareUrl = CONFIG.shareUrl || location.href.split('#')[0];
  ui.setShareHref(`https://wa.me/?text=${encodeURIComponent(`${CONFIG.shareMessage}\n${shareUrl}`)}`);
} catch (e) { /* optional element missing */ }

const effects = new EffectsManager(document.getElementById('fx-canvas'), { reducedMotion, isMobile });
if (!effects.init()) effects.ok = false;
const fx = effects.ok ? effects : null;

const video = new VideoController({
  elements: [document.getElementById('video-a'), document.getElementById('video-b')],
  scenes: SCENES,
});

const anim = new AnimationController({ el: ui.el, effects: fx, reducedMotion });

const createMatch = (callbacks) => new MatchstickInteraction({
  stage: document.getElementById('match-stage'),
  canvas: document.getElementById('match-canvas'),
  reducedMotion,
  isMobile,
  ...callbacks,
});

const manager = new SceneManager({ scenes: SCENES, video, ui, effects: fx, anim, createMatch });
manager.boot();

window.__diwali = { manager, video, effects: fx, audio };

// ============================================================================
// SMOOTH UI BINDINGS
// ============================================================================

// 1. LIVE COUNTDOWN
const diwaliDate = new Date('2026-11-08T00:00:00+05:30').getTime();
const countdownEl = document.getElementById('live-countdown');
if (countdownEl) {
  const updateCountdown = () => {
    const diff = diwaliDate - Date.now();
    if (diff > 0) {
      const d = Math.floor(diff / 86400000);
      const h = Math.floor((diff % 86400000) / 3600000);
      const m = Math.floor((diff % 3600000) / 60000);
      const s = Math.floor((diff % 60000) / 1000);
      countdownEl.textContent = `🪔 ${d}d ${h}h ${m}m ${s}s to Diwali ✨`;
    } else {
      countdownEl.textContent = `🎉 Happy Diwali! ✨`;
    }
  };
  updateCountdown();
  setInterval(updateCountdown, 1000);
}

// 2. CURSOR TRAIL
if (!isMobile && !reducedMotion) {
  const trailContainer = document.getElementById('cursor-trail');
  let lastSpawn = 0;
  document.addEventListener('mousemove', (e) => {
    const now = Date.now();
    if (now - lastSpawn < 40) return;
    lastSpawn = now;
    if (!trailContainer) return;
    const p = document.createElement('div');
    p.className = 'cursor-particle';
    p.style.left = e.clientX + 'px';
    p.style.top = e.clientY + 'px';
    trailContainer.appendChild(p);
    setTimeout(() => p.remove(), 1000);
  });
}

// 3. RANGOLI BACKDROP
const rangoliSvg = `
<svg class="rangoli-svg" viewBox="0 0 400 400" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
  <g fill="none" stroke="#f0d28c" stroke-width="1.5" opacity="0.6">
    ${Array.from({ length: 24 }, (_, i) => {
      const a = (i / 24) * Math.PI * 2;
      const x = 200 + Math.cos(a) * 180;
      const y = 200 + Math.sin(a) * 180;
      return `<line x1="200" y1="200" x2="${x}" y2="${y}" opacity="0.4"/>`;
    }).join('')}
    <circle cx="200" cy="200" r="180" />
    <circle cx="200" cy="200" r="140" />
    <circle cx="200" cy="200" r="100" />
    <circle cx="200" cy="200" r="60" />
    <circle cx="200" cy="200" r="20" fill="#f0d28c" fill-opacity="0.3"/>
    ${Array.from({ length: 12 }, (_, i) => {
      const a = (i / 12) * Math.PI * 2;
      const x1 = 200 + Math.cos(a) * 60;
      const y1 = 200 + Math.sin(a) * 60;
      const x2 = 200 + Math.cos(a + 0.15) * 140;
      const y2 = 200 + Math.sin(a + 0.15) * 140;
      return `<path d="M${x1},${y1} Q${(x1 + x2) / 2 + Math.cos(a + 0.5) * 30},${(y1 + y2) / 2 + Math.sin(a + 0.5) * 30} ${x2},${y2}" opacity="0.6"/>`;
    }).join('')}
  </g>
</svg>`;

const rangoliContainer = document.createElement('div');
rangoliContainer.className = 'rangoli-bg';
rangoliContainer.innerHTML = rangoliSvg;
const fxLayer = document.querySelector('.fx-css');
if (fxLayer) fxLayer.appendChild(rangoliContainer);

const activateRangoli = () => { if (rangoliContainer) rangoliContainer.classList.add('active'); };
const deactivateRangoli = () => { if (rangoliContainer) rangoliContainer.classList.remove('active'); };

// 4. EFFECTS FUNCTIONS
function createLightBurst(x, y) {
  const burst = document.createElement('div');
  burst.className = 'light-burst';
  burst.style.left = (x - 100) + 'px';
  burst.style.top = (y - 100) + 'px';
  document.body.appendChild(burst);
  setTimeout(() => burst.remove(), 1400);
}

function spawnFloatingLantern() {
  const lantern = document.createElement('div');
  lantern.className = 'floating-lantern';
  lantern.textContent = ['🪔', '🏮', '✨', '🌟', '💫'][Math.floor(Math.random() * 5)];
  lantern.style.left = Math.random() * 100 + 'vw';
  lantern.style.bottom = '-50px';
  lantern.style.animationDuration = (6 + Math.random() * 4) + 's';
  document.body.appendChild(lantern);
  setTimeout(() => lantern.remove(), 12000);
}

let lanternInterval = null;
function startLanterns() {
  if (lanternInterval) return;
  lanternInterval = setInterval(spawnFloatingLantern, 1800);
}
function stopLanterns() {
  clearInterval(lanternInterval);
  lanternInterval = null;
}

function launchConfetti(count = 80) {
  const colors = ['#f0d28c', '#ff9a3c', '#ffd700', '#ff6b9d', '#c9a24a', '#fff8d8'];
  for (let i = 0; i < count; i++) {
    const piece = document.createElement('div');
    piece.className = 'confetti-piece';
    piece.style.left = Math.random() * 100 + 'vw';
    piece.style.top = '-20px';
    piece.style.background = colors[Math.floor(Math.random() * colors.length)];
    piece.style.animationDuration = (2.5 + Math.random() * 2.5) + 's';
    piece.style.animationDelay = Math.random() * 0.5 + 's';
    piece.style.transform = `rotate(${Math.random() * 360}deg)`;
    document.body.appendChild(piece);
    setTimeout(() => piece.remove(), 6000);
  }
}

function createTwinkleStars(count = 40) {
  const layer = document.querySelector('.fx-css');
  if (!layer) return;
  for (let i = 0; i < count; i++) {
    const star = document.createElement('div');
    star.className = 'twinkle';
    star.style.left = Math.random() * 100 + '%';
    star.style.top = Math.random() * 100 + '%';
    star.style.animationDelay = Math.random() * 3 + 's';
    star.style.animationDuration = (2 + Math.random() * 3) + 's';
    layer.appendChild(star);
  }
}
createTwinkleStars(40);

// 5. BUTTON SPARKLE
document.querySelectorAll('.btn').forEach(btn => {
  btn.addEventListener('pointermove', (e) => {
    const rect = btn.getBoundingClientRect();
    btn.style.setProperty('--mx', ((e.clientX - rect.left) / rect.width) * 100 + '%');
    btn.style.setProperty('--my', ((e.clientY - rect.top) / rect.height) * 100 + '%');
  });
});

// 6. FIREWORKS ON CLICK
document.getElementById('app').addEventListener('click', (e) => {
  const phase = ui.el.app.dataset.phase;
  if (phase === 'playing' || phase === 'finale') {
    if (fx && fx.ok) {
      const nx = (e.clientX / window.innerWidth) * 2 - 1;
      const ny = -((e.clientY / window.innerHeight) * 2 - 1);
      fx.burst(nx, ny, { count: 80 });
    }
    createLightBurst(e.clientX, e.clientY);
    audio.playSfx('firework');
  }
  if (isMobile && navigator.vibrate) navigator.vibrate(50);
});

document.getElementById('btn-begin')?.addEventListener('click', () => {
  audio.start();
}, { once: true });

document.getElementById('btn-ignite')?.addEventListener('click', () => {
  audio.playSfx('whoosh');
});

// 7. QUALITY SETTINGS
document.getElementById('quality-select')?.addEventListener('change', (e) => {
  const val = e.target.value;
  if (!fx) return;
  if (val === 'low') fx.setMode('fireworks', { stars: 0.2, dust: 0.1 });
  else if (val === 'med') fx.setMode('fireworks', { stars: 0.5, dust: 0.3 });
  else if (val === 'high') fx.setMode('fireworks', { stars: 1, dust: 1 });
  else fx.setMode('fireworks');
});

// 8. GLOBAL COUNTER
const counterEl = document.createElement('div');
counterEl.id = 'global-counter';
document.getElementById('app').appendChild(counterEl);

function updateGlobalCounter() {
  const now = Date.now();
  const seed = Math.floor(now / 5000);
  const base = 1250000 + (now % 100000);
  const jitter = Math.floor(Math.sin(seed) * 150);
  counterEl.innerHTML = `✨ <strong>${(base + jitter).toLocaleString()}</strong> celebrating`;
}
updateGlobalCounter();
setInterval(updateGlobalCounter, 5000);

// 9. DIYA WALL
const diyaWall = document.getElementById('diya-wall');
if (diyaWall) {
  for (let i = 0; i < 9; i++) {
    const diya = document.createElement('div');
    diya.className = 'diya-item';
    diya.textContent = '🔥';
    diya.style.opacity = '0.3';
    diya.addEventListener('click', () => {
      diya.classList.add('lit');
      diya.style.opacity = '1';
      if (fx && fx.ok) {
        const rect = diya.getBoundingClientRect();
        const nx = (rect.left / window.innerWidth) * 2 - 1;
        const ny = -((rect.top / window.innerHeight) * 2 - 1);
        fx.burst(nx, ny, { count: 20 });
      }
      audio.playSfx('chime');
    });
    diyaWall.appendChild(diya);
  }
}

// 10. SECRET EASTER EGG
let titleClicks = 0;
const finaleTitle = document.getElementById('finale-title');
const secretMsg = document.getElementById('secret-msg');
if (finaleTitle) {
  finaleTitle.addEventListener('click', () => {
    titleClicks++;
    if (titleClicks === 5) {
      secretMsg.style.opacity = '1';
      if (fx && fx.ok) fx.burst(0, 0, { count: 150 });
      launchConfetti(120);
      audio.playSfx('chime');
      setTimeout(() => { titleClicks = 0; secretMsg.style.opacity = '0'; }, 5000);
    }
  });
}

// ==========================================================================
// 11. FINALE HOOKS
// ==========================================================================
const finaleEl = document.getElementById('finale');
if (finaleEl) {
  const finaleObserver = new MutationObserver(() => {
    if (!finaleEl.hidden) {
      activateRangoli();
      startLanterns();
      launchConfetti(100);
      audio.playSfx('chime');
    } else {
      deactivateRangoli();
      stopLanterns();
    }
  });
  finaleObserver.observe(finaleEl, { attributes: true, attributeFilter: ['hidden'] });
}