

// https://github.com/mapbox/tilebelt/blob/master/index.js

var d2r = Math.PI / 180,
    r2d = 180 / Math.PI;
function pointToTileFraction(lon, lat, z) {
  var sin = Math.sin(lat * d2r),
      z2 = Math.pow(2, z),
      x = z2 * (lon / 360 + 0.5),
      y = z2 * (0.5 - 0.25 * Math.log((1 + sin) / (1 - sin)) / Math.PI);

  x = x % z2;
  if (x < 0) x = x + z2;
  return [x, y, z];
}

function tileToQuadkey(tile) {
    var index = '';
    for (var z = tile[2]; z > 0; z--) {
        var b = 0;
        var mask = 1 << (z - 1);
        if ((tile[0] & mask) !== 0) b++;
        if ((tile[1] & mask) !== 0) b += 2;
        index += b.toString();
    }
    return index;
}

let spacing = 0.05;
function snap( n ) {
  return Math.round( n / spacing ) * spacing;
}

let maxZoom = 12
let exponent = 2;

let latitude = 44.2705;
let longitude = -71.30325;
export function init() {
  let tile = pointToTileFraction( longitude, latitude, 10 );

  let x = tile[0];
  let y = tile[1];
  let z = tile[2];

  // x, y, z reference to elevation tile
  let exp = Math.max( exponent, z - maxZoom ); // Cap elevation tile level to maxZoom
  let x2 = Math.floor( x / Math.pow( 2, exp ) );
  let y2 = Math.floor( y / Math.pow( 2, exp ) );
  let z2 = z - exp;

  let imageryKey = tilebelt.tileToQuadkey( [ x, y, z ] );
  let elevationKey = tilebelt.tileToQuadkey( [ x2, y2, z2 ] );

  console.log(imageryKey);
  console.log(elevationKey);
}
