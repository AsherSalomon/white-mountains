import { ImageLoader, ObjectLoader } from 'three';
import * as tilebelt from './lib/tilebelt.js';
// import * as Physics from './physics.js';

let latitude = 44.2705; // Mt. Washington
let longitude = -71.30325;
let z = 12;
let earthsRaius = 6371000; // meters

let tileWidthNS;
let tileWidthEW;

const ELEVATION_TILE_SIZE = 512;
const IMAGERY_TILE_SIZE = 256;

export function extablishScale() {
  let tile = tilebelt.pointToTile( longitude, latitude, z );
  let bbox = tilebelt.tileToBBOX( tile ); // [w, s, e, n]
  let deltaNS = bbox[3] - bbox[1]; // n - s
  let deltaEW = bbox[2] - bbox[0]; // e - w
  tileWidthNS = earthsRaius * deltaNS * Math.PI / 180;
  tileWidthEW = earthsRaius * deltaEW * Math.PI / 180;
}

export function loadTile() {

}
