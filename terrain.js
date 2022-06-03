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
    this.loading = false;

		this.clipPlanes = null;
  }
  update() {
    let centerX = ( 0.5 + this.tile[ 0 ] - this.origin[ 0 ] ) * this.width;
    let centerZ = ( 0.5 + this.tile[ 1 ] - this.origin[ 1 ] ) * this.width;

    let deltaX = Math.round( ( camera.position.x - centerX ) / this.width );
    let deltaZ = Math.round( ( camera.position.z - centerZ ) / this.width );
    if ( deltaX > 0.5 || deltaZ > 0.5 ) {
      let newTile = [ this.tile[ 0 ] + deltaX, this.tile[ 1 ] + deltaZ,  this.tile[ 2 ]];
    }

    if ( this.inScene == false && this.loading == false ) {

  		this.clipPlanes = [
  			new THREE.Plane( new THREE.Vector3( 1, 0, 0 ), -centerX - this.width / 2 ),
  			new THREE.Plane( new THREE.Vector3( -1, 0, 0 ), centerX - this.width / 2 ),
  			new THREE.Plane( new THREE.Vector3( 0, 0, 1 ), -centerZ - this.width / 2 ),
  			new THREE.Plane( new THREE.Vector3( 0, 0, - 1 ), centerZ - this.width / 2 )
  		];

      this.inScene = true;
      this.loading = true;
      this.loadTerrain();
    }
  };
  dataToHeight( data ) {
    // Elevation in meters
    return -10000 + ( data[ 0 ] * 65536 + data[ 1 ] * 256 + data[ 2 ] ) * 0.1;
  }
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

      const size = ELEVATION_TILE_SIZE ** 2;
      const heightData = new Float32Array( size );
      for ( let i = 0; i < size; i++ ) {
        heightData[ i ] = thisTile.dataToHeight( imageData.slice( i * 4, i * 4 + 3 ) );
      }
      const widthSegments = Math.sqrt( heightData.length ); // -1

      yield;
      timeList.push( performance.now() );

      thisTile.geometry = new THREE.PlaneGeometry( thisTile.width, thisTile.width, widthSegments, widthSegments );
      // thisTile.geometry = new THREE.PlaneGeometry( 1, 1, widthSegments, widthSegments );
      thisTile.geometry.rotateX( - Math.PI / 2 );

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
      // for ( let i = 0, j = 0, l = vertices.length; i < l; i ++, j += 3 ) {
      //   curvatureOfTheEarth = ( vertices[ j + 0 ] ** 2 + vertices[ j + 2 ] ** 2 ) / ( 2 * earthsRaius );
      //   vertices[ j + 1 ] = heightData[ i ] - curvatureOfTheEarth;
      // }
      for ( let m = 0; m < widthSegments; m++ ) {
        for ( let n = 0; n < widthSegments; n++ ) {
          let i = m * ELEVATION_TILE_SIZE + n;
          let j = ( m * ( widthSegments + 1 ) + n ) * 3;
          curvatureOfTheEarth = ( vertices[ j + 0 ] ** 2 + vertices[ j + 2 ] ** 2 ) / ( 2 * earthsRaius );
          if ( m < ELEVATION_TILE_SIZE && n < ELEVATION_TILE_SIZE ) {
            vertices[ j + 1 ] = heightData[ i ] - curvatureOfTheEarth;
          } else {
            vertices[ j + 1 ] = 0 - curvatureOfTheEarth;
          }
        }
      }

      thisTile.geometry.computeVertexNormals();
      // thisTile.groundMaterial = new THREE.MeshPhongMaterial( { color: 0x164a19 } );
      if ( thisTile.child != null ) {
        thisTile.groundMaterial = new THREE.MeshStandardMaterial( {
          roughness: 0.5,
          clippingPlanes: thisTile.child.clipPlanes,
          clipIntersection: true
        } );
      } else {
        thisTile.groundMaterial = new THREE.MeshStandardMaterial( {
          roughness: 0.5,
          clipIntersection: true
        } );
      }
      thisTile.terrainMesh = new THREE.Mesh( thisTile.geometry, thisTile.groundMaterial );

      // thisTile.terrainMesh.position.set( dx, 0, dz );
      // thisTile.terrainMesh.scale.set( thisTile.width, 1, thisTile.width );

      scene.add( thisTile.terrainMesh );
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
  }

  updateGeneratorQueue();

}
