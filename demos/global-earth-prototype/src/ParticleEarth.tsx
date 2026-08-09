import { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { getCityId, type City } from './cities';

type ParticleEarthProps = {
  cities: City[];
  selectedCity?: City;
  onSelectCity: (city: City) => void;
};

type HoverState = {
  city: City;
  x: number;
  y: number;
};

type MarkerRecord = {
  city: City;
  hitTarget: THREE.Mesh;
  core: THREE.Mesh<THREE.SphereGeometry, THREE.MeshBasicMaterial>;
  halo: THREE.Sprite;
};

type LandMass = {
  lat: number;
  lng: number;
  latRadius: number;
  lngRadius: number;
};

const landMasses: LandMass[] = [
  { lat: 50, lng: -108, latRadius: 25, lngRadius: 42 },
  { lat: 34, lng: -91, latRadius: 19, lngRadius: 28 },
  { lat: 68, lng: -41, latRadius: 15, lngRadius: 18 },
  { lat: 4, lng: -62, latRadius: 34, lngRadius: 19 },
  { lat: -24, lng: -57, latRadius: 25, lngRadius: 15 },
  { lat: 50, lng: 16, latRadius: 16, lngRadius: 25 },
  { lat: 7, lng: 20, latRadius: 34, lngRadius: 24 },
  { lat: 50, lng: 73, latRadius: 25, lngRadius: 58 },
  { lat: 29, lng: 105, latRadius: 25, lngRadius: 38 },
  { lat: 18, lng: 78, latRadius: 17, lngRadius: 12 },
  { lat: 7, lng: 112, latRadius: 12, lngRadius: 25 },
  { lat: -25, lng: 134, latRadius: 15, lngRadius: 22 },
  { lat: -42, lng: 172, latRadius: 8, lngRadius: 7 },
];

const particleVertexShader = `
  uniform float uPixelRatio;
  attribute float aSize;
  varying vec3 vColor;

  void main() {
    vColor = color;
    vec4 modelViewPosition = modelViewMatrix * vec4(position, 1.0);
    gl_Position = projectionMatrix * modelViewPosition;
    gl_PointSize = aSize * uPixelRatio * (4.8 / -modelViewPosition.z);
  }
`;

const particleFragmentShader = `
  varying vec3 vColor;

  void main() {
    float distanceToCenter = distance(gl_PointCoord, vec2(0.5));
    if (distanceToCenter > 0.5) discard;
    float alpha = smoothstep(0.5, 0.08, distanceToCenter);
    gl_FragColor = vec4(vColor, alpha);
  }
`;

const atmosphereVertexShader = `
  varying vec3 vNormal;

  void main() {
    vNormal = normalize(normalMatrix * normal);
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

const atmosphereFragmentShader = `
  varying vec3 vNormal;

  void main() {
    float rimBase = max(0.0, 0.72 - dot(vNormal, vec3(0.0, 0.0, 1.0)));
    float rim = pow(rimBase, 3.2);
    gl_FragColor = vec4(0.15, 0.72, 0.88, rim * 0.34);
  }
`;

function hash(value: number) {
  return Math.abs(Math.sin(value * 12.9898) * 43758.5453) % 1;
}

function wrappedLongitudeDistance(a: number, b: number) {
  const difference = Math.abs(a - b) % 360;
  return Math.min(difference, 360 - difference);
}

function isApproximateLand(lat: number, lng: number) {
  return landMasses.some((mass) => {
    const normalizedLat = (lat - mass.lat) / mass.latRadius;
    const normalizedLng = wrappedLongitudeDistance(lng, mass.lng) / mass.lngRadius;
    return normalizedLat * normalizedLat + normalizedLng * normalizedLng < 1;
  });
}

function latLngToVector3(lat: number, lng: number, radius = 1) {
  const latitude = THREE.MathUtils.degToRad(lat);
  const longitude = THREE.MathUtils.degToRad(lng);
  const latitudeRadius = Math.cos(latitude) * radius;

  return new THREE.Vector3(
    latitudeRadius * Math.sin(longitude),
    Math.sin(latitude) * radius,
    latitudeRadius * Math.cos(longitude),
  );
}

function createEarthParticles(pixelRatio: number) {
  const positions: number[] = [];
  const colors: number[] = [];
  const sizes: number[] = [];
  const color = new THREE.Color();
  const candidateCount = 30000;
  const goldenAngle = Math.PI * (3 - Math.sqrt(5));

  for (let index = 0; index < candidateCount; index += 1) {
    const y = 1 - (index / (candidateCount - 1)) * 2;
    const latitudeRadius = Math.sqrt(1 - y * y);
    const theta = goldenAngle * index;
    const x = Math.cos(theta) * latitudeRadius;
    const z = Math.sin(theta) * latitudeRadius;
    const lat = THREE.MathUtils.radToDeg(Math.asin(y));
    const lng = THREE.MathUtils.radToDeg(Math.atan2(x, z));
    const land = isApproximateLand(lat, lng);

    if (!land && hash(index + 19) > 0.11) {
      continue;
    }

    const surfaceOffset = 1 + (hash(index + 7) - 0.5) * 0.008;
    positions.push(x * surfaceOffset, y * surfaceOffset, z * surfaceOffset);

    if (land) {
      const brightness = 0.72 + hash(index + 31) * 0.28;
      color.setRGB(0.15 * brightness, 0.78 * brightness, 0.93 * brightness);
      sizes.push(1.35 + hash(index + 43) * 1.15);
    } else {
      const brightness = 0.45 + hash(index + 53) * 0.24;
      color.setRGB(0.08 * brightness, 0.32 * brightness, 0.55 * brightness);
      sizes.push(0.8 + hash(index + 61) * 0.7);
    }
    colors.push(color.r, color.g, color.b);
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
  geometry.setAttribute('aSize', new THREE.Float32BufferAttribute(sizes, 1));

  const material = new THREE.ShaderMaterial({
    uniforms: { uPixelRatio: { value: pixelRatio } },
    vertexShader: particleVertexShader,
    fragmentShader: particleFragmentShader,
    transparent: true,
    vertexColors: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  });

  return new THREE.Points(geometry, material);
}

function createStarField() {
  const positions: number[] = [];
  const colors: number[] = [];
  const color = new THREE.Color();

  for (let index = 0; index < 1800; index += 1) {
    const radius = 4.5 + hash(index + 71) * 5;
    const theta = hash(index + 79) * Math.PI * 2;
    const phi = Math.acos(2 * hash(index + 83) - 1);
    positions.push(
      radius * Math.sin(phi) * Math.cos(theta),
      radius * Math.cos(phi),
      radius * Math.sin(phi) * Math.sin(theta),
    );
    const brightness = 0.38 + hash(index + 97) * 0.38;
    color.setRGB(brightness * 0.54, brightness * 0.72, brightness * 0.8);
    colors.push(color.r, color.g, color.b);
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
  const material = new THREE.PointsMaterial({
    size: 0.012,
    sizeAttenuation: true,
    transparent: true,
    opacity: 0.7,
    vertexColors: true,
    depthWrite: false,
  });
  return new THREE.Points(geometry, material);
}

function createGlowTexture() {
  const canvas = document.createElement('canvas');
  canvas.width = 128;
  canvas.height = 128;
  const context = canvas.getContext('2d');
  if (!context) {
    return new THREE.Texture();
  }

  const gradient = context.createRadialGradient(64, 64, 3, 64, 64, 62);
  gradient.addColorStop(0, 'rgba(225, 255, 252, 1)');
  gradient.addColorStop(0.16, 'rgba(93, 230, 238, 0.94)');
  gradient.addColorStop(0.48, 'rgba(39, 191, 220, 0.28)');
  gradient.addColorStop(1, 'rgba(20, 123, 165, 0)');
  context.fillStyle = gradient;
  context.fillRect(0, 0, 128, 128);

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

export function ParticleEarth({
  cities,
  selectedCity,
  onSelectCity,
}: ParticleEarthProps) {
  const hostRef = useRef<HTMLDivElement | null>(null);
  const selectedCityRef = useRef(selectedCity);
  const onSelectCityRef = useRef(onSelectCity);
  const [hovered, setHovered] = useState<HoverState>();

  selectedCityRef.current = selectedCity;
  onSelectCityRef.current = onSelectCity;

  useEffect(() => {
    const host = hostRef.current;
    if (!host) {
      return;
    }

    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(42, 1, 0.1, 30);
    camera.position.set(0, 0.08, 3.35);

    const renderer = new THREE.WebGLRenderer({
      antialias: true,
      alpha: true,
      powerPreference: 'high-performance',
    });
    const pixelRatio = Math.min(window.devicePixelRatio, 1.75);
    renderer.setPixelRatio(pixelRatio);
    renderer.setClearColor(0x02070a, 0);
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.domElement.className = 'earth-webgl-canvas';
    renderer.domElement.setAttribute('aria-label', 'Echo Atlas particle Earth');
    renderer.domElement.setAttribute('role', 'img');
    host.appendChild(renderer.domElement);

    const earthGroup = new THREE.Group();
    earthGroup.rotation.set(-0.1, THREE.MathUtils.degToRad(-116), 0);
    scene.add(earthGroup);

    const occluder = new THREE.Mesh(
      new THREE.SphereGeometry(0.987, 48, 48),
      new THREE.MeshBasicMaterial({ colorWrite: false, depthWrite: true }),
    );
    earthGroup.add(occluder);

    const earthParticles = createEarthParticles(pixelRatio);
    earthParticles.renderOrder = 1;
    earthGroup.add(earthParticles);

    const atmosphere = new THREE.Mesh(
      new THREE.SphereGeometry(1.08, 64, 64),
      new THREE.ShaderMaterial({
        vertexShader: atmosphereVertexShader,
        fragmentShader: atmosphereFragmentShader,
        transparent: true,
        blending: THREE.AdditiveBlending,
        side: THREE.BackSide,
        depthWrite: false,
      }),
    );
    atmosphere.renderOrder = 2;
    earthGroup.add(atmosphere);

    const stars = createStarField();
    scene.add(stars);

    const glowTexture = createGlowTexture();
    const markerGeometry = new THREE.SphereGeometry(0.022, 18, 18);
    const hitGeometry = new THREE.SphereGeometry(0.09, 12, 12);
    const markers: MarkerRecord[] = [];

    cities.forEach((city) => {
      const position = latLngToVector3(city.lat, city.lng, 1.035);
      const coreMaterial = new THREE.MeshBasicMaterial({ color: 0x9bf4ef });
      const core = new THREE.Mesh(markerGeometry, coreMaterial);
      const baseScale = 0.82 + city.echoes / 22;
      core.scale.setScalar(baseScale);
      core.position.copy(position);
      core.renderOrder = 4;

      const haloMaterial = new THREE.SpriteMaterial({
        map: glowTexture,
        color: 0x52dce8,
        transparent: true,
        opacity: 0.78,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
        depthTest: true,
      });
      const halo = new THREE.Sprite(haloMaterial);
      const haloScale = 0.12 + city.echoes * 0.004;
      halo.scale.setScalar(haloScale);
      halo.position.copy(position.clone().multiplyScalar(1.006));
      halo.renderOrder = 3;

      const hitTarget = new THREE.Mesh(
        hitGeometry,
        new THREE.MeshBasicMaterial({
          transparent: true,
          opacity: 0,
          depthWrite: false,
        }),
      );
      hitTarget.position.copy(position);
      hitTarget.userData.city = city;

      earthGroup.add(core, halo, hitTarget);
      markers.push({ city, hitTarget, core, halo });
    });

    const raycaster = new THREE.Raycaster();
    const pointer = new THREE.Vector2();
    const pointerDown = new THREE.Vector2();
    const previousPointer = new THREE.Vector2();
    const worldPosition = new THREE.Vector3();
    const cameraDirection = new THREE.Vector3();
    let dragging = false;
    let moved = false;
    let velocityX = 0;
    let velocityY = 0;
    let animationFrame = 0;
    let previousTime = performance.now();
    let hoveredCityId = '';

    const isFrontFacing = (object: THREE.Object3D) => {
      object.getWorldPosition(worldPosition);
      cameraDirection.copy(camera.position).sub(worldPosition).normalize();
      return worldPosition.clone().normalize().dot(cameraDirection) > 0.06;
    };

    const pickCity = (event: PointerEvent | MouseEvent) => {
      const bounds = renderer.domElement.getBoundingClientRect();
      pointer.x = ((event.clientX - bounds.left) / bounds.width) * 2 - 1;
      pointer.y = -((event.clientY - bounds.top) / bounds.height) * 2 + 1;
      raycaster.setFromCamera(pointer, camera);
      const hit = raycaster
        .intersectObjects(markers.map((marker) => marker.hitTarget), false)
        .find((intersection) => isFrontFacing(intersection.object));
      return hit?.object.userData.city as City | undefined;
    };

    const updateHover = (event: PointerEvent) => {
      const city = pickCity(event);
      const cityId = city ? getCityId(city) : '';
      renderer.domElement.style.cursor = city ? 'pointer' : 'grab';

      if (cityId === hoveredCityId) {
        if (city) {
          const bounds = host.getBoundingClientRect();
          setHovered({
            city,
            x: event.clientX - bounds.left,
            y: event.clientY - bounds.top,
          });
        }
        return;
      }

      hoveredCityId = cityId;
      if (!city) {
        setHovered(undefined);
        return;
      }
      const bounds = host.getBoundingClientRect();
      setHovered({
        city,
        x: event.clientX - bounds.left,
        y: event.clientY - bounds.top,
      });
    };

    const handlePointerDown = (event: PointerEvent) => {
      dragging = true;
      moved = false;
      pointerDown.set(event.clientX, event.clientY);
      previousPointer.copy(pointerDown);
      renderer.domElement.setPointerCapture(event.pointerId);
      renderer.domElement.style.cursor = 'grabbing';
    };

    const handlePointerMove = (event: PointerEvent) => {
      if (!dragging) {
        updateHover(event);
        return;
      }

      const deltaX = event.clientX - previousPointer.x;
      const deltaY = event.clientY - previousPointer.y;
      previousPointer.set(event.clientX, event.clientY);
      if (pointerDown.distanceTo(previousPointer) > 5) {
        moved = true;
      }

      velocityY = deltaX * 0.0045;
      velocityX = deltaY * 0.0038;
      earthGroup.rotation.y += velocityY;
      earthGroup.rotation.x = THREE.MathUtils.clamp(
        earthGroup.rotation.x + velocityX,
        -0.72,
        0.72,
      );
      setHovered(undefined);
    };

    const handlePointerUp = (event: PointerEvent) => {
      dragging = false;
      if (renderer.domElement.hasPointerCapture(event.pointerId)) {
        renderer.domElement.releasePointerCapture(event.pointerId);
      }
      renderer.domElement.style.cursor = 'grab';

      if (!moved) {
        const city = pickCity(event);
        if (city) {
          console.log(getCityId(city));
          onSelectCityRef.current(city);
        }
      }
    };

    const handlePointerLeave = () => {
      if (!dragging) {
        hoveredCityId = '';
        setHovered(undefined);
      }
    };

    const resize = () => {
      const bounds = host.getBoundingClientRect();
      renderer.setSize(Math.max(1, bounds.width), Math.max(1, bounds.height), false);
      camera.aspect = Math.max(1, bounds.width) / Math.max(1, bounds.height);
      camera.fov = bounds.width < 700 ? 51 : 42;
      camera.position.z = bounds.width < 700 ? 3.6 : 3.35;
      camera.updateProjectionMatrix();
    };

    const resizeObserver = new ResizeObserver(resize);
    resizeObserver.observe(host);
    resize();

    renderer.domElement.addEventListener('pointerdown', handlePointerDown);
    renderer.domElement.addEventListener('pointermove', handlePointerMove);
    renderer.domElement.addEventListener('pointerup', handlePointerUp);
    renderer.domElement.addEventListener('pointercancel', handlePointerUp);
    renderer.domElement.addEventListener('pointerleave', handlePointerLeave);

    const animate = (time: number) => {
      const delta = Math.min((time - previousTime) / 1000, 0.05);
      previousTime = time;

      if (!dragging && !reducedMotion) {
        earthGroup.rotation.y += delta * 0.055 + velocityY;
        earthGroup.rotation.x = THREE.MathUtils.clamp(
          earthGroup.rotation.x + velocityX,
          -0.72,
          0.72,
        );
        velocityX *= 0.91;
        velocityY *= 0.91;
      }

      markers.forEach((marker, index) => {
        const cityId = getCityId(marker.city);
        const active = cityId === hoveredCityId || cityId === getCityId(selectedCityRef.current ?? marker.city) && Boolean(selectedCityRef.current);
        const pulse = 1 + Math.sin(time / 620 + index * 1.7) * 0.09;
        const targetScale = active ? 1.42 : 1;
        marker.core.scale.lerp(
          new THREE.Vector3(targetScale, targetScale, targetScale),
          0.12,
        );
        marker.halo.scale.setScalar(
          (0.12 + marker.city.echoes * 0.004) * pulse * (active ? 1.3 : 1),
        );
        const haloMaterial = marker.halo.material as THREE.SpriteMaterial;
        haloMaterial.opacity = active ? 1 : 0.68;
        marker.core.material.color.setHex(active ? 0xf1d693 : 0x9bf4ef);
        haloMaterial.color.setHex(active ? 0xe1b968 : 0x52dce8);
      });

      stars.rotation.y -= delta * 0.008;
      renderer.render(scene, camera);
      animationFrame = window.requestAnimationFrame(animate);
    };
    animationFrame = window.requestAnimationFrame(animate);

    return () => {
      window.cancelAnimationFrame(animationFrame);
      resizeObserver.disconnect();
      renderer.domElement.removeEventListener('pointerdown', handlePointerDown);
      renderer.domElement.removeEventListener('pointermove', handlePointerMove);
      renderer.domElement.removeEventListener('pointerup', handlePointerUp);
      renderer.domElement.removeEventListener('pointercancel', handlePointerUp);
      renderer.domElement.removeEventListener('pointerleave', handlePointerLeave);
      scene.traverse((object) => {
        if (object instanceof THREE.Mesh || object instanceof THREE.Points) {
          object.geometry.dispose();
          const materials = Array.isArray(object.material)
            ? object.material
            : [object.material];
          materials.forEach((material) => material.dispose());
        }
        if (object instanceof THREE.Sprite) {
          object.material.dispose();
        }
      });
      glowTexture.dispose();
      renderer.dispose();
      renderer.forceContextLoss();
      renderer.domElement.remove();
    };
  }, [cities]);

  return (
    <section ref={hostRef} className="earth-stage" aria-label="全球声音记忆入口">
      {hovered && (
        <div
          className="city-tooltip"
          role="tooltip"
          style={{ left: hovered.x, top: hovered.y }}
        >
          <span>MEMORY NODE</span>
          <strong>{hovered.city.name}</strong>
          <em>{hovered.city.echoes} sound echoes</em>
        </div>
      )}
    </section>
  );
}
