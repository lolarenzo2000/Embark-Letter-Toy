import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { FBXLoader } from 'three/addons/loaders/FBXLoader.js';

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

const fLoader = new FBXLoader();


//logo
const logo = await fLoader.loadAsync('./models/letters/logo.fbx')
logo.scale.setScalar(0.01);
logo.traverse((child) => {
  if (child.isMesh){
    child.castShadow = true;
    child.receiveShadow = true;
  }
});
logo.position.x = -7;
scene.add( logo )


// modelo letras
const e = await fLoader.loadAsync( './models/letters/e.fbx' );
e.scale.setScalar( 0.01 );
e.traverse( ( child ) => {
  if ( child.isMesh ) {
    child.castShadow = true;
    child.receiveShadow = true;
  }
} );
e.position.x = -4.8;
scene.add( e );

const m = await fLoader.loadAsync( './models/letters/m.fbx' );
m.scale.setScalar( 0.01 );
m.traverse( ( child ) => {
  if ( child.isMesh ) {
    child.castShadow = true;
    child.receiveShadow = true;
  }
} );
m.position.x = -2.8;
scene.add( m );

const b = await fLoader.loadAsync( './models/letters/b.fbx' );
b.scale.setScalar( 0.01 );
b.traverse( ( child ) => {
  if ( child.isMesh ) {
    child.castShadow = true;
    child.receiveShadow = true;
  }
} );
b.position.x = -0.9;
scene.add( b );


const a = await fLoader.loadAsync( './models/letters/a.fbx' );
a.scale.setScalar( 0.01 );
a.traverse( ( child ) => {
  if ( child.isMesh ) {
    child.castShadow = true;
    child.receiveShadow = true;
  }
} );
a.position.x = 0.8;
scene.add( a );

const r = await fLoader.loadAsync( './models/letters/r.fbx' );
r.scale.setScalar( 0.01 );
r.traverse( ( child ) => {
  if ( child.isMesh ) {
    child.castShadow = true;
    child.receiveShadow = true;
  }
} );
r.position.x = 2;
scene.add( r );

const k = await fLoader.loadAsync( './models/letters/k.fbx' );
k.scale.setScalar( 0.01 );
k.traverse( ( child ) => {
  if ( child.isMesh ) {
    child.castShadow = true;
    child.receiveShadow = true;
  }
} );
k.position.x = 3.2;
scene.add( k );

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