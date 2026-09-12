// GLSL for the Resonance Axis scene. Rings, points and filaments all use
// additive white-on-black glow; audio uniforms modulate structure across
// three time scales. The look is FINE luminous line work, not fat blobs.

export const RING_VERT = /* glsl */ `
  attribute vec4 aParams; // baseRadius, angle, stationX, depth
  attribute vec3 aRing;   // ringT(0..1), seed, stationIndex
  uniform float uTime;
  uniform float uBass;
  uniform float uMid;
  uniform float uHigh;
  uniform float uBeat;
  uniform float uFlux;
  uniform float uScale;
  uniform float uBend;
  uniform float uDepth;
  uniform float uScroll;
  uniform float uSpan;
  uniform float uShockAge;
  uniform float uShockKick;
  varying float vDepth;
  varying float vGlow;
  varying float vShock;

  // wrap a coordinate into [-span/2, span/2] for the seamless conveyor loop
  float wrapX(float x, float span) {
    float h = span * 0.5;
    return mod(x + h, span) - h;
  }

  void main() {
    float baseR = aParams.x;
    float ang = aParams.y;
    float stationX = aParams.z;
    float depth = aParams.w;
    float ringT = aRing.x;
    float seed = aRing.y;

    // micro: subtle radial tremor (kept small so lines stay crisp)
    float micro = sin(ang * 9.0 + uTime * 2.3 + seed) * 0.016
                + sin(ang * 23.0 - uTime * 1.4 + seed * 1.7) * 0.009;
    // meso: mid frequencies bend the ring contour (elliptical warp) — punchier
    float bend = uMid * uBend * (0.5 * sin(ang * 3.0 + seed + uTime * 0.6)
                + 0.3 * sin(ang * 5.0 - uTime * 0.9));

    // shockwave: a travelling ring-burst radiating out from the core on every
    // beat — this is the real "hit", not a global scale bounce
    float front = uShockAge * 13.0;
    float wx0 = wrapX(stationX - uScroll, uSpan);
    float dist = abs(wx0);
    float band = exp(-pow((dist - front) * 0.45, 2.0));
    float shock = band * exp(-uShockAge * 2.6) * uShockKick;

    // bass expands the whole ring + beat kick + the shockwave passing through
    float expand = 1.0 + uBass * 0.22 + uBeat * 0.22 + shock * 0.55;

    float r = (baseR * expand + micro + bend) * uScale;
    float y = cos(ang) * r;
    float z = sin(ang) * r;

    // seamless right→left march: scroll each station along the belt and wrap
    float x = wx0 * uDepth + uBass * 0.6;

    vec3 pos = vec3(x, y, z);
    vDepth = depth;
    vShock = shock;
    // inner rings glow a touch brighter (luminous core); depth dims the tunnel
    float coreGlow = mix(1.0, 0.55, ringT);
    // fade near the wrap edges so recycling is invisible
    float edge = smoothstep(1.0, 0.72, dist / (uSpan * 0.5));
    vGlow = ((0.5 + uHigh * 0.6 + uBeat * 0.5 + shock * 1.4) * coreGlow - depth * 0.28) * edge;

    vec4 mv = modelViewMatrix * vec4(pos, 1.0);
    gl_Position = projectionMatrix * mv;
  }
`;

export const RING_FRAG = /* glsl */ `
  precision highp float;
  uniform float uContrast;
  uniform float uLineWeight;
  varying float vDepth;
  varying float vGlow;
  varying float vShock;
  void main() {
    // thin bright lines: low base so density (not size) carries the image
    float base = (0.34 - vDepth * 0.2) * uLineWeight;
    float g = clamp((base * max(0.0, vGlow) + vShock * 0.5) * uContrast, 0.0, 1.0);
    gl_FragColor = vec4(vec3(g), g);
  }
`;

export const POINT_VERT = /* glsl */ `
  attribute vec4 aParams; // radius, angle, stationX, depth
  attribute vec2 aRnd;
  uniform float uTime;
  uniform float uHigh;
  uniform float uBass;
  uniform float uBeat;
  uniform float uScale;
  uniform float uDepth;
  uniform float uScroll;
  uniform float uSpan;
  uniform float uPointSize;
  uniform float uShockAge;
  uniform float uShockKick;
  varying float vDepth;
  varying float vTw;
  float wrapX(float x, float span){ float h=span*0.5; return mod(x+h,span)-h; }
  void main() {
    float r = aParams.x;
    float ang = aParams.y + uTime * (0.04 + aRnd.x * 0.10);
    float depth = aParams.w;
    float wx = wrapX(aParams.z - uScroll, uSpan);
    float dist = abs(wx);
    float front = uShockAge * 13.0;
    float band = exp(-pow((dist - front) * 0.45, 2.0));
    float shock = band * exp(-uShockAge * 2.6) * uShockKick;
    float expand = 1.0 + uBass * 0.22 + uBeat * 0.2 + shock * 0.6;
    r *= expand * uScale;
    float x = wx * uDepth;
    vec3 pos = vec3(x, cos(ang) * r, sin(ang) * r);
    vDepth = depth;
    float edge = smoothstep(1.0, 0.72, dist / (uSpan * 0.5));
    // high freq drives shimmer, sharpened by any passing shockwave
    vTw = (0.3 + 0.6 * sin(uTime * (4.0 + aRnd.y * 6.0) + aRnd.x * 30.0) + uHigh * 1.1 + shock * 1.8) * edge;
    vec4 mv = modelViewMatrix * vec4(pos, 1.0);
    // tiny, sharp points — clamp so they never bloom into blobs
    float sz = uPointSize * (1.0 - depth * 0.4) * (150.0 / -mv.z) * (1.0 + shock * 0.8);
    gl_PointSize = clamp(sz, 0.6, 4.2);
    gl_Position = projectionMatrix * mv;
  }
`;

