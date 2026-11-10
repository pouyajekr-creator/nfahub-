import * as THREE from 'three';
import { loadAssets, spawnCharacter } from './assets.js';
import { buildWorld, AISLE_Z } from './world.js';
import * as P from './props.js';
import { MENU, menuFor, menuForDay, describe, itemKey, fa } from './data.js';
import { sfx } from './audio.js';

const $ = (id) => document.getElementById(id);
const overlay = $('overlay');
const DAY_LENGTH = 150;
const WALK_SPEED = 5;

// ------------------------------------------------------------------ renderer
const renderer = new THREE.WebGLRenderer({ canvas: $('scene'), antialias: true });
// `?low` trades shadows and resolution for speed on weak devices.
const LOW = new URLSearchParams(location.search).has('low');
renderer.setPixelRatio(LOW ? 1 : Math.min(devicePixelRatio, 2));
renderer.shadowMap.enabled = !LOW;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.05;

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(38, 1, 0.5, 120);
const CAM_DIR = new THREE.Vector3(0, 0.74, 0.67).normalize();
const camTarget = new THREE.Vector3(0, 0.6, -1.7);
let camPanLimit = 0;   // how far the camera may slide sideways (narrow screens)
let camPan = 0;

function resize() {
  const w = innerWidth, h = innerHeight;
  renderer.setSize(w, h, false);
  camera.aspect = w / h;
  // Wide screens show the whole bar; narrow ones zoom in and follow the barista.
  const halfWidth = THREE.MathUtils.clamp(8.3 * Math.min(1, camera.aspect / 1.25), 4.6, 8.3);
  const tan = Math.tan(THREE.MathUtils.degToRad(camera.fov / 2));
  const dist = Math.max(halfWidth / (tan * camera.aspect), 7.2 / tan * 0.9);
  camera.userData.dist = dist;
  camPanLimit = Math.max(0, 7.6 - dist * tan * camera.aspect);
  camera.updateProjectionMatrix();
}
function updateCamera(dt) {
  const want = THREE.MathUtils.clamp(barista ? barista.root.position.x * 0.9 : 0, -camPanLimit, camPanLimit);
  camPan += (want - camPan) * Math.min(1, dt * 3);
  camera.position.copy(camTarget).addScaledVector(CAM_DIR, camera.userData.dist);
  camera.position.x += camPan;
  camera.lookAt(camTarget.x + camPan, camTarget.y, camTarget.z);
}

// --------------------------------------------------------------------- state
let world, barista, puffs;
const customers = [];
const game = { mode: 'loading', day: 1, coins: 0, timeLeft: 0, served: 0, lost: 0, earned: 0, spawnIn: 0 };
const machine = { state: 'idle', t: 0 };
const toaster = { state: 'idle', t: 0 };
const panState = [{ state: 'idle', t: 0, what: null }, { state: 'idle', t: 0, what: null }];
const COOK = { toast: 4, burnToast: 12, pan: 5, burnPan: 14, brew: 3 };

// ------------------------------------------------------------- overlay tools
const tmp = new THREE.Vector3();
function toScreen(v, el) {
  tmp.copy(v).project(camera);
  el.style.left = ((tmp.x + 1) / 2) * innerWidth + 'px';
  el.style.top = ((1 - tmp.y) / 2) * innerHeight + 'px';
}
function el(cls, html = '') {
  const d = document.createElement('div');
  d.className = cls;
  d.innerHTML = html;
  overlay.appendChild(d);
  return d;
}
let toastTimer = 0;
function say(text) {
  const t = $('toast');
  t.textContent = text;
  t.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.classList.remove('show'), 1800);
}
function floatText(pos, text) {
  const f = el('float', text);
  toScreen(pos, f);
  setTimeout(() => f.remove(), 1200);
}

