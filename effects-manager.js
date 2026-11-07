// ============================================================================
// effects-manager.js — ULTRA ADVANCED CINEMATIC VISUALS
// ============================================================================
import * as THREE from 'three';

// ----------------------------------------------------------------- shaders --
const POINTS_VERT = /* glsl */`
attribute vec3 aColor;
attribute float aSize;
attribute float aAlpha;
attribute float aPhase;
uniform float uTime;
uniform float uPx;
uniform float uRef;
uniform float uTwinkle;
uniform float uOpacity;
varying vec3 vColor;
varying float vAlpha;
void main() {
  vec4 mv = modelViewMatrix * vec4(position, 1.0);
  gl_Position = projectionMatrix * mv;
  float tw = 1.0 - uTwinkle + uTwinkle * (0.5 + 0.5 * sin(uTime * 1.4 + aPhase));
  gl_PointSize = max(aSize * uPx * (uRef / max(-mv.z, 0.1)) * (0.65 + 0.35 * tw), 0.0);
  vColor = aColor;
  vAlpha = aAlpha * tw * uOpacity;
}`;

const POINTS_FRAG = /* glsl */`
precision mediump float;
varying vec3 vColor;
varying float vAlpha;
uniform float uSoft;
void main() {
  float d = length(gl_PointCoord - 0.5);
  float a = smoothstep(0.5, mix(0.35, 0.0, uSoft), d);
  float core = smoothstep(0.18, 0.0, d);
  gl_FragColor = vec4(vColor + core * 0.35, a * vAlpha);
}`;

const NEBULA_VERT = /* glsl */`
varying vec2 vUv;
void main() { vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }`;

const nebulaFrag = (octaves) => /* glsl */`
precision highp float;
#define OCT ${octaves}
varying vec2 vUv;
uniform float uTime;
uniform float uOpacity;
uniform vec2 uRes;
float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float noise(vec2 p) {
  vec2 i = floor(p), f = fract(p);
  f = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash(i), hash(i + vec2(1.0, 0.0)), f.x),
             mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), f.x), f.y);
}
float fbm(vec2 p) {
  float v = 0.0, a = 0.5;
  for (int i = 0; i < OCT; i++) { v += a * noise(p); p = p * 2.02 + vec2(1.7, 9.2); a *= 0.5; }
  return v;
}
void main() {
  vec2 uv = vUv; uv.x *= uRes.x / uRes.y;
  float t = uTime * 0.02;
  vec2 q = vec2(fbm(uv * 1.6 + t), fbm(uv * 1.6 + vec2(5.2, 1.3) - t));
  float n = fbm(uv * 2.0 + 1.6 * q + t * 2.0);
  vec3 navy = vec3(0.02, 0.03, 0.12);
  vec3 purple = vec3(0.30, 0.09, 0.45);
  vec3 magenta = vec3(0.46, 0.12, 0.40);
  vec3 gold = vec3(0.92, 0.66, 0.26);
  vec3 col = mix(navy, purple, smoothstep(0.25, 0.75, n));
  col = mix(col, magenta, smoothstep(0.55, 0.95, q.x * n * 1.6) * 0.5);
  col += gold * pow(max(n - 0.62, 0.0), 2.0) * 1.1;
  float vign = smoothstep(1.25, 0.25, length(vUv - 0.5) * 1.4);
  gl_FragColor = vec4(col, uOpacity * (0.55 + 0.45 * vign));
}`;

export function createPointsMaterial({ additive = true, twinkle = 0, soft = 0, px = 1, ref = 10 } = {}) {
  return new THREE.ShaderMaterial({
    vertexShader: POINTS_VERT,
    fragmentShader: POINTS_FRAG,
    transparent: true,
    depthWrite: false,
    depthTest: false,
    blending: additive ? THREE.AdditiveBlending : THREE.NormalBlending,
    uniforms: {
      uTime: { value: 0 },
      uPx: { value: px },
      uRef: { value: ref },
      uTwinkle: { value: twinkle },
      uOpacity: { value: 1 },
      uSoft: { value: soft },
    },
  });
}

