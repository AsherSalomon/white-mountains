import * as THREE from 'three';
import * as tilebelt from './lib/tilebelt.js';

let scene, camera;

const latitude = 44.2705; // Mt. Washington
const longitude = -71.30325;
const earthsRaius = 6371000; // meters
const eyeHeight = 1.6256; // meters
const maxElevation = 1916.582; // 9144; // meters

const pineGreen = new THREE.Color( 0x204219 );

const minZoom = 10//5;
const maxZoom = 12;
// const extraZoom = 12;

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
  let minZoomSquare = new Square( minZoomTile );
  let centerX = minZoomSquare.centerX;
  let centerZ = minZoomSquare.centerZ;
  let widthOverTwo = minZoomSquare.width / 2;
  minZoomSquare.northEdge = new Edge(
    new THREE.Vector3( centerX - widthOverTwo, 0, centerZ - widthOverTwo ),
    new THREE.Vector3( centerX + widthOverTwo, 0, centerZ - widthOverTwo ) );
  minZoomSquare.southEdge = new Edge(
    new THREE.Vector3( centerX - widthOverTwo, 0, centerZ + widthOverTwo ),
    new THREE.Vector3( centerX + widthOverTwo, 0, centerZ + widthOverTwo ) );
  minZoomSquare.eastEdge = new Edge(
    new THREE.Vector3( centerX + widthOverTwo, 0, centerZ - widthOverTwo ),
    new THREE.Vector3( centerX + widthOverTwo, 0, centerZ + widthOverTwo ) );
  minZoomSquare.westEdge = new Edge(
    new THREE.Vector3( centerX - widthOverTwo, 0, centerZ - widthOverTwo ),
    new THREE.Vector3( centerX - widthOverTwo, 0, centerZ + widthOverTwo ) );
  squares.push( minZoomSquare );
}

export function update() {
  // for ( let i = 0; i < squares.length; i++ ) {
  //   squares[ i ].update();
  // }
}

class Square {
  constructor( tile ) {
    this.tile = tile;
    this.zoom = tile[2];
    this.width = width[this.zoom];
    this.parent = null;
    this.children = [];
    this.centerX = ( 0.5 + this.tile[0] - origin[this.zoom][ 0 ] ) * this.width;
    this.centerZ = ( 0.5 + this.tile[1] - origin[this.zoom][ 1 ] ) * this.width;
    // this.visible = true;

    if ( showGridHelper ) {
      this.gridHelper = new THREE.GridHelper( this.width, downSize );
      this.gridHelper.position.x = this.centerX;
      this.gridHelper.position.z = this.centerZ;
      scene.add( this.gridHelper );
    }
  }

  split() {
    let childrenTiles = tilebelt.getChildren( this.tile ); // NE, NW, SW, SE
    for ( let i = 0; i < childrenTiles.length; i ++ ) {
      let newSquare = new Square( childrenTiles[i] );
      this.children.push( newSquare );
    }
    // this.northEdge.children.push( this.children[0].northEdge );
    // this.northEdge.children.push( this.children[1].northEdge );
    // this.southEdge.children.push( this.children[3].southEdge );
    // this.southEdge.children.push( this.children[2].southEdge );
    // this.eastEdge.children.push( this.children[0].eastEdge );
    // this.eastEdge.children.push( this.children[3].eastEdge );
    // this.westEdge.children.push( this.children[1].westEdge );
    // this.westEdge.children.push( this.children[2].westEdge );

    let newEdgeNorth = new Edge(
      new THREE.Vector3( this.centerX, 0, this.centerZ - this.width / 2 ),
      new THREE.Vector3( this.centerX, 0, this.centerZ ) );
    let newEdgeSouth = new Edge(
      new THREE.Vector3( this.centerX, 0, this.centerZ ),
      new THREE.Vector3( this.centerX, 0, this.centerZ + this.width / 2 ) );
    let newEdgeEast = new Edge(
      new THREE.Vector3( this.centerX - this.width / 2, 0, this.centerZ ),
      new THREE.Vector3( this.centerX, 0, this.centerZ ) );
    let newEdgeWest = new Edge(
      new THREE.Vector3( this.centerX, 0, this.centerZ ),
      new THREE.Vector3( this.centerX + this.width / 2, 0, this.centerZ ) );

  }

  // update() {
  // }

  // distanceFromCamera() {
  //   let positionDelta = new THREE.Vector3().subVectors( this.gridHelper.position, camera.position );
  //   let deltaX = Math.abs( positionDelta.x ) - this.width / 2;
  //   let deltaZ = Math.abs( positionDelta.z ) - this.width / 2;
  //   let distance = 0;
  //   if ( deltaX < 0 || deltaZ < 0 ) {
  //     distance = Math.max( deltaX, deltaZ );
  //     if ( distance < 0 ) { distance = 0; }
  //   } else {
  //     distance = Math.sqrt( deltaX ** 2 + deltaZ ** 2 );
  //   }
  //   return distance;
  // }
}

class Edge {
  constructor( endA, endB ) {
    this.squares = [];
    this.parent = null;
    this.children = [];

    this.endA = endA;
    this.endB = endB;

    this.length = new THREE.Vector3().subVectors( this.endB, this.endA ).length();

    if ( showGridHelper ) {
      const dir = new THREE.Vector3().subVectors( this.endB, this.endA );
      dir.normalize();
      this.arrowHelper = new THREE.ArrowHelper( dir, this.endA, this.length, 0xff00ff, 0, 0 );
      scene.add( this.arrowHelper );
    }

    // this.children.push()
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
