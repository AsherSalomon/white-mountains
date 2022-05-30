
import * as THREE from 'three';
import * as Controls from './controls.js';
import * as Terrain from './terrain.js';
import * as Physics from './physics.js';
// import Stats from './lib/stats.module.js';
import Stats from './lib/Stats.js';

THREE.Cache.enabled = true;

let scene, renderer, camera, stats;

// 1 micrometer to 100 billion light years in one scene, with 1 unit = 1 meter?  preposterous!  and yet...
const NEAR = 1e-6, FAR = 1e27;

Ammo().then( function ( AmmoLib ) {

	Ammo = AmmoLib;

	init();
	animate();

} );

function init() {

	const container = document.getElementById( 'container' );
	stats = new Stats();
	container.appendChild( stats.dom );

  scene = new THREE.Scene();
	scene.background = new THREE.Color( 0x2759b0 );
	// scene.fog = new THREE.FogExp2( 0x2759b0, 0.00001 );
	scene.fog = new THREE.Fog( 0x2759b0, 1, 156260 );

	// const axesHelper = new THREE.AxesHelper( 1609.34 ); // 1 mile
	// scene.add( axesHelper );

	camera = new THREE.PerspectiveCamera( 45, window.innerWidth / window.innerHeight, NEAR, FAR );
	scene.add( camera );
	// camera.position.set( 0, 9144, 9144 ); // 9144m is 30000ft
	camera.position.set( 0, 1916.582 + 1.68, 0 ); // height of Mt Washington 1916.582m

	camera.lookAt( -1916.582, 1916.582, 0 );

	const dirLight = new THREE.DirectionalLight( 0x7f7f7f, 1 );
	dirLight.position.set( 0, 100, 100 );
	scene.add( dirLight );

	const ambLight = new THREE.AmbientLight( 0x7f7f7f ); // soft white light
	scene.add( ambLight );

	renderer = new THREE.WebGLRenderer( { antialias: true, logarithmicDepthBuffer: true } );
	renderer.setPixelRatio( window.devicePixelRatio );
	renderer.setSize( window.innerWidth, window.innerHeight );
	container.appendChild( renderer.domElement );

	window.addEventListener( 'resize', onWindowResize );

	renderer.domElement.style.touchAction = 'none';
	renderer.domElement.style.userSelect = 'none';

	Controls.init( scene, camera );

	Terrain.seed( scene, camera );

}

function onWindowResize() {

	camera.aspect = window.innerWidth / window.innerHeight;
	camera.updateProjectionMatrix();

	renderer.setSize( window.innerWidth, window.innerHeight );

}

let delay = 0;
function animate() {

  requestAnimationFrame( animate );

	delay ++;
	if ( delay == 10 ) {
		delay = 0;
		Terrain.update();
	}

	stats.update();

	renderer.render( scene, camera );

	Controls.animate( camera );

}
