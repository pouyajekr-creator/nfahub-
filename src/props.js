// Procedural café props that the asset packs do not include: espresso machine,
// grinder, kettle, toaster, cups, bacon, toast… built from simple primitives in
// the same chunky low-poly style as the KayKit models.
import * as THREE from 'three';
import { model } from './assets.js';

const mat = (color, opts = {}) => new THREE.MeshStandardMaterial({ color, roughness: 0.7, ...opts });
const M = {
  steel: mat(0xc9ced6, { metalness: 0.85, roughness: 0.28 }),
  dark: mat(0x2b2d33, { roughness: 0.5 }),
  black: mat(0x17181b, { roughness: 0.6 }),
  red: mat(0xc0392b, { roughness: 0.35, metalness: 0.2 }),
  cream: mat(0xf6efe2),
  white: mat(0xffffff, { roughness: 0.4 }),
  wood: mat(0x9a6a43),
  coffee: mat(0x3b2416, { roughness: 0.35 }),
  bean: mat(0x4a2c1a),
  glass: mat(0xcfe9f5, { transparent: true, opacity: 0.35, roughness: 0.1 }),
  amber: mat(0xe8b25c, { transparent: true, opacity: 0.45, roughness: 0.15 }),
  green: new THREE.MeshStandardMaterial({ color: 0x55ff88, emissive: 0x22ff66, emissiveIntensity: 1.5 }),
  ice: mat(0xe6f6ff, { transparent: true, opacity: 0.75, roughness: 0.1 }),
};

function mesh(geo, material, x = 0, y = 0, z = 0) {
  const m = new THREE.Mesh(geo, material);
  m.position.set(x, y, z);
  m.castShadow = true;
  m.receiveShadow = true;
  return m;
}
const box = (w, h, d, material, x, y, z) => mesh(new THREE.BoxGeometry(w, h, d), material, x, y, z);
const cyl = (rt, rb, h, material, x, y, z, seg = 16) => mesh(new THREE.CylinderGeometry(rt, rb, h, seg), material, x, y, z);

function group(...children) {
  const g = new THREE.Group();
  g.add(...children);
  return g;
}

// ---------------------------------------------------------------- appliances

export function grinder() {
  const g = group(
    box(0.5, 0.16, 0.62, M.dark, 0, 0.08, 0.04),
    box(0.42, 0.74, 0.4, M.red, 0, 0.53, -0.07),
    cyl(0.2, 0.2, 0.05, M.steel, 0, 0.92, -0.07),
    cyl(0.26, 0.12, 0.38, M.amber, 0, 1.13, -0.07),
    cyl(0.22, 0.11, 0.24, M.bean, 0, 1.07, -0.07),
    cyl(0.27, 0.27, 0.04, M.dark, 0, 1.34, -0.07),
    box(0.14, 0.12, 0.16, M.steel, 0, 0.52, 0.2),
    cyl(0.035, 0.035, 0.03, M.green, 0.13, 0.74, 0.135),
  );
  g.children.at(-1).rotation.x = Math.PI / 2;
  return g;
}

