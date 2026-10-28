import * as THREE from 'three';
import { FBXLoader } from 'three/addons/loaders/FBXLoader.js';
import { MATTE_RED, mat } from './utils.js';

const loader = new FBXLoader();
const load = url => new Promise((res, rej) => loader.load(url, res, undefined, rej));

/* Centra el modelo en el origen, lo escala a `size` y aplica la rotación de corrección.
   Devuelve outer > inner > modelo: `outer` es el que anima el juego (escala/rotación),
   `inner` guarda la escala de normalización. */
function normalize(obj, size, rotDeg = [0, 0, 0], offset = [0, 0, 0], fit = 'max') {
  obj.rotation.set(...rotDeg.map(d => d * Math.PI / 180));
  obj.traverse(m => {
    if (!m.isMesh) return;
    (Array.isArray(m.material) ? m.material : [m.material]).forEach(x => { x.side = THREE.DoubleSide; });
  });
  const inner = new THREE.Group(); inner.add(obj);
  inner.updateMatrixWorld(true);
  const box = new THREE.Box3().setFromObject(obj);
  const dims = box.getSize(new THREE.Vector3());
  const center = box.getCenter(new THREE.Vector3());
  obj.position.sub(center);
  const dimension = fit === 'height' ? dims.y : Math.max(dims.x, dims.y, dims.z);
  inner.scale.setScalar(size / (dimension || 1));
  const outer = new THREE.Group(); outer.add(inner); outer.position.set(...offset);
  return outer;
}

/* Carga el logo y las letras. Lo que falle queda en `missing` y se usa un reemplazo. */
export async function loadAssets(CONFIG, onProgress = () => {}) {
  const { logo, letters, vehicles } = CONFIG.models;
  const chars = [...new Set(CONFIG.name.split(''))];
  const jobs = [
    { key: 'logo', url: logo.url, cfg: logo },
    ...chars.map(ch => ({ key: ch, url: letters.dir + ch + letters.ext, cfg: letters, group: 'letters', scale: letters.scale?.[ch] ?? 1 })),
    ...Object.entries(vehicles).map(([key, cfg]) => ({ key, url: cfg.url, cfg, group: 'vehicles' }))
  ];
  const assets = { logo: null, letters: {}, vehicles: {}, missing: [] };
  let done = 0;
  await Promise.all(jobs.map(async j => {
    try {
      const model = normalize(await load(j.url), j.cfg.size, j.cfg.rotation, j.cfg.offset, j.cfg.fit);
      model.scale.multiplyScalar(j.scale ?? 1);
      if (j.key === 'logo') assets.logo = model;
      else assets[j.group][j.key] = model;
    } catch (e) {
      console.warn('No se pudo cargar', j.url, e);
      assets.missing.push(j.url);
    }
    onProgress(++done, jobs.length);
  }));
  return assets;
}

/* ---------- reemplazos si falta algún archivo ---------- */
export function fallbackLogo() {
  const g = new THREE.Group();
  g.add(new THREE.Mesh(new THREE.TorusGeometry(1.4, .22, 16, 48), mat(0xffd34d, .4)));
  g.add(new THREE.Mesh(new THREE.OctahedronGeometry(.8), mat(0xffffff, .3)));
  return g;
}

function textSprite(ch) {
  const c = document.createElement('canvas'); c.width = c.height = 128;
  const x = c.getContext('2d');
  x.shadowColor = '#c62828'; x.shadowBlur = 18; x.fillStyle = '#c62828';
  x.font = 'bold 84px system-ui, sans-serif'; x.textAlign = 'center'; x.textBaseline = 'middle';
  x.fillText(ch, 64, 68);
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: new THREE.CanvasTexture(c), transparent: true, opacity: 0, depthWrite: false, fog: false }));
  s.scale.set(7, 7, 1);
  return s;
}

/* Instancia de una letra para el mundo: { obj, setOpacity(v), spins } */
export function makeLetter(ch, assets) {
  const src = assets.letters[ch];
  if (!src) {
    const obj = textSprite(ch);
    return { obj, spins: false, setOpacity: v => { obj.material.opacity = v; } };
  }
  const obj = src.clone(true);
  const mats = [];
  obj.traverse(m => {
    if (!m.isMesh) return;
    const list = (Array.isArray(m.material) ? m.material : [m.material]).map(() => {
      const c = MATTE_RED.clone();
      c.transparent = true; c.opacity = 0; c.fog = false;
      mats.push(c);
      return c;
    });
    m.material = Array.isArray(m.material) ? list : list[0];
  });
  obj.visible = false;
  return {
    obj, spins: true,
    setOpacity(v) { mats.forEach(m => { m.opacity = v; }); obj.visible = v > .01; }
  };
}
