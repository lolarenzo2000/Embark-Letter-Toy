import '../css/style.css';
import * as THREE from 'three';
import { CONFIG } from './config.js';
import { $, rand, clamp, stars, waveFn, beep, initAudio } from './utils.js';
import { loadAssets, fallbackLogo, makeLetter } from './models.js';
import { makeVehicle } from './vehicles.js';
import { buildWorld } from './worlds.js';

$('name').textContent = CONFIG.name;
$('endName').textContent = CONFIG.name;
$('slogan').textContent = CONFIG.slogan;

/* ---------- carga de modelos FBX ---------- */
const assets = await loadAssets(CONFIG, (n, total) => {
  $('loadingBar').style.width = (n / total * 100) + '%';
});
$('loading').style.opacity = 0;
setTimeout(() => $('loading').remove(), 600);
if (assets.missing.length) {
  const w = $('missing');
  w.textContent = 'No se encontraron: ' + assets.missing.join(', ') + ' (se usan reemplazos temporales)';
  w.style.display = 'block';
}

/* ---------- escena base ---------- */
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.setSize(innerWidth, innerHeight);
document.body.appendChild(renderer.domElement);
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x05070d);
const camera = new THREE.PerspectiveCamera(60, innerWidth / innerHeight, 0.1, 1200);
camera.position.set(0, 0, 9);
scene.add(new THREE.HemisphereLight(0xffffff, 0x223344, 1.1));
const sun = new THREE.DirectionalLight(0xffffff, 1.6);
sun.position.set(50, 100, 30);
scene.add(sun);
addEventListener('resize', () => {
  camera.aspect = innerWidth / innerHeight; camera.updateProjectionMatrix();
  renderer.setSize(innerWidth, innerHeight);
});

/* ---------- halo de las letras ---------- */
function glowTex() {
  const c = document.createElement('canvas'); c.width = c.height = 64;
  const x = c.getContext('2d'), g = x.createRadialGradient(32, 32, 0, 32, 32, 32);
  g.addColorStop(0, 'rgba(255,230,140,1)'); g.addColorStop(1, 'rgba(255,230,140,0)');
  x.fillStyle = g; x.fillRect(0, 0, 64, 64); return new THREE.CanvasTexture(c);
}
const HALO = glowTex();
function haloSprite() {
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: HALO, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false, fog: false }));
  s.scale.set(14, 14, 1); return s;
}

/* ---------- estado ---------- */
let world = new THREE.Group(); scene.add(world);
let water = null, waterBase = null;
function clearWorld() {
  scene.remove(world);
  world.traverse(o => o.geometry && o.geometry.dispose());
  world = new THREE.Group(); scene.add(world); water = null;
}

const holder = new THREE.Group(); holder.rotation.order = 'YXZ'; scene.add(holder);
const logo = assets.logo || fallbackLogo(); holder.add(logo);
const introStars = stars(1200, 300); scene.add(introStars);

let state = 'intro', lvl = 0, cfg = null, obstacles = [], letters = [];
const found = CONFIG.name.split('').map(() => false);
let vehicle = null, locked = false, toastT = 0, morph = null, motif = null, orbitA = 0;
const P = { pos: new THREE.Vector3(), yaw: 0, vy: 0, speed: 0, roll: 0 };
const keys = {};
const K = (...c) => c.some(x => keys[x]);
let buf = '';

/* ---------- HUD ---------- */
function buildHud() {
  const el = $('letters'); el.innerHTML = '';
  CONFIG.name.split('').forEach((ch, i) => {
    const s = document.createElement('span'); s.textContent = found[i] ? ch : '_'; if (found[i]) s.className = 'on'; el.appendChild(s);
  });
}
function toast(t) { const e = $('toast'); e.textContent = t; e.style.opacity = 1; toastT = 2.2; }