// ------------------------------------------------------------ ParticleField --
export class ParticleField {
  constructor({ count, additive = true, soft = 0, twinkle = 0, px = 1, ref = 10 }) {
    this.count = count;
    this.cursor = 0;
    this.alive = 0;
    this.pos = new Float32Array(count * 3);
    this.col = new Float32Array(count * 3);
    this.size = new Float32Array(count);
    this.alpha = new Float32Array(count);
    this.phase = new Float32Array(count);
    this.vel = new Float32Array(count * 3);
    this.life = new Float32Array(count);
    this.maxLife = new Float32Array(count).fill(1);
    this.size0 = new Float32Array(count);
    this.grow = new Float32Array(count);
    this.a0 = new Float32Array(count);
    this.grav = new Float32Array(count);
    this.drag = new Float32Array(count).fill(1);

    this.geometry = new THREE.BufferGeometry();
    const dyn = (arr, n) => new THREE.BufferAttribute(arr, n).setUsage(THREE.DynamicDrawUsage);
    this.geometry.setAttribute('position', dyn(this.pos, 3));
    this.geometry.setAttribute('aColor', dyn(this.col, 3));
    this.geometry.setAttribute('aSize', dyn(this.size, 1));
    this.geometry.setAttribute('aAlpha', dyn(this.alpha, 1));
    this.geometry.setAttribute('aPhase', dyn(this.phase, 1));
    this.material = createPointsMaterial({ additive, soft, twinkle, px, ref });
    this.points = new THREE.Points(this.geometry, this.material);
    this.points.frustumCulled = false;
  }

  emit(o) {
    const i = this.cursor;
    this.cursor = (i + 1) % this.count;
    const i3 = i * 3;
    const color = o.color || [1, 1, 1];
    const age = o.age || 0;
    this.pos[i3] = o.x || 0; this.pos[i3 + 1] = o.y || 0; this.pos[i3 + 2] = o.z || 0;
    this.vel[i3] = o.vx || 0; this.vel[i3 + 1] = o.vy || 0; this.vel[i3 + 2] = o.vz || 0;
    this.col[i3] = color[0]; this.col[i3 + 1] = color[1]; this.col[i3 + 2] = color[2];
    this.maxLife[i] = o.life || 1;
    this.life[i] = this.maxLife[i] * (1 - age);
    this.size0[i] = o.size || 4;
    this.size[i] = this.size0[i];
    this.grow[i] = o.grow || 0;
    this.a0[i] = o.alpha ?? 1;
    this.alpha[i] = 0;
    this.grav[i] = o.gravity || 0;
    this.drag[i] = o.drag ?? 1;
    this.phase[i] = Math.random() * 6.283;
  }

  update(dt, time) {
    let alive = 0;
    for (let i = 0; i < this.count; i++) {
      if (this.life[i] <= 0) continue;
      this.life[i] -= dt;
      if (this.life[i] <= 0) { this.alpha[i] = 0; this.size[i] = 0; continue; }
      alive++;
      const i3 = i * 3;
      const k = this.life[i] / this.maxLife[i]; 
      const damp = Math.pow(this.drag[i], dt);
      this.vel[i3] *= damp; this.vel[i3 + 1] = this.vel[i3 + 1] * damp + this.grav[i] * dt; this.vel[i3 + 2] *= damp;
      this.pos[i3] += this.vel[i3] * dt;
      this.pos[i3 + 1] += this.vel[i3 + 1] * dt;
      this.pos[i3 + 2] += this.vel[i3 + 2] * dt;
      this.alpha[i] = this.a0[i] * Math.min(1, (1 - k) * 6) * Math.min(1, k * 2.2);
      this.size[i] = this.size0[i] * (1 + this.grow[i] * (1 - k));
    }
    const dirty = alive > 0 || this.alive > 0;
    this.alive = alive;
    if (dirty) {
      const a = this.geometry.attributes;
      a.position.needsUpdate = a.aAlpha.needsUpdate = a.aSize.needsUpdate = a.aColor.needsUpdate = a.aPhase.needsUpdate = true;
    }
    this.material.uniforms.uTime.value = time;
  }

