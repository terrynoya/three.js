/**
 * @author takahiro / https://github.com/takahirox
 *
 * Dependencies
 *  Ammo.js            https://github.com/kripken/ammo.js
 */

THREE.Physics = function ( mesh ) {

	this.mesh = mesh;
	this.helper = new THREE.Physics.PhysicsHelper();

	this.world = null;
	this.bodies = [];
	this.constraints = [];

	this.init();

};

THREE.Physics.prototype = {

	constructor: THREE.Physics,

	init: function () {

		this.initWorld();
		this.initRigidBodies();
		this.initConstraints();
		this.reset();

	},

	initWorld: function () {

		var config = new Ammo.btDefaultCollisionConfiguration();
		var dispatcher = new Ammo.btCollisionDispatcher( config );
		var cache = new Ammo.btDbvtBroadphase();
		var solver = new Ammo.btSequentialImpulseConstraintSolver();
		var world = new Ammo.btDiscreteDynamicsWorld( dispatcher, cache, solver, config );
		world.setGravity( new Ammo.btVector3( 0, -10*10, 0 ) );
		this.world = world;

	},

	initRigidBodies: function () {

		var bodies = this.mesh.geometry.rigidBodies;

		for ( var i = 0; i < bodies.length; i++ ) {

			var b = new THREE.Physics.RigidBody( this.mesh, this.world, bodies[ i ], this.helper );
			this.bodies.push( b );

		}

	},

	initConstraints: function () {

		var constraints = this.mesh.geometry.constraints;

		for ( var i = 0; i < constraints.length; i++ ) {

			var params = constraints[ i ];
			var bodyA = this.bodies[ params.rigidBodyIndex1 ];
			var bodyB = this.bodies[ params.rigidBodyIndex2 ];
			var c = new THREE.Physics.Constraint( this.mesh, this.world, bodyA, bodyB, params, this.helper );
			this.constraints.push( c );

		}


	},

	update: function ( delta ) {

		var dframe = ( delta / ( 1 / 60 ) ) | 0;
		var g;
		var stepTime = dframe * 1/60;
		var maxStepNum = dframe;
		var unitStep = 1/60;

		// Note: sacrifice some precision for the performance
		if( dframe >= 3 ) {

			maxStepNum = 2;
			unitStep = 1/60*2;

			g = this.world.getGravity();
			g.setY( -10 * 10 / 2 );
			this.world.setGravity( g );

		}

		this.preSimulation();
		this.world.stepSimulation( stepTime, maxStepNum, unitStep );
		this.postSimulation();

		if( dframe >= 3 ) {

			g.setY( -10 * 10 );
			this.world.setGravity( g );
			Ammo.destroy( g ); // TODO: is this necessary?

		}

	},

	preSimulation: function () {

		for ( var i = 0; i < this.bodies.length; i++ ) {

			this.bodies[ i ].preSimulation();

		}

	},

	postSimulation: function () {

		for ( var i = 0; i < this.bodies.length; i++ ) {

			this.bodies[ i ].postSimulation();

		}

	},

	reset: function () {

		for ( var i = 0; i < this.bodies.length; i++ ) {

			this.bodies[ i ].setTransformFromBone();

		}

	}

};

THREE.Physics.PhysicsHelper = function () {

	// for Three.js
	this.tv3s = [];
	this.tm4s = [];
	this.tqs = [];

	// for Ammo.js
	this.trs = [];
	this.qs = [];
	this.vs = [];

};