export const POINT_FRAG = /* glsl */ `
  precision highp float;
  uniform float uContrast;
  varying float vDepth;
  varying float vTw;
  void main() {
    vec2 uv = gl_PointCoord - 0.5;
    float d = length(uv);
    // sharp small dot with a crisp edge
    float alpha = smoothstep(0.5, 0.12, d);
    float g = clamp(alpha * (0.55 - vDepth * 0.3) * max(0.0, vTw) * uContrast, 0.0, 1.0);
    gl_FragColor = vec4(vec3(g), g);
  }
`;

export const FILAMENT_VERT = /* glsl */ `
  attribute vec4 aParams; // t, radius, angleOffset, baseX
  attribute vec2 aRnd;     // rnd, depth
  uniform float uTime;
  uniform float uMid;
  uniform float uHigh;
  uniform float uBass;
  uniform float uBeat;
  uniform float uScale;
  uniform float uDepth;
  uniform float uScroll;
  uniform float uSpan;
  uniform float uShockAge;
  uniform float uShockKick;
  varying float vFade;
  float wrapX(float x, float span){ float h=span*0.5; return mod(x+h,span)-h; }
  void main() {
    float t = aParams.x;
    float rad = aParams.y;
    float ang = aParams.z;
    float baseX = aParams.w;
    float depth = aRnd.y;

    // each strand is a short local thread; it rides the same right→left belt
    float local = (t - 0.5) * 4.2; // strand length along the axis
    float wx = wrapX(baseX + local - uScroll, uSpan);
    float dist = abs(wx);
    float front = uShockAge * 13.0;
    float band = exp(-pow((dist - front) * 0.45, 2.0));
    float shock = band * exp(-uShockAge * 2.6) * uShockKick;

    float x = wx * uDepth;
    // mid freq bends the winding hard — this is where the "hit" reads on
    // the connective threads, drift flows over time
    float wind = ang + t * (3.5 + uMid * 6.0) + uTime * (0.3 + aRnd.x * 0.4);
    float r = (rad * (0.6 + 0.5 * sin(t * 3.14159))) * uScale
            * (1.0 + uBass * 0.2 + shock * 0.7);
    // high freq micro-jitter along the strand, sharpened by shockwaves
    float jitter = (uHigh * 0.14 + shock * 0.5)
                 * sin(uTime * 9.0 + aRnd.x * 40.0 + t * 12.0) * t;
    float y = cos(wind) * r + jitter;
    float z = sin(wind) * r + jitter;

    vec3 pos = vec3(x, y, z);
    float edge = smoothstep(1.0, 0.72, dist / (uSpan * 0.5));
    vFade = ((1.0 - depth * 0.5) * (0.25 + 0.75 * sin(t * 3.14159))
           + uBeat * 0.35 + shock * 0.9) * edge;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(pos, 1.0);
  }
`;

export const FILAMENT_FRAG = /* glsl */ `
  precision highp float;
  uniform float uContrast;
  uniform float uLineWeight;
  varying float vFade;
  void main() {
    // rendered as thin GL_LINES — faint continuous threads
    float g = clamp(max(0.0, vFade) * 0.24 * uLineWeight * uContrast, 0.0, 1.0);
    gl_FragColor = vec4(vec3(g), g);
  }
`;

export const CYL_VERT = /* glsl */ `
  uniform float uTime;
  uniform float uFlux;
  uniform float uMid;
  uniform float uScale;
  uniform float uBass;
  uniform float uBeat;
  uniform float uShockAge;
  uniform float uShockKick;
  varying float vShade;
  void main() {
    vec3 p = position;
    float ang = atan(p.z, p.y);
    // spectrum flux disturbs the mesh; mid ripples along length; beat kicks it
    float disturb = uFlux * 0.34 * sin(p.x * 3.0 + ang * 6.0 + uTime * 3.0)
                  + uMid * 0.2 * sin(p.x * 1.5 - uTime * 1.2)
                  + uBeat * 0.16 * sin(ang * 8.0 - uTime * 6.0);
    // the shockwave visibly ripples down the core as it fires
    float ring = exp(-pow((abs(p.x) - uShockAge * 13.0) * 0.5, 2.0)) * exp(-uShockAge * 2.6);
    float rad = 1.0 + disturb + uBass * 0.1 + ring * uShockKick * 0.5;
    vec3 pos = vec3(p.x, p.y * rad, p.z * rad) * vec3(1.0, uScale, uScale);
    vShade = 0.26 + 0.36 * abs(sin(ang * 2.0 + uTime)) + uFlux * 0.5 + ring * uShockKick;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(pos, 1.0);
  }
`;

export const CYL_FRAG = /* glsl */ `
  precision highp float;
  uniform float uContrast;
  uniform float uLineWeight;
  varying float vShade;
  void main() {
    float g = clamp(vShade * 0.4 * uLineWeight * uContrast, 0.0, 1.0);
    gl_FragColor = vec4(vec3(g), g);
  }
`;