// ------------------------------------------------------------------- barista
function createBarista() {
  const c = spawnCharacter('Rogue');
  c.root.position.set(0, 0, AISLE_Z);
  scene.add(c.root);
  const handAnchor = new THREE.Group();
  handAnchor.position.set(0, 1.02, 0.62);
  c.root.add(handAnchor);
  return { ...c, handAnchor, hand: null, pending: null, work: null, ring: el('ring hidden', '<span></span>') };
}

function setHand(item) {
  barista.hand = item;
  barista.handAnchor.clear();
  if (item) {
    const m = P.itemModel(item);
    m.scale.multiplyScalar(1.25);
    barista.handAnchor.add(m);
  }
  $('hand').textContent = 'در دست: ' + describe(item);
}

/** Barista stays put for `dur` seconds, then `done` runs. */
function work(dur, icon, done, anim = 'Interact') {
  barista.work = { t: 0, dur, done, icon };
  barista.play(anim, { once: dur < 1.2 });
  barista.ring.querySelector('span').textContent = icon;
}

function updateBarista(dt) {
  const b = barista;
  if (b.work) {
    b.work.t += dt;
    b.ring.classList.remove('hidden');
    b.ring.style.setProperty('--p', Math.min(100, (b.work.t / b.work.dur) * 100));
    toScreen(tmp.copy(b.root.position).setY(2.9), b.ring);
    if (b.work.t >= b.work.dur) {
      const done = b.work.done;
      b.work = null;
      b.ring.classList.add('hidden');
      b.play('Idle');
      done();
    }
    return;
  }
  if (!b.pending) return;
  const { stand } = b.pending;
  const dx = stand.x - b.root.position.x;
  const dz = stand.z - b.root.position.z;
  const d = Math.hypot(dx, dz);
  const step = WALK_SPEED * dt;
  if (d > step) {
    b.root.position.x += (dx / d) * step;
    b.root.position.z += (dz / d) * step;
    turn(b.root, Math.atan2(dx, dz), dt);
    b.play('Walking_A');
  } else {
    b.root.position.set(stand.x, 0, stand.z);
    b.root.rotation.y = stand.ry;
    const s = b.pending;
    b.pending = null;
    b.play('Idle');
    interact(s);
  }
}

function turn(obj, target, dt) {
  let diff = target - obj.rotation.y;
  diff = Math.atan2(Math.sin(diff), Math.cos(diff));
  obj.rotation.y += diff * Math.min(1, dt * 14);
}

// ----------------------------------------------------------- station logic
const need = (msg) => { say(msg); sfx.bad(); };

function addToCup(field, max, dur, icon, sound, fullMsg) {
  const h = barista.hand;
  if (h?.type !== 'cup') return need('اول یه فنجون اسپرسو بگیر ☕');
  if ((h[field] || 0) >= max) return need(fullMsg);
  sound();
  work(dur, icon, () => { setHand({ ...h, [field]: (h[field] || 0) + 1 }); sfx.pick(); });
}

/** Take a finished food part from an appliance, or stack it on the plate in hand. */
function takePart(part) {
  const h = barista.hand;
  if (!h) { setHand({ type: 'food', parts: [part] }); return true; }
  if (h.type === 'food' && !h.parts.includes(part)) { setHand({ type: 'food', parts: [...h.parts, part] }); return true; }
  need('دستت پره! اول اینو تحویل بده یا بنداز دور');
  return false;
}

