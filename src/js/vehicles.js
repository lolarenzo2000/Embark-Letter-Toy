import * as THREE from 'three';
import { applyMatteRed, mat } from './utils.js';

/* Modelos FBX si están disponibles; las geometrías sirven como reemplazo temporal. */
export function makeVehicle(type, assets, offset = [0, 0, 0]) {
  if (assets.vehicles[type]) return applyMatteRed(assets.vehicles[type].clone(true));

  const g = new THREE.Group();
  if (type === 'boat') {
    const hull = new THREE.Mesh(new THREE.BoxGeometry(1.6, .7, 4), mat(0xb5532f));
    const bow = new THREE.Mesh(new THREE.ConeGeometry(1.13, 1.6, 4), mat(0xb5532f));
    bow.rotation.set(Math.PI / 2, 0, Math.PI / 4); bow.position.z = 2.8;
    const mast = new THREE.Mesh(new THREE.CylinderGeometry(.06, .06, 3.6), mat(0x553322)); mast.position.y = 2;
    const sail = new THREE.Mesh(new THREE.ConeGeometry(1.3, 3, 3), mat(0xffffff, .15));
    sail.scale.z = .05; sail.position.set(0, 2.3, -.2); sail.rotation.y = Math.PI / 2;
    g.add(hull, bow, mast, sail);
  } else if (type === 'plane') {
    const body = new THREE.Mesh(new THREE.CapsuleGeometry(.5, 3, 6, 12), mat(0xe9eef5));
    body.rotation.x = Math.PI / 2;
    const wing = new THREE.Mesh(new THREE.BoxGeometry(6.4, .12, 1.3), mat(0xff6b3d)); wing.position.z = .2;
    const tail = new THREE.Mesh(new THREE.BoxGeometry(2.2, .1, .8), mat(0xff6b3d)); tail.position.z = -2;
    const fin = new THREE.Mesh(new THREE.BoxGeometry(.1, 1.1, .9), mat(0xff6b3d)); fin.position.set(0, .6, -2);
    const prop = new THREE.Mesh(new THREE.BoxGeometry(2.2, .08, .1), mat(0x222222)); prop.position.z = 2.1; prop.name = 'prop';
    g.add(body, wing, tail, fin, prop);
  } else {
    const body = new THREE.Mesh(new THREE.ConeGeometry(.9, 4, 12), mat(0xcfd8e6, .1));
    body.rotation.x = Math.PI / 2; body.position.z = .5;
    for (let i = 0; i < 3; i++) {
      const f = new THREE.Mesh(new THREE.BoxGeometry(.12, 1.4, 1.4), mat(0x4dd0ff, .5));
      const a = i * Math.PI * 2 / 3; f.position.set(Math.sin(a) * .9, Math.cos(a) * .9, -1.2); f.rotation.z = -a;
      g.add(f);
    }
    const eng = new THREE.Mesh(new THREE.SphereGeometry(.55, 12, 12), mat(0x4dd0ff, 2)); eng.position.z = -1.7;
    g.add(body, eng);
  }
  g.position.set(...offset);
  return applyMatteRed(g);
}
