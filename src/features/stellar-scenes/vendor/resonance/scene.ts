import * as THREE from "three";
import { AudioEngine, type AudioFeatures } from "./audio-engine";
import { DEFAULT_PARAMS, type ResonanceParams } from "./params";
import {
  buildStations,
  buildRingGeometry,
  buildPointGeometry,
  buildFilamentGeometry,
  buildCylinder,
  axisSpan,
} from "./geometry";
import {
  RING_VERT,
  RING_FRAG,
  POINT_VERT,
  POINT_FRAG,
  FILAMENT_VERT,
  FILAMENT_FRAG,
  CYL_VERT,
  CYL_FRAG,
} from "./shaders";

type Uniforms = Record<string, { value: number }>;

/**
 * ResonanceAxisScene — a self-contained, exportable audio-visual core.
 * Public API: mount / update / resize / setParams / pause / resume / dispose.
 * It owns its own render loop but `update(dt)` can be driven externally too.
 */
export class ResonanceAxisScene {
  private container: HTMLElement | null = null;
  private renderer: THREE.WebGLRenderer | null = null;
  private scene = new THREE.Scene();
  private camera = new THREE.PerspectiveCamera(52, 1, 0.1, 200);
  private group = new THREE.Group();

  // trail (afterimage) feedback
  private rtA: THREE.WebGLRenderTarget | null = null;
  private rtB: THREE.WebGLRenderTarget | null = null;
  private trailScene = new THREE.Scene();
  private trailCam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
  private trailQuad: THREE.Mesh | null = null;
  private trailMat: THREE.ShaderMaterial | null = null;
  private presentScene = new THREE.Scene();
  private presentQuad: THREE.Mesh | null = null;

  private ringUniforms: Uniforms = {};
  private pointUniforms: Uniforms = {};
  private filUniforms: Uniforms = {};
  private cylUniforms: Uniforms = {};

  private ringMat: THREE.ShaderMaterial | null = null;
  private pointMat: THREE.ShaderMaterial | null = null;
  private filMat: THREE.ShaderMaterial | null = null;
  private cylMat: THREE.ShaderMaterial | null = null;

  readonly audio = new AudioEngine();
  private params: ResonanceParams = { ...DEFAULT_PARAMS };

  private raf = 0;
  private running = false;
  private clock = new THREE.Clock();
  private time = 0;
  private ro: ResizeObserver | null = null;

  // pointer gravity
  private pointer = new THREE.Vector2(0, 0);
  private pointerTarget = new THREE.Vector2(0, 0);
  private pointerActive = 0;

  // macro state
  private camDrift = 0;
  private lastRingCount = -1;
  private scroll = 0; // conveyor position (marches right→left)
  private span = axisSpan(DEFAULT_PARAMS.ringCount);

  // shockwave state (beat "hit")
  private shockAge = 99; // seconds since last shock (large = none active)
  private shockKick = 0; // strength of the current shock
  private lastBeatId = 0;
  private camKick = 0; // camera recoil impulse
  private camKickVel = 0;

  // latest features for external HUD
  features: AudioFeatures | null = null;

  mount(container: HTMLElement) {
    this.container = container;
    const renderer = new THREE.WebGLRenderer({
      antialias: true,
      alpha: false,
      powerPreference: "high-performance",
    });
    renderer.setPixelRatio(Math.min(2, window.devicePixelRatio || 1));
    renderer.setClearColor(0x050505, 1);
    container.appendChild(renderer.domElement);
    renderer.domElement.style.display = "block";
    renderer.domElement.style.width = "100%";
    renderer.domElement.style.height = "100%";
    this.renderer = renderer;

    this.scene.fog = new THREE.FogExp2(0x050505, 0.03);
    this.scene.add(this.group);
    // fixed framing looking down the belt; motion comes from the scrolling
    // structure, not the camera
    this.camera.position.set(0, 1.4, 17);
    this.camera.lookAt(0, 0, 0);

    this.buildStructure();
    this.setupTrail();
    this.resize();

    this.ro = new ResizeObserver(() => this.resize());
    this.ro.observe(container);

    container.addEventListener("pointermove", this.onPointerMove);
    container.addEventListener("pointerdown", this.onPointerDown);
    container.addEventListener("pointerleave", this.onPointerLeave);

    this.resume();
  }

