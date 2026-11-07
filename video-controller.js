// ============================================================================
// video-controller.js — SMOOTH CROSSFADE + AUDIO FADE UPDATE
// ============================================================================
const FADE_MS = 1200; // Increased for a smoother cinematic crossfade
const LOAD_TIMEOUT = 25000;
const STALL_MS = 15000;

const MEDIA_ERRORS = {
  1: 'loading was aborted',
  2: 'a network error occurred',
  3: 'the file could not be decoded',
  4: 'the file is missing or not a supported video',
};

export class VideoController extends EventTarget {
  constructor({ elements, scenes }) {
    super();
    this.scenes = scenes;
    this.slots = elements.map((el) => {
      el.muted = true;
      el.playsInline = true;
      el.style.transition = `opacity ${FADE_MS}ms ease-in-out`; // JS fallback for smooth fade
      return { el, index: -1, ready: false, promise: null };
    });
    this.sound = false;
    this.activeSlot = null;
    this.playingIndex = -1;
    this.token = 0;
    this._raf = 0;
    this._unwatch = null;
    this._autoPaused = false;
    this._timers = new Set();
  }

  _emit(name, detail = {}) {
    this.dispatchEvent(new CustomEvent(name, { detail }));
  }

  _later(fn, ms) {
    const id = setTimeout(() => { this._timers.delete(id); fn(); }, ms);
    this._timers.add(id);
  }

  setSound(on) {
    this.sound = Boolean(on);
    this.slots.forEach((s) => { s.el.muted = !this.sound; });
    this._emit('soundchange', { on: this.sound });
  }

  // ---------------------------------------------------------------- assets --
  async probe(url) {
    try {
      let res = await fetch(url, { method: 'HEAD', cache: 'no-store' });
      if ([403, 405, 501].includes(res.status)) {
        res = await fetch(url, { headers: { Range: 'bytes=0-0' }, cache: 'no-store' });
        res.body?.cancel?.();
      }
      if (!(res.ok || res.status === 206)) return { ok: false, reason: `HTTP ${res.status}` };
      const type = (res.headers.get('content-type') || '').toLowerCase();
      if (type.includes('text/html')) return { ok: false, reason: 'server returned a web page instead of a video' };
      return { ok: true };
    } catch {
      return { ok: false, reason: 'could not be reached (is the site running from a local web server?)' };
    }
  }

  async checkAssets(onProgress) {
    let done = 0;
    return Promise.all(this.scenes.map(async (scene) => {
      const r = await this.probe(scene.src);
      done += 1;
      onProgress?.(done / this.scenes.length);
      return { scene, ok: r.ok, reason: r.reason };
    }));
  }

  // --------------------------------------------------------------- loading --
  _reset(slot) {
    const el = slot.el;
    try { el.pause(); } catch { /* ignore */ }
    el.removeAttribute('src');
    el.load(); // releases the decoder and buffers
    slot.index = -1;
    slot.ready = false;
    slot.promise = null;
  }

