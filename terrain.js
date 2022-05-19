import { ImageLoader, ObjectLoader } from 'three';
import * as tilebelt from './lib/tilebelt.js';

let projection = 'EPSG:3857';
let maxZoom = 12;

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

  let latitude = 44.2705;
  let longitude = -71.30325;

  // let tile = tilebelt.pointToTileFraction( longitude, latitude, 10 );
  let tile = tilebelt.pointToTile( longitude, latitude, z );
  console.log( tile );
  // let quadkey = tilebelt.tileToQuadkey( tile );
  // console.log( quadkey );
  // let url = urlForTile( ...tilebelt.quadkeyToTile( quadkey ) );
  let url = urlForTile( ...tile );
  console.log( url );

  const loader = new ImageLoader();
  loader.load( url, function ( image ) {
      console.log( image );
  	},
  	undefined, // onProgress callback currently not supported
  	function () {
  		console.error( 'ImageLoader error' );
  	}
  );

  // https://cloud.maptiler.com/tiles/terrain-rgb/
  // height = -10000 + ((R * 256 * 256 + G * 256 + B) * 0.1)
}

export function init() {

  for ( let i = 0; i < maxZoom; i++ ) {
    loadData( i );
  }

}
