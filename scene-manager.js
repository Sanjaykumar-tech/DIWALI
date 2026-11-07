// ============================================================================
// scene-manager.js — SMOOTH STATE MACHINE (CLEAN VERSION)
// ============================================================================

export const State = Object.freeze({
  IDLE: 'IDLE',
  INTRO: 'INTRO',
  INTERACTION: 'INTERACTION',
  IGNITION: 'IGNITION',
  PLAYING_SCENE_01: 'PLAYING_SCENE_01',
  PLAYING_SCENE_02: 'PLAYING_SCENE_02',
  PLAYING_SCENE_03: 'PLAYING_SCENE_03',
  PLAYING_SCENE_04: 'PLAYING_SCENE_04',
  PLAYING_SCENE_05: 'PLAYING_SCENE_05',
  PLAYING_SCENE_06: 'PLAYING_SCENE_06',
  PLAYING_SCENE_07: 'PLAYING_SCENE_07',
  FINALE: 'FINALE',
  COMPLETED: 'COMPLETED',
});

export const SCENE_STATES = [
  State.PLAYING_SCENE_01, State.PLAYING_SCENE_02, State.PLAYING_SCENE_03, State.PLAYING_SCENE_04,
  State.PLAYING_SCENE_05, State.PLAYING_SCENE_06, State.PLAYING_SCENE_07,
];

const ALLOWED = {
  [State.IDLE]: [State.INTRO],
  [State.INTRO]: [State.INTERACTION],
  [State.INTERACTION]: [State.IGNITION],
  [State.IGNITION]: [State.PLAYING_SCENE_01],
  [State.PLAYING_SCENE_01]: [State.PLAYING_SCENE_02],
  [State.PLAYING_SCENE_02]: [State.PLAYING_SCENE_03],
  [State.PLAYING_SCENE_03]: [State.PLAYING_SCENE_04],
  [State.PLAYING_SCENE_04]: [State.PLAYING_SCENE_05],
  [State.PLAYING_SCENE_05]: [State.PLAYING_SCENE_06],
  [State.PLAYING_SCENE_06]: [State.PLAYING_SCENE_07],
  [State.PLAYING_SCENE_07]: [State.FINALE],
  [State.FINALE]: [State.COMPLETED],
  [State.COMPLETED]: [],
};

export class StateMachine {
  constructor(initial = State.IDLE) {
    this.state = initial;
    this.history = [initial];
    this.listeners = new Set();
  }

  can(next) { return (ALLOWED[this.state] || []).includes(next); }

  go(next) {
    if (!this.can(next)) {
      console.warn(`[state] blocked ${this.state} → ${next}`);
      return false;
    }
    return this._set(next);
  }

  force(next) { return this._set(next); }

  _set(next) {
    const prev = this.state;
    this.state = next;
    this.history.push(next);
    this.listeners.forEach((fn) => fn(next, prev));
    return true;
  }

  isPlaying() { return SCENE_STATES.includes(this.state); }
  onChange(fn) { this.listeners.add(fn); return () => this.listeners.delete(fn); }
}

export class SceneManager {
  constructor({ scenes, video, ui, effects, anim, createMatch }) {
    Object.assign(this, { scenes, video, ui, effects, anim, createMatch });
    this.machine = new StateMachine();
    this.machine.onChange((to, from) => { ui.el.app.dataset.state = to; console.debug(`[state] ${from} → ${to}`); });
    this.run = 0;
    this.current = -1;
    this._active = -1;
    this.match = null;
    this.ctx = { effects, anim, ui, video };
    this.assetsOk = false;
    this._replaying = false;
  }

  // ------------------------------------------------------------------ boot --
  async boot() {
    const { ui, video, effects, anim } = this;
    ui.setPhase('loading');
    ui.buildProgress(this.scenes);
    this._bind();
    effects?.setMode('intro');

    let proceed = false;
    while (!proceed) {
      ui.setLoading(0, 'Checking cinematic assets');
      const results = await video.checkAssets((f) => ui.setLoading(f * 70, 'Checking cinematic assets'));
      const missing = results.filter((r) => !r.ok);
      if (!missing.length) { this.assetsOk = true; proceed = true; break; }
      const choice = await this._askMissing(missing);
      if (choice === 'continue') { this.assetsOk = false; proceed = true; }
    }

    if (this.assetsOk) {
      ui.setLoading(70, 'Loading opening scene');
      try {
        await video.prepare(0, { onProgress: (f) => ui.setLoading(70 + f * 30, 'Loading opening scene') });
      } catch (err) {
        console.warn('[boot] could not pre-load scene 1', err);
      }
    }
    ui.setLoading(100, 'Ready');
    await ui.hideLoading();

    this.machine.go(State.INTRO);
    ui.setPhase('intro');
    anim.introReveal();
  }

  _askMissing(missing) {
    return new Promise((resolve) => {
      this.ui.showDialog({
        title: `${missing.length} of ${this.scenes.length} video file${missing.length > 1 ? 's' : ''} missing`,
        body: 'Place your original clips in assets/videos/ using exactly these filenames. You can retry after adding them, or continue to preview the intro and matchstick (any scene whose file is missing will show an error when it is reached).',
        list: missing.map((m) => `${m.scene.src} — ${m.reason}`),
        actions: [
          { label: 'Retry check', primary: true, onClick: () => resolve('retry') },
          { label: 'Continue anyway', onClick: () => resolve('continue') },
        ],
      });
    });
  }

