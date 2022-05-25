import * as THREE from 'three';
import * as tilebelt from './lib/tilebelt.js';

let scene, camera;

const latitude = 44.2705; // Mt. Washington
const longitude = -71.30325;
const earthsRaius = 6371000; // meters
const maxElevation = 9144; // meters
const horizonDistance = Math.sqrt( Math.pow( earthsRaius + maxElevation, 2 ) - Math.pow( earthsRaius, 2 ) );
let baseTileWidth; // 6999.478360682135 meters at maxZoom['terrain']
const angularResolution = 1 / 2; // tile width / distance to camera

let maxZoom = {
  terrain: 12,
  satellite: 20
}
const minZoom = 5;

let grid = [];

class Tile {
  constructor( tile ) {
    this.tile = tile
    // this.quadkey = tilebelt.tileToQuadkey( this.tile );
    this.remove = false;
    this.inScene = false;
    this.width = Math.pow( 2, maxZoom['terrain'] - this.tile[ 2 ] ) * baseTileWidth;
  }
  update() {
    if ( !this.inScene ) {
    	this.gridHelper = new THREE.GridHelper( this.width, 1 );
      let origin = tilebelt.pointToTileFraction( longitude, latitude, this.tile[ 2 ] );
      let dx = ( 0.5 + this.tile[ 0 ] - origin[ 0 ] ) * this.width;
      let dy = ( 0.5 + this.tile[ 1 ] - origin[ 1 ] ) * this.width;
      this.gridHelper.translateX( dx );
      this.gridHelper.translateZ( dy );
    	scene.add( this.gridHelper );
      this.inScene = true;
      // console.log( this.distanceFromCamera() );
    } else {
      if ( this.tile[ 2 ] < maxZoom['terrain'] ) {
        if ( this.isTooBig() ) {
          // this.split();
        }
      }
    }
  };
  isTile( tile ) {
    return tilebelt.tilesEqual( tile, this.tile );
  }
  distanceFromCamera() {
    let flatCameraPosition =  new THREE.Vector3();
    flatCameraPosition.copy( camera.position );
    flatCameraPosition.y = 0;
    return this.gridHelper.position.distanceTo( camera.position );
  }
  isTooBig() {
    return this.width / this.distanceFromCamera() > angularResolution;
  }
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

  let baseTile = tilebelt.pointToTile( longitude, latitude,  maxZoom['terrain'] );
  let bbox = tilebelt.tileToBBOX( baseTile ); // [w, s, e, n]
  let deltaNS = bbox[3] - bbox[1]; // n - s
  let deltaEW = bbox[2] - bbox[0]; // e - w
  let tileWidthNS = earthsRaius * deltaNS * Math.PI / 180;
  let tileWidthEW = earthsRaius * deltaEW * Math.PI / 180 * Math.cos( latitude * Math.PI / 180 );
  baseTileWidth = ( tileWidthNS + tileWidthEW ) / 2;
  // console.log( 'baseTileWidth ' + baseTileWidth );

  let tile = tilebelt.pointToTile( longitude, latitude, minZoom );
  grid.push( new Tile( tile ) );
  // grid[ 0 ].split();

	const helper = new THREE.PolarGridHelper( horizonDistance, 12, 1, 12 );
	scene.add( helper );
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
