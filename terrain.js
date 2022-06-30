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
const terrainZoom = 12;
const polygonReduction = 2;
const maxZoom = terrainZoom + polygonReduction;
const satilliteZoom = 1;
const satiliteTilesWidth = 2 ** satilliteZoom;
if ( maxZoom + satilliteZoom > 20 ) { console.error( 'maxZoom + satilliteZoom > 20' ); }

let delayUpdate = false;
// let delayUpdate = true;
let delayFactor = 10;

let showGridHelper = false;
// let showGridHelper = true;

let showBoundingBoxHelper = false;
// let showBoundingBoxHelper = true;

let randomizeColors = false;
// let randomizeColors = true;

let flashAdjacentColors = false;
// let flashAdjacentColors = true;

let origin = {};
let width = {};

let squares = [];
let generatorQueue = [];
let meshBin = [];

export let cameraElevation = 0;

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

let frameCount = 0;
export function update() {
  frameCount++;
  if ( frameCount % delayFactor == 0 || delayUpdate == false ) {
    frustum.setFromProjectionMatrix( new THREE.Matrix4().multiplyMatrices( camera.projectionMatrix, camera.matrixWorldInverse ) );

    let cx = camera.position.x;
    let cz = camera.position.z;
    let elevationAtCamera = 0;
    for ( let i = 0; i < squares.length; i++ ) {
      if ( squares[i].pointIsWithin( cx, cz ) ) {
        if ( squares[i].reusedMesh != null ) {
          elevationAtCamera = squares[i].reusedMesh.lookupData( cx, cz )
            - curvatureOfTheEarth( cx, cz );
        }
      }
    }
    cameraElevation = camera.position.y - elevationAtCamera;
    if ( camera.position.y < elevationAtCamera + eyeHeight ) {
      camera.position.y = elevationAtCamera + eyeHeight;
    }

    for ( let i = squares.length - 1; i >= 0; i-- ) {
      if ( squares[i].removeFromSquares ) {
        squares[i].removeFromSquares = false;
        squares.splice( i, 1 );
      } else {
        squares[i].update();
      }
    }

    for ( let zoom = maxZoom; zoom >= minZoom; zoom-- ) {
      let breakOut = false;
      for ( let i = 0; i < generatorQueue.length; i++ ) {
        if ( generatorQueue[i].zoom == zoom ) {
          if ( generatorQueue[i].intendedSquare.visible == false ) {
            generatorQueue.splice( i, 1 );
          } else if ( generatorQueue[i].next().done ) {
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
    this.centerX = ( 0.5 + this.tile[0] - origin[this.zoom][0] ) * this.width;
    this.centerZ = ( 0.5 + this.tile[1] - origin[this.zoom][1] ) * this.width;

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
    let dataCopy = new DataCopy( this.reusedMesh );
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
      this.children[i].reusedMesh.pasteDataCopy( dataCopy );
      this.children[i].reusedMesh.refreshMesh();
      this.children[i].reusedMesh.mapAndUpdate();

    }
  }

  merge() {
    let dataCopies = [];
    for ( let i = 0; i < this.children.length; i ++ ) {
      dataCopies.push( new DataCopy( this.children[i].reusedMesh ) );
      this.children[i].makeNotVisible();
    }
    this.makeVisible();
    for ( let i = 0; i < this.children.length; i ++ ) {
      this.reusedMesh.pasteDataCopy( dataCopies[i] );
    }
    this.reusedMesh.refreshMesh();
    this.reusedMesh.mapAndUpdate();
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
    distance = Math.sqrt( distance ** 2 + cameraElevation ** 2 );
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
        if ( this.children[i].isTooSmall() == false || this.children[i].visible == false ) {
          allChildrenAreSmall = false;
        }
      }
    }
    return allChildrenAreSmall;
  }

  pointIsWithin( x, z ) {
    let m = ( z - ( this.centerZ - this.width / 2 ) ) / this.width * downSize;
    let n = ( x - ( this.centerX - this.width / 2 ) ) / this.width * downSize;
    if ( m > 0 && n > 0 && m < downSize && n < downSize ) {
      return true;
    } else {
      return false;
    }
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
      let dir = new THREE.Vector3().subVectors( this.endB, this.endA );
      dir.normalize();
      this.arrowHelper = new THREE.ArrowHelper( dir, this.endA, this.length, 0xff00ff, 0, 0 );
      this.show();
    }
  }

  split() {
    if ( this.splitAlready == false ) {
      this.splitAlready = true;

      let direction = new THREE.Vector3().subVectors( this.endB, this.endA );
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

  pointsOnEdge() {
    let points = [];
    for ( let i = 0; i <= downSize; i++ ) {
      let alpha = i / downSize;
      let newPoint = new THREE.Vector3().lerpVectors( this.endA, this.endB, alpha );
      points.push( newPoint );
    }
    return points;
  }

  pointIsWithinEnds( x, z ) {
    let xz = new THREE.Vector3( x, 0, z );
    xz.sub( this.endA );
    let direction = new THREE.Vector3().subVectors( this.endB, this.endA );
    direction.normalize();
    let dot = xz.dot( direction );
    if ( dot >= 0 && dot <= this.length ) {
      return true;
    } else {
      return false;
    }
  }
}

class ReusedMesh {
  constructor() {
    let geometry = new THREE.PlaneGeometry( 1, 1, downSize, downSize );
    geometry.rotateX( - Math.PI / 2 );

    let material = new THREE.MeshStandardMaterial( {
      roughness: 0.9,
      color: pineGreen
    } );
    if ( randomizeColors ) {
      material.color = new THREE.Color( Math.random(), Math.random(), Math.random() );
    }
    this.mesh = new THREE.Mesh( geometry, material );

    let canvas = document.createElement( 'canvas' );
    canvas.width = ELEVATION_TILE_SIZE;
    canvas.height = ELEVATION_TILE_SIZE;
    this.context = canvas.getContext( '2d', {willReadFrequently: true} );

    this.heightData = new Float32Array( ( downSize + 1 ) ** 2 );

    this.readyToLoad = false;

    this.texture = null;
    this.satelliteCanvas = null;

    this.satelliteCanvas = document.createElement( 'canvas' );
    this.satelliteCanvas.width = IMAGERY_TILE_SIZE * satiliteTilesWidth;
    this.satelliteCanvas.height = IMAGERY_TILE_SIZE * satiliteTilesWidth;
    this.texture = new THREE.CanvasTexture( this.satelliteCanvas );
    this.satilliteCtx = this.satelliteCanvas.getContext( '2d' );
  }

  reuse( square ) {
    this.square = square;
    this.zoom = square.zoom;
    this.width = square.width;
    this.mesh.scale.x = this.width;
    this.mesh.scale.z = this.width;
    this.centerX = square.centerX;
    this.centerZ = square.centerZ;
    this.mesh.position.x = this.centerX;
    this.mesh.position.z = this.centerZ;

    for ( let m = 0; m <= downSize; m++ ) {
      for ( let n = 0; n <= downSize; n++ ) {
        let j = m * ( downSize + 1 ) + n;
        this.heightData[j] = 0;
      }
    }

    this.refreshMesh();

    this.clearTexture();

    scene.add( this.mesh );

    this.readyToLoad = true;
  }

  loadUrl() {
    this.readyToLoad = false;
    let urlTile = this.square.tile;
    if ( urlTile[2] > terrainZoom ) { this.mesh.frustumCulled = false; }
    while ( urlTile[2] > terrainZoom ) { urlTile = tilebelt.getParent( urlTile ); }
    let url = urlForTile( ...urlTile, 'terrain' );
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

    let timeList = [];
    timeList.push( performance.now() );

    this.context.drawImage( image, 0, 0 );
    let imageData = this.context.getImageData( 0, 0, ELEVATION_TILE_SIZE, ELEVATION_TILE_SIZE ).data;

    yield;
    timeList.push( performance.now() );

    let urlTile = this.square.tile;
    while ( urlTile[2] > terrainZoom ) { urlTile = tilebelt.getParent( urlTile ); }
    let urlWidth = width[ urlTile[2] ];
    let urlCenterX =( 0.5 + urlTile[0] - origin[ urlTile[2] ][0] ) * urlWidth;
    let urlCenterZ =( 0.5 + urlTile[1] - origin[ urlTile[2] ][1] ) * urlWidth;

    for ( let m = 0; m <= downSize; m++ ) {
      for ( let n = 0; n <= downSize; n++ ) {
        let j = m * ( downSize + 1 ) + n;
        let x = this.centerX + this.width * ( n / downSize - 0.5 );
        let z = this.centerZ + this.width * ( m / downSize - 0.5 );
        this.heightData[j] = 0;
        let isSouthEdge = m == downSize;
        let isEastEdge = n == downSize;
        if ( isSouthEdge == false && isEastEdge == false ) {
          let u = Math.round( ( z - ( urlCenterZ - urlWidth / 2 ) ) / urlWidth * ELEVATION_TILE_SIZE );
          let v = Math.round( ( x - ( urlCenterX - urlWidth / 2 ) ) / urlWidth * ELEVATION_TILE_SIZE );
          let i = u * ELEVATION_TILE_SIZE + v;
          let dataPoint = dataToHeight( imageData.slice( i * 4, i * 4 + 3 ) );
          this.heightData[j] = dataPoint;
        }
      }
    }

    yield;
    timeList.push( performance.now() );

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
    timeList.push( performance.now() );

    for ( let i = 0; i < southAdjacents.length; i++ ) {
      let adjReusedMesh = southAdjacents[i].square.reusedMesh;
      let adjEdge = southAdjacents[i].edge;
      if ( adjReusedMesh != null ) {
        // adjReusedMesh.restoreEdge( 'n', this.square.southEdge );
        this.clampEdge( this.square.southEdge, adjReusedMesh, adjEdge );
        adjReusedMesh.clampEdge( adjEdge, this, this.square.southEdge );
      }
    }

    for ( let i = 0; i < eastAdjacents.length; i++ ) {
      let adjReusedMesh = eastAdjacents[i].square.reusedMesh;
      let adjEdge = eastAdjacents[i].edge;
      if ( adjReusedMesh != null ) {
        // adjReusedMesh.restoreEdge( 'w', this.square.eastEdge );
        this.clampEdge( this.square.eastEdge, adjReusedMesh, adjEdge );
        adjReusedMesh.clampEdge( adjEdge, this, this.square.eastEdge );
      }
    }

    for ( let i = 0; i < northAdjacents.length; i++ ) {
      let adjReusedMesh = northAdjacents[i].square.reusedMesh;
      let adjEdge = northAdjacents[i].edge;
      if ( adjReusedMesh != null ) {
        adjReusedMesh.clampEdge( adjEdge, this, this.square.northEdge );
        this.clampEdge( this.square.northEdge, adjReusedMesh, adjEdge );
      }
    }

    for ( let i = 0; i < westAdjacents.length; i++ ) {
      let adjReusedMesh = westAdjacents[i].square.reusedMesh;
      let adjEdge = westAdjacents[i].edge;
      if ( adjReusedMesh != null ) {
        adjReusedMesh.clampEdge( adjEdge, this, this.square.westEdge );
        this.clampEdge( this.square.westEdge, adjReusedMesh, adjEdge );
      }
    }

    yield;
    timeList.push( performance.now() );

    this.refreshMesh();

    let simpleConcat = [].concat( northAdjacents, westAdjacents, southAdjacents, eastAdjacents );
    let adjacents = [];
    for ( let i = 0; i < simpleConcat.length; i++ ) {
      let allreadyAdded = false;
      for ( let j = 0; j < adjacents.length; j++ ) {
        if ( simpleConcat[i].square == adjacents[j].square ) {
          allreadyAdded = true;
          break;
        }
      }
      if ( allreadyAdded == false ) {
        adjacents.push( simpleConcat[i] );
      }
    }
    for ( let i = 0; i < adjacents.length; i++ ) {
      if ( adjacents[i].square.reusedMesh != null ) {
        adjacents[i].square.reusedMesh.refreshMesh();
      }
    }

    timeList.push( performance.now() );
    let timeReport = '';
    for ( let i = 0; i < timeList.length - 1; i++ ) {
      timeReport += Math.round( timeList[i + 1] - timeList[i] ) + 'ms ';
    }
    // console.log( timeReport );

    this.loadSatellite();
  }

  loadSatellite() {

    const loader = new THREE.ImageLoader();
    for ( let x = 0; x < satiliteTilesWidth; x++ ) {
      for ( let y = 0; y < satiliteTilesWidth; y++ ) {
        let satiliteTile = [
          this.square.tile[ 0 ] * satiliteTilesWidth + x,
          this.square.tile[ 1 ] * satiliteTilesWidth + y,
          this.square.tile[ 2 ] + satilliteZoom
        ];
        let url = urlForTile( ...satiliteTile, 'satellite' );
        let thisReusedMesh = this;
        loader.load( url, function ( image ) {
            let newGenerator = thisReusedMesh.satelliteGenerator( image, x, y, );
            newGenerator.intendedSquare = thisReusedMesh.square;
            newGenerator.zoom = thisReusedMesh.zoom;
            generatorQueue.push( newGenerator );
          },
          undefined, // onProgress not supported
          function () {
            // console.error( 'satellite ImageLoader error' );
          }
        );
      }
    }
  }

  clearTexture() {
    this.satilliteCtx.fillStyle = '#' + pineGreen.getHexString();
    this.satilliteCtx.fillRect(0, 0, this.satelliteCanvas.width, this.satelliteCanvas.height);
    this.mapAndUpdate();
  }

  *satelliteGenerator( image, x, y ) {
    this.satilliteCtx.drawImage( image, x * IMAGERY_TILE_SIZE, y * IMAGERY_TILE_SIZE );
    this.mapAndUpdate();
  }

  mapAndUpdate() {
    this.mesh.material.map = this.texture;
    this.mesh.material.color = new THREE.Color();
    this.mesh.material.needsUpdate = true;
    this.texture.needsUpdate = true;
  }

  clampEdge( edge, reusedMesh, restrictToEdge ) {
    let points = edge.pointsOnEdge();
    for ( let i = 0; i < points.length; i++ ) {
      let x = points[i].x;
      let z = points[i].z;
      if ( restrictToEdge.pointIsWithinEnds( x, z ) ) {
        let dataPoint = reusedMesh.lookupData( x, z );
        if ( dataPoint != 0 ) {
          this.setDataPoint( x, z, dataPoint );
        }
      }
    }
  }

  lookupData( x, z ) {
    let m = ( z - ( this.centerZ - this.width / 2 ) ) / this.width * downSize;
    let n = ( x - ( this.centerX - this.width / 2 ) ) / this.width * downSize;

    if ( m < 0 ) { m = 0; }
    if ( n < 0 ) { n = 0; }
    if ( m > downSize ) { m = downSize; }
    if ( n > downSize ) { n = downSize; }

    let m1 = Math.floor( m );
    let m2 = Math.ceil( m );
    let n1 = Math.floor( n );
    let n2 = Math.ceil( n );

    let i11 = m1 * ( downSize + 1 ) + n1;
    let i21 = m2 * ( downSize + 1 ) + n1;
    let i12 = m1 * ( downSize + 1 ) + n2;
    let i22 = m2 * ( downSize + 1 ) + n2;

    let d11 = this.heightData[i11];
    let d21 = this.heightData[i21];
    let d12 = this.heightData[i12];
    let d22 = this.heightData[i22];

    if ( d11 == 0 || d21 == 0 || d12 == 0 || d22 == 0 ) {
      return 0;
    }

    let d1 = d11 + ( d21 - d11 ) * ( m - m1 );
    let d2 = d12 + ( d22 - d12 ) * ( m - m1 );
    let interpolated = d1 + ( d2 - d1 ) * ( n - n1 );

    return interpolated;
  }

  setDataPoint( x, z, dataPoint ) {
    let m = Math.round( ( z - ( this.centerZ - this.width / 2 ) ) / this.width * downSize );
    let n = Math.round( ( x - ( this.centerX - this.width / 2 ) ) / this.width * downSize );
    if ( m >= 0 && n >= 0 && m <= downSize && n <= downSize ) {
      let i = m * ( downSize + 1 ) + n;
      this.heightData[i] = dataPoint;
    }
  }

  refreshMesh() {
    let vertices = this.mesh.geometry.attributes.position.array;
    for ( let m = 0; m <= downSize; m++ ) {
      for ( let n = 0; n <= downSize; n++ ) {
        let i = m * ( downSize + 1 ) + n;
        let j = ( m * ( downSize + 1 ) + n ) * 3;
        let x = this.centerX + this.width * ( n / downSize - 0.5 );
        let z = this.centerZ + this.width * ( m / downSize - 0.5 );
        let mIsEdge = m == 0 || m == downSize;
        let nIsEdge = n == 0 || n == downSize;
        if ( !mIsEdge && !nIsEdge ) {
          vertices[ j + 1 ] = this.heightData[i];
        } else {
          vertices[ j + 1 ] = this.heightData[i];
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

  pasteDataCopy( dataCopy ) {
    for ( let m = 0; m <= downSize; m++ ) {
      for ( let n = 0; n <= downSize; n++ ) {
        let x = this.centerX + this.width * ( n / downSize - 0.5 );
        let z = this.centerZ + this.width * ( m / downSize - 0.5 );
        if ( dataCopy.pointWithinData( x, z ) ) {
          let j = m * ( downSize + 1 ) + n;
          this.heightData[j] = dataCopy.lookupData( x, z );
        }
      }
    }

    // let size = IMAGERY_TILE_SIZE * satiliteTilesWidth; // this.imageData.width
    // let sizeRatio = dataCopy.width / this.width;
    // // position to place the image data in the destination canvas.
    // let dx = 0;
    // let dy = 0;
    // // position of the top-left corner the image data will be extracted.
    // let dirtyX = 0; // ( dataCopy.centerX - this.centerX ) / this.width;
    // let dirtyY = 0; // ( dataCopy.centerZ - this.centerZ ) / this.width;
    // // size of the rectangle to be painted. Defaults to the width of the image data.
    // let dirtyWidth = size / sizeRatio;
    // let dirtyHeight = size / sizeRatio;
    // this.satilliteCtx.putImageData(
    //   // dataCopy.imageData, dx, dy, dirtyX, dirtyY, dirtyWidth, dirtyHeight
    //   dataCopy.imageData, dx, dy, dirtyX, dirtyY
    // );

    let size = IMAGERY_TILE_SIZE * satiliteTilesWidth; // this.imageData.width
    let sizeRatio = dataCopy.width / this.width;
    // let sx = 0;
    // let sy = 0;
    // let sWidth = size;
    // let sHeight = size;
    // let dx = ( dataCopy.centerX - this.centerX ) / this.width * size;
    // let dy = ( dataCopy.centerZ - this.centerZ ) / this.width * size;
    let dx = ( ( dataCopy.centerX - dataCopy.width / 2 ) - ( this.centerX - this.width / 2 ) ) / this.width * size;
    let dy = ( ( dataCopy.centerZ - dataCopy.width / 2 ) - ( this.centerZ - this.width / 2 ) ) / this.width * size;
    let dWidth = size * sizeRatio;
    let dHeight = size * sizeRatio;
    // let thisReusedMesh = this;
    // dataCopy.savedImage.onload = function() {
    //   thisReusedMesh.satilliteCtx.drawImage( dataCopy.savedImage, dx, dy, dWidth, dHeight );
    // };

    this.satilliteCtx.drawImage( dataCopy.canvas, dx, dy, dWidth, dHeight );
    // this.satilliteCtx.drawImage(
    //   dataCopy.canvas, sx, sy, sWidth, sHeight, dx, dy, dWidth, dHeight
    // );
  }
}

class DataCopy {
  constructor( reusedMesh ) {
    this.width = reusedMesh.width;
    this.centerX = reusedMesh.centerX;
    this.centerZ = reusedMesh.centerZ;
    this.heightData = reusedMesh.heightData.slice();

    // let size = IMAGERY_TILE_SIZE * satiliteTilesWidth;
    // let raw = reusedMesh.satilliteCtx.getImageData( 0, 0, size, size ).data.slice();
    // // to do, to slice or not to slice, that is the question
    // this.imageData = new ImageData( raw, size );

    // this.savedImage = new Image();
    // this.savedImage.src = reusedMesh.satelliteCanvas.toDataURL();

    this.canvas = document.createElement('canvas');
    this.canvas.width = reusedMesh.satelliteCanvas.width;
    this.canvas.height = reusedMesh.satelliteCanvas.height;
    var context = this.canvas.getContext('2d');
    context.drawImage( reusedMesh.satelliteCanvas, 0, 0 );
  }

  pointWithinData( x, z ) {
    let m = ( z - ( this.centerZ - this.width / 2 ) ) / this.width * downSize;
    let n = ( x - ( this.centerX - this.width / 2 ) ) / this.width * downSize;
    if ( m >= -1 && n >= -1 && m <= downSize + 1 && n <= downSize + 1 ) {
      return true;
    } else {
      return false;
    }
  }

  lookupData( x, z ) {
    let m = ( z - ( this.centerZ - this.width / 2 ) ) / this.width * downSize;
    let n = ( x - ( this.centerX - this.width / 2 ) ) / this.width * downSize;

    if ( m < 0 ) { m = 0; }
    if ( n < 0 ) { n = 0; }
    if ( m > downSize ) { m = downSize; }
    if ( n > downSize ) { n = downSize; }

    let m1 = Math.floor( m );
    let m2 = Math.ceil( m );
    let n1 = Math.floor( n );
    let n2 = Math.ceil( n );

    let i11 = m1 * ( downSize + 1 ) + n1;
    let i21 = m2 * ( downSize + 1 ) + n1;
    let i12 = m1 * ( downSize + 1 ) + n2;
    let i22 = m2 * ( downSize + 1 ) + n2;

    let d11 = this.heightData[i11];
    let d21 = this.heightData[i21];
    let d12 = this.heightData[i12];
    let d22 = this.heightData[i22];

    if ( d11 == 0 || d21 == 0 || d12 == 0 || d22 == 0 ) {
      return 0;
    }

    let d1 = d11 + ( d21 - d11 ) * ( m - m1 );
    let d2 = d12 + ( d22 - d12 ) * ( m - m1 );
    let interpolated = d1 + ( d2 - d1 ) * ( n - n1 );

    return interpolated;
  }
}

const ELEVATION_TILE_SIZE = 512;
const downscale = 2 ** polygonReduction;
const downSize = ELEVATION_TILE_SIZE / downscale;
const IMAGERY_TILE_SIZE = 256;
const apiKey = 'MrM7HIm1w0P1BQYO7MY3'; // restricted to nlmusic.net
let urlFormat = {
  terrain: 'https://api.maptiler.com/tiles/terrain-rgb/{z}/{x}/{y}.png?key={apiKey}',
  satellite: 'https://api.maptiler.com/tiles/satellite/{z}/{x}/{y}.jpg?key={apiKey}'
  // protocolbuffer: 'https://api.maptiler.com/tiles/v3/{z}/{x}/{y}.pbf?key={apiKey}'
  // https://wiki.openstreetmap.org/wiki/PBF_Format
}
function urlForTile( x, y, z, type ) {
  return urlFormat[type].replace( '{x}', x ).replace( '{y}', y )
    .replace( '{z}', z ).replace( '{apiKey}', apiKey );
}
function dataToHeight( data ) {
  // Elevation in meters
  return -10000 + ( data[0] * 65536 + data[1] * 256 + data[2] ) * 0.1;
}
function curvatureOfTheEarth( x, z ) {
  return ( x ** 2 + z ** 2 ) / ( 2 * earthsRaius );
}
