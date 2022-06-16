import * as THREE from 'three';
import * as tilebelt from './lib/tilebelt.js';

let scene, camera;

const latitude = 44.2705; // Mt. Washington
const longitude = -71.30325;
const earthsRaius = 6371000; // meters

const minZoom = 6;
const maxZoom = 18; // 12;

const pineGreen = new THREE.Color( 0x204219 );

let origin = {};
let tileWidth = {};

let layers = [];
let generatorQueue = [];
let meshBin = [];

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
    layers.push( new Layer( z ) );
  }
  for ( let i = 0; i < layers.length - 1; i++ ) {
    layers[ i ].child = layers[ i + 1 ];
    layers[ i + 1 ].parent = layers[ i ];
  }

}

export function update() {
  for ( let i = 0; i < layers.length; i++ ) {
    layers[ i ].update();
  }

  if ( generatorQueue.length > 0 ) {
    if ( generatorQueue[ 0 ].next().done ) {
      generatorQueue.shift();
    }
  }
}

class Layer {
  constructor( z ) {
    this.z = z;
    this.tiles = [];
    // this.tiles.push( new Tile( z ) );
    this.minX = 1000000;
    this.maxX = -1000000;
    this.minZ = 1000000;
    this.maxZ = -1000000;
  }

  update() {
    let cameraX = camera.position.x / tileWidth[ this.z ] + origin[ this.z ][ 0 ];
    let cameraZ = camera.position.z / tileWidth[ this.z ] + origin[ this.z ][ 1 ];

    const addThreshold = 0.25;
    const removeThreshold = 0.5;

    let addMinX =  Math.floor( cameraX - addThreshold );
    let addMaxX =  Math.floor( cameraX + addThreshold );
    let addMinZ =  Math.floor( cameraZ - addThreshold );
    let addMaxZ =  Math.floor( cameraZ + addThreshold );

    let removeMinX = Math.floor( cameraX - removeThreshold );
    let removeMaxX = Math.floor( cameraX + removeThreshold );
    let removeMinZ = Math.floor( cameraZ - removeThreshold );
    let removeMaxZ = Math.floor( cameraZ + removeThreshold );

    if ( this.minX >= addMinX ) { this.minX = addMinX; }
    if ( this.minX < removeMinX ) { this.minX = removeMinX; }
    if ( this.minZ >= addMinZ ) { this.minZ = addMinZ; }
    if ( this.minZ < removeMinZ ) { this.minZ = removeMinZ; }

    if ( this.maxX <= addMaxX ) { this.maxX = addMaxX; }
    if ( this.maxX > removeMaxX ) { this.maxX = removeMaxX; }
    if ( this.maxZ <= addMaxZ ) { this.maxZ = addMaxZ; }
    if ( this.maxZ > removeMaxZ ) { this.maxZ = removeMaxZ; }

    let updateClipping = false;

    for ( let m = this.minZ; m <= this.maxZ; m++ ) {
      for ( let n = this.minX; n <= this.maxX; n++ ) {
        let proposedTile = [ n, m, this.z ];
        if ( this.inTiles( proposedTile ) == false ) {
          this.tiles.push( new Tile( proposedTile ) );
          updateClipping = true;
        }
      }
    }

    for ( let i = this.tiles.length - 1; i >= 0; i-- ) {
      let removeTile = true;
      for ( let m = this.minZ; m <= this.maxZ; m++ ) {
        for ( let n = this.minX; n <= this.maxX; n++ ) {
          let proposedTile = [ n, m, this.z ];
          if ( tilebelt.tilesEqual( this.tiles[ i ].tile, proposedTile ) ) {
            removeTile = false;
          }
        }
      }
      if ( removeTile ) {
        this.tiles[ i ].dispose();
        this.tiles.splice( i, 1 );
        updateClipping = true;
      }
    }

    if ( updateClipping ) {
      this.setClippingPlanes();
    }

    for ( let i = 0; i < this.tiles.length; i++ ) {
      this.tiles[ i ].update();
    }
  }