export function espressoMachine() {
  const g = new THREE.Group();
  g.add(
    box(1.5, 0.1, 0.78, M.dark, 0, 0.05, 0.02),
    box(1.5, 0.5, 0.42, M.red, 0, 0.35, -0.16),
    box(1.5, 0.34, 0.74, M.red, 0, 0.77, 0),
    box(1.54, 0.05, 0.78, M.steel, 0, 0.965, 0),
    box(1.3, 0.03, 0.3, M.steel, 0, 0.115, 0.22),
    box(1.2, 0.2, 0.02, M.steel, 0, 0.76, 0.375),
  );
  // Cup rail on top with a few spare cups.
  g.add(box(1.4, 0.08, 0.03, M.steel, 0, 1.03, 0.36), box(1.4, 0.08, 0.03, M.steel, 0, 1.03, -0.36));
  for (const [x, z] of [[-0.5, -0.1], [-0.22, 0.1], [0.1, -0.12], [0.42, 0.08]]) {
    const c = cupModel({});
    c.scale.setScalar(0.8);
    c.rotation.x = Math.PI;
    c.position.set(x, 1.19, z);
    g.add(c);
  }
  // Two group heads, pressure gauge and buttons.
  for (const x of [-0.38, 0.38]) g.add(cyl(0.13, 0.11, 0.1, M.steel, x, 0.55, 0.2));
  const gauge = cyl(0.09, 0.09, 0.03, M.white, 0, 0.77, 0.39);
  gauge.rotation.x = Math.PI / 2;
  g.add(gauge);
  const lights = [];
  for (const x of [-0.5, -0.38, -0.26, 0.26, 0.38, 0.5]) {
    const b = cyl(0.03, 0.03, 0.03, M.dark.clone(), x, 0.8, 0.39);
    b.rotation.x = Math.PI / 2;
    lights.push(b);
    g.add(b);
  }
  // Steam wand on the right side.
  const wand = cyl(0.018, 0.018, 0.42, M.steel, 0.68, 0.42, 0.3);
  wand.rotation.z = 0.25;
  g.add(wand);

  // Parts that only show while a shot is being pulled.
  const brew = new THREE.Group();
  const pf = portafilter();
  pf.position.set(-0.38, 0.47, 0.2);
  const stream = cyl(0.012, 0.012, 0.2, M.coffee, -0.38, 0.33, 0.2, 6);
  brew.add(pf, stream);
  brew.visible = false;
  const cup = cupModel({});
  cup.position.set(-0.38, 0.13, 0.2);
  cup.visible = false;
  g.add(brew, cup);
  g.userData = { brew, stream, cup, lights };
  return g;
}

export function portafilter() {
  const handle = cyl(0.035, 0.045, 0.34, M.black, 0, 0, 0.3);
  handle.rotation.x = Math.PI / 2;
  return group(cyl(0.11, 0.09, 0.08, M.steel, 0, 0, 0), cyl(0.095, 0.095, 0.02, M.bean, 0, 0.04, 0), handle);
}

export function kettle() {
  const spout = cyl(0.02, 0.035, 0.34, M.steel, 0.22, 0.3, 0);
  spout.rotation.z = -0.7;
  const handle = mesh(new THREE.TorusGeometry(0.14, 0.022, 8, 16, Math.PI), M.black, -0.2, 0.3, 0);
  handle.rotation.z = Math.PI / 2;
  return group(
    cyl(0.24, 0.24, 0.06, M.dark, 0, 0.03, 0),
    cyl(0.14, 0.21, 0.38, M.steel, 0, 0.25, 0),
    cyl(0.1, 0.14, 0.04, M.steel, 0, 0.46, 0),
    mesh(new THREE.SphereGeometry(0.035, 8, 8), M.black, 0, 0.5, 0),
    spout, handle,
  );
}

export function milkStation() {
  const handle = mesh(new THREE.TorusGeometry(0.09, 0.02, 8, 12, Math.PI), M.steel, -0.17, 0.2, 0);
  handle.rotation.z = Math.PI / 2;
  const carton = group(box(0.2, 0.36, 0.2, M.white, 0, 0.18, 0), box(0.2, 0.1, 0.02, mat(0x4a90d9), 0, 0.2, 0.101));
  const roof = mesh(new THREE.CylinderGeometry(0.02, 0.142, 0.1, 4), M.white, 0, 0.41, 0);
  roof.rotation.y = Math.PI / 4;
  carton.add(roof);
  carton.position.set(0.25, 0, -0.12);
  return group(
    cyl(0.13, 0.16, 0.36, M.steel, 0, 0.18, 0),
    cyl(0.12, 0.12, 0.02, M.white, 0, 0.33, 0),
    handle, carton,
  );
}

