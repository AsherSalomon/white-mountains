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

class Tile {
  constructor( tile ) {
    this.tile = tile
    this.quadkey = tilebelt.tileToQuadkey( this.tile );
    this.remove = false;
    this.inScene = false;
  }
  update() {
    if ( !this.inScene ) {
    	this.gridHelper = new THREE.GridHelper( tileWidth, 1 );
      let origin = tilebelt.pointToTileFraction( longitude, latitude, maxZoom['terrain'] );
      let tile = tilebelt.quadkeyToTile( this.quadkey );
      let dx = ( 0.5 + tile[ 0 ] - origin[ 0 ] ) * tileWidth;
      let dy = ( 0.5 + tile[ 1 ] - origin[ 1 ] ) * tileWidth;
      this.gridHelper.translateX( dx );
      this.gridHelper.translateZ( dy );
    	scene.add( this.gridHelper );
      this.inScene = true;
    }
  };
  dispose() {
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

  grid.push( new Tile( tile ) );
  let siblings =  tilebelt.getSiblings( grid[ 0 ].tile );
  console.log( grid[ 0 ].tile );
  console.log( siblings[ 0 ] );
  console.log( siblings[ 1 ] );
  console.log( siblings[ 2 ] );
  console.log( siblings[ 3 ] );
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