  // ---------- structure ----------
  private makeMaterial(
    vert: string,
    frag: string,
    uniforms: Uniforms,
  ): THREE.ShaderMaterial {
    return new THREE.ShaderMaterial({
      vertexShader: vert,
      fragmentShader: frag,
      uniforms,
      transparent: true,
      blending: THREE.AdditiveBlending,
      depthTest: false,
      depthWrite: false,
    });
  }

  private baseUniforms(): Uniforms {
    return {
      uTime: { value: 0 },
      uBass: { value: 0 },
      uMid: { value: 0 },
      uHigh: { value: 0 },
      uBeat: { value: 0 },
      uFlux: { value: 0 },
      uScale: { value: this.params.structureScale },
      uBend: { value: this.params.bendAmount },
      uDepth: { value: this.params.spaceDepth },
      uContrast: { value: this.params.contrast },
      uLineWeight: { value: this.params.lineWeight },
      uPointSize: { value: 1.5 * this.params.lineWeight },
      uSpawn: { value: 0 },
      uScroll: { value: 0 },
      uSpan: { value: this.span },
      uShockAge: { value: 99 },
      uShockKick: { value: 0 },
    };
  }

  private buildStructure() {
    // dispose old
    this.group.clear();
    this.span = axisSpan(this.params.ringCount);
    const stations = buildStations(this.params.ringCount);

    this.ringUniforms = this.baseUniforms();
    this.pointUniforms = this.baseUniforms();
    this.filUniforms = this.baseUniforms();
    this.cylUniforms = this.baseUniforms();

    const { geometry: ringGeo } = buildRingGeometry(stations);
    this.ringMat = this.makeMaterial(RING_VERT, RING_FRAG, this.ringUniforms);
    this.group.add(new THREE.LineSegments(ringGeo, this.ringMat));

    const pointGeo = buildPointGeometry(stations);
    this.pointMat = this.makeMaterial(POINT_VERT, POINT_FRAG, this.pointUniforms);
    this.group.add(new THREE.Points(pointGeo, this.pointMat));

    const filGeo = buildFilamentGeometry(this.params.ringCount);
    this.filMat = this.makeMaterial(FILAMENT_VERT, FILAMENT_FRAG, this.filUniforms);
    this.group.add(new THREE.LineSegments(filGeo, this.filMat));

    const cylGeo = buildCylinder();
    this.cylMat = this.makeMaterial(CYL_VERT, CYL_FRAG, this.cylUniforms);
    this.cylMat.wireframe = true;
    this.group.add(new THREE.Mesh(cylGeo, this.cylMat));

    this.lastRingCount = this.params.ringCount;
  }

  private setupTrail() {
    const size = this.rtSize();
    const opts = {
      minFilter: THREE.LinearFilter,
      magFilter: THREE.LinearFilter,
      type: THREE.HalfFloatType,
    };
    this.rtA = new THREE.WebGLRenderTarget(size.w, size.h, opts);
    this.rtB = new THREE.WebGLRenderTarget(size.w, size.h, opts);

    this.trailMat = new THREE.ShaderMaterial({
      uniforms: {
        uPrev: { value: null },
        uCurrent: { value: null },
        uFade: { value: this.params.afterimage },
      },
      vertexShader: `varying vec2 vUv; void main(){ vUv=uv; gl_Position=vec4(position,1.0); }`,
      fragmentShader: `
        precision highp float; varying vec2 vUv;
        uniform sampler2D uPrev; uniform sampler2D uCurrent; uniform float uFade;
        void main(){
          vec3 prev = texture2D(uPrev, vUv).rgb * uFade;
          vec3 cur = texture2D(uCurrent, vUv).rgb;
          // keep fine lines crisp: mostly a decaying max, only a small additive
          // bleed so bright cores glow without washing the whole frame white
          vec3 outc = max(prev, cur) + cur * 0.18;
          gl_FragColor = vec4(min(outc, vec3(1.0)), 1.0);
        }`,
    });
    const quadGeo = new THREE.PlaneGeometry(2, 2);
    this.trailQuad = new THREE.Mesh(quadGeo, this.trailMat);
    this.trailScene.add(this.trailQuad);

    const presentMat = new THREE.MeshBasicMaterial({ map: this.rtA.texture });
    this.presentQuad = new THREE.Mesh(quadGeo.clone(), presentMat);
    this.presentScene.add(this.presentQuad);
  }

