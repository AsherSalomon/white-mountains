import * as THREE from 'three';

// // Heightfield parameters
// let terrainWidthExtents; // Terrain.tileWidthNS; //  = 100
// let terrainDepthExtents; // Terrain.tileWidthEW; // = 100
// const terrainWidth = // 128;
// const terrainDepth = // 128;
// const terrainHalfWidth = terrainWidth / 2;
// const terrainHalfDepth = terrainDepth / 2;
// const terrainMaxHeight = 1916.5824; // i.e. 6,288'
// const terrainMinHeight = 0;
//
// // Graphics variables
// let terrainMesh;
// const clock = new THREE.Clock();

// Physics variables
let collisionConfiguration;
let dispatcher;
let broadphase;
let solver;
let physicsWorld;
// const dynamicObjects = [];
let transformAux1;
//
// let heightData = null;
// let ammoHeightData = null;
//
// let time = 0;
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

	// Create the terrain body

	// const groundShape = createTerrainShape();
	// const groundTransform = new Ammo.btTransform();
	// groundTransform.setIdentity();
	// // Shifts the terrain, since bullet re-centers it on its bounding box.
	// groundTransform.setOrigin( new Ammo.btVector3( 0, ( terrainMaxHeight + terrainMinHeight ) / 2, 0 ) );
	// const groundMass = 0;
	// const groundLocalInertia = new Ammo.btVector3( 0, 0, 0 );
	// const groundMotionState = new Ammo.btDefaultMotionState( groundTransform );
	// const groundBody = new Ammo.btRigidBody( new Ammo.btRigidBodyConstructionInfo( groundMass, groundMotionState, groundShape, groundLocalInertia ) );
	// physicsWorld.addRigidBody( groundBody );

	transformAux1 = new Ammo.btTransform();

}
