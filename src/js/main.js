import '../css/style.css';
import * as THREE from 'three';
import { CONFIG } from './config.js';
import { $, rand, clamp, stars, waveFn, beep, initAudio, applyMatteRed } from './utils.js';
import { loadAssets, fallbackLogo, makeLetter } from './models.js';
import { makeVehicle } from './vehicles.js';
import { buildWorld, groundHeight, MAP_RADIUS } from './worlds.js';
import { AudioController } from './audio.js';

$('name').textContent = CONFIG.name;
$('endName').textContent = CONFIG.name;
$('slogan').textContent = CONFIG.slogan;

/* ---------- carga de modelos FBX ---------- */
const assets = await loadAssets(CONFIG, (n, total) => {
  $('loadingBar').style.width = (n / total * 100) + '%';
});
const audio = new AudioController(CONFIG.audio);
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
renderer.autoClear = false;
document.body.appendChild(renderer.domElement);
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x05070d);
const camera = new THREE.PerspectiveCamera(60, innerWidth / innerHeight, 0.1, 1200);
camera.position.set(0, 0, 9);
const overlayScene = new THREE.Scene();
overlayScene.add(new THREE.AmbientLight(0xffffff, 1.5));
const overlayLight = new THREE.DirectionalLight(0xffffff, 2);
overlayLight.position.set(-40, 80, 100); overlayScene.add(overlayLight);
const overlayCamera = new THREE.OrthographicCamera(-innerWidth / 2, innerWidth / 2, innerHeight / 2, -innerHeight / 2, .1, 200);
overlayCamera.position.set(0, 0, 100); overlayCamera.lookAt(0, 0, 0);
scene.add(new THREE.HemisphereLight(0xffffff, 0x223344, 1.1));
const sun = new THREE.DirectionalLight(0xffffff, 1.6);
sun.position.set(50, 100, 30);
scene.add(sun);
addEventListener('resize', () => {
  camera.aspect = innerWidth / innerHeight; camera.updateProjectionMatrix();
  renderer.setSize(innerWidth, innerHeight);
  overlayCamera.left = -innerWidth / 2; overlayCamera.right = innerWidth / 2;
  overlayCamera.top = innerHeight / 2; overlayCamera.bottom = -innerHeight / 2;
  overlayCamera.updateProjectionMatrix();
});

/* ---------- halo de las letras ---------- */
function glowTex() {
  const c = document.createElement('canvas'); c.width = c.height = 64;
  const x = c.getContext('2d'), g = x.createRadialGradient(32, 32, 0, 32, 32, 32);
  g.addColorStop(0, 'rgba(255,230,140,1)'); g.addColorStop(1, 'rgba(255,230,140,0)');
  x.fillStyle = g; x.fillRect(0, 0, 64, 64);
  x.strokeStyle = 'rgba(255,255,255,.95)'; x.lineWidth = 2;
  x.beginPath(); x.moveTo(32, 5); x.lineTo(32, 59); x.moveTo(5, 32); x.lineTo(59, 32); x.stroke();
  return new THREE.CanvasTexture(c);
}
const HALO = glowTex();
function haloSprite() {
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: HALO, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false, fog: false }));
  s.scale.set(8, 8, 1); return s;
}

/* ---------- estado ---------- */
let world = new THREE.Group(); scene.add(world);
let water = null, waterBase = null, waterBounds = null, terrainHeight = groundHeight;
function clearWorld() {
  scene.remove(world);
  world.traverse(o => {
    if (o.geometry) o.geometry.dispose();
    if (o.material) (Array.isArray(o.material) ? o.material : [o.material]).forEach(m => m.dispose());
  });
  world = new THREE.Group(); scene.add(world); water = null; waterBounds = null; terrainHeight = groundHeight;
}

const holder = new THREE.Group(); holder.rotation.order = 'YXZ'; scene.add(holder);
const logo = applyMatteRed(assets.logo || fallbackLogo()); holder.add(logo);
const introStars = stars(1200, 300); scene.add(introStars);