/* ---------- transformación logo <-> vehículo ---------- */
const STAGE = .7;
function startMorph(list, done) {
  list.forEach(o => { if (o.parent !== holder) holder.add(o); });
  morph = { list, t: 0, done };
}
function updateMorph(dt) {
  if (!morph) return;
  morph.t += dt;
  const n = morph.list.length;
  const k = Math.min(n - 1, Math.floor(morph.t / STAGE)), u = clamp((morph.t - k * STAGE) / STAGE, 0, 1);
  morph.list.forEach((o, i) => {
    o.visible = i === k;
    if (i !== k) return;
    const s = i === n - 1 ? Math.sin(u * Math.PI / 2) : i === 0 ? Math.cos(u * Math.PI / 2) : Math.sin(u * Math.PI);
    o.scale.setScalar(Math.max(.001, s));
    o.rotation.y += dt * 10 * (1 - (i === n - 1 ? u : 0));
  });
  if (morph.t >= n * STAGE) {
    morph.list.forEach((o, i) => { o.visible = i === n - 1; o.scale.setScalar(1); o.rotation.set(0, 0, 0); if (i < n - 1) holder.remove(o); });
    const d = morph.done; morph = null; d && d();
  }
}

/* ---------- niveles ---------- */
function startLevel(i) {
  lvl = i; cfg = CONFIG.levels[i]; locked = true;
  clearWorld(); scene.remove(introStars);
  const built = buildWorld(cfg.type, scene, world);
  obstacles = built.obstacles; water = built.water; waterBase = built.waterBase;
  P.pos.set(0, cfg.type === 'plane' ? 25 : 0, 0); P.yaw = 0; P.vy = 0; P.speed = cfg.type === 'plane' ? 20 : 0;
  holder.position.copy(P.pos); holder.rotation.set(0, 0, 0);

  letters = [];
  const pool = [...obstacles].sort(() => Math.random() - .5);
  cfg.letters.forEach((idx, n) => {
    const o = pool[n % pool.length];
    let pos = null;
    for (let tries = 0; tries < 80 && !pos; tries++) {
      const a = rand(0, Math.PI * 2), d = o.r + rand(8, 13 + tries * .3);
      const c = new THREE.Vector3(o.pos.x + Math.cos(a) * d, 0, o.pos.z + Math.sin(a) * d);
      c.y = cfg.type === 'boat' ? 3 : cfg.type === 'plane' ? rand(10, 45) : o.pos.y + rand(-5, 5);
      const clear = obstacles.every(q => {
        const dd = cfg.type === 'ship' ? q.pos.distanceTo(c) : Math.hypot(q.pos.x - c.x, q.pos.z - c.z);
        return dd > q.r + 6;
      });
      const apart = letters.every(l => l.pos.distanceTo(c) > 40);
      if (clear && apart && Math.hypot(c.x, c.z) < 245) pos = c;
    }
    if (!pos) pos = new THREE.Vector3(rand(-30, 30), cfg.type === 'boat' ? 3 : 20, 40 + n * 45);

    const inst = makeLetter(CONFIG.name[idx], assets), halo = haloSprite();
    inst.obj.position.copy(pos); halo.position.copy(pos); world.add(inst.obj, halo);
    letters.push({ idx, inst, halo, pos, got: false });
  });

  $('lvl').textContent = cfg.title; buildHud();
  const next = makeVehicle(cfg.type); next.visible = false;
  const list = vehicle ? [vehicle, logo, next] : [logo, next];
  vehicle = next;
  startMorph(list, () => { locked = false; toast('Explora. Algo brilla ahí fuera…'); });
}

function collect(L) {
  L.got = true; found[L.idx] = true; world.remove(L.inst.obj, L.halo); buildHud();
  beep(880, .3); setTimeout(() => beep(1320, .4), 120);
  toast(CONFIG.name[L.idx] + ' ✦');
  if (letters.every(l => l.got)) {
    locked = true;
    setTimeout(() => (lvl < CONFIG.levels.length - 1
      ? (toast('El logo se transforma…'), setTimeout(() => startLevel(lvl + 1), 1500))
      : endGame()), 1200);
  }
}

