import * as THREE from 'three';
import * as tilebelt from './lib/tilebelt.js';

let scene, camera;

const latitude = 44.2705; // Mt. Washington
const longitude = -71.30325;
const earthsRaius = 6371000; // meters

const minZoom = 6;
const maxZoom = 14; // 12;

let origin = {};
let tileWidth = {};

let layers = [];

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

  layers.push( new Layer( maxZoom ) );

}

export function update() {

  for ( let i = 0; i < layers.length; i++ ) {
    layers[ i ].update();
  }

}

class Layer {

  constructor( z ) {
    this.z = z;
    this.tiles = [];
    // this.tiles.push( new Tile( z ) );
  }

  update() {

    let cameraX = camera.position.x / tileWidth[ this.z ] + origin[ this.z ][ 0 ];
    let cameraZ = camera.position.z / tileWidth[ this.z ] + origin[ this.z ][ 1 ];

    const addThreshold = 0.333;
    for ( let m = -1; m <= 1; m += 2 ) {
      for ( let n = -1; n <= 1; n += 2 ) {
        let proposedX = Math.floor( cameraX + addThreshold * n );
        let proposedZ = Math.floor( cameraZ + addThreshold * m );
        let proposedTile = [ proposedX, proposedZ, this.z ];
        if ( this.inTiles( proposedTile ) == false ) {
          this.tiles.push( new Tile( proposedTile ) );
        }
      }
    }

    const removeThreshold = 0.333;
    for ( let i = this.tiles.length - 1; i >= 0; i-- ) {
      let removeTile = true;
      for ( let m = -1; m <= 1; m += 2 ) {
        for ( let n = -1; n <= 1; n += 2 ) {
          let proposedX = Math.floor( cameraX + removeThreshold * n );
          let proposedZ = Math.floor( cameraZ + removeThreshold * m );
          let proposedTile = [ proposedX, proposedZ, this.z ];
          if ( tilebelt.tilesEqual( this.tiles[ i ].tile, proposedTile ) ) {
            removeTile = false;
          }
        }
      }
      if ( removeTile ) {
        this.tiles[ i ].dispose();
        this.tiles.splice( i, 1 );
      }
    }

    for ( let i = 0; i < this.tiles.length; i++ ) {
      this.tiles[ i ].update();
    }

  }

  inTiles( tile ) {
    let isInTiles = false;
    for ( let i = 0; i < this.tiles.length; i++ ) {
      if ( tilebelt.tilesEqual( tile, this.tiles[ i ].tile ) ) {
        isInTiles = true;
      }
    }
    return isInTiles;
  }

}

class Tile {

  constructor( tile ) {
    this.tile = tile;
    let z = tile[ 2 ];
    this.gridHelper = new THREE.GridHelper( tileWidth[ z ], ELEVATION_TILE_SIZE );
    // let tile = tilebelt.pointToTile( longitude, latitude, z );
    this.gridHelper.position.x = ( 0.5 + tile[ 0 ] - origin[ z ][ 0 ] ) * tileWidth[ z ];
    this.gridHelper.position.z = ( 0.5 + tile[ 1 ] - origin[ z ][ 1 ] ) * tileWidth[ z ];
    scene.add( this.gridHelper );
  }

  update() {
  }

  dispose() {
    scene.remove( this.gridHelper );
  }

}

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