  dispose() {
    this.geometry.dispose();
    this.material.dispose();
  }
}

// ------------------------------------------------------------------ palette --
const GOLDS = [[1, 0.84, 0.5], [1, 0.72, 0.35], [1, 0.92, 0.7]];
const EMBERS = [[1, 0.52, 0.14], [1, 0.7, 0.25], [1, 0.4, 0.1]];
const FIREWORK_PALETTES = [
  [[1, 0.84, 0.45], [1, 0.7, 0.25], [1, 0.95, 0.75]],
  [[1, 0.55, 0.15], [1, 0.78, 0.3], [1, 0.35, 0.1]],
  [[0.85, 0.5, 1], [1, 0.8, 0.5], [0.6, 0.4, 1]],
  [[1, 0.4, 0.55], [1, 0.8, 0.55], [1, 0.9, 0.8]],
];
const pick = (arr) => arr[(Math.random() * arr.length) | 0];

const MODES = {
  intro:     { stars: 1, nebula: 1, dust: 1.0,  embers: 0.6 },
  overlay:   { stars: 0, nebula: 0, dust: 0.28, embers: 0.32 },
  fireworks: { stars: 0, nebula: 0, dust: 0.2,  embers: 0.18 },
  finale:    { stars: 0, nebula: 0, dust: 0.85, embers: 0.4 },
};

// ---------------------------------------------------------- EffectsManager --
export class EffectsManager {
  constructor(canvas, { reducedMotion = false, isMobile = false } = {}) {
    this.canvas = canvas;
    this.rm = reducedMotion;
    this.isMobile = isMobile;
    this.ok = false;
    this.push = 0;
    this.time = 0;
    this.level = { stars: 0, nebula: 0, dust: 0, embers: 0, fw: 0 };
    this.target = { ...MODES.intro };
    this.fwOn = false;
    this.fwIntensity = 1;
    this._fwTimer = 0;
    this._dustAcc = 0;
    this._emberAcc = 0;
    this._shootingStarTimer = 5; // Timer for shooting stars
    this._pointer = { x: 0, y: 0, sx: 0, sy: 0 };
    this._raf = 0;
    this._last = 0;
    this._frame = this._frame.bind(this);
    this._onResize = this._onResize.bind(this);
    this._onPointer = this._onPointer.bind(this);
    this._onContextLost = (e) => { e.preventDefault(); this.ok = false; };
  }

