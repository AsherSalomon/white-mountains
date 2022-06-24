import * as THREE from 'three';
import * as tilebelt from './lib/tilebelt.js';

let scene, camera, frustum;

const latitude = 44.2705; // Mt. Washington
const longitude = -71.30325;
const earthsRaius = 6371000; // meters
const eyeHeight = 1.6256; // meters
const maxElevation = 1916.582; // 9144; // meters

const angularResolution = 4 / 1; // tile width / distance to camera

const pineGreen = new THREE.Color( 0x204219 );

const minZoom = 5;
const maxZoom = 12;
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
  frustum = new THREE.Frustum();

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
  minZoomSquare.makeVisible();
}

export function update() {

  frustum.setFromProjectionMatrix( new THREE.Matrix4().multiplyMatrices( camera.projectionMatrix, camera.matrixWorldInverse ) );

  for ( let i = squares.length - 1; i >= 0; i-- ) {
    if ( squares[i].removeFromSquares ) {
      squares[i].removeFromSquares = false;
      squares.splice( i, 1 );
    } else {
      squares[ i ].update();
    }
  }

  // for ( let zoom = minZoom; zoom <= maxZoom; zoom++ ) {
  //   let breakOut = false;
  //   for ( let i = 0; i < generatorQueue.length; i++ ) {
  //     if ( generatorQueue[ i ].zoom == zoom ) {
  //       if ( generatorQueue[ i ].intendedSquare.visible = false ) {
  //         generatorQueue.splice( i, 1 );
  //       } else if ( generatorQueue[ i ].next().done ) {
  //         generatorQueue.splice( i, 1 );
  //       }
  //       breakOut = true;
  //       break;
  //     }
  //   }
  //   if ( breakOut ) { break; }
  // }
}

class Square {
  constructor( tile, parent ) {
    this.tile = tile;
    this.zoom = tile[2];
    this.width = width[this.zoom];
    this.parent = parent;
    this.children = null;
    this.centerX = ( 0.5 + this.tile[0] - origin[this.zoom][ 0 ] ) * this.width;
    this.centerZ = ( 0.5 + this.tile[1] - origin[this.zoom][ 1 ] ) * this.width;

    this.visible = false;
    this.splitAlready = false;
    this.removeFromSquares = false;

    this.reusedMesh = null;

    this.boundingBox = new THREE.Box3();
  }

  update() {
    // wtf
    // if ( this.distanceFromCamera() == 0 ) {
    //   console.log( this.parent.allChildrenSmall() );
    // }
    if ( this.zoom < maxZoom && this.isTooBig() && this.visible ) {
      this.split();
    } else if ( this.zoom > minZoom && this.parent.allChildrenSmall() ) {
      this.parent.merge();
    }
  }

  makeVisible() {
    this.visible = true;

    if ( showGridHelper ) {
      this.gridHelper = new THREE.GridHelper(
        this.width * ( downSize - 2 ) / downSize, downSize - 2 );
      this.gridHelper.position.x = this.centerX;
      this.gridHelper.position.z = this.centerZ;
      scene.add( this.gridHelper );
      this.northEdge.show();
      this.southEdge.show();
      this.eastEdge.show();
      this.westEdge.show();
    }

    if ( meshBin.length > 0 ) {
      this.reusedMesh = meshBin.shift();
    } else {
      this.reusedMesh = new ReusedMesh();
    }
    this.reusedMesh.reuse( this );

    if ( showGridHelper ) {
      this.boundingBox.expandByObject( this.gridHelper );
    } else {
      this.boundingBox.expandByObject( this.reusedMesh.mesh );
    }

    squares.push( this );
  }

  makeNotVisible() {
    this.visible = false;

    if ( showGridHelper ) {
      scene.remove( this.gridHelper );
      this.northEdge.hide();
      this.southEdge.hide();
      this.eastEdge.hide();
      this.westEdge.hide();
    }

    this.reusedMesh.remove();
    meshBin.push( this.reusedMesh );
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
    }

