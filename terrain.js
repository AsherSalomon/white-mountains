import * as THREE from 'three';
import * as tilebelt from './lib/tilebelt.js';

let scene, camera, frustum;

const latitude = 44.2705; // Mt. Washington
const longitude = -71.30325;
const earthsRaius = 6371000; // meters
const maxElevation = 9144; // meters
const horizonDistance = Math.sqrt( Math.pow( earthsRaius + maxElevation, 2 ) - Math.pow( earthsRaius, 2 ) );
let baseTileWidth; // 6999.478360682135 meters at maxZoom['terrain']
const angularResolution = 1 / 1; // tile width / distance to camera

let maxZoom = {
  terrain: 12,
  satellite: 20
}
const minZoom = 5;

const ELEVATION_TILE_SIZE = 512;
const IMAGERY_TILE_SIZE = 256;

let grid = [];

let apiKey = '5oT5Np7ipsbVhre3lxdi';
let urlFormat = {
  terrain: 'https://api.maptiler.com/tiles/terrain-rgb/{z}/{x}/{y}.png?key={apiKey}',
  satellite: 'https://api.maptiler.com/tiles/satellite/{z}/{x}/{y}.jpg?key={apiKey}'
  // protocolbuffer: 'https://api.maptiler.com/tiles/v3/{z}/{x}/{y}.pbf?key={apiKey}'
  // https://wiki.openstreetmap.org/wiki/PBF_Format
}
function urlForTile( x, y, z, type ) {
  return urlFormat[ type ].replace( '{x}', x ).replace( '{y}', y )
    .replace( '{z}', z ).replace( '{apiKey}', apiKey );
}

