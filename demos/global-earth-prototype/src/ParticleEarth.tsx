import { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { getCityId, type City } from './cities';

type Props = { cities: City[]; selectedCity?: City; onSelectCity: (city: City) => void; onEnterCity?: (city: City) => void };
type Hover = { city: City; x: number; y: number };
type Marker = { city: City; root: THREE.Group; hit: THREE.Mesh; core: THREE.Mesh<THREE.SphereGeometry, THREE.MeshBasicMaterial>; ring: THREE.Mesh<THREE.RingGeometry, THREE.MeshBasicMaterial>; glow: THREE.Sprite; label: HTMLDivElement; scale: number };
type GeoData = { features?: Array<{ geometry?: { type?: string; coordinates?: unknown } }> };

const RADIUS = 2.14;
const landVertex = `
 uniform float uPixelRatio,uTime; attribute float aSize,aTone,aPhase; varying float vTone,vAlpha;
 void main(){vTone=aTone;float p=.88+.12*sin(uTime*(.28+aPhase*.18)+aPhase*19.);vec4 mv=modelViewMatrix*vec4(position,1.);gl_Position=projectionMatrix*mv;gl_PointSize=aSize*p*uPixelRatio*(7./max(1.,-mv.z));vAlpha=mix(.34,.92,aTone)*p;}`;
const landFragment = `
 varying float vTone,vAlpha; void main(){float r=length(gl_PointCoord-vec2(.5));float d=1.-smoothstep(.16,.5,r);float c=1.-smoothstep(0.,.13,r);if(d*vAlpha<.012)discard;vec3 col=mix(vec3(.31,.49,.50),vec3(.86,.96,.95),vTone*.72+c*.24);gl_FragColor=vec4(col,d*vAlpha);}`;
const atmosphereVertex = `varying vec3 n,v;void main(){vec4 p=modelViewMatrix*vec4(position,1.);n=normalize(normalMatrix*normal);v=normalize(-p.xyz);gl_Position=projectionMatrix*p;}`;
const atmosphereFragment = `varying vec3 n,v;void main(){float f=abs(dot(normalize(n),normalize(v)));float a=pow(1.-clamp(f,0.,1.),7.2)*.58+pow(1.-clamp(f,0.,1.),2.35)*.07;if(a<.004)discard;gl_FragColor=vec4(.62,.82,.84,a*.54);}`;

function random(index: number, seed = 1) { return Math.abs(Math.sin(index * 12.9898 + seed * 78.233) * 43758.5453) % 1; }
function vector(lat: number, lng: number, radius = RADIUS) {
  const a = THREE.MathUtils.degToRad(lat), b = THREE.MathUtils.degToRad(lng), r = Math.cos(a) * radius;
  return new THREE.Vector3(r * Math.sin(b), Math.sin(a) * radius, r * Math.cos(b));
}
function ease(value: number) { return value < .5 ? 4 * value ** 3 : 1 - ((-2 * value + 2) ** 3) / 2; }

function eachPolygon(data: GeoData, visit: (rings: number[][][]) => void) {
  data.features?.forEach(({ geometry }) => {
    if (!geometry || !Array.isArray(geometry.coordinates)) return;
    if (geometry.type === 'Polygon') visit(geometry.coordinates as number[][][]);
    if (geometry.type === 'MultiPolygon') (geometry.coordinates as number[][][][]).forEach(visit);
  });
}
function landMask(data: GeoData, mobile: boolean) {
  const canvas = document.createElement('canvas'); canvas.width = mobile ? 1024 : 2048; canvas.height = canvas.width / 2;
  const context = canvas.getContext('2d', { willReadFrequently: true }); if (!context) return;
  context.fillStyle = '#fff';
  eachPolygon(data, (rings) => [-canvas.width, 0, canvas.width].forEach((offset) => {
    context.beginPath();
    rings.forEach((ring) => { let previous: number | undefined; let wrap = 0; ring.forEach(([lng, lat], index) => {
      let x = ((lng + 180) / 360) * canvas.width;
      if (previous !== undefined) { const candidate = x + wrap; if (candidate - previous > canvas.width / 2) wrap -= canvas.width; if (candidate - previous < -canvas.width / 2) wrap += canvas.width; }
      x += wrap; previous = x; const y = ((90 - lat) / 180) * canvas.height; index ? context.lineTo(x + offset, y) : context.moveTo(x + offset, y);
    }); context.closePath(); });
    context.fill('evenodd');
  }));
  return context.getImageData(0, 0, canvas.width, canvas.height);
}
function landPoints(mask: ImageData, pixelRatio: number, mobile: boolean) {
  const p: number[] = [], sizes: number[] = [], tones: number[] = [], phases: number[] = [];
  const count = mobile ? 8500 : 30000, golden = Math.PI * (3 - Math.sqrt(5));
  for (let i = 0; i < count; i += 1) {
    const y = 1 - ((i + .5) / count) * 2, lat = Math.asin(THREE.MathUtils.clamp(y, -1, 1)) * THREE.MathUtils.RAD2DEG;
    const lng = ((((golden * i) * THREE.MathUtils.RAD2DEG + 180) % 360) + 360) % 360 - 180;
    const x = Math.min(mask.width - 1, Math.max(0, Math.floor(((lng + 180) / 360) * mask.width)));
    const my = Math.min(mask.height - 1, Math.max(0, Math.floor(((90 - lat) / 180) * mask.height)));
    if (mask.data[(my * mask.width + x) * 4 + 3] < 80) continue;
    const v = vector(lat, lng, RADIUS * (1.006 + random(i, 12.7) * .0025)), spark = random(i, 31.4) > .975;
    p.push(v.x, v.y, v.z); sizes.push((mobile ? 2.4 : 2.25) * (.66 + random(i, 7.3) * .72) * (spark ? 1.8 : 1)); tones.push(Math.min(1, .12 + random(i, 19.8) * .6 + (spark ? .3 : 0))); phases.push(random(i, 44.2));
  }
  const geometry = new THREE.BufferGeometry(); geometry.setAttribute('position', new THREE.Float32BufferAttribute(p, 3)); geometry.setAttribute('aSize', new THREE.Float32BufferAttribute(sizes, 1)); geometry.setAttribute('aTone', new THREE.Float32BufferAttribute(tones, 1)); geometry.setAttribute('aPhase', new THREE.Float32BufferAttribute(phases, 1));
  const material = new THREE.ShaderMaterial({ uniforms: { uPixelRatio: { value: pixelRatio }, uTime: { value: 0 } }, vertexShader: landVertex, fragmentShader: landFragment, transparent: true, depthWrite: false, depthTest: true, blending: THREE.AdditiveBlending, toneMapped: false });
  return new THREE.Points(geometry, material);
}
function glowTexture() {
  const canvas = document.createElement('canvas'); canvas.width = canvas.height = 128; const context = canvas.getContext('2d'); if (!context) return new THREE.Texture();
  const g = context.createRadialGradient(64, 64, 0, 64, 64, 64); g.addColorStop(0, 'rgba(246,255,255,1)'); g.addColorStop(.13, 'rgba(188,241,247,.88)'); g.addColorStop(.42, 'rgba(75,177,193,.22)'); g.addColorStop(1, 'rgba(75,177,193,0)'); context.fillStyle = g; context.fillRect(0, 0, 128, 128);
  const texture = new THREE.CanvasTexture(canvas); texture.colorSpace = THREE.SRGBColorSpace; return texture;
}
function stars(mobile: boolean) {
  const p: number[] = []; for (let i = 0; i < (mobile ? 420 : 920); i += 1) { const r = 7 + random(i, 53) * 6, a = random(i, 61) * Math.PI * 2, b = Math.acos(2 * random(i, 67) - 1); p.push(r * Math.sin(b) * Math.cos(a), r * Math.cos(b), r * Math.sin(b) * Math.sin(a)); }
  const geometry = new THREE.BufferGeometry(); geometry.setAttribute('position', new THREE.Float32BufferAttribute(p, 3)); return new THREE.Points(geometry, new THREE.PointsMaterial({ color: 0x8aa3a2, size: mobile ? .014 : .011, transparent: true, opacity: .34, depthWrite: false }));
}

export function ParticleEarth({ cities, selectedCity, onSelectCity, onEnterCity }: Props) {
  const hostRef = useRef<HTMLDivElement>(null), selectedRef = useRef(selectedCity), selectRef = useRef(onSelectCity), enterRef = useRef(onEnterCity), focusRef = useRef<((city: City) => void) | undefined>(undefined);
  const [hover, setHover] = useState<Hover>(); selectedRef.current = selectedCity; selectRef.current = onSelectCity; enterRef.current = onEnterCity;
  useEffect(() => {
    const host = hostRef.current; if (!host) return; const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches, mobile = matchMedia('(max-width:760px)').matches, abort = new AbortController();
    const scene = new THREE.Scene(), camera = new THREE.PerspectiveCamera(mobile ? 36 : 32, 1, .1, 30); camera.position.z = mobile ? 8.3 : 7.1;
    const renderer = new THREE.WebGLRenderer({ antialias: !mobile, alpha: true, powerPreference: 'high-performance' }), ratio = Math.min(devicePixelRatio || 1, mobile ? 1 : 1.5); renderer.setPixelRatio(ratio); renderer.setClearColor(0x010509, 0); renderer.outputColorSpace = THREE.SRGBColorSpace; renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = .86; renderer.domElement.className = 'earth-webgl-canvas'; renderer.domElement.setAttribute('aria-label', 'Echo Atlas particle Earth'); host.appendChild(renderer.domElement);
    const geo: THREE.BufferGeometry[] = [], mats: THREE.Material[] = [], tex: THREE.Texture[] = [], earth = new THREE.Group(); earth.position.set(mobile ? 0 : .62, mobile ? .2 : .04, 0); earth.rotation.set(-.08, THREE.MathUtils.degToRad(-108), 0); scene.add(earth, new THREE.HemisphereLight(0x314b4a, 0x000102, .15)); const light = new THREE.DirectionalLight(0xdffdf8, 2.2); light.position.set(-6.2, 3.1, 2.2); scene.add(light);
    const sphereGeo = new THREE.SphereGeometry(RADIUS, mobile ? 72 : 160, mobile ? 48 : 96), surfaceMat = new THREE.MeshStandardMaterial({ color: 0x7c9798, emissive: 0x071d22, emissiveIntensity: .055, roughness: .72, transparent: true, opacity: .58 }); geo.push(sphereGeo); mats.push(surfaceMat); earth.add(new THREE.Mesh(sphereGeo, surfaceMat));
    const base = import.meta.env.BASE_URL, loader = new THREE.TextureLoader(); loader.load(`${base}earth/nasa-earth-surface-2048.jpg`, (t) => { if (abort.signal.aborted) return t.dispose(); t.colorSpace = THREE.SRGBColorSpace; t.wrapS = THREE.RepeatWrapping; tex.push(t); surfaceMat.map = t; surfaceMat.needsUpdate = true; });
    const cloudMat = new THREE.MeshLambertMaterial({ color: 0xcfe5e3, transparent: true, opacity: .16, alphaTest: .035, depthWrite: false }), cloud = new THREE.Mesh(sphereGeo, cloudMat); mats.push(cloudMat); cloud.scale.setScalar(1.0065); cloud.renderOrder = 3; earth.add(cloud); loader.load(`${base}earth/nasa-clouds-2048.jpg`, (t) => { if (abort.signal.aborted) return t.dispose(); tex.push(t); cloudMat.alphaMap = t; cloudMat.needsUpdate = true; });
    const atmosphereGeo = new THREE.SphereGeometry(RADIUS * (mobile ? 1.035 : 1.028), mobile ? 64 : 96, mobile ? 40 : 64), atmosphereMat = new THREE.ShaderMaterial({ vertexShader: atmosphereVertex, fragmentShader: atmosphereFragment, transparent: true, blending: THREE.AdditiveBlending, side: THREE.BackSide, depthWrite: false }); geo.push(atmosphereGeo); mats.push(atmosphereMat); earth.add(new THREE.Mesh(atmosphereGeo, atmosphereMat));
    let land: THREE.Points<THREE.BufferGeometry, THREE.ShaderMaterial> | undefined; fetch(`${base}earth/${mobile ? 'ne_110m_land.geojson' : 'ne_50m_land.geojson'}`, { signal: abort.signal }).then((r) => r.json() as Promise<GeoData>).then((data) => { const mask = landMask(data, mobile); if (!mask || abort.signal.aborted) return; land = landPoints(mask, ratio, mobile); geo.push(land.geometry); mats.push(land.material); earth.add(land); }).catch((e: unknown) => { if (!abort.signal.aborted) console.warn('Earth particle mask unavailable', e); });
    const starField = stars(mobile); geo.push(starField.geometry); mats.push(starField.material); scene.add(starField); const glowMap = glowTexture(); tex.push(glowMap);
    const coreGeo = new THREE.SphereGeometry(mobile ? .054 : .048, 16, 12), hitGeo = new THREE.SphereGeometry(mobile ? .16 : .13, 12, 8), ringGeo = new THREE.RingGeometry(.068, .073, 64); geo.push(coreGeo, hitGeo, ringGeo); const markers: Marker[] = [], palette = [0x9de9e4, 0xcce8ee, 0xb7e58d, 0xe7b2bf];
    cities.forEach((city, i) => { const root = new THREE.Group(), position = vector(city.lat, city.lng, RADIUS * 1.035), color = city.hasPublicMemories ? palette[i % palette.length] : 0x8bb5b4, scale = city.hasPublicMemories ? .9 + Math.min(city.echoes, 24) * .025 : .58 + random(i, 71) * .18; root.position.copy(position); root.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), position.clone().normalize()); root.scale.setScalar(scale);
      const cm = new THREE.MeshBasicMaterial({ color, transparent: true, opacity: city.hasPublicMemories ? .98 : .56, depthWrite: false }), rm = new THREE.MeshBasicMaterial({ color, transparent: true, opacity: city.hasPublicMemories ? .34 : .09, side: THREE.DoubleSide, depthWrite: false }), gm = new THREE.SpriteMaterial({ map: glowMap, color, transparent: true, opacity: city.hasPublicMemories ? .46 : .14, blending: THREE.AdditiveBlending, depthWrite: false }), hm = new THREE.MeshBasicMaterial({ transparent: true, opacity: 0, depthWrite: false }); mats.push(cm, rm, gm, hm);
      const core = new THREE.Mesh(coreGeo, cm), ring = new THREE.Mesh(ringGeo, rm), glow = new THREE.Sprite(gm), hit = new THREE.Mesh(hitGeo, hm); ring.position.z = .014; glow.position.z = .006; glow.scale.setScalar(city.hasPublicMemories ? .46 : .28); hit.userData.city = city; root.add(core, ring, glow, hit); earth.add(root);
      const label = document.createElement('div'); label.className = `earth-city-label${city.hasPublicMemories ? ' has-public-memories' : ''}`; label.textContent = city.name; label.setAttribute('aria-hidden', 'true'); host.appendChild(label); markers.push({ city, root, hit, core, ring, glow, label, scale }); });
    const publicCities = cities.filter((c) => c.hasPublicMemories); for (let i = 0; i < Math.min(12, publicCities.length * 2); i += 1) { const from = publicCities[i % publicCities.length], to = publicCities[(i * 3 + 2) % publicCities.length]; if (from === to) continue; const a = vector(from.lat, from.lng, RADIUS * 1.035), b = vector(to.lat, to.lng, RADIUS * 1.035), apex = a.clone().add(b).normalize().multiplyScalar(RADIUS * (1.28 + random(i, 9) * .2)), g = new THREE.BufferGeometry().setFromPoints(new THREE.QuadraticBezierCurve3(a, apex, b).getPoints(42)), m = new THREE.LineBasicMaterial({ color: i % 3 ? 0x5ca4a7 : 0xb8e9e4, transparent: true, opacity: i % 4 ? .09 : .2, blending: THREE.AdditiveBlending, depthWrite: false }); geo.push(g); mats.push(m); earth.add(new THREE.Line(g, m)); }
    const ray = new THREE.Raycaster(), pointer = new THREE.Vector2(), down = new THREE.Vector2(), previous = new THREE.Vector2(), world = new THREE.Vector3(), cameraWorld = new THREE.Vector3(), projected = new THREE.Vector3(), targetScale = new THREE.Vector3(), focusTarget = new THREE.Vector3(.08, -.02, 1).normalize(); let dragging = false, moved = false, locked = false, vx = 0, vy = 0, frame = 0, last = performance.now(), hoveredId = '', focusingId = ''; let transition: { city: City; start: number; duration: number; from: THREE.Quaternion; to: THREE.Quaternion; camera: number; done: boolean } | undefined;
    const focus = (city: City) => { if (transition && getCityId(transition.city) === getCityId(city)) return; locked = true; dragging = false; vx = 0; vy = 0; focusingId = getCityId(city); hoveredId = ''; setHover(undefined); transition = { city, start: performance.now(), duration: reduced ? 180 : 1120, from: earth.quaternion.clone(), to: new THREE.Quaternion().setFromUnitVectors(vector(city.lat, city.lng).normalize(), focusTarget), camera: camera.position.z, done: false }; }; focusRef.current = focus;
    const front = (object: THREE.Object3D) => { object.getWorldPosition(world); camera.getWorldPosition(cameraWorld); const center = earth.getWorldPosition(new THREE.Vector3()); return world.sub(center).normalize().dot(cameraWorld.sub(center).normalize()) > .06; };
    const pick = (event: PointerEvent | MouseEvent) => { if (locked) return; const rect = renderer.domElement.getBoundingClientRect(); pointer.set(((event.clientX - rect.left) / rect.width) * 2 - 1, -((event.clientY - rect.top) / rect.height) * 2 + 1); ray.setFromCamera(pointer, camera); return ray.intersectObjects(markers.map((m) => m.hit), false).find((hit) => front(hit.object))?.object.userData.city as City | undefined; };
    const move = (event: PointerEvent) => { if (!dragging) { const city = pick(event); renderer.domElement.style.cursor = city ? 'pointer' : 'grab'; hoveredId = city ? getCityId(city) : ''; const rect = host.getBoundingClientRect(); setHover(city ? { city, x: event.clientX - rect.left, y: event.clientY - rect.top } : undefined); return; } const dx = event.clientX - previous.x, dy = event.clientY - previous.y; previous.set(event.clientX, event.clientY); if (down.distanceTo(previous) > 6) moved = true; vy = dx * .0028; vx = dy * .0018; earth.rotation.y += vy; earth.rotation.x = THREE.MathUtils.clamp(earth.rotation.x + vx, -.62, .62); setHover(undefined); };
    const pointerDown = (event: PointerEvent) => { if (locked || event.button) return; dragging = true; moved = false; down.set(event.clientX, event.clientY); previous.copy(down); renderer.domElement.setPointerCapture(event.pointerId); };
    const activate = (event: PointerEvent | MouseEvent) => { const city = pick(event); if (city) { selectRef.current(city); focus(city); } };
    const pointerUp = (event: PointerEvent) => { if (renderer.domElement.hasPointerCapture(event.pointerId)) renderer.domElement.releasePointerCapture(event.pointerId); if (locked) return; dragging = false; if (!moved) activate(event); };
    const resize = () => { const rect = host.getBoundingClientRect(); renderer.setSize(Math.max(1, rect.width), Math.max(1, rect.height), false); camera.aspect = Math.max(1, rect.width) / Math.max(1, rect.height); camera.updateProjectionMatrix(); }; const observer = new ResizeObserver(resize); observer.observe(host); resize();
    renderer.domElement.addEventListener('pointerdown', pointerDown); renderer.domElement.addEventListener('pointermove', move); renderer.domElement.addEventListener('pointerup', pointerUp);
    const animate = (time: number) => { const delta = Math.min((time - last) / 1000, .05); last = time; if (transition) { const p = THREE.MathUtils.clamp((time - transition.start) / transition.duration, 0, 1), e = ease(p); earth.quaternion.slerpQuaternions(transition.from, transition.to, e); camera.position.z = THREE.MathUtils.lerp(transition.camera, mobile ? 6.9 : 5.9, e); if (p === 1 && !transition.done) { transition.done = true; enterRef.current?.(transition.city); } } else if (!dragging && !reduced) { const f = delta * 60; earth.rotation.y += delta * -.075 + vy * f; earth.rotation.x = THREE.MathUtils.clamp(earth.rotation.x + vx * f, -.62, .62); const d = Math.exp(-5.2 * delta); vx *= d; vy *= d; }
      if (land) land.material.uniforms.uTime.value = time * .001; cloud.rotation.y = reduced ? 0 : time * .000012; const labels: Array<{ x: number; y: number; primary: boolean }> = [];
      markers.forEach((marker, i) => { const id = getCityId(marker.city), active = id === hoveredId || id === focusingId || id === selectedRef.current?.cityId, pulse = reduced ? 1 : .92 + Math.sin(time * (.00072 + random(i, 2) * .00042) + i * 2.1) * .08; targetScale.setScalar(marker.scale * (active ? 1.45 : 1)); marker.root.scale.lerp(targetScale, .11); marker.ring.rotation.z = reduced ? 0 : time * .00012 * (i % 2 ? 1 : -1); marker.core.material.opacity = active ? 1 : marker.city.hasPublicMemories ? .96 : .52; marker.ring.material.opacity = active ? .72 : marker.city.hasPublicMemories ? .31 : .08; marker.glow.material.opacity = active ? .88 : marker.city.hasPublicMemories ? .43 * pulse : .12 * pulse; marker.glow.scale.setScalar((marker.city.hasPublicMemories ? .46 : .28) * pulse * (active ? 1.55 : 1)); marker.core.getWorldPosition(projected); const center = earth.getWorldPosition(new THREE.Vector3()), visible = projected.clone().sub(center).normalize().dot(camera.position.clone().sub(center).normalize()) > .1; projected.project(camera); const x = (projected.x * .5 + .5) * host.clientWidth, y = (-projected.y * .5 + .5) * host.clientHeight, collision = labels.some((l) => Math.abs(l.x - x) < (marker.city.hasPublicMemories || l.primary ? 78 : 64) && Math.abs(l.y - y) < 17), show = visible && x > 36 && x < host.clientWidth - 90 && y > 24 && y < host.clientHeight - 30 && (active || !collision); marker.label.hidden = !show; if (show) { marker.label.style.transform = `translate3d(${x + 8}px,${y - 7}px,0)`; marker.label.classList.toggle('is-active', active); labels.push({ x, y, primary: marker.city.hasPublicMemories }); } }); starField.rotation.y -= delta * .003; renderer.render(scene, camera); frame = requestAnimationFrame(animate); }; frame = requestAnimationFrame(animate);
    return () => { focusRef.current = undefined; abort.abort(); cancelAnimationFrame(frame); observer.disconnect(); renderer.domElement.removeEventListener('pointerdown', pointerDown); renderer.domElement.removeEventListener('pointermove', move); renderer.domElement.removeEventListener('pointerup', pointerUp); markers.forEach((m) => m.label.remove()); geo.forEach((g) => g.dispose()); mats.forEach((m) => m.dispose()); tex.forEach((t) => t.dispose()); renderer.dispose(); renderer.forceContextLoss(); renderer.domElement.remove(); };
  }, [cities]);
  useEffect(() => { if (selectedCity) focusRef.current?.(selectedCity); }, [selectedCity]);
  return <section ref={hostRef} className="earth-stage" aria-label="全球声音记忆入口">{hover && <div className="city-tooltip" role="tooltip" style={{ left: hover.x, top: hover.y }}><strong>{hover.city.name}</strong><em>{hover.city.hasPublicMemories ? `${hover.city.echoes} sound memories` : 'open city atlas'}</em></div>}</section>;
}