/* ---------- final ---------- */
function endGame() {
  state = 'end'; locked = true;
  $('hud').style.opacity = 0;
  startMorph([vehicle, logo], () => {});
  vehicle = null;
  scene.fog = null; scene.background = new THREE.Color(0x05070d);
  clearWorld(); world.add(stars(1500, 500));
  motif = new THREE.Group(); motif.position.copy(P.pos);
  [6, 9, 12].forEach((r, i) => {
    const t = new THREE.Mesh(new THREE.TorusGeometry(r, .06, 8, 100), new THREE.MeshBasicMaterial({ color: i === 1 ? 0xffd34d : 0x4dd0ff, transparent: true, opacity: .7 }));
    t.rotation.set(rand(0, 3), rand(0, 3), 0); t.userData.s = rand(.2, .5) * (i % 2 ? 1 : -1); motif.add(t);
  });
  const n = 500, arr = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) { const a = rand(0, 6.28), r = rand(14, 24); arr.set([Math.cos(a) * r, rand(-6, 6), Math.sin(a) * r], i * 3); }
  const gg = new THREE.BufferGeometry(); gg.setAttribute('position', new THREE.BufferAttribute(arr, 3));
  const pts = new THREE.Points(gg, new THREE.PointsMaterial({ color: 0xffd34d, size: .35, transparent: true, opacity: .9 }));
  pts.userData.s = .15; motif.add(pts); world.add(motif);
  beep(330, 1.2, 'triangle', .15); setTimeout(() => beep(495, 1.4, 'triangle', .15), 400); setTimeout(() => beep(660, 2, 'triangle', .15), 800);
  setTimeout(() => $('end').classList.add('show'), 2200);
}
$('replay').onclick = () => location.reload();

/* ---------- inicio (clic en logo/nombre, Enter o código) ---------- */
function begin() {
  if (state !== 'intro') return;
  state = 'play';
  initAudio(); beep(440, .4);
  $('intro').style.opacity = 0; $('hud').style.opacity = 1;
  startLevel(0);
}
addEventListener('keydown', e => {
  keys[e.code] = true;
  if (['Space', 'ArrowUp', 'ArrowDown'].includes(e.code)) e.preventDefault();
  if (state === 'intro') {
    if (e.key === 'Enter') return begin();
    if (e.key.length === 1) { buf = (buf + e.key.toUpperCase()).slice(-CONFIG.code.length); if (buf === CONFIG.code.toUpperCase()) begin(); }
  }
});
addEventListener('keyup', e => { keys[e.code] = false; });
$('name').addEventListener('click', begin);
const ray = new THREE.Raycaster();
renderer.domElement.addEventListener('pointerdown', e => {
  if (state !== 'intro') return;
  ray.setFromCamera(new THREE.Vector2(e.clientX / innerWidth * 2 - 1, -(e.clientY / innerHeight) * 2 + 1), camera);
  if (ray.intersectObject(logo, true).length) begin();
});