THREE.Physics.PhysicsHelper.prototype = {

	allocThreeVector3: function () {

		return ( this.tv3s.length > 0 ) ? this.tv3s.pop() : new THREE.Vector3();

	},

	freeThreeVector3: function ( v ) {

		this.tv3s.push( v );

	},

	allocThreeMatrix4: function () {

		return ( this.tm4s.length > 0 ) ? this.tm4s.pop() : new THREE.Matrix4();

	},

	freeThreeMatrix4: function ( m ) {

		this.tm4s.push( m );

	},

	allocThreeQuaternion: function () {

		return ( this.tm4s.length > 0 ) ? this.tm4s.pop() : new THREE.Quaternion();

	},

	freeThreeQuaternion: function ( q ) {

		this.tqs.push( q );

	},

	allocTr: function () {

		return ( this.trs.length > 0 ) ? this.trs.pop() : new Ammo.btTransform();

	},

	freeTr: function ( t ) {

		this.trs.push( t );

	},

	allocQ: function () {

		return ( this.qs.length > 0 ) ? this.qs.pop() : new Ammo.btQuaternion();

	},

	freeQ: function ( q ) {

		this.qs.push( q );

	},

	allocV: function () {

		return ( this.vs.length > 0 ) ? this.vs.pop() : new Ammo.btVector3();

	},

	freeV: function ( v ) {

		this.vs.push( v );

	},

	setIdentity: function ( t ) {

		t.setIdentity();

	},

	getBasis: function ( t ) {

		var q = this.allocQ();
		t.getBasis().getRotation( q );
		return q;

	},

	getBasisAsMatrix3: function ( t ) {

		var q = this.getBasis( t );
		var m = this.quaternionToMatrix3( q );
		this.freeQ( q );
		return m;

	},

	getOrigin: function( t ) {

		return t.getOrigin();

	},

	setOrigin: function( t, v ) {

		t.getOrigin().setValue( v.x(), v.y(), v.z() );

	},

	copyOrigin: function( t1, t2 ) {

		var o = t2.getOrigin();
		this.setOrigin( t1, o );

	},

	setBasis: function( t, q ) {

		t.setRotation( q );

	},

	setBasisFromMatrix3: function( t, m ) {

		var q = this.matrix3ToQuaternion( m );
		this.setBasis( t, q );
		this.freeQ( q );

	},

	setOriginFromArray3: function ( t, a ) {

		t.getOrigin().setValue( a[ 0 ], a[ 1 ], a[ 2 ] );

	},

	setBasisFromArray3: function ( t, a ) {

		t.getBasis().setEulerZYX( a[ 0 ], a[ 1 ], a[ 2 ] );

	},

	setBasisFromArray4: function ( t, a ) {

		var q = this.array4ToQuaternion( a );
		this.setBasis( t, q );
		this.freeQ( q );

	},

	array4ToQuaternion: function( a ) {

		var q = this.allocQ();
		q.setX( a[ 0 ] );
		q.setY( a[ 1 ] );
		q.setZ( a[ 2 ] );
		q.setW( a[ 3 ] );
		return q;

	},

	multiplyTransforms: function ( t1, t2 ) {

		var t = this.allocTr();
		this.setIdentity( t );

		var m1 = this.getBasisAsMatrix3( t1 );
		var m2 = this.getBasisAsMatrix3( t2 );

		var o1 = this.getOrigin( t1 );
		var o2 = this.getOrigin( t2 );

		var v1 = this.multiplyMatrix3ByVector3( m1, o2 );
		var v2 = this.addVector3( v1, o1 );
		this.setOrigin( t, v2 );

		var m3 = this.multiplyMatrices3( m1, m2 );
		this.setBasisFromMatrix3( t, m3 );

		this.freeV( v1 );
		this.freeV( v2 );

		return t;

	},

	inverseTransform: function ( t ) {

		var t2 = this.allocTr();

		var m1 = this.getBasisAsMatrix3( t );
		var o = this.getOrigin( t );

		var m2 = this.transposeMatrix3( m1 );
		var v1 = this.negativeVector3( o );
		var v2 = this.multiplyMatrix3ByVector3( m2, v1 );

		this.setOrigin( t2, v2 );
		this.setBasisFromMatrix3( t2, m2 );

		this.freeV( v1 );
		this.freeV( v2 );

		return t2;

	},

	multiplyMatrices3: function( m1, m2 ) {

		var m3 = [];

		var v10 = this.rowOfMatrix3( m1, 0 );
		var v11 = this.rowOfMatrix3( m1, 1 );
		var v12 = this.rowOfMatrix3( m1, 2 );

		var v20 = this.columnOfMatrix3( m2, 0 );
		var v21 = this.columnOfMatrix3( m2, 1 );
		var v22 = this.columnOfMatrix3( m2, 2 );

		m3[ 0 ] = this.dotVectors3( v10, v20 );
		m3[ 1 ] = this.dotVectors3( v10, v21 );
		m3[ 2 ] = this.dotVectors3( v10, v22 );
		m3[ 3 ] = this.dotVectors3( v11, v20 );
		m3[ 4 ] = this.dotVectors3( v11, v21 );
		m3[ 5 ] = this.dotVectors3( v11, v22 );
		m3[ 6 ] = this.dotVectors3( v12, v20 );
		m3[ 7 ] = this.dotVectors3( v12, v21 );
		m3[ 8 ] = this.dotVectors3( v12, v22 );

		this.freeV( v10 );
		this.freeV( v11 );
		this.freeV( v12 );
		this.freeV( v20 );
		this.freeV( v21 );
		this.freeV( v22 );

		return m3;

	},

	addVector3: function( v1, v2 ) {

		var v = this.allocV();
		v.setValue( v1.x() + v2.x(), v1.y() + v2.y(), v1.z() + v2.z() );
		return v;

	},

	dotVectors3: function(v1, v2) {

		return v1.x() * v2.x() + v1.y() * v2.y() + v1.z() * v2.z();

	},

	rowOfMatrix3: function( m, i ) {

		var v = this.allocV();
		v.setValue( m[ i * 3 + 0 ], m[ i * 3 + 1 ], m[ i * 3 + 2 ] );
		return v;

	},

	columnOfMatrix3: function( m, i ) {

		var v = this.allocV();
		v.setValue( m[ i + 0 ], m[ i + 3 ], m[ i + 6 ] );
		return v;

	},

	negativeVector3: function( v ) {

		var v2 = this.allocV();
		v2.setValue( -v.x(), -v.y(), -v.z() );
		return v2;

	},

	multiplyMatrix3ByVector3: function ( m, v ) {

		var v4 = this.allocV();

		var v0 = this.rowOfMatrix3( m, 0 );
		var v1 = this.rowOfMatrix3( m, 1 );
		var v2 = this.rowOfMatrix3( m, 2 );
		var x = this.dotVectors3( v0, v );
		var y = this.dotVectors3( v1, v );
		var z = this.dotVectors3( v2, v );

		v4.setValue( x, y, z );

		this.freeV( v0 );
		this.freeV( v1 );
		this.freeV( v2 );

		return v4;

	},

	transposeMatrix3: function( m ) {

		var m2 = [];
		m2[ 0 ] = m[ 0 ];
		m2[ 1 ] = m[ 3 ];
		m2[ 2 ] = m[ 6 ];
		m2[ 3 ] = m[ 1 ];
		m2[ 4 ] = m[ 4 ];
		m2[ 5 ] = m[ 7 ];
		m2[ 6 ] = m[ 2 ];
		m2[ 7 ] = m[ 5 ];
		m2[ 8 ] = m[ 8 ];
		return m2;

	},

	quaternionToMatrix3: function ( q ) {

		var m = [];

		var x = q.x();
		var y = q.y();
		var z = q.z();
		var w = q.w();

		var xx = x * x;
		var yy = y * y;
		var zz = z * z;

		var xy = x * y;
		var yz = y * z;
		var zx = z * x;

		var xw = x * w;
		var yw = y * w;
		var zw = z * w;

		m[ 0 ] = 1 - 2 * ( yy + zz );
		m[ 1 ] = 2 * ( xy - zw );
		m[ 2 ] = 2 * ( zx + yw );
		m[ 3 ] = 2 * ( xy + zw );
		m[ 4 ] = 1 - 2 * ( zz + xx );
		m[ 5 ] = 2 * ( yz - xw );
		m[ 6 ] = 2 * ( zx - yw );
		m[ 7 ] = 2 * ( yz + xw );
		m[ 8 ] = 1 - 2 * ( xx + yy );

		return m;

	},

	matrix3ToQuaternion: function( m ) {

		var t = m[ 0 ] + m[ 4 ] + m[ 8 ];
		var s, x, y, z, w;

		if( t > 0 ) {

			s = Math.sqrt( t + 1.0 ) * 2;
			w = 0.25 * s;
			x = ( m[ 7 ] - m[ 5 ] ) / s;
			y = ( m[ 2 ] - m[ 6 ] ) / s; 
			z = ( m[ 3 ] - m[ 1 ] ) / s; 

		} else if( ( m[ 0 ] > m[ 4 ] ) && ( m[ 0 ] > m[ 8 ] ) ) {

			s = Math.sqrt( 1.0 + m[ 0 ] - m[ 4 ] - m[ 8 ] ) * 2;
			w = ( m[ 7 ] - m[ 5 ] ) / s;
			x = 0.25 * s;
			y = ( m[ 1 ] + m[ 3 ] ) / s;
			z = ( m[ 2 ] + m[ 6 ] ) / s;

		} else if( m[ 4 ] > m[ 8 ] ) {

			s = Math.sqrt( 1.0 + m[ 4 ] - m[ 0 ] - m[ 8 ] ) * 2;
			w = ( m[ 2 ] - m[ 6 ] ) / s;
			x = ( m[ 1 ] + m[ 3 ] ) / s;
			y = 0.25 * s;
			z = ( m[ 5 ] + m[ 7 ] ) / s;

		} else {

			s = Math.sqrt( 1.0 + m[ 8 ] - m[ 0 ] - m[ 4 ] ) * 2;
			w = ( m[ 3 ] - m[ 1 ] ) / s;
			x = ( m[ 2 ] + m[ 6 ] ) / s;
			y = ( m[ 5 ] + m[ 7 ] ) / s;
			z = 0.25 * s;

		}

		var q = this.allocQ();
		q.setX( x );
		q.setY( y );
		q.setZ( z );
		q.setW( w );
		return q;

	},

};

