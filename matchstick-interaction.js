// ============================================================================
// matchstick-interaction.js — ULTRA REALISTIC 3D MATCHSTICK
// ============================================================================
import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { ParticleField } from './effects-manager.js';

const FOV = 40;
const TAN_HALF_FOV = Math.tan(THREE.MathUtils.degToRad(FOV / 2));
const FUSE_TIP = new THREE.Vector3(1.75, -1.25, 0);
const NOZZLE = new THREE.Vector3(0.38, -1.95, 0.05);
const FLAME_OFFSET = 0.42; 
const IGNITE_R = 0.5;      
const NEAR_R = 2.4;        
const GOLD = [1, 0.82, 0.42];
const clamp = (v, a, b) => Math.min(b, Math.max(a, v));

// ------------------------------------------------------------- helpers ------
function makeGlowTexture() {
  const c = document.createElement('canvas');
  c.width = c.height = 64;
  const x = c.getContext('2d');
  const g = x.createRadialGradient(32, 32, 0, 32, 32, 32);
  g.addColorStop(0, 'rgba(255,255,255,1)');
  g.addColorStop(0.25, 'rgba(255,255,255,0.55)');
  g.addColorStop(1, 'rgba(255,255,255,0)');
  x.fillStyle = g;
  x.fillRect(0, 0, 64, 64);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

function makeWoodTexture() {
  const c = document.createElement('canvas');
  c.width = 64; c.height = 256;
  const x = c.getContext('2d');
  const g = x.createLinearGradient(0, 0, 64, 0);
  g.addColorStop(0, '#c99a5b'); g.addColorStop(0.5, '#e0b878'); g.addColorStop(1, '#b2824a');
  x.fillStyle = g; x.fillRect(0, 0, 64, 256);
  for (let i = 0; i < 40; i++) {
    x.strokeStyle = `rgba(90,55,20,${0.08 + Math.random() * 0.18})`;
    x.lineWidth = 1; x.beginPath();
    const px = Math.random() * 64;
    x.moveTo(px, 0);
    x.bezierCurveTo(px + 4, 80, px - 4, 170, px + Math.random() * 4 - 2, 256);
    x.stroke();
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  return t;
}

const FLAME_VERT = /* glsl */`
varying vec2 vUv;
void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`;

const FLAME_FRAG = /* glsl */`
precision highp float;
varying vec2 vUv;
uniform float uTime;
uniform float uLean;
uniform float uPower;
float hash(vec2 p) { return fract(sin(dot(p, vec2(41.3, 289.1))) * 43758.5453); }
float noise(vec2 p) {
  vec2 i = floor(p), f = fract(p);
  f = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash(i), hash(i + vec2(1.0, 0.0)), f.x), mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), f.x), f.y);
}
void main() {
  float h = vUv.y;
  float x = (vUv.x - 0.5) * 2.0;
  float n = noise(vec2(h * 3.0 - uTime * 2.8, uTime * 0.8)) - 0.5;
  x += n * 0.55 * h + uLean * h * h;
  float w = max(sin(3.14159 * pow(h, 0.8)) * (1.0 - 0.45 * h), 0.0001);
  float d = abs(x) / (w * 0.95);
  float body = 1.0 - smoothstep(0.35, 1.0, d);
  body *= smoothstep(0.0, 0.06, h) * (1.0 - smoothstep(0.78, 1.0, h + n * 0.12));
  float core = (1.0 - smoothstep(0.0, 0.7, d)) * (1.0 - smoothstep(0.0, 0.55, h));
  vec3 blue = vec3(0.25, 0.45, 1.0);
  vec3 orange = vec3(1.0, 0.52, 0.10);
  vec3 yellow = vec3(1.0, 0.85, 0.45);
  vec3 col = mix(blue, orange, smoothstep(0.02, 0.38, h));
  col = mix(col, yellow, smoothstep(0.1, 0.55, h) * (1.0 - d) * 0.55);
  col += vec3(0.9, 0.95, 1.0) * core * 0.35;
  gl_FragColor = vec4(col * 1.25, body * uPower);
}`;

// --------------------------------------------------------------- class ------
export class MatchstickInteraction {
  constructor(opts) {
    Object.assign(this, { reducedMotion: false, isMobile: false }, opts);
    this.ignited = false;
    this.dragging = false;
    this.auto = false;
    this.disposed = false;
    this.t = 0;
    this.target = new THREE.Vector3();
    this.grab = new THREE.Vector3();
    this.liftTarget = 0;
    this.liftCur = 0;
    this.lean = 0;
    this._hint = '';
    this._placed = false;
    this._sparkAcc = 0;
    this._smokeAcc = 0;
    this._tweens = [];
    
    // Fix: renamed match to matchGroup so it doesn't conflict with functions
    this.matchGroup = new THREE.Group(); 

    this._tick = this._tick.bind(this);
    this._onResize = this._onResize.bind(this);
    this._onDown = this._onDown.bind(this);
    this._onMove = this._onMove.bind(this);
    this._onUp = this._onUp.bind(this);
    this._onKey = this._onKey.bind(this);
    this._onContextLost = (e) => { e.preventDefault(); };
  }

  start() {
    try {
      this.renderer = new THREE.WebGLRenderer({
        canvas: this.canvas, alpha: true, antialias: !this.isMobile, powerPreference: 'high-performance',
      });
    } catch (err) {
      console.warn('[match] WebGL unavailable', err);
      return false;
    }
    const pr = Math.min(window.devicePixelRatio || 1, this.isMobile ? 1.75 : 2);
    this.pixelRatio = pr;
    this.renderer.setPixelRatio(pr);
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.2;

    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(FOV, 1, 0.1, 100);
    this.raycaster = new THREE.Raycaster();
    this.plane = new THREE.Plane(new THREE.Vector3(0, 0, 1), 0);
    this.glowTex = makeGlowTexture();

    this._buildEnvironment();
    this._buildLights();
    this._buildPlatform();
    this._buildFuse();
    this._buildMatch();
    this._buildParticles();

    this._onResize();
    this.resizeObserver = new ResizeObserver(this._onResize);
    this.resizeObserver.observe(this.stage);

    const s = this.stage;
    s.addEventListener('pointerdown', this._onDown);
    s.addEventListener('pointermove', this._onMove);
    s.addEventListener('pointerup', this._onUp);
    s.addEventListener('pointercancel', this._onUp);
    s.addEventListener('keydown', this._onKey);
    this.canvas.addEventListener('webglcontextlost', this._onContextLost);

    this._prev = performance.now();
    this._raf = requestAnimationFrame(this._tick);
    return true;
  }

  focus() {
    this.stage.focus({ preventScroll: true });
  }

  // ------------------------------------------------------------- building --
  _buildEnvironment() {
    const pmrem = new THREE.PMREMGenerator(this.renderer);
    const room = new RoomEnvironment();
    this.envRT = pmrem.fromScene(room, 0.04);
    this.scene.environment = this.envRT.texture;
    room.dispose?.();
    pmrem.dispose();
  }

  _buildLights() {
    this.scene.add(new THREE.HemisphereLight(0x6a5cff, 0x120a24, 0.5));
    const key = new THREE.DirectionalLight(0xffd9a0, 0.8);
    key.position.set(-4, 6, 6);
    const rim = new THREE.DirectionalLight(0x7a5cff, 1.2);
    rim.position.set(3, 2, -6);
    this.scene.add(key, rim);
    
    // Realistic Fire Light (Moves with flame)
    this.flameLight = new THREE.PointLight(0xff9a3c, 10, 15, 2);
    this.scene.add(this.flameLight);
    
    this.fuseLight = new THREE.PointLight(0xffc060, 0, 8, 2);
    this.fuseLight.position.copy(FUSE_TIP);
    this.scene.add(this.fuseLight);
  }

  _buildPlatform() {
    const metal = (color, rough, env = 0.7) => new THREE.MeshStandardMaterial({ color, metalness: 0.95, roughness: rough, envMapIntensity: env });
    const seg = this.isMobile ? 40 : 72;
    const base = new THREE.Mesh(new THREE.CylinderGeometry(2.2, 2.5, 0.4, seg), metal(0x2b2f3a, 0.38));
    base.position.y = -2.4;
    const plate = new THREE.Mesh(new THREE.CylinderGeometry(1.7, 1.8, 0.12, seg), metal(0x6b7280, 0.25));
    plate.position.y = -2.14;
    const ring = new THREE.Mesh(
      new THREE.TorusGeometry(1.75, 0.03, 12, 96),
      new THREE.MeshStandardMaterial({ color: 0xe8c36a, metalness: 1, roughness: 0.3, emissive: 0x3a2800, envMapIntensity: 1 }),
    );
    ring.rotation.x = Math.PI / 2;
    ring.position.y = -2.07;
    this.scene.add(base, plate, ring);

    const boltGeo = new THREE.CylinderGeometry(0.06, 0.06, 0.08, 10);
    const boltMat = metal(0x9aa1ad, 0.3);
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2;
      const b = new THREE.Mesh(boltGeo, boltMat);
      b.position.set(Math.cos(a) * 2.0, -2.18, Math.sin(a) * 2.0);
      this.scene.add(b);
    }

    const body = new THREE.Mesh(
      new THREE.CylinderGeometry(0.62, 0.62, 14, 48),
      new THREE.MeshStandardMaterial({ color: 0x0e1a3d, metalness: 0.6, roughness: 0.35, envMapIntensity: 0.8 }),
    );
    body.position.y = -1.85 + 7;
    const nozzle = new THREE.Mesh(new THREE.CylinderGeometry(0.62, 0.48, 0.3, 40), metal(0x20242e, 0.4));
    nozzle.position.y = -2.0;
    const band = new THREE.Mesh(
      new THREE.TorusGeometry(0.635, 0.025, 10, 64),
      new THREE.MeshStandardMaterial({ color: 0xe8c36a, metalness: 1, roughness: 0.3 }),
    );
    band.rotation.x = Math.PI / 2;
    band.position.y = -1.2;
    this.scene.add(body, nozzle, band);
  }

  _buildFuse() {
    this.curve = new THREE.CatmullRomCurve3([
      NOZZLE.clone(),
      new THREE.Vector3(0.9, -1.95, 0.05),
      new THREE.Vector3(1.4, -1.7, 0.02),
      FUSE_TIP.clone(),
    ]);
    this.fuseSegments = 48;
    this.fuseRadial = 8;
    this.fuseGeo = new THREE.TubeGeometry(this.curve, this.fuseSegments, 0.035, this.fuseRadial, false);
    this.fuseMesh = new THREE.Mesh(this.fuseGeo, new THREE.MeshStandardMaterial({ color: 0xb89868, roughness: 0.92, metalness: 0 }));
    this.scene.add(this.fuseMesh);

    this.tipCap = new THREE.Mesh(
      new THREE.CylinderGeometry(0.03, 0.045, 0.12, 10),
      new THREE.MeshStandardMaterial({ color: 0x3a2a18, roughness: 0.9 }),
    );
    this.tipCap.position.copy(FUSE_TIP);
    this.scene.add(this.tipCap);

    this.fuseGlow = new THREE.Sprite(new THREE.SpriteMaterial({
      map: this.glowTex, color: 0xffa040, transparent: true, opacity: 0, depthWrite: false, depthTest: false, blending: THREE.AdditiveBlending,
    }));
    this.fuseGlow.position.copy(FUSE_TIP);
    this.fuseGlow.scale.setScalar(0.5);
    this.scene.add(this.fuseGlow);
  }

  _buildMatch() {
    // Using matchGroup instead of match
    this.woodTex = makeWoodTexture();
    const stick = new THREE.Mesh(
      new THREE.CylinderGeometry(0.042, 0.048, 2.6, 12),
      new THREE.MeshStandardMaterial({ map: this.woodTex, roughness: 0.82, metalness: 0 }),
    );
    stick.position.y = -1.3;
    const head = new THREE.Mesh(
      new THREE.SphereGeometry(0.11, 20, 16),
      new THREE.MeshStandardMaterial({ color: 0xa11d12, roughness: 0.5, emissive: 0x401000, emissiveIntensity: 0.8 }),
    );
    head.scale.set(1, 1.25, 1);
    head.position.y = 0.05;
    
    const hit = new THREE.Mesh(
      new THREE.CylinderGeometry(this.isMobile ? 0.75 : 0.5, this.isMobile ? 0.75 : 0.5, 3.6, 8),
      new THREE.MeshBasicMaterial({ transparent: true, opacity: 0, depthWrite: false }),
    );
    hit.position.y = -0.5;
    this.hitMesh = hit;
    this.matchGroup.add(stick, head, hit);
    this.matchGroup.rotation.z = 0.32;
    this.matchGroup.rotation.x = -0.12;
    this.scene.add(this.matchGroup);

    // Realistic Flame
    this.flame = new THREE.Group();
    const geo = new THREE.PlaneGeometry(0.42, 1.0);
    geo.translate(0, 0.5, 0);
    this.flameMat = new THREE.ShaderMaterial({
      vertexShader: FLAME_VERT, fragmentShader: FLAME_FRAG, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
      uniforms: { uTime: { value: 0 }, uLean: { value: 0 }, uPower: { value: 1 } },
    });
    this.flameMesh = new THREE.Mesh(geo, this.flameMat);
    this.flameGlow = new THREE.Sprite(new THREE.SpriteMaterial({
      map: this.glowTex, color: 0xff8a2a, transparent: true, opacity: 0.5, depthWrite: false, blending: THREE.AdditiveBlending,
    }));
    this.flameGlow.scale.setScalar(1.9);
    this.flameGlow.position.y = 0.4;
    this.flame.add(this.flameGlow, this.flameMesh);
    this.scene.add(this.flame);
  }

  _buildParticles() {
    const px = this.pixelRatio;
    this.sparks = new ParticleField({ count: 260, soft: 0.3, px, ref: 10 });
    this.smoke = new ParticleField({ count: 90, additive: false, soft: 1, px, ref: 10 });
    this.scene.add(this.smoke.points, this.sparks.points);
  }

  // ---------------------------------------------------------------- layout --
  _onResize() {
    if (this.disposed || !this.renderer) return;
    const w = this.stage.clientWidth || window.innerWidth;
    const h = this.stage.clientHeight || window.innerHeight;
    this.renderer.setSize(w, h, false);
    const aspect = w / h;
    this.camera.aspect = aspect;
    this.dist = Math.max(9, 2.7 / (aspect * TAN_HALF_FOV));
    this.camera.position.set(0, 0.4, this.dist);
    this.camera.lookAt(0, 0, 0);
    this.camera.updateProjectionMatrix();
    this.halfH = this.dist * TAN_HALF_FOV;
    this.halfW = this.halfH * aspect;
    for (const f of [this.sparks, this.smoke]) f.material.uniforms.uRef.value = this.dist;

    if (!this._placed) {
      const x = Math.min(3.6, this.halfW * 0.85);
      const y = aspect < 1 ? 1.6 : 0.8;
      this.matchGroup.position.set(x, y, 0);
      this.target.set(x, y, 0);
      this._placed = true;
    } else {
      this._clampTarget();
    }
  }

  _clampTarget() {
    this.target.x = clamp(this.target.x, -this.halfW + 0.5, this.halfW - 0.5);
    this.target.y = clamp(this.target.y, -this.halfH + 0.9, this.halfH - 1.3);
  }

  // ---------------------------------------------------------- interaction --
  _toWorld(e, out = new THREE.Vector3()) {
    const r = this.canvas.getBoundingClientRect();
    const ndc = new THREE.Vector2(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
    this.raycaster.setFromCamera(ndc, this.camera);
    return this.raycaster.ray.intersectPlane(this.plane, out) ? out : null;
  }

  _pick(e) {
    const r = this.canvas.getBoundingClientRect();
    const ndc = new THREE.Vector2(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
    this.raycaster.setFromCamera(ndc, this.camera);
    return this.raycaster.intersectObject(this.hitMesh, false).length > 0;
  }

  _onDown(e) {
    if (this.ignited || this.auto || e.button > 0) return;
    if (!this._pick(e)) { this._setHint('Grab the lit match and drag it to the fuse'); return; }
    const p = this._toWorld(e);
    if (!p) return;
    this.dragging = true;
    this.pointerId = e.pointerId;
    try { this.stage.setPointerCapture(e.pointerId); } catch { /* ignore */ }
    this.grab.copy(this.matchGroup.position).sub(p);
    this.liftTarget = e.pointerType === 'touch' ? 0.9 : 0;
    e.preventDefault();
  }

  _onMove(e) {
    if (!this.dragging || e.pointerId !== this.pointerId) return;
    const p = this._toWorld(e);
    if (!p) return;
    this.target.copy(p).add(this.grab);
    this._clampTarget();
  }

  _onUp(e) {
    if (e.pointerId !== this.pointerId) return;
    this.dragging = false;
    this.liftTarget = 0;
    try { this.stage.releasePointerCapture(e.pointerId); } catch { /* ignore */ }
  }

  _onKey(e) {
    if (this.ignited) return;
    const step = e.shiftKey ? 0.6 : 0.2;
    let dx = 0, dy = 0;
    switch (e.key) {
      case 'ArrowLeft': dx = -step; break;
      case 'ArrowRight': dx = step; break;
      case 'ArrowUp': dy = step; break;
      case 'ArrowDown': dy = -step; break;
      case 'Enter':
      case ' ':
        e.preventDefault();
        this.autoIgnite();
        return;
      default: return;
    }
    e.preventDefault();
    this.target.x += dx;
    this.target.y += dy;
    this._clampTarget();
  }

  autoIgnite() {
    if (this.ignited || this.auto) return;
    this.auto = true;
    this.dragging = false;
    this.liftTarget = 0;
    this._setHint('Lighting the fuse…');
    const end = { x: FUSE_TIP.x + 0.12, y: FUSE_TIP.y - FLAME_OFFSET + 0.05 };
    const from = { x: this.target.x, y: this.target.y };
    const tween = window.gsap.to(from, {
      x: end.x, y: end.y, duration: this.reducedMotion ? 0.35 : 1.0, ease: 'power2.inOut',
      onUpdate: () => { this.target.x = from.x; this.target.y = from.y; },
      onComplete: () => { this.target.x = end.x; this.target.y = end.y; setTimeout(() => this.ignite(), 120); },
    });
    this._tweens.push(tween);
  }

  _setHint(text) {
    if (text === this._hint) return;
    this._hint = text;
    this.onHint?.(text);
  }

  // -------------------------------------------------------------- ignition --
  ignite() {
    if (this.ignited || this.disposed) return;
    this.ignited = true;
    this.dragging = false;
    this.auto = false;
    this._setHint('Ignition!');
    this.tipCap.visible = false;

    this._burstSparks(FUSE_TIP, this.reducedMotion ? 35 : 100, 3.2);
    this._smokePuff(FUSE_TIP, 7);
    this.fuseLight.intensity = 14;
    this.fuseGlow.material.opacity = 1;

    const burn = { s: 1 };
    const total = this.fuseSegments * this.fuseRadial * 6;
    const tween = window.gsap.to(burn, {
      s: 0, duration: this.reducedMotion ? 0.5 : 1.15, ease: 'power1.in',
      onUpdate: () => {
        const p = this.curve.getPointAt(clamp(burn.s, 0, 1));
        this.fuseGlow.position.copy(p);
        this.fuseLight.position.copy(p);
        this.fuseGeo.setDrawRange(0, Math.floor(burn.s * this.fuseSegments) * this.fuseRadial * 6);
        if (Math.random() < 0.7) this._burstSparks(p, 4, 1.6);
        if (Math.random() < 0.25) this._smokePuff(p, 1);
      },
      onComplete: () => {
        this.fuseGeo.setDrawRange(0, total);
        this.fuseMesh.visible = false;
        this._burstSparks(NOZZLE, this.reducedMotion ? 40 : 140, 4.2);
        this._smokePuff(NOZZLE, 10);
        this.fuseLight.intensity = 30;
        setTimeout(() => { if (!this.disposed) this.onIgnite?.(); }, this.reducedMotion ? 60 : 260);
      },
    });
    this._tweens.push(tween);
  }

  _burstSparks(pos, n, speed) {
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2;
      const s = speed * (0.35 + Math.random() * 0.65);
      this.sparks.emit({
        x: pos.x, y: pos.y, z: pos.z,
        vx: Math.cos(a) * s, vy: Math.sin(a) * s * 0.9 + 0.6, vz: (Math.random() - 0.5) * s * 0.3,
        life: 0.5 + Math.random() * 0.9, size: 3 + Math.random() * 4, alpha: 1,
        color: Math.random() < 0.7 ? GOLD : [1, 0.55, 0.15], gravity: -2.2, drag: 0.4,
      });
    }
  }

  _smokePuff(pos, n) {
    for (let i = 0; i < n; i++) {
      this.smoke.emit({
        x: pos.x + (Math.random() - 0.5) * 0.2, y: pos.y + 0.1, z: pos.z,
        vx: (Math.random() - 0.5) * 0.4, vy: 0.3 + Math.random() * 0.35,
        life: 2.2 + Math.random() * 1.2, size: 26 + Math.random() * 22, grow: 1.8, alpha: 0.1 + Math.random() * 0.08,
        color: [0.72, 0.72, 0.78], drag: 0.97,
      });
    }
  }

  // ------------------------------------------------------------ render loop --
  _tick() {
    if (this.disposed) return;
    this._raf = requestAnimationFrame(this._tick);
    const now = performance.now();
    const dt = Math.min((now - this._prev) / 1000, 0.05);
    this._prev = now;
    this.t += dt;
    const t = this.t;
    const rm = this.reducedMotion;

    this.liftCur += (this.liftTarget - this.liftCur) * Math.min(1, dt * 10);
    const bob = this.dragging || this.auto || this.ignited || rm ? 0 : Math.sin(t * 2) * 0.04;
    const m = this.matchGroup.position; // Use matchGroup
    const px = m.x;
    const k = 1 - Math.exp(-dt * (this.auto ? 9 : 16));
    m.x += (this.target.x - m.x) * k;
    m.y += (this.target.y + this.liftCur + bob - m.y) * k;
    const vx = (m.x - px) / Math.max(dt, 1e-3);
    this.matchGroup.rotation.z += (0.32 + clamp(vx * 0.015, -0.25, 0.25) - this.matchGroup.rotation.z) * Math.min(1, dt * 8);

    const fx = m.x, fy = m.y + FLAME_OFFSET;
    const dx = FUSE_TIP.x - fx, dy = FUSE_TIP.y - fy;
    const dist = Math.hypot(dx, dy);
    const prox = clamp((NEAR_R - dist) / (NEAR_R - IGNITE_R), 0, 1);
    if (!this.ignited) {
      if (dist < IGNITE_R) this.ignite();
      else if (!this.auto) this._setHint(prox > 0.55 ? 'Almost there…' : prox > 0.1 ? 'Closer to the fuse…' : 'Drag the lit match to the fuse');
    }

    const leanTarget = clamp(-vx * 0.12 + (this.ignited ? 0 : clamp(dx * 0.25, -0.5, 0.5) * prox), -0.7, 0.7);
    this.lean += (leanTarget - this.lean) * Math.min(1, dt * 6);
    const flick = 1 + (rm ? 0 : Math.sin(t * 17) * 0.04 + Math.sin(t * 29) * 0.03);
    this.flame.position.set(m.x, m.y + 0.09, 0);
    this.flame.scale.set(1, flick, 1);
    this.flameMat.uniforms.uTime.value = rm ? 0 : t;
    this.flameMat.uniforms.uLean.value = this.lean;
    
    // Realistic Light Movement
    this.flameLight.position.set(m.x + this.lean * 0.3, m.y + 0.5, 0.9);
    this.flameLight.intensity = 10 + (rm ? 0 : Math.sin(t * 19) * 2 + Math.sin(t * 7.3) * 1.5) + prox * 5;

    if (!this.ignited) {
      const pulse = rm ? 1 : 0.8 + 0.2 * Math.sin(t * 9);
      this.fuseGlow.material.opacity = prox * prox * 0.8 * pulse;
      this.fuseGlow.scale.setScalar(0.35 + prox * 0.5);
      this.fuseLight.intensity = prox * prox * 5;
    } else {
      this.fuseLight.intensity *= Math.pow(0.35, dt);
      if (this.fuseMesh.visible === false) this.fuseGlow.material.opacity *= Math.pow(0.05, dt);
    }

    {
      this._sparkAcc += dt * (rm ? 3 : 12);
      while (this._sparkAcc >= 1) {
        this._sparkAcc -= 1;
        this.sparks.emit({
          x: m.x + this.lean * 0.15 + (Math.random() - 0.5) * 0.1, y: m.y + 0.55 + Math.random() * 0.2, z: 0.05,
          vx: (Math.random() - 0.5) * 0.6, vy: 0.8 + Math.random() * 1.2,
          life: 0.6 + Math.random() * 0.6, size: 2.5 + Math.random() * 3, alpha: 0.9, color: GOLD, gravity: -0.3, drag: 0.7,
        });
      }
      this._smokeAcc += dt * (rm ? 1.5 : 5);
      while (this._smokeAcc >= 1) {
        this._smokeAcc -= 1;
        this.smoke.emit({
          x: m.x + this.lean * 0.3, y: m.y + 0.95, z: 0,
          vx: (Math.random() - 0.5) * 0.15, vy: 0.35 + Math.random() * 0.2,
          life: 2.2 + Math.random(), size: 28 + Math.random() * 20, grow: 1.8, alpha: 0.1 + Math.random() * 0.08,
          color: [0.7, 0.7, 0.75], drag: 0.97,
        });
      }
    }
    this.sparks.update(dt, t);
    this.smoke.update(dt, t);

    if (!rm) this.camera.position.x = Math.sin(t * 0.3) * 0.25;
    this.camera.lookAt(0, 0, 0);

    this.renderer.render(this.scene, this.camera);
  }

  dispose() {
    if (this.disposed) return;
    this.disposed = true;
    cancelAnimationFrame(this._raf);
    this._tweens.forEach((tw) => tw.kill());
    this._tweens.length = 0;
    this.resizeObserver?.disconnect();
    const s = this.stage;
    s.removeEventListener('pointerdown', this._onDown);
    s.removeEventListener('pointermove', this._onMove);
    s.removeEventListener('pointerup', this._onUp);
    s.removeEventListener('pointercancel', this._onUp);
    s.removeEventListener('keydown', this._onKey);
    this.canvas.removeEventListener('webglcontextlost', this._onContextLost);

    this.sparks?.dispose();
    this.smoke?.dispose();
    this.scene?.traverse((obj) => {
      obj.geometry?.dispose?.();
      const mats = Array.isArray(obj.material) ? obj.material : obj.material ? [obj.material] : [];
      for (const mat of mats) {
        mat.map?.dispose?.();
        mat.dispose?.();
      }
    });
    this.glowTex?.dispose();
    this.woodTex?.dispose();
    this.envRT?.dispose();
    this.scene?.clear();
    if (this.renderer) {
      this.renderer.dispose();
      this.renderer.forceContextLoss?.();
    }
    this.renderer = null;
  }
}