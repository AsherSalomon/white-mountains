import * as tilebelt from './lib/tilebelt.js';

let latitude = 44.2705; // Mt. Washington
let longitude = -71.30325;
let earthsRaius = 6371000; // meters
let tileWidth; // 6999.478360682135 meters

let maxZoom = {
  terrain: 12,
  satellite: 20
}

let grid = [];

function Tile( quadkey, tile ) {
  this.quadkey = quadkey;
  this.tile = tile;
  this.log = function() {
    console.log( this.quadkey );
  };
}

export function seed() {
  let tile = tilebelt.pointToTile( longitude, latitude, maxZoom['terrain'] );
  let bbox = tilebelt.tileToBBOX( tile ); // [w, s, e, n]
  let deltaNS = bbox[3] - bbox[1]; // n - s
  let deltaEW = bbox[2] - bbox[0]; // e - w
  let tileWidthNS = earthsRaius * deltaNS * Math.PI / 180;
  let tileWidthEW = earthsRaius * deltaEW * Math.PI / 180 * Math.cos( latitude * Math.PI / 180 );
  tileWidth = ( tileWidthNS + tileWidthEW ) / 2;

  let tileSeed = tilebelt.pointToTileFraction( longitude, latitude, maxZoom['terrain'] );
  let seedName = tilebelt.tileToQuadkey( tileSeed );
  console.log( tileSeed );
  console.log( tilebelt.tileToQuadkey( tile ) );
  // grid.push( new Tile( 'hello', 0, 0 ) );
  // grid[ 0 ].log( 'asher' );
}

export function update() {

}