function interact(s) {
  const h = barista.hand;
  switch (s.id) {
    case 'grinder':
      if (h) return need('برای آسیاب باید دستت خالی باشه');
      sfx.grind();
      s.obj.userData.shake = 1.5;
      return work(1.5, '⚙️', () => { setHand({ type: 'portafilter' }); sfx.pick(); });

    case 'espresso':
      if (machine.state === 'idle') {
        if (h?.type !== 'portafilter') return need('اول قهوه رو آسیاب کن ⚙️');
        setHand(null);
        machine.state = 'brewing'; machine.t = 0;
        sfx.brew();
      } else if (machine.state === 'ready') {
        if (h) return need('دستت پره!');
        machine.state = 'idle';
        setHand({ type: 'cup' });
        sfx.pick();
      } else say('هنوز داره دم می‌کشه…');
      return;

    case 'kettle': return addToCup('water', 1, 0.9, '💧', sfx.pour, 'آب جوش ریختی');
    case 'milk': return addToCup('milk', 2, 1.3, '🥛', sfx.steam, 'شیر کافیه');
    case 'choco': return addToCup('choco', 1, 0.8, '🍫', sfx.pour, 'شکلات ریختی');
    case 'ice': return addToCup('ice', 1, 0.8, '🧊', sfx.pick, 'یخ داره');

    case 'bread': case 'bacon': case 'patty':
      if (h) return need('دستت پره!');
      setHand({ type: 'raw', what: s.id });
      barista.play('PickUp', { once: true });
      return sfx.pick();

    case 'bun': case 'cheese':
      if (takePart(s.id)) { barista.play('PickUp', { once: true }); sfx.pick(); }
      return;

    case 'toaster':
      if (toaster.state === 'idle') {
        if (h?.type !== 'raw' || h.what !== 'bread') return need('نان خام بیار 🍞');
        setHand(null);
        toaster.state = 'toasting'; toaster.t = 0;
        sfx.pick();
      } else if (toaster.state === 'ready') {
        if (takePart('toast')) { toaster.state = 'idle'; sfx.pick(); }
      } else if (toaster.state === 'burnt') {
        if (h) return need('دستت پره!');
        toaster.state = 'idle';
        setHand({ type: 'trash' });
      } else say('هنوز آماده نیست…');
      return;

    case 'pan0': case 'pan1': {
      const p = panState[+s.id.slice(3)];
      if (p.state === 'idle') {
        if (h?.type !== 'raw' || h.what === 'bread') return need('بیکن یا گوشت خام بیار');
        p.what = h.what; p.state = 'cooking'; p.t = 0;
        setHand(null);
        sfx.sizzle();
      } else if (p.state === 'ready') {
        if (takePart(p.what)) { p.state = 'idle'; sfx.pick(); }
      } else if (p.state === 'burnt') {
        if (h) return need('دستت پره!');
        p.state = 'idle';
        setHand({ type: 'trash' });
      } else say('هنوز داره سرخ می‌شه…');
      refreshPan(+s.id.slice(3));
      return;
    }

    case 'trash':
      if (!h) return;
      setHand(null);
      return sfx.trash();

    default:
      if (s.slot) serve(s);
  }
}

function refreshPan(i) {
  const p = panState[i];
  const c = world.pans[i].content;
  c.clear();
  if (p.state === 'idle') return;
  const look = p.state === 'cooking' ? 'raw' : p.state === 'ready' ? 'cooked' : 'burnt';
  c.add(p.what === 'bacon' ? P.baconStrips(look) : P.patty(look));
}

const rings = {};
function ring(id, anchor) {
  if (!rings[id]) rings[id] = { el: el('ring hidden', '<span></span>'), anchor };
  return rings[id];
}
function showRing(id, anchor, visible, pct, icon, state) {
  const r = ring(id, anchor);
  r.el.classList.toggle('hidden', !visible);
  if (!visible) return;
  r.el.style.setProperty('--p', pct);
  r.el.style.setProperty('--c', state === 'burn' ? '#ff6b4a' : state === 'ready' ? '#ffd24a' : '#7ed957');
  r.el.classList.toggle('ready', state !== 'cook');
  r.el.querySelector('span').textContent = icon;
  toScreen(anchor, r.el);
}

