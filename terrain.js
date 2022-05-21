import { ImageLoader, ObjectLoader } from 'three';
import * as tilebelt from './lib/tilebelt.js';
// import * as Physics from './physics.js';

export let tileWidthNS;
export let tileWidthEW;

let projection = 'EPSG:3857';
let maxZoom = {
  terrain: 12,
  satellite: 20
}
export const ELEVATION_TILE_SIZE = 512;
export const IMAGERY_TILE_SIZE = 256;

let apiKey = '5oT5Np7ipsbVhre3lxdi';
let urlFormat = {
  terrain: 'https://api.maptiler.com/tiles/terrain-rgb/{z}/{x}/{y}.png?key={apiKey}',
  satellite: 'https://api.maptiler.com/tiles/satellite/{z}/{x}/{y}.jpg?key={apiKey}'
  // protocolbuffer: 'https://api.maptiler.com/tiles/v3/{z}/{x}/{y}.pbf?key={apiKey}'
  // https://wiki.openstreetmap.org/wiki/PBF_Format
}

function urlForTile( x, y, z ) {
  return urlFormat['terrain'].replace( '{x}', x ).replace( '{y}', y )
    .replace( '{z}', z ).replace( '{apiKey}', apiKey );
}

function loadData( z ){

  if ( z < 0 || z > maxZoom['terrain'] ) {
    console.error('z < 0 || z > maxZoom');
  }

  let latitude = 44.2705;
  let longitude = -71.30325;

  // let tile = tilebelt.pointToTileFraction( longitude, latitude, 10 );
  let tile = tilebelt.pointToTile( longitude, latitude, z );
  console.log( tile );
  console.log( tilebelt.tileToBBOX( tile ) );
  // let quadkey = tilebelt.tileToQuadkey( tile );
  // console.log( quadkey );
  // let url = urlForTile( ...tilebelt.quadkeyToTile( quadkey ) );
  let url = urlForTile( ...tile );
  console.log( url );

  const loader = new ImageLoader();
  loader.load( url, function ( image ) {
      console.log( typeof image );
      const canvas = document.createElement( 'canvas' );
      canvas.width = ELEVATION_TILE_SIZE; canvas.height = ELEVATION_TILE_SIZE;
      const ctx = canvas.getContext( '2d' );
      ctx.drawImage( image, 0, 0 );
      console.log( typeof ctx.getImageData( 0, 0, 1, 1 ).data );
  	},
  	undefined, // onProgress not supported
  	function () {
  		console.error( 'ImageLoader error' );
  	}
  );

  // https://cloud.maptiler.com/tiles/terrain-rgb/
  // height = -10000 + ((R * 256 * 256 + G * 256 + B) * 0.1)
}

function dataToHeight( data ) {
  // Elevation in meters
  return -10000 + ( data[ 0 ] * 65536 + data[ 1 ] * 256 + data[ 2 ] ) * 0.1;
}

export function init() {

  let z = 12;

  let latitude = 44.2705; // Mt. Washington
  let longitude = -71.30325;
  let tile = tilebelt.pointToTile( longitude, latitude, z );
  let bbox = tilebelt.tileToBBOX( tile ); // [w, s, e, n]
  let deltaNS = bbox[3] - bbox[1]; // n - s
  let deltaEW = bbox[2] - bbox[0]; // e - w
  let earthsRaius = 6371000; // meters
  tileWidthNS = earthsRaius * deltaNS * Math.PI / 180;
  tileWidthEW = earthsRaius * deltaEW * Math.PI / 180;
  // console.log( tileWidthNS );
  // console.log( tileWidthEW );

  loadData( z );

}