  _load(slot, index, onProgress) {
    this._reset(slot);
    slot.index = index;
    const scene = this.scenes[index];
    const el = slot.el;

    slot.promise = new Promise((resolve, reject) => {
      let settled = false;
      const finish = (fn) => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        el.removeEventListener('canplay', onReady);
        el.removeEventListener('loadeddata', onReady);
        el.removeEventListener('error', onError);
        el.removeEventListener('progress', onProg);
        fn();
      };
      const onReady = () => finish(() => { slot.ready = true; onProgress?.(1); resolve(slot); });
      const onError = () => finish(() => {
        const code = el.error?.code;
        reject(new Error(`${scene.file}: ${MEDIA_ERRORS[code] || 'could not be loaded'}.`));
      });
      const onProg = () => {
        if (el.duration > 0 && el.buffered.length) {
          onProgress?.(Math.min(el.buffered.end(el.buffered.length - 1) / el.duration, 1));
        }
      };
      const timer = setTimeout(() => finish(() => {
        if (el.readyState >= 1) { slot.ready = true; resolve(slot); }
        else reject(new Error(`${scene.file}: timed out while loading.`));
      }), LOAD_TIMEOUT);

      el.addEventListener('canplay', onReady);
      el.addEventListener('loadeddata', onReady);
      el.addEventListener('error', onError);
      el.addEventListener('progress', onProg);
      el.preload = 'auto';
      el.src = scene.src;
      el.load();
    });
    slot.promise.catch(() => {}); // callers handle it; avoids unhandled-rejection noise
    return slot.promise;
  }

  prepare(index, { onProgress } = {}) {
    const held = this.slots.find((s) => s.index === index);
    if (held) {
      if (held.ready) onProgress?.(1);
      return held.promise;
    }
    const free = this.slots.find((s) => s !== this.activeSlot) || this.slots[0];
    return this._load(free, index, onProgress);
  }

  // -------------------------------------------------------------- playback --
  async play(index) {
    const token = ++this.token;
    this._unwatch?.();
    let slot;
    try {
      slot = await this.prepare(index);
    } catch (err) {
      if (token === this.token) this._fail(index, err.message, 'load');
      return;
    }
    if (token !== this.token) return; // superseded by stop()/another play()

    const prev = this.activeSlot;
    try {
      slot.el.currentTime = 0;
      slot.el.muted = !this.sound;
      // SMOOTH AUDIO FADE IN
      slot.el.volume = 0;
      try {
        await slot.el.play();
      } catch (err) {
        if (err?.name === 'NotAllowedError' && this.sound) {
          this.setSound(false);
          await slot.el.play();
        } else throw err;
      }
      
      // Fade audio in
      let vol = 0;
      const fadeIn = setInterval(() => {
        vol += 0.1;
        if (vol >= 1) {
          vol = 1;
          clearInterval(fadeIn);
        }
        slot.el.volume = vol;
      }, FADE_MS / 10);

    } catch (err) {
      if (token !== this.token) return;
      const blocked = err?.name === 'NotAllowedError';
      this._fail(index, blocked
        ? `${this.scenes[index].file}: the browser blocked playback. Tap retry.`
        : `${this.scenes[index].file}: playback could not start.`, 'play');
      return;
    }
    if (token !== this.token) { slot.el.pause(); return; }

    this.activeSlot = slot;
    this.playingIndex = index;
    this._autoPaused = false;
    slot.el.classList.add('is-active');
    
    // SMOOTH VIDEO CROSSFADE
    if (prev && prev !== slot) {
      prev.el.classList.remove('is-active');
      // Fade out old audio
      let outVol = 1;
      const fadeOut = setInterval(() => {
        outVol -= 0.1;
        if (outVol <= 0) {
          outVol = 0;
          clearInterval(fadeOut);
        }
        prev.el.volume = outVol;
      }, FADE_MS / 10);
      
      this._later(() => { if (prev !== this.activeSlot) this._reset(prev); }, FADE_MS + 100);
    }
    
    this._watch(slot, index, token);
    this._emit('scenestart', { index });

    if (index + 1 < this.scenes.length) {
      this._later(() => {
        if (token === this.token) this.prepare(index + 1).catch(() => {});
      }, FADE_MS + 200);
    }
  }

  _fail(index, message, phase) {
    this._emit('buffering', { on: false });
    this._emit('sceneerror', { index, message, file: this.scenes[index].src, phase });
  }

  _watch(slot, index, token) {
    const el = slot.el;
    let lastT = -1;
    let lastAdvance = performance.now();
    const duration = () => (Number.isFinite(el.duration) && el.duration > 0 ? el.duration : this.scenes[index].duration);

    const stopAll = () => {
      cancelAnimationFrame(this._raf);
      el.removeEventListener('ended', onEnded);
      el.removeEventListener('error', onError);
      el.removeEventListener('waiting', onWait);
      el.removeEventListener('playing', onPlaying);
      this._unwatch = null;
    };
    const onEnded = () => {
      stopAll();
      if (token !== this.token) return;
      const d = duration();
      this._emit('progress', { index, fraction: 1, time: d, duration: d });
      this._emit('buffering', { on: false });
      this._emit('sceneended', { index });
    };
    const onError = () => {
      stopAll();
      if (token !== this.token) return;
      this._fail(index, `${this.scenes[index].file}: ${MEDIA_ERRORS[el.error?.code] || 'playback failed'}.`, 'play');
    };
    const onWait = () => this._emit('buffering', { on: true });
    const onPlaying = () => this._emit('buffering', { on: false });
    const tick = () => {
      if (token !== this.token) return;
      this._raf = requestAnimationFrame(tick);
      const t = el.currentTime;
      const d = duration();
      const now = performance.now();
      if (t !== lastT) { lastT = t; lastAdvance = now; }
      else if (!el.paused && !el.ended && now - lastAdvance > STALL_MS) {
        stopAll();
        this._fail(index, `${this.scenes[index].file}: playback stalled.`, 'play');
        return;
      }
      this._emit('progress', { index, fraction: Math.min(t / d, 1), time: t, duration: d });
    };

    el.addEventListener('ended', onEnded);
    el.addEventListener('error', onError);
    el.addEventListener('waiting', onWait);
    el.addEventListener('playing', onPlaying);
    this._unwatch = stopAll;

    const declared = this.scenes[index].duration;
    if (Number.isFinite(el.duration) && Math.abs(el.duration - declared) > 1.5) {
      console.warn(`[video] ${this.scenes[index].file} lasts ${el.duration.toFixed(1)}s (expected ~${declared}s). Progress uses the real duration.`);
    }
    tick();
  }

  retry(index) {
    const held = this.slots.find((s) => s.index === index);
    if (held && held !== this.activeSlot) this._reset(held);
    else if (held && held === this.activeSlot) { this.activeSlot = null; this._reset(held); }
    return this.play(index);
  }

  pause() {
    const el = this.activeSlot?.el;
    if (el && !el.paused && !el.ended) { el.pause(); this._autoPaused = true; }
  }
  resume() {
    const el = this.activeSlot?.el;
    if (el && this._autoPaused) { this._autoPaused = false; el.play().catch(() => {}); }
  }

  stop() {
    this.token += 1;
    this._unwatch?.();
    cancelAnimationFrame(this._raf);
    this._timers.forEach(clearTimeout);
    this._timers.clear();
    this.slots.forEach((s) => { s.el.classList.remove('is-active'); this._reset(s); });
    this.activeSlot = null;
    this.playingIndex = -1;
    this._autoPaused = false;
    this._emit('buffering', { on: false });
  }

  dispose() {
    this.stop();
  }
}