
import { Vector3 } from 'three';
import { PointerLockControls } from './lib/PointerLockControls.js';

let camera, controls;

var moveForward = false;
var moveBackward = false;
var moveLeft = false;
var moveRight = false;
var moveUp = false;
var moveDown = false;

export const Controls = {
  type: 'first person',
  init: function( scene, camera ) {
    camera = camera;

    controls = new PointerLockControls( camera, document.body );
    document.body.addEventListener( 'click', function () {
      if ( controls.isLocked ) {
        controls.unlock();
      } else {
        controls.lock();
      }
    }, false );

    scene.add( controls.getObject() );

    var onKeyDown = function ( event ) {
      switch ( event.keyCode ) {
        case 87: moveForward = true; break; // w
        case 65: moveLeft = true; break; // a
        case 83: moveBackward = true; break; // s
        case 68: moveRight = true; break; // d
        case 32: moveUp = true; break; // space
        case 16: moveDown = true; break; // shift
      }
    };
    var onKeyUp = function ( event ) {
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

  },
  animate: function() {

    var delta = new Vector3();
    delta.x = moveForward - moveBackward;
    delta.y = moveLeft - moveRight;
    delta.z = moveUp - moveDown;
    camera.position.add( delta );

  }
};
