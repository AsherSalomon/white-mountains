import * as THREE from 'three';
import * as tilebelt from './lib/tilebelt.js';

let scene, camera;

const latitude = 44.2705; // Mt. Washington
const longitude = -71.30325;
const earthsRaius = 6371000; // meters
const eyeHeight = 1.6256; // meters
const maxElevation = 1916.582; // 9144; // meters

const pineGreen = new THREE.Color( 0x204219 );

const minZoom = 6;
const maxZoom = 12; // 12;

let origin = {};
let width = {};

export function init( newScene, newCamera ) {
  scene = newScene;
  camera = newCamera;

  let tile = tilebelt.pointToTile( longitude, latitude,  maxZoom );
  let bbox = tilebelt.tileToBBOX( tile ); // [w, s, e, n]
  let deltaNS = bbox[3] - bbox[1]; // n - s
  let deltaEW = bbox[2] - bbox[0]; // e - w
  let tileWidthNS = earthsRaius * deltaNS * Math.PI / 180;
  let tileWidthEW = earthsRaius * deltaEW * Math.PI / 180 * Math.cos( latitude * Math.PI / 180 );
  let tileWidth = ( tileWidthNS + tileWidthEW ) / 2; // 6999.478360682135 meters

  for ( let zoom = minZoom; zoom <= maxZoom; zoom++ ) {
    origin[zoom] = tilebelt.pointToTileFraction( longitude, latitude, z );
    width[zoom] = Math.pow( 2, maxZoom - zoom ) * tileWidth;
  }

}

export function update() {

}
