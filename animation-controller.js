// ============================================================================
// animation-controller.js — ULTRA ADVANCED CINEMATIC GSAP ANIMATIONS
// ============================================================================

const play = (tl) => new Promise((resolve) => tl.eventCallback('onComplete', resolve));

export class AnimationController {
  constructor({ el, effects, reducedMotion }) {
    this.g = window.gsap;
    this.el = el;
    this.effects = effects;
    this.rm = reducedMotion;
    this._split = new WeakMap();
    
    // Initial setup for Flare
    this.g.set(el.flare, { xPercent: -50, yPercent: -50, scale: 0.4, opacity: 0 });
  }

  d(seconds) { return this.rm ? Math.min(seconds, 0.25) : seconds; }

  /** Splits text into word > letter spans (words never break mid-word). Idempotent. */
  split(node) {
    if (this._split.has(node)) return this._split.get(node);
    const text = node.textContent.trim();
    node.setAttribute('aria-label', text);
    node.textContent = '';
    const letters = [];
    text.split(' ').forEach((word, i, arr) => {
      const w = document.createElement('span');
      w.className = 'word';
      w.setAttribute('aria-hidden', 'true');
      for (const ch of word) {
        const s = document.createElement('span');
        s.className = 'ch';
        s.textContent = ch;
        w.appendChild(s);
        letters.push(s);
      }
      node.appendChild(w);
      if (i < arr.length - 1) node.appendChild(document.createTextNode(' '));
    });
    this._split.set(node, letters);
    return letters;
  }

  /** Advanced 3D Letter Reveal */
  _revealLetters(tl, letters, at, { stagger = 0.08, duration = 1.4, scaleFrom = 1.5 } = {}) {
    const g = this.g;
    tl.fromTo(letters,
      { 
        opacity: 0, 
        y: this.rm ? 0 : 40, 
        z: this.rm ? 0 : -50,
        rotationX: this.rm ? 0 : -90,
        scale: this.rm ? 1 : scaleFrom, 
        filter: this.rm ? 'none' : 'blur(20px)' 
      },
      { 
        opacity: 1, 
        y: 0, 
        z: 0,
        rotationX: 0,
        scale: 1, 
        filter: 'blur(0px)', 
        duration: this.d(duration), 
        stagger: this.rm ? 0 : stagger, 
        ease: 'expo.out', 
        clearProps: 'filter,transform' 
      },
      at);
    return g;
  }

  // ----------------------------------------------------------------- intro --
  introReveal() {
    const { intro } = this.el;
    const g = this.g;
    const title = intro.querySelector('.title');
    const tagline = intro.querySelector('.tagline');
    const lede = intro.querySelector('.lede');
    const btn = intro.querySelector('.btn');
    const letters = this.split(title);

    g.killTweensOf([intro, tagline, lede, btn, ...letters]);
    intro.hidden = false;
    
    // Smooth fade in for the whole screen
    g.fromTo(intro, { opacity: 0 }, { opacity: 1, duration: this.d(1) });
    
    g.set([tagline, lede, btn], { autoAlpha: 0, y: this.rm ? 0 : 20, scale: this.rm ? 1 : 0.95 });

    const tl = g.timeline();
    
    // Letters reveal
    this._revealLetters(tl, letters, 0.2);
    
    // Tagline, Lede, Button pop in
    tl.to(tagline, { autoAlpha: 1, y: 0, scale: 1, duration: this.d(1.2), ease: 'back.out(1.7)' }, '-=0.6')
      .to(lede, { autoAlpha: 1, y: 0, scale: 1, duration: this.d(1.2), ease: 'back.out(1.7)' }, '-=1.0')
      .to(btn, { autoAlpha: 1, y: 0, scale: 1, duration: this.d(1), ease: 'back.out(1.7)' }, '-=0.9');
      
    return play(tl);
  }

  introExit() {
    const { intro } = this.el;
    const g = this.g;
    return new Promise((resolve) => {
      if (this.effects) g.to(this.effects, { push: 1, duration: this.d(1.6), ease: 'power3.inOut' });
      g.to(intro, { 
        opacity: 0, 
        scale: this.rm ? 1 : 1.1, 
        filter: this.rm ? 'none' : 'blur(10px)', 
        duration: this.d(0.9), 
        ease: 'power2.in', 
        onComplete: () => { intro.hidden = true; resolve(); } 
      });
    });
  }

