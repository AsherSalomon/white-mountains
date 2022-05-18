
import * as proj4 from './lib/proj4.js';
import tilebelt from './lib/tilebelt.js';

let spacing = 0.05;
let latitude = 44.2705;
let longitude = -71.30325;

function snap( n ) {
  return Math.round( n / spacing ) * spacing;
}

export function init() {
  let projector = proj4( 'EPSG:3857' );
  let tile = tilebelt.pointToTileFraction( longitude, latitude, 10 );
  console.log(tile)
  // let quadkey = tilebelt.tileToQuadkey( tile );
}
