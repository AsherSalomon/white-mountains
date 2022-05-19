import { ImageLoader, ObjectLoader } from 'three';
import * as tilebelt from './lib/tilebelt.js';

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
      console.log( image );
  	},
  	undefined, // onProgress not supported
  	function () {
  		console.error( 'ImageLoader error' );
  	}
  );

  // https://cloud.maptiler.com/tiles/terrain-rgb/
  // height = -10000 + ((R * 256 * 256 + G * 256 + B) * 0.1)
}

const MULTIPLIER_TERRAIN_RGB = [ 0.1 * 256 * 256, 0.1 * 256, 0.1, -10000 ];
function dataToHeight( data, pixelEncoding ) {
  let m = MULTIPLIER_TERRAIN_RGB;
  return m[ 0 ] * data[ 0 ] +
         m[ 1 ] * data[ 1 ] +
         m[ 2 ] * data[ 2 ] +
         m[ 3 ];
}

export function init() {

  loadData( 10 );

}