  private rtSize() {
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const w = Math.max(2, Math.floor((this.container?.clientWidth || 2) * dpr));
    const h = Math.max(2, Math.floor((this.container?.clientHeight || 2) * dpr));
    return { w, h };
  }

  // ---------- lifecycle ----------
  resize = () => {
    if (!this.renderer || !this.container) return;
    const w = this.container.clientWidth || 2;
    const h = this.container.clientHeight || 2;
    this.renderer.setSize(w, h, false);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    const s = this.rtSize();
    this.rtA?.setSize(s.w, s.h);
    this.rtB?.setSize(s.w, s.h);
  };

  setParams(patch: Partial<ResonanceParams>) {
    const needRebuild =
      patch.ringCount !== undefined && patch.ringCount !== this.lastRingCount;
    this.params = { ...this.params, ...patch };
    this.audio.smoothing = this.params.smoothing;
    this.audio.sensitivity = this.params.sensitivity;
    if (this.trailMat) this.trailMat.uniforms.uFade.value = this.params.afterimage;
    if (needRebuild) this.buildStructure();
  }

  getParams(): ResonanceParams {
    return { ...this.params };
  }

  resume() {
    if (this.running) return;
    this.running = true;
    this.clock.start();
    this.loop();
  }

  pause() {
    this.running = false;
    if (this.raf) cancelAnimationFrame(this.raf);
    this.raf = 0;
  }

  private loop = () => {
    if (!this.running) return;
    this.raf = requestAnimationFrame(this.loop);
    const dt = Math.min(0.05, this.clock.getDelta());
    this.update(dt);
  };

  update(dt: number) {
    if (!this.renderer || !this.rtA || !this.rtB) return;
    this.time += dt;
    const f = this.audio.sample(this.time);
    this.features = f;

    // MACRO: seamless right→left conveyor. The whole belt marches at a slow
    // train pace; bass gives it a gentle push, autoEvolve/flowSpeed scale it.
    const evo = this.params.autoEvolve;
    const beltSpeed =
      this.params.flowSpeed * (1.15 + f.bass * 0.6) * (0.5 + evo * 0.6);
    this.scroll += dt * beltSpeed;
    if (this.scroll > this.span) this.scroll -= this.span; // keep it bounded

    // MESO: a real percussive hit — every detected beat launches a visible
    // shockwave that radiates outward from the core through the belt, and
    // gives the camera a short, springy recoil kick. This replaces the old
    // "everything scales up" bounce with a directional impulse.
    if (f.beatId !== this.lastBeatId) {
      this.lastBeatId = f.beatId;
      this.shockAge = 0;
      this.shockKick = this.params.beatKick * (0.75 + f.bass * 0.5);
      this.camKickVel -= 0.55 * this.params.beatKick;
    }
    this.shockAge += dt;
    // critically-damped spring recoil: kick velocity decays, position eases
    this.camKickVel += -this.camKick * 22 * dt;
    this.camKickVel *= Math.max(0, 1 - 9 * dt);
    this.camKick += this.camKickVel * dt;

    // camera stays fixed down the belt; only a very gentle breathing + a slow
    // roll for life, plus the recoil kick above. Pointer adds local gravity.
    this.camDrift += dt * 0.08 * (0.6 + evo * 0.4);
    this.pointer.lerp(this.pointerTarget, 0.06);
    this.pointerActive *= 0.96;
    const breatheY = 1.4 + Math.sin(this.camDrift) * 0.5;
    this.camera.position.x += (this.pointer.x * 1.2 - this.camera.position.x) * 0.03;
    this.camera.position.y +=
      (breatheY + this.pointer.y * 1.0 - this.camera.position.y) * 0.03;
    this.camera.position.z =
      17 - f.bass * 1.6 - this.pointerActive * 1.4 + this.camKick;
    this.group.rotation.z = Math.sin(this.camDrift * 0.6) * 0.02 + this.camKick * 0.01;
    this.camera.fov = 52 + this.camKick * -6;
    this.camera.updateProjectionMatrix();
    this.camera.lookAt(0, 0, 0);

    // push audio + belt + shockwave uniforms into every material
    const apply = (u: Uniforms) => {
      u.uTime.value = this.time;
      u.uBass.value = f.bass;
      u.uMid.value = f.mid;
      u.uHigh.value = f.high;
      u.uBeat.value = f.beat * this.params.beatKick;
      u.uFlux.value = f.flux;
      u.uScale.value = this.params.structureScale;
      u.uBend.value = this.params.bendAmount;
      u.uDepth.value = this.params.spaceDepth;
      u.uContrast.value = this.params.contrast;
      u.uLineWeight.value = this.params.lineWeight;
      u.uPointSize.value = 1.5 * this.params.lineWeight;
      if (u.uScroll) u.uScroll.value = this.scroll;
      if (u.uSpan) u.uSpan.value = this.span;
      if (u.uShockAge) u.uShockAge.value = this.shockAge;
      if (u.uShockKick) u.uShockKick.value = this.shockKick;
    };
    apply(this.ringUniforms);
    apply(this.pointUniforms);
    apply(this.filUniforms);
    apply(this.cylUniforms);

    // --- render scene into rtB (current frame) ---
    this.renderer.setRenderTarget(this.rtB);
    this.renderer.setClearColor(0x050505, 1);
    this.renderer.clear();
    this.renderer.render(this.scene, this.camera);

    // composite previous accumulation with the current frame (afterimage),
    // then present, using a ping-pong accumulation buffer.
    this.compositeAndPresent();
  }