let state = 'intro', lvl = 0, cfg = null, obstacles = [], letters = [];
const found = CONFIG.name.split('').map(() => false);
let vehicle = null, locked = false, toastT = 0, morph = null, motif = null;
const P = { pos: new THREE.Vector3(), yaw: 0, vy: 0, speed: 0, roll: 0 };
const keys = {};
const K = (...c) => c.some(x => keys[x]);
const MOVEMENT_KEYS = new Set(['KeyW', 'KeyA', 'KeyS', 'KeyD', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space', 'ShiftLeft', 'ShiftRight']);
const cameraOrbit = { yaw: 0, pitch: 0, distance: 20 };
let manualCamera = false, cameraDrag = null, cameraModeBlend = 0;
let buf = '';
const hudLetterModels = [];

function makeDisplayLetter(ch) {
  const source = assets.letters[ch];
  if (!source) return null;
  const object = applyMatteRed(source.clone(true));
  const size = new THREE.Box3().setFromObject(object).getSize(new THREE.Vector3());
  return { object, width: size.x || 1, height: size.y || 1, modelScale: object.scale.x || 1 };
}

const introWordModels = [...CONFIG.name].map(makeDisplayLetter);
const endWordModels = [...CONFIG.name].map(makeDisplayLetter);
introWordModels.forEach(model => model && overlayScene.add(model.object));
endWordModels.forEach(model => { if (model) { model.object.visible = false; overlayScene.add(model.object); } });
if (introWordModels.every(Boolean)) $('name').classList.add('model-text');
if (endWordModels.every(Boolean)) $('endName').classList.add('model-text');

function positionDisplayLetter(model, centerX, centerY, scale) {
  model.object.scale.setScalar(scale * model.modelScale);
  model.object.position.set(centerX - innerWidth / 2, innerHeight / 2 - centerY, 0);
}

function layoutDisplayLetters() {
  const layoutWord = (models, element) => {
    if (!models.every(Boolean)) return;
    const rect = element.getBoundingClientRect();
    const baseSize = CONFIG.models.letters.size;
    const gap = baseSize * .12;
    const wordWidth = models.reduce((sum, model) => sum + model.width, 0) + gap * (models.length - 1);
    const availableWidth = Math.min(rect.width, innerWidth * .92);
    const scale = Math.min(availableWidth / wordWidth, rect.height * .9 / baseSize);
    let cursor = rect.left + (rect.width - wordWidth * scale) / 2;
    models.forEach(model => {
      const glyphWidth = model.width * scale;
      const baselineOffset = (model.height - baseSize) * scale / 2;
      positionDisplayLetter(model, cursor + glyphWidth / 2, rect.top + rect.height / 2 - baselineOffset, scale);
      cursor += glyphWidth + gap * scale;
    });
  };
  layoutWord(introWordModels, $('name'));
  layoutWord(endWordModels, $('endName'));
  const availableHudModels = introWordModels.filter(Boolean);
  const maxHudWidth = Math.max(...availableHudModels.map(model => model.width));
  const maxHudHeight = Math.max(...availableHudModels.map(model => model.height));
  hudLetterModels.forEach(model => {
    const rect = model.element.getBoundingClientRect();
    const scale = Math.min(rect.width * .88 / maxHudWidth, rect.height * .76 / maxHudHeight);
    positionDisplayLetter(model, rect.left + rect.width / 2, rect.top + rect.height / 2, scale);
  });
  const showIntro = state === 'intro' && introWordModels.every(Boolean);
  introWordModels.forEach(model => { if (model) model.object.visible = showIntro; });
  const showEnd = $('end').classList.contains('show');
  endWordModels.forEach(model => { if (model) model.object.visible = showEnd && endWordModels.every(Boolean); });
}

function cameraFocus() {
  return P.pos.clone();
}
function cameraFollowTarget() {
  return cameraFocus().add(new THREE.Vector3(Math.sin(P.yaw), 0, Math.cos(P.yaw)).multiplyScalar(8));
}
function followCameraPosition() {
  const distance = cfg.type === 'boat' ? 14 : cfg.type === 'plane' ? 18 : 20;
  const height = cfg.type === 'boat' ? 6 : 6.5;
  return P.pos.clone().add(new THREE.Vector3(-Math.sin(P.yaw) * distance, height, -Math.cos(P.yaw) * distance));
}
function recenterCamera() {
  manualCamera = false;
  cameraDrag = null;
}

/* ---------- HUD ---------- */
function buildHud() {
  const el = $('letters'); el.innerHTML = '';
  hudLetterModels.forEach(model => overlayScene.remove(model.object));
  hudLetterModels.length = 0;
  CONFIG.name.split('').forEach((ch, i) => {
    const s = document.createElement('span'), model = makeDisplayLetter(ch);
    s.textContent = model && found[i] ? '' : found[i] ? ch : '_';
    if (found[i]) s.className = 'on';
    el.appendChild(s);
    if (model) {
      model.object.visible = found[i];
      overlayScene.add(model.object);
      hudLetterModels.push({ ...model, element: s });
    }
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
    morph.list.forEach((o, i) => { o.visible = i === n - 1; o.scale.setScalar(1); o.rotation.set(0, 0, 0); if (i < n - 1) { if (o === logo) o.position.y = 0; holder.remove(o); } });
    const d = morph.done; morph = null; d && d();
  }
}

/* ---------- niveles ---------- */
function startLevel(i) {
  if (i > 0 && !audio.playSound('levelTransition')) beep(740, .35, 'triangle', .12);
  lvl = i; cfg = CONFIG.levels[i]; locked = true;
  clearWorld(); scene.remove(introStars);
  const built = buildWorld(cfg.type, scene, world);
  obstacles = built.obstacles; water = built.water; waterBase = built.waterBase; terrainHeight = built.terrainHeight;
  waterBounds = built.waterBounds;
  P.pos.set(0, cfg.type === 'plane' ? 25 : 0, 0); P.yaw = 0; P.vy = 0; P.speed = cfg.type === 'plane' ? 20 : 0;
  manualCamera = false; cameraDrag = null;
  holder.position.copy(P.pos); holder.rotation.set(0, 0, 0);

  letters = [];
  const pool = [...obstacles].sort(() => Math.random() - .5);
  const isLetterPositionClear = c => {
    if (Math.hypot(c.x - P.pos.x, c.z - P.pos.z) < CONFIG.letterPlayerClearance) return false;
    if (Math.hypot(c.x, c.z) >= MAP_RADIUS - 45) return false;
    if (letters.some(l => Math.hypot(l.pos.x - c.x, l.pos.z - c.z) < CONFIG.letterSpacing)) return false;
    return obstacles.every(q => {
      const d = cfg.type === 'ship' ? q.pos.distanceTo(c) : Math.hypot(q.pos.x - c.x, q.pos.z - c.z);
      return d > q.r + 12;
    });
  };
  const letterHeight = (x, z, obstacle) => cfg.type === 'boat' ? 3
    : cfg.type === 'plane' ? Math.max(rand(25, 60), terrainHeight(x, z) + 12)
      : obstacle.pos.y + rand(-5, 5);
  cfg.letters.forEach((idx, n) => {
    const o = pool[n % pool.length];
    let pos = null;
    for (let tries = 0; tries < 320 && !pos; tries++) {
      const a = rand(0, Math.PI * 2), d = o.r + rand(18, 26 + tries * .65);
      const c = new THREE.Vector3(o.pos.x + Math.cos(a) * d, 0, o.pos.z + Math.sin(a) * d);
      c.y = letterHeight(c.x, c.z, o);
      if (isLetterPositionClear(c)) pos = c;
    }
    for (let tries = 0; tries < 240 && !pos; tries++) {
      const angle = rand(0, Math.PI * 2), distance = rand(MAP_RADIUS * .72, MAP_RADIUS * .9);
      const c = new THREE.Vector3(Math.cos(angle) * distance, 0, Math.sin(angle) * distance);
      const o = pool[n % pool.length];
      c.y = letterHeight(c.x, c.z, o);
      if (isLetterPositionClear(c)) pos = c;
    }
    if (!pos) {
      for (let tries = 0; tries < 64 && !pos; tries++) {
        const angle = n * Math.PI + tries * 2.399963;
        const distance = MAP_RADIUS * .9;
        const c = new THREE.Vector3(Math.cos(angle) * distance, 0, Math.sin(angle) * distance);
        c.y = letterHeight(c.x, c.z, o);
        if (isLetterPositionClear(c)) pos = c;
      }
      if (!pos) {
        const angle = n * Math.PI;
        const distance = MAP_RADIUS - 55;
        pos = new THREE.Vector3(Math.cos(angle) * distance, 0, Math.sin(angle) * distance);
        pos.y = letterHeight(pos.x, pos.z, o);
      }
    }

    const inst = makeLetter(CONFIG.name[idx], assets), halo = haloSprite();
    inst.obj.position.copy(pos); halo.position.copy(pos); world.add(inst.obj, halo);
    letters.push({ idx, inst, halo, pos, got: false });
  });

  buildHud();
  const next = makeVehicle(cfg.type, assets, CONFIG.models.vehicles[cfg.type].offset); next.visible = false;
  const list = vehicle ? [vehicle, logo, next] : [logo, next];
  vehicle = next;
  startMorph(list, () => { locked = false; toast('Explora. Algo brilla ahí fuera…'); });
}

function collect(L) {
  L.got = true; found[L.idx] = true; world.remove(L.inst.obj, L.halo); buildHud();
  if (!audio.playSound('collect')) {
    beep(880, .3); setTimeout(() => beep(1320, .4), 120);
  }
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
  if (state === 'end') return;
  state = 'end'; locked = true;
  const hasFinalMusic = audio.playFinalMusic();
  $('hud').style.opacity = 0;
  startMorph([vehicle, logo], () => {});
  vehicle = null;
  scene.fog = null; scene.background = new THREE.Color(0x05070d);
  clearWorld(); world.add(stars(1500, 500));
  camera.position.set(P.pos.x, P.pos.y, P.pos.z + 32);
  camera.lookAt(P.pos);
  motif = new THREE.Group(); motif.position.copy(P.pos);
  [[3, 0x00f0ff],[3.5, 0x0bda51], [4, 0xffd600], [4.5, 0xe53935]].forEach(([radius, color]) => {
    const ring = new THREE.Mesh(new THREE.TorusGeometry(radius, .16, 12, 100), new THREE.MeshBasicMaterial({ color }));
    motif.add(ring);
  });
  const n = 500, arr = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) { const a = rand(0, 6.28), r = rand(14, 24); arr.set([Math.cos(a) * r, rand(-6, 6), Math.sin(a) * r], i * 3); }
  const gg = new THREE.BufferGeometry(); gg.setAttribute('position', new THREE.BufferAttribute(arr, 3));
  const pts = new THREE.Points(gg, new THREE.PointsMaterial({ color: 0xffd34d, size: .35, transparent: true, opacity: .9 }));
  pts.userData.s = .15; motif.add(pts); world.add(motif);
  if (!audio.playSound('win') && !hasFinalMusic) {
    beep(330, 1.2, 'triangle', .15); setTimeout(() => beep(495, 1.4, 'triangle', .15), 400); setTimeout(() => beep(660, 2, 'triangle', .15), 800);
  }
  setTimeout(() => $('end').classList.add('show'), 2200);
}
$('skipToEnd').addEventListener('click', () => {
  if (state === 'play') endGame();
});
$('replay').onclick = () => location.reload();

/* ---------- inicio (clic en logo/nombre, Enter o código) ---------- */
function begin() {
  if (state !== 'intro') return;
  state = 'play';
  initAudio(); audio.start();
  if (!audio.playSound('start')) beep(440, .4);
  $('intro').style.opacity = 0; $('hud').style.opacity = 1;
  startLevel(0);
}
addEventListener('keydown', e => {
  keys[e.code] = true;
  if (state === 'play' && manualCamera && MOVEMENT_KEYS.has(e.code)) recenterCamera();
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
  if (state === 'intro') {
    ray.setFromCamera(new THREE.Vector2(e.clientX / innerWidth * 2 - 1, -(e.clientY / innerHeight) * 2 + 1), camera);
    if (ray.intersectObject(logo, true).length) begin();
    return;
  }
  if (state !== 'play' || [...MOVEMENT_KEYS].some(code => keys[code])) return;
  const focus = cameraFocus();
  const offset = camera.position.clone().sub(focus);
  cameraOrbit.distance = Math.max(offset.length(), 1);
  cameraOrbit.yaw = Math.atan2(offset.x, offset.z);
  cameraOrbit.pitch = Math.asin(clamp(offset.y / cameraOrbit.distance, -1, 1));
  cameraDrag = { pointerId: e.pointerId, x: e.clientX, y: e.clientY };
  manualCamera = true;
  renderer.domElement.setPointerCapture(e.pointerId);
});
renderer.domElement.addEventListener('pointermove', e => {
  if (!cameraDrag || cameraDrag.pointerId !== e.pointerId || !manualCamera) return;
  cameraOrbit.yaw -= (e.clientX - cameraDrag.x) * .005;
  cameraOrbit.pitch = clamp(cameraOrbit.pitch + (e.clientY - cameraDrag.y) * .005, -.15, 1.25);
  cameraDrag.x = e.clientX; cameraDrag.y = e.clientY;
});
function stopCameraDrag(e) {
  if (cameraDrag && cameraDrag.pointerId === e.pointerId) cameraDrag = null;
}
renderer.domElement.addEventListener('pointerup', stopCameraDrag);
renderer.domElement.addEventListener('pointercancel', stopCameraDrag);
renderer.domElement.addEventListener('lostpointercapture', stopCameraDrag);

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
    if (type === 'plane') {
      const floor = terrainHeight(P.pos.x, P.pos.z) + 6;
      if (P.pos.y < floor && P.vy < 0) P.vy = 0;
      P.pos.y = clamp(P.pos.y, floor, 240);
    } else P.pos.y = clamp(P.pos.y, -80, 80);
  }
  const hl = Math.hypot(P.pos.x, P.pos.z);
  if (hl > MAP_RADIUS) { P.pos.x *= MAP_RADIUS / hl; P.pos.z *= MAP_RADIUS / hl; }
  if (type === 'boat') obstacles.forEach(o => {
    const dx = P.pos.x - o.pos.x, dz = P.pos.z - o.pos.z, d = Math.hypot(dx, dz), m = o.r + 2.5;
    if (d < m) { P.pos.x = o.pos.x + dx / d * m; P.pos.z = o.pos.z + dz / d * m; P.speed *= .9; }
  });

  holder.position.copy(P.pos);
  if (!morph) {
    holder.rotation.set(type === 'boat' ? Math.sin(t * 2) * .03 : -P.vy * .02, P.yaw, P.roll);
    const pr = vehicle && vehicle.getObjectByName('prop'); if (pr) pr.rotation.z += dt * 40;
  } else holder.rotation.y = P.yaw;

  cameraModeBlend += ((manualCamera ? 1 : 0) - cameraModeBlend) * Math.min(1, dt * 2.5);
  const focus = cameraFocus();
  const horizontal = Math.cos(cameraOrbit.pitch) * cameraOrbit.distance;
  const orbitPosition = new THREE.Vector3(
    focus.x + Math.sin(cameraOrbit.yaw) * horizontal,
    focus.y + Math.sin(cameraOrbit.pitch) * cameraOrbit.distance,
    focus.z + Math.cos(cameraOrbit.yaw) * horizontal
  );
  const position = followCameraPosition().lerp(orbitPosition, cameraModeBlend);
  const target = cameraFollowTarget().lerp(focus, cameraModeBlend);
  camera.position.lerp(position, Math.min(1, dt * 4));
  if (waterBounds !== null) {
    camera.position.x = clamp(camera.position.x, -waterBounds, waterBounds);
    camera.position.z = clamp(camera.position.z, -waterBounds, waterBounds);
  }
  camera.lookAt(target);
  const heading = ((Math.round(THREE.MathUtils.radToDeg(P.yaw)) % 360) + 360) % 360;
  $('compassRose').style.transform = `rotate(${P.yaw}rad)`;
  $('compassHeading').textContent = `${String(heading).padStart(3, '0')}°`;

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

  let nearest = Infinity, nearestLetter = null;
  letters.forEach(L => {
    if (L.got) return;
    const d = L.pos.distanceTo(P.pos);
    if (d < nearest) { nearest = d; nearestLetter = L; }
    L.inst.setOpacity(clamp(1 - (d - 12) / 33, 0, 1));
    const farGlow = clamp((d - 20) / 45, 0, 1) * clamp((520 - d) / 100, 0, 1);
    L.halo.material.opacity = farGlow * (.65 + .35 * Math.sin(t * 4 + L.idx)) * .9;
    L.inst.obj.position.y = L.pos.y + Math.sin(t * 2 + L.idx) * .5;
    L.halo.position.y = L.inst.obj.position.y;
    if (L.inst.spins) L.inst.obj.rotation.y += dt * .8;
    if (!locked && d < CONFIG.collectRadius) collect(L);
  });
  const compassPointer = $('compassPointer');
  if (nearestLetter) {
    const midpointX = (P.pos.x + nearestLetter.pos.x) * .5;
    const midpointZ = (P.pos.z + nearestLetter.pos.z) * .5;
    const dx = midpointX - P.pos.x, dz = midpointZ - P.pos.z;
    const cosYaw = Math.cos(P.yaw), sinYaw = Math.sin(P.yaw);
    const localX = dx * cosYaw - dz * sinYaw;
    const localZ = dx * sinYaw + dz * cosYaw;
    const bearing = Math.atan2(-localX, localZ);
    compassPointer.style.transform = `rotate(${bearing}rad)`;
    compassPointer.style.opacity = 1;
  } else {
    compassPointer.style.transform = 'rotate(0rad)';
    compassPointer.style.opacity = .35;
  }
}
renderer.setAnimationLoop(() => {
  update(Math.min(clock.getDelta(), .05), clock.elapsedTime);
  layoutDisplayLetters();
  renderer.clear();
  renderer.render(scene, camera);
  renderer.clearDepth();
  renderer.render(overlayScene, overlayCamera);
});
