

let spacing = 0.05;
let latitude = 44.2705;
let longitude = -71.30325;

var d2r = Math.PI / 180,
    r2d = 180 / Math.PI;
function pointToTileFraction(lon, lat, z) {
  var sin = Math.sin(lat * d2r),
      z2 = Math.pow(2, z),
      x = z2 * (lon / 360 + 0.5),
      y = z2 * (0.5 - 0.25 * Math.log((1 + sin) / (1 - sin)) / Math.PI);

  // Wrap Tile X
  x = x % z2;
  if (x < 0) x = x + z2;
  return [x, y, z];
}

function snap( n ) {
  return Math.round( n / spacing ) * spacing;
}

export function init() {
  let tile = pointToTileFraction( longitude, latitude, 10 );
  console.log(tile)
  // let quadkey = tilebelt.tileToQuadkey( tile );
}
