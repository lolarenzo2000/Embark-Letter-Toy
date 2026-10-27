import * as THREE from 'three';

export const $ = id => document.getElementById(id);
export const rand = (a, b) => a + Math.random() * (b - a);
export const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

export const mat = (c, e = 0) =>
  new THREE.MeshStandardMaterial({ color: c, roughness: .5, metalness: .3, emissive: c, emissiveIntensity: e });

export function stars(n, radius) {
  const p = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) {
    const v = new THREE.Vector3().randomDirection().multiplyScalar(radius * rand(.5, 1));
    p.set([v.x, v.y, v.z], i * 3);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(p, 3));
  return new THREE.Points(g, new THREE.PointsMaterial({ color: 0xffffff, size: 1.4, sizeAttenuation: false }));
}

export const waveFn = (x, z, t) => Math.sin(x * .05 + t) * .6 + Math.cos(z * .07 + t * 1.3) * .5;
export const ringPos = (min, max) => { const a = rand(0, Math.PI * 2), d = rand(min, max); return [Math.cos(a) * d, Math.sin(a) * d]; };

/* ---------- audio ---------- */
let ac = null;
export function initAudio() { ac = new (window.AudioContext || window.webkitAudioContext)(); }
export function beep(f = 660, d = .25, type = 'sine', v = .12) {
  if (!ac) return;
  const o = ac.createOscillator(), g = ac.createGain();
  o.type = type; o.frequency.value = f; g.gain.value = v;
  g.gain.exponentialRampToValueAtTime(.0001, ac.currentTime + d);
  o.connect(g).connect(ac.destination); o.start(); o.stop(ac.currentTime + d);
}
