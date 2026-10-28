import * as THREE from 'three';
import { clamp, mat, rand, ringPos, stars } from './utils.js';

export const MAP_RADIUS = 800;
const WATER_SIZE = 2000;

function hash2(x, z, seed) {
  const value = Math.sin(x * 127.1 + z * 311.7 + seed * 74.7) * 43758.5453;
  return value - Math.floor(value);
}

function noise2(x, z, seed) {
  const ix = Math.floor(x), iz = Math.floor(z);
  const fx = x - ix, fz = z - iz;
  const sx = fx * fx * (3 - 2 * fx), sz = fz * fz * (3 - 2 * fz);
  return THREE.MathUtils.lerp(
    THREE.MathUtils.lerp(hash2(ix, iz, seed), hash2(ix + 1, iz, seed), sx),
    THREE.MathUtils.lerp(hash2(ix, iz + 1, seed), hash2(ix + 1, iz + 1, seed), sx),
    sz
  );
}

function fbm(x, z, seed = 1) {
  let value = 0, amplitude = .5, total = 0;
  for (let octave = 0; octave < 4; octave++) {
    value += noise2(x, z, seed + octave * 13) * amplitude;
    total += amplitude; amplitude *= .5; x *= 2; z *= 2;
  }
  return value / total;
}

export function groundHeight(x, z) {
  return Math.max(0, (fbm(x * .008, z * .008, 4) - .43) * 100);
}

function terrainWithMountains(x, z, peaks) {
  const base = groundHeight(x, z);
  let height = base;
  for (const peak of peaks) {
    const distance = Math.hypot(x - peak.x, z - peak.z);
    const influence = clamp(1 - distance / peak.radius, 0, 1);
    const smooth = influence * influence * (3 - 2 * influence);
    height = Math.max(height, base + peak.height * smooth);
  }
  return height;
}

function makeTerrain(size, segments, heightAt) {
  const geometry = new THREE.PlaneGeometry(size, size, segments, segments);
  geometry.rotateX(-Math.PI / 2);
  const positions = geometry.attributes.position;
  const colors = new Float32Array(positions.count * 3);
  const low = new THREE.Color(0x4f8050), rock = new THREE.Color(0x898c7d), snow = new THREE.Color(0xe4eceb);
  const color = new THREE.Color();
  for (let i = 0; i < positions.count; i++) {
    const height = heightAt(positions.getX(i), positions.getZ(i));
    positions.setY(i, height);
    color.copy(low).lerp(rock, clamp(height / 55, 0, 1));
    if (height > 42) color.lerp(snow, clamp((height - 42) / 45, 0, .9));
    colors.set([color.r, color.g, color.b], i * 3);
  }
  geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  geometry.computeVertexNormals();
  return new THREE.Mesh(geometry, new THREE.MeshStandardMaterial({ vertexColors: true, flatShading: true, roughness: 1 }));
}

function islandSurfaceY(radius, height, x, z) {
  const distance = Math.hypot(x, z) / radius;
  return height * Math.sqrt(Math.max(0, 1 - distance * distance));
}

function addTree(group, radius, height, x, z, scale) {
  const tree = new THREE.Group();
  const trunkHeight = 4.5 * scale;
  const trunk = new THREE.Mesh(new THREE.CylinderGeometry(.28 * scale, .42 * scale, trunkHeight, 6), mat(0x76513a));
  trunk.position.y = trunkHeight / 2;
  tree.add(trunk);
  for (let tier = 0; tier < 3; tier++) {
    const crownHeight = (4.4 - tier * .3) * scale;
    const crown = new THREE.Mesh(new THREE.ConeGeometry((2.8 - tier * .55) * scale, crownHeight, 7), mat(tier === 0 ? 0x376f46 : 0x4b8a4c));
    crown.position.y = trunkHeight * .65 + tier * 1.45 * scale;
    tree.add(crown);
  }
  tree.position.set(x, islandSurfaceY(radius, height, x, z), z);
  group.add(tree);
}

