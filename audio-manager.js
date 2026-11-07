// ============================================================================
// audio-manager.js — Procedural ambient music + SFX via Web Audio API
// ============================================================================
export class AudioManager {
  constructor() {
    this.ctx = null;
    this.masterGain = null;
    this.ambientGain = null;
    this.enabled = false;
    this.started = false;
    this.volume = 0.35;
  }

  _ensureContext() {
    if (this.ctx) return;
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) { console.warn('[audio] Web Audio unsupported'); return; }
    this.ctx = new AC();
    this.masterGain = this.ctx.createGain();
    this.masterGain.gain.value = 0.0;
    this.masterGain.connect(this.ctx.destination);
  }

  async start() {
    this._ensureContext();
    if (!this.ctx) return false;
    if (this.ctx.state === 'suspended') await this.ctx.resume();
    if (!this.started) {
      this._buildAmbient();
      this.started = true;
    }
    this.enabled = true;
    this.masterGain.gain.linearRampToValueAtTime(this.volume, this.ctx.currentTime + 2);
    return true;
  }

  stop() {
    if (!this.ctx) return;
    this.enabled = false;
    this.masterGain.gain.linearRampToValueAtTime(0.0, this.ctx.currentTime + 1.5);
  }

  setVolume(v) {
    this.volume = Math.max(0, Math.min(1, v));
    if (!this.ctx) return;
    this.masterGain.gain.linearRampToValueAtTime(this.volume, this.ctx.currentTime + 0.3);
  }

  _buildAmbient() {
    const ctx = this.ctx;
    this.ambientGain = ctx.createGain();
    this.ambientGain.gain.value = 0.5;
    this.ambientGain.connect(this.masterGain);

    // Low drone
    const drone = ctx.createOscillator();
    drone.type = 'sine';
    drone.frequency.value = 55;
    const droneGain = ctx.createGain();
    droneGain.gain.value = 0.25;
    drone.connect(droneGain).connect(this.ambientGain);
    drone.start();

    // Fifth
    const fifth = ctx.createOscillator();
    fifth.type = 'sine';
    fifth.frequency.value = 82.5;
    const fifthGain = ctx.createGain();
    fifthGain.gain.value = 0.15;
    fifth.connect(fifthGain).connect(this.ambientGain);
    fifth.start();

    // Shimmering pad
    const pad = ctx.createOscillator();
    pad.type = 'triangle';
    pad.frequency.value = 220;
    const padFilter = ctx.createBiquadFilter();
    padFilter.type = 'lowpass';
    padFilter.frequency.value = 800;
    padFilter.Q.value = 4;
    const padGain = ctx.createGain();
    padGain.gain.value = 0.08;
    pad.connect(padFilter).connect(padGain).connect(this.ambientGain);
    pad.start();

    // LFO to animate filter
    const lfo = ctx.createOscillator();
    lfo.frequency.value = 0.15;
    const lfoGain = ctx.createGain();
    lfoGain.gain.value = 400;
    lfo.connect(lfoGain).connect(padFilter.frequency);
    lfo.start();

    // Sparkle bell
    const sparkle = () => {
      if (!this.enabled) { setTimeout(sparkle, 4000); return; }
      const t = ctx.currentTime;
      const osc = ctx.createOscillator();
      osc.type = 'sine';
      osc.frequency.value = 1200 + Math.random() * 800;
      const g = ctx.createGain();
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(0.12, t + 0.02);
      g.gain.exponentialRampToValueAtTime(0.0001, t + 1.8);
      osc.connect(g).connect(this.ambientGain);
      osc.start(t);
      osc.stop(t + 2);
      setTimeout(sparkle, 3000 + Math.random() * 4000);
    };
    setTimeout(sparkle, 2000);
  }

  playSfx(name) {
    if (!this.ctx || !this.enabled) return;
    const ctx = this.ctx;
    const t = ctx.currentTime;
    switch (name) {
      case 'ignite': {
        const src = ctx.createBufferSource();
        src.buffer = this._noiseBuffer(1.5);
        const f = ctx.createBiquadFilter();
        f.type = 'highpass'; f.frequency.value = 2000;
        const g = ctx.createGain();
        g.gain.setValueAtTime(0.0001, t);
        g.gain.exponentialRampToValueAtTime(0.6, t + 0.05);
        g.gain.exponentialRampToValueAtTime(0.0001, t + 1.2);
        src.connect(f).connect(g).connect(this.masterGain);
        src.start(t);
        break;
      }
      case 'whoosh': {
        const src = ctx.createBufferSource();
        src.buffer = this._noiseBuffer(1.2);
        const f = ctx.createBiquadFilter();
        f.type = 'bandpass';
        f.frequency.setValueAtTime(300, t);
        f.frequency.exponentialRampToValueAtTime(3000, t + 0.8);
        const g = ctx.createGain();
        g.gain.setValueAtTime(0.0001, t);
        g.gain.exponentialRampToValueAtTime(0.4, t + 0.1);
        g.gain.exponentialRampToValueAtTime(0.0001, t + 1.0);
        src.connect(f).connect(g).connect(this.masterGain);
        src.start(t);
        break;
      }
      case 'firework': {
        const src = ctx.createBufferSource();
        src.buffer = this._noiseBuffer(2);
        const f = ctx.createBiquadFilter();
        f.type = 'lowpass'; f.frequency.value = 1500;
        const g = ctx.createGain();
        g.gain.setValueAtTime(0.0001, t);
        g.gain.exponentialRampToValueAtTime(0.5, t + 0.02);
        g.gain.exponentialRampToValueAtTime(0.0001, t + 1.5);
        src.connect(f).connect(g).connect(this.masterGain);
        src.start(t);
        break;
      }
      case 'chime': {
        [523.25, 659.25, 783.99].forEach((freq, i) => {
          const osc = ctx.createOscillator();
          osc.type = 'sine';
          osc.frequency.value = freq;
          const g = ctx.createGain();
          g.gain.setValueAtTime(0.0001, t + i * 0.08);
          g.gain.exponentialRampToValueAtTime(0.2, t + i * 0.08 + 0.02);
          g.gain.exponentialRampToValueAtTime(0.0001, t + i * 0.08 + 1.2);
          osc.connect(g).connect(this.masterGain);
          osc.start(t + i * 0.08);
          osc.stop(t + i * 0.08 + 1.3);
        });
        break;
      }
    }
  }

  _noiseBuffer(seconds) {
    const ctx = this.ctx;
    const len = ctx.sampleRate * seconds;
    const buf = ctx.createBuffer(1, len, ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
    return buf;
  }
}