import * as THREE from 'three';
import { PointerLockControls } from './lib/PointerLockControls.js';

var moveForward = false;
var moveBackward = false;
var moveLeft = false;
var moveRight = false;
var moveUp = false;
var moveDown = false;

let scene, renderer, camera, controls;

// 1 micrometer to 100 billion light years in one scene, with 1 unit = 1 meter?  preposterous!  and yet...
const NEAR = 1e-6, FAR = 1e27;

init();
animate();

function init() {

	const container = document.getElementById( 'container' );

  scene = new THREE.Scene();
	scene.background = new THREE.Color( 0xa0a0a0 );
	scene.fog = new THREE.Fog( 0xa0a0a0, 10, 50 );
	const hemiLight = new THREE.HemisphereLight( 0xffffff, 0x444444 );
	hemiLight.position.set( 0, 20, 0 );
	scene.add( hemiLight );

	const dirLight = new THREE.DirectionalLight( 0xffffff );
	dirLight.position.set( - 3, 10, - 10 );
	dirLight.castShadow = true;
	dirLight.shadow.camera.top = 2;
	dirLight.shadow.camera.bottom = - 2;
	dirLight.shadow.camera.left = - 2;
	dirLight.shadow.camera.right = 2;
	dirLight.shadow.camera.near = 0.1;
	dirLight.shadow.camera.far = 40;
	scene.add( dirLight );

	const mesh = new THREE.Mesh( new THREE.PlaneGeometry( 100, 100 ), new THREE.MeshPhongMaterial( { color: 0x999999, depthWrite: false } ) );
	mesh.rotation.x = - Math.PI / 2;
	mesh.receiveShadow = true;
	scene.add( mesh );

	camera = new THREE.PerspectiveCamera( 45, window.innerWidth / window.innerHeight, NEAR, FAR );
	scene.add( camera );

  controls = new PointerLockControls( camera, document.body );
  document.body.addEventListener( 'click', function () {
    if ( controls.isLocked ) {
      controls.unlock();
    } else {
      controls.lock();
    }
  });
  // document.body.addEventListener( 'mousemove', mouseSteering);
  scene.add( controls.getObject() );
  var onKeyDown = function ( event ) {
    switch ( event.keyCode ) {
      case 87: moveForward = true; break; // w
      case 65: moveLeft = true; break; // a
      case 83: moveBackward = true; break; // s
      case 68: moveRight = true; break; // d
      case 32: moveUp = true; break; // space
      case 16: moveDown = true; break; // shift
    }
  };
  var onKeyUp = function ( event ) {
    switch ( event.keyCode ) {
      case 87: moveForward = false; break; // w
      case 65: moveLeft = false; break; // a
      case 83: moveBackward = false; break; // s
      case 68: moveRight = false; break; // d
      case 32: moveUp = false; break; // space
      case 16: moveDown = false; break; // shift
    }
  };
  document.addEventListener( 'keydown', onKeyDown, false );
  document.addEventListener( 'keyup', onKeyUp, false );

	renderer = new THREE.WebGLRenderer( { antialias: true, logarithmicDepthBuffer: true } );
	container.appendChild( renderer.domElement );
}

function onWindowResize() {

	camera.aspect = window.innerWidth / window.innerHeight;
	camera.updateProjectionMatrix();

	renderer.setSize( window.innerWidth, window.innerHeight );

}

function animate() {

  requestAnimationFrame( animate );
	renderer.render( scene, camera );

}