function addIsland(world, obstacles, x, z, populated) {
  const group = new THREE.Group();
  const radius = rand(11, 25), height = rand(8, 18);
  const ground = new THREE.SphereGeometry(1, 16, 10);
  const positions = ground.attributes.position;
  const colors = new Float32Array(positions.count * 3);
  const shore = new THREE.Color(0xa58c61), grass = new THREE.Color(0x57834e), highGrass = new THREE.Color(0x78a45b);
  const color = new THREE.Color();
  for (let i = 0; i < positions.count; i++) {
    const y = positions.getY(i);
    color.copy(shore).lerp(grass, clamp((y - .02) / .2, 0, 1));
    if (y > .35) color.lerp(highGrass, clamp((y - .35) / .65, 0, .7));
    colors.set([color.r, color.g, color.b], i * 3);
  }
  ground.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  ground.computeVertexNormals();
  const land = new THREE.Mesh(ground, new THREE.MeshStandardMaterial({ vertexColors: true, flatShading: true, roughness: 1 }));
  land.scale.set(radius, height, radius);
  group.add(land);

  if (populated) {
    for (let i = 0; i < 3; i++) {
      const house = new THREE.Group();
      const base = new THREE.Mesh(new THREE.BoxGeometry(4, 3, 4), mat(i % 2 ? 0xf0d6a5 : 0xe9e1c5));
      const roof = new THREE.Mesh(new THREE.ConeGeometry(3.2, 2.5, 4), mat(i % 2 ? 0xb9513d : 0x385d65));
      base.position.y = 1.5; roof.position.y = 4.25; house.add(base, roof);
      const hx = (i - 1) * radius * .25, hz = (i % 2 ? 1 : -1) * radius * .2;
      house.position.set(hx, islandSurfaceY(radius, height, hx, hz), hz);
      group.add(house);
    }
    const dock = new THREE.Mesh(new THREE.BoxGeometry(3, .35, 18), mat(0x76513a));
    const dockZ = radius * .48;
    dock.position.set(0, islandSurfaceY(radius, height, 0, dockZ) + .1, dockZ + 7); group.add(dock);
    const lighthouse = new THREE.Group();
    const tower = new THREE.Mesh(new THREE.CylinderGeometry(1.2, 1.8, 10, 8), mat(0xe8e5d7));
    const top = new THREE.Mesh(new THREE.ConeGeometry(2, 3, 8), mat(0xc74639));
    tower.position.y = 5; top.position.y = 11.5; lighthouse.add(tower, top);
    const lx = -radius * .38, lz = -radius * .2;
    lighthouse.position.set(lx, islandSurfaceY(radius, height, lx, lz), lz); group.add(lighthouse);
    addTree(group, radius, height, radius * .36, radius * .28, .8);
  } else {
    for (let i = 0; i < 3; i++) {
      const tx = rand(-radius * .48, radius * .48), tz = rand(-radius * .48, radius * .48);
      addTree(group, radius, height, tx, tz, rand(.7, 1.1));
    }
  }

  group.position.set(x, 0, z); world.add(group);
  obstacles.push({ pos: new THREE.Vector3(x, 0, z), r: radius * .9 });
}

