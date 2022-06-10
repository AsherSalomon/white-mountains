import * as THREE from 'three';
import * as tilebelt from './lib/tilebelt.js';

let scene, camera;

const latitude = 44.2705; // Mt. Washington
const longitude = -71.30325;
const earthsRaius = 6371000; // meters
const eyeHeight = 1.6256; // meters
const maxElevation = 1916.582; // 9144; // meters
const horizonDistance = Math.sqrt( ( earthsRaius + maxElevation ) ** 2 - earthsRaius ** 2 );
// console.log( 'Horizon '+ Math.round( horizonDistance ) + ' m' ); // 156284m
let baseTileWidth; // 6999.478360682135 meters at maxZoom['terrain']

const minZoom = 6;
let maxZoom = {
  terrain: 12,
  satellite: 20, // actualy 20 but max canvas size is limited, 17 on chrome
}
// const enhancedSatellite = 17;
let satilliteZoom = 2;
let enhancedZoom = 14;

const ELEVATION_TILE_SIZE = 512;
const IMAGERY_TILE_SIZE = 256;

const pineGreen = new THREE.Color( 0x204219 );
// console.log(  );

let grid = [];

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

function curvatureOfTheEarth( x, z ) {
  return ( x ** 2 + z ** 2 ) / ( 2 * earthsRaius );
}

class Tile {

