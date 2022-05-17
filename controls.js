
import { Vector3 } from 'three';
import { PointerLockControls } from './lib/PointerLockControls.js';

let controls;

var moveForward = false;
var moveBackward = false;
var moveLeft = false;
var moveRight = false;
var moveUp = false;
var moveDown = false;

var speed = 0.1;

const ongoingTouches = [];

export function init( scene, camera ) {

  controls = new PointerLockControls( camera, document.body );
  document.body.addEventListener( 'click', function () {
    if ( controls.isLocked ) {
      controls.unlock();
    } else {
      controls.lock();
    }
  }, false );

  scene.add( controls.getObject() );

  function onKeyDown( event ) {
    switch ( event.keyCode ) {
      case 87: moveForward = true; break; // w
      case 65: moveLeft = true; break; // a
      case 83: moveBackward = true; break; // s
      case 68: moveRight = true; break; // d
      case 32: moveUp = true; break; // space
      case 16: moveDown = true; break; // shift
    }
  };
  function onKeyUp( event ) {
    switch ( event.keyCode ) {
      case 87: moveForward = false; break; // w
      case 65: moveLeft = false; break; // a
      case 83: moveBackward = false; break; // s
      case 68: moveRight = false; break; // d
      case 32: moveUp = false; break; // space
      case 16: moveDown = false; break; // shift
    }
  };
  document.addEventListener( 'keydown', onKeyDown, false );
  document.addEventListener( 'keyup', onKeyUp, false );

  // function handleStart(evt) {
  //
  //
  // document.body.addEventListener('touchstart', process_touchstart, false);
  // document.body.addEventListener('touchmove', process_touchmove, false);
  // document.body.addEventListener('touchcancel', process_touchcancel, false);
  // document.body.addEventListener('touchend', process_touchend, false);

}

export function animate( camera ) {

  let delta = new Vector3();
  delta.z = moveBackward - moveForward;
  delta.x = moveRight - moveLeft;
  delta.y = moveUp - moveDown;
  delta.multiplyScalar( speed );

  let tempY = delta.y;
  delta.y = 0;

  delta = camera.localToWorld( delta );
  delta.sub( camera.position );

  delta.y += tempY;

  camera.position.add( delta );

}
