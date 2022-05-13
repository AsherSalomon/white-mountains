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
	scene.background = new THREE.Color( 0x000000 );
	scene.fog = new THREE.Fog( 0x000000, 10, 50 );
	const hemiLight = new THREE.HemisphereLight( 0xffffff, 0x444444 );
	hemiLight.position.set( 0, 20, 0 );
	scene.add( hemiLight );

	const mesh = new THREE.Mesh( new THREE.PlaneGeometry( 100, 100 ), new THREE.MeshPhongMaterial( { color: 0xffffff, depthWrite: false } ) );
	mesh.rotation.x = - Math.PI / 2;
	scene.add( mesh );

	camera = new THREE.PerspectiveCamera( 45, window.innerWidth / window.innerHeight, NEAR, FAR );
	camera.position.set( 1, 2, - 3 );
	scene.add( camera );

  controls = new PointerLockControls( camera, document.body );
  document.body.addEventListener( 'click', function () {
    if ( controls.isLocked ) {
      controls.unlock();
    } else {
      controls.lock();
    }
  });
  
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
	renderer.setSize( window.innerWidth, window.innerHeight );
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
