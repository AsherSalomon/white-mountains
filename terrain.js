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

// let showGridHelper = false;
let showGridHelper = true;

let squares = [];

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
    origin[zoom] = tilebelt.pointToTileFraction( longitude, latitude, zoom );
    width[zoom] = Math.pow( 2, maxZoom - zoom ) * tileWidth;
  }

  let minZoomTile = tilebelt.pointToTile( longitude, latitude, minZoom );
  squares.push( new Square( minZoomTile ) );
}

export function update() {

}

class Square {
  constructor( tile ) {
    this.tile = tile;
    this.zoom = tile[2];
    this.width = width[this.zoom];
    this.parent = null;
    this.children = [];
    this.northEdge = new Edge( this );
    this.southEdge = new Edge( this );
    this.eastEdge = new Edge( this );
    this.westEdge = new Edge( this );
    // this.visible = true;

    if ( showGridHelper ) {
      let z = tile[ 2 ];
      this.gridHelper = new THREE.GridHelper( tileWidth[ z ], downSize );
      // let tile = tilebelt.pointToTile( longitude, latitude, z );
      this.gridHelper.position.x = ( 0.5 + tile[ 0 ] - origin[ z ][ 0 ] ) * tileWidth[ z ];
      this.gridHelper.position.z = ( 0.5 + tile[ 1 ] - origin[ z ][ 1 ] ) * tileWidth[ z ];
      this.gridHelper.position.y = 2000;
      scene.add( this.gridHelper );
    }
  }
}

class Edge {
  constructor( square ) {
    this.squares = [ square ];
    this.parent = null;
    this.children = [];
  }
}


const ELEVATION_TILE_SIZE = 512;
const downscale = 2 ** 2; // power of 2
const downSize = ELEVATION_TILE_SIZE / downscale;
const IMAGERY_TILE_SIZE = 256;
const apiKey = 'MrM7HIm1w0P1BQYO7MY3';
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
function dataToHeight( data ) {
  // Elevation in meters
  return -10000 + ( data[ 0 ] * 65536 + data[ 1 ] * 256 + data[ 2 ] ) * 0.1;
}
function curvatureOfTheEarth( x, z ) {
  return ( x ** 2 + z ** 2 ) / ( 2 * earthsRaius );
}
