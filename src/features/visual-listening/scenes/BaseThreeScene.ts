import * as THREE from 'three';
import { disposeSceneGraph } from './dispose';
import type { MemoryVisualProfile, VisualScene } from './types';

export abstract class BaseThreeScene implements VisualScene {
  protected scene!: THREE.Scene;
  protected camera!: THREE.PerspectiveCamera;
  protected renderer!: THREE.WebGLRenderer;
  protected container!: HTMLElement;
  protected pointer = new THREE.Vector2();

  constructor(protected profile: MemoryVisualProfile) {}

  private pointerHandler = (event: PointerEvent) => {
    const rect = this.container.getBoundingClientRect();
    this.pointer.set(
      ((event.clientX - rect.left) / Math.max(rect.width, 1)) * 2 - 1,
      -(((event.clientY - rect.top) / Math.max(rect.height, 1)) * 2 - 1),
    );
  };

  mount(container: HTMLElement) {
    this.container = container;
    this.scene = new THREE.Scene();
    this.camera = this.createCamera();
    this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: 'high-performance' });
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.04;
    this.renderer.domElement.className = 'visual-listening-canvas';
    this.renderer.domElement.setAttribute('aria-hidden', 'true');
    container.appendChild(this.renderer.domElement);
    container.addEventListener('pointermove', this.pointerHandler, { passive: true });
    this.build();
  }

  protected createCamera() {
    const camera = new THREE.PerspectiveCamera(55, 1, 0.1, 1600);
    camera.position.set(0, 0, 45);
    return camera;
  }

  protected abstract build(): void;
  abstract update: VisualScene['update'];

  resize(width: number, height: number, pixelRatio: number) {
    this.camera.aspect = width / Math.max(height, 1);
    this.camera.updateProjectionMatrix();
    this.renderer.setPixelRatio(Math.min(pixelRatio, 1.65));
    this.renderer.setSize(width, height, false);
  }

  protected render() {
    this.renderer.render(this.scene, this.camera);
  }

  protected disposeExtras() {}

  dispose() {
    this.container.removeEventListener('pointermove', this.pointerHandler);
    this.disposeExtras();
    disposeSceneGraph(this.scene);
    this.scene.clear();
    this.renderer.renderLists.dispose();
    this.renderer.dispose();
    this.renderer.forceContextLoss();
    this.renderer.domElement.remove();
  }
}

export const seededRandom = (seed: number) => {
  let value = seed || 1;
  return () => {
    value = Math.imul(48271, value) % 0x7fffffff;
    return (value & 0x7fffffff) / 0x7fffffff;
  };
};