function updateAppliances(dt) {
  // Espresso machine
  const em = world.byId.espresso;
  const u = em.obj.userData;
  if (machine.state === 'brewing') {
    machine.t += dt;
    if (Math.random() < dt * 8) puffs.emit(tmp.copy(em.obj.position).add({ x: -0.38, y: 0.45, z: 0.3 }), { size: 0.22, life: 0.9 });
    if (machine.t >= COOK.brew) { machine.state = 'ready'; sfx.ready(); }
  }
  u.brew.visible = machine.state === 'brewing';
  u.cup.visible = machine.state !== 'idle';
  u.stream.visible = machine.state === 'brewing' && machine.t > 0.4;
  u.lights.forEach((l, i) => {
    const on = machine.state === 'brewing' ? Math.floor(machine.t * 6) % 6 === i : machine.state === 'ready';
    l.material.color.set(on ? 0x66ff99 : 0x2b2d33);
    l.material.emissive.set(on ? 0x22ff66 : 0x000000);
  });
  showRing('espresso', tmp.copy(em.anchor).setY(em.anchor.y + 0.6).clone(), machine.state !== 'idle',
    machine.state === 'ready' ? 100 : (machine.t / COOK.brew) * 100, '☕', machine.state === 'ready' ? 'ready' : 'cook');

  // Grinder shake
  const gr = world.byId.grinder.obj;
  if (gr.userData.shake > 0) {
    gr.userData.shake -= dt;
    gr.rotation.z = Math.sin(performance.now() / 18) * 0.02;
  } else gr.rotation.z = 0;

  // Toaster
  const ts = world.byId.toaster;
  const tu = ts.obj.userData;
  if (toaster.state !== 'idle') {
    toaster.t += dt;
    if (toaster.state === 'toasting' && toaster.t >= COOK.toast) { toaster.state = 'ready'; sfx.ready(); setSlices('toast'); }
    if (toaster.state === 'ready' && toaster.t >= COOK.burnToast) { toaster.state = 'burnt'; sfx.bad(); setSlices('burnt'); }
    if (toaster.state === 'burnt' && Math.random() < dt * 5) puffs.emit(tmp.copy(ts.obj.position).setY(1.6), { color: 0x444444, size: 0.4 });
  }
  if (toaster.state === 'toasting' && !tu.slices.visible) setSlices('bread');
  tu.slices.visible = toaster.state !== 'idle';
  const down = toaster.state === 'toasting';
  tu.slices.position.y += ((down ? 0.3 : 0.5) - tu.slices.position.y) * Math.min(1, dt * 12);
  tu.lever.position.y = down ? 0.18 : 0.36;
  showRing('toaster', tmp.copy(ts.anchor).setY(ts.anchor.y + 0.75).clone(), toaster.state !== 'idle',
    toaster.state === 'toasting' ? (toaster.t / COOK.toast) * 100 : toaster.state === 'ready' ? 100 - ((toaster.t - COOK.toast) / (COOK.burnToast - COOK.toast)) * 100 : 100,
    toaster.state === 'burnt' ? '🔥' : '🍞', toaster.state === 'toasting' ? 'cook' : toaster.state === 'ready' ? 'ready' : 'burn');

  // Pans
  panState.forEach((p, i) => {
    const s = world.pans[i];
    if (p.state !== 'idle') {
      p.t += dt;
      if (p.state === 'cooking' && p.t >= COOK.pan) { p.state = 'ready'; sfx.ready(); refreshPan(i); }
      if (p.state === 'ready' && p.t >= COOK.burnPan) { p.state = 'burnt'; sfx.bad(); refreshPan(i); }
      if (Math.random() < dt * (p.state === 'burnt' ? 6 : 3)) {
        puffs.emit(tmp.copy(s.obj.position).setY(1.3), { color: p.state === 'burnt' ? 0x333333 : 0xffffff, size: 0.3 });
      }
    }
    showRing('pan' + i, tmp.copy(s.anchor).setY(s.anchor.y + 0.75).clone(), p.state !== 'idle',
      p.state === 'cooking' ? (p.t / COOK.pan) * 100 : p.state === 'ready' ? 100 - ((p.t - COOK.pan) / (COOK.burnPan - COOK.pan)) * 100 : 100,
      p.state === 'burnt' ? '🔥' : p.what === 'bacon' ? '🥓' : '🥩', p.state === 'cooking' ? 'cook' : p.state === 'ready' ? 'ready' : 'burn');
  });

  // Kettle idles with a little steam.
  if (Math.random() < dt * 1.5) puffs.emit(tmp.copy(world.byId.kettle.obj.position).add({ x: 0.3, y: 0.5, z: 0 }), { size: 0.16, life: 1 });
}

