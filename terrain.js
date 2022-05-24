import * as THREE from 'three';
import * as tilebelt from './lib/tilebelt.js';

let scene;

let latitude = 44.2705; // Mt. Washington
let longitude = -71.30325;
let earthsRaius = 6371000; // meters
let tileWidth; // 6999.478360682135 meters

let maxZoom = {
  terrain: 12,
  satellite: 20
}

let grid = [];

function Tile( quadkey ) {
  this.quadkey = quadkey;
  this.remove = false;
  this.inScene = false;
  this.update = function() {
    if ( !this.inScene ) {
    	const gridHelper = new THREE.GridHelper( tileWidth, 1 );
    	scene.add( gridHelper );
      this.inScene = true;
    }
  };
  this.dispose = function() {
  };
}

export function seed( newScene ) {
  scene = newScene;

  let tile = tilebelt.pointToTile( longitude, latitude, maxZoom['terrain'] );
  let bbox = tilebelt.tileToBBOX( tile ); // [w, s, e, n]
  let deltaNS = bbox[3] - bbox[1]; // n - s
  let deltaEW = bbox[2] - bbox[0]; // e - w
  let tileWidthNS = earthsRaius * deltaNS * Math.PI / 180;
  let tileWidthEW = earthsRaius * deltaEW * Math.PI / 180 * Math.cos( latitude * Math.PI / 180 );
  tileWidth = ( tileWidthNS + tileWidthEW ) / 2;

  grid.push( new Tile( tilebelt.tileToQuadkey( tile ) ) );
}

export function update() {
  for ( let i = grid.length - 1; i >= 0 ; i-- ) {
    if ( grid[ i ].remove ) {
      grid[ i ].dispose();
      grid.splice( i, 1 );
    } else {
      grid[ i ].update();
    }
  }
}
