import * as THREE from 'three';
import { OrbitControls } from './three/addons/controls/OrbitControls.js';
import { FBXLoader } from './three/addons/loaders/FBXLoader.js';

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera( 75, window.innerWidth / window.innerHeight, 0.1, 1000 );

const renderer = new THREE.WebGLRenderer( { antialias: true } );
renderer.setSize( window.innerWidth, window.innerHeight );
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
document.body.appendChild( renderer.domElement );

// luces
scene.add( new THREE.AmbientLight( 0xffffff, 0.5 ) );

const dirLight = new THREE.DirectionalLight( 0xffffff, 3 );
dirLight.position.set( 1, 2, 3 );
dirLight.castShadow = true;
dirLight.shadow.mapSize.set( 2048, 2048 );
dirLight.shadow.camera.left = -5;
dirLight.shadow.camera.right = 5;
dirLight.shadow.camera.top = 5;
dirLight.shadow.camera.bottom = -5;
scene.add( dirLight );

// suelo
const floor = new THREE.Mesh(
  new THREE.PlaneGeometry( 1, 1 ),
  new THREE.MeshPhongMaterial( { color: 0xffff00 } )
);
floor.rotation.x = -Math.PI / 2;
floor.scale.setScalar( 200 );
floor.receiveShadow = true;
scene.add( floor );

// modelo letras
const fLoader = new FBXLoader();
const e = await fLoader.loadAsync( 'models/letters/e.fbx' );
e.scale.setScalar( 0.01 );
e.traverse( ( child ) => {
  if ( child.isMesh ) {
    child.castShadow = true;
    child.receiveShadow = true;
  }
} );
scene.add( e );

// control de cámara
const controls = new OrbitControls( camera, renderer.domElement );
camera.position.set( 0, 1, 5 );
controls.minDistance = 2;
controls.maxDistance = 10;
controls.maxPolarAngle = Math.PI / 2 - 0.05;
controls.update();

function animate() {
  controls.update();
  renderer.render( scene, camera );
}

// al final, cuando todo ya existe
renderer.setAnimationLoop( animate );