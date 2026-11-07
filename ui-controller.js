// ============================================================================
// ui-controller.js — Clean, Smooth, and Error-Free Update
// ============================================================================
const $ = (id) => document.getElementById(id);

export class UIController extends EventTarget {
  constructor() {
    super();
    this.el = {
      app: $('app'),
      stage: $('video-stage'),
      intro: $('intro'),
      interaction: $('interaction'),
      finale: $('finale'),
      flash: $('flash'),
      flare: $('flare'),
      scrim: $('scrim'),
      rays: $('rays'),
    };
    this._segs = [];
    this._last = [];
    this._bind();
  }

  emit(name, detail) { this.dispatchEvent(new CustomEvent(name, { detail })); }

  _bind() {
    $('btn-begin')?.addEventListener('click', () => this.emit('begin'));
    $('btn-ignite')?.addEventListener('click', () => this.emit('ignite'));
    $('btn-replay')?.addEventListener('click', () => this.emit('replay'));
    $('btn-hud-replay')?.addEventListener('click', () => this.emit('replay'));
    $('btn-fullscreen')?.addEventListener('click', () => this.toggleFullscreen());
    $('btn-sound')?.addEventListener('click', () => this.emit('sound'));

    if (!this._fsSupported()) {
      const fsBtn = $('btn-fullscreen');
      if (fsBtn) fsBtn.hidden = true;
    }
    
    document.addEventListener('fullscreenchange', () => this._syncFs());
    document.addEventListener('webkitfullscreenchange', () => this._syncFs());

    document.addEventListener('keydown', (e) => {
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      const tag = e.target?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA') return;
      if (e.key === 'f' || e.key === 'F') { e.preventDefault(); this.toggleFullscreen(); }
      else if (e.key === 'r' || e.key === 'R') this.emit('replay');
      else if (e.key === 'm' || e.key === 'M') this.emit('sound');
    });

    const dialog = $('dialog');
    if (dialog) {
      dialog.addEventListener('keydown', (e) => {
        if (e.key !== 'Tab') return;
        const f = [...dialog.querySelectorAll('button')];
        if (!f.length) return;
        const first = f[0], last = f[f.length - 1];
        if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
        else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
      });
    }
  }

  setPhase(phase) { this.el.app.dataset.phase = phase; }

  // --------------------------------------------------------------- loading --
  setLoading(percent, text) {
    const p = Math.max(0, Math.min(100, Math.round(percent)));
    const fill = $('loading-fill');
    const txt = $('loading-text');
    if (fill) fill.style.transform = `scaleX(${p / 100})`;
    if (txt) txt.textContent = `${text}… ${p}%`;
  }

  hideLoading() {
    const l = $('loading');
    if (!l) return Promise.resolve();
    l.classList.add('is-done');
    return new Promise((resolve) => setTimeout(() => { l.hidden = true; resolve(); }, 900));
  }

  showLoading() {
    const l = $('loading');
    if (!l) return;
    l.hidden = false;
    requestAnimationFrame(() => l.classList.remove('is-done'));
  }

  // ----------------------------------------------------------- hint / HUD ---
  setHint(text) {
    const hint = $('interaction-hint');
    if (hint) hint.textContent = text;
  }

  buildProgress(scenes) {
    const bar = $('progress');
    if (!bar) return;
    bar.textContent = '';
    this._segs = scenes.map((s) => {
      const seg = document.createElement('span');
      seg.className = 'seg';
      seg.style.setProperty('--w', s.duration);
      seg.title = s.title;
      const fill = document.createElement('i');
      seg.appendChild(fill);
      bar.appendChild(seg);
      return fill;
    });
    this._scenes = scenes;
    this._last = scenes.map(() => 0);
    this._total = scenes.reduce((a, s) => a + s.duration, 0);
  }

  setSceneLabel(i, scene, total) {
    const label = $('scene-label');
    if (label) label.textContent = `Scene ${i + 1} / ${total} · ${scene.title}`;
  }