export function chocoBottle() {
  return group(
    cyl(0.1, 0.11, 0.36, mat(0x5a3220, { roughness: 0.4 }), 0, 0.18, 0),
    cyl(0.1, 0.1, 0.12, M.cream, 0, 0.16, 0, 16),
    cyl(0.05, 0.1, 0.08, mat(0x5a3220), 0, 0.4, 0),
    cyl(0.015, 0.035, 0.12, M.red, 0, 0.5, 0),
  );
}

export function toaster() {
  const g = new THREE.Group();
  g.add(
    box(0.72, 0.42, 0.44, M.cream, 0, 0.25, 0),
    box(0.76, 0.05, 0.48, M.steel, 0, 0.025, 0),
    box(0.56, 0.02, 0.07, M.black, 0, 0.465, -0.09),
    box(0.56, 0.02, 0.07, M.black, 0, 0.465, 0.09),
    cyl(0.04, 0.04, 0.03, M.red, 0.2, 0.14, 0.23),
  );
  g.children.at(-1).rotation.x = Math.PI / 2;
  const lever = box(0.04, 0.06, 0.1, M.black, 0.39, 0.36, 0);
  const slices = group(breadSlice('bread'), breadSlice('bread'));
  slices.children[0].position.set(0, 0, -0.09);
  slices.children[1].position.set(0, 0, 0.09);
  slices.children.forEach((s) => { s.rotation.x = Math.PI / 2; s.scale.setScalar(0.85); });
  slices.visible = false;
  g.add(lever, slices);
  g.userData = { lever, slices };
  return g;
}

export function breadLoaf() {
  const g = group(box(0.9, 0.05, 0.5, M.wood, 0, 0.025, 0));
  const loaf = mesh(new THREE.CapsuleGeometry(0.17, 0.3, 4, 10), mat(0xc98b4b), -0.12, 0.2, 0);
  loaf.rotation.z = Math.PI / 2;
  loaf.scale.set(1, 1, 1.15);
  g.add(loaf);
  for (let i = 0; i < 3; i++) {
    const s = breadSlice('bread');
    s.rotation.set(Math.PI / 2, 0, 0.25);
    s.rotation.order = 'YXZ';
    s.rotation.y = Math.PI / 2;
    s.position.set(0.22 + i * 0.07, 0.2, 0);
    s.scale.setScalar(0.8);
    g.add(s);
  }
  return g;
}

export function trashBin() {
  return group(
    cyl(0.36, 0.3, 0.9, M.dark, 0, 0.45, 0, 14),
    cyl(0.39, 0.39, 0.06, M.steel, 0, 0.93, 0, 14),
    cyl(0.3, 0.3, 0.02, M.black, 0, 0.965, 0, 14),
  );
}

export function pendantLamp() {
  const shade = cyl(0.12, 0.42, 0.34, mat(0x2f3a34, { side: THREE.DoubleSide }), 0, 0, 0, 16);
  const bulb = mesh(new THREE.SphereGeometry(0.11, 12, 10),
    new THREE.MeshStandardMaterial({ color: 0xfff1cc, emissive: 0xffc977, emissiveIntensity: 2.2 }), 0, -0.12, 0);
  bulb.castShadow = false;
  const cord = cyl(0.012, 0.012, 3, M.black, 0, 1.67, 0, 5);
  cord.castShadow = false;
  shade.castShadow = false;
  return group(shade, bulb, cord);
}

// --------------------------------------------------------------------- items

const SLICE_COLORS = { bread: [0xf3dfb4, 0xc98b4b], toast: [0xd9a15a, 0x8a5426], burnt: [0x2a211c, 0x17110e] };

export function breadSlice(kind) {
  const [inner, crust] = SLICE_COLORS[kind];
  const shape = new THREE.Shape();
  shape.moveTo(-0.2, -0.2);
  shape.lineTo(0.2, -0.2);
  shape.lineTo(0.2, 0.08);
  shape.absarc(0.1, 0.1, 0.12, 0, Math.PI / 2, false);
  shape.absarc(-0.1, 0.1, 0.12, Math.PI / 2, Math.PI, false);
  shape.lineTo(-0.2, -0.2);
  const geo = new THREE.ExtrudeGeometry(shape, { depth: 0.07, bevelEnabled: false, curveSegments: 6 });
  geo.translate(0, 0, -0.035);
  // Material 0 is the two faces, material 1 the crust around the edge.
  const m = mesh(geo, [mat(inner, { roughness: 0.95 }), mat(crust, { roughness: 0.9 })]);
  m.rotation.x = -Math.PI / 2;
  return group(m);
}

