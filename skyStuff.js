import * as THREE from 'three';
import { Sky } from './lib/Sky.js';

let sun;

export function init( scene, renderer ) {
  // Skybox
  sun = new THREE.Vector3();
  const sky = new Sky();
  sky.scale.setScalar( 341462 * 1000 );
  scene.add( sky );
  const skyUniforms = sky.material.uniforms;
  skyUniforms[ 'turbidity' ].value = 10;
  skyUniforms[ 'rayleigh' ].value = 2;
  skyUniforms[ 'mieCoefficient' ].value = 0.005;
  skyUniforms[ 'mieDirectionalG' ].value = 0.8;
  const parameters = {
  	elevation: -1,
  	azimuth: 270
  };
  const pmremGenerator = new THREE.PMREMGenerator( renderer );
  function updateSun() {
  	const phi = THREE.MathUtils.degToRad( 90 - parameters.elevation );
  	const theta = THREE.MathUtils.degToRad( parameters.azimuth );
  	sun.setFromSphericalCoords( 1, phi, theta );
  	sky.material.uniforms[ 'sunPosition' ].value.copy( sun );
  	// water.material.uniforms[ 'sunDirection' ].value.copy( sun ).normalize();
  	scene.environment = pmremGenerator.fromScene( sky ).texture;
  }
  updateSun();
  // end Skybox
}
