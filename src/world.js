// Builds the café: room, furniture, lights and the interactive stations.
import * as THREE from 'three';
import { model } from './assets.js';
import * as P from './props.js';

export const AISLE_Z = -3;       // the barista walks along this line behind the bar
export const COUNTER_TOP = 1;    // height of every worktop

function place(obj, x, y, z, ry = 0, scale = 1) {
  obj.position.set(x, y, z);
  obj.rotation.y = ry;
  obj.scale.multiplyScalar(scale);
  return obj;
}

function floorTexture() {
  const c = document.createElement('canvas');
  c.width = 1024; c.height = 832;                 // maps to 16 x 13 world units
  const g = c.getContext('2d');
  const px = 64;                                  // pixels per world unit
  // Wooden planks for the seating area.
  for (let row = 0; row < 26; row++) {
    for (let col = -1; col < 6; col++) {
      const shade = 150 + ((row * 37 + col * 91) % 30);
      g.fillStyle = `rgb(${shade + 22},${shade - 28},${shade - 78})`;
      g.fillRect(col * 200 + (row % 2) * 100, row * 32, 198, 30);
    }
  }
  // Checkerboard tiles behind the bar (z < -0.1 → top 6.4 units of the canvas).
  const tiles = 6.4 * px;
  for (let y = 0; y < tiles / 32; y++) {
    for (let x = 0; x < 32; x++) {
      g.fillStyle = (x + y) % 2 ? '#e9e2d6' : '#b9856a';
      g.fillRect(x * 32, y * 32, 32, 32);
    }
  }
  g.fillStyle = 'rgba(60,35,20,.5)';
  g.fillRect(0, tiles - 3, 1024, 6);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 8;
  return t;
}

function chalkboard() {
  const c = document.createElement('canvas');
  c.width = 1024; c.height = 384;
  const g = c.getContext('2d');
  g.fillStyle = '#26332d';
  g.fillRect(0, 0, c.width, c.height);
  g.strokeStyle = '#8a5a35';
  g.lineWidth = 22;
  g.strokeRect(11, 11, c.width - 22, c.height - 22);
  g.textAlign = 'center';
  g.direction = 'rtl';
  g.fillStyle = '#ffe9b8';
  g.font = '900 86px Vazirmatn, Tahoma, sans-serif';
  g.fillText('☕ کافه', c.width / 2, 120);
  g.fillStyle = '#f4f1e8';
  g.font = '700 46px Vazirmatn, Tahoma, sans-serif';
  g.fillText('اسپرسو · لاته · کاپوچینو · موکا', c.width / 2, 215);
  g.fillText('تست · بیکن · برگر', c.width / 2, 295);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  const board = new THREE.Mesh(new THREE.PlaneGeometry(4.2, 1.58), new THREE.MeshStandardMaterial({ map: t, roughness: 0.9 }));
  return board;
}