function setSlices(kind) {
  const { slices } = world.byId.toaster.obj.userData;
  const y = slices.position.y;
  slices.clear();
  for (const z of [-0.09, 0.09]) {
    const s = P.breadSlice(kind);
    s.rotation.x = Math.PI / 2;
    s.scale.setScalar(0.85);
    s.position.z = z;
    slices.add(s);
  }
  slices.position.y = y;
}

// ----------------------------------------------------------------- customers
const CUSTOMER_MODELS = ['Knight', 'Mage', 'Barbarian', 'Rogue_Hooded'];
const DOOR = [{ x: 9.6, z: 3.75 }, { x: 7.2, z: 3.75 }];

function spawnCustomer() {
  const free = world.slots.filter((s) => !s.slot.customer);
  if (!free.length) return;
  const s = free[Math.floor(Math.random() * free.length)];
  const c = spawnCharacter(CUSTOMER_MODELS[Math.floor(Math.random() * CUSTOMER_MODELS.length)]);
  c.root.position.set(DOOR[0].x, 0, DOOR[0].z);
  scene.add(c.root);
  const menu = menuForDay(game.day);
  const pick = (list) => list[Math.floor(Math.random() * list.length)];
  const order = [pick(menu)];
  if (game.day > 1 && Math.random() < 0.45) {
    // A second item of the other kind (drink + food).
    const other = menu.filter((m) => !!m.cup !== !!order[0].cup);
    order.push(pick(other));
  }
  const patience = Math.max(38, 62 - game.day * 4) + (order.length - 1) * 22;
  const cust = {
    ...c, station: s, order: order.map((m) => ({ m, done: false })), patience, max: patience,
    state: 'enter', path: [DOOR[1], { x: s.slot.x, z: 2.3 }, { x: s.slot.x, z: s.slot.z }],
    bubble: null, servedModels: [], seat: null, sitT: 0,
  };
  s.slot.customer = cust;
  customers.push(cust);
}

function renderBubble(c) {
  c.bubble.innerHTML = c.order.map((o) => `<div class="item ${o.done ? 'done' : ''}">${o.m.icon} ${o.m.name}</div>`).join('')
    + '<div class="bar"><i></i></div>';
}

function serve(s) {
  const c = s.slot.customer;
  const h = barista.hand;
  if (!c || c.state !== 'wait') return h ? need('اینجا مشتری منتظر نیست') : undefined;
  if (!h) return say('سفارشش رو آماده کن و بیار');
  const key = itemKey(h);
  const o = c.order.find((x) => !x.done && x.m.key === key);
  if (!o) return need(menuFor(h) ? 'این رو سفارش نداده!' : 'این تو منو نیست — بندازش دور 🗑️');
  o.done = true;
  const m = P.itemModel(h);
  m.position.copy(s.slot.served);
  m.position.x += (c.servedModels.length - (c.order.length - 1) / 2) * 0.55;
  scene.add(m);
  c.servedModels.push(m);
  setHand(null);
  barista.play('Interact', { once: true });
  renderBubble(c);
  sfx.pick();
  if (c.order.every((x) => x.done)) finishOrder(c);
}

function finishOrder(c) {
  const base = c.order.reduce((a, o) => a + o.m.price, 0);
  const tip = Math.round(base * 0.4 * (c.patience / c.max));
  game.coins += base + tip;
  game.earned += base + tip;
  game.served++;
  sfx.coin();
  floatText(tmp.copy(c.root.position).setY(3.2), `+${fa(base + tip)} 🪙`);
  c.play('Cheer', { once: true });
  c.state = 'cheer';
  c.sitT = 1.1;
  c.bubble?.remove();
  c.bubble = null;
  updateHud();
}

