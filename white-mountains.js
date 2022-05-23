
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
	Physics.initPhysics();
	Physics.setScale( Terrain.extablishScale() );
	animate();

} );

function init() {

	const container = document.getElementById( 'container' );

  scene = new THREE.Scene();
	Physics.setScene( scene );

	const size = 1609.34;
	const divisions = 16;
	const gridHelper = new THREE.GridHelper( size, divisions );
	scene.add( gridHelper );

	camera = new THREE.PerspectiveCamera( 45, window.innerWidth / window.innerHeight, NEAR, FAR );
	camera.position.set( 0, 9144, 9144 ); // 9144m is 30000ft
	camera.lookAt( 0, 0, 0 );
	scene.add( camera );

	const dirLight = new THREE.DirectionalLight( 0x7f7f7f, 1 );
	dirLight.position.set( 0, 100, 100 );
	scene.add( dirLight );

	const ambLight = new THREE.AmbientLight( 0x7f7f7f ); // soft white light
	scene.add( ambLight );

	renderer = new THREE.WebGLRenderer( { antialias: true, logarithmicDepthBuffer: true } );
	renderer.setSize( window.innerWidth, window.innerHeight );
	container.appendChild( renderer.domElement );

	window.addEventListener( 'resize', onWindowResize );

	renderer.domElement.style.touchAction = 'none';

	Controls.init( scene, camera );
	Terrain.loadTile( Physics.createTerrainBody );

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