export function buildWorld(scene) {
  scene.background = new THREE.Color(0x1d1612);

  // ---- lights
  scene.add(new THREE.HemisphereLight(0xfff1dc, 0x5c4a3c, 1.25));
  const sun = new THREE.DirectionalLight(0xffe2bd, 2.4);
  sun.position.set(5, 13, 9);
  sun.target.position.set(0, 0, -2);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  Object.assign(sun.shadow.camera, { left: -11, right: 11, top: 11, bottom: -11, near: 1, far: 40 });
  sun.shadow.bias = -0.0004;
  sun.shadow.normalBias = 0.03;
  scene.add(sun, sun.target);

  // ---- floor
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(16, 13), new THREE.MeshStandardMaterial({ map: floorTexture(), roughness: 0.85 }));
  floor.rotation.x = -Math.PI / 2;
  floor.position.set(0, 0, 0);
  floor.receiveShadow = true;
  scene.add(floor);

  // ---- walls
  const add = (name, x, y, z, ry, s) => { const o = place(model(name), x, y, z, ry, s); scene.add(o); return o; };
  for (const [i, x] of [-6, -2, 2, 6].entries()) add(i === 3 ? 'wall_window_open' : 'wall', x, 0, -6.25);
  add('wall', -8.25, 0, -4.25, Math.PI / 2);
  add('wall_window_open', -8.25, 0, -0.25, Math.PI / 2);
  add('wall', -8.25, 0, 3.75, Math.PI / 2);
  add('wall', 8.25, 0, -4.25, -Math.PI / 2);
  add('wall', 8.25, 0, -0.25, -Math.PI / 2);
  add('wall_doorway', 8.25, 0, 3.75, -Math.PI / 2);

  // ---- back bar
  add('fridge_A', -6, 0, -5);
  for (const x of [-4, -2, 0, 2, 6]) add('kitchencounter_straight_A_backsplash', x, 0, -5);
  add('stove_multi', 4, 0, -5);
  add('extractorhood', 4, 0, -6);
  add('kitchencabinet', 6, 0, -6);
  add('kitchencounter_straight_A', -6, 0, -3, Math.PI / 2);     // left arm (buns + cheese)
  const board = chalkboard();
  board.position.set(-1, 3.05, -5.98);
  scene.add(board);
  add('shelf_B_large_decorated', -4.6, 2.5, -6, 0, 0.9);
  add('pictureframe_medium', 2.2, 2.9, -6);

  // ---- service counter + pendant lamps
  for (const x of [-3, -1, 1, 3]) add('kitchencounter_straight_B', x, 0, -1, Math.PI);
  add('menu', -3.6, COUNTER_TOP, -0.6, 0.3, 0.9);
  add('jar_A_large', 3.7, COUNTER_TOP, -1.2, 0, 0.7);
  add('jar_B_medium', 3.3, COUNTER_TOP, -1.35, 0, 0.7);
  add('cactus_small_A', -1.3, COUNTER_TOP, -0.5, 0, 0.6);
  for (const x of [-2.6, 0, 2.6]) {              // warm glow over the service counter
    const light = new THREE.PointLight(0xffc27a, 7, 7, 2);
    light.position.set(x, 3.0, -0.9);
    scene.add(light);
  }

  // ---- seating area (decor + seats that served customers use)
  add('rug_rectangle_stripes_A', -4.4, 0.001, 3.5, 0, 1.25);
  add('table_round_A_small', -4.4, 0, 3.5);
  add('chair_A_wood', -5.8, 0, 3.5, Math.PI / 2);
  add('chair_A_wood', -3.0, 0, 3.5, -Math.PI / 2);
  add('table_round_A_small', 1.6, 0, 4.1);
  add('chair_A_wood', 0.2, 0, 4.1, Math.PI / 2);
  add('chair_A_wood', 3.0, 0, 4.1, -Math.PI / 2);
  add('couch_pillows', -7.1, 0, 0.6, Math.PI / 2);
  add('lamp_standing', -7.3, 0, -1.3);
  add('cactus_medium_A', 7.3, 0, 0.9, 0, 1.3);
  add('pictureframe_large_A', 8.0, 2.6, -0.3, -Math.PI / 2);
  add('pictureframe_large_B', -8.0, 2.7, 3.7, Math.PI / 2);
  const seat = (x, z, dir) => ({ x, z, ry: dir * Math.PI / 2, table: new THREE.Vector3(x + dir * 1.0, COUNTER_TOP, z), taken: false });
  const seats = [seat(-5.8, 3.5, 1), seat(-3.0, 3.5, -1), seat(0.2, 4.1, 1), seat(3.0, 4.1, -1)];

  // ---- stations
  const stations = [];
  const hitMat = new THREE.MeshBasicMaterial({ visible: false });
  /** Registers a clickable station. `size` is the hit box, `stand` where the barista works from. */
  function station(id, name, icon, obj, { x, z = -5, y = COUNTER_TOP, size = [0.9, 1.3, 1.2], stand, labelY = 1.0 }) {
    if (obj) { obj.position.set(x, y, z); scene.add(obj); }
    const hit = new THREE.Mesh(new THREE.BoxGeometry(...size), hitMat);
    hit.position.set(x, y + size[1] / 2, z);
    scene.add(hit);
    const s = {
      id, name, icon, obj, hit,
      anchor: new THREE.Vector3(x, y + labelY, z),
      stand: stand || { x, z: AISLE_Z - 0.25, ry: Math.PI },
    };
    hit.userData.station = s;
    stations.push(s);
    return s;
  }

  station('ice', 'یخ', '🧊', null, { x: -6, y: 0, size: [1.9, 2.6, 2], labelY: 2.9, stand: { x: -5.4, z: AISLE_Z - 0.35, ry: Math.PI } });
  station('grinder', 'آسیاب', '⚙️', P.grinder(), { x: -4.45, labelY: 1.75 });
  station('kettle', 'آب جوش', '💧', P.kettle(), { x: -3.5, z: -4.9, labelY: 0.8 });
  station('espresso', 'دستگاه اسپرسو', '☕', P.espressoMachine(), { x: -2, z: -5.05, size: [1.7, 1.5, 1.2], labelY: 1.65 });
  station('milk', 'شیر', '🥛', P.milkStation(), { x: -0.5, z: -4.9, labelY: 0.95 });
  station('choco', 'شکلات', '🍫', P.chocoBottle(), { x: 0.55, z: -4.9, labelY: 0.95 });
  station('bread', 'نان', '🍞', P.breadLoaf(), { x: 1.5, z: -4.9, size: [1, 1, 1.2], labelY: 0.7 });
  station('toaster', 'توستر', '🔥', P.toaster(), { x: 2.5, z: -4.9, labelY: 1.05 });

  // Stove with two pans.
  const pans = [];
  for (const [i, x] of [3.52, 4.48].entries()) {
    const pan = model('pan_A');
    pan.scale.setScalar(0.72);
    const content = new THREE.Group();
    content.position.y = 0.09;
    const holder = new THREE.Group();
    holder.add(pan, content);
    const s = station('pan' + i, i ? '' : 'تابه', '🍳', holder, { x, z: -4.95, y: 1.03, size: [0.92, 1.1, 1.3], labelY: 0.75 });
    s.content = content;
    pans.push(s);
  }

  // Raw ingredients on the right-hand counter.
  const baconTray = new THREE.Group();
  baconTray.add(place(model('plate'), 0, 0, 0, 0, 0.8));
  for (let i = 0; i < 3; i++) baconTray.add(place(P.baconStrips('raw', 2), 0, 0.06 + i * 0.035, 0, i * 0.5));
  station('bacon', 'بیکن', '🥓', baconTray, { x: 5.5, z: -4.9, labelY: 0.7 });
  const pattyTray = new THREE.Group();
  pattyTray.add(place(model('plate'), 0, 0, 0, 0, 0.8));
  for (const [x, y, z] of [[-0.14, 0.06, 0], [0.16, 0.06, 0.05], [0, 0.17, 0]]) pattyTray.add(place(P.patty('raw'), x, y, z, 0, 0.75));
  station('patty', 'گوشت', '🥩', pattyTray, { x: 6.5, z: -4.9, labelY: 1.1 });

  // Left arm: buns and cheese crates.
  const side = (z) => ({ x: -4.65, z, ry: -Math.PI / 2 });
  station('bun', 'نان برگر', '🍔', place(model('crate_buns'), 0, 0, 0, Math.PI / 2, 0.42), { x: -6, z: -3.5, size: [1.6, 0.7, 0.9], labelY: 0.85, stand: side(-3.4) });
  station('cheese', 'پنیر', '🧀', place(model('crate_cheese'), 0, 0, 0, Math.PI / 2, 0.42), { x: -6, z: -2.5, size: [1.6, 0.7, 0.9], labelY: 0.85, stand: side(-2.7) });

  station('trash', 'سطل زباله', '🗑️', P.trashBin(), { x: 6.2, z: -2.6, y: 0, size: [1.1, 1.3, 1.1], labelY: 1.45, stand: { x: 5.2, z: -2.8, ry: Math.PI / 2 } });

  // Customer slots at the service counter.
  const slots = [-2.6, 0, 2.6].map((x, i) => {
    const s = station('slot' + i, '', '', null, { x, z: -0.2, y: 0, size: [2, 3, 2.6], stand: { x, z: AISLE_Z + 0.5, ry: 0 } });
    s.slot = { x, z: 0.85, customer: null, served: new THREE.Vector3(x, COUNTER_TOP, -0.75) };
    return s;
  });

  const byId = Object.fromEntries(stations.map((s) => [s.id, s]));
  return { stations, byId, pans, slots, seats };
}