function leaveSlot(c) {
  c.station.slot.customer = null;
  const seat = world.seats.find((x) => !x.taken);
  const x = c.root.position.x;
  if (seat && c.servedModels.length) {
    seat.taken = true;
    c.seat = seat;
    c.state = 'toSeat';
    c.path = [{ x, z: 2.3 }, { x: seat.x + Math.sign(seat.table.x - seat.x) * -0.9, z: 2.6 }, { x: seat.x, z: seat.z }];
  } else exit(c, [{ x, z: 2.3 }]);
}

function exit(c, via = []) {
  c.state = 'exit';
  c.path = [...via, DOOR[1], DOOR[0]];
  c.servedModels.forEach((m) => scene.remove(m));
  c.servedModels = [];
}

function walkPath(c, dt, speed = 3.4) {
  const p = c.path[0];
  if (!p) return true;
  const dx = p.x - c.root.position.x, dz = p.z - c.root.position.z;
  const d = Math.hypot(dx, dz), step = speed * dt;
  if (d <= step) { c.root.position.set(p.x, 0, p.z); c.path.shift(); return c.path.length === 0; }
  c.root.position.x += (dx / d) * step;
  c.root.position.z += (dz / d) * step;
  turn(c.root, Math.atan2(dx, dz), dt);
  c.play('Walking_A');
  return false;
}

function updateCustomers(dt) {
  for (let i = customers.length - 1; i >= 0; i--) {
    const c = customers[i];
    c.mixer.update(dt);
    switch (c.state) {
      case 'enter':
        if (walkPath(c, dt)) {
          c.state = 'wait';
          c.root.rotation.y = Math.PI;
          c.play('Idle');
          c.bubble = el('bubble');
          renderBubble(c);
          sfx.bell();
        }
        break;
      case 'wait': {
        if (game.mode === 'playing') c.patience -= dt;
        const f = Math.max(0, c.patience / c.max);
        const bar = c.bubble.querySelector('i');
        bar.style.transform = `scaleX(${f})`;
        bar.style.background = f > 0.5 ? '#6cc04a' : f > 0.25 ? '#e9a13b' : '#e0523c';
        toScreen(tmp.copy(c.root.position).setY(2.85), c.bubble);
        if (c.patience <= 0) {
          game.lost++;
          sfx.bad();
          floatText(tmp.copy(c.root.position).setY(3.2), '😠');
          c.bubble.remove(); c.bubble = null;
          c.station.slot.customer = null;
          c.play('Hit_A', { once: true });
          exit(c, [{ x: c.root.position.x, z: 2.3 }]);
        }
        break;
      }
      case 'cheer':
        c.sitT -= dt;
        if (c.sitT <= 0) leaveSlot(c);
        break;
      case 'toSeat':
        c.servedModels.forEach((m, k) => {            // carry the order along
          m.position.set(c.root.position.x + Math.sin(c.root.rotation.y) * 0.6 + k * 0.01, 1.05 + k * 0.28, c.root.position.z + Math.cos(c.root.rotation.y) * 0.6);
        });
        if (walkPath(c, dt)) {
          c.state = 'sit';
          c.sitT = 9 + Math.random() * 5;
          c.root.rotation.y = c.seat.ry;
          c.root.position.y = 0.0;
          c.play('Sit_Chair_Idle');
          c.servedModels.forEach((m, k) => m.position.copy(c.seat.table).add({ x: 0, y: 0, z: (k - 0.5 * (c.servedModels.length - 1)) * 0.45 }));
        }
        break;
      case 'sit':
        c.sitT -= dt;
        if (c.sitT <= 0) {
          c.seat.taken = false;
          c.root.position.y = 0;
          exit(c, [{ x: c.seat.x + Math.sign(c.seat.table.x - c.seat.x) * -0.9, z: 2.6 }]);
        }
        break;
      case 'exit':
        if (walkPath(c, dt)) {
          scene.remove(c.root);
          customers.splice(i, 1);
        }
        break;
    }
  }
}

