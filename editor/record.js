function aaa( time ) {

	var bones = editor.scene.children[ 0 ].skeleton.bones;
	var param = {};
	param.time = time;
	param.moments = [];

	for ( var i = 0; i < bones.length; i ++ ) {

		var b = bones[ i ];
		var pp = {};
		var pq = {};

		pp.name = '.bones[' + b.name + '].position';
		pp.type = 'vector';
		pp.value = b.position.toArray();

		pq.name = '.bones[' + b.name + '].quaternion';
		pq.type = 'quaternion';
		pq.value = b.quaternion.toArray();

		param.moments.push( pp );
		param.moments.push( pq );

	}

	return param;

}

function bbb( params ) {

	var obj = {};
	obj.name = 'Action';
	obj.tracks = [];

	var times = [];
	var values = [];

	params.sort( function ( a, b ) {

		return a.time - b.time;

	} );

	obj.duration = params[ params.length - 1 ].time;

	for ( var i = 0; i < params.length; i ++ ) {

		times.push( params[ i ].time );

	}

	for ( var i = 0; i < params[ 0 ].moments.length; i ++ ) {

		var p = params[ 0 ].moments[ i ];
		obj.tracks.push( { name:   p.name,
		                   type:   p.type,
		                   times:  times.slice(),
		                   values: [] } );

	}

	for ( var i = 0; i < params.length; i ++ ) {

		for ( var j = 0; j < params[ i ].moments.length; j ++ ) {

			obj.tracks[ j ].values = obj.tracks[ j ].values.concat( params[ i ].moments[ j ].value );

		}

	}

	return obj;

}

var params = [];
params.push( aaa( 0 ) );
bbb( params );
