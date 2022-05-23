import { ImageLoader, TextureLoader, CanvasTexture } from 'three';
import * as tilebelt from './lib/tilebelt.js';
// import * as Physics from './physics.js';

let latitude = 44.2705; // Mt. Washington
let longitude = -71.30325;
// let z = 12;
let maxZoom = {
  terrain: 12,
  satellite: 20
}
let earthsRaius = 6371000; // meters

const ELEVATION_TILE_SIZE = 512;
const IMAGERY_TILE_SIZE = 256;

let satelliteCanvas;

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

export function extablishScale( z ) {
  let tile = tilebelt.pointToTile( longitude, latitude, z );
  let bbox = tilebelt.tileToBBOX( tile ); // [w, s, e, n]
  let deltaNS = bbox[3] - bbox[1]; // n - s
  let deltaEW = bbox[2] - bbox[0]; // e - w
  let tileWidthNS = earthsRaius * deltaNS * Math.PI / 180;
  let tileWidthEW = earthsRaius * deltaEW * Math.PI / 180;
  return [ tileWidthNS, tileWidthEW ];
}

export function loadTile( callback, z ) {
  if ( z < 0 || z > maxZoom['terrain'] ) {
    console.error('z < 0 || z > maxZoom');
  }
  let tile = tilebelt.pointToTile( longitude, latitude, z );
  let url = urlForTile( ...tile, 'terrain' );
  const loader = new ImageLoader();
  loader.load( url, function ( image ) {
      const canvas = document.createElement( 'canvas' );
      canvas.width = ELEVATION_TILE_SIZE; canvas.height = ELEVATION_TILE_SIZE;
      const ctx = canvas.getContext( '2d' );
      ctx.drawImage( image, 0, 0 );
      let imageData = ctx.getImageData(
        0, 0, ELEVATION_TILE_SIZE, ELEVATION_TILE_SIZE ).data;
    	const size = ELEVATION_TILE_SIZE * ELEVATION_TILE_SIZE;
    	const heightData = new Float32Array( size );
      for ( let i = 0; i < size; i++ ) {
        heightData[ i ] = dataToHeight( imageData.slice( i * 4, i * 4 + 3 ) );
      }
      // Physics.createTerrainBody( heightData );
      callback( heightData );
    },
    undefined, // onProgress not supported
    function () {
      console.error( 'terrain ImageLoader error' );
    }
  );
}

function dataToHeight( data ) {
  // Elevation in meters
  return -10000 + ( data[ 0 ] * 65536 + data[ 1 ] * 256 + data[ 2 ] ) * 0.1;
}

export function loadTexture( callback, z ) {
  if ( z < 0 || z > maxZoom['satellite'] ) {
    console.error('z < 0 || z > maxZoom');
  }
  if ( satelliteCanvas == undefined ) {
    satelliteCanvas = document.createElement( 'canvas' );
    let bumpItUp = Math.pow( 2, z - 12 );
    satelliteCanvas.width = ELEVATION_TILE_SIZE / 2 * bumpItUp;
    satelliteCanvas.height = ELEVATION_TILE_SIZE / 2 * bumpItUp;
  }
  let tile = tilebelt.pointToTile( longitude, latitude, z );
  let url = urlForTile( ...tile, 'satellite' );
  const loader = new ImageLoader();
  loader.load( url, function ( image ) {
      // satelliteCanvas = document.createElement( 'canvas' );
      // satelliteCanvas.width = ELEVATION_TILE_SIZE / 2;
      // satelliteCanvas.height = ELEVATION_TILE_SIZE / 2;
      const ctx = satelliteCanvas.getContext( '2d' );
      ctx.drawImage( image, ELEVATION_TILE_SIZE / 2, ELEVATION_TILE_SIZE / 2 );
      let texture = new CanvasTexture( satelliteCanvas );
      callback( texture );
    },
    undefined, // onProgress not supported
    function () {
      console.error( 'satellite ImageLoader error' );
    }
  );
}
