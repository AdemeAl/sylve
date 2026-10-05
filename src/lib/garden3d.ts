"use client";
import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { SPECIES, TILES, Tile, Session } from "./catalog";
import { hashStr } from "./utils";

// ---------- Modèles ----------
let libPromise: Promise<Record<string, THREE.Object3D>> | null = null;
export function loadLibrary() {
  if (!libPromise) {
    libPromise = new Promise((ok, ko) => {
      new GLTFLoader().load(
        "/garden.glb",
        (gl) => {
          const lib: Record<string, THREE.Object3D> = {};
          gl.scene.children.slice().forEach((n) => (lib[n.name] = n));
          ok(lib);
        },
        undefined,
        ko
      );
    });
  }
  return libPromise;
}

const TINTED: Record<string, THREE.Material> = {};
function tinted(base: THREE.Material, tint: [number, number, number]) {
  const key = tint.join(",");
  if (TINTED[key]) return TINTED[key];
  const m = base.clone();
  m.onBeforeCompile = (sh) => {
    sh.uniforms.uTint = { value: new THREE.Vector3(...tint) };
    sh.fragmentShader =
      "uniform vec3 uTint;\n" +
      sh.fragmentShader.replace(
        "#include <map_fragment>",
        `#ifdef USE_MAP
          vec4 sampledDiffuseColor = texture2D( map, vMapUv );
          float gDom = sampledDiffuseColor.g - max(sampledDiffuseColor.r, sampledDiffuseColor.b);
          if (gDom > 0.02) {
            float l = dot(sampledDiffuseColor.rgb, vec3(.3,.59,.11));
            sampledDiffuseColor.rgb = mix(sampledDiffuseColor.rgb, uTint * l * 3.0, clamp(gDom*9.0, 0.0, 1.0));
          }
          diffuseColor *= sampledDiffuseColor;
        #endif`
      );
  };
  m.customProgramCacheKey = () => "tint" + key;
  return (TINTED[key] = m);
}

function model(lib: Record<string, THREE.Object3D>, name: string) {
  const src = lib[name];
  if (!src) return new THREE.Group();
  const m = src.clone(true);
  m.traverse((o: any) => {
    if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; }
  });
  return m;
}

export function buildTree(lib: Record<string, THREE.Object3D>, sp: string, dead: boolean, s = 1) {
  const S0 = SPECIES[sp] || SPECIES.chene;
  let m: THREE.Object3D;
  if (dead) m = model(lib, S0.model === "tree_single_B" ? "tree_single_B_cut" : "tree_single_A_cut");
  else {
    m = model(lib, S0.model);
    if (S0.tint) m.traverse((o: any) => { if (o.isMesh) o.material = tinted(o.material, S0.tint!); });
  }
  const g = new THREE.Group();
  g.add(m);
  g.scale.setScalar(s * (S0.scale || 1) * (dead ? 1.3 : 1));
  return g;
}

export function buildTile(lib: Record<string, THREE.Object3D>, type: string) {
  const T = TILES[type];
  const g = new THREE.Group();
  const base = model(lib, T.base);
  base.traverse((o: any) => { if (o.isMesh) o.castShadow = false; });
  g.add(base);
  T.deco.forEach(([m, x, z, ry, s]) => {
    const o = model(lib, m);
    o.position.set(x, 0, z);
    o.rotation.y = ry;
    o.scale.setScalar(s);
    g.add(o);
  });
  return g;
}

export function addLights(sc: THREE.Scene, shadow: boolean) {
  sc.add(new THREE.HemisphereLight(0xc8dcff, 0x3a3450, 2.0));
  const key = new THREE.DirectionalLight(0xfff0d8, 3.9);
  key.position.set(5, 10, 4);
  if (shadow) {
    key.castShadow = true;
    key.shadow.mapSize.set(2048, 2048);
    const c = key.shadow.camera as THREE.OrthographicCamera;
    c.left = -10; c.right = 10; c.top = 10; c.bottom = -10; c.near = 1; c.far = 40;
    key.shadow.bias = -0.0006;
    key.shadow.normalBias = 0.02;
  }
  sc.add(key);
  const rim = new THREE.DirectionalLight(0x8fb4ff, 1.4);
  rim.position.set(-6, 5, -7);
  sc.add(rim);
}

