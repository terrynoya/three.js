/**
 * @author takahirox / http://github.com/takahirox
 */

THREE.ShaderVRPass = function ( pass, pass2 ) {

	THREE.Pass.call( this );

	// pass is for left eye
	// pass2 is for right eye
	// if pass2 is undefined, pass is used for the both eyes

	// use the parameter of pass so far
	this.enabled = pass.enabled;
	this.renderToScreen = pass.renderToScreen;

	this.passes = [];
	this.passes.push( pass );
	if ( pass2 !== undefined ) this.passes.push( pass2 );

	// material for separating
	var shader = THREE.CopyShader;

	this.material = new THREE.ShaderMaterial( {

		defines: shader.defines || {},
		uniforms: THREE.UniformsUtils.clone( shader.uniforms ),
		vertexShader: shader.vertexShader,
		fragmentShader: shader.fragmentShader

	} );

	// material for combining
	var shader = THREE.CopyShader2;

	this.material2 = new THREE.ShaderMaterial( {

		defines: shader.defines || {},
		uniforms: THREE.UniformsUtils.clone( shader.uniforms ),
		vertexShader: shader.vertexShader,
		fragmentShader: shader.fragmentShader

	} );

	this.camera = new THREE.OrthographicCamera( - 1, 1, 1, - 1, 0, 1 );
	this.scene = new THREE.Scene();

	var parameters = {
		minFilter: THREE.LinearFilter,
		magFilter: THREE.LinearFilter,
		format: THREE.RGBAFormat,
		stencilBuffer: false
	};

	var renderTarget = new THREE.WebGLRenderTarget( 1, 1, parameters );

	this.renderTargetsFirst = [];
	this.renderTargetsFirst[ 0 ] = renderTarget;
	this.renderTargetsFirst[ 0 ].texture.name = "ShaderVRPass.firstLeft";
	this.renderTargetsFirst[ 1 ] = renderTarget.clone();
	this.renderTargetsFirst[ 1 ].texture.name = "ShaderVRPass.firstRight";

	this.renderTargetsSecond = [];
	this.renderTargetsSecond[ 0 ] = renderTarget.clone();
	this.renderTargetsSecond[ 0 ].texture.name = "ShaderVRPass.secondLeft";
	this.renderTargetsSecond[ 1 ] = renderTarget.clone();
	this.renderTargetsSecond[ 1 ].texture.name = "ShaderVRPass.secondRight";

	this.quad = new THREE.Mesh( new THREE.PlaneBufferGeometry( 2, 2 ), null );
	this.quad.frustumCulled = false; // Avoid getting clipped
	this.scene.add( this.quad );

};

THREE.ShaderVRPass.prototype = Object.assign( Object.create( THREE.Pass.prototype ), {

	constructor: THREE.ShaderVRPass,

	update: function ( renderer, writeBuffer, readBuffer, delta, maskActive ) {

		for ( var i = 0, il = this.passes.length; i < il; i ++ ) {

			this.passes[ i ].update( renderer, writeBuffer, readBuffer, delta, maskActive );

		}

	},

	setSize: function ( width, height ) {

		this.renderTargetsFirst[ 0 ].setSize( width * 0.5, height );
		this.renderTargetsFirst[ 1 ].setSize( width * 0.5, height );
		this.renderTargetsSecond[ 0 ].setSize( width * 0.5, height );
		this.renderTargetsSecond[ 1 ].setSize( width * 0.5, height );

		for ( var i = 0, il = this.passes.length; i < il; i ++ ) {

			this.passes[ i ].setSize( width, height );

		}

	},

	render: function( renderer, writeBuffer, readBuffer, delta, maskActive ) {

		this.material.uniforms.tDiffuse.value = readBuffer.texture;
		this.quad.material = this.material;

		for ( var i = 0; i < 2; i ++ ) {

			var pass = this.passes.length >= 2 ? this.passes[ i ] : this.passes[ 0 ];
			var renderTarget1 = this.renderTargetsFirst[ i ];
			var renderTarget2 = this.renderTargetsSecond[ i ];

			this.updateUvs( i );

			// 1. export half from the original image

			renderer.render( this.scene, this.camera, renderTarget1 );

			// 2. apply pass to the half

			pass.render( renderer, renderTarget2, renderTarget1, delta, maskActive );

			if ( pass.needsSwap === true ) {

				var tmp = this.renderTargetsFirst[ i ];
				this.renderTargetsFirst[ i ] = this.renderTargetsSecond[ i ];
				this.renderTargetsSecond[ i ] = tmp;

			}

		}

		// 3. Combine left and right

		this.updateUvs( 2 );

		this.material2.uniforms.left.value = this.renderTargetsFirst[ 0 ].texture;
		this.material2.uniforms.right.value = this.renderTargetsFirst[ 1 ].texture;
		this.quad.material = this.material2;

		if ( this.renderToScreen ) {

			renderer.render( this.scene, this.camera );

		} else {

			renderer.render( this.scene, this.camera, writeBuffer, this.clear );

		}

	},

	updateUvs: function ( num ) {

		var uv = this.quad.geometry.attributes.uv
		var array = uv.array;

		if ( num === 0 ) { // left

			array[ 0 ] = 0.0;
			array[ 2 ] = 0.5;
			array[ 4 ] = 0.0;
			array[ 6 ] = 0.5;

		} else if ( num === 1 ) { // right

			array[ 0 ] = 0.5;
			array[ 2 ] = 1.0;
			array[ 4 ] = 0.5;
			array[ 6 ] = 1.0;

		} else { // combine

			array[ 0 ] = 0.0;
			array[ 2 ] = 1.0;
			array[ 4 ] = 0.0;
			array[ 6 ] = 1.0;

		}

		uv.needsUpdate = true;

	}

} );

THREE.CopyShader2 = {

	uniforms: {

		"left": { value: null },
		"right": { value: null },
		"opacity":  { value: 1.0 }

	},

	vertexShader: [

		"varying vec2 vUv;",

		"void main() {",

			"vUv = uv;",
			"gl_Position = projectionMatrix * modelViewMatrix * vec4( position, 1.0 );",

		"}"

	].join( "\n" ),

	fragmentShader: [

		"uniform float opacity;",

		"uniform sampler2D left;",
		"uniform sampler2D right;",

		"varying vec2 vUv;",

		"void main() {",

			"vec4 texel = vUv.x < 0.5 ? texture2D( left, vec2( vUv.x * 2.0, vUv.y ) ) : texture2D( right, vec2( ( vUv.x - 0.5 ) * 2.0, vUv.y ) );",
			"gl_FragColor = opacity * texel;",

		"}"

	].join( "\n" )

};
