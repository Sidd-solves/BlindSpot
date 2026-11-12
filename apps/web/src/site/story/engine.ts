import * as THREE from 'three';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import { ShaderPass } from 'three/examples/jsm/postprocessing/ShaderPass.js';
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js';

/**
 * The home page as one camera journey, driven by scroll progress p (0 to 1):
 * a glass dashboard builds itself, the camera dives into its screen, falls through a field of rows,
 * flies down a tunnel of checks, watches the rows gather into the hidden number, flashes white,
 * and pulls back out of a finding card that shatters into the finale.
 */

/** Where each chapter sits on the scroll track. The page overlay reads the same numbers. */
export const T = {
  hero: [0, 0.07],
  dive: [0.07, 0.2],
  field: [0.2, 0.4],
  tunnel: [0.4, 0.6],
  reveal: [0.6, 0.77],
  out: [0.78, 0.9],
  end: [0.9, 1],
} as const;

export const clamp01 = (x: number) => Math.min(1, Math.max(0, x));
export const seg = (p: number, a: number, b: number) => clamp01((p - a) / (b - a));
const sstep = (x: number) => x * x * (3 - 2 * x);
const easeIn3 = (x: number) => x * x * x;
const easeOut3 = (x: number) => 1 - Math.pow(1 - x, 3);
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

export type StoryFrame = {
  p: number;
  /** How far the page has scrolled past the end of the journey, in screens. */
  after: number;
  vel: number;
  labels: { x: number; y: number; d: number }[];
};
export type StoryOpts = {
  track: HTMLElement;
  labels: [number, number, number][];
  still: boolean;
  onFrame: (f: StoryFrame) => void;
};

const BASE_Z = -300; // where the break-out scene lives

function camZ(p: number) {
  if (p < 0.07) return lerp(9, 8.3, p / 0.07);
  if (p < 0.2) return lerp(8.3, 0.45, easeIn3(seg(p, 0.07, 0.2)));
  if (p < 0.4) return lerp(0.45, -70, sstep(seg(p, 0.2, 0.4)));
  if (p < 0.6) return lerp(-70, -168, seg(p, 0.4, 0.6));
  if (p < 0.775) return lerp(-168, -177, easeOut3(seg(p, 0.6, 0.775)));
  if (p < 0.9) return lerp(BASE_Z + 2.6, BASE_Z + 9.5, easeOut3(seg(p, 0.775, 0.86)));
  return BASE_Z + 9.5 + (p - 0.9) * 8;
}