const BACON = { raw: [0xe58a86, 0xf6d7cf], cooked: [0x9c3b24, 0xe2a56b], burnt: [0x241a16, 0x3a2a22] };

export function baconStrips(state, count = 2) {
  const [meat, fat] = BACON[state];
  const g = new THREE.Group();
  for (let i = 0; i < count; i++) {
    const strip = new THREE.Group();
    for (let s = 0; s < 6; s++) {
      const seg = box(0.085, 0.022, 0.13, mat(s % 2 ? fat : meat, { roughness: 0.6 }), -0.2 + s * 0.08, Math.sin(s * 1.6 + i) * 0.014, 0);
      seg.rotation.z = Math.cos(s * 1.6 + i) * 0.28;
      strip.add(seg);
    }
    strip.position.set(0, 0.02, (i - (count - 1) / 2) * 0.17);
    strip.rotation.y = (i % 2 ? -1 : 1) * 0.12;
    g.add(strip);
  }
  return g;
}

export function patty(state) {
  const name = { raw: 'food_ingredient_burger_uncooked', cooked: 'food_ingredient_burger_cooked', burnt: 'food_ingredient_burger_trash' }[state];
  const p = model(name);
  p.scale.setScalar(0.62);
  return p;
}

export function cupModel(cup) {
  const g = new THREE.Group();
  const iced = !!cup.ice;
  const h = iced ? 0.3 : 0.2;
  const rTop = iced ? 0.11 : 0.12;
  const rBot = iced ? 0.085 : 0.085;
  const wall = cyl(rTop, rBot, h, iced ? M.glass : M.white, 0, h / 2, 0, 14);
  if (iced) wall.castShadow = false;
  g.add(wall);
  if (!iced) {
    const handle = mesh(new THREE.TorusGeometry(0.06, 0.018, 6, 12, Math.PI), M.white, 0.12, 0.1, 0);
    handle.rotation.z = -Math.PI / 2;
    g.add(handle, cyl(0.15, 0.12, 0.02, M.white, 0, 0.01, 0));
  }
  // Liquid colour tells the drinks apart at a glance.
  let color = 0x2a160c;
  if (cup.water) color = 0x41261a;
  if (cup.milk === 1) color = 0xc79a6b;
  if (cup.milk >= 2) color = 0xf4e6cf;
  if (cup.choco) color = cup.milk ? 0x7b4a2d : 0x3a1f12;
  const fill = cup.empty ? 0 : iced ? 0.85 : 0.9;
  if (fill) {
    const liquid = cyl(rTop * 0.93, rBot * 0.95, h * fill, mat(color, { roughness: 0.3 }), 0, h * fill / 2 + 0.005, 0, 14);
    liquid.castShadow = false;
    liquid.scale.y = 1.001;
    g.add(liquid);
    const top = h * fill + 0.012;
    if (cup.milk >= 2) for (const [x, z] of [[0.03, 0.02], [-0.04, 0.03], [0, -0.04]]) g.add(cyl(0.02, 0.02, 0.006, mat(0x7b4a2d), x, top, z, 8));
    if (cup.choco) g.add(box(0.14, 0.006, 0.02, mat(0x2a140b), 0, top, 0.02), box(0.02, 0.006, 0.14, mat(0x2a140b), -0.02, top, 0));
    if (iced) for (const [x, z, r] of [[0.03, 0.03, 0.4], [-0.04, 0, 1.1], [0.01, -0.04, 0.8]]) {
      const cube = box(0.06, 0.06, 0.06, M.ice, x, top, z);
      cube.rotation.set(r, r * 2, 0);
      cube.castShadow = false;
      g.add(cube);
    }
  }
  return g;
}

