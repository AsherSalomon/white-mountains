import * as THREE from 'three';
import * as tilebelt from './lib/tilebelt.js';

let scene, camera, frustum;

const latitude = 44.2705; // Mt. Washington
const longitude = -71.30325;
const earthsRaius = 6371000; // meters
// const maxElevation = 1916.582; // 9144; // meters
// // const horizonDistance = Math.sqrt( ( earthsRaius + maxElevation ) ** 2 - earthsRaius ** 2 );
// // console.log( 'Horizon '+ Math.round( horizonDistance ) + ' m' );
let baseTileWidth; // 6999.478360682135 meters at maxZoom['terrain']
// const angularResolution = 4 / 1; // tile width / distance to camera
//
// const downfactor = 1;

let maxZoom = {
  terrain: 12,
  satellite: 20
}
const minZoom = 5;

const ELEVATION_TILE_SIZE = 512;
const IMAGERY_TILE_SIZE = 256;

let grid = [];
// // let recyclingBin = [];

let apiKey = '5oT5Np7ipsbVhre3lxdi';
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

// let idCounter = 1;
class Tile {
  constructor( tile, parent ) {
//     this.id = idCounter++;
//
    this.tile = tile;
    this.parent = parent;
//     this.siblings = null;
//     this.children = [];
//     if ( this.parent != null ) {
//       if ( this.parent.children.length < 4 ) {
//         this.parent.children.push( this );
//       }
//     }
//     // this.quadkey = tilebelt.tileToQuadkey( this.tile );
//     this.remove = false;
//     this.inScene = false;
    this.width = Math.pow( 2, maxZoom['terrain'] - this.tile[ 2 ] ) * baseTileWidth;
//     this.boundingBox = null;

    this.geometry = null;
    this.groundMaterial = null;
    this.terrainMesh = null;
    this.loading = false;

  }
  update() {
    if ( !this.inScene ) {

    // 	this.gridHelper = new THREE.GridHelper( this.width, 1 );
    //   let origin = tilebelt.pointToTileFraction( longitude, latitude, this.tile[ 2 ] );
    //   let dx = ( 0.5 + this.tile[ 0 ] - origin[ 0 ] ) * this.width;
    //   let dz = ( 0.5 + this.tile[ 1 ] - origin[ 1 ] ) * this.width;
    //   this.gridHelper.translateX( dx );
    //   this.gridHelper.translateZ( dz );
    // 	scene.add( this.gridHelper );
    //   this.boundingBox = new THREE.Box3();
    //   this.boundingBox.expandByObject( this.gridHelper );
    //   scene.remove( this.gridHelper );
      this.inScene = true;
      this.loading = false;
    //
    // } else {
    //   let splitOrMerge = false;
    //   if ( this.tile[ 2 ] < maxZoom['terrain'] ) {
    //     if ( this.isTooBig() ) {
    //       this.split();
    //       splitOrMerge = true;
    //     }
    //   }
    //   if ( splitOrMerge == false && this.tile[ 2 ] > minZoom ) {
    //     if ( this.allSmall() ) {
    //       this.parent.merge();
    //       splitOrMerge = true;
    //     }
    //   }
    //   if ( splitOrMerge == false && this.loading == false ) {
    //     if ( frustum.intersectsBox( this.boundingBox ) ) {
    //       this.loading = true;
          this.loadTerrain();
    //     }
    //   }
    }
  };
//   isTile( tile ) {
//     return tilebelt.tilesEqual( tile, this.tile );
//   }
//   distanceFromCamera() {
//     // let flatCameraPosition = new THREE.Vector3();
//     // flatCameraPosition.copy( camera.position );
//     // flatCameraPosition.y = 0;
//     // return this.gridHelper.position.distanceTo( flatCameraPosition );
//     let positionDelta = new THREE.Vector3().subVectors( this.gridHelper.position, camera.position );
//     let deltaX = Math.abs( positionDelta.x ) - this.width / 2;
//     let deltaZ = Math.abs( positionDelta.z ) - this.width / 2;
//     let distance = 0;
//     if ( deltaX < 0 || deltaZ < 0 ) {
//       distance = Math.max( deltaX, deltaZ );
//       if ( distance < 0 ) { distance = 0; }
//     } else {
//       distance = Math.sqrt( deltaX ** 2 + deltaZ ** 2 );
//     }
//     return distance;
//   }
//   isTooBig() {
//     let tooBig = this.width / this.distanceFromCamera() > angularResolution;
//     return tooBig && frustum.intersectsBox( this.boundingBox );
//   }
//   isTooSmall() {
//     let tooSmall = this.width / this.distanceFromCamera() < angularResolution / 2;
//     return tooSmall; // || frustum.intersectsBox( this.boundingBox ) == false;
//   }
//   allSmall() {
//     let allSiblingsAreSmall = false;
//     if ( this.siblings != null ) {
//       allSiblingsAreSmall = true;
//       for ( let i = 0; i < 4; i ++ ) {
//         if ( this.siblings[ i ].isTooSmall() == false ) {
//           allSiblingsAreSmall = false;
//         }
//       }
//     }
//     return allSiblingsAreSmall;
//   }
//   split() {
//     if ( this.children.length == 0 ) {
//       let children = tilebelt.getChildren( this.tile );
//       // let childrenNames = [ 'NW', 'NE', 'SE', 'SW' ];
//       // tilebelt.pointToTileFraction(-71,44,5);
//       // [9.68888888888889, 11.635830890888538, 5]
//       // tilebelt.pointToTileFraction(-70,44,5);
//       // [9.777777777777779, 11.635830890888538, 5]
//       // tilebelt.pointToTileFraction(-71,45,5);
//       // [9.68888888888889, 11.511201181286559, 5]
//       let siblings = [];
//       for ( let i = 0; i < 4; i ++ ) {
//         let newTile = new Tile( children[ i ], this )
//         siblings.push( newTile );
//         grid.push( newTile );
//       }
//       for ( let i = 0; i < 4; i ++ ) {
//         siblings[ i ].siblings = siblings;
//       }
//     } else if ( this.children.length == 4 ) {
//       for ( let i = 0; i < 4; i ++ ) {
//         grid.push( this.children[ i ] );
//       }
//     }
//     this.remove = true;
//   }
//   merge() {
//     for ( let i = 0; i < 4; i ++ ) {
//       this.children[ i ].remove = true;
//     }
//     grid.push( this );
//   }
//   dataToHeight( data ) {
//     // Elevation in meters
//     return -10000 + ( data[ 0 ] * 65536 + data[ 1 ] * 256 + data[ 2 ] ) * 0.1;
//   }
  loadTerrain() {
    let thisTile = this;

    let url = urlForTile( ...this.tile, 'terrain' );
    const loader = new THREE.ImageLoader();
    loader.load( url, function ( image ) {
        generatorQueue.push( thisTile.terrainGenerator( image ) );
      },
      undefined, // onProgress not supported
      function () {
        console.error( 'terrain ImageLoader error' );
      }
    );
  }
  *terrainGenerator( image ) {

    let timeList = [];
    timeList.push( performance.now() );

    // var startTime = performance.now();
    //
    // var endTime = performance.now();
    // console.log('Generator took ' + ( endTime - startTime ) + ' milliseconds');

    let thisTile = this;

    if ( thisTile.inScene ) {

      const canvas = document.createElement( 'canvas' );
      canvas.width = ELEVATION_TILE_SIZE;
      canvas.height = ELEVATION_TILE_SIZE;
      // https://stackoverflow.com/questions/57834004/why-there-is-a-big-different-time-consuming-when-canvas-function-getimagedata-ex
      const ctx = canvas.getContext( '2d', {willReadFrequently: true} );
      ctx.drawImage( image, 0, 0 );
      let imageData = ctx.getImageData( 0, 0, ELEVATION_TILE_SIZE, ELEVATION_TILE_SIZE ).data;

      yield;
      timeList.push( performance.now() );

      let downsample = 2 ** downfactor;
      // if ( thisTile.tile[ 2 ] == maxZoom['terrain'] ) { downsample = 1; }

      const size = ( ELEVATION_TILE_SIZE / downsample ) ** 2;
      const heightData = new Float32Array( size );
      for ( let m = 0, i = 0, j = 0; m < ELEVATION_TILE_SIZE / downsample; m++ ) {
        for ( let n = 0; n < ELEVATION_TILE_SIZE / downsample; n++, j++ ) {
          i = m * downsample * ELEVATION_TILE_SIZE + n * downsample;
          heightData[ j ] = thisTile.dataToHeight( imageData.slice( i * 4, i * 4 + 3 ) );
        }
      }
      const widthSegments = Math.sqrt( heightData.length ) - 1;

      yield;
      timeList.push( performance.now() );

      thisTile.geometry = new THREE.PlaneGeometry( thisTile.width, thisTile.width, widthSegments, widthSegments );
      // if ( recyclingBin.length > 0 ) {
      //   thisTile.geometry = recyclingBin.shift();
      // } else {
      // thisTile.geometry = new THREE.PlaneGeometry( 1, 1, widthSegments, widthSegments );
      thisTile.geometry.rotateX( - Math.PI / 2 );
      // }

      yield;
      timeList.push( performance.now() );

      let origin = tilebelt.pointToTileFraction( longitude, latitude, thisTile.tile[ 2 ] );
      let dx = ( 0.5 + thisTile.tile[ 0 ] - origin[ 0 ] ) * thisTile.width;
      let dz = ( 0.5 + thisTile.tile[ 1 ] - origin[ 1 ] ) * thisTile.width;
      thisTile.geometry.translate( dx, 0, dz );
      // console.log( thisTile.geometry.position );
      // thisTile.geometry.position.set( dx, 0, dz );
      // thisTile.geometry.scale.set( thisTile.width, 0, thisTile.width );

      const vertices = thisTile.geometry.attributes.position.array;

      let curvatureOfTheEarth;
      for ( let i = 0, j = 0, l = vertices.length; i < l; i ++, j += 3 ) {
        curvatureOfTheEarth = ( vertices[ j + 0 ] ** 2 + vertices[ j + 2 ] ** 2 ) / ( 2 * earthsRaius );
        vertices[ j + 1 ] = heightData[ i ] - curvatureOfTheEarth;
      }

      thisTile.geometry.computeVertexNormals();
      // thisTile.groundMaterial = new THREE.MeshPhongMaterial( { color: 0x164a19 } );
      thisTile.groundMaterial = new THREE.MeshStandardMaterial( { roughness: 0.5 } );
      thisTile.terrainMesh = new THREE.Mesh( thisTile.geometry, thisTile.groundMaterial );

      // thisTile.terrainMesh.position.set( dx, 0, dz );
      // thisTile.terrainMesh.scale.set( thisTile.width, 1, thisTile.width );

      scene.add( thisTile.terrainMesh );
      // thisTile.boundingBox.expandByObject( thisTile.terrainMesh );
      thisTile.loadSatellite();
    }

    timeList.push( performance.now() );

    let timeReport = 'Terrain Generator took ';
    for ( let i = 0; i < timeList.length - 1; i++ ) {
      timeReport += Math.round( timeList[ i + 1 ] - timeList[ i ] ) + 'ms ';
    }
    // console.log( timeReport );
  }
  loadSatellite() {
    let thisTile = this;
    // to do: multiple satilite images to one terrain tile
    // let satilliteZoom = 2; // maxZoom['satellite'];
    // let bumpItUp = Math.pow( 2, satilliteZoom );
    let url = urlForTile( ...this.tile, 'satellite' );
    const loader = new THREE.ImageLoader();
    loader.load( url, function ( image ) {
        generatorQueue.push( thisTile.satelliteGenerator( image ) );
      },
      undefined, // onProgress not supported
      function () {
        console.error( 'satellite ImageLoader error' );
      }
    );
  }
  *satelliteGenerator( image ) {
    let thisTile = this;

    if ( thisTile.inScene ) {
      let satelliteCanvas = document.createElement( 'canvas' );
      satelliteCanvas.width = IMAGERY_TILE_SIZE;// * bumpItUp;
      satelliteCanvas.height = IMAGERY_TILE_SIZE;// * bumpItUp;
      const ctx = satelliteCanvas.getContext( '2d' );
      ctx.drawImage( image, 0, 0 );
      let texture = new THREE.CanvasTexture( satelliteCanvas );
      thisTile.groundMaterial.map = texture;
      thisTile.groundMaterial.color = new THREE.Color();
      thisTile.groundMaterial.needsUpdate = true;
    }
  }
  dispose() {
    this.remove = false;
    // scene.remove( this.gridHelper );
    if ( this.terrainMesh != null ) {
      scene.remove( this.terrainMesh );
      this.terrainMesh.geometry.dispose();
      this.terrainMesh.material.dispose();
      this.terrainMesh = null;
      this.geometry.dispose();
      // recyclingBin.push( this.geometry );
      this.geometry = null;
    }
    this.inScene = false;
  }
//   hasTheSameIdAs( anotherTile ) {
//     return this.id == anotherTile.id;
//   }
}