// ------------------------------------------------------------------ day flow
function updateHud() {
  $('hud-day').textContent = 'روز ' + fa(game.day);
  $('hud-coins').textContent = '🪙 ' + fa(game.coins);
  const t = Math.max(0, game.timeLeft);
  $('hud-timer-fill').style.transform = `scaleX(${t / DAY_LENGTH})`;
  $('hud-timer-text').textContent = `⏱ ${fa(Math.floor(t / 60))}:${fa(Math.floor(t % 60)).padStart(2, '۰')}`;
}

function startDay() {
  Object.assign(game, { mode: 'playing', timeLeft: DAY_LENGTH, served: 0, lost: 0, earned: 0, spawnIn: 1.5 });
  $('screen').classList.add('hidden');
  $('hud').classList.remove('hidden');
  $('hand').classList.remove('hidden');
  setHand(null);
  updateHud();
  renderRecipes();
  sfx.unlock();
}

function endDay() {
  game.mode = 'summary';
  const total = game.served + game.lost;
  const stars = total === 0 ? 0 : game.lost === 0 ? 3 : game.served / total >= 0.7 ? 2 : 1;
  const unlocked = MENU.filter((m) => m.day === game.day + 1);
  localStorage.setItem('cafe3d', JSON.stringify({ day: game.day + 1, coins: game.coins }));
  $('screen-card').innerHTML = `
    <h1>پایان روز ${fa(game.day)}</h1>
    <p style="font-size:34px;margin:0">${'⭐'.repeat(stars)}${'☆'.repeat(3 - stars)}</p>
    <div class="stats">
      <div><b>${fa(game.served)}</b>مشتری راضی</div>
      <div><b>${fa(game.lost)}</b>مشتری از‌دست‌رفته</div>
      <div><b>${fa(game.earned)} 🪙</b>درآمد امروز</div>
    </div>
    ${unlocked.length ? `<p>🎉 فردا به منو اضافه می‌شه: <b>${unlocked.map((m) => m.icon + ' ' + m.name).join('، ')}</b></p>` : ''}
    <button class="primary" id="btn-next">شروع روز ${fa(game.day + 1)}</button>`;
  $('screen').classList.remove('hidden');
  $('btn-next').onclick = () => { game.day++; startDay(); };
}

function updateDay(dt) {
  if (game.mode !== 'playing') return;
  game.timeLeft -= dt;
  if (game.timeLeft > 0) {
    game.spawnIn -= dt;
    if (game.spawnIn <= 0) {
      spawnCustomer();
      game.spawnIn = Math.max(7, 17 - game.day * 2) * (0.75 + Math.random() * 0.5);
    }
  } else if (!customers.some((c) => c.state === 'enter' || c.state === 'wait' || c.state === 'cheer')) {
    endDay();
  }
  updateHud();
}

function renderRecipes() {
  $('recipe-list').innerHTML = MENU.map((m) => `
    <div class="recipe ${m.day > game.day ? 'locked' : ''}">
      <span class="name">${m.icon} ${m.name}</span>
      <span class="steps">${m.day > game.day ? `🔒 از روز ${fa(m.day)}` : m.steps}</span>
      <span class="price">${fa(m.price)} 🪙</span>
    </div>`).join('');
}