    for ( let i = 0; i < this.children.length; i ++ ) {
      this.children[i].makeVisible();
    }
  }

  merge() {
    this.makeVisible();
    for ( let i = 0; i < this.children.length; i ++ ) {
      this.children[i].makeNotVisible();
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
    return tooBig && frustum.intersectsBox( this.boundingBox );
  }

  isTooSmall() {
    let tooSmall = this.width / this.distanceFromCamera() < angularResolution / 2;
    return tooSmall; // || frustum.intersectsBox( this.boundingBox ) == false;
  }

  allChildrenSmall() {
    let allChildrenAreSmall = false;
    if ( this.children != null ) {
      allChildrenAreSmall = true;
      for ( let i = 0; i < this.children.length; i ++ ) {
        if ( this.children[ i ].isTooSmall() == false || this.children[ i ].visible == false ) {
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

    if ( showGridHelper ) {
      const dir = new THREE.Vector3().subVectors( this.endB, this.endA );
      dir.normalize();
      this.arrowHelper = new THREE.ArrowHelper( dir, this.endA, this.length, 0xff00ff, 0, 0 );
      this.show();
    }
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

  show() {
    scene.add( this.arrowHelper );
  }

  hide() {
    scene.remove( this.arrowHelper );
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
    // this.square = square;
    let zoom = square.tile[ 2 ];
    this.width = width[ zoom ];
    this.mesh.scale.x = this.width;
    this.mesh.scale.z = this.width;
    this.centerX = ( 0.5 + square.tile[ 0 ] - origin[ zoom ][ 0 ] ) * this.width;
    this.centerZ = ( 0.5 + square.tile[ 1 ] - origin[ zoom ][ 1 ] ) * this.width;
    this.mesh.position.x = this.centerX;
    this.mesh.position.z = this.centerZ;

    for ( let m = 0; m <= downSize; m++ ) {
      for ( let n = 0; n <= downSize; n++ ) {
        let j = m * ( downSize + 1 ) + n;
        this.heightData[ j ] = 0;
      }
    }

    this.refreshMesh();

    scene.add( this.mesh );

    let url = urlForTile( ...square.tile, 'terrain' );
    const loader = new THREE.ImageLoader();
    let thisReusedMesh = this;
    loader.load( url, function ( image ) {
        let newGenerator = thisReusedMesh.terrainGenerator( image );
        newGenerator.intendedSquare = square;
        newGenerator.zoom = zoom;
        // generatorQueue.push( newGenerator );
      },
      undefined, // onProgress not supported
      function () {
        console.log( 'terrain ImageLoader error' );
      }
    );
  }

  *terrainGenerator( image ) {
    // this.context.drawImage( image, 0, 0 );
    // let imageData = this.context.getImageData( 0, 0, ELEVATION_TILE_SIZE, ELEVATION_TILE_SIZE ).data;
    //
    // yield;
    //
    // // for ( let i = 0; i < ELEVATION_TILE_SIZE ** 2; i++ ) {
    // //   this.heightData[ i ] = dataToHeight( imageData.slice( i * 4, i * 4 + 3 ) );
    // // }
    //
    // // let needsRefresh = [];
    // // for ( let t = 0; t < this.layer.tiles.length; t++ ) {
    // //   needsRefresh.push( false );
    // // }
    // for ( let m = 0; m <= downSize; m++ ) {
    //   for ( let n = 0; n <= downSize; n++ ) {
    //     let j = m * ( downSize + 1 ) + n;
    //     this.heightData[ j ] = 0;
    //     let x = this.centerX + this.width * ( n / downSize - 0.5 );
    //     let z = this.centerZ + this.width * ( m / downSize - 0.5 );
    //     if ( m == downSize || n == downSize ) {
    //       // for ( let t = 0; t < this.layer.tiles.length; t++ ) {
    //       //   if ( this.layer.tiles[ t ] != this ) {
    //       //     // obtain dataPoint from adjacent tiles
    //       //     let dataPoint = this.layer.tiles[ t ].reusedMesh.lookupDataPoint( x, z );
    //       //     if ( dataPoint != null ) {
    //       //       this.heightData[ j ] = dataPoint;
    //       //     }
    //       //   }
    //       // }
    //     } else {
    //       let i = m * ( downscale ** 2 ) * downSize + n * downscale;
    //       let dataPoint = dataToHeight( imageData.slice( i * 4, i * 4 + 3 ) );
    //       this.heightData[ j ] = dataPoint;
    //       // if ( m == 0 || n == 0 ) {
    //       //   for ( let t = 0; t < this.layer.tiles.length; t++ ) {
    //       //     if ( this.layer.tiles[ t ] != this ) {
    //       //       // report dataPoint to adjacent tiles
    //       //       this.layer.tiles[ t ].reusedMesh.setDataPoint( x, z, dataPoint );
    //       //       needsRefresh[ t ] = true;
    //       //     }
    //       //   }
    //       // }
    //     }
    //   }
    // }
    //
    // yield;
    //
    // // this.clampEdges();
    // this.refreshMesh();
    //
    // // yield;
    //
    // // for ( let t = 0; t < this.layer.tiles.length; t++ ) {
    // //   if ( needsRefresh[ t ] ) {
    // //     this.layer.tiles[ t ].reusedMesh.refreshMesh();
    // //     yield;
    // //   }
    // // }
  }

  refreshMesh() {
    const vertices = this.mesh.geometry.attributes.position.array;
    for ( let m = 0; m <= downSize; m++ ) {
      for ( let n = 0; n <= downSize; n++ ) {
        let i = m * ( downSize + 1 ) + n;
        let j = ( m * ( downSize + 1 ) + n ) * 3;
        let x = this.centerX + this.width * ( n / downSize - 0.5 );
        let z = this.centerZ + this.width * ( m / downSize - 0.5 );
        let mIsEdge = m == 0 || m == downSize;
        let nIsEdge = n == 0 || n == downSize;
        if ( !mIsEdge && !nIsEdge ) {
          vertices[ j + 1 ] = this.heightData[ i ];
        // } else if ( this.layer.isEdge( x, z ) && this.clampingLayer != null ) {
        //   vertices[ j + 1 ] = this.clampingLayer.lookupData( x, z );
        } else {
          vertices[ j + 1 ] = this.heightData[ i ];
        }
        vertices[ j + 1 ] -= curvatureOfTheEarth( x, z );
      }
    }
    this.mesh.geometry.setAttribute( 'position', new THREE.Float32BufferAttribute( vertices, 3 ) );
    this.mesh.geometry.computeVertexNormals();
    // if ( this.suqare != null ) {
    //   square.boundingBox.expandByObject( this.mesh );
    // }
  }

  remove() {
    scene.remove( this.mesh );
    // this.square = null;
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