export const hexPos = (q: number, r: number): [number, number] => [2 * q + r, 1.7320508 * r];
function rot2(x: number, z: number, rot: number): [number, number] {
  const a = (-rot * Math.PI) / 3;
  return [x * Math.cos(a) - z * Math.sin(a), x * Math.sin(a) + z * Math.cos(a)];
}

export function gardenSlots(tiles: Tile[]) {
  const sorted = tiles.slice().sort((a, b) => (a.k < b.k ? -1 : 1));
  const slots: { x: number; z: number }[] = [];
  sorted.forEach((t) => {
    const [cx, cz] = hexPos(t.q, t.r);
    TILES[t.type].slots.forEach(([x, z]) => {
      const [rx, rz] = rot2(x, z, t.rot);
      slots.push({ x: cx + rx, z: cz + rz });
    });
  });
  return { tiles: sorted, slots };
}

// ---------- Scène du jardin ----------
export type GardenView = {
  tiles: Tile[];
  sessions: Session[];
  active?: { sp: string; progress: () => number } | null;
  editing?: boolean;
  selInv?: string | null;
  selTile?: string | null;
};

export class GardenScene {
  renderer: THREE.WebGLRenderer;
  scene = new THREE.Scene();
  camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.1, 80);
  root = new THREE.Group();
  lib: Record<string, THREE.Object3D> | null = null;
  view: GardenView = { tiles: [], sessions: [] };
  theta = Math.PI / 5;
  phi = 0.66;
  zoom = 1;
  extent = 3;
  dirty = true;
  resized = true;
  drag = false;
  pickables: THREE.Object3D[] = [];
  preview: THREE.Object3D | null = null;
  previewBase = 1;
  clouds: THREE.Object3D[] = [];
  raf = 0;
  last = 0;
  disposed = false;
  ro: ResizeObserver;
  onPick?: (p: { tileK?: string; ghost?: [number, number] }) => void;
  onReady?: () => void;

  constructor(public canvas: HTMLCanvasElement, public container: HTMLElement, opts: { clouds?: boolean } = {}) {
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
    this.renderer.setPixelRatio(Math.min(2, window.devicePixelRatio || 1));
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    addLights(this.scene, true);
    this.scene.add(this.root);
    this.ro = new ResizeObserver(() => (this.resized = true));
    this.ro.observe(container);
    this.bindPointer();
    loadLibrary().then((lib) => {
      if (this.disposed) return;
      this.lib = lib;
      if (opts.clouds !== false) {
        for (let i = 0; i < 3; i++) {
          const c = model(lib, i % 2 ? "cloud_small" : "cloud_big");
          c.traverse((o: any) => { if (o.isMesh) o.castShadow = false; });
          c.scale.setScalar(0.4 + 0.12 * i);
          c.userData = { a: i * 2.1, rad: 4.4 + i * 0.9, y: 3.4 + i * 0.5, sp: 0.035 + 0.012 * i };
          this.scene.add(c);
          this.clouds.push(c);
        }
      }
      this.dirty = true;
      this.onReady?.();
    });
    this.loop = this.loop.bind(this);
    this.raf = requestAnimationFrame(this.loop);
  }

  setView(v: GardenView) {
    this.view = v;
    this.dirty = true;
  }

  rebuild() {
    if (!this.lib) return;
    const lib = this.lib;
    this.dirty = false;
    while (this.root.children.length) this.root.remove(this.root.children[0]);
    this.pickables = [];
    this.preview = null;
    const v = this.view;
    const { tiles, slots } = gardenSlots(v.tiles);
    const pts = tiles.map((t) => hexPos(t.q, t.r));
    let ghosts: [number, number][] = [];
    if (v.editing && v.selInv) {
      const occ = new Set(tiles.map((t) => t.q + "," + t.r));
      const cand = new Set<string>();
      tiles.forEach((t) =>
        [[1, 0], [-1, 0], [0, 1], [0, -1], [1, -1], [-1, 1]].forEach(([dq, dr]) => {
          const k = t.q + dq + "," + (t.r + dr);
          if (!occ.has(k)) cand.add(k);
        })
      );
      ghosts = [...cand].map((k) => k.split(",").map(Number) as [number, number]);
      ghosts.forEach(([q, r]) => pts.push(hexPos(q, r)));
    }
    if (!pts.length) pts.push([0, 0]);
    const xs = pts.map((p) => p[0]), zs = pts.map((p) => p[1]);
    const cx = (Math.min(...xs) + Math.max(...xs)) / 2, cz = (Math.min(...zs) + Math.max(...zs)) / 2;
    this.extent = Math.max(...pts.map(([x, z]) => Math.hypot(x - cx, z - cz))) + 1.3;
    this.root.position.set(-cx, 0, -cz);

    tiles.forEach((t) => {
      const g = buildTile(lib, t.type);
      const [x, z] = hexPos(t.q, t.r);
      g.position.set(x, 0, z);
      g.rotation.y = (-t.rot * Math.PI) / 3;
      g.traverse((o: any) => { if (o.isMesh) { o.userData.tileK = t.k; this.pickables.push(o); } });
      if (v.editing && v.selTile === t.k) {
        const ring = new THREE.Mesh(new THREE.CylinderGeometry(1.17, 1.17, 0.05, 6, 1, true), new THREE.MeshBasicMaterial({ color: 0x86f2b6, side: THREE.DoubleSide }));
        ring.position.y = 0.02;
        g.add(ring);
      }
      this.root.add(g);
    });
    v.sessions.forEach((s, i) => {
      const sl = slots[i];
      if (!sl) return;
      const tr = buildTree(lib, s.sp, !s.ok, 1);
      tr.position.set(sl.x, 0, sl.z);
      tr.rotation.y = (hashStr(String(s.t)) % 628) / 100;
      this.root.add(tr);
    });
    if (v.active) {
      const sl = slots[v.sessions.length];
      if (sl) {
        const tr = buildTree(lib, v.active.sp, false, 1);
        tr.position.set(sl.x, 0, sl.z);
        this.root.add(tr);
        this.preview = tr;
        this.previewBase = tr.scale.x;
      }
    }
    ghosts.forEach(([q, r]) => {
      const [x, z] = hexPos(q, r);
      const gh = new THREE.Mesh(new THREE.CylinderGeometry(1.08, 1.08, 0.08, 6), new THREE.MeshBasicMaterial({ color: 0x86f2b6, transparent: true, opacity: 0.25 }));
      gh.position.set(x, -0.45, z);
      gh.userData.ghost = [q, r];
      this.root.add(gh);
      this.pickables.push(gh);
      const ring = new THREE.Mesh(new THREE.CylinderGeometry(1.08, 1.08, 0.1, 6, 1, true), new THREE.MeshBasicMaterial({ color: 0x86f2b6, transparent: true, opacity: 0.85, side: THREE.DoubleSide }));
      ring.position.set(x, -0.45, z);
      this.root.add(ring);
    });
    this.resized = true;
  }

  updateCamera() {
    const w = this.container.clientWidth, h = this.container.clientHeight;
    if (!w || !h) return;
    this.renderer.setSize(w, h, false);
    const asp = w / h, ext = this.extent;
    const halfH = Math.max(ext * 0.62, (ext * 0.98) / asp) / this.zoom;
    Object.assign(this.camera, { left: -halfH * asp, right: halfH * asp, top: halfH, bottom: -halfH });
    this.camera.updateProjectionMatrix();
  }

  loop(t = 0) {
    if (this.disposed) return;
    this.raf = requestAnimationFrame(this.loop);
    const dt = Math.min(0.05, (t - this.last) / 1000);
    this.last = t;
    if (this.dirty) this.rebuild();
    if (this.resized) { this.updateCamera(); this.resized = false; }
    if (!this.drag && !this.view.editing) this.theta += dt * 0.02;
    const R = 20;
    this.camera.position.set(Math.sin(this.theta) * Math.cos(this.phi) * R, Math.sin(this.phi) * R, Math.cos(this.theta) * Math.cos(this.phi) * R);
    this.camera.lookAt(0, 0.25, 0);
    this.clouds.forEach((c) => {
      const u = c.userData;
      u.a += dt * u.sp;
      c.position.set(Math.cos(u.a) * u.rad, u.y + Math.sin(u.a * 2) * 0.1, Math.sin(u.a) * u.rad);
    });
    if (this.preview && this.view.active) this.preview.scale.setScalar(this.previewBase * (0.2 + 0.8 * Math.min(1, this.view.active.progress())));
    this.renderer.render(this.scene, this.camera);
  }

  bindPointer() {
    const cv = this.canvas;
    const pts = new Map<number, { x: number; y: number }>();
    let moved = 0, lastDist = 0;
    cv.addEventListener("pointerdown", (e) => {
      cv.setPointerCapture(e.pointerId);
      pts.set(e.pointerId, { x: e.clientX, y: e.clientY });
      moved = 0;
      this.drag = true;
      if (pts.size === 2) { const [a, b] = [...pts.values()]; lastDist = Math.hypot(a.x - b.x, a.y - b.y); }
    });
    cv.addEventListener("pointermove", (e) => {
      const p = pts.get(e.pointerId);
      if (!p) return;
      const dx = e.clientX - p.x, dy = e.clientY - p.y;
      p.x = e.clientX; p.y = e.clientY;
      moved += Math.abs(dx) + Math.abs(dy);
      if (pts.size === 1) { this.theta -= dx * 0.008; this.phi = Math.min(1.25, Math.max(0.32, this.phi + dy * 0.004)); }
      else if (pts.size === 2) {
        const [a, b] = [...pts.values()];
        const d = Math.hypot(a.x - b.x, a.y - b.y);
        if (lastDist) { this.zoom = Math.min(3, Math.max(0.6, (this.zoom * d) / lastDist)); this.resized = true; }
        lastDist = d;
      }
    });
    const up = (e: PointerEvent) => {
      if (pts.size === 1 && moved < 8) this.pick(e);
      pts.delete(e.pointerId);
      lastDist = 0;
      if (!pts.size) this.drag = false;
    };
    cv.addEventListener("pointerup", up);
    cv.addEventListener("pointercancel", (e) => { pts.delete(e.pointerId); if (!pts.size) this.drag = false; });
    cv.addEventListener("wheel", (e) => {
      e.preventDefault();
      this.zoom = Math.min(3, Math.max(0.6, this.zoom * (e.deltaY < 0 ? 1.1 : 0.9)));
      this.resized = true;
    }, { passive: false });
  }

  pick(e: PointerEvent) {
    if (!this.view.editing || !this.onPick) return;
    const r = this.canvas.getBoundingClientRect();
    const v = new THREE.Vector2(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
    const ray = new THREE.Raycaster();
    ray.setFromCamera(v, this.camera);
    const hit = ray.intersectObjects(this.pickables, false)[0];
    if (!hit) return;
    const u = hit.object.userData;
    if (u.ghost) this.onPick({ ghost: u.ghost });
    else if (u.tileK) this.onPick({ tileK: u.tileK });
  }

  dispose() {
    this.disposed = true;
    cancelAnimationFrame(this.raf);
    this.ro.disconnect();
    this.renderer.dispose();
  }
}