/* ---------- bucle ---------- */
const clock = new THREE.Clock();
function update(dt, t) {
  updateMorph(dt);
  if (toastT > 0) { toastT -= dt; if (toastT <= 0) $('toast').style.opacity = 0; }

  if (state === 'intro') {
    logo.rotation.y += dt * .7; logo.rotation.x = Math.sin(t * .6) * .3;
    introStars.rotation.y += dt * .01;
    return;
  }

  if (state === 'end') {
    orbitA += dt * .25;
    camera.position.set(P.pos.x + Math.cos(orbitA) * 16, P.pos.y + 4, P.pos.z + Math.sin(orbitA) * 16);
    camera.lookAt(P.pos);
    holder.rotation.y += dt * .5;
    if (motif) motif.children.forEach(c => { if (c.userData.s) { c.rotation.y += c.userData.s * dt; c.rotation.x += c.userData.s * dt * .6; } });
    return;
  }

  const type = cfg.type;
  const maxV = type === 'boat' ? 24 : type === 'plane' ? 60 : 80, minV = type === 'plane' ? 18 : 0;
  if (!locked) {
    if (K('KeyW', 'ArrowUp')) P.speed += 30 * dt;
    else if (K('KeyS', 'ArrowDown')) P.speed -= 30 * dt;
    else if (type !== 'plane') P.speed *= (1 - .6 * dt);
    P.speed = clamp(P.speed, minV, maxV);
    const turn = (K('KeyA', 'ArrowLeft') ? 1 : 0) - (K('KeyD', 'ArrowRight') ? 1 : 0);
    const tr = type === 'boat' ? 1.1 : type === 'plane' ? 1.3 : 1.8;
    P.yaw += turn * tr * dt * clamp(.4 + P.speed / 25, .4, 1.2);
    P.roll += (-turn * .6 - P.roll) * Math.min(1, dt * 4);
    if (type !== 'boat') {
      const up = (K('Space') ? 1 : 0) - (K('ShiftLeft', 'ShiftRight') ? 1 : 0);
      P.vy += (up * (type === 'plane' ? 22 : 30) - P.vy) * Math.min(1, dt * 3);
    }
  }
  const fwd = new THREE.Vector3(Math.sin(P.yaw), 0, Math.cos(P.yaw));
  P.pos.addScaledVector(fwd, P.speed * dt);
  if (type === 'boat') P.pos.y = waveFn(P.pos.x, P.pos.z, t) + .4;
  else {
    P.pos.y += P.vy * dt;
    P.pos.y = type === 'plane' ? clamp(P.pos.y, 3, 85) : clamp(P.pos.y, -80, 80);
  }
  const hl = Math.hypot(P.pos.x, P.pos.z);
  if (hl > 260) { P.pos.x *= 260 / hl; P.pos.z *= 260 / hl; }
  if (type === 'boat') obstacles.forEach(o => {
    const dx = P.pos.x - o.pos.x, dz = P.pos.z - o.pos.z, d = Math.hypot(dx, dz), m = o.r + 2.5;
    if (d < m) { P.pos.x = o.pos.x + dx / d * m; P.pos.z = o.pos.z + dz / d * m; P.speed *= .9; }
  });

  holder.position.copy(P.pos);
  if (!morph) {
    holder.rotation.set(type === 'boat' ? Math.sin(t * 2) * .03 : -P.vy * .02, P.yaw, P.roll);
    const pr = vehicle && vehicle.getObjectByName('prop'); if (pr) pr.rotation.z += dt * 40;
  } else holder.rotation.y = P.yaw;

  const dist = type === 'boat' ? 14 : type === 'plane' ? 18 : 20, h = type === 'boat' ? 6 : 6.5;
  const want = P.pos.clone().addScaledVector(fwd, -dist).add(new THREE.Vector3(0, h, 0));
  camera.position.lerp(want, Math.min(1, dt * 4));
  camera.lookAt(P.pos.clone().addScaledVector(fwd, 8));

  if (water) {
    const a = water.geometry.attributes.position;
    for (let i = 0; i < a.count; i++) a.setY(i, waveFn(waterBase[i * 3], waterBase[i * 3 + 2], t));
    a.needsUpdate = true;
  }
  if (type === 'ship') obstacles.forEach(o => {
    if (!o.mesh) return;
    o.mesh.rotation.x += o.mesh.userData.spin.x * dt;
    o.mesh.rotation.y += o.mesh.userData.spin.y * dt;
  });

  let nearest = 1e9;
  letters.forEach(L => {
    if (L.got) return;
    const d = L.pos.distanceTo(P.pos); nearest = Math.min(nearest, d);
    L.inst.setOpacity(clamp(1 - (d - 12) / 33, 0, 1));
    L.halo.material.opacity = clamp((95 - d) / 95, 0, .45) * (.6 + .4 * Math.sin(t * 3 + L.idx));
    L.inst.obj.position.y = L.pos.y + Math.sin(t * 2 + L.idx) * .5;
    if (L.inst.spins) L.inst.obj.rotation.y += dt * .8;
    if (!locked && d < CONFIG.collectRadius) collect(L);
  });
  $('signal').style.width = (nearest < 1e8 ? clamp(1 - nearest / 170, 0, 1) * 100 : 0) + '%';
}
renderer.setAnimationLoop(() => {
  update(Math.min(clock.getDelta(), .05), clock.elapsedTime);
  renderer.render(scene, camera);
});
