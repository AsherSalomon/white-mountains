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

let delayUpdate = false;
// let delayUpdate = true;
let showGridHelper = false;
// let showGridHelper = true;
let showBoundingBoxHelper = false;
// let showBoundingBoxHelper = true;
let flashAdjacentColors = false;
// let flashAdjacentColors = true;

let origin = {};
let width = {};

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

let delay = 0;
export function update() {
  delay++;
  if ( delay % 30 == 0 || delayUpdate == false ) {
    frustum.setFromProjectionMatrix( new THREE.Matrix4().multiplyMatrices( camera.projectionMatrix, camera.matrixWorldInverse ) );

    for ( let i = squares.length - 1; i >= 0; i-- ) {
      if ( squares[i].removeFromSquares ) {
        squares[i].removeFromSquares = false;
        squares.splice( i, 1 );
      } else {
        squares[ i ].update();
      }
    }

    for ( let zoom = minZoom; zoom <= maxZoom; zoom++ ) {
      let breakOut = false;
      for ( let i = 0; i < generatorQueue.length; i++ ) {
        if ( generatorQueue[ i ].zoom == zoom ) {
          if ( generatorQueue[ i ].intendedSquare.visible == false ) {
            generatorQueue.splice( i, 1 );
          } else if ( generatorQueue[ i ].next().done ) {
            generatorQueue.splice( i, 1 );
          }
          breakOut = true;
          break;
        }
      }
      if ( breakOut ) { break; }
    }
  }
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
    this.updateBoundingBox = false;
  }

  update() {
    if ( this.zoom < maxZoom && this.isTooBig() && this.visible ) {
      this.split();
    } else if ( this.zoom > minZoom && this.parent.allChildrenSmall() ) {
      this.parent.merge();
    } else if ( this.reusedMesh != null ) {
      if ( this.reusedMesh.readyToLoad ) {
        // this.reusedMesh.readyToLoad = false;
        this.reusedMesh.loadUrl();
      }
    }
    if ( this.reusedMesh != null && this.updateBoundingBox ) {
      this.updateBoundingBox = false;
      this.boundingBox.expandByObject( this.reusedMesh.mesh, true );
    }
    if ( flashAdjacentColors && this.reusedMesh != null ) {
      this.reusedMesh.mesh.material.color = pineGreen;
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

    if ( showBoundingBoxHelper ) {
      this.boundingBoxHelper = new THREE.Box3Helper( this.boundingBox, 0xffff00 );
      scene.add( this.boundingBoxHelper );
    }

    if ( meshBin.length > 0 ) {
      this.reusedMesh = meshBin.shift();
    } else {
      this.reusedMesh = new ReusedMesh();
    }
    this.reusedMesh.reuse( this );
    // this.reusedMesh.loadUrl();
    // this.reusedMesh.readyToLoad = true;

    if ( showGridHelper ) {
      this.boundingBox.expandByObject( this.gridHelper, true );
    } else {
      this.boundingBox.expandByObject( this.reusedMesh.mesh, true );
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

    if ( showBoundingBoxHelper ) {
      scene.remove( this.boundingBoxHelper );
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

      let newEdgeNS = new Edge(
        new THREE.Vector3( this.centerX, 0, this.centerZ - this.width / 2 ),
        new THREE.Vector3( this.centerX, 0, this.centerZ + this.width / 2 ) );
      let newEdgeEW = new Edge(
        new THREE.Vector3( this.centerX - this.width / 2, 0, this.centerZ ),
        new THREE.Vector3( this.centerX + this.width / 2, 0, this.centerZ ) );
      newEdgeNS.split();
      newEdgeEW.split();

      this.children[0].eastEdge = newEdgeNS.children[0];
      this.children[0].southEdge = newEdgeEW.children[0];
      this.children[1].westEdge = newEdgeNS.children[0];
      this.children[1].southEdge = newEdgeEW.children[1];
      this.children[2].northEdge = newEdgeEW.children[1];
      this.children[2].westEdge = newEdgeNS.children[1];
      this.children[3].northEdge = newEdgeEW.children[0];
      this.children[3].eastEdge = newEdgeNS.children[1];

      for ( let i = 0; i < this.children.length; i ++ ) {
        this.children[i].northEdge.squares.push( this.children[i] );
        this.children[i].southEdge.squares.push( this.children[i] );
        this.children[i].eastEdge.squares.push( this.children[i] );
        this.children[i].westEdge.squares.push( this.children[i] );
      }
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
    let tooSmall = this.width / this.distanceFromCamera() < angularResolution / 3;
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
    this.squares = []; // wtf never implimented
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
      this.children[0].parent = this;
      this.children[1].parent = this;
    }
  }

  show() {
    scene.add( this.arrowHelper );
  }

  hide() {
    scene.remove( this.arrowHelper );
  }

  findRootEdge() {
    let root = this;
    while ( root.parent != null ) {
      root = root.parent;
    }
    return root;
  }

  recursiveVisibleSquares() {
    let visibleList = [];
    for ( let i = 0; i < this.squares.length; i++ ) {
      if ( this.squares[i].visible ) {
        // console.log( 'this.squares[i].visible' );
        visibleList.push( { square: this.squares[i], edge: this } );
      }
    }
    if ( this.children != null ) {
      for ( let i = 0; i < this.children.length; i++ ) {
        visibleList = visibleList.concat( this.children[i].recursiveVisibleSquares() );
      }
    }
    return visibleList;
  }

  overlapsEdge( edge, xorz ) {
    let minLength = Math.min( this.length, edge.length );
    let overlaps = false;
    if ( xorz == 'x' ) {
      let tAx = 0;
      let tBx = Math.round( ( this.endB.x - this.endA.x ) / minLength * downSize );
      let eAx = Math.round( ( edge.endA.x - this.endA.x ) / minLength * downSize );
      let eBx = Math.round( ( edge.endB.x - this.endA.x ) / minLength * downSize );
      overlaps = tBx >= eAx && tAx <= eBx;
    }
    if ( xorz == 'z' ) {
      let tAz = 0;
      let tBz = Math.round( ( this.endB.z - this.endA.z ) / minLength * downSize );
      let eAz = Math.round( ( edge.endA.z - this.endA.z ) / minLength * downSize );
      let eBz = Math.round( ( edge.endB.z - this.endA.z ) / minLength * downSize );
      overlaps = tBz >= eAz && tAz  <= eBz;
    }
    return overlaps;
  }

  findAdjacents( square, xorz ) {
    let adjacents = [];
    let root = this.findRootEdge();
    let visibleList = root.recursiveVisibleSquares();
    for ( let i = 0; i < visibleList.length; i++ ) {
      if ( visibleList[i].square != square ) {
        if ( this.overlapsEdge( visibleList[i].edge, xorz ) ) {
          adjacents.push( visibleList[i] );
        }
      }
    }
    return adjacents;
  }

  // pointsOnEdge() {
  //   let points = [];
  //   return points;
  // }
}

class ReusedMesh {
  constructor() {
    let geometry = new THREE.PlaneGeometry( 1, 1, downSize, downSize );
    geometry.rotateX( - Math.PI / 2 );
    let material = new THREE.MeshStandardMaterial( {
      roughness: 0.9,
      color: pineGreen
      // color: new THREE.Color( Math.random(), Math.random(), Math.random() )
    } );
    this.mesh = new THREE.Mesh( geometry, material );

    let canvas = document.createElement( 'canvas' );
    canvas.width = ELEVATION_TILE_SIZE;
    canvas.height = ELEVATION_TILE_SIZE;
    this.context = canvas.getContext( '2d', {willReadFrequently: true} );

    this.heightData = new Float32Array( ( downSize + 1 ) ** 2 );

    this.readyToLoad = false;
  }

  reuse( square ) {
    this.square = square;
    this.zoom = square.zoom;
    this.width = square.width;
    this.mesh.scale.x = this.width;
    this.mesh.scale.z = this.width;
    this.centerX = ( 0.5 + square.tile[ 0 ] - origin[ this.zoom ][ 0 ] ) * this.width;
    this.centerZ = ( 0.5 + square.tile[ 1 ] - origin[ this.zoom ][ 1 ] ) * this.width;
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

    this.readyToLoad = true;
  }

  loadUrl() {
    this.readyToLoad = false;
    let url = urlForTile( ...this.square.tile, 'terrain' );
    const loader = new THREE.ImageLoader();
    let thisReusedMesh = this;
    loader.load( url, function ( image ) {
        let newGenerator = thisReusedMesh.terrainGenerator( image );
        newGenerator.intendedSquare = thisReusedMesh.square;
        newGenerator.zoom = thisReusedMesh.zoom;
        generatorQueue.push( newGenerator );
      },
      undefined, // onProgress not supported
      function () {
        console.log( 'terrain ImageLoader error' );
      }
    );
  }

  *terrainGenerator( image ) {
    this.context.drawImage( image, 0, 0 );
    let imageData = this.context.getImageData( 0, 0, ELEVATION_TILE_SIZE, ELEVATION_TILE_SIZE ).data;

    yield;

    let northAdjacents = this.square.northEdge.findAdjacents( this.square, 'x' );
    let westAdjacents = this.square.westEdge.findAdjacents( this.square, 'z' );
    let southAdjacents = this.square.southEdge.findAdjacents( this.square, 'x' );
    let eastAdjacents = this.square.eastEdge.findAdjacents( this.square, 'z' );

    if ( flashAdjacentColors ) {
      this.mesh.material.color = new THREE.Color( Math.random(), Math.random(), Math.random() );
      let adjacents = [].concat( northAdjacents, westAdjacents, southAdjacents, eastAdjacents );
      for ( let i = 0; i < adjacents.length; i++ ) {
        adjacents[i].square.reusedMesh.mesh.material.color =
          new THREE.Color( Math.random(), Math.random(), Math.random() );
      }
    }

    yield;

    for ( let m = 0; m <= downSize; m++ ) {
      for ( let n = 0; n <= downSize; n++ ) {
        let j = m * ( downSize + 1 ) + n;
        this.heightData[ j ] = 0;
        let x = this.centerX + this.width * ( n / downSize - 0.5 );
        let z = this.centerZ + this.width * ( m / downSize - 0.5 );
        let isSouthEdge = m == downSize;
        let isEastEdge = n == downSize;
        // let isNorthEdge = m == 0;
        // let isWestEdge = n == 0;
        // if ( isSouthEdge ) {
        //   for ( let i = 0; i < southAdjacents.length; i++ ) {
        //     let adjSquare = southAdjacents[i].square;
        //     let adjEdge = southAdjacents[i].edge;
            // let indexZ =
            // if ( adjSquare.width > this.square.width ) {
            //
            // }
        //   }
        // }
        // if ( isEastEdge ) {
          // for ( let t = 0; t < this.layer.tiles.length; t++ ) {
          //   if ( this.layer.tiles[ t ] != this ) {
          //     // obtain dataPoint from adjacent tiles
          //     let dataPoint = this.layer.tiles[ t ].reusedMesh.lookupDataPoint( x, z );
          //     if ( dataPoint != null ) {
          //       this.heightData[ j ] = dataPoint;
          //     }
          //   }
          // }
        // }
        if ( isSouthEdge == false && isEastEdge == false ) {
          let i = m * ( downscale ** 2 ) * downSize + n * downscale;
          let dataPoint = dataToHeight( imageData.slice( i * 4, i * 4 + 3 ) );
          this.heightData[ j ] = dataPoint;
          // if ( isNorthEdge ) {
          // }
          // if ( isWestEdge ) {
          //   for ( let t = 0; t < this.layer.tiles.length; t++ ) {
          //     if ( this.layer.tiles[ t ] != this ) {
          //       // report dataPoint to adjacent tiles
          //       this.layer.tiles[ t ].reusedMesh.setDataPoint( x, z, dataPoint );
          //       needsRefresh[ t ] = true;
          //     }
          //   }
          // }
        }
      }
    }

    // yield;
    //
    // for ( let i = 0; i < southAdjacents.length; i++ ) {
    //   let adjSquare = southAdjacents[i].square;
    //   let adjEdge = southAdjacents[i].edge;
    //   let indexZ =
    //   if ( adjSquare.width > this.square.width ) {
    //
    //   }
    // }

    yield;

    this.refreshMesh();
  }

  getDataPoint( x, z ) {
    let m = Math.round( ( z - ( this.centerZ - this.width / 2 ) ) / this.width * downSize );
    let n = Math.round( ( x - ( this.centerX - this.width / 2 ) ) / this.width * downSize );
    if ( m >= 0 && n >= 0 && m <= downSize && n <= downSize ) {
      let i = m * ( downSize + 1 ) + n;
      return this.heightData[ i ];
    } else {
      return null;
    }
  }

  setDataPoint( x, z, dataPoint ) {
    let m = Math.round( ( z - ( this.centerZ - this.width / 2 ) ) / this.width * downSize );
    let n = Math.round( ( x - ( this.centerX - this.width / 2 ) ) / this.width * downSize );
    if ( m >= 0 && n >= 0 && m <= downSize && n <= downSize ) {
      let i = m * ( downSize + 1 ) + n;
      this.heightData[ i ] = dataPoint;
    }
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
    this.square.updateBoundingBox = true;
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