  setClippingPlanes() {
    let clipMinX = ( this.minX - origin[ this.z ][ 0 ] ) * tileWidth[ this.z ];
    let clipMinZ = ( this.minZ - origin[ this.z ][ 1 ] ) * tileWidth[ this.z ];
    let clipMaxX = ( this.maxX + 1 - origin[ this.z ][ 0 ] ) * tileWidth[ this.z ];
    let clipMaxZ = ( this.maxZ + 1 - origin[ this.z ][ 1 ] ) * tileWidth[ this.z ];
    this.clipPlanes = [
      new THREE.Plane( new THREE.Vector3( 1, 0, 0 ), -clipMaxX ),
      new THREE.Plane( new THREE.Vector3( -1, 0, 0 ), clipMinX ),
      new THREE.Plane( new THREE.Vector3( 0, 0, 1 ), -clipMaxZ ),
      new THREE.Plane( new THREE.Vector3( 0, 0, - 1 ), clipMinZ )
    ];
    if ( this.parent != null ) {
      let tiles = this.parent.tiles;
      for ( let i = 0; i < tiles.length; i++ ) {
        tiles[ i ].reusedMesh.mesh.material.clippingPlanes = this.clipPlanes;
        console.log('setClippingPlanes');
      }
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
    // this.gridHelper = new THREE.GridHelper( tileWidth[ z ], ELEVATION_TILE_SIZE / downscale );
    // // let tile = tilebelt.pointToTile( longitude, latitude, z );
    // this.gridHelper.position.x = ( 0.5 + tile[ 0 ] - origin[ z ][ 0 ] ) * tileWidth[ z ];
    // this.gridHelper.position.z = ( 0.5 + tile[ 1 ] - origin[ z ][ 1 ] ) * tileWidth[ z ];
    // scene.add( this.gridHelper );

    if ( meshBin.length > 0 ) {
      this.reusedMesh = meshBin.shift();
    } else {
      this.reusedMesh = new ReusedMesh();
    }
    this.reusedMesh.reuse( this.tile );
  }

  update() {
  }

  dispose() {
    // scene.remove( this.gridHelper );

    this.reusedMesh.remove();
    meshBin.push( this.reusedMesh );
  }
}

class ReusedMesh {
  constructor() {
    let size = ELEVATION_TILE_SIZE / downscale;
    let geometry = new THREE.PlaneGeometry( 1, 1, size, size );
    geometry.rotateX( - Math.PI / 2 );
    let material = new THREE.MeshStandardMaterial( {
      roughness: 0.9,
      clipIntersection: true,
      color: pineGreen
    } );
    this.mesh = new THREE.Mesh( geometry, material );
  }

  reuse( tile ) {
    generatorQueue.push( this.generator( tile ) );
  }

  *generator( tile ) {
    let z = tile[ 2 ];
    let width = tileWidth[ z ];
    this.mesh.scale.x = width;
    this.mesh.scale.z = width;
    this.mesh.position.x = ( 0.5 + tile[ 0 ] - origin[ z ][ 0 ] ) * width;
    this.mesh.position.z = ( 0.5 + tile[ 1 ] - origin[ z ][ 1 ] ) * width;
    const vertices = this.mesh.geometry.attributes.position.array;
    let size = ELEVATION_TILE_SIZE / downscale;
    for ( let m = 0; m < size + 1; m++ ) {
      for ( let n = 0; n < size + 1; n++ ) {
        let j = ( m * ( size + 1 ) + n ) * 3;
        vertices[ j + 1 ] = tileWidth[ z ] * Math.random() * -0.01;
      }
    }
    this.mesh.geometry.computeVertexNormals();
    scene.add( this.mesh );
  }

  remove() {
    scene.remove( this.mesh );
  }
}



const ELEVATION_TILE_SIZE = 512;
const downscale = 8;
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