function showStart() {
  const save = JSON.parse(localStorage.getItem('cafe3d') || 'null');
  $('screen-card').innerHTML = `
    <h1>☕ کافه سه‌بعدی</h1>
    <p>تو باریستای این کافه‌ای. سفارش مشتری‌ها رو قبل از تموم شدن حوصله‌شون آماده کن!</p>
    <ol>
      <li>روی هر وسیله <b>کلیک / لمس</b> کن تا باریستا بره سراغش.</li>
      <li><b>قهوه:</b> آسیاب ⚙️ ← دستگاه اسپرسو ☕ ← (شیر، آب جوش، شکلات یا یخ).</li>
      <li><b>غذا:</b> نان ← توستر 🍞 · بیکن ← تابه 🥓 (مواظب باش نسوزه!).</li>
      <li>وقتی آماده شد روی <b>مشتری</b> کلیک کن تا تحویلش بدی.</li>
    </ol>
    <button class="primary" id="btn-start">${save?.day > 1 ? `ادامه از روز ${fa(save.day)}` : 'شروع بازی'}</button>
    ${save?.day > 1 ? '<br><button class="primary" id="btn-reset" style="background:#8a7a6c;font-size:14px;padding:8px 18px">شروع از اول</button>' : ''}`;
  $('btn-start').onclick = () => {
    if (save?.day > 1) { game.day = save.day; game.coins = save.coins || 0; }
    startDay();
  };
  if ($('btn-reset')) $('btn-reset').onclick = () => { localStorage.removeItem('cafe3d'); startDay(); };
}

// --------------------------------------------------------------------- input
const raycaster = new THREE.Raycaster();
const pointer = new THREE.Vector2();
function pickStation(ev) {
  pointer.set((ev.clientX / innerWidth) * 2 - 1, -(ev.clientY / innerHeight) * 2 + 1);
  raycaster.setFromCamera(pointer, camera);
  const hits = raycaster.intersectObjects(world.stations.map((s) => s.hit), false);
  return hits[0]?.object.userData.station;
}
renderer.domElement.addEventListener('pointerdown', (ev) => {
  if (game.mode !== 'playing') return;
  sfx.unlock();
  const s = pickStation(ev);
  if (s) barista.pending = s;
});
renderer.domElement.addEventListener('pointermove', (ev) => {
  if (game.mode !== 'playing' || ev.pointerType === 'touch') return;
  const s = pickStation(ev);
  renderer.domElement.style.cursor = s ? 'pointer' : 'default';
  for (const st of world.stations) st.tag?.classList.toggle('hot', st === s);
});
$('btn-recipes').onclick = () => { renderRecipes(); $('recipes').classList.remove('hidden'); };
$('btn-close-recipes').onclick = () => $('recipes').classList.add('hidden');
$('btn-sound').onclick = () => { $('btn-sound').textContent = sfx.toggle() ? '🔇' : '🔊'; };
addEventListener('resize', resize);

// ---------------------------------------------------------------------- loop
const clock = new THREE.Clock();
function frame() {
  const dt = Math.min(clock.getDelta(), 0.1);
  if (game.mode !== 'loading') {
    updateDay(dt);
    updateBarista(dt);
    barista.mixer.update(dt);
    updateCustomers(dt);
    updateAppliances(dt);
    puffs.update(dt);
    updateCamera(dt);
    for (const s of world.stations) if (s.tag) toScreen(s.anchor, s.tag);
  }
  renderer.render(scene, camera);
  requestAnimationFrame(frame);
}

async function init() {
  resize();
  await loadAssets((p) => { $('loading').textContent = `در حال بارگذاری مدل‌ها… ${fa(p * 100)}٪`; });
  world = buildWorld(scene);
  puffs = new P.Puffs(scene);
  barista = createBarista();
  for (const s of world.stations) if (s.name || s.id === 'pan1') s.tag = el('tag', `${s.icon} ${s.name}`.trim());
  game.mode = 'menu';
  updateCamera(1);
  showStart();
  window.__menu = MENU;
  window.__cafe = { game, world, barista, customers, machine, toaster, panState, scene, camera };   // debugging handle
  frame();
}
init().catch((e) => {
  console.error(e);
  $('loading').textContent = 'خطا در بارگذاری: ' + e.message;
});
