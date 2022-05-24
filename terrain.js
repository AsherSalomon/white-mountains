import * as tilebelt from './lib/tilebelt.js';

let latitude = 44.2705; // Mt. Washington
let longitude = -71.30325;

let grid = [];

function Tile(name, x, y) {
  this.name = name;
  this.x = x;
  this.y = y;
  this.log = function( logMe ) {
    console.log( this.name );
    console.log( logMe );
  };
}

export function seedGrid() {
  a.push( new tile( 'hello', 0, 0 ) );
  a[ 0 ].log( 'asher' );
}