  // ----------------------------------------------------------- interaction --
  showInteraction() {
    const { interaction } = this.el;
    this.g.killTweensOf(interaction);
    interaction.hidden = false;
    this.g.fromTo(interaction, 
      { opacity: 0, scale: this.rm ? 1 : 0.95 }, 
      { opacity: 1, scale: 1, duration: this.d(1.2), ease: 'power3.out' }
    );
  }

  hideInteraction() {
    this.g.killTweensOf(this.el.interaction);
    this.el.interaction.hidden = true;
  }

  // ----------------------------------------------------- cinematic flash -----
  /** Floods the screen with golden-white light. Resolves once the screen is covered. */
  flashIn() {
    const { flash, flare } = this.el;
    const g = this.g;
    g.killTweensOf([flash, flare]);
    return new Promise((resolve) => {
      g.to(flare, { opacity: 1, scale: this.rm ? 1 : 2.0, duration: this.d(0.5), ease: 'power2.out' });
      g.to(flash, { opacity: 1, duration: this.d(0.4), ease: 'power2.in', onComplete: resolve });
    });
  }

  /** Fades the flash away to reveal what is beneath. */
  flashOut() {
    const { flash, flare } = this.el;
    const g = this.g;
    return new Promise((resolve) => {
      g.to(flare, { opacity: 0, scale: this.rm ? 1 : 2.8, duration: this.d(1.5), ease: 'power2.out' });
      g.to(flash, { opacity: 0, duration: this.d(1.2), ease: 'power2.out', onComplete: resolve });
    });
  }

  // ---------------------------------------------------------------- finale --
  finaleReveal() {
    const { finale, scrim, rays } = this.el;
    const g = this.g;
    const l1 = this.split(document.getElementById('finale-l1'));
    const l2 = this.split(document.getElementById('finale-l2'));
    const msg = finale.querySelector('.finale-msg');
    const actions = finale.querySelector('.finale-actions');

    g.killTweensOf([finale, scrim, msg, actions, ...l1, ...l2]);
    finale.hidden = false;
    g.set(finale, { opacity: 1 });
    g.set([msg, actions], { autoAlpha: 0, y: this.rm ? 0 : 30, scale: this.rm ? 1 : 0.9 });
    rays.classList.add('on');

    const tl = g.timeline();
    
    // Smooth scrim (dark background) fade in
    tl.to(scrim, { opacity: 1, duration: this.d(1.8), ease: 'power2.out' }, 0);
    
    // 3D Text Reveal
    this._revealLetters(tl, l1, 0.4, { stagger: 0.1, duration: 1.5, scaleFrom: 1.5 });
    this._revealLetters(tl, l2, '-=0.6', { stagger: 0.12, duration: 1.3, scaleFrom: 1.3 });
    
    // Message and Buttons
    tl.to(msg, { autoAlpha: 1, y: 0, scale: 1, duration: this.d(1.2), ease: 'back.out(1.5)' }, '-=0.4')
      .to(actions, { autoAlpha: 1, y: 0, scale: 1, duration: this.d(1.0), ease: 'back.out(1.5)' }, '-=0.6');
      
    return play(tl).then(() => {
      document.getElementById('btn-replay')?.focus({ preventScroll: true });
    });
  }

  /** Clears every transient overlay (used by replay / back-to-start). */
  resetOverlays({ keepFlash = false } = {}) {
    const { finale, scrim, rays, flash, flare, interaction, intro, stage } = this.el;
    const g = this.g;
    
    // Kill all active tweens instantly
    g.killTweensOf([finale, scrim, interaction, intro, ...finale.querySelectorAll('.ch, .finale-msg, .finale-actions')]);
    
    if (this.effects) { 
      g.killTweensOf(this.effects); 
      this.effects.push = 0; 
    }
    
    finale.hidden = true;
    interaction.hidden = true;
    g.set(scrim, { opacity: 0 });
    
    if (!keepFlash) {
      g.killTweensOf([flash, flare]);
      g.set(flash, { opacity: 0 });
      g.set(flare, { opacity: 0, scale: 0.4 });
    }
    
    rays.classList.remove('on');
    stage.classList.remove('rumble');
  }

  rumble(on) {
    this.el.stage.classList.toggle('rumble', Boolean(on) && !this.rm);
  }
}