
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
var touchSpeed = 0.001;
var touchAngular = 0.0001;

var multiplier = 10000;

const ongoingTouches = [];

var rightTouch = { identifier: 0 };
var leftTouch = { identifier: 0 };

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

  // https://developer.mozilla.org/en-US/docs/Web/API/Touch_events

  function copyTouch({ identifier, pageX, pageY }) {
    return { identifier, pageX, pageY };
  }

  function ongoingTouchIndexById(idToFind) {
    for (let i = 0; i < ongoingTouches.length; i++) {
      const id = ongoingTouches[i].identifier;
      if (id == idToFind) {
        return i;
      }
    }
    return -1;    // not found
  }

  function handleStart(evt) {
    evt.preventDefault();
    const touches = evt.changedTouches;
    for (let i = 0; i < touches.length; i++) {
      ongoingTouches.push(copyTouch(touches[i]));
      if ( touches[i].pageX > window.innerWidth / 2 ) {
        if ( rightTouch.identifier == 0 ) {
          rightTouch = copyTouch( touches[i] );
          rightTouch.prevX = rightTouch.pageX;
          rightTouch.prevY = rightTouch.pageY;
        }
      } else {
        if ( leftTouch.identifier == 0 ) {
          leftTouch = copyTouch( touches[i] );
          // console.log( leftTouch.identifier );
          leftTouch.prevX = leftTouch.pageX;
          leftTouch.prevY = leftTouch.pageY;
        }
      }
    }
  }

  function handleMove(evt) {
    evt.preventDefault();
    const touches = evt.changedTouches;
    for (let i = 0; i < touches.length; i++) {
      const idx = ongoingTouchIndexById(touches[i].identifier);
      if (idx >= 0) {
        // ongoingTouches[idx].pageX
        // ongoingTouches[idx].pageY
        ongoingTouches.splice(idx, 1, copyTouch(touches[i]));
      }
      if ( touches[i].identifier == rightTouch.identifier ) {
        rightTouch.pageX = touches[i].pageX;
        rightTouch.pageY = touches[i].pageY;
      }
      if ( touches[i].identifier == leftTouch.identifier ) {
        leftTouch.pageX = touches[i].pageX;
        leftTouch.pageY = touches[i].pageY;
      }
    }
  }

  function handleEnd(evt) {
    evt.preventDefault();
    const touches = evt.changedTouches;
    for (let i = 0; i < touches.length; i++) {
      let idx = ongoingTouchIndexById(touches[i].identifier);
      if (idx >= 0) {
        // touches[i].pageX
        // touches[i].pageY
        ongoingTouches.splice(idx, 1);
      }
      if ( touches[i].identifier == rightTouch.identifier ) {
        rightTouch.identifier = 0;
      }
      if ( touches[i].identifier == leftTouch.identifier ) {
        leftTouch.identifier = 0;
      }
    }
  }

  function handleCancel(evt) {
    evt.preventDefault();
    const touches = evt.changedTouches;
    for (let i = 0; i < touches.length; i++) {
      let idx = ongoingTouchIndexById(touches[i].identifier);
      ongoingTouches.splice(idx, 1);
      if ( touches[i].identifier == rightTouch.identifier ) {
        rightTouch.identifier = -1;
      }
      if ( touches[i].identifier == leftTouch.identifier ) {
        leftTouch.identifier = -1;
      }
    }
  }

  document.body.addEventListener('touchstart', handleStart, false);
  document.body.addEventListener('touchmove', handleMove, false);
  document.body.addEventListener('touchend', handleEnd, false);
  document.body.addEventListener('touchcancel', handleCancel, false);

}

export function animate( camera ) {

  let delta = new Vector3();
  delta.z = moveBackward - moveForward;
  delta.x = moveRight - moveLeft;
  delta.y = moveUp - moveDown;
  delta.multiplyScalar( speed );

  if ( leftTouch.identifier != 0 ) {
    delta.x += ( leftTouch.pageX - leftTouch.prevX ) * touchSpeed
    delta.z += ( leftTouch.pageY - leftTouch.prevY ) * touchSpeed
  }
  if ( rightTouch.identifier != 0 ) {
    var azimuth = -( rightTouch.pageX - rightTouch.prevX ) * touchAngular
    var elevate = -( rightTouch.pageY - rightTouch.prevY ) * touchAngular
    camera.rotateOnWorldAxis( new Vector3(0,1,0), azimuth );
    camera.rotateX( elevate );
  }

  let tempY = delta.y;
  delta.y = 0;

  delta = camera.localToWorld( delta );
  delta.sub( camera.position );

  delta.y += tempY;

  delta.multiplyScalar( multiplier );

  camera.position.add( delta );

}