class Tile {
  constructor( tile, parent ) {
    this.tile = tile;
    this.parent = parent;
    this.siblings = null;
    this.children = [];
    if ( this.parent != null ) {
      if ( this.parent.children.length < 4 ) {
        this.parent.children.push( this );
      }
    }
    // this.quadkey = tilebelt.tileToQuadkey( this.tile );
    this.remove = false;
    this.inScene = false;
    this.width = Math.pow( 2, maxZoom['terrain'] - this.tile[ 2 ] ) * baseTileWidth;
    this.boundingBox = null;

    this.groundMaterial = null;
    this.terrainMesh = null;
  }
  update() {
    if ( !this.inScene ) {

    	this.gridHelper = new THREE.GridHelper( this.width, 1 );
      let origin = tilebelt.pointToTileFraction( longitude, latitude, this.tile[ 2 ] );
      let dx = ( 0.5 + this.tile[ 0 ] - origin[ 0 ] ) * this.width;
      let dy = ( 0.5 + this.tile[ 1 ] - origin[ 1 ] ) * this.width;
      this.gridHelper.translateX( dx );
      this.gridHelper.translateZ( dy );
    	scene.add( this.gridHelper );
      this.boundingBox = new THREE.Box3();
      this.boundingBox.expandByObject( this.gridHelper );
      this.inScene = true;

      this.loadTerrain();
    } else {
      if ( this.tile[ 2 ] < maxZoom['terrain'] ) {
        if ( this.isTooBig() ) {
          this.split();
        }
      }
      if ( this.tile[ 2 ] > minZoom ) {
        if ( this.allSmall() ) {
          this.parent.merge();
        }
      }
    }
  };
  isTile( tile ) {
    return tilebelt.tilesEqual( tile, this.tile );
  }
  distanceFromCamera() {
    let flatCameraPosition =  new THREE.Vector3();
    flatCameraPosition.copy( camera.position );
    flatCameraPosition.y = 0;
    return this.gridHelper.position.distanceTo( flatCameraPosition );
  }
  isTooBig() {
    let tooBig = this.width / this.distanceFromCamera() > angularResolution;
    return tooBig && frustum.intersectsBox( this.boundingBox );
  }
  isTooSmall() {
    let tooSmall = this.width / this.distanceFromCamera() < angularResolution / 2;
    return tooSmall || frustum.intersectsBox( this.boundingBox ) == false;
  }
  allSmall() {
    let allSiblingsAreSmall = false;
    if ( this.siblings != null ) {
      allSiblingsAreSmall = true;
      for ( let i = 0; i < 4; i ++ ) {
        if ( this.siblings[ i ].isTooSmall() == false ) {
          allSiblingsAreSmall = false;
        }
      }
    }
    return allSiblingsAreSmall;
  }
  split() {
    if ( this.children.length == 0 ) {
      let children = tilebelt.getChildren( this.tile );
      let siblings = [];
      for ( let i = 0; i < 4; i ++ ) {
        let newTile = new Tile( children[ i ], this )
        siblings.push( newTile );
        grid.push( newTile );
      }
      for ( let i = 0; i < 4; i ++ ) {
        siblings[ i ].siblings = siblings;
      }
    } else if ( this.children.length == 4 ) {
      for ( let i = 0; i < 4; i ++ ) {
        grid.push( this.children[ i ] );
      }
    }
    this.remove = true;
  }
  merge() {
    for ( let i = 0; i < 4; i ++ ) {
      this.children[ i ].remove = true;
    }
    grid.push( this );
  }
  dataToHeight( data ) {
    // Elevation in meters
    return -10000 + ( data[ 0 ] * 65536 + data[ 1 ] * 256 + data[ 2 ] ) * 0.1;
  }
  loadTerrain() {
    let url = urlForTile( ...this.tile, 'terrain' );
    const loader = new THREE.ImageLoader();
    loader.load( url, function ( image ) {
        const canvas = document.createElement( 'canvas' );
        canvas.width = ELEVATION_TILE_SIZE;
        canvas.height = ELEVATION_TILE_SIZE;
        const ctx = canvas.getContext( '2d' );
        ctx.drawImage( image, 0, 0 );
        let imageData = ctx.getImageData( 0, 0, ELEVATION_TILE_SIZE, ELEVATION_TILE_SIZE ).data;
      	const size = ELEVATION_TILE_SIZE * ELEVATION_TILE_SIZE;
      	const heightData = new Float32Array( size );

        try {
          this.dataToHeight( [ 1, 2 ,3 ] );
        } catch (error) {
          console.error('wtf');
        }

        for ( let i = 0; i < size; i++ ) {
          heightData[ i ] = this.dataToHeight( imageData.slice( i * 4, i * 4 + 3 ) );
        }

        const widthSegments = Math.sqrt( heightData.length ) - 1;
      	const geometry = new THREE.PlaneGeometry( this.width, this.width, widthSegments, widthSegments );
        geometry.rotateX( - Math.PI / 2 );
        const vertices = geometry.attributes.position.array;
      	for ( let i = 0, j = 0, l = vertices.length; i < l; i ++, j += 3 ) {
      		vertices[ j + 1 ] = heightData[ i ];
      	}
      	geometry.computeVertexNormals();
      	this.groundMaterial = new THREE.MeshPhongMaterial( { color: 0xC7C7C7 } );
      	this.terrainMesh = new THREE.Mesh( geometry, groundMaterial );

      	scene.add( this.terrainMesh );
        this.loadSatellite();
      },
      undefined, // onProgress not supported
      function () {
        console.error( 'terrain ImageLoader error' );
      }
    );
  }
  loadSatellite() {
    let satelliteCanvas = document.createElement( 'canvas' );
    // let satilliteZoom = 2; // maxZoom['satellite'];
    // let bumpItUp = Math.pow( 2, satilliteZoom );
    satelliteCanvas.width = IMAGERY_TILE_SIZE;// * bumpItUp;
    satelliteCanvas.height = IMAGERY_TILE_SIZE;// * bumpItUp;
    // const ctx = satelliteCanvas.getContext( '2d' );
    // ctx.fillStyle = "#7F7F7F";
    // ctx.fillRect(0, 0, satelliteCanvas.width, satelliteCanvas.height);

    // to do: multiple satilite images to one terrain tile
    let url = urlForTile( ...this.tile, 'satellite' );
    const loader = new THREE.ImageLoader();
    loader.load( url, function ( image ) {
        console.log( image );
        const ctx = satelliteCanvas.getContext( '2d' );
        ctx.drawImage( image, 0, 0 );
        let texture = new CanvasTexture( satelliteCanvas );
      	this.groundMaterial.map = texture;
      	this.groundMaterial.needsUpdate = true;
      },
      undefined, // onProgress not supported
      function () {
        console.error( 'satellite ImageLoader error' );
      }
    );
  }
  dispose() {
    this.remove = false;
    scene.remove( this.gridHelper );
    if ( this.terrainMesh != null ) {
      scene.remove( this.terrainMesh );
      this.terrainMesh.geometry.dispose();
      this.terrainMesh.material.dispose();
      this.terrainMesh = null;
    }
    this.inScene = false;
  }
}

export function seed( newScene, newCamera ) {
  scene = newScene;
  camera = newCamera;

  let baseTile = tilebelt.pointToTile( longitude, latitude,  maxZoom['terrain'] );
  let bbox = tilebelt.tileToBBOX( baseTile ); // [w, s, e, n]
  let deltaNS = bbox[3] - bbox[1]; // n - s
  let deltaEW = bbox[2] - bbox[0]; // e - w
  let tileWidthNS = earthsRaius * deltaNS * Math.PI / 180;
  let tileWidthEW = earthsRaius * deltaEW * Math.PI / 180 * Math.cos( latitude * Math.PI / 180 );
  baseTileWidth = ( tileWidthNS + tileWidthEW ) / 2;

  let tile = tilebelt.pointToTile( longitude, latitude, minZoom );
  grid.push( new Tile( tile, null ) );

	// const helper = new THREE.PolarGridHelper( horizonDistance, 4, 1, 12 );
	// scene.add( helper );
  frustum = new THREE.Frustum();
}

export function update() {
  // https://stackoverflow.com/questions/24877880/three-js-check-if-object-is-in-frustum
  frustum.setFromProjectionMatrix( new THREE.Matrix4().multiplyMatrices( camera.projectionMatrix, camera.matrixWorldInverse ) );

  for ( let i = grid.length - 1; i >= 0 ; i-- ) {
    if ( grid[ i ].remove ) {
      grid[ i ].dispose();
      grid.splice( i, 1 );
    } else {
      grid[ i ].update();
    }
  }
}