function makeGalaxy(colorHex) {
  const count = 1300, positions = new Float32Array(count * 3);
  for (let i = 0; i < count; i++) {
    const radius = Math.pow(Math.random(), .7) * 38;
    const arm = (i % 4) * Math.PI / 2;
    const angle = arm + radius * .075 + rand(-.22, .22);
    positions.set([Math.cos(angle) * radius, rand(-1.5, 1.5) * (1 - radius / 48), Math.sin(angle) * radius], i * 3);
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  const cloud = new THREE.Points(geometry, new THREE.PointsMaterial({ color: colorHex, size: 2, transparent: true, opacity: .8, depthWrite: false }));
  const core = new THREE.Mesh(new THREE.SphereGeometry(3.2, 12, 8), mat(0xffe6b2, 1.3));
  const galaxy = new THREE.Group(); galaxy.add(cloud, core);
  return galaxy;
}

/* Construye el escenario del nivel dentro de `world`.
   Devuelve los obstáculos (para colocar letras y colisiones) y el agua si hay. */
export function buildWorld(type, scene, world) {
  const obstacles = [];
  let water = null, waterBase = null, waterBounds = null;
  let terrainHeight = groundHeight;

  if (type === 'boat') {
    scene.background = new THREE.Color(0x87c6e8); scene.fog = new THREE.Fog(0x87c6e8, 80, 1050);
    const geo = new THREE.PlaneGeometry(WATER_SIZE, WATER_SIZE, 120, 120); geo.rotateX(-Math.PI / 2);
    water = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ color: 0x1e6fa8, flatShading: true, roughness: .4 }));
    waterBase = geo.attributes.position.array.slice();
    waterBounds = WATER_SIZE / 2 - 30;
    world.add(water);
    for (let i = 0; i < 42; i++) {
      const [x, z] = ringPos(60, MAP_RADIUS - 20);
      addIsland(world, obstacles, x, z, i % 6 === 0);
    }
  } else if (type === 'plane') {
    scene.background = new THREE.Color(0x9fd8ff); scene.fog = new THREE.Fog(0x9fd8ff, 100, 1200);
    const peaks = [];
    for (let i = 0; i < 32; i++) {
      const [x, z] = ringPos(100, MAP_RADIUS - 110);
      peaks.push({ x, z, radius: rand(48, 96), height: rand(55, 145) });
    }
    const heightAt = (x, z) => terrainWithMountains(x, z, peaks);
    terrainHeight = heightAt;
    world.add(makeTerrain(2200, 140, heightAt));
    peaks.forEach(peak => {
      obstacles.push({
        pos: new THREE.Vector3(peak.x, heightAt(peak.x, peak.z), peak.z),
        r: peak.radius,
        terrain: true
      });
    });
    for (let i = 0; i < 38; i++) {
      const [x, z] = ringPos(40, MAP_RADIUS - 15), y = rand(30, 95), c = new THREE.Group();
      for (let k = 0; k < 4; k++) {
        const s = new THREE.Mesh(new THREE.SphereGeometry(rand(4, 7), 10, 8), new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 1 }));
        s.position.set(rand(-6, 6), rand(-1, 2), rand(-5, 5)); c.add(s);
      }
      c.position.set(x, y, z); world.add(c); obstacles.push({ pos: new THREE.Vector3(x, y, z), r: 8 });
    }
  } else {
    scene.background = new THREE.Color(0x02030a); scene.fog = null;
    world.add(stars(4200, 1200));
    for (let i = 0; i < 78; i++) {
      const [x, z] = ringPos(45, MAP_RADIUS - 20), y = rand(-60, 60), r = rand(3, 13);
      const a = new THREE.Mesh(new THREE.IcosahedronGeometry(r, 0), mat(new THREE.Color().setHSL(.08, .1, rand(.25, .5)).getHex()));
      a.position.set(x, y, z); a.userData.spin = new THREE.Vector3(rand(-.3, .3), rand(-.3, .3), rand(-.3, .3));
      world.add(a); obstacles.push({ pos: new THREE.Vector3(x, y, z), r, mesh: a });
    }
    const galaxyColors = [0x9fd5ff, 0xffc7a6, 0xc6b4ff, 0x8fffd4];
    for (let i = 0; i < galaxyColors.length; i++) {
      const [x, z] = ringPos(150, MAP_RADIUS - 30), galaxy = makeGalaxy(galaxyColors[i]);
      galaxy.position.set(x, rand(-48, 48), z); galaxy.rotation.x = rand(-.7, .7); galaxy.rotation.z = rand(-.7, .7);
      world.add(galaxy); obstacles.push({ pos: galaxy.position.clone(), r: 46 });
    }
    const planetColors = [0x4c8dbb, 0xc87954, 0x98a86d, 0x9b7bbb, 0xd5ad73];
    for (let i = 0; i < 12; i++) {
      const [x, z] = ringPos(70, MAP_RADIUS - 15), y = rand(-75, 75), r = rand(8, 22);
      const planet = new THREE.Group();
      const globe = new THREE.Mesh(new THREE.SphereGeometry(r, 16, 12), mat(planetColors[i % planetColors.length], .12));
      planet.add(globe);
      if (i % 3 === 0) {
        const ring = new THREE.Mesh(new THREE.TorusGeometry(r * 1.45, r * .12, 6, 32), mat(0xc9c1ad, .08));
        ring.rotation.x = Math.PI / 2.5; planet.add(ring);
      }
      planet.position.set(x, y, z); world.add(planet);
      obstacles.push({ pos: planet.position.clone(), r: r * 1.4 });
    }
  }
  return { obstacles, water, waterBase, waterBounds, terrainHeight };
}
