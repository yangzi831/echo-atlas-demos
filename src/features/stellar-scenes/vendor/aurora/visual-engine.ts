import * as THREE from "three";
import type { SharedState } from "./constants";

/**
 * WebGL fluid aurora field for Aurora Core.
 *
 * A full-screen fragment shader (domain-warped fbm) renders a volumetric
 * cyan/cobalt/orange aurora. It reads the SAME shared state the audio engine
 * reads — energy, beat phase, release amount, pattern variant — so sound and
 * visuals are same-source, never spectrum-driven.
 */
export class VisualEngine {
  private renderer: THREE.WebGLRenderer;
  private scene: THREE.Scene;
  private camera: THREE.OrthographicCamera;
  private uniforms: Record<string, THREE.IUniform>;
  private state: SharedState;
  private raf = 0;
  private lastStepAt = 0;
  private stepMs: number;
  private lastTime = 0;
  private mesh: THREE.Mesh;
  private onResize: () => void;

  constructor(canvas: HTMLCanvasElement, state: SharedState) {
    this.state = state;
    this.stepMs = 60000 / state.bpm / 4;

    this.renderer = new THREE.WebGLRenderer({
      canvas,
      antialias: false,
      alpha: true,
      powerPreference: "high-performance",
    });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));

    this.scene = new THREE.Scene();
    this.camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);

    this.uniforms = {
      uTime: { value: 0 },
      uResolution: { value: new THREE.Vector2(1, 1) },
      uEnergy: { value: state.energy },
      uBeat: { value: 0 },
      uRelease: { value: 0 },
      uVariant: { value: 0 },
      uScene: { value: 0 },
    };

    const material = new THREE.ShaderMaterial({
      transparent: true,
      depthTest: false,
      depthWrite: false,
      uniforms: this.uniforms,
      vertexShader: /* glsl */ `
        varying vec2 vUv;
        void main(){ vUv = uv; gl_Position = vec4(position, 1.0); }`,
      fragmentShader: /* glsl */ `
        precision highp float;
        varying vec2 vUv;
        uniform vec2 uResolution;
        uniform float uTime;
        uniform float uEnergy;
        uniform float uBeat;
        uniform float uRelease;
        uniform float uVariant;
        uniform float uScene;
        float hash(vec2 p){ return fract(sin(dot(p, vec2(127.1,311.7))) * 43758.5453123); }
        float noise(vec2 p){
          vec2 i=floor(p), f=fract(p); f=f*f*(3.0-2.0*f);
          return mix(mix(hash(i), hash(i+vec2(1.,0.)), f.x), mix(hash(i+vec2(0.,1.)), hash(i+vec2(1.,1.)), f.x), f.y);
        }
        float fbm(vec2 p){ float v=0.; float a=.5; for(int i=0;i<5;i++){ v += a*noise(p); p = mat2(1.62,1.18,-1.18,1.62)*p + .13; a *= .5; } return v; }
        void main(){
          vec2 uv = vUv;
          vec2 p = (uv - .5) * vec2(uResolution.x/uResolution.y, 1.0);
          float t = uTime * (.065 + uEnergy * .05);
          vec2 q = p;
          q.x += .32 * sin(q.y*2.2 + t*4.2 + uVariant*.7);
          q.y += .28 * cos(q.x*2.7 - t*3.4);
          float n1 = fbm(q*2.2 + vec2(t*1.9, -t*.8));
          float n2 = fbm((q + n1*.45)*3.8 - vec2(t*.7, t*1.4));
          float radial = 1.0 - smoothstep(.05, .92, length(p));
          float pulse = exp(-fract(uBeat)*7.0) * (.18 + uEnergy*.42);
          vec3 navy = vec3(.055,.078,.188);
          vec3 cobalt = vec3(.227,.420,1.0);
          vec3 cyan = vec3(.105,.761,.761);
          vec3 orange = vec3(1.0,.478,.235);
          // scene shifts the hue balance as the piece progresses
          float sc = clamp(uScene / 3.0, 0.0, 1.0);
          vec3 col = mix(navy, cobalt, smoothstep(.18,.78,n1));
          col = mix(col, cyan, smoothstep(.42,.92,n2) * (.5 + sc*.35));
          col = mix(col, orange, smoothstep(.58,.95, uv.y + .25*n2) * (.34 + sc*.22));
          float core = smoothstep(.42, .0, length(p - vec2(0., -.02))) * (.38 + uEnergy*.58);
          float bloom = radial * (.28 + .55*uEnergy) + pulse;
          col += cobalt * core + cyan * bloom*.35 + orange * uRelease*.22;
          col *= .72 + .52*n2 + .25*uEnergy;
          float alpha = clamp(.20 + radial*.42 + (n1+n2)*.16 + uEnergy*.22 + pulse*.5, 0., .96);
          gl_FragColor = vec4(col, alpha);
        }`,
    });

    this.mesh = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), material);
    this.scene.add(this.mesh);

    this.onResize = () => this.resize();
    this.resize();
    window.addEventListener("resize", this.onResize, { passive: true });
  }

  private resize(): void {
    const w = window.innerWidth;
    const h = window.innerHeight;
    this.renderer.setSize(w, h, false);
    (this.uniforms.uResolution.value as THREE.Vector2).set(w, h);
  }

  setBpm(bpm: number): void {
    this.stepMs = 60000 / bpm / 4;
  }

  start(): void {
    this.lastTime = performance.now();
    this.lastStepAt = performance.now();
    const loop = (now: number) => {
      this.raf = requestAnimationFrame(loop);
      if (document.hidden) {
        this.lastTime = now;
        this.lastStepAt = now;
        return;
      }
      const s = this.state;
      const beatPhase =
        ((now - this.lastStepAt) / this.stepMs + ((s.step - 1) % 16)) / 16;
      this.uniforms.uTime.value = now / 1000;
      this.uniforms.uEnergy.value +=
        (s.energy - (this.uniforms.uEnergy.value as number)) * 0.08;
      this.uniforms.uRelease.value +=
        (s.releaseAmount - (this.uniforms.uRelease.value as number)) * 0.08;
      this.uniforms.uScene.value +=
        (s.scene - (this.uniforms.uScene.value as number)) * 0.04;
      this.uniforms.uBeat.value = beatPhase;
      this.uniforms.uVariant.value = s.patternVariant;
      this.renderer.render(this.scene, this.camera);
    };
    this.raf = requestAnimationFrame(loop);
  }

  /** Notify the visual clock that a transport step just advanced. */
  markStep(): void {
    this.lastStepAt = performance.now();
  }

  dispose(): void {
    cancelAnimationFrame(this.raf);
    window.removeEventListener("resize", this.onResize);
    this.mesh.geometry.dispose();
    (this.mesh.material as THREE.Material).dispose();
    this.renderer.dispose();
  }
}