THREE.Physics.RigidBody = function ( mesh, world, params, helper ) {

	this.mesh  = mesh;
	this.world = world;
	this.params = params;
	this.helper = helper;

	this.body = null;
	this.bone = null;
	this.boneOffsetForm = null;
	this.boneOffsetFormInverse = null;

	this.init();

};

THREE.Physics.RigidBody.prototype = {

	constructor: THREE.Physics.RigidBody,

	init: function () {

		function generateShape ( p ) {

			switch( p.shapeType ) {

				case 0:
					return new Ammo.btSphereShape( p.width );

				case 1:
					return new Ammo.btBoxShape( new Ammo.btVector3( p.width, p.height, p.depth ) );

				case 2:
					return new Ammo.btCapsuleShape( p.width, p.height );

				default:
					throw 'unknown shape type ' + p.shapeType;

			}

		};

		var helper = this.helper;
		var params = this.params;
		var bones = this.mesh.skeleton.bones;
		var bone = ( params.boneIndex === -1 ) ? new THREE.Bone() : bones[ params.boneIndex ];

		var shape = generateShape( params );
		var weight = ( params.type === 0 ) ? 0 : params.weight;
		var localInertia = helper.allocV();
		localInertia.setValue( 0, 0, 0 );

		if( weight !== 0 ) {

			shape.calculateLocalInertia( weight, localInertia );

		}

		var boneOffsetForm = helper.allocTr();
		helper.setIdentity( boneOffsetForm );
		helper.setOriginFromArray3( boneOffsetForm, params.position );
		helper.setBasisFromArray3( boneOffsetForm, params.rotation );

		var boneForm = helper.allocTr();
		helper.setIdentity( boneForm );
		helper.setOriginFromArray3( boneForm, bone.getWorldPosition().toArray() );

		var form = helper.multiplyTransforms( boneForm, boneOffsetForm );
		var state = new Ammo.btDefaultMotionState( form );

		var info = new Ammo.btRigidBodyConstructionInfo( weight, state, shape, localInertia );
		info.set_m_friction( params.friction );
		info.set_m_restitution( params.restriction );

		var body = new Ammo.btRigidBody( info );

		if ( params.type === 0 ) {

			body.setCollisionFlags( body.getCollisionFlags() | 2 );
			body.setActivationState( 4 );

		}

		body.setDamping( params.positionDamping, params.rotationDamping );
		body.setSleepingThresholds( 0, 0 );

		this.world.addRigidBody( body, 1 << params.groupIndex, params.groupTarget );

		this.body = body;
		this.bone = bone;
		this.boneOffsetForm = boneOffsetForm;
		this.boneOffsetFormInverse = helper.inverseTransform( boneOffsetForm );

		helper.freeV( localInertia );
		helper.freeTr( form );
		helper.freeTr( boneForm );

	},

	reset: function () {

		this.setTransformFromBone();

	},

	preSimulation: function () {

		// TODO: temporal workaround
		if( this.params.boneIndex === -1 ) {

			return;

		}

		if( this.params.type === 0 /* && this.params.boneIndex !== 0 */ ) {

			this.setTransformFromBone();

		}

		if( this.params.type === 2 /* && this.params.boneIndex !== 0 */ ) {

			this.setPositionFromBone();

		}

	},

	setTransformFromBone: function () {

		var helper = this.helper;
		var p = this.bone.getWorldPosition();
		var q = this.bone.getWorldQuaternion();

		var tr = helper.allocTr();
		helper.setOriginFromArray3( tr, p.toArray() );
		helper.setBasisFromArray4( tr, q.toArray() );

		var form = helper.multiplyTransforms( tr, this.boneOffsetForm );

		// TODO: temporal
		//this.body.setWorldTransform( form );
		this.body.setCenterOfMassTransform( form );
		this.body.getMotionState().setWorldTransform( form );

		helper.freeTr( tr );
		helper.freeTr( form );

	},

	setPositionFromBone: function () {

		var helper = this.helper;
		var p = this.bone.getWorldPosition();
		var q = this.bone.getWorldQuaternion();

		var tr = helper.allocTr();
		helper.setOriginFromArray3( tr, p.toArray() );
		helper.setBasisFromArray4( tr, q.toArray() );

		var form = helper.multiplyTransforms( tr, this.boneOffsetForm );

		var tr2 = helper.allocTr();
		this.body.getMotionState().getWorldTransform( tr2 );
		helper.copyOrigin( tr2, form );

		// TODO: temporal
		//this.body.setWorldTransform( tr2 );
		this.body.setCenterOfMassTransform( tr2 );
		this.body.getMotionState().setWorldTransform( tr2 );

		helper.freeTr( tr );
		helper.freeTr( tr2 );
		helper.freeTr( form );

	},

	postSimulation: function () {

		var helper = this.helper;

		// TODO: temporal workaround
		if( this.params.type === 0 || this.params.boneIndex === -1 ) {

			return;

		}

		var tr = helper.allocTr();
		this.body.getMotionState().getWorldTransform( tr );
		var tr2 = helper.multiplyTransforms( tr, this.boneOffsetFormInverse );
		var q = helper.getBasis( tr2 );

		var tq = helper.allocThreeQuaternion();
		var tq2 = helper.allocThreeQuaternion();

		tq.set( q.x(), q.y(), q.z(), q.w() );
		tq2.setFromRotationMatrix( this.bone.matrixWorld );
		tq2.conjugate();
		tq2.multiply( tq );

		this.bone.quaternion.copy( tq2 );

		if ( this.params.type === 1 ) {

			var tv = helper.allocThreeVector3();

			var o = helper.getOrigin( tr2 );
			tv.set( o.x(), o.y(), o.z() );
			var v = this.bone.worldToLocal( tv );
			this.bone.position.add( v );

			helper.freeThreeVector3( tv );

		}

		this.bone.updateMatrixWorld( true );

		helper.freeThreeQuaternion( tq );
		helper.freeThreeQuaternion( tq2 );

		helper.freeQ( q );
		helper.freeTr( tr );
		helper.freeTr( tr2 );

	}

};