  // dedicated ping-pong accumulation buffer
  private acc: THREE.WebGLRenderTarget | null = null;
  private compositeAndPresent() {
    if (!this.renderer || !this.rtA || !this.rtB || !this.trailMat || !this.presentQuad)
      return;
    if (!this.acc) {
      const s = this.rtSize();
      this.acc = new THREE.WebGLRenderTarget(s.w, s.h, {
        minFilter: THREE.LinearFilter,
        magFilter: THREE.LinearFilter,
        type: THREE.HalfFloatType,
      });
    } else {
      const s = this.rtSize();
      if (this.acc.width !== s.w || this.acc.height !== s.h) this.acc.setSize(s.w, s.h);
    }
    // composite: prev accumulation (rtA) * fade  max/add current (rtB) → acc
    this.trailMat.uniforms.uPrev.value = this.rtA.texture;
    this.trailMat.uniforms.uCurrent.value = this.rtB.texture;
    this.renderer.setRenderTarget(this.acc);
    this.renderer.render(this.trailScene, this.trailCam);
    // present acc to screen
    (this.presentQuad.material as THREE.MeshBasicMaterial).map = this.acc.texture;
    this.renderer.setRenderTarget(null);
    this.renderer.render(this.presentScene, this.trailCam);
    // swap acc into rtA for next frame's history
    const prev = this.rtA;
    this.rtA = this.acc;
    this.acc = prev;
  }

  // ---------- pointer ----------
  private onPointerMove = (e: PointerEvent) => {
    if (!this.container) return;
    const r = this.container.getBoundingClientRect();
    this.pointerTarget.set(
      ((e.clientX - r.left) / r.width) * 2 - 1,
      -(((e.clientY - r.top) / r.height) * 2 - 1),
    );
  };
  private onPointerDown = () => {
    this.pointerActive = 1;
  };
  private onPointerLeave = () => {
    this.pointerTarget.set(0, 0);
  };

  // ---------- dispose ----------
  dispose() {
    this.pause();
    this.ro?.disconnect();
    this.ro = null;
    if (this.container) {
      this.container.removeEventListener("pointermove", this.onPointerMove);
      this.container.removeEventListener("pointerdown", this.onPointerDown);
      this.container.removeEventListener("pointerleave", this.onPointerLeave);
    }
    this.audio.dispose();
    this.group.traverse((o) => {
      const m = o as THREE.Mesh;
      if (m.geometry) m.geometry.dispose();
    });
    this.ringMat?.dispose();
    this.pointMat?.dispose();
    this.filMat?.dispose();
    this.cylMat?.dispose();
    this.trailMat?.dispose();
    this.rtA?.dispose();
    this.rtB?.dispose();
    this.acc?.dispose();
    this.trailQuad?.geometry.dispose();
    this.presentQuad?.geometry.dispose();
    if (this.renderer) {
      this.renderer.dispose();
      this.renderer.domElement.remove();
      this.renderer = null;
    }
    this.container = null;
  }
}
