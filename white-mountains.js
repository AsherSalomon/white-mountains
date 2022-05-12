import * as THREE from 'three';

let scene, renderer, camera;

// 1 micrometer to 100 billion light years in one scene, with 1 unit = 1 meter?  preposterous!  and yet...
const NEAR = 1e-6, FAR = 1e27;

init();
//
function init() {
//
// 	container = document.getElementById( 'container' );
//
//   scene = new THREE.Scene();
//
// 	camera = new THREE.PerspectiveCamera( 45, window.innerWidth / window.innerHeight, NEAR, FAR );
// 	scene.add( camera );
//
// 	const renderer = new THREE.WebGLRenderer( { antialias: true, logarithmicDepthBuffer: true } );
//
}
//
// function onWindowResize() {
//
// 	camera.aspect = window.innerWidth / window.innerHeight;
// 	camera.updateProjectionMatrix();
//
// 	renderer.setSize( window.innerWidth, window.innerHeight );
//
// }
//
// function animate() {
//
//   requestAnimationFrame( animate );
// 	renderer.render( scene, camera );
//
// }
