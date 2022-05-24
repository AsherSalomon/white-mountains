import * as tilebelt from './lib/tilebelt.js';

let latitude = 44.2705; // Mt. Washington
let longitude = -71.30325;
let earthsRaius = 6371000; // meters

let tileWidthNS;
let tileWidthEW;

let maxZoom = {
  terrain: 12,
  satellite: 20
}

let grid = [];

function Tile( name ) {
  this.name = name;
  this.log = function() {
    console.log( this.name );
  };
}

export function seed() {
  let tile = tilebelt.pointToTile( longitude, latitude, maxZoom['terrain'] );
  let bbox = tilebelt.tileToBBOX( tile ); // [w, s, e, n]
  let deltaNS = bbox[3] - bbox[1]; // n - s
  let deltaEW = bbox[2] - bbox[0]; // e - w
  tileWidthNS = earthsRaius * deltaNS * Math.PI / 180;
  tileWidthEW = earthsRaius * deltaEW * Math.PI / 180 * Math.cos( latitude * Math.PI / 180 );
  console.log( tileWidthNS );
  console.log( tileWidthEW );
  // grid.push( new Tile( 'hello', 0, 0 ) );
  // grid[ 0 ].log( 'asher' );
}

export function update() {

}
