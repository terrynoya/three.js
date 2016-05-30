var clock = new THREE.Clock();
var mesh = this.getObjectByName( 'knight.js' );
var mixer = new THREE.AnimationMixer( mesh );

for ( var i = 0; i < mesh.geometry.animations.length; i ++ ) {

	mixer.clipAction( mesh.geometry.animations[ i ] ).play();

}

function update ( even ) {

	mixer.update( clock.getDelta() );

}