/** Plate with whatever food parts are stacked on it. */
export function foodModel(parts) {
  const g = new THREE.Group();
  const plate = model('plate_small');
  plate.scale.setScalar(0.72);
  g.add(plate);
  let y = 0.05;
  const put = (obj, height) => { obj.position.y = y; g.add(obj); y += height; };
  const has = (p) => parts.includes(p);
  if (has('bun')) {
    const bottom = model('food_ingredient_bun_bottom');
    bottom.scale.setScalar(0.62);
    put(bottom, 0.1);
  }
  if (has('toast')) put(breadSlice('toast'), 0.075);
  if (has('patty')) put(patty('cooked'), 0.115);
  if (has('cheese')) {
    const c = model('food_ingredient_cheese_slice');
    c.scale.setScalar(0.55);
    c.position.y = 0.055;
    const wrap = group(c);
    wrap.rotation.y = Math.PI / 4;
    put(wrap, 0.03);
  }
  if (has('bacon')) put(baconStrips('cooked'), 0.05);
  if (has('bun')) {
    const top = model('food_ingredient_bun_top');
    top.scale.setScalar(0.62);
    top.position.y = y - 0.14;
    g.add(top);
  }
  return g;
}

/** 3D model for anything the barista can carry. */
export function itemModel(item) {
  switch (item.type) {
    case 'portafilter': { const p = portafilter(); p.rotation.y = Math.PI; return p; }
    case 'cup': return cupModel(item);
    case 'food': return foodModel(item.parts);
    case 'trash': return group(box(0.3, 0.12, 0.3, mat(0x1c1512, { roughness: 1 }), 0, 0.06, 0));
    case 'raw':
      if (item.what === 'bread') return breadSlice('bread');
      if (item.what === 'bacon') return baconStrips('raw');
      return patty('raw');
  }
  return new THREE.Group();
}

// ------------------------------------------------------------ steam / smoke

let puffTexture = null;
function puffTex() {
  if (puffTexture) return puffTexture;
  const c = document.createElement('canvas');
  c.width = c.height = 64;
  const x = c.getContext('2d');
  const grd = x.createRadialGradient(32, 32, 2, 32, 32, 30);
  grd.addColorStop(0, 'rgba(255,255,255,0.9)');
  grd.addColorStop(1, 'rgba(255,255,255,0)');
  x.fillStyle = grd;
  x.fillRect(0, 0, 64, 64);
  puffTexture = new THREE.CanvasTexture(c);
  return puffTexture;
}

/** Pooled sprite puffs; call emit() at a world position and update(dt) every frame. */
export class Puffs {
  constructor(scene, count = 60) {
    this.pool = [];
    for (let i = 0; i < count; i++) {
      const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: puffTex(), transparent: true, depthWrite: false, opacity: 0 }));
      s.visible = false;
      s.userData = { life: 0, max: 1, vy: 0.5 };
      scene.add(s);
      this.pool.push(s);
    }
  }
  emit(pos, { color = 0xffffff, size = 0.3, life = 1.3, spread = 0.1 } = {}) {
    const s = this.pool.find((p) => !p.visible);
    if (!s) return;
    s.visible = true;
    s.material.color.set(color);
    s.position.set(pos.x + (Math.random() - 0.5) * spread, pos.y, pos.z + (Math.random() - 0.5) * spread);
    s.userData = { life: 0, max: life, vy: 0.45 + Math.random() * 0.3, size };
  }
  update(dt) {
    for (const s of this.pool) {
      if (!s.visible) continue;
      const u = s.userData;
      u.life += dt;
      const t = u.life / u.max;
      if (t >= 1) { s.visible = false; continue; }
      s.position.y += u.vy * dt;
      s.scale.setScalar(u.size * (0.6 + t * 1.2));
      s.material.opacity = 0.55 * Math.sin(Math.PI * t);
    }
  }
}