  _bind() {
    const { ui, video } = this;
    ui.addEventListener('begin', () => this.beginExperience());
    ui.addEventListener('ignite', () => (this.match ? this.match.autoIgnite() : this.handleIgnited(this.run)));
    ui.addEventListener('replay', () => this.replay());
    ui.addEventListener('sound', () => video.setSound(!video.sound));
    video.addEventListener('soundchange', (e) => ui.setSoundState(e.detail.on));

    video.addEventListener('progress', (e) => {
      if (e.detail.index === this.current) ui.setProgress(e.detail.index, e.detail.fraction);
    });
    video.addEventListener('buffering', (e) => ui.setBuffering(e.detail.on));
    video.addEventListener('sceneended', (e) => this._onEnded(e.detail.index));
    video.addEventListener('sceneerror', (e) => this._onError(e.detail));

    document.addEventListener('visibilitychange', () => (document.hidden ? video.pause() : video.resume()));
  }

  // ----------------------------------------------------------- interaction --
  async beginExperience() {
    if (!this.machine.go(State.INTERACTION)) return; 
    this.video.setSound(true); 
    const run = ++this.run;
    this.ui.setPhase('interaction');
    await this.anim.introExit();
    if (run !== this.run) return;
    this._startMatch(run);
  }

  _startMatch(run) {
    this.ui.setHint('Drag the lit match to the fuse');
    this.anim.showInteraction();
    const match = this.createMatch({
      onHint: (t) => this.ui.setHint(t),
      onIgnite: () => this.handleIgnited(run),
    });
    this.match = match;
    if (!match.start()) {
      match.dispose();
      this.match = null;
      this.ui.setHint('3D view is unavailable on this device — press the button to light the fuse');
    } else {
      match.focus();
    }
  }

  async handleIgnited(run = this.run) {
    if (run !== this.run) return;
    if (!this.machine.go(State.IGNITION)) return;
    this.ui.setHint('');
    await this.anim.flashIn();
    if (run !== this.run) return;
    this.match?.dispose();
    this.match = null;
    this.anim.hideInteraction();
    this.effects?.setMode('overlay');
    this.ui.setPhase('playing');
    await this.playScene(0);
    if (run === this.run) this.anim.flashOut();
  }

  // -------------------------------------------------------------- playback --
  async playScene(i) {
    if (!this.machine.go(SCENE_STATES[i])) return;
    const scene = this.scenes[i];
    this.current = i;
    this._active = i;
    this.ui.setSceneLabel(i, scene, this.scenes.length);
    this.ui.setProgress(i, 0);
    try { scene.onEnter?.(this.ctx); } catch (err) { console.warn('[scene] onEnter failed', err); }
    await this.video.play(i); 
  }

  _exitScene(i) {
    if (i < 0 || this._active !== i) return;
    this._active = -1;
    try { this.scenes[i].onExit?.(this.ctx); } catch (err) { console.warn('[scene] onExit failed', err); }
  }

  _advance(i) {
    this._exitScene(i);
    this.ui.setProgress(i, 1);
    if (i < this.scenes.length - 1) this.playScene(i + 1);
    else this._finale();
  }

  _onEnded(index) {
    if (index !== this.current || !this.machine.isPlaying()) return;
    this._advance(index);
  }

  async _finale() {
    const run = this.run;
    if (!this.machine.go(State.FINALE)) return;
    this.ui.setPhase('finale');
    this.effects?.stopFireworks();
    this.effects?.setMode('finale');
    await this.anim.finaleReveal();
    if (run !== this.run) return;
    this.machine.go(State.COMPLETED);
  }

  _onError({ index, message, file }) {
    if (index !== this.current || !this.machine.isPlaying()) {
      console.warn('[video] background error', message);
      return;
    }
    const last = index === this.scenes.length - 1;
    this.ui.showDialog({
      title: `Scene ${index + 1} couldn't play`,
      body: message,
      list: [file],
      actions: [
        { label: 'Retry', primary: true, onClick: () => this.video.retry(index) },
        { label: last ? 'Skip to greeting' : 'Skip scene', onClick: () => this._advance(index) },
        { label: 'Back to start', onClick: () => this.toIntro() },
      ],
    });
  }

  // ---------------------------------------------------------------- replay --
  _teardownRun({ keepFlash = false } = {}) {
    this.run += 1;
    this.video.stop();
    this._exitScene(this._active);
    this.current = -1;
    this.match?.dispose();
    this.match = null;
    this.ui.hideDialog();
    this.ui.setBuffering(false);
    this.ui.setProgress(-1, 0);
    this.effects?.stopFireworks();
    this.anim.resetOverlays({ keepFlash });
  }

  async replay() {
    const s = this.machine.state;
    if (this._replaying) return;
    if (!(this.machine.isPlaying() || s === State.FINALE || s === State.COMPLETED)) return;
    this._replaying = true;
    await this.anim.flashIn(); 
    this._teardownRun({ keepFlash: true });
    const run = this.run;
    this.machine.force(State.INTERACTION);
    this.ui.setPhase('interaction');
    this.effects?.setMode('intro');
    this._startMatch(run);
    this._replaying = false;
    this.anim.flashOut();
  }

  toIntro() {
    this._teardownRun();
    this.machine.force(State.INTRO);
    this.ui.setPhase('intro');
    this.effects?.setMode('intro');
    this.anim.introReveal();
  }
}