  constructor( z ) {

    this.z = z;
    this.width = Math.pow( 2, maxZoom['terrain'] - this.z ) * baseTileWidth;
    this.origin = tilebelt.pointToTileFraction( longitude, latitude, this.z );

    this.tile = tilebelt.pointToTile( longitude, latitude, this.z );
    this.parent = null;
    this.child = null;
    this.inScene = false;

    this.geometry = null;
    this.groundMaterial = null;
    this.terrainMesh = null;
    this.satelliteCanvas = null;
    this.texture = null;
    this.loading = false;

		this.clipPlanes = null;

    this.storedData = null;

    this.centerX = null;
    this.centerZ = null;
    this.reCenter();

    this.heightData = new Float32Array( ELEVATION_TILE_SIZE ** 2 );

    this.generatorQueue = [];
  }
  reCenter() {
    this.centerX = ( 0.5 + this.tile[ 0 ] - this.origin[ 0 ] ) * this.width;
    this.centerZ = ( 0.5 + this.tile[ 1 ] - this.origin[ 1 ] ) * this.width;
  }
  setClippingPlanes() {
    this.clipPlanes = [
      new THREE.Plane( new THREE.Vector3( 1, 0, 0 ), -this.centerX - this.width / 2 ),
      new THREE.Plane( new THREE.Vector3( -1, 0, 0 ), this.centerX - this.width / 2 ),
      new THREE.Plane( new THREE.Vector3( 0, 0, 1 ), -this.centerZ - this.width / 2 ),
      new THREE.Plane( new THREE.Vector3( 0, 0, - 1 ), this.centerZ - this.width / 2 )
    ];
    if ( this.parent != null ) {
      if ( this.parent.groundMaterial != null ) {
        this.parent.groundMaterial.clippingPlanes = this.clipPlanes;
      }
    }
  }
  update() {
    // let centerX = ( 0.5 + this.tile[ 0 ] - this.origin[ 0 ] ) * this.width;
    // let centerZ = ( 0.5 + this.tile[ 1 ] - this.origin[ 1 ] ) * this.width;

    let deltaX = Math.round( ( camera.position.x - this.centerX ) / this.width );
    let deltaZ = Math.round( ( camera.position.z - this.centerZ ) / this.width );

    let moveToNewTile = false;
    let newTile = null;
    if ( deltaX != 0 || deltaZ != 0 ) {
      moveToNewTile = true;
      newTile = [ this.tile[ 0 ] + deltaX, this.tile[ 1 ] + deltaZ,  this.tile[ 2 ]];
    }

    if ( ( this.inScene == false || moveToNewTile ) && this.loading == false ) {
      // let childLoading = false;
      // if ( this.child != null ) {
      //   if ( this.child.loading ) {
      //     childLoading = true;
      //   }
      // }
      // if ( childLoading == false ) {
      // }
      if ( moveToNewTile ) { this.tile = newTile; }

      this.reCenter();

      this.loading = true;
      this.loadTerrain();
    }
  };
  dataToHeight( data ) {
    // Elevation in meters
    return -10000 + ( data[ 0 ] * 65536 + data[ 1 ] * 256 + data[ 2 ] ) * 0.1;
  }
  loadTerrain() {
    if ( this.tile[ 2 ] <= maxZoom['terrain'] ) {
      let url = urlForTile( ...this.tile, 'terrain' );
      const loader = new THREE.ImageLoader();
      let thisTile = this;
      loader.load( url, function ( image ) {
          thisTile.generatorQueue.push( thisTile.terrainGenerator( image, thisTile.tile.slice() ) );
        },
        undefined, // onProgress not supported
        function () {
          console.error( 'terrain ImageLoader error' );
        }
      );
    } else {
        this.generatorQueue.push( this.terrainGenerator( null, this.tile.slice() ) );
    }
  }
  *terrainGenerator( image, intendedTile ) {
    if ( !tilebelt.tilesEqual( this.tile, intendedTile ) ) {
      console.error( 'terrain not intended tile' );
    }

    let timeList = [];
    timeList.push( performance.now() );

    // var startTime = performance.now();
    //
    // var endTime = performance.now();
    // console.log('Generator took ' + ( endTime - startTime ) + ' milliseconds');

    if ( image != null ) {
      const canvas = document.createElement( 'canvas' );
      canvas.width = ELEVATION_TILE_SIZE;
      canvas.height = ELEVATION_TILE_SIZE;
      // https://stackoverflow.com/questions/57834004/why-there-is-a-big-different-time-consuming-when-canvas-function-getimagedata-ex
      const ctx = canvas.getContext( '2d', {willReadFrequently: true} );
      ctx.drawImage( image, 0, 0 );
      let imageData = ctx.getImageData( 0, 0, ELEVATION_TILE_SIZE, ELEVATION_TILE_SIZE ).data;

      yield;
      timeList.push( performance.now() );

      for ( let i = 0; i < ELEVATION_TILE_SIZE ** 2; i++ ) {
        this.heightData[ i ] = this.dataToHeight( imageData.slice( i * 4, i * 4 + 3 ) );
      }
    }

    yield;
    timeList.push( performance.now() );

    if ( this.geometry == null ) {
      this.geometry = new THREE.PlaneGeometry(
        this.width, this.width, ELEVATION_TILE_SIZE, ELEVATION_TILE_SIZE
      );
      this.geometry.rotateX( - Math.PI / 2 );
    }

    yield;
    timeList.push( performance.now() );

    const vertices = this.geometry.attributes.position.array;

    // let curvatureOfTheEarth;
    for ( let m = 0; m < ELEVATION_TILE_SIZE + 1; m++ ) {
      for ( let n = 0; n < ELEVATION_TILE_SIZE + 1; n++ ) {
        let i = m * ELEVATION_TILE_SIZE + n;
        let j = ( m * ( ELEVATION_TILE_SIZE + 1 ) + n ) * 3;
        let x = vertices[ j + 0 ] + this.centerX;
        let z = vertices[ j + 2 ] + this.centerZ;
        // curvatureOfTheEarth = ( x ** 2 + z ** 2 ) / ( 2 * earthsRaius );
        let mIsEdge = m == 0 || m == ELEVATION_TILE_SIZE;
        let nIsEdge = n == 0 || n == ELEVATION_TILE_SIZE;
        if ( !mIsEdge && !nIsEdge ) {
          if ( image == null ) {
            this.heightData[ i ] = this.parent.lookupData( x, z );
          }
          vertices[ j + 1 ] = this.heightData[ i ] - curvatureOfTheEarth( x, z );
        } else if ( this.parent != null ) {
          vertices[ j + 1 ] = this.parent.lookupData( x, z ) - curvatureOfTheEarth( x, z );
        } else {
          vertices[ j + 1 ] = 0 - curvatureOfTheEarth( x, z );
        }
      }
    }

    if ( this.inScene ) {
      this.geometry.setAttribute( 'position', new THREE.Float32BufferAttribute( vertices, 3 ) );
    }

    this.geometry.computeVertexNormals();

    if ( this.groundMaterial == null ) {
      this.groundMaterial = new THREE.MeshStandardMaterial( {
        roughness: 0.9,
        clipIntersection: true,
        color: pineGreen
      } );
    }

    if ( this.terrainMesh == null ) {
      this.terrainMesh = new THREE.Mesh( this.geometry, this.groundMaterial );
    }

    this.terrainMesh.position.x = this.centerX;
    this.terrainMesh.position.z = this.centerZ;
    if ( this.inScene == false ) {
      this.inScene = true;
      scene.add( this.terrainMesh );
      if ( image == null ) {
        console.log('scene.add');
      }
    }
    this.loading = false;
    this.setClippingPlanes();

    this.loadSatellite();

    timeList.push( performance.now() );

    let timeReport = 'Terrain Generator took ';
    for ( let i = 0; i < timeList.length - 1; i++ ) {
      timeReport += Math.round( timeList[ i + 1 ] - timeList[ i ] ) + 'ms ';
    }
    // console.log( timeReport );

    if ( image == null ) {
      this.terrainMesh.frustumCulled = false;
    }
  }
  loadSatellite() {
    if ( this.texture != null ) {
      this.texture.dispose();
      this.groundMaterial.map = null;
      this.groundMaterial.needsUpdate = true;
      this.groundMaterial.color = pineGreen;
      this.satelliteCanvas = null;
    }

    // let satilliteZoom;
    // if ( this.z == maxZoom['terrain'] ) {
    //   satilliteZoom = enhancedSatellite - maxZoom['terrain'];
    // } else {
    //   satilliteZoom = maxZoom['satellite'] - maxZoom['terrain'];
    // }
    let satiliteTilesWidth = Math.pow( 2, satilliteZoom );

    if ( this.z + satilliteZoom > maxZoom['satellite'] ) {
      console.error( 'this.z + satilliteZoom > maxZoom[satellite]' );
    }

    this.satelliteCanvas = document.createElement( 'canvas' );
    this.satelliteCanvas.width = IMAGERY_TILE_SIZE * satiliteTilesWidth;
    this.satelliteCanvas.height = IMAGERY_TILE_SIZE * satiliteTilesWidth;
    this.texture = new THREE.CanvasTexture( this.satelliteCanvas );
    const ctx = this.satelliteCanvas.getContext( '2d' );
    ctx.fillStyle = '#' + pineGreen.getHexString();
    ctx.fillRect(0, 0, this.satelliteCanvas.width, this.satelliteCanvas.height);
    // this.groundMaterial.map = this.texture;
    // this.groundMaterial.color = new THREE.Color();
    // this.groundMaterial.needsUpdate = true;

    const loader = new THREE.ImageLoader();
    for ( let x = 0; x < satiliteTilesWidth; x++ ) {
      for ( let y = 0; y < satiliteTilesWidth; y++ ) {
        let satiliteTile = [
          this.tile[ 0 ] * satiliteTilesWidth + x,
          this.tile[ 1 ] * satiliteTilesWidth + y,
          this.tile[ 2 ] + satilliteZoom
        ];
        let url = urlForTile( ...satiliteTile, 'satellite' );
        let thisTile = this;
        loader.load( url, function ( image ) {
            thisTile.generatorQueue.push(
              thisTile.satelliteGenerator( image, x, y, thisTile.tile.slice() )
            );
          },
          undefined, // onProgress not supported
          function () {
            console.error( 'satellite ImageLoader error' );
          }
        );
      }
    }
  }
  *satelliteGenerator( image, x, y, intendedTile ) {
    if ( tilebelt.tilesEqual( this.tile, intendedTile ) ) {
      const ctx = this.satelliteCanvas.getContext( '2d' );
      ctx.drawImage( image, x * IMAGERY_TILE_SIZE, y * IMAGERY_TILE_SIZE );
      this.groundMaterial.map = this.texture;
      this.groundMaterial.color = new THREE.Color();
      this.groundMaterial.needsUpdate = true;
      this.texture.needsUpdate = true;
    }
  }
  lookupData( x, z ) {
    let m = ( z - ( this.centerZ - this.width / 2 ) ) / this.width * ELEVATION_TILE_SIZE;
    let n = ( x - ( this.centerX - this.width / 2 ) ) / this.width * ELEVATION_TILE_SIZE;
    if ( m > 0 && n > 0 && m < ELEVATION_TILE_SIZE - 1 && n < ELEVATION_TILE_SIZE - 1 ) {
      let m1 = Math.floor( m );
      let m2 = Math.ceil( m );
      let n1 = Math.floor( n );
      let n2 = Math.ceil( n );
      let i11 = m1 * ELEVATION_TILE_SIZE + n1;
      let i21 = m2 * ELEVATION_TILE_SIZE + n1;
      let i12 = m1 * ELEVATION_TILE_SIZE + n2;
      let i22 = m2 * ELEVATION_TILE_SIZE + n2;
      let d11 = this.heightData[ i11 ];
      let d21 = this.heightData[ i21 ];
      let d12 = this.heightData[ i12 ];
      let d22 = this.heightData[ i22 ];
      let d1 = d11 + ( d21 - d11 ) * ( m - m1 );
      let d2 = d12 + ( d22 - d12 ) * ( m - m1 );
      let interpolated = d1 + ( d2 - d1 ) * ( n - n1 );
      return interpolated;
      // return this.heightData[ Math.round( m ) * ELEVATION_TILE_SIZE + Math.round( n ) ];
    } else if ( this.parent != null ) {
      return this.parent.lookupData( x, z );
    } else {
      return 0;
    }
  }
  updateGeneratorQueue() {
    // https://github.com/simondevyoutube/ProceduralTerrain_Part4/blob/master/src/terrain.js
    // TerrainChunkRebuilder
    if ( this.generatorQueue.length > 0 ) {
      if ( this.generatorQueue[ 0 ].next().done ) {
        this.generatorQueue.shift();
      }
    }
  }
}