  setProgress(index, fraction) {
    this._segs.forEach((fill, i) => {
      const v = index < 0 ? 0 : i < index ? 1 : i === index ? fraction : 0;
      if (Math.abs(v - this._last[i]) > 0.002 || v === 0 || v === 1) {
        if (v !== this._last[i]) fill.style.transform = `scaleX(${v})`;
        this._last[i] = v;
      }
    });
    let done = 0;
    if (index >= 0) {
      for (let i = 0; i < index; i++) done += this._scenes[i].duration;
      done += fraction * this._scenes[index].duration;
    }
    const prog = $('progress');
    if (prog) prog.setAttribute('aria-valuenow', String(Math.round((done / this._total) * 100)));
  }

  setSoundState(on) {
    const onIcon = $('icon-sound-on');
    const offIcon = $('icon-sound-off');
    const btn = $('btn-sound');
    if (onIcon) onIcon.hidden = !on;
    if (offIcon) offIcon.hidden = on;
    if (btn) {
      btn.setAttribute('aria-pressed', String(on));
      btn.setAttribute('aria-label', on ? 'Turn sound off' : 'Turn sound on');
    }
  }

  setBuffering(on) {
    const buf = $('buffering');
    if (buf) buf.hidden = !on;
  }

  // ------------------------------------------------------------ fullscreen --
  _fsSupported() {
    const d = document;
    return Boolean(d.fullscreenEnabled || d.webkitFullscreenEnabled);
  }

  _fsElement() { return document.fullscreenElement || document.webkitFullscreenElement || null; }

  async toggleFullscreen() {
    if (!this._fsSupported()) return;
    try {
      if (this._fsElement()) {
        await (document.exitFullscreen?.() ?? document.webkitExitFullscreen?.());
      } else {
        const root = document.documentElement;
        await (root.requestFullscreen?.() ?? root.webkitRequestFullscreen?.());
      }
    } catch (err) {
      console.warn('[ui] full screen was not allowed', err);
    }
  }

  _syncFs() {
    const on = Boolean(this._fsElement());
    const enterIcon = $('icon-fs-enter');
    const exitIcon = $('icon-fs-exit');
    const btn = $('btn-fullscreen');
    if (enterIcon) enterIcon.hidden = on;
    if (exitIcon) exitIcon.hidden = !on;
    if (btn) {
      btn.setAttribute('aria-label', on ? 'Exit full screen' : 'Enter full screen');
      btn.title = on ? 'Exit full screen (F)' : 'Full screen (F)';
    }
  }

  // ---------------------------------------------------------------- dialog --
  showDialog({ title, body, list = [], actions = [] }) {
    const titleEl = $('dialog-title');
    const bodyEl = $('dialog-body');
    const ul = $('dialog-list');
    const box = $('dialog-actions');
    const dialog = $('dialog');

    if (!dialog) return;

    if (titleEl) titleEl.textContent = title;
    if (bodyEl) bodyEl.textContent = body;
    
    if (ul) {
      ul.textContent = '';
      list.forEach((t) => { 
        const li = document.createElement('li'); 
        li.textContent = t; 
        ul.appendChild(li); 
      });
      ul.hidden = list.length === 0;
    }

    if (box) {
      box.textContent = '';
      actions.forEach((a) => {
        const b = document.createElement('button');
        b.type = 'button';
        b.className = `btn ${a.primary ? 'btn-gold' : 'btn-ghost'}`;
        b.textContent = a.label;
        b.addEventListener('click', () => { this.hideDialog(); a.onClick?.(); });
        box.appendChild(b);
      });
    }

    this._prevFocus = document.activeElement;
    dialog.hidden = false;
    if (box) box.querySelector('button')?.focus();
  }

  hideDialog() {
    const d = $('dialog');
    if (!d || d.hidden) return;
    d.hidden = true;
    this._prevFocus?.focus?.({ preventScroll: true });
    this._prevFocus = null;
  }
}