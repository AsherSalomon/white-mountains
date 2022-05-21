import * as THREE from 'three';

let scene;
export function setScene( providedScene ) {
  scene = providedScene;
}

let tileWidthNS;
let tileWidthEW;
export function setScale( list ) {
  tileWidthNS = list[ 0 ];
  tileWidthEW = list[ 1 ];
}

// Heightfield parameters
let terrainWidthExtents; // Terrain.tileWidthNS; //  = 100
let terrainDepthExtents; // Terrain.tileWidthEW; // = 100
let terrainWidth; // = 128;
let terrainDepth; // = 128;
let terrainHalfWidth; // = terrainWidth / 2;
let terrainHalfDepth; // = terrainDepth / 2;
const terrainMaxHeight = 1916.5824; // i.e. 6,288'
const terrainMinHeight = 0;
//
// // Graphics variables
let terrainMesh;
const clock = new THREE.Clock();

// Physics variables
let collisionConfiguration;
let dispatcher;
let broadphase;
let solver;
let physicsWorld;
const dynamicObjects = [];
let transformAux1;
//
// let heightData = null;
let ammoHeightData = null;
//
let time = 0;
// const objectTimePeriod = 3;
// let timeNextSpawn = time + objectTimePeriod;
// const maxNumObjects = 30;

export function initPhysics() {

	// Physics configuration

	collisionConfiguration = new Ammo.btDefaultCollisionConfiguration();
	dispatcher = new Ammo.btCollisionDispatcher( collisionConfiguration );
	broadphase = new Ammo.btDbvtBroadphase();
	solver = new Ammo.btSequentialImpulseConstraintSolver();
	physicsWorld = new Ammo.btDiscreteDynamicsWorld( dispatcher, broadphase, solver, collisionConfiguration );
	physicsWorld.setGravity( new Ammo.btVector3( 0, - 6, 0 ) );

	transformAux1 = new Ammo.btTransform();

}

export function createTerrainBody( heightData ) {

  terrainWidthExtents = tileWidthEW; // 100; //
  terrainDepthExtents = tileWidthNS; // 100; //
  terrainWidth = Math.sqrt( heightData.length );
  terrainDepth = terrainWidth;
  terrainHalfWidth = terrainWidth / 2;
  terrainHalfDepth = terrainDepth / 2;

	const geometry = new THREE.PlaneGeometry( terrainWidthExtents, terrainDepthExtents, terrainWidth - 1, terrainDepth - 1 );
	geometry.rotateX( - Math.PI / 2 );

	const vertices = geometry.attributes.position.array;

  console.log( vertices[ 1 ]  );
  console.log( heightData[ 0 ] );
	for ( let i = 0, j = 0, l = vertices.length; i < l; i ++, j += 3 ) {

		// j + 1 because it is the y component that we modify
		vertices[ j + 1 ] = 0; // heightData[ i ];

	}

	geometry.computeVertexNormals();

	const groundMaterial = new THREE.MeshPhongMaterial( { color: 0xC7C7C7 } );
	terrainMesh = new THREE.Mesh( geometry, groundMaterial );
	// terrainMesh.receiveShadow = true;
	// terrainMesh.castShadow = true;

	scene.add( terrainMesh );

	const textureLoader = new THREE.TextureLoader();
	textureLoader.load( './grid.png', function ( texture ) {

		texture.wrapS = THREE.RepeatWrapping;
		texture.wrapT = THREE.RepeatWrapping;
		texture.repeat.set( terrainWidth - 1, terrainDepth - 1 );
		groundMaterial.map = texture;
		groundMaterial.needsUpdate = true;

	} );

  const groundShape = createTerrainShape( heightData );
  const groundTransform = new Ammo.btTransform();
  groundTransform.setIdentity();
  // Shifts the terrain, since bullet re-centers it on its bounding box.
  groundTransform.setOrigin( new Ammo.btVector3( 0, ( terrainMaxHeight + terrainMinHeight ) / 2, 0 ) );
  const groundMass = 0;
  const groundLocalInertia = new Ammo.btVector3( 0, 0, 0 );
  const groundMotionState = new Ammo.btDefaultMotionState( groundTransform );
  const groundBody = new Ammo.btRigidBody( new Ammo.btRigidBodyConstructionInfo( groundMass, groundMotionState, groundShape, groundLocalInertia ) );
  physicsWorld.addRigidBody( groundBody );

}

function createTerrainShape( heightData ) {

	// This parameter is not really used, since we are using PHY_FLOAT height data type and hence it is ignored
	const heightScale = 1;

	// Up axis = 0 for X, 1 for Y, 2 for Z. Normally 1 = Y is used.
	const upAxis = 1;

	// hdt, height data type. "PHY_FLOAT" is used. Possible values are "PHY_FLOAT", "PHY_UCHAR", "PHY_SHORT"
	const hdt = 'PHY_FLOAT';

	// Set this to your needs (inverts the triangles)
	const flipQuadEdges = false;

	// Creates height data buffer in Ammo heap
	ammoHeightData = Ammo._malloc( 4 * terrainWidth * terrainDepth );

	// Copy the javascript height data array to the Ammo one.
	let p = 0;
	let p2 = 0;

	for ( let j = 0; j < terrainDepth; j ++ ) {

		for ( let i = 0; i < terrainWidth; i ++ ) {

			// write 32-bit float data to memory
			Ammo.HEAPF32[ ammoHeightData + p2 >> 2 ] = heightData[ p ];

			p ++;

			// 4 bytes/float
			p2 += 4;

		}

	}

	// Creates the heightfield physics shape
	const heightFieldShape = new Ammo.btHeightfieldTerrainShape(
		terrainWidth,
		terrainDepth,
		ammoHeightData,
		heightScale,
		terrainMinHeight,
		terrainMaxHeight,
		upAxis,
		hdt,
		flipQuadEdges
	);

	// Set horizontal scale
	const scaleX = terrainWidthExtents / ( terrainWidth - 1 );
	const scaleZ = terrainDepthExtents / ( terrainDepth - 1 );
	heightFieldShape.setLocalScaling( new Ammo.btVector3( scaleX, 1, scaleZ ) );

	heightFieldShape.setMargin( 0.05 );

	return heightFieldShape;

}

export function render() {

	const deltaTime = clock.getDelta();

	updatePhysics( deltaTime );

	time += deltaTime;

}

function updatePhysics( deltaTime ) {

	physicsWorld.stepSimulation( deltaTime, 10 );

	// Update objects
	for ( let i = 0, il = dynamicObjects.length; i < il; i ++ ) {

		const objThree = dynamicObjects[ i ];
		const objPhys = objThree.userData.physicsBody;
		const ms = objPhys.getMotionState();
		if ( ms ) {

			ms.getWorldTransform( transformAux1 );
			const p = transformAux1.getOrigin();
			const q = transformAux1.getRotation();
			objThree.position.set( p.x(), p.y(), p.z() );
			objThree.quaternion.set( q.x(), q.y(), q.z(), q.w() );

		}

	}

}
