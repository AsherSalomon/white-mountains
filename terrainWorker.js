
// https://www.w3schools.com/html/html5_webworkers.asp
// https://developer.mozilla.org/en-US/docs/Web/API/Web_Workers_API/Using_web_workers
// https://developer.mozilla.org/en-US/docs/Web/API/Worker/Worker
// https://developer.mozilla.org/en-US/docs/Web/API/Worker/postMessage
// https://developer.mozilla.org/en-US/docs/Web/API/Web_Workers_API/Structured_clone_algorithm

const earthsRaius = 6371000;

onmessage = function( event ) {
  let heightData = event.data[ 0 ];
  let vertices = event.data[ 1 ];
  let curvatureOfTheEarth;
  for ( let i = 0, j = 0, l = vertices.length; i < l; i ++, j += 3 ) {
    curvatureOfTheEarth = ( Math.pow( vertices[ j + 0 ], 2 ) + Math.pow( vertices[ j + 2 ], 2 ) ) / ( 2 * earthsRaius );
    vertices[ j + 1 ] = heightData[ i ] - curvatureOfTheEarth;
  }
  postMessage( vertices );
}

// This is how to instantiate a worker:
// this.terrainWorker = new Worker('terrainWorker.js');

// This is how to send data to a worker:
// thisTile.terrainWorker.postMessage( [ heightData, vertices ] );

// This is how to receive data from a worker:
// let thisTile = this;
// this.terrainWorker.onmessage = function( event ) {
//   thisTile.onWorkComplete( event.data );
// };