// ---------- canvas textures ----------
function fontFamily() {
  return getComputedStyle(document.body).fontFamily || 'system-ui, sans-serif';
}
function glassBase(g: CanvasRenderingContext2D, W: number, H: number, tint: string) {
  const bg = g.createLinearGradient(0, 0, W, H);
  bg.addColorStop(0, '#0f1230');
  bg.addColorStop(1, '#06070f');
  g.fillStyle = bg;
  g.beginPath();
  g.roundRect(4, 4, W - 8, H - 8, 46);
  g.fill();
  const glow = g.createRadialGradient(W * 0.2, 0, 10, W * 0.2, 0, W * 0.8);
  glow.addColorStop(0, tint);
  glow.addColorStop(1, 'rgba(0,0,0,0)');
  g.fillStyle = glow;
  g.fill();
  g.strokeStyle = 'rgba(255,255,255,.14)';
  g.lineWidth = 3;
  g.stroke();
}
function dashboardTexture() {
  const W = 1600,
    H = 1000,
    f = fontFamily();
  const c = document.createElement('canvas');
  c.width = W;
  c.height = H;
  const g = c.getContext('2d')!;
  glassBase(g, W, H, 'rgba(139,92,246,.22)');
  ['#f43f5e', '#f59e0b', '#34d399'].forEach((col, i) => {
    g.fillStyle = col;
    g.beginPath();
    g.arc(60 + i * 30, 58, 9, 0, 7);
    g.fill();
  });
  g.fillStyle = 'rgba(255,255,255,.55)';
  g.font = `600 26px ${f}`;
  g.fillText('Sales overview  ·  last 12 months', 170, 67);
  g.fillStyle = 'rgba(52,211,153,.16)';
  g.beginPath();
  g.roundRect(W - 250, 34, 190, 48, 24);
  g.fill();
  g.fillStyle = '#34d399';
  g.font = `800 24px ${f}`;
  g.fillText('●  All good', W - 222, 67);
  const kpis = [
    ['Revenue', '£482,190', '▲ 12.4%'],
    ['Orders', '6,118', '▲ 8.1%'],
    ['Customers', '1,904', '▲ 5.6%'],
  ];
  kpis.forEach(([k, v, d], i) => {
    const x = 60 + i * 505;
    g.fillStyle = 'rgba(255,255,255,.045)';
    g.beginPath();
    g.roundRect(x, 118, 470, 190, 26);
    g.fill();
    g.strokeStyle = 'rgba(255,255,255,.08)';
    g.lineWidth = 2;
    g.stroke();
    g.fillStyle = 'rgba(255,255,255,.5)';
    g.font = `700 24px ${f}`;
    g.fillText(k.toUpperCase(), x + 30, 168);
    g.fillStyle = '#fff';
    g.font = `800 66px ${f}`;
    g.fillText(v, x + 30, 248);
    g.fillStyle = '#34d399';
    g.font = `800 26px ${f}`;
    g.fillText(d, x + 30, 288);
  });
  // chart frame (the line itself is real geometry, drawn in 3D)
  g.strokeStyle = 'rgba(255,255,255,.06)';
  g.lineWidth = 2;
  for (let i = 0; i <= 4; i++) {
    const y = 375 + i * 131;
    g.beginPath();
    g.moveTo(75, y);
    g.lineTo(1050, y);
    g.stroke();
  }
  g.fillStyle = 'rgba(255,255,255,.35)';
  g.font = `600 20px ${f}`;
  ['Jan', 'Mar', 'May', 'Jul', 'Sep', 'Nov'].forEach((m, i) => g.fillText(m, 80 + i * 188, 945));
  g.fillStyle = 'rgba(255,255,255,.5)';
  g.font = `700 22px ${f}`;
  g.fillText('TOP PRODUCTS', 1150, 400);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 8;
  return tex;
}
function findingTexture() {
  const W = 1600,
    H = 1000,
    f = fontFamily();
  const c = document.createElement('canvas');
  c.width = W;
  c.height = H;
  const g = c.getContext('2d')!;
  glassBase(g, W, H, 'rgba(245,158,11,.28)');
  g.fillStyle = 'rgba(245,158,11,.16)';
  g.beginPath();
  g.roundRect(70, 70, 330, 54, 27);
  g.fill();
  g.fillStyle = '#fbbf24';
  g.font = `800 25px ${f}`;
  g.fillText('●  FOUND IN YOUR DATA', 96, 106);
  g.fillStyle = '#fff';
  g.font = `800 82px ${f}`;
  g.fillText('10 of your best customers', 70, 250);
  g.fillText('stopped ordering.', 70, 345);
  g.fillStyle = '#fbbf24';
  g.font = `800 56px ${f}`;
  g.fillText('£93,531 a year at risk', 70, 440);
  const rows = [
    ['Customer 14646', 'last order 94 days ago', '£12,480'],
    ['Customer 18102', 'last order 81 days ago', '£11,205'],
    ['Customer 17450', 'last order 77 days ago', '£9,870'],
  ];
  rows.forEach(([a, b, v], i) => {
    const y = 520 + i * 110;
    g.fillStyle = 'rgba(255,255,255,.045)';
    g.beginPath();
    g.roundRect(70, y, 1460, 88, 20);
    g.fill();
    g.fillStyle = '#fff';
    g.font = `700 32px ${f}`;
    g.fillText(a, 104, y + 55);
    g.fillStyle = 'rgba(255,255,255,.5)';
    g.font = `600 27px ${f}`;
    g.fillText(b, 520, y + 55);
    g.fillStyle = '#fbbf24';
    g.font = `800 32px ${f}`;
    g.fillText(v, 1360, y + 55);
  });
  g.fillStyle = 'rgba(255,255,255,.45)';
  g.font = `600 26px ${f}`;
  g.fillText('Every number traced to the rows behind it', 70, 930);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 8;
  return tex;
}
/** Points that spell `text`, centred at (0, 0, z), about `width` units wide. */
function sampleText(text: string, width: number, z: number, max: number) {
  const W = 1000,
    H = 280;
  const c = document.createElement('canvas');
  c.width = W;
  c.height = H;
  const g = c.getContext('2d')!;
  let size = 230;
  g.font = `800 ${size}px ${fontFamily()}`;
  const tw = g.measureText(text).width;
  if (tw > W * 0.94) size = Math.floor((size * W * 0.94) / tw);
  g.font = `800 ${size}px ${fontFamily()}`;
  g.fillStyle = '#fff';
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.fillText(text, W / 2, H / 2 + 10);
  const d = g.getImageData(0, 0, W, H).data;
  let step = 2;
  let pts: number[] = [];
  do {
    pts = [];
    for (let y = 0; y < H; y += step)
      for (let x = 0; x < W; x += step)
        if (d[(y * W + x) * 4 + 3] > 140)
          pts.push(
            (x / W - 0.5) * width + (Math.random() - 0.5) * 0.04,
            -(y / H - 0.5) * width * (H / W) + (Math.random() - 0.5) * 0.04,
            z + (Math.random() - 0.5) * 0.5,
          );
    step++;
  } while (pts.length / 3 > max);
  return pts;
}