// ---------- Vignettes (boutique) ----------
const THUMB: Record<string, string> = {};
let tR: THREE.WebGLRenderer | null = null, tS: THREE.Scene, tC: THREE.OrthographicCamera;
export function thumb(lib: Record<string, THREE.Object3D> | null, kind: "tile" | "tree", key: string) {
  const id = kind + ":" + key;
  if (THUMB[id]) return THUMB[id];
  if (!lib) return "";
  try {
    if (!tR) {
      tR = new THREE.WebGLRenderer({ antialias: true, alpha: true, preserveDrawingBuffer: true });
      tR.setPixelRatio(2);
      tR.setSize(220, 190);
      tS = new THREE.Scene();
      addLights(tS, false);
      tC = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.1, 60);
    }
    while (tS.children.length > 3) tS.remove(tS.children[3]);
    let obj: THREE.Object3D, h: number, ly: number;
    if (kind === "tile") {
      obj = buildTile(lib, key);
      const tall = TILES[key].deco.some((d) => /mountain|windmill|watermill/.test(d[0]));
      h = tall ? 1.55 : 1.3;
      ly = tall ? 0.35 : -0.05;
    } else {
      obj = buildTree(lib, key, false, 1);
      h = 0.72;
      ly = 0.5;
    }
    tS.add(obj);
    const a = 220 / 190;
    Object.assign(tC, { left: -h * a, right: h * a, top: h, bottom: -h });
    tC.updateProjectionMatrix();
    tC.position.set(9, 8.5, 11);
    tC.lookAt(0, ly, 0);
    tR.render(tS, tC);
    THUMB[id] = tR.domElement.toDataURL();
  } catch {
    THUMB[id] = "";
  }
  return THUMB[id];
}