THREE.Physics.Constraint = function ( mesh, world, bodyA, bodyB, params, helper ) {

	this.mesh  = mesh;
	this.world = world;
	this.bodyA = bodyA;
	this.bodyB = bodyB;
	this.params = params;
	this.helper = helper;

	this.constraint = null;
	this.boneOffsetForm = null;
	this.boneOffsetFormInverse = null;

	this.init();

};

THREE.Physics.Constraint.prototype = {

	constructor: THREE.Physics.Constraint,

	init: function () {

		var helper = this.helper;
		var params = this.params;
		var bodyA = this.bodyA;
		var bodyB = this.bodyB;

		if ( bodyA.params.type !== 0 && bodyB.params.type === 2 ) {

			if ( bodyA.params.boneIndex   >  0 && bodyB.params.boneIndex   >  0 &&
			     bodyA.params.boneIndex !== -1 && bodyB.params.boneIndex !== -1 ) {

				if( bodyB.bone.parent === bodyA.bone ) {

					bodyB.params.type = 1;

				}

			}

		}

		var form = helper.allocTr();
		helper.setIdentity( form );
		helper.setOriginFromArray3( form, params.position );
		helper.setBasisFromArray3( form, params.rotation );

		var formA = bodyA.body.getWorldTransform();
		var formB = bodyB.body.getWorldTransform();

		var formInverseA = helper.inverseTransform( formA );
		var formInverseB = helper.inverseTransform( formB );

		var formA2 = helper.multiplyTransforms( formInverseA, form );
		var formB2 = helper.multiplyTransforms( formInverseB, form );

		var constraint = new Ammo.btGeneric6DofSpringConstraint( bodyA.body, bodyB.body, formA2, formB2, true );

		var lll = helper.allocV();
		var lul = helper.allocV();
		var all = helper.allocV();
		var aul = helper.allocV();

		// Left to Right
		lll.setValue(  params.translationLimitation1[ 0 ],
		               params.translationLimitation1[ 1 ],
		              -params.translationLimitation2[ 2 ] );
		lul.setValue(  params.translationLimitation2[ 0 ],
		               params.translationLimitation2[ 1 ],
		              -params.translationLimitation1[ 2 ] );
		all.setValue( -params.rotationLimitation2[ 0 ],
		              -params.rotationLimitation2[ 1 ],
		               params.rotationLimitation1[ 2 ] );
		aul.setValue( -params.rotationLimitation1[ 0 ],
		              -params.rotationLimitation1[ 1 ],
		               params.rotationLimitation2[ 2 ] );

		constraint.setLinearLowerLimit( lll );
		constraint.setLinearUpperLimit( lul );
		constraint.setAngularLowerLimit( all );
		constraint.setAngularUpperLimit( aul );

		for ( var i = 0; i < 3; i++ ) {

			if( params.springPosition[i] !== 0 ) {

				constraint.enableSpring( i, true );
				constraint.setStiffness( i, params.springPosition[ i ] );

			}

		}

		for ( var i = 0; i < 3; i++ ) {

			if( params.springRotation[ i ] !== 0 ) {

				constraint.enableSpring( i + 3, true );
				constraint.setStiffness( i + 3, params.springRotation[ i ] );

			}

		}

		this.world.addConstraint( constraint, true );
		this.constraint = constraint;

		helper.freeTr( form );
		helper.freeTr( formA );
		helper.freeTr( formB );
		helper.freeTr( formInverseA );
		helper.freeTr( formInverseB );
		helper.freeTr( formA2 );
		helper.freeTr( formB2 );
		helper.freeV( lll );
		helper.freeV( lul );
		helper.freeV( all );
		helper.freeV( aul );

	}

};