// ---------- shaders ----------
const POINT_FRAG = `
varying vec3 vCol; varying float vA;
void main(){
  float d = length(gl_PointCoord - .5);
  float a = 1. - smoothstep(0., .5, d);
  a *= a;
  gl_FragColor = vec4(vCol * a * vA, 1.);
}`;
const FIELD_VERT = `
uniform float uTime, uMorph, uPx, uQuiet, uShow;
attribute vec3 aTarget; attribute vec4 aRand; attribute float aKind;
varying vec3 vCol; varying float vA;
void main(){
  vec3 p = position;
  p.x += sin(uTime * .3 + aRand.z * 6.283) * .18;
  p.y += cos(uTime * .25 + aRand.w * 6.283) * .14;
  float quiet = step(aRand.y, .05);
  p += quiet * uQuiet * vec3(aRand.z - .5, aRand.w - .5, .15) * 9.;
  float m = clamp(uMorph * 1.7 - aRand.x * .7, 0., 1.);
  m = m * m * (3. - 2. * m);
  vec3 ctrl = mix(p, aTarget, .5) + vec3(sin(aRand.z * 31.) * 9., cos(aRand.w * 23.) * 7., 6.);
  vec3 q = mix(mix(p, ctrl, m), mix(ctrl, aTarget, m), m);
  q.x += sin(uTime * 1.3 + aRand.x * 20.) * .03 * m;
  vec4 mv = modelViewMatrix * vec4(q, 1.);
  gl_Position = projectionMatrix * mv;
  float txt = aKind * m;
  gl_PointSize = uPx * (.55 + aRand.w * 1.1) * (1. - .25 * txt) / -mv.z;
  vec3 base = mix(vec3(.45, .3, 1.), vec3(.1, .75, .95), aRand.z);
  vec3 amber = vec3(1., .55, .08) * (1.2 + .5 * sin(uTime * 3. + aRand.x * 9.));
  vec3 col = mix(base, amber, quiet * (1. - m));
  col = mix(col, mix(vec3(1., .62, .16) * 1.05, vec3(1., .9, .75), aRand.y * .6), txt);
  vCol = col;
  float keep = mix(1., aKind * .8 + (1. - aKind) * .12, m);
  vA = smoothstep(.4, 3., -mv.z) * smoothstep(150., 70., -mv.z) * keep * uShow * (1. - quiet * uQuiet * .5);
}`;
const SIMPLE_VERT = `
uniform float uPx, uShow, uTime, uSpin;
attribute vec3 color; attribute float aSize;
varying vec3 vCol; varying float vA;
void main(){
  vec3 p = position;
  float a = uSpin * uTime * (.2 + aSize * .15);
  p.xz = mat2(cos(a), -sin(a), sin(a), cos(a)) * p.xz;
  vec4 mv = modelViewMatrix * vec4(p, 1.);
  gl_Position = projectionMatrix * mv;
  gl_PointSize = uPx * aSize / -mv.z;
  vCol = color;
  vA = uShow * smoothstep(.3, 2., -mv.z);
}`;
const ORBIT_VERT = `
uniform float uPx, uShow, uTime; uniform vec3 uC;
attribute vec3 color; attribute vec3 aOrb;
varying vec3 vCol; varying float vA;
void main(){
  float a = aOrb.x + uTime * (.12 + .05 / aOrb.y * 6.);
  vec3 p = uC + vec3(cos(a) * aOrb.y, sin(a) * aOrb.y * .34 + aOrb.z, sin(a) * aOrb.y * .9);
  vec4 mv = modelViewMatrix * vec4(p, 1.);
  gl_Position = projectionMatrix * mv;
  gl_PointSize = uPx * (.6 + fract(aOrb.x * 7.) * 1.4) / -mv.z;
  vCol = color * (.7 + .5 * sin(uTime * 2. + aOrb.x * 13.));
  vA = uShow * smoothstep(.3, 2., -mv.z);
}`;
const LENS = {
  uniforms: {
    tDiffuse: { value: null },
    uTime: { value: 0 },
    uRing: { value: 0 },
    uRingR: { value: 0.42 },
    uFlash: { value: 0 },
    uCA: { value: 0.0015 },
    uAspect: { value: 1 },
  },
  vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.); }',
  fragmentShader: `
uniform sampler2D tDiffuse; uniform float uTime, uRing, uRingR, uFlash, uCA, uAspect; varying vec2 vUv;
float h(vec2 p){ return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453); }
void main(){
  vec2 c = vUv - .5; vec2 cc = c; cc.x *= uAspect; float r = length(cc);
  float band = exp(-pow((r - uRingR) / .055, 2.)) * uRing;
  vec2 dir = c / (length(c) + 1e-4);
  vec2 uv = vUv - dir * band * .025;
  float off = uCA * (.3 + r * 1.6) + band * .02;
  vec3 col = vec3(texture2D(tDiffuse, uv + dir * off).r, texture2D(tDiffuse, uv).g, texture2D(tDiffuse, uv - dir * off).b);
  vec3 rb = .5 + .5 * cos(6.2831 * (r * 2.4 - uTime * .04 + vec3(0., .33, .67)));
  col += rb * band * .1;
  col *= 1. - smoothstep(.42, 1., r) * .7;
  float gr = h(vUv * 900. + fract(uTime * 7.)) - .5;
  col *= 1. + gr * .1;
  col += gr * .004;
  col = mix(col, vec3(1.), clamp(uFlash, 0., 1.));
  gl_FragColor = vec4(col, 1.);
}`,
};

