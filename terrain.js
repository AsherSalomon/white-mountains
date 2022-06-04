import * as THREE from 'three';
import * as tilebelt from './lib/tilebelt.js';

let scene, camera;

const latitude = 44.2705; // Mt. Washington
const longitude = -71.30325;
const earthsRaius = 6371000; // meters
// const maxElevation = 1916.582; // 9144; // meters
// // const horizonDistance = Math.sqrt( ( earthsRaius + maxElevation ) ** 2 - earthsRaius ** 2 );
// // console.log( 'Horizon '+ Math.round( horizonDistance ) + ' m' );
let baseTileWidth; // 6999.478360682135 meters at maxZoom['terrain']

let maxZoom = {
  terrain: 12,
  satellite: 20
}
const minZoom = 5;

const ELEVATION_TILE_SIZE = 512;
const IMAGERY_TILE_SIZE = 256;

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
    this.texture = null;
    this.loading = false;

		this.clipPlanes = null;

    this.storedData = null;

    this.centerX = null;
    this.centerZ = null;
    this.reCenter();

    this.heightData = new Float32Array( ELEVATION_TILE_SIZE ** 2 );
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

      if ( moveToNewTile ) { this.tile = newTile; }

      // centerX = ( 0.5 + this.tile[ 0 ] - this.origin[ 0 ] ) * this.width;
      // centerZ = ( 0.5 + this.tile[ 1 ] - this.origin[ 1 ] ) * this.width;
      this.reCenter();
      // this.clipPlanes = [
      //   new THREE.Plane( new THREE.Vector3( 1, 0, 0 ), -this.centerX - this.width / 2 ),
      //   new THREE.Plane( new THREE.Vector3( -1, 0, 0 ), this.centerX - this.width / 2 ),
      //   new THREE.Plane( new THREE.Vector3( 0, 0, 1 ), -this.centerZ - this.width / 2 ),
      //   new THREE.Plane( new THREE.Vector3( 0, 0, - 1 ), this.centerZ - this.width / 2 )
      // ];
      // if ( moveToNewTile && this.parent.groundMaterial != null ) {
      //   this.setClippingPlanes();
      //   this.parent.groundMaterial.clippingPlanes = this.clipPlanes;
      // }

      this.loading = true;
      this.loadTerrain();
    }
  };
  dataToHeight( data ) {
    // Elevation in meters
    return -10000 + ( data[ 0 ] * 65536 + data[ 1 ] * 256 + data[ 2 ] ) * 0.1;
  }
  loadTerrain() {
    let url = urlForTile( ...this.tile, 'terrain' );
    const loader = new THREE.ImageLoader();
    let thisTile = this;
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

    yield;
    timeList.push( performance.now() );

    if ( this.geometry == null ) {
      this.geometry = new THREE.PlaneGeometry( this.width, this.width, ELEVATION_TILE_SIZE, ELEVATION_TILE_SIZE );
      this.geometry.rotateX( - Math.PI / 2 );
    // } else {
    //   this.geometry.translate( 0, 0, 0 );
    }

    yield;
    timeList.push( performance.now() );

    const vertices = this.geometry.attributes.position.array;

    let curvatureOfTheEarth;
    for ( let m = 0; m < ELEVATION_TILE_SIZE + 1; m++ ) {
      for ( let n = 0; n < ELEVATION_TILE_SIZE + 1; n++ ) {
        let i = m * ELEVATION_TILE_SIZE + n;
        let j = ( m * ( ELEVATION_TILE_SIZE + 1 ) + n ) * 3;
        let x = vertices[ j + 0 ] + this.centerX;
        let z = vertices[ j + 2 ] + this.centerZ;
        curvatureOfTheEarth = ( x ** 2 + z ** 2 ) / ( 2 * earthsRaius );
        let mIsEdge = m == 0 || m == ELEVATION_TILE_SIZE;
        let nIsEdge = n == 0 || n == ELEVATION_TILE_SIZE;
        if ( !mIsEdge && !nIsEdge ) {
          vertices[ j + 1 ] = this.heightData[ i ] - curvatureOfTheEarth;
        } else if ( this.parent != null ) {
          vertices[ j + 1 ] = this.parent.lookupData( x, z ) - curvatureOfTheEarth;
        } else {
          vertices[ j + 1 ] = 0 - curvatureOfTheEarth;
        }
      }
    }

    if ( this.inScene ) {
      this.geometry.setAttribute( 'position', new THREE.Float32BufferAttribute( vertices, 3 ) );
    }

    this.geometry.computeVertexNormals();

    if ( this.groundMaterial == null ) {
      this.groundMaterial = new THREE.MeshStandardMaterial( {
        roughness: 0.5,
        clipIntersection: true
      } );
    }
    if ( this.child != null ) {
      this.child.setClippingPlanes();
    }

    if ( this.terrainMesh == null ) {
      this.terrainMesh = new THREE.Mesh( this.geometry, this.groundMaterial );
    }

    this.terrainMesh.position.x = this.centerX;
    this.terrainMesh.position.z = this.centerZ;
    if ( this.inScene == false ) {
      this.inScene = true;
      scene.add( this.terrainMesh );
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
  }
  loadSatellite() {
    // to do: multiple satilite images to one terrain tile
    // let satilliteZoom = 2; // maxZoom['satellite'];
    // let bumpItUp = Math.pow( 2, satilliteZoom );
    let url = urlForTile( ...this.tile, 'satellite' );
    const loader = new THREE.ImageLoader();
    let thisTile = this;
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
    let satelliteCanvas = document.createElement( 'canvas' );
    satelliteCanvas.width = IMAGERY_TILE_SIZE;// * bumpItUp;
    satelliteCanvas.height = IMAGERY_TILE_SIZE;// * bumpItUp;
    const ctx = satelliteCanvas.getContext( '2d' );
    ctx.drawImage( image, 0, 0 );
    if ( this.texture != null ) {
      this.texture.dispose();
    }
    this.texture = new THREE.CanvasTexture( satelliteCanvas );
    this.groundMaterial.map = this.texture;
    this.groundMaterial.needsUpdate = true;
  }
  lookupData( x, z ) {
    if ( this.z == maxZoom['terrain'] - 1 ) {
      let m = ( x - ( this.centerX - this.width / 2 ) ) / this.width * ( ELEVATION_TILE_SIZE + 1 );
      // let n = ( z - ( this.centerZ - this.width / 2 ) ) / this.width * ( ELEVATION_TILE_SIZE + 1 );
      // if ( m > 0 && n > 0 && m < ELEVATION_TILE_SIZE + 1 && n < ELEVATION_TILE_SIZE + 1 ) {
      if ( m > -1 && m < ELEVATION_TILE_SIZE + 1 ) {
        if ( m < 0 ) { console.log( m ); }
        return 2000;
      }
    } else {
      return 0;
    }
    // let m = ( x - ( this.centerX - this.width / 2 ) ) / this.width * ( ELEVATION_TILE_SIZE + 1 );
    // let n = ( z - ( this.centerZ - this.width / 2 ) ) / this.width * ( ELEVATION_TILE_SIZE + 1 );
    // if ( m > 0 && n > 0 && m < ELEVATION_TILE_SIZE + 1 && n < ELEVATION_TILE_SIZE + 1 ) {
    //   let m1 = Math.floor( m );
    //   let m2 = Math.ceil( m );
    //   let n1 = Math.floor( n );
    //   let n2 = Math.ceil( n );
    //   let i11 = m1 * ELEVATION_TILE_SIZE + n1;
    //   let i21 = m2 * ELEVATION_TILE_SIZE + n1;
    //   let i12 = m1 * ELEVATION_TILE_SIZE + n2;
    //   let i22 = m2 * ELEVATION_TILE_SIZE + n2;
    //   let d11 = this.heightData[ i11 ];
    //   let d21 = this.heightData[ i21 ];
    //   let d12 = this.heightData[ i12 ];
    //   let d22 = this.heightData[ i22 ];
    //   let d1 = d11 + ( d21 - d11 ) * ( m - m1 );
    //   let d2 = d12 + ( d22 - d12 ) * ( m - m1 );
    //   let interpolated = d1 + ( d2 - d1 ) * ( n - n1 );
    //   if ( isNaN( interpolated ) == false ) {
    //     if ( this.z == maxZoom['terrain'] - 1 ) {
    //       return n * 10;
    //     } else {
    //       // return interpolated;
    //       return 0;
    //     }
    //   } else {
    //     return 0;
    //   }
    // } else if ( this.parent != null ) {
    //   return this.parent.lookupData( x, z );
    // } else {
    //   return 0;
    // }
  }
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
  camera = newCamera;

  let baseTile = tilebelt.pointToTile( longitude, latitude,  maxZoom['terrain'] );
  // console.log( baseTile );
  let bbox = tilebelt.tileToBBOX( baseTile ); // [w, s, e, n]
  let deltaNS = bbox[3] - bbox[1]; // n - s
  let deltaEW = bbox[2] - bbox[0]; // e - w
  let tileWidthNS = earthsRaius * deltaNS * Math.PI / 180;
  let tileWidthEW = earthsRaius * deltaEW * Math.PI / 180 * Math.cos( latitude * Math.PI / 180 );
  baseTileWidth = ( tileWidthNS + tileWidthEW ) / 2;

  for ( let i = minZoom; i <= maxZoom['terrain']; i++ ) {
    let parentTile = null;
    if ( i > minZoom ) { parentTile = grid[ grid.length - 1 ]; }
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
    if ( grid[ i ].geometry != null ) {
      // grid[ i ].geometry.translate( 1, 0, 0 );
      // grid[ i ].geometry.scale( 1.1, 1, 1 ); // cumulative
      // grid[ i ].geometry.scale = new THREE.Vector3( 1.1, 1, 1 );
    }
  }

  updateGeneratorQueue();

}
