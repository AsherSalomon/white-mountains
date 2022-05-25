import * as THREE from 'three';
import * as tilebelt from './lib/tilebelt.js';

let scene, camera;

const latitude = 44.2705; // Mt. Washington
const longitude = -71.30325;
const earthsRaius = 6371000; // meters
const maxElevation = 9144; // meters
const horizonDistance = Math.sqrt( Math.pow( earthsRaius + maxElevation, 2 ) - Math.pow( earthsRaius, 2 ) );
// const angularResolution = 1 / 1;

let maxZoom = {
  terrain: 12,
  satellite: 20
}
const baseZ = 5;

let baseTileWidth; // 6999.478360682135 meters at maxZoom['terrain']
function tileWidth( z ) {
  return Math.power( 2, maxZoom['terrain'] - z ) * baseTileWidth;
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
      let z = this.tile[ 2 ];
    	this.gridHelper = new THREE.GridHelper( tileWidth( z ), 1 );
      let origin = tilebelt.pointToTileFraction( longitude, latitude, z );
      let dx = ( 0.5 + this.tile[ 0 ] - origin[ 0 ] ) * tileWidth( z );
      let dy = ( 0.5 + this.tile[ 1 ] - origin[ 1 ] ) * tileWidth( z );
      this.gridHelper.translateX( dx );
      this.gridHelper.translateZ( dy );
    	scene.add( this.gridHelper );
      this.inScene = true;
    }
  };
  isTile( tile ) {
    return tilebelt.tilesEqual( tile, this.tile );
  }
  // spawnSiblings() {
  //   let siblingTiles =  tilebelt.getSiblings( this.tile );
  //   for ( let i = 0; i < siblingTiles.length; i++ ) {
  //     if ( !this.isTile( siblingTiles[ i ] ) ) {
  //       grid.push( new Tile( siblingTiles[ i ] ) );
  //     }
  //   }
  // }
  split() {
    let children = tilebelt.getChildren( this.tile );
    for ( let i = 0; i < 4; i ++ ) {
      grid.push( new Tile( children[ i ] ) );
    }
    this.remove = true;
  }
  dispose() {
    scene.remove( this.gridHelper );
  };
}

export function seed( newScene, newCamera ) {
  scene = newScene;
  camera = newCamera;

  let tile = tilebelt.pointToTile( longitude, latitude,  maxZoom['terrain'] );
  let bbox = tilebelt.tileToBBOX( tile ); // [w, s, e, n]
  let deltaNS = bbox[3] - bbox[1]; // n - s
  let deltaEW = bbox[2] - bbox[0]; // e - w
  let tileWidthNS = earthsRaius * deltaNS * Math.PI / 180;
  let tileWidthEW = earthsRaius * deltaEW * Math.PI / 180 * Math.cos( latitude * Math.PI / 180 );
  baseTileWidth = ( tileWidthNS + tileWidthEW ) / 2;
  console.log( 'tileWidth ' + baseTileWidth );

  grid.push( new Tile( tile ) );
  // grid[ 0 ].spawnSiblings();

  // grid[ 0 ].remove = true;
  // console.log(  );
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
