/**
 * @author takahiro / https://github.com/takahirox
 *
 * Dependencies
 *  charset-encoder-js https://github.com/takahirox/charset-encoder-js
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

	},

	update: function ( delta ) {

	}

};

THREE.Physics.PhysicsHelper = function () {

	this.trs = [];
	this.qs = [];
	this.vs = [];

};

THREE.Physics.PhysicsHelper.prototype = {

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

	getBasisMatrix3 = function ( t ) {

		var q = this.getBasis( t );
		var m = this.quaternionToMatrix3( q );
		this.freeQ( q );
		return m;

	},

	setOriginArray3: function ( t, a ) {

		t.getOrigin().setValue( a[ 0 ], a[ 1 ], a[ 2 ] );

	},

	setBasisArray3: function ( t, a ) {

		t.getBasis().setEulerZYX( a[ 0 ], a[ 1 ], a[ 2 ] );

	},

	multiplyTransforms: function ( t1, t2 ) {

		var t = this.allocTr();
		this.setIdentity( t );

		var m1 = this.getBasisMatrix3( t1 );
		var m2 = this.getBasisMatrix3( t2 );

		var o1 = this.getOrigin( t1 );
		var o2 = this.getOrigin( t2 );

		var v1 = this.multiplyMatrix3ByVector3( m1, o2 );
		var v2 = this.addVector3( v1, o1 );
		this.setOrigin( t, v2 );

		var m3 = this.multiplyMatrices3( m1, m2 );
		this.setBasisMatrix3( t, m3 );

		this.freeV( v1 );
		this.freeV( v2 );

		return t;

	},

	inverseTransform: function ( t ) {

		var t2 = this.allocTr();

		var m1 = this.getBasisMatrix3( t );
		var o = this.getOrigin( t );

		var m2 = this.transposeMatrix3( m1 );
		var v1 = this.negativeVector3( o );
		var v2 = this.multiplyMatrix3ByVector3( m2, v1 );

		this.setOrigin( t2, v2 );
		this.setBasisMatrix3( t2, m2 );

		this.freeV( v1 );
		this.freeV( v2 );

		return tr2;

	},

	quaternionToMatrix3 = function ( q ) {

		var q2 = [];
		q2[0] = q.x();
		q2[1] = q.y();
		q2[2] = q.z();
		q2[3] = q.w();
		return quat4.toMat3( q2 );

	},

};

THREE.Physics.RigidBody = function ( mesh, world, params, helper ) {

	this.mesh  = mesh;
	this.world = world;
	this.params = params;
	this.helper = helper;

	this.form = null;
	this.boneForm = null;
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
		var bone = bones[ params.boneIndex ];

		var shape = generateShape( params );
		var weight = ( params.type == 0 ) ? 0 : params.weight;
		var localInertia = helper.allocV();
		localInertia.setValue( 0, 0, 0 );

		if( weight !== 0 ) {

			shape.calculateLocalInertia( weight, localInertia );

		}

		var boneOffsetForm = helper.allocTr();
		helper.setIdentity( boneOffsetForm );
		helper.setOriginArray3( boneOffsetForm, params.position );
		helper.setBasisArray3( boneOffsetForm, params.rotation );

		var boneForm = helper.allocTr();
		helper.setIdentity( boneForm );
		var pos = ( params.boneIndex === -1 ) ? [ 0, 0, 0 ] : bone.position;
		helper.setOriginArray3( boneForm, pos );

		var form = helper.multiplyTransforms( boneForm, boneOffsetForm );
		var state = new Ammo.btDefaultMotionState( form );

		var info = new Ammo.btRigidBodyConstructionInfo( weight, state, shape, localInertia );
		info.set_m_friction( params.friction );
		info.set_m_restitution( params.restriction );

		var rb = new Ammo.btRigidBody( info );

		if ( params.type === 0 ) {

			rb.setCollisionFlags( rb.getCollisionFlags() | 2 );
			rb.setActivationState( 4 );

		}

		rb.setDamping( params.positionDamping, params.rotationDamping );
		rb.setSleepingThresholds( 0, 0 );

		this.world.addRigidBody( rb, 1 << params.groupIndex, params.groupTarget );

		this.body = rb;
		this.boneOffsetForm = boneOffsetForm;
		this.boneOffsetFormInverse = this.inverseTransform( boneOffsetForm );

		helper.freeV( localInertia );
		helper.freeTr( form );
		helper.freeTr( boneForm );

	}

};

THREE.Physics.Constraint = function () {

};

THREE.Physics.Constraint.prototype = {

};
