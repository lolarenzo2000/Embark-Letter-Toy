import * as THREE from 'three';
import { mat, rand, ringPos, stars } from './utils.js';

/* Construye el escenario del nivel dentro de `world`.
   Devuelve los obstáculos (para colocar letras y colisiones) y el agua si hay. */
export function buildWorld(type, scene, world) {
  const obstacles = [];
  let water = null, waterBase = null;

  if (type === 'boat') {
    scene.background = new THREE.Color(0x87c6e8); scene.fog = new THREE.Fog(0x87c6e8, 60, 380);
    const geo = new THREE.PlaneGeometry(900, 900, 90, 90); geo.rotateX(-Math.PI / 2);
    water = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ color: 0x1e6fa8, flatShading: true, roughness: .4 }));
    waterBase = geo.attributes.position.array.slice();
    world.add(water);
    for (let i = 0; i < 16; i++) {
      const [x, z] = ringPos(45, 230), r = rand(6, 14), h = rand(6, 14);
      const isl = new THREE.Mesh(new THREE.ConeGeometry(r, h, 7), mat(0x8a6a4a)); isl.position.set(x, h / 2 - 2, z);
      const top = new THREE.Mesh(new THREE.ConeGeometry(r * .65, h * .5, 7), mat(0x3f8f4f)); top.position.set(x, h * .8 - 2, z);
      world.add(isl, top); obstacles.push({ pos: new THREE.Vector3(x, 0, z), r });
    }
  } else if (type === 'plane') {
    scene.background = new THREE.Color(0x9fd8ff); scene.fog = new THREE.Fog(0x9fd8ff, 80, 420);
    world.add(new THREE.Mesh(new THREE.PlaneGeometry(900, 900).rotateX(-Math.PI / 2), mat(0x4a8a4a)));
    for (let i = 0; i < 18; i++) {
      const [x, z] = ringPos(30, 240), r = rand(15, 30), h = rand(10, 35);
      const hill = new THREE.Mesh(new THREE.ConeGeometry(r, h, 6), mat(0x5d7a45)); hill.position.set(x, h / 2, z);
      world.add(hill); obstacles.push({ pos: new THREE.Vector3(x, h, z), r: r * .6 });
    }
    for (let i = 0; i < 20; i++) {
      const [x, z] = ringPos(40, 240), y = rand(25, 70), c = new THREE.Group();
      for (let k = 0; k < 4; k++) {
        const s = new THREE.Mesh(new THREE.SphereGeometry(rand(4, 7), 10, 8), new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 1 }));
        s.position.set(rand(-6, 6), rand(-1, 2), rand(-5, 5)); c.add(s);
      }
      c.position.set(x, y, z); world.add(c); obstacles.push({ pos: new THREE.Vector3(x, y, z), r: 8 });
    }
  } else {
    scene.background = new THREE.Color(0x02030a); scene.fog = null;
    world.add(stars(1800, 600));
    for (let i = 0; i < 26; i++) {
      const [x, z] = ringPos(35, 230), y = rand(-45, 45), r = rand(3, 10);
      const a = new THREE.Mesh(new THREE.IcosahedronGeometry(r, 0), mat(new THREE.Color().setHSL(.08, .1, rand(.25, .5)).getHex()));
      a.position.set(x, y, z); a.userData.spin = new THREE.Vector3(rand(-.3, .3), rand(-.3, .3), rand(-.3, .3));
      world.add(a); obstacles.push({ pos: new THREE.Vector3(x, y, z), r, mesh: a });
    }
  }
  return { obstacles, water, waterBase };
}
