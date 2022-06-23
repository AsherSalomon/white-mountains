import * as THREE from 'three';
import * as tilebelt from './lib/tilebelt.js';

let scene, camera;

const latitude = 44.2705; // Mt. Washington
const longitude = -71.30325;
const earthsRaius = 6371000; // meters
const eyeHeight = 1.6256; // meters
const maxElevation = 1916.582; // 9144; // meters

const angularResolution = 4 / 1; // tile width / distance to camera

const pineGreen = new THREE.Color( 0x204219 );

const minZoom = 5;
const maxZoom = 20;//12;
// const extraZoom = 20;

let origin = {};
let width = {};

let showGridHelper = false;
// let showGridHelper = true;

let squares = [];
let generatorQueue = [];
let meshBin = [];

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
  let minZoomSquare = new Square( minZoomTile, null );
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
  // squares.push( minZoomSquare );
  minZoomSquare.makeVisible();

  // minZoomSquare.split();
  // for ( let i = 0; i < minZoomSquare.children.length; i ++ ) {
  //   minZoomSquare.children[i].split();
  // }
}

export function update() {
  for ( let i = squares.length - 1; i >= 0; i-- ) {
    if ( squares[i].removeFromSquares ) {
      if ( squares[i].visible ) {
        console.log('wtf');
      //   scene.remove( squares[i].gridHelper );
      }
      squares[i].removeFromSquares = false;
      squares.splice( i, 1 );
    } else {
      squares[ i ].update();
    }
  }
}

class Square {
  constructor( tile, parent ) {
    this.tile = tile;
    this.zoom = tile[2];
    this.width = width[this.zoom];
    this.parent = parent;
    // this.siblings = null;
    this.children = null;
    this.centerX = ( 0.5 + this.tile[0] - origin[this.zoom][ 0 ] ) * this.width;
    this.centerZ = ( 0.5 + this.tile[1] - origin[this.zoom][ 1 ] ) * this.width;

    this.visible = false;
    this.splitAlready = false;
    this.removeFromSquares = false;

    this.reusedMesh = null;
  }

  update() {
    if ( this.zoom < maxZoom && this.isTooBig() ) {
      this.split();
    // } else if ( this.zoom > minZoom && this.allSiblingsSmall() ) {
    //   this.parent.merge();
    } else if ( this.zoom > minZoom && this.allChildrenSmall() ) {
      this.merge();
    }
  }

  makeVisible() {
    this.visible = true;

    if ( showGridHelper ) {
      this.gridHelper = new THREE.GridHelper( this.width, downSize );
      this.gridHelper.position.x = this.centerX;
      this.gridHelper.position.z = this.centerZ;
      scene.add( this.gridHelper );
    }

    if ( meshBin.length > 0 ) {
      this.reusedMesh = meshBin.shift();
    } else {
      this.reusedMesh = new ReusedMesh();
    }
    this.reusedMesh.reuse( this );

    squares.push( this );
  }

  makeNotVisible() {
    this.visible = false;

    if ( showGridHelper ) {
      scene.remove( this.gridHelper );
    }

    if ( this.reusedMesh != null ) { // wtf
      this.reusedMesh.remove();
      meshBin.push( this.reusedMesh );
    }
    this.reusedMesh = null;

    this.removeFromSquares = true;
  }

  split() {
    this.makeNotVisible();

    if ( this.splitAlready == false ) {
      this.splitAlready = true;

      let childrenTiles = tilebelt.getChildren( this.tile ); // NW, NE, SE, SW
      this.children = [];
      for ( let i = 0; i < childrenTiles.length; i ++ ) {
        let newSquare = new Square( childrenTiles[i], this );
        this.children.push( newSquare );
      }

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

      this.northEdge.split();
      this.southEdge.split();
      this.eastEdge.split();
      this.westEdge.split();

      this.children[0].northEdge = this.northEdge.children[0];
      this.children[1].northEdge = this.northEdge.children[1];
      this.children[1].eastEdge = this.eastEdge.children[0];
      this.children[2].eastEdge = this.eastEdge.children[1];
      this.children[2].southEdge = this.southEdge.children[1];
      this.children[3].southEdge = this.southEdge.children[0];
      this.children[3].westEdge = this.westEdge.children[1];
      this.children[0].westEdge = this.westEdge.children[0];

      this.children[0].eastEdge = newEdgeNorth;
      this.children[0].southEdge = newEdgeWest;
      this.children[1].westEdge = newEdgeNorth;
      this.children[1].southEdge = newEdgeEast;
      this.children[2].northEdge = newEdgeEast;
      this.children[2].westEdge = newEdgeSouth;
      this.children[3].northEdge = newEdgeWest;
      this.children[3].eastEdge = newEdgeSouth;

      // for ( let i = 0; i < this.children.length; i ++ ) {
      //   this.children[i].siblings = this.children;
      // }
    }

    for ( let i = 0; i < this.children.length; i ++ ) {
      this.children[i].makeVisible();
    }
  }