  init() {
    try {
      this.renderer = new THREE.WebGLRenderer({ canvas: this.canvas, alpha: true, antialias: false, powerPreference: 'high-performance' });
    } catch (err) {
      console.warn('[effects] WebGL unavailable.', err);
      return false;
    }
    const pr = Math.min(window.devicePixelRatio || 1, this.isMobile ? 1.25 : 1.75);
    this.pixelRatio = pr;
    this.renderer.setPixelRatio(pr);
    this.renderer.setClearColor(0x000000, 0);

    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(50, 1, 0.1, 300);
    this.camera.position.set(0, 0, 10);
    this.halfH = 10 * Math.tan(THREE.MathUtils.degToRad(25));
    this.halfW = this.halfH;

    this.nebulaMat = new THREE.ShaderMaterial({
      vertexShader: NEBULA_VERT,
      fragmentShader: nebulaFrag(this.isMobile ? 3 : 5),
      transparent: true, depthWrite: false, depthTest: false,
      uniforms: { uTime: { value: 0 }, uOpacity: { value: 0 }, uRes: { value: new THREE.Vector2(1, 1) } },
    });
    this.nebula = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), this.nebulaMat);
    this.nebula.frustumCulled = false;
    this.nebula.renderOrder = -10;
    this.scene.add(this.nebula);

    this._buildStars();

    const px = pr;
    this.dust = new ParticleField({ count: this.isMobile ? 70 : 130, soft: 0.5, px, ref: 10 });
    this.embers = new ParticleField({ count: this.isMobile ? 45 : 80, soft: 0.3, px, ref: 10 });
    this.fwField = new ParticleField({ count: this.isMobile ? 1000 : 1800, soft: 0.35, px, ref: 10 }); // Increased count
    this.shootingStars = new ParticleField({ count: 20, soft: 0.8, px, ref: 10 });
    
    this.scene.add(this.dust.points, this.embers.points, this.fwField.points, this.shootingStars.points);

    this._onResize();
    for (let i = 0; i < (this.isMobile ? 45 : 90); i++) this._emitDust(Math.random());

    window.addEventListener('resize', this._onResize);
    if (!this.rm) window.addEventListener('pointermove', this._onPointer, { passive: true });
    this.canvas.addEventListener('webglcontextlost', this._onContextLost);
    this.ok = true;
    this._last = performance.now();
    this._raf = requestAnimationFrame(this._frame);
    return true;
  }

  _buildStars() {
    const n = this.isMobile ? 700 : 1500;
    const pos = new Float32Array(n * 3), col = new Float32Array(n * 3);
    const size = new Float32Array(n), alpha = new Float32Array(n).fill(1), phase = new Float32Array(n);
    for (let i = 0; i < n; i++) {
      let x, y, z, l;
      do { x = Math.random() * 2 - 1; y = Math.random() * 2 - 1; z = Math.random() * 2 - 1; l = x * x + y * y + z * z; } while (l > 1 || l < 0.01 || z > 0.35);
      const r = (55 + Math.random() * 35) / Math.sqrt(l);
      pos.set([x * r, y * r, z * r], i * 3);
      const t = Math.random();
      const c = t < 0.12 ? [1, 0.86, 0.6] : t < 0.3 ? [0.8, 0.72, 1] : [0.85, 0.9, 1];
      col.set(c, i * 3);
      size[i] = Math.random() < 0.04 ? 14 + Math.random() * 8 : 5 + Math.random() * 7;
      phase[i] = Math.random() * 6.283;
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    g.setAttribute('aColor', new THREE.BufferAttribute(col, 3));
    g.setAttribute('aSize', new THREE.BufferAttribute(size, 1));
    g.setAttribute('aAlpha', new THREE.BufferAttribute(alpha, 1));
    g.setAttribute('aPhase', new THREE.BufferAttribute(phase, 1));
    this.starMat = createPointsMaterial({ twinkle: this.rm ? 0 : 0.6, px: this.pixelRatio, ref: 10 });
    this.stars = new THREE.Points(g, this.starMat);
    this.stars.frustumCulled = false;
    this.starGroup = new THREE.Group();
    this.starGroup.add(this.stars);
    this.scene.add(this.starGroup);
  }

  setMode(name, overrides = {}) {
    this.target = { ...(MODES[name] || MODES.overlay), ...overrides };
  }

  startFireworks(intensity = 1) {
    this.fwOn = true;
    this.fwIntensity = intensity;
    this._fwTimer = 0.15;
  }

  stopFireworks() {
    this.fwOn = false;
  }

  burst(nx, ny, opts = {}) {
    if (!this.ok) return;
    const pal = opts.palette || pick(FIREWORK_PALETTES);
    const n = Math.max(30, Math.floor((opts.count || (this.isMobile ? 80 : 140)) * (this.rm ? 0.5 : 1)));
    const x = nx * this.halfW, y = ny * this.halfH;
    const speed = opts.speed || 2.8 + Math.random() * 1.5;
    const ring = opts.ring ?? Math.random() < 0.3;
    
    // Core flash
    this.fwField.emit({ x, y, life: 0.5, size: 100, alpha: 0.8, color: [1, 0.9, 0.65] });
    
    for (let i = 0; i < n; i++) {
      let vx, vy, vz;
      if (ring) {
        const a = (i / n) * Math.PI * 2;
        vx = Math.cos(a) * speed; vy = Math.sin(a) * speed; vz = (Math.random() - 0.5) * 0.4;
      } else {
        const th = Math.random() * Math.PI * 2, ph = Math.acos(2 * Math.random() - 1);
        const s = speed * (0.7 + Math.random() * 0.3);
        vx = Math.sin(ph) * Math.cos(th) * s; vy = Math.sin(ph) * Math.sin(th) * s; vz = Math.cos(ph) * s * 0.5;
      }
      this.fwField.emit({
        x, y, z: 0, vx, vy, vz,
        life: 1.8 + Math.random() * 1.2, size: 6 + Math.random() * 6, alpha: 0.9,
        color: pal[i % pal.length], gravity: -1.5, drag: 0.3,
      });
      
      // Trails
      if (i % 3 === 0) {
        this.fwField.emit({
          x, y, z: 0, vx: vx * 0.5, vy: vy * 0.5, vz: 0,
          life: 2.5, size: 3, alpha: 0.5, color: pal[i % pal.length], gravity: -1.0, drag: 0.4,
        });
      }
    }
  }

  _emitDust(age = 0) {
    const hw = this.halfW * 1.1, hh = this.halfH * 1.05;
    this.dust.emit({
      x: (Math.random() * 2 - 1) * hw, y: age ? (Math.random() * 2 - 1) * hh : -hh, z: (Math.random() * 2 - 1) * 3,
      vx: (Math.random() - 0.5) * 0.25, vy: 0.12 + Math.random() * 0.28,
      life: 9 + Math.random() * 6, age, size: 3 + Math.random() * 6, alpha: 0.35 + Math.random() * 0.6, color: pick(GOLDS),
    });
  }

  _emitEmber() {
    const hw = this.halfW, hh = this.halfH * 1.05;
    this.embers.emit({
      x: (Math.random() * 2 - 1) * hw, y: -hh, z: (Math.random() * 2 - 1) * 2,
      vx: (Math.random() - 0.5) * 0.5, vy: 0.5 + Math.random() * 1.1,
      life: 3.5 + Math.random() * 3, size: 2.5 + Math.random() * 3, alpha: 0.6 + Math.random() * 0.4,
      color: pick(EMBERS), drag: 0.98,
    });
  }

  _emitShootingStar() {
    const hw = this.halfW * 1.5;
    const startX = (Math.random() - 0.5) * hw;
    const startY = this.halfH * 1.2;
    this.shootingStars.emit({
      x: startX, y: startY, z: -5,
      vx: -2 - Math.random() * 3, vy: -3 - Math.random() * 4, vz: 0,
      life: 1.2, size: 15, alpha: 1, color: [1, 1, 1], drag: 0.95,
    });
    for(let i=0; i<5; i++) {
      this.shootingStars.emit({
        x: startX, y: startY, z: -5,
        vx: -2 - Math.random() * 3, vy: -3 - Math.random() * 4, vz: 0,
        life: 1.4, size: 5, alpha: 0.5, color: [1, 0.9, 0.6], drag: 0.95,
      });
    }
  }

  _onPointer(e) {
    this._pointer.x = e.clientX / window.innerWidth - 0.5;
    this._pointer.y = e.clientY / window.innerHeight - 0.5;
  }

  _onResize() {
    if (!this.renderer) return;
    const w = window.innerWidth, h = window.innerHeight;
    this.renderer.setSize(w, h, false);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    this.halfW = this.halfH * this.camera.aspect;
    this.nebulaMat.uniforms.uRes.value.set(w, h);
  }

  _frame(now) {
    this._raf = requestAnimationFrame(this._frame);
    if (!this.ok) return;
    const dt = Math.min((now - this._last) / 1000, 0.05);
    this._last = now;
    this.time += dt;
    const t = this.time;

    const k = Math.min(1, dt * 1.8);
    for (const key of ['stars', 'nebula', 'dust', 'embers']) this.level[key] += (this.target[key] - this.level[key]) * k;
    const fwTarget = this.fwOn || this.fwField.alive > 0 ? 0.75 : 0;
    this.level.fw += (fwTarget - this.level.fw) * Math.min(1, dt * 4);

    if (this.target.dust > 0.01) {
      this._dustAcc += dt * 12 * Math.max(this.target.dust, 0.2) * (this.rm ? 0.4 : 1);
      while (this._dustAcc >= 1) { this._dustAcc -= 1; this._emitDust(); }
    }
    if (this.target.embers > 0.01 && !this.rm) {
      this._emberAcc += dt * 9 * Math.max(this.target.embers, 0.2);
      while (this._emberAcc >= 1) { this._emberAcc -= 1; this._emitEmber(); }
    }

    if (this.fwOn) {
      this._fwTimer -= dt;
      if (this._fwTimer <= 0) {
        this.burst(-0.8 + Math.random() * 1.6, -0.05 + Math.random() * 0.85);
        const base = this.rm ? 1.6 : 0.45 + Math.random() * 0.55;
        this._fwTimer = base / Math.max(this.fwIntensity, 0.25);
      }
    }

    // Shooting Stars Logic
    this._shootingStarTimer -= dt;
    if (this._shootingStarTimer <= 0) {
      this._emitShootingStar();
      this._shootingStarTimer = 5 + Math.random() * 10; 
    }

    this.dust.update(dt, t);
    this.embers.update(dt, t);
    this.fwField.update(dt, t);
    this.shootingStars.update(dt, t);

    this.dust.material.uniforms.uOpacity.value = this.level.dust;
    this.embers.material.uniforms.uOpacity.value = this.level.embers;
    this.fwField.material.uniforms.uOpacity.value = this.level.fw;
    this.shootingStars.material.uniforms.uOpacity.value = this.level.stars;
    this.starMat.uniforms.uOpacity.value = this.level.stars;
    this.starMat.uniforms.uTime.value = t;
    this.nebulaMat.uniforms.uOpacity.value = this.level.nebula * 0.9;
    this.nebulaMat.uniforms.uTime.value = this.rm ? 0 : t;

    const drift = this.rm ? 0 : 1;
    this._pointer.sx += (this._pointer.x - this._pointer.sx) * Math.min(1, dt * 2);
    this._pointer.sy += (this._pointer.y - this._pointer.sy) * Math.min(1, dt * 2);
    this.camera.position.set(
      Math.sin(t * 0.12) * 0.5 * drift + this._pointer.sx * 0.6,
      Math.cos(t * 0.09) * 0.3 * drift - this._pointer.sy * 0.4,
      10 - this.push * 3,
    );
    this.camera.lookAt(0, 0, 0);
    this.starGroup.rotation.y += dt * (0.004 + this.push * 0.05) * drift;
    this.starGroup.rotation.x = Math.sin(t * 0.05) * 0.02 * drift;

    const visible = this.level.stars > 0.01 || this.level.nebula > 0.01 || this.level.dust > 0.01
      || this.level.embers > 0.01 || this.level.fw > 0.01;
    if (visible) this.renderer.render(this.scene, this.camera);
    else this.renderer.clear();
  }

  dispose() {
    cancelAnimationFrame(this._raf);
    window.removeEventListener('resize', this._onResize);
    window.removeEventListener('pointermove', this._onPointer);
    this.canvas.removeEventListener('webglcontextlost', this._onContextLost);
    this.dust?.dispose(); this.embers?.dispose(); this.fwField?.dispose(); this.shootingStars?.dispose();
    this.stars?.geometry.dispose(); this.starMat?.dispose();
    this.nebula?.geometry.dispose(); this.nebulaMat?.dispose();
    this.renderer?.dispose();
    this.ok = false;
  }
}