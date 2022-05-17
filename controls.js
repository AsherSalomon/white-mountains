
import { PointerLockControls } from './lib/PointerLockControls.js';

export const Controls = {
  type: 'first person',
  init: function( scene, camera ) {
    controls = new PointerLockControls( camera, document.body );
    document.body.addEventListener( 'click', function () {
      if ( controls.isLocked ) {
        controls.unlock();
      } else {
        controls.lock();
      }
    }, false );

    scene.add( controls.getObject() );
  },
  animate: function() {
  }
};