export function init( newScene, newCamera ) {
  scene = newScene;
  camera = newCamera;

  let baseTile = tilebelt.pointToTile( longitude, latitude,  maxZoom['terrain'] );
  let bbox = tilebelt.tileToBBOX( baseTile ); // [w, s, e, n]
  let deltaNS = bbox[3] - bbox[1]; // n - s
  let deltaEW = bbox[2] - bbox[0]; // e - w
  let tileWidthNS = earthsRaius * deltaNS * Math.PI / 180;
  let tileWidthEW = earthsRaius * deltaEW * Math.PI / 180 * Math.cos( latitude * Math.PI / 180 );
  baseTileWidth = ( tileWidthNS + tileWidthEW ) / 2;

  let skipOver = 2;
  let startingPlace;
  for ( let i = enhancedZoom; i >= minZoom; i -= skipOver) {
    startingPlace = i;
  }
  for ( let i = startingPlace; i <= enhancedZoom; i += 2 ) {
    grid.push( new Tile( i ) );
  }
  for ( let i = 0; i < grid.length - 1; i++ ) {
    grid[ i ].child = grid[ i + 1 ];
    grid[ i + 1 ].parent = grid[ i ];
  }

	// const helper = new THREE.PolarGridHelper( horizonDistance, 4, 1, 12 );
	// scene.add( helper );
}

export function update() {

  for ( let i = 0; i < grid.length; i++ ) {
    grid[ i ].update();
  }

  for ( let i = 0; i < grid.length; i++ ) {
    if ( grid[ i ].generatorQueue.length > 0 ) {
      grid[ i ].updateGeneratorQueue();
      break;
      // do all the work on the upper tiles before doing any work on the lower ones
    }
  }

  let elevationAtCamera = 0;
  for ( let i = grid.length - 1; i >= 0; i-- ) {
    if ( grid[ i ].inScene ) {
      elevationAtCamera = grid[ i ].lookupData( camera.position.x, camera.position.z )
        - curvatureOfTheEarth( camera.position.x, camera.position.z );
      break;
    }
  }

  if ( camera.position.y < elevationAtCamera + eyeHeight ) {
    camera.position.y = elevationAtCamera + eyeHeight;
  }

}
