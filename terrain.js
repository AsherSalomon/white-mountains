import * as THREE from 'three';
import * as tilebelt from './lib/tilebelt.js';

let scene, camera;

const latitude = 44.2705; // Mt. Washington
const longitude = -71.30325;
const earthsRaius = 6371000; // meters

const minZoom = 6;
const maxZoom = 12;

let origin = {};
let tileWidth = {};

const ELEVATION_TILE_SIZE = 512;
const IMAGERY_TILE_SIZE = 256;
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

  let baseTile = tilebelt.pointToTile( longitude, latitude,  maxZoom );
  let bbox = tilebelt.tileToBBOX( baseTile ); // [w, s, e, n]
  let deltaNS = bbox[3] - bbox[1]; // n - s
  let deltaEW = bbox[2] - bbox[0]; // e - w
  let tileWidthNS = earthsRaius * deltaNS * Math.PI / 180;
  let tileWidthEW = earthsRaius * deltaEW * Math.PI / 180 * Math.cos( latitude * Math.PI / 180 );
  let baseTileWidth = ( tileWidthNS + tileWidthEW ) / 2; // 6999.478360682135 meters

  for ( let z = minZoom; z <= maxZoom; z++ ) {
    origin[ z ] = tilebelt.pointToTileFraction( longitude, latitude, z );
    tileWidth[ z ] = Math.pow( 2, maxZoom - z ) * baseTileWidth;
  }

  const gridHelper = new THREE.GridHelper( tileWidth[ maxZoom ], ELEVATION_TILE_SIZE );
  let tile = tilebelt.pointToTile( longitude, latitude, maxZoom );
  gridHelper.position.x = ( 0.5 + tile[ 0 ] - origin[ maxZoom ][ 0 ] ) * tileWidth[ maxZoom ];
  gridHelper.position.z = ( 0.5 + tile[ 1 ] - origin[ maxZoom ][ 1 ] ) * tileWidth[ maxZoom ];
  scene.add( gridHelper );

}

export function update() {
}