export function createStory(canvas: HTMLCanvasElement, o: StoryOpts) {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: false, powerPreference: 'high-performance' });
  const small = () => innerWidth < 760;
  renderer.setPixelRatio(Math.min(devicePixelRatio, small() ? 1.3 : 1.6));
  renderer.setClearColor(0x04040a, 1);
  const scene = new THREE.Scene();
  scene.fog = new THREE.FogExp2(0x04040a, 0.012);
  const camera = new THREE.PerspectiveCamera(45, innerWidth / innerHeight, 0.05, 400);
  const composer = new EffectComposer(renderer);
  composer.addPass(new RenderPass(scene, camera));
  const bloom = new UnrealBloomPass(new THREE.Vector2(innerWidth / 2, innerHeight / 2), 0.8, 0.55, 0.82);
  composer.addPass(bloom);
  const lens = new ShaderPass(LENS);
  composer.addPass(lens);
  composer.addPass(new OutputPass());
  const disposables: { dispose: () => void }[] = [];
  const keep = <D extends { dispose: () => void }>(d: D) => (disposables.push(d), d);

  // ---------- background stars (follow the camera so space never runs out) ----------
  const stars = (() => {
    const n = 2600,
      pos = new Float32Array(n * 3),
      col = new Float32Array(n * 3),
      size = new Float32Array(n);
    for (let i = 0; i < n; i++) {
      const u = Math.random() * 2 - 1,
        th = Math.random() * Math.PI * 2,
        r = 60 + Math.random() * 90,
        s = Math.sqrt(1 - u * u);
      pos.set([r * s * Math.cos(th), r * s * Math.sin(th), r * u], i * 3);
      const w = 0.35 + Math.random() * 0.5;
      col.set([w * 0.8, w * 0.85, w], i * 3);
      size[i] = 0.6 + Math.random() * 1.6;
    }
    const geo = keep(new THREE.BufferGeometry());
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
    geo.setAttribute('aSize', new THREE.BufferAttribute(size, 1));
    const mat = keep(
      new THREE.ShaderMaterial({
        vertexShader: SIMPLE_VERT,
        fragmentShader: POINT_FRAG,
        uniforms: { uPx: { value: 160 }, uShow: { value: 1 }, uTime: { value: 0 }, uSpin: { value: 0.02 } },
        transparent: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
        fog: false,
      }),
    );
    const pts = new THREE.Points(geo, mat);
    pts.frustumCulled = false;
    scene.add(pts);
    return { pts, mat };
  })();

  // ---------- chapter 1: the glass dashboard ----------
  const PW = 6.4,
    PH = 4;
  const panel = new THREE.Group();
  scene.add(panel);
  const dashMat = keep(
    new THREE.MeshBasicMaterial({ map: keep(dashboardTexture()), color: 0xdddddd, transparent: true, opacity: 0, depthWrite: false }),
  );
  panel.add(new THREE.Mesh(keep(new THREE.PlaneGeometry(PW, PH)), dashMat));
  const edgeMat = keep(new THREE.LineBasicMaterial({ color: new THREE.Color(0.5, 0.8, 1.6), transparent: true, opacity: 0 }));
  const edge = new THREE.LineSegments(keep(new THREE.EdgesGeometry(new THREE.PlaneGeometry(PW, PH))), edgeMat);
  edge.position.z = 0.002;
  panel.add(edge);
  // construction grid that draws itself before the glass fills in
  const gridGeo = (() => {
    const v: number[] = [];
    for (let x = -PW / 2; x <= PW / 2 + 1e-6; x += 0.4) v.push(x, -PH / 2, 0, x, PH / 2, 0);
    for (let y = -PH / 2; y <= PH / 2 + 1e-6; y += 0.4) v.push(-PW / 2, y, 0, PW / 2, y, 0);
    const g = keep(new THREE.BufferGeometry());
    g.setAttribute('position', new THREE.Float32BufferAttribute(v, 3));
    return g;
  })();
  const gridMat = keep(
    new THREE.LineBasicMaterial({ color: new THREE.Color(0.6, 0.5, 1.4), transparent: true, opacity: 0, blending: THREE.AdditiveBlending }),
  );
  const grid = new THREE.LineSegments(gridGeo, gridMat);
  grid.position.z = 0.001;
  panel.add(grid);
  const gridCount = gridGeo.attributes.position.count;
  // the sales line: rising, the reassuring kind
  const tx = (px: number) => px / 250 - PW / 2,
    ty = (py: number) => PH / 2 - py / 250;
  const linePts: THREE.Vector3[] = [];
  for (let i = 0; i <= 40; i++) {
    const u = i / 40;
    const y = 880 - u * 420 - Math.sin(u * 13) * 34 - Math.sin(u * 5.3 + 1) * 26;
    linePts.push(new THREE.Vector3(tx(90 + u * 950), ty(y), 0.01));
  }
  const tubeGeo = keep(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(linePts), 200, 0.022, 6, false));
  const tubeMat = keep(new THREE.MeshBasicMaterial({ color: new THREE.Color(0.3, 1.7, 1.05) }));
  const tube = new THREE.Mesh(tubeGeo, tubeMat);
  panel.add(tube);
  const tubeIdx = tubeGeo.index!.count;
  tubeGeo.setDrawRange(0, 0);
  const bars: THREE.Mesh[] = [];
  const barGeo = keep(new THREE.BoxGeometry(0.13, 1, 0.04));
  const barH = [0.95, 0.78, 0.66, 0.58, 0.47, 0.4, 0.31, 0.25];
  barH.forEach((h, i) => {
    const m = keep(
      new THREE.MeshBasicMaterial({ color: new THREE.Color().setHSL(0.72 - i * 0.035, 0.85, 0.6).multiplyScalar(1.12) }),
    );
    const b = new THREE.Mesh(barGeo, m);
    b.userData = { h: h * 1.55, x: tx(1165 + i * 46) };
    b.position.set(b.userData.x, ty(900), 0.02);
    b.scale.y = 0.0001;
    panel.add(b);
    bars.push(b);
  });

  // ---------- chapter 2: the field of rows ----------
  const N = small() ? 22000 : 38000;
  const fieldGeo = keep(new THREE.BufferGeometry());
  const fPos = new Float32Array(N * 3),
    fRand = new Float32Array(N * 4),
    fTarget = new Float32Array(N * 3),
    fKind = new Float32Array(N);
  for (let i = 0; i < N; i++) {
    const row = Math.random() < 0.62;
    const z = -4 - Math.random() * 70;
    if (row) {
      const ry = Math.round(Math.random() * 30 - 15) * 0.85;
      fPos.set([Math.random() * 60 - 30, ry + (Math.random() - 0.5) * 0.06, z], i * 3);
    } else {
      fPos.set([(Math.random() - 0.5) * 70, (Math.random() - 0.5) * 42, z], i * 3);
    }
    fRand.set([Math.random(), Math.random(), Math.random(), Math.random()], i * 4);
  }
  fieldGeo.setAttribute('position', new THREE.BufferAttribute(fPos, 3));
  fieldGeo.setAttribute('aRand', new THREE.BufferAttribute(fRand, 4));
  fieldGeo.setAttribute('aTarget', new THREE.BufferAttribute(fTarget, 3));
  fieldGeo.setAttribute('aKind', new THREE.BufferAttribute(fKind, 1));
  const REVEAL_Z = -190;
  const placeTargets = () => {
    const txt = sampleText('£93.5K', 11.5, REVEAL_Z, Math.floor(N * 0.3));
    const nt = txt.length / 3;
    for (let i = 0; i < N; i++) {
      if (i < nt) {
        fTarget.set(txt.slice(i * 3, i * 3 + 3), i * 3);
        fKind[i] = 1;
      } else {
        const a = Math.random() * Math.PI * 2,
          r = 7.5 + Math.random() * 3 + Math.pow(Math.random(), 3) * 8;
        fTarget.set([Math.cos(a) * r, Math.sin(a) * r * 0.62, REVEAL_Z - 2 - Math.random() * 6], i * 3);
        fKind[i] = 0;
      }
    }
    fieldGeo.attributes.aTarget.needsUpdate = true;
    fieldGeo.attributes.aKind.needsUpdate = true;
  };
  placeTargets();
  const fieldMat = keep(
    new THREE.ShaderMaterial({
      vertexShader: FIELD_VERT,
      fragmentShader: POINT_FRAG,
      uniforms: {
        uTime: { value: 0 },
        uMorph: { value: 0 },
        uPx: { value: 100 },
        uQuiet: { value: 0 },
        uShow: { value: 0 },
      },
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    }),
  );
  const field = new THREE.Points(fieldGeo, fieldMat);
  field.frustumCulled = false;
  scene.add(field);

  // ---------- chapter 3: the tunnel of checks ----------
  const TZ0 = -72,
    TZ1 = -174;
  const realm = (z: number) =>
    z > -106 ? new THREE.Color('#8b5cf6') : z > -140 ? new THREE.Color('#22d3ee') : new THREE.Color('#f59e0b');
  const NB = small() ? 1400 : 2600;
  const boxGeo = keep(new THREE.BoxGeometry(1, 1, 1));
  const boxMat = keep(new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.92 }));
  const camZU = { value: 0 };
  boxMat.onBeforeCompile = (sh) => {
    sh.uniforms.uCamZ = camZU;
    sh.vertexShader = 'uniform float uCamZ;\n' + sh.vertexShader.replace(
      '#include <begin_vertex>',
      `#include <begin_vertex>
      float dd = instanceMatrix[3].z - uCamZ;
      float grow = smoothstep(-58., -20., dd) * (1. - smoothstep(3., 10., dd));
      transformed *= grow;`,
    );
  };
  const boxes = new THREE.InstancedMesh(boxGeo, boxMat, NB);
  const m4 = new THREE.Matrix4(),
    q = new THREE.Quaternion(),
    e = new THREE.Euler(),
    v3 = new THREE.Vector3(),
    s3 = new THREE.Vector3();
  for (let i = 0; i < NB; i++) {
    const a = Math.random() * Math.PI * 2,
      r = 4.4 + Math.pow(Math.random(), 0.7) * 4,
      z = TZ0 - Math.random() * (TZ0 - TZ1);
    v3.set(Math.cos(a) * r, Math.sin(a) * r, z);
    e.set(0, 0, a);
    q.setFromEuler(e);
    const lit = Math.random() < 0.14;
    s3.set(0.15 + Math.random() * 0.7, 0.15 + Math.random() * 0.6, 0.6 + Math.random() * 4.5);
    m4.compose(v3, q, s3);
    boxes.setMatrixAt(i, m4);
    const c = realm(z).multiplyScalar(lit ? 1.5 : 0.1 + Math.random() * 0.3);
    boxes.setColorAt(i, c);
  }
  boxes.frustumCulled = false;
  scene.add(boxes);
  // square frames that twist down the tunnel
  const frameGeo = (() => {
    const v: number[] = [];
    for (let z = TZ0; z >= TZ1; z -= 3) {
      const r = 8.6,
        a0 = z * 0.045;
      const cs = [0, 1, 2, 3].map((k) => [Math.cos(a0 + (k * Math.PI) / 2) * r, Math.sin(a0 + (k * Math.PI) / 2) * r]);
      for (let k = 0; k < 4; k++) v.push(cs[k][0], cs[k][1], z, cs[(k + 1) % 4][0], cs[(k + 1) % 4][1], z);
    }
    const g = keep(new THREE.BufferGeometry());
    g.setAttribute('position', new THREE.Float32BufferAttribute(v, 3));
    return g;
  })();
  const frameMat = keep(
    new THREE.LineBasicMaterial({ color: 0xbfc7ff, transparent: true, opacity: 0.18, blending: THREE.AdditiveBlending }),
  );
  const frames = new THREE.LineSegments(frameGeo, frameMat);
  scene.add(frames);
  // speed streaks
  const streakGeo = (() => {
    const v: number[] = [],
      c: number[] = [];
    for (let i = 0; i < 700; i++) {
      const a = Math.random() * Math.PI * 2,
        r = 1.6 + Math.random() * 6,
        z = TZ0 - Math.random() * (TZ0 - TZ1),
        l = 1.5 + Math.random() * 5;
      v.push(Math.cos(a) * r, Math.sin(a) * r, z, Math.cos(a) * r, Math.sin(a) * r, z - l);
      const col = realm(z);
      c.push(col.r * 1.6, col.g * 1.6, col.b * 1.6, 0, 0, 0);
    }
    const g = keep(new THREE.BufferGeometry());
    g.setAttribute('position', new THREE.Float32BufferAttribute(v, 3));
    g.setAttribute('color', new THREE.Float32BufferAttribute(c, 3));
    return g;
  })();
  const streakMat = keep(
    new THREE.LineBasicMaterial({ vertexColors: true, transparent: true, opacity: 0, blending: THREE.AdditiveBlending }),
  );
  const streaks = new THREE.LineSegments(streakGeo, streakMat);
  scene.add(streaks);

  // ---------- chapter 5: the finding card, and the glass it breaks out of ----------
  const card = new THREE.Group();
  card.position.z = BASE_Z;
  scene.add(card);
  const cardMat = keep(
    new THREE.MeshBasicMaterial({ map: keep(findingTexture()), color: 0xdddddd, transparent: true, opacity: 1, depthWrite: false }),
  );
  card.add(new THREE.Mesh(keep(new THREE.PlaneGeometry(PW, PH)), cardMat));
  const cardEdgeMat = keep(new THREE.LineBasicMaterial({ color: new THREE.Color(1.6, 1.0, 0.3), transparent: true }));
  const cardEdge = new THREE.LineSegments(keep(new THREE.EdgesGeometry(new THREE.PlaneGeometry(PW, PH))), cardEdgeMat);
  card.add(cardEdge);
  const NS = small() ? 260 : 480;
  const shardGeo = keep(new THREE.BufferGeometry());
  shardGeo.setAttribute('position', new THREE.Float32BufferAttribute([-0.5, -0.4, 0, 0.55, -0.3, 0, -0.05, 0.6, 0], 3));
  const shardMat = keep(
    new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.85, side: THREE.DoubleSide, depthWrite: false, blending: THREE.AdditiveBlending }),
  );
  const shards = new THREE.InstancedMesh(shardGeo, shardMat, NS);
  const shardData = Array.from({ length: NS }, () => {
    const x = (Math.random() - 0.5) * PW,
      y = (Math.random() - 0.5) * PH;
    return {
      x,
      y,
      vx: x * 0.9 + (Math.random() - 0.5) * 3,
      vy: y * 0.9 + (Math.random() - 0.5) * 3,
      vz: 1.5 + Math.random() * 6,
      rx: (Math.random() - 0.5) * 9,
      ry: (Math.random() - 0.5) * 9,
      s: 0.12 + Math.random() * 0.42,
    };
  });
  shardData.forEach((_, i) => {
    const c = [new THREE.Color('#a78bfa'), new THREE.Color('#22d3ee'), new THREE.Color('#fbbf24'), new THREE.Color('#ffffff')][i % 4];
    shards.setColorAt(i, c.multiplyScalar(0.55));
  });
  shards.frustumCulled = false;
  shards.position.z = BASE_Z + 0.05;
  scene.add(shards);
  // the finale's orbit of light
  const orbit = (() => {
    const n = small() ? 3000 : 6000,
      orb = new Float32Array(n * 3),
      col = new Float32Array(n * 3),
      pos = new Float32Array(n * 3);
    const pal = ['#8b5cf6', '#22d3ee', '#f59e0b', '#e879f9', '#34d399'].map((h) => new THREE.Color(h));
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2,
        r = 6.2 + (Math.random() - 0.5) * 2.6 * Math.random(),
        t = (Math.random() - 0.5) * 0.8 * Math.random();
      orb.set([a, r, t], i * 3);
      const c = pal[Math.floor((a / (Math.PI * 2)) * pal.length) % pal.length].clone().multiplyScalar(1.4);
      col.set([c.r, c.g, c.b], i * 3);
    }
    const geo = keep(new THREE.BufferGeometry());
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
    geo.setAttribute('aOrb', new THREE.BufferAttribute(orb, 3));
    const mat = keep(
      new THREE.ShaderMaterial({
        vertexShader: ORBIT_VERT,
        fragmentShader: POINT_FRAG,
        uniforms: {
          uPx: { value: 90 },
          uShow: { value: 0 },
          uTime: { value: 0 },
          uC: { value: new THREE.Vector3(0, 0, BASE_Z - 3) },
        },
        transparent: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
      }),
    );
    const pts = new THREE.Points(geo, mat);
    pts.frustumCulled = false;
    scene.add(pts);
    return { pts, mat };
  })();

  // ---------- input ----------
  let mx = 0,
    my = 0,
    tmx = 0,
    tmy = 0;
  const onMove = (e: PointerEvent) => {
    tmx = (e.clientX / innerWidth) * 2 - 1;
    tmy = (e.clientY / innerHeight) * 2 - 1;
  };
  addEventListener('pointermove', onMove, { passive: true });
  const resize = () => {
    const w = innerWidth,
      h = innerHeight;
    renderer.setSize(w, h, false);
    composer.setSize(w, h);
    bloom.setSize(w / 2, h / 2);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    lens.uniforms.uAspect.value = w / h;
    const px = Math.min(h, 1100) * renderer.getPixelRatio();
    fieldMat.uniforms.uPx.value = px * 0.06;
    stars.mat.uniforms.uPx.value = px * 0.12;
    orbit.mat.uniforms.uPx.value = px * 0.05;
  };
  resize();
  addEventListener('resize', resize);

  // ---------- frame loop ----------
  const target = () => {
    const r = o.track.getBoundingClientRect();
    const range = Math.max(1, r.height - innerHeight);
    return { p: clamp01(-r.top / range), after: Math.max(0, (-r.top - range) / innerHeight) };
  };
  let p = target().p,
    raf = 0,
    began = -1;
  const t0 = performance.now();
  const proj = new THREE.Vector3();
  const frame = () => {
    raf = requestAnimationFrame(frame);
    const now = performance.now(),
      time = o.still ? 0 : (now - t0) / 1000;
    const tg = target();
    const prev = p;
    p += (tg.p - p) * (o.still ? 1 : 0.075);
    if (Math.abs(tg.p - p) < 1e-5) p = tg.p;
    const vel = Math.min(1, Math.abs(p - prev) * 90);
    mx += (tmx - mx) * 0.05;
    my += (tmy - my) * 0.05;
    const aspect = innerWidth / innerHeight,
      wide = aspect > 1.15;

    // intro build, time based, after the loader lifts
    const bt = began < 0 ? 0 : o.still ? 99 : (now - began) / 1000;
    const gridK = clamp01(bt / 0.9);
    gridGeo.setDrawRange(0, Math.floor(gridK * gridCount));
    const fill = sstep(clamp01((bt - 0.55) / 0.8));
    gridMat.opacity = 0.55 * gridK * (1 - fill * 0.85);
    tubeGeo.setDrawRange(0, Math.floor(sstep(clamp01((bt - 0.9) / 1.6)) * tubeIdx / 3) * 3);
    bars.forEach((b, i) => {
      const k = easeOut3(clamp01((bt - 1.1 - i * 0.08) / 0.7));
      b.scale.y = Math.max(0.0001, b.userData.h * k);
      b.position.y = ty(900) + (b.userData.h * k) / 2;
    });

    // camera
    const z = camZ(p);
    const inTunnel = seg(p, 0.4, 0.6);
    const roll = sstep(inTunnel) * Math.PI * 0.55 * (1 - sstep(seg(p, 0.6, 0.68)));
    const par = p < 0.2 ? 0.35 : 0.12;
    camera.position.set(mx * par, -my * par * 0.7, z);
    camera.rotation.set(-my * 0.04, -mx * 0.05, p < 0.775 ? roll : 0);
    camZU.value = z;
    stars.pts.position.copy(camera.position);

    // panel: tilted beside the hero copy, then turns square to the camera and fills the screen
    const k = sstep(seg(p, 0.03, 0.17));
    const visW = 0.828 * 9 * aspect;
    const hx = wide ? 2.25 : 0,
      hy = wide ? 0.05 : -1.7,
      hs = wide ? 1 : Math.min(0.9, (visW * 0.86) / PW);
    panel.position.set(hx * (1 - k), hy * (1 - k), 0);
    panel.scale.setScalar(lerp(hs, 1, k));
    panel.rotation.set(0.14 * (1 - k) + my * 0.05 * (1 - k), (wide ? -0.38 : -0.12) * (1 - k) + mx * 0.08 * (1 - k), 0.02 * (1 - k));
    const pFade = 1 - seg(p, 0.185, 0.205);
    dashMat.opacity = fill * pFade;
    edgeMat.opacity = Math.min(1, gridK * 1.4) * 0.8 * pFade;
    tubeMat.opacity = pFade;
    panel.visible = p < 0.21;

    // field
    field.visible = p > 0.08 && p < 0.775;
    fieldMat.uniforms.uTime.value = time;
    fieldMat.uniforms.uShow.value = seg(p, 0.12, 0.2);
    fieldMat.uniforms.uQuiet.value = sstep(seg(p, 0.27, 0.37));
    fieldMat.uniforms.uMorph.value = seg(p, 0.585, 0.725);
    // the number has to fit a phone too: shrink the field sideways around the axis as it gathers
    const fit = Math.min(1, (0.828 * 13 * aspect * 0.88) / 11.5);
    const fs = lerp(1, fit, sstep(seg(p, 0.56, 0.62)));
    field.scale.set(fs, fs, 1);

    // tunnel
    const tv = p > 0.3 && p < 0.775;
    boxes.visible = frames.visible = streaks.visible = tv;
    streakMat.opacity = 0.25 + vel * 1.4;
    frameMat.opacity = 0.18 * (1 - seg(p, 0.6, 0.66));
    boxMat.opacity = 0.92 * (1 - seg(p, 0.62, 0.7));

    // break-out
    const outV = p > 0.76;
    card.visible = shards.visible = orbit.pts.visible = outV;
    const burst = easeOut3(seg(p, 0.83, 0.93));
    cardMat.opacity = 1 - seg(p, 0.828, 0.85);
    cardEdgeMat.opacity = cardMat.opacity;
    card.rotation.set(-my * 0.06, mx * 0.08, 0);
    if (outV) {
      shardData.forEach((s, i) => {
        const f = burst * 2;
        v3.set(s.x + s.vx * f, s.y + s.vy * f, s.vz * f);
        e.set(s.rx * burst, s.ry * burst, s.rx * 0.3 * burst + i);
        q.setFromEuler(e);
        const sc = burst > 0 ? s.s : 0.0001;
        s3.set(sc, sc, sc);
        m4.compose(v3, q, s3);
        shards.setMatrixAt(i, m4);
      });
      shards.instanceMatrix.needsUpdate = true;
      shardMat.opacity = 0.85 * (1 - seg(p, 0.95, 1)) + 0.15;
    }
    orbit.mat.uniforms.uShow.value = seg(p, 0.84, 0.92);
    orbit.mat.uniforms.uTime.value = time;
    stars.mat.uniforms.uTime.value = time;

    // grading
    const ringIn = seg(p, 0.2, 0.27) * (1 - seg(p, 0.66, 0.74));
    lens.uniforms.uRing.value = ringIn;
    lens.uniforms.uRingR.value = 0.42 + Math.sin(time * 0.4) * 0.01 + inTunnel * 0.03;
    lens.uniforms.uTime.value = time;
    lens.uniforms.uCA.value = 0.0012 + vel * 0.012 + seg(p, 0.17, 0.2) * 0.004 * (1 - seg(p, 0.2, 0.24));
    const flashIn = seg(p, 0.752, 0.775),
      flashOut = 1 - seg(p, 0.775, 0.795);
    lens.uniforms.uFlash.value = Math.min(flashIn, flashOut) + 0.35 * Math.max(0, 1 - Math.abs(p - 0.2) / 0.02);
    bloom.strength = lerp(0.7, 1.3, seg(p, 0.1, 0.2)) * (1 - seg(p, 0.2, 0.26) * 0.3) + inTunnel * 0.15;
    scene.fog!.color.setHex(0x04040a);
    (scene.fog as THREE.FogExp2).density = p > 0.775 ? 0.006 : 0.012;

    composer.render();

    const labels = o.labels.map(([x, y, lz]) => {
      proj.set(x, y, lz).project(camera);
      return { x: (proj.x * 0.5 + 0.5) * innerWidth, y: (-proj.y * 0.5 + 0.5) * innerHeight, d: lz - z };
    });
    o.onFrame({ p, after: tg.after, vel, labels });
  };
  raf = requestAnimationFrame(frame);

  return {
    begin() {
      if (began < 0) began = performance.now();
    },
    destroy() {
      cancelAnimationFrame(raf);
      removeEventListener('pointermove', onMove);
      removeEventListener('resize', resize);
      disposables.forEach((d) => d.dispose());
      boxes.dispose();
      shards.dispose();
      composer.dispose();
      renderer.dispose();
    },
  };
}