let generatorQueue = [];
function updateGeneratorQueue() {
  // https://github.com/simondevyoutube/ProceduralTerrain_Part4/blob/master/src/terrain.js
  // TerrainChunkRebuilder
  if ( generatorQueue.length > 0 ) {
    if ( generatorQueue[ 0 ].next().done ) {
      generatorQueue.shift();
    }
  }
}

export function init( newScene, newCamera ) {
  scene = newScene;

  let baseTile = tilebelt.pointToTile( longitude, latitude,  maxZoom['terrain'] );
  // console.log( baseTile );
  let bbox = tilebelt.tileToBBOX( baseTile ); // [w, s, e, n]
  let deltaNS = bbox[3] - bbox[1]; // n - s
  let deltaEW = bbox[2] - bbox[0]; // e - w
  let tileWidthNS = earthsRaius * deltaNS * Math.PI / 180;
  let tileWidthEW = earthsRaius * deltaEW * Math.PI / 180 * Math.cos( latitude * Math.PI / 180 );
  baseTileWidth = ( tileWidthNS + tileWidthEW ) / 2;

  let tile = tilebelt.pointToTile( longitude, latitude, minZoom );
  grid.push( new Tile( tile, null ) );

// 	// const helper = new THREE.PolarGridHelper( horizonDistance, 4, 1, 12 );
// 	// scene.add( helper );
//
//   frustum = new THREE.Frustum();
}

export function update() {
//   // https://stackoverflow.com/questions/24877880/three-js-check-if-object-is-in-frustum
//   frustum.setFromProjectionMatrix( new THREE.Matrix4().multiplyMatrices( camera.projectionMatrix, camera.matrixWorldInverse ) );

  // let counter = 0;
  for ( let i = grid.length - 1; i >= 0 ; i-- ) {
    if ( grid[ i ].remove ) {
      grid[ i ].dispose();
      grid.splice( i, 1 );
    } else {
      grid[ i ].update();
      // if ( grid[ i ].tile[ 2 ] == maxZoom[ 'terrain' ] ) {
      //   counter++;
      // }
    }
  }
  // console.log('There are '+ counter +' maxZoom tiles.')

  updateGeneratorQueue();

}