  merge() {
    this.makeVisible();
    for ( let i = 0; i < this.children.length; i ++ ) {
      this.children[i].makeNotVisible();
      // if ( this.children[i].children != null ) {
      //   for ( let j = 0; j < this.children[i].children.length; j ++ ) {
      //     if ( this.children[i].children[j].visible ) {
      //       console.log('extra wtf')
      //       this.children[i].children[j].makeNotVisible();
      //     }
      //   }
      // }
    }
  }

  distanceFromCamera() {
    let positionDelta = new THREE.Vector3().subVectors(
      new THREE.Vector3( this.centerX, 0, this.centerZ ), camera.position );
    let deltaX = Math.abs( positionDelta.x ) - this.width / 2;
    let deltaZ = Math.abs( positionDelta.z ) - this.width / 2;
    let distance = 0;
    if ( deltaX < 0 || deltaZ < 0 ) {
      distance = Math.max( deltaX, deltaZ );
      if ( distance < 0 ) { distance = 0; }
    } else {
      distance = Math.sqrt( deltaX ** 2 + deltaZ ** 2 );
    }
    // let elevation = camera.position.y; // - terrain
    // distance = Math.sqrt( distance ** 2 + elevation ** 2 );
    return distance;
  }

  isTooBig() {
    let tooBig = this.width / this.distanceFromCamera() > angularResolution;
    return tooBig; // && frustum.intersectsBox( this.boundingBox );
  }

  isTooSmall() {
    let tooSmall = this.width / this.distanceFromCamera() < angularResolution / 2;
    return tooSmall; // || frustum.intersectsBox( this.boundingBox ) == false;
  }

  // allSiblingsSmall() {
  //   let allSiblingsAreSmall = false;
  //   if ( this.siblings != null ) {
  //     allSiblingsAreSmall = true;
  //     for ( let i = 0; i < this.siblings.length; i ++ ) {
  //       if ( this.siblings[ i ].isTooSmall() == false || this.siblings[ i ].visible == false ) {
  //         allSiblingsAreSmall = false;
  //       }
  //     }
  //   }
  //   return allSiblingsAreSmall;
  // }

  allChildrenSmall() {
    let allChildrenAreSmall = false;
    if ( this.children != null ) {
      allChildrenAreSmall = true;
      for ( let i = 0; i < this.children.length; i ++ ) {
        // if ( this.children[ i ].isTooSmall() == false || this.children[ i ].visible == false ) {
        if ( this.children[ i ].isTooSmall() == false ) {
          allChildrenAreSmall = false;
        }
      }
    }
    return allChildrenAreSmall;
  }
}

class Edge {
  constructor( endA, endB ) {
    this.squares = [];
    this.parent = null;
    this.children = null;

    this.splitAlready = false;

    this.endA = endA;
    this.endB = endB;

    this.length = new THREE.Vector3().subVectors( this.endB, this.endA ).length();

    // if ( showGridHelper ) {
    //   const dir = new THREE.Vector3().subVectors( this.endB, this.endA );
    //   dir.normalize();
    //   this.arrowHelper = new THREE.ArrowHelper( dir, this.endA, this.length, 0xff00ff, 0, 0 );
    //   // this.arrowHelper.position.y += this.length / downSize;
    //   scene.add( this.arrowHelper );
    // }
  }
  split() {
    if ( this.splitAlready == false ) {
      this.splitAlready = true;

      const direction = new THREE.Vector3().subVectors( this.endB, this.endA );
      direction.multiplyScalar( 0.5 );
      let midPoint = this.endA.clone();
      midPoint.add( direction );
      this.children = [];
      this.children.push( new Edge( this.endA, midPoint ) );
      this.children.push( new Edge( midPoint, this.endB ) );
    }
  }
}

class ReusedMesh {
  constructor() {
    let geometry = new THREE.PlaneGeometry( 1, 1, downSize, downSize );
    geometry.rotateX( - Math.PI / 2 );
    let material = new THREE.MeshStandardMaterial( {
      roughness: 0.9,
      // color: pineGreen
      color: new THREE.Color( Math.random(), Math.random(), Math.random() )
    } );
    this.mesh = new THREE.Mesh( geometry, material );

    let canvas = document.createElement( 'canvas' );
    canvas.width = ELEVATION_TILE_SIZE;
    canvas.height = ELEVATION_TILE_SIZE;
    this.context = canvas.getContext( '2d', {willReadFrequently: true} );

    this.heightData = new Float32Array( ( downSize + 1 ) ** 2 );
  }

  reuse( square ) {
    let zoom = square.tile[ 2 ];
    this.width = width[ zoom ];
    this.mesh.scale.x = this.width;
    this.mesh.scale.z = this.width;
    this.centerX = ( 0.5 + square.tile[ 0 ] - origin[ zoom ][ 0 ] ) * this.width;
    this.centerZ = ( 0.5 + square.tile[ 1 ] - origin[ zoom ][ 1 ] ) * this.width;
    this.mesh.position.x = this.centerX;
    this.mesh.position.z = this.centerZ;

    scene.add( this.mesh );
  }

  remove() {
    scene.remove( this.mesh );
  }
}

const ELEVATION_TILE_SIZE = 512;
const downscale = 2 ** 4; // power of 2
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
