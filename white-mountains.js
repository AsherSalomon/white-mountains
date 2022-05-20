
import * as THREE from 'three';
import * as Controls from './controls.js';
import * as Terrain from './terrain.js';
import * as Physics from './physics.js';

let scene, renderer, camera;

// 1 micrometer to 100 billion light years in one scene, with 1 unit = 1 meter?  preposterous!  and yet...
const NEAR = 1e-6, FAR = 1e27;

Ammo().then( function ( AmmoLib ) {

	Ammo = AmmoLib;

	init();
	animate();

} );

function init() {

	Terrain.init();

	Physics.genHeight();

	initGraphics();

	Physics.initPhysics();

}

function initGraphics() {

	const container = document.getElementById( 'container' );

  scene = new THREE.Scene();

	// const size = 10;
	// const divisions = 10;
	// const gridHelper = new THREE.GridHelper( size, divisions );
	// scene.add( gridHelper );

	camera = new THREE.PerspectiveCamera( 45, window.innerWidth / window.innerHeight, NEAR, FAR );
	camera.position.set( 0, 9144, 9144 ); // 9144m is 30000ft
	camera.lookAt( 0, 0, 0 );
	scene.add( camera );

	const light = new THREE.AmbientLight( 0x404040 ); // soft white light
	scene.add( light );


	renderer = new THREE.WebGLRenderer( { antialias: true, logarithmicDepthBuffer: true } );
	renderer.setSize( window.innerWidth, window.innerHeight );
	container.appendChild( renderer.domElement );

	window.addEventListener( 'resize', onWindowResize );

	renderer.domElement.style.touchAction = 'none';

	Controls.init( scene, camera );

	Physics.init( scene );

}

function onWindowResize() {

	camera.aspect = window.innerWidth / window.innerHeight;
	camera.updateProjectionMatrix();

	renderer.setSize( window.innerWidth, window.innerHeight );

}

function animate() {

  requestAnimationFrame( animate );

	Physics.render( scene );

	renderer.render( scene, camera );

	Controls.animate( camera );

}
