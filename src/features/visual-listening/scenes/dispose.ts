import * as THREE from 'three';

const disposeMaterial = (material: THREE.Material) => {
  for (const value of Object.values(material)) {
    if (value instanceof THREE.Texture) value.dispose();
  }
  material.dispose();
};

export const disposeSceneGraph = (root: THREE.Object3D) => {
  root.traverse((object) => {
    const renderable = object as THREE.Mesh;
    renderable.geometry?.dispose();
    const material = renderable.material;
    if (Array.isArray(material)) material.forEach(disposeMaterial);
    else if (material) disposeMaterial(material);
  });
};
