import * as THREE from 'three';
import * as tilebelt from './lib/tilebelt.js';

let scene, camera;

const latitude = 44.2705; // Mt. Washington
const longitude = -71.30325;
const earthsRaius = 6371000; // meters

const minZoom = 6;
const maxZoom = 12;

const apiKey = '5oT5Np7ipsbVhre3lxdi';

let urlFormat = {
  terrain: 'https://api.maptiler.com/tiles/terrain-rgb/{z}/{x}/{y}.png?key={apiKey}',
  satellite: 'https://api.maptiler.com/tiles/satellite/{z}/{x}/{y}.jpg?key={apiKey}'
  // protocolbuffer: 'https://api.maptiler.com/tiles/v3/{z}/{x}/{y}.pbf?key={apiKey}'
  // https://wiki.openstreetmap.org/wiki/PBF_Format
}

function urlForTile( x, y, z, type ) {
  return urlFormat[ type ].replace( '{x}', x ).replace( '{y}', y )
    .replace( '{z}', z ).replace( '{apiKey}', apiKey );
}

export function init( newScene, newCamera ) {
  scene = newScene;
  camera = newCamera;

	const axesHelper = new THREE.AxesHelper( 1609.34 ); // 1 mile
	scene.add( axesHelper );
}

export function update() {
}
