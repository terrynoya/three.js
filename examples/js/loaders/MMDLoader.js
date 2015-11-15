/**
 * @author takahiro / https://github.com/takahirox
 *
 * Dependencies
 *  - charset-encoder-js https://github.com/takahirox/charset-encoder-js
 *  - THREE.TGALoader
 *
 *
 * This loader loads and parses PMD/PMX and VMD binary files
 * then creates mesh for Three.js.
 *
 * PMD/PMX is a model data format and VMD is a motion data format
 * used in MMD(Miku Miku Dance).
 *
 * MMD is a 3D CG animation tool which is popular in Japan.
 *
 *
 * MMD official site
 *  http://www.geocities.jp/higuchuu4/index_e.htm
 *
 * PMD, VMD format
 *  http://blog.goo.ne.jp/torisu_tetosuki/e/209ad341d3ece2b1b4df24abf619d6e4
 *
 * PMX format
 *  http://gulshan-i-raz.geo.jp/labs/2012/10/17/pmx-format1/
 *
 * Model data requirements
 *  - resize the texture image files to power_of_2*power_of_2
 *
 *
 * TODO
 *  - separate model/vmd loaders.
 *  - multi vmd files support.
 *  - camera motion in vmd support.
 *  - light motion in vmd support.
 *  - music support.
 *  - SDEF support.
 *  - uv/material/bone morphing support.
 *  - supply skinning support.
 *  - shadow support.
 */

THREE.MMDLoader = function ( showStatus, manager ) {

	THREE.Loader.call( this, showStatus );
	this.manager = ( manager !== undefined ) ? manager : THREE.DefaultLoadingManager;
	this.defaultTexturePath = './models/mmd/default/';

};

THREE.MMDLoader.prototype = Object.create( THREE.Loader.prototype );
THREE.MMDLoader.prototype.constructor = THREE.MMDLoader;

THREE.MMDLoader.prototype.extractExtension = function ( url ) {

	var index = url.lastIndexOf( '.' );

	if ( index < 0 ) {

		return null;

	}

	return url.slice( index + 1 );

};

THREE.MMDLoader.prototype.setDefualtTexturePath = function ( path ) {

	this.defaultTexturePath = path;

};

THREE.MMDLoader.prototype.load = function ( modelUrl, vmdUrl, callback, onProgress, onError ) {

	var texturePath = this.extractUrlBase( modelUrl );
	var modelExtension = this.extractExtension( modelUrl );
	this.loadModelFile( modelUrl, vmdUrl, texturePath, modelExtension, callback, onProgress, onError );

};

THREE.MMDLoader.prototype.loadFileAsBuffer = function ( url, onLoad, onProgress, onError ) {

	var loader = new THREE.XHRLoader( this.manager );
	loader.setCrossOrigin( this.crossOrigin );
	loader.setResponseType( 'arraybuffer' );
	loader.load( url, function ( buffer ) {

		onLoad( buffer );

	}, onProgress, onError );

};

THREE.MMDLoader.prototype.loadModelFile = function ( modelUrl, vmdUrl, texturePath, modelExtension, callback, onProgress, onError ) {

	var scope = this;

	this.loadFileAsBuffer( modelUrl, function ( buffer ) {

		scope.loadVmdFile( buffer, vmdUrl, texturePath, modelExtension, callback, onProgress, onError );

	}, onProgress, onError );

};

THREE.MMDLoader.prototype.loadVmdFile = function ( modelBuffer, vmdUrl, texturePath, modelExtension, callback, onProgress, onError ) {

	var scope = this;

	if ( ! vmdUrl ) {

		scope.parse( modelBuffer, null, texturePath, modelExtension, callback );
		return;

	}

	this.loadFileAsBuffer( vmdUrl, function ( buffer ) {

		scope.parse( modelBuffer, buffer, texturePath, modelExtension, callback );

	}, onProgress, onError );

};

THREE.MMDLoader.prototype.parse = function ( modelBuffer, vmdBuffer, texturePath, modelExtension, callback ) {

	var model = this.parseModel( modelBuffer, modelExtension );
	var vmd = vmdBuffer !== null ? this.parseVmd( vmdBuffer ) : null;
	var mesh = this.createMesh( model, vmd, texturePath );
	callback( mesh );

};

THREE.MMDLoader.prototype.parseModel = function ( buffer, modelExtension ) {

	// Should I judge from model data header?
	switch( modelExtension.toLowerCase() ) {

		case 'pmd':
			return this.parsePmd( buffer );

		case 'pmx':
			return this.parsePmx( buffer );

		default:
			throw 'extension ' + modelExtension + ' is not supported.';

	}


};

THREE.MMDLoader.prototype.parsePmd = function ( buffer ) {

	var scope = this;
	var pmd = {};
	var dv = new THREE.MMDLoader.DataView( buffer );

	pmd.metadata = {};
	pmd.metadata.format = 'pmd';

	var parseHeader = function () {

		var metadata = pmd.metadata;
		metadata.magic = dv.getChars( 3 );

		if ( metadata.magic !== 'Pmd' ) {

			throw 'PMD file magic is not Pmd, but ' + metadata.magic;

		}

		metadata.version = dv.getFloat32();
		metadata.modelName = dv.getSjisStringsAsUnicode( 20 );
		metadata.comment = dv.getSjisStringsAsUnicode( 256 );

	};

	var parseVertices = function () {

		var parseVertex = function () {

			var p = {};
			p.position = dv.getFloat32Array( 3 );
			p.normal = dv.getFloat32Array( 3 );
			p.uv = dv.getFloat32Array( 2 );
			p.skinIndices = dv.getUint16Array( 2 );
			p.skinWeights = [ dv.getUint8() / 100 ];
			p.skinWeights.push( 1.0 - p.skinWeights[ 0 ] );
			p.edgeFlag = dv.getUint8();
			return p;

		};

		var metadata = pmd.metadata;
		metadata.vertexCount = dv.getUint32();

		pmd.vertices = [];

		for ( var i = 0; i < metadata.vertexCount; i++ ) {

			pmd.vertices.push( parseVertex() );

		}

	};

	var parseFaces = function () {

		var parseFace = function () {

			var p = {};
			p.indices = dv.getUint16Array( 3 );
			return p;

		};

		var metadata = pmd.metadata;
		metadata.faceCount = dv.getUint32() / 3;

		pmd.faces = [];

		for ( var i = 0; i < metadata.faceCount; i++ ) {

			pmd.faces.push( parseFace() );

		}

	};

	var parseMaterials = function () {

		var parseMaterial = function () {

			var p = {};
			p.diffuse = dv.getFloat32Array( 4 );
			p.shininess = dv.getFloat32();
			p.specular = dv.getFloat32Array( 3 );
			p.emissive = dv.getFloat32Array( 3 );
			p.toonIndex = dv.getInt8();
			p.edgeFlag = dv.getUint8();
			p.faceCount = dv.getUint32() / 3;
			p.fileName = dv.getChars( 20 );
			return p;

		};

		var metadata = pmd.metadata;
		metadata.materialCount = dv.getUint32();

		pmd.materials = [];

		for ( var i = 0; i < metadata.materialCount; i++ ) {

			pmd.materials.push( parseMaterial() );

		}

	};

	var parseBones = function () {

		var parseBone = function () {

			var p = {};
			// Skinning animation doesn't work when bone name is Japanese Unicode in r73.
			// So using charcode strings as workaround and keep original strings in .originalName.
			p.originalName = dv.getSjisStringsAsUnicode( 20 );
			p.name = dv.toCharcodeStrings( p.originalName );
			p.parentIndex = dv.getInt16();
			p.tailIndex = dv.getInt16();
			p.type = dv.getUint8();
			p.ikIndex = dv.getInt16();
			p.position = dv.getFloat32Array( 3 );
			return p;

		};

		var metadata = pmd.metadata;
		metadata.boneCount = dv.getUint16();

		pmd.bones = [];

		for ( var i = 0; i < metadata.boneCount; i++ ) {

			pmd.bones.push( parseBone() );

		}

	};

	var parseIks = function () {

		var parseIk = function () {

			var p = {};
			p.target = dv.getUint16();
			p.effector = dv.getUint16();
			p.linkCount = dv.getUint8();
			p.iteration = dv.getUint16();
			p.maxAngle = dv.getFloat32();

			p.links = [];
			for ( var i = 0; i < p.linkCount; i++ ) {

				var link = {}
				link.index = dv.getUint16();
				p.links.push( link );

			}

			return p;

		};

		var metadata = pmd.metadata;
		metadata.ikCount = dv.getUint16();

		pmd.iks = [];

		for ( var i = 0; i < metadata.ikCount; i++ ) {

			pmd.iks.push( parseIk() );

		}

	};

	var parseMorphs = function () {

		var parseMorph = function () {

			var p = {};
			p.name = dv.getSjisStringsAsUnicode( 20 );
			p.elementCount = dv.getUint32();
			p.type = dv.getUint8();

			p.elements = [];
			for ( var i = 0; i < p.elementCount; i++ ) {

				p.elements.push( {
					index: dv.getUint32(),
					position: dv.getFloat32Array( 3 )
				} ) ;

			}

			return p;

		};

		var metadata = pmd.metadata;
		metadata.morphCount = dv.getUint16();

		pmd.morphs = [];

		for ( var i = 0; i < metadata.morphCount; i++ ) {

			pmd.morphs.push( parseMorph() );

		}


	};

	var parseMorphFrames = function () {

		var parseMorphFrame = function () {

			var p = {};
			p.index = dv.getUint16();
			return p;

		};

		var metadata = pmd.metadata;
		metadata.morphFrameCount = dv.getUint8();

		pmd.morphFrames = [];

		for ( var i = 0; i < metadata.morphFrameCount; i++ ) {

			pmd.morphFrames.push( parseMorphFrame() );

		}

	};

	var parseBoneFrameNames = function () {

		var parseBoneFrameName = function () {

			var p = {};
			p.name = dv.getSjisStringsAsUnicode( 50 );
			return p;

		};

		var metadata = pmd.metadata;
		metadata.boneFrameNameCount = dv.getUint8();

		pmd.boneFrameNames = [];

		for ( var i = 0; i < metadata.boneFrameNameCount; i++ ) {

			pmd.boneFrameNames.push( parseBoneFrameName() );

		}

	};

	var parseBoneFrames = function () {

		var parseBoneFrame = function () {

			var p = {};
			p.boneIndex = dv.getInt16();
			p.frameIndex = dv.getUint8();
			return p;

		};

		var metadata = pmd.metadata;
		metadata.boneFrameCount = dv.getUint32();

		pmd.boneFrames = [];

		for ( var i = 0; i < metadata.boneFrameCount; i++ ) {

			pmd.boneFrames.push( parseBoneFrame() );

		}

	};

	var parseEnglishHeader = function () {

		var metadata = pmd.metadata;
		metadata.englishCompatibility = dv.getUint8();

		if ( metadata.englishCompatibility > 0 ) {

			metadata.englishModelName = dv.getSjisStringsAsUnicode( 20 );
			metadata.englishComment = dv.getSjisStringsAsUnicode( 256 );

		}

	};

	var parseEnglishBoneNames = function () {

		var parseEnglishBoneName = function () {

			var p = {};
			p.name = dv.getSjisStringsAsUnicode( 20 );
			return p;

		};

		var metadata = pmd.metadata;

		if ( metadata.englishCompatibility === 0 ) {

			return;

		}

		pmd.englishBoneNames = [];

		for ( var i = 0; i < metadata.boneCount; i++ ) {

			pmd.englishBoneNames.push( parseEnglishBoneName() );

		}

	};

	var parseEnglishMorphNames = function () {

		var parseEnglishMorphName = function () {

			var p = {};
			p.name = dv.getSjisStringsAsUnicode( 20 );
			return p;

		};

		var metadata = pmd.metadata;

		if ( metadata.englishCompatibility === 0 ) {

			return;

		}

		pmd.englishMorphNames = [];

		for ( var i = 0; i < metadata.morphCount - 1; i++ ) {

			pmd.englishMorphNames.push( parseEnglishMorphName() );

		}

	};

	var parseEnglishBoneFrameNames = function () {

		var parseEnglishBoneFrameName = function () {

			var p = {};
			p.name = dv.getSjisStringsAsUnicode( 50 );
			return p;

		};

		var metadata = pmd.metadata;

		if ( metadata.englishCompatibility === 0 ) {

			return;

		}

		pmd.englishBoneFrameNames = [];

		for ( var i = 0; i < metadata.boneFrameNameCount; i++ ) {

			pmd.englishBoneFrameNames.push( parseEnglishBoneFrameName() );

		}

	};

	var parseToonTextures = function () {

		var parseToonTexture = function () {

			var p = {};
			p.fileName = dv.getSjisStringsAsUnicode( 100 );
			return p;

		};

		pmd.toonTextures = [];

		for ( var i = 0; i < 10; i++ ) {

			pmd.toonTextures.push( parseToonTexture() );

		}

	};

	var parseRigidBodies = function () {

		var parseRigidBody = function () {

			var p = {};
			p.name = dv.getSjisStringsAsUnicode( 20 );
			p.boneIndex = dv.getInt16();
			p.groupIndex = dv.getUint8();
			p.groupTarget = dv.getUint16();
			p.shapeType = dv.getUint8();
			p.width = dv.getFloat32();
			p.height = dv.getFloat32();
			p.depth = dv.getFloat32();
			p.position = dv.getFloat32Array( 3 );
			p.rotation = dv.getFloat32Array( 3 );
			p.weight = dv.getFloat32();
			p.positionDamping = dv.getFloat32();
			p.rotationDamping = dv.getFloat32();
			p.restriction = dv.getFloat32();
			p.friction = dv.getFloat32();
			p.type = dv.getUint8();
			return p;

		};

		var metadata = pmd.metadata;
		metadata.rigidBodyCount = dv.getUint32();

		pmd.rigidBodies = [];

		for ( var i = 0; i < metadata.rigidBodyCount; i++ ) {

			pmd.rigidBodies.push( parseRigidBody() );

		}

	};

	var parseConstraints = function () {

		var parseConstraint = function () {

			var p = {};
			p.name = dv.getSjisStringsAsUnicode( 20 );
			p.rigidBodyIndex1 = dv.getUint32();
			p.rigidBodyIndex2 = dv.getUint32();
			p.position = dv.getFloat32Array( 3 );
			p.rotation = dv.getFloat32Array( 3 );
			p.translationLimitation1 = dv.getFloat32Array( 3 );
			p.translationLimitation2 = dv.getFloat32Array( 3 );
			p.rotationLimitation1 = dv.getFloat32Array( 3 );
			p.rotationLimitation2 = dv.getFloat32Array( 3 );
			p.springPosition = dv.getFloat32Array( 3 );
			p.springRotation = dv.getFloat32Array( 3 );
			return p;

		};

		var metadata = pmd.metadata;
		metadata.constraintCount = dv.getUint32();

		pmd.constraints = [];

		for ( var i = 0; i < metadata.constraintCount; i++ ) {

			pmd.constraints.push( parseConstraint() );

		}

	};

	parseHeader();
	parseVertices();
	parseFaces();
	parseMaterials();
	parseBones();
	parseIks();
	parseMorphs();
	parseMorphFrames();
	parseBoneFrameNames();
	parseBoneFrames();
	parseEnglishHeader();
	parseEnglishBoneNames();
	parseEnglishMorphNames();
	parseEnglishBoneFrameNames();
	parseToonTextures();
	parseRigidBodies();
	parseConstraints();

	// console.log( pmd ); // for console debug

	return pmd;

};

THREE.MMDLoader.prototype.parsePmx = function ( buffer ) {

	var scope = this;
	var pmx = {};
	var dv = new THREE.MMDLoader.DataView( buffer );

	pmx.metadata = {};
	pmx.metadata.format = 'pmx';

	var parseHeader = function () {

		var metadata = pmx.metadata;
		metadata.magic = dv.getChars( 4 );

		// Note: don't remove the last blank space.
		if ( metadata.magic !== 'PMX ' ) {

			throw 'PMX file magic is not PMX , but ' + metadata.magic;

		}

		metadata.version = dv.getFloat32();

		if ( metadata.version !== 2.0 && metadata.version !== 2.1 ) {

			throw 'PMX version ' + metadata.version + ' is not supported.';

		}

		metadata.headerSize = dv.getUint8();
		metadata.encoding = dv.getUint8();
		metadata.additionalUvNum = dv.getUint8();
		metadata.vertexIndexSize = dv.getUint8();
		metadata.textureIndexSize = dv.getUint8();
		metadata.materialIndexSize = dv.getUint8();
		metadata.boneIndexSize = dv.getUint8();
		metadata.morphIndexSize = dv.getUint8();
		metadata.rigidBodyIndexSize = dv.getUint8();
		metadata.modelName = dv.getTextBuffer();
		metadata.englishModelName = dv.getTextBuffer();
		metadata.comment = dv.getTextBuffer();
		metadata.englishComment = dv.getTextBuffer();

	};

	var parseVertices = function () {

		var parseVertex = function () {

			var p = {};
			p.position = dv.getFloat32Array( 3 );
			p.normal = dv.getFloat32Array( 3 );
			p.uv = dv.getFloat32Array( 2 );

			p.auvs = [];

			for ( var i = 0; i < pmx.metadata.additionalUvNum; i++ ) {

				p.auvs.push( dv.getFloat32Array( 4 ) );

			}

			p.type = dv.getUint8();

			var indexSize = metadata.vertexIndexSize;

			if ( p.type === 0 ) {  // BDEF1

				p.skinIndices = dv.getNumberArray( indexSize, 1 );
				p.skinWeights = [ 1.0 ];

			} else if ( p.type === 1 ) {  // BDEF2

				p.skinIndices = dv.getNumberArray( indexSize, 2 );
				p.skinWeights = dv.getFloat32Array( 1 );
				p.skinWeights.push( 1.0 - p.skinWeights[ 0 ] );

			} else if ( p.type === 2 ) {  // BDEF4

				p.skinIndices = dv.getNumberArray( indexSize, 4 );
				p.skinWeights = dv.getFloat32Array( 4 );

			} else if ( p.type === 3 ) {  // SDEF

				p.skinIndices = dv.getNumberArray( indexSize, 2 );
				p.skinWeights = dv.getFloat32Array( 1 );
				p.skinWeights.push( 1.0 - p.skinWeights[ 0 ] );

				p.skinC = dv.getFloat32Array( 3 );
				p.skinR0 = dv.getFloat32Array( 3 );
				p.skinR1 = dv.getFloat32Array( 3 );

				// SDEF is not supported yet and is handled as BDEF2 so far.
				// TODO: SDEF support
				p.type = 1;

			} else {

				throw 'unsupport bone type ' + p.type + ' exception.';

			}

			p.edgeRatio = dv.getFloat32();
			return p;

		};

		var metadata = pmx.metadata;
		metadata.vertexCount = dv.getUint32();

		pmx.vertices = [];

		for ( var i = 0; i < metadata.vertexCount; i++ ) {

			pmx.vertices.push( parseVertex() );

		}

	};

	var parseFaces = function () {

		var parseFace = function () {

			var p = {};
			p.indices = dv.getNumberArray( metadata.vertexIndexSize, 3 );
			return p;

		};

		var metadata = pmx.metadata;
		metadata.faceCount = dv.getUint32() / 3;

		pmx.faces = [];

		for ( var i = 0; i < metadata.faceCount; i++ ) {

			pmx.faces.push( parseFace() );

		}

	};

	var parseTextures = function () {

		var parseTexture = function () {

			return dv.getTextBuffer();

		};

		var metadata = pmx.metadata;
		metadata.textureCount = dv.getUint32();

		pmx.textures = [];

		for ( var i = 0; i < metadata.textureCount; i++ ) {

			pmx.textures.push( parseTexture() );

		}

	};

	var parseMaterials = function () {

		var parseMaterial = function () {

			var p = {};
			p.name = dv.getTextBuffer();
			p.englishName = dv.getTextBuffer();
			p.diffuse = dv.getFloat32Array( 4 );
			p.specular = dv.getFloat32Array( 3 );
			p.shininess = dv.getFloat32();
			p.emissive = dv.getFloat32Array( 3 );
			p.flag = dv.getUint8();
			p.edgeColor = dv.getFloat32Array( 4 );
			p.edgeSize = dv.getFloat32();
			p.textureIndex = dv.getNumber( pmx.metadata.textureIndexSize );
			p.envTextureIndex = dv.getNumber( pmx.metadata.textureIndexSize );
			p.envFlag = dv.getUint8();
			p.toonFlag = dv.getUint8();

			if ( p.toonFlag === 0 ) {

				p.toonIndex = dv.getNumber( pmx.metadata.textureIndexSize );

			} else if ( p.toonFlag === 1 ) {

				p.toonIndex = dv.getInt8();

			} else {

				throw 'unknown toon flag ' + p.toonFlag + ' exception.';

			}

			p.comment = dv.getTextBuffer();
			p.faceCount = dv.getUint32() / 3;
			return p;

		};

		var metadata = pmx.metadata;
		metadata.materialCount = dv.getUint32();

		pmx.materials = [];

		for ( var i = 0; i < metadata.materialCount; i++ ) {

			pmx.materials.push( parseMaterial() );

		}

	};

	var parseBones = function () {

		var parseBone = function () {

			var p = {};
			// Skinning animation doesn't work when bone name is Japanese Unicode in r73.
			// So using charcode strings as workaround and keep original strings in .originalName.
			p.originalName = dv.getTextBuffer();
			p.name = dv.toCharcodeStrings( p.originalName );
			p.englishName = dv.getTextBuffer();
			p.position = dv.getFloat32Array( 3 );
			p.parentIndex = dv.getNumber( pmx.metadata.boneIndexSize );
			p.transformationClass = dv.getUint32();
			p.flag = dv.getUint16();

			if ( p.flag & 0x1 ) {

				p.connectIndex = dv.getNumber( pmx.metadata.boneIndexSize );

			} else {

				p.offsetPosition = dv.getFloat32Array( 3 );

			}

			if ( p.flag & 0x100 || p.flag & 0x200 ) {

				p.supplyParentIndex = dv.getNumber( pmx.metadata.boneIndexSize );
				p.supplyRatio = dv.getFloat32();

			}

			if ( p.flag & 0x400 ) {

				p.fixAxis = dv.getFloat32Array( 3 );

			}

			if ( p.flag & 0x800 ) {

				p.localXVector = dv.getFloat32Array( 3 );
				p.localZVector = dv.getFloat32Array( 3 );

			}

			if ( p.flag & 0x2000 ) {

				p.key = dv.getUint32();

			}

			if ( p.flag & 0x20 ) {

				var ik = {};

				ik.effector = dv.getNumber( pmx.metadata.boneIndexSize );
				ik.target = null;
				ik.iteration = dv.getUint32();
				ik.maxAngle = dv.getFloat32();
				ik.linkCount = dv.getUint32();
				ik.links = [];

				for ( var i = 0; i < ik.linkCount; i++ ) {

					var link = {};
					link.index = dv.getNumber( pmx.metadata.boneIndexSize );
					link.angleLimitation = dv.getUint8();

					if ( link.angleLimitation === 1 ) {

						link.lowerLimitationAngle = dv.getFloat32Array( 3 );
						link.upperLimitationAngle = dv.getFloat32Array( 3 );

					}

					ik.links.push( link );

				}

				p.ik = ik;
			}

			return p;

		};

		var metadata = pmx.metadata;
		metadata.boneCount = dv.getUint32();

		pmx.bones = [];

		for ( var i = 0; i < metadata.boneCount; i++ ) {

			pmx.bones.push( parseBone() );

		}

	};

	var parseMorphs = function () {

		var parseMorph = function () {

			var p = {};
			p.name = dv.getTextBuffer();
			p.englishName = dv.getTextBuffer();
			p.panel = dv.getUint8();
			p.type = dv.getUint8();
			p.elementCount = dv.getUint32();
			p.elements = [];

			for ( var i = 0; i < p.elementCount; i++ ) {

				if ( p.type === 0 ) {  // group morph

					var m = {};
					m.index = dv.getNumber( pmx.metadata.morphIndexSize );
					m.ratio = dv.getFloat32();
					p.elements.push( m );

				} else if ( p.type === 1 ) {  // vertex morph

					var m = {};
					m.index = dv.getNumber( pmx.metadata.vertexIndexSize );
					m.position = dv.getFloat32Array( 3 );
					p.elements.push( m );

				} else if ( p.type === 2 ) {  // bone morph

					var m = {};
					m.index = dv.getNumber( pmx.metadata.boneIndexSize );
					m.position = dv.getFloat32Array( 3 );
					m.rotation = dv.getFloat32Array( 4 );
					p.elements.push( m );

				} else if ( p.type === 3 ) {  // uv morph

					var m = {};
					m.index = dv.getNumber( pmx.metadata.vertexIndexSize );
					m.uv = dv.getFloat32Array( 4 );
					p.elements.push( m );

				} else if ( p.type === 8 ) {  // material morph

					var m = {};
					m.index = dv.getNumber( pmx.metadata.materialIndexSize );
					m.type = dv.getUint8();
					m.diffuse = dv.getFloat32Array( 4 );
					m.specular = dv.getFloat32Array( 3 );
					m.shininess = dv.getFloat32();
					m.emissive = dv.getFloat32Array( 3 );
					m.edgeColor = dv.getFloat32Array( 4 );
					m.edgeSize = dv.getFloat32();
					m.textureColor = dv.getFloat32Array( 4 );
					m.sphereTextureColor = dv.getFloat32Array( 4 );
					m.toonColor = dv.getFloat32Array( 4 );
					p.elements.push( m );

				}

			}

			return p;

		};

		var metadata = pmx.metadata;
		metadata.morphCount = dv.getUint32();

		pmx.morphs = [];

		for ( var i = 0; i < metadata.morphCount; i++ ) {

			pmx.morphs.push( parseMorph() );

		}


	};

	var parseFrames = function () {

		var parseFrame = function () {

			var p = {};
			p.name = dv.getTextBuffer();
			p.englishName = dv.getTextBuffer();
			p.type = dv.getUint8();
			p.elementCount = dv.getUint32();
			p.elements = [];

			for ( var i = 0; i < p.elementCount; i++ ) {

				var e = {};
				e.target = dv.getUint8();
				e.index = ( e.target === 0 ) ? dv.getNumber( pmx.metadata.boneIndexSize ) : dv.getNumber( pmx.metadata.morphIndexSize );
				p.elements.push( e );

			}

			return p;

		};

		var metadata = pmx.metadata;
		metadata.frameCount = dv.getUint32();

		pmx.frames = [];

		for ( var i = 0; i < metadata.frameCount; i++ ) {

			pmx.frames.push( parseFrame() );

		}

	};

	var parseRigidBodies = function () {

		var parseRigidBody = function () {

			var p = {};
			p.name = dv.getTextBuffer();
			p.englishName = dv.getTextBuffer();
			p.boneIndex = dv.getNumber( pmx.metadata.boneIndexSize );
			p.groupIndex = dv.getUint8();
			p.groupTarget = dv.getUint16();
			p.shapeType = dv.getUint8();
			p.width = dv.getFloat32();
			p.height = dv.getFloat32();
			p.depth = dv.getFloat32();
			p.position = dv.getFloat32Array( 3 );
			p.rotation = dv.getFloat32Array( 3 );
			p.weight = dv.getFloat32();
			p.positionDamping = dv.getFloat32();
			p.rotationDamping = dv.getFloat32();
			p.restriction = dv.getFloat32();
			p.friction = dv.getFloat32();
			p.type = dv.getUint8();
			return p;

		};

		var metadata = pmx.metadata;
		metadata.rigidBodyCount = dv.getUint32();

		pmx.rigidBodies = [];

		for ( var i = 0; i < metadata.rigidBodyCount; i++ ) {

			pmx.rigidBodies.push( parseRigidBody() );

		}

	};

	var parseConstraints = function () {

		var parseConstraint = function () {

			var p = {};
			p.name = dv.getTextBuffer();
			p.englishName = dv.getTextBuffer();
			p.type = dv.getUint8();
			p.rigidBodyIndex1 = dv.getNumber( pmx.metadata.rigidBodyIndexSize );
			p.rigidBodyIndex2 = dv.getNumber( pmx.metadata.rigidBodyIndexSize );
			p.position = dv.getFloat32Array( 3 );
			p.rotation = dv.getFloat32Array( 3 );
			p.translationLimitation1 = dv.getFloat32Array( 3 );
			p.translationLimitation2 = dv.getFloat32Array( 3 );
			p.rotationLimitation1 = dv.getFloat32Array( 3 );
			p.rotationLimitation2 = dv.getFloat32Array( 3 );
			p.springPosition = dv.getFloat32Array( 3 );
			p.springRotation = dv.getFloat32Array( 3 );
			return p;

		};

		var metadata = pmx.metadata;
		metadata.constraintCount = dv.getUint32();

		pmx.constraints = [];

		for ( var i = 0; i < metadata.constraintCount; i++ ) {

			pmx.constraints.push( parseConstraint() );

		}

	};

	parseHeader();
	parseVertices();
	parseFaces();
	parseTextures();
	parseMaterials();
	parseBones();
	parseMorphs();
	parseFrames();
	parseRigidBodies();
	parseConstraints();

	// console.log( pmx ); // for console debug

	return pmx;

};

THREE.MMDLoader.prototype.parseVmd = function ( buffer ) {

	var scope = this;
	var vmd = {};
	var dv = new THREE.MMDLoader.DataView( buffer );

	vmd.metadata = {};

	var parseHeader = function () {

		var metadata = vmd.metadata;
		metadata.magic = dv.getChars( 30 );

		if ( metadata.magic !== 'Vocaloid Motion Data 0002' ) {

			throw 'VMD file magic is not Vocaloid Motion Data 0002, but ' + metadata.magic;

		}

		metadata.name = dv.getSjisStringsAsUnicode( 20 );

	};

	var parseMotions = function () {

		var parseMotion = function () {

			var p = {};
			// Skinning animation doesn't work when bone name is Japanese Unicode in r73.
			// So using charcode strings as workaround and keep original strings in .originalName.
			p.originalBoneName = dv.getSjisStringsAsUnicode( 15 );
			p.boneName = dv.toCharcodeStrings( p.originalBoneName );
			p.frameNum = dv.getUint32();
			p.position = dv.getFloat32Array( 3 );
			p.rotation = dv.getFloat32Array( 4 );
			p.interpolation = dv.getUint8Array( 64 );

			return p;

		};

		var metadata = vmd.metadata;
		metadata.motionCount = dv.getUint32();

		vmd.motions = [];
		for ( var i = 0; i < metadata.motionCount; i++ ) {

			vmd.motions.push( parseMotion() );

		}

	};

	var parseMorphs = function () {

		var parseMorph = function () {

			var p = {};
			p.morphName = dv.getSjisStringsAsUnicode( 15 );
			p.frameNum = dv.getUint32();
			p.weight = dv.getFloat32();
			return p;

		};

		var metadata = vmd.metadata;
		metadata.morphCount = dv.getUint32();

		vmd.morphs = [];
		for ( var i = 0; i < metadata.morphCount; i++ ) {

			vmd.morphs.push( parseMorph() );

		}

	};

	parseHeader();
	parseMotions();
	parseMorphs();

	return vmd;

};

// maybe better to create json and then use JSONLoader...
THREE.MMDLoader.prototype.createMesh = function ( model, vmd, texturePath, onProgress, onError ) {

	var scope = this;
	var geometry = new THREE.Geometry();
        var material = new THREE.MeshFaceMaterial();

	var leftToRight = function() {

		var convertVector = function ( v ) {

			v[ 2 ] = -v[ 2 ];

		};

		var convertQuaternion = function ( q ) {

			q[ 0 ] = -q[ 0 ];
			q[ 1 ] = -q[ 1 ];

		};

		var convertEuler = function ( r ) {

			r[ 0 ] = -r[ 0 ];
			r[ 1 ] = -r[ 1 ];

		};

		var convertIndexOrder = function ( p ) {

			var tmp = p[ 2 ];
			p[ 2 ] = p[ 0 ];
			p[ 0 ] = tmp;

		};

		var convertVectorRange = function ( v1, v2 ) {

			var tmp = -v2[ 2 ];
			v2[ 2 ] = -v1[ 2 ];
			v1[ 2 ] = tmp;

		};

		var convertEulerRange = function ( r1, r2 ) {

			var tmp1 = -r2[ 0 ];
			var tmp2 = -r2[ 1 ];
			r2[ 0 ] = -r1[ 0 ];
			r2[ 1 ] = -r1[ 1 ];
			r1[ 0 ] = tmp1;
			r1[ 1 ] = tmp2;

		};

		for ( var i = 0; i < model.metadata.vertexCount; i++ ) {

			convertVector( model.vertices[ i ].position );
			convertVector( model.vertices[ i ].normal );

		}

		for ( var i = 0; i < model.metadata.faceCount; i++ ) {

			convertIndexOrder( model.faces[ i ].indices );

		}

		for ( var i = 0; i < model.metadata.boneCount; i++ ) {

			convertVector( model.bones[ i ].position );

		}

		// TODO: support other morph for PMX
		for ( var i = 0; i < model.metadata.morphCount; i++ ) {

			var m = model.morphs[ i ];

			if ( model.metadata.format === 'pmx' ) {

				if ( m.type === 1 ) {

					m = m.elements;

				} else {

					continue;

				}

			}

			for ( var j = 0; j < m.elementCount; j++ ) {

				convertVector( m.elements[ j ].position );

			}

		}

		for ( var i = 0; i < model.metadata.rigidBodyCount; i++ ) {

			convertVector( model.rigidBodies[ i ].position );
			convertEuler( model.rigidBodies[ i ].rotation );

		}

		for ( var i = 0; i < model.metadata.constraintCount; i++ ) {

			convertVector( model.constraints[ i ].position );
			convertEuler( model.constraints[ i ].rotation );
			convertVectorRange( model.constraints[ i ].translationLimitation1, model.constraints[ i ].translationLimitation2 );
			convertEulerRange( model.constraints[ i ].rotationLimitation1, model.constraints[ i ].rotationLimitation2 );

		}

		if ( vmd === null ) {

			return;

		}

		for ( var i = 0; i < vmd.metadata.motionCount; i++ ) {

			convertVector( vmd.motions[ i ].position );
			convertQuaternion( vmd.motions[ i ].rotation );

		}

	};

	var initVartices = function () {

		for ( var i = 0; i < model.metadata.vertexCount; i++ ) {

			var v = model.vertices[ i ];

			geometry.vertices.push(
				new THREE.Vector3(
					v.position[ 0 ],
					v.position[ 1 ],
					v.position[ 2 ]
				)
			);

			geometry.skinIndices.push(
				new THREE.Vector4(
					v.skinIndices.length >= 1 ? v.skinIndices[ 0 ] : 0.0,
					v.skinIndices.length >= 2 ? v.skinIndices[ 1 ] : 0.0,
					v.skinIndices.length >= 3 ? v.skinIndices[ 2 ] : 0.0,
					v.skinIndices.length >= 4 ? v.skinIndices[ 3 ] : 0.0
				)
			);

			geometry.skinWeights.push(
				new THREE.Vector4(
					v.skinWeights.length >= 1 ? v.skinWeights[ 0 ] : 0.0,
					v.skinWeights.length >= 2 ? v.skinWeights[ 1 ] : 0.0,
					v.skinWeights.length >= 3 ? v.skinWeights[ 2 ] : 0.0,
					v.skinWeights.length >= 4 ? v.skinWeights[ 3 ] : 0.0
				)
			);

		}

	};

	var initFaces = function () {

		for ( var i = 0; i < model.metadata.faceCount; i++ ) {

			geometry.faces.push(
				new THREE.Face3(
					model.faces[ i ].indices[ 0 ],
					model.faces[ i ].indices[ 1 ],
					model.faces[ i ].indices[ 2 ]
				)
			);

			for ( var j = 0; j < 3; j++ ) {

				geometry.faces[ i ].vertexNormals[ j ] =
					new THREE.Vector3(
						model.vertices[ model.faces[ i ].indices[ j ] ].normal[ 0 ],
						model.vertices[ model.faces[ i ].indices[ j ] ].normal[ 1 ],
						model.vertices[ model.faces[ i ].indices[ j ] ].normal[ 2 ]
					);

			}

		}

	};

	var initBones = function () {

		var bones = [];

		for ( var i = 0; i < model.metadata.boneCount; i++ ) {

			var bone = {};
			var b = model.bones[ i ];

			bone.parent = b.parentIndex;
			bone.name = b.name;
			bone.pos = [ b.position[ 0 ], b.position[ 1 ], b.position[ 2 ] ];
			bone.rotq = [ 0, 0, 0, 1 ];
			bone.scl = [ 1, 1, 1 ];

			if ( bone.parent !== -1 ) {

				bone.pos[ 0 ] -= model.bones[ bone.parent ].position[ 0 ];
				bone.pos[ 1 ] -= model.bones[ bone.parent ].position[ 1 ];
				bone.pos[ 2 ] -= model.bones[ bone.parent ].position[ 2 ];

			}

			bones.push( bone );

		}

		geometry.bones = bones;

	};

	var initIKs = function () {

		var iks = [];

		// TODO: remove duplicated codes between PMD and PMX
		if ( model.metadata.format === 'pmd' ) {

			for ( var i = 0; i < model.metadata.ikCount; i++ ) {

				var ik = model.iks[i];
				var param = {};

				param.target = ik.target;
				param.effector = ik.effector;
				param.iteration = ik.iteration;
				param.maxAngle = ik.maxAngle * 4;
				param.links = [];

				for ( var j = 0; j < ik.links.length; j++ ) {

					var link = {};
					link.index = ik.links[ j ].index;

					// Checking with .originalName, not .name.
					// See parseBone() for the detail.
					if ( model.bones[ link.index ].originalName.indexOf( 'ひざ' ) >= 0 ) {

						link.limitation = new THREE.Vector3( 1.0, 0.0, 0.0 );

					}

					param.links.push( link );

				}

				iks.push( param );

			}

		} else {

			for ( var i = 0; i < model.metadata.boneCount; i++ ) {

				var b = model.bones[ i ];
				var ik = b.ik;

				if ( ik === undefined ) {

					continue;

				}

				var param = {};

				param.target = i;
				param.effector = ik.effector;
				param.iteration = ik.iteration;
				param.maxAngle = ik.maxAngle;
				param.links = [];

				for ( var j = 0; j < ik.links.length; j++ ) {

					var link = {};
					link.index = ik.links[ j ].index;

					if ( ik.links[ j ].angleLimitation === 1 ) {

						link.limitation = new THREE.Vector3( 1.0, 0.0, 0.0 );
						// TODO: use limitation angles
						// link.lowerLimitationAngle;
						// link.upperLimitationAngle;

					}

					param.links.push( link );

				}

				iks.push( param );

			}

		}

		geometry.iks = iks;

	};

	var initMorphs = function () {

		function updateVertex ( params, index, v, ratio ) {

			params.vertices[ index ].x += v.position[ 0 ] * ratio;
			params.vertices[ index ].y += v.position[ 1 ] * ratio;
			params.vertices[ index ].z += v.position[ 2 ] * ratio;

		};

		function updateVertices ( params, m, ratio ) {

			for ( var i = 0; i < m.elementCount; i++ ) {

				var v = m.elements[ i ];

				var index;

				if ( model.metadata.format === 'pmd' ) {

					index = model.morphs[ 0 ].elements[ v.index ].index;

				} else {

					index = v.index;

				}

				updateVertex( params, index, v, ratio );

			}

		};

		for ( var i = 0; i < model.metadata.morphCount; i++ ) {

			var m = model.morphs[ i ];
			var params = {};

			params.name = m.name;
			params.vertices = [];

			for ( var j = 0; j < model.metadata.vertexCount; j++ ) {

				params.vertices[ j ] = new THREE.Vector3( 0, 0, 0 );
				params.vertices[ j ].x = geometry.vertices[ j ].x;
				params.vertices[ j ].y = geometry.vertices[ j ].y;
				params.vertices[ j ].z = geometry.vertices[ j ].z;

			}

			if ( model.metadata.format === 'pmd' ) {

				if ( i !== 0 ) {

					updateVertices( params, m, 1.0 );

				}

			} else {

				if ( m.type === 0 ) {

					for ( var j = 0; j < m.elementCount; j++ ) {

						var m2 = model.morphs[ m.elements[ j ].index ];
						var ratio = m.elements[ j ].ratio;

						if ( m2.type === 1 ) {

							updateVertices( params, m2, ratio );

						}

					}

				} else if ( m.type === 1 ) {

					updateVertices( params, m, 1.0 );

				}

			}

			// TODO: skip if this's non-vertex morphing of PMX to reduce CPU/Memory use
			geometry.morphTargets.push( params );

		}

	};

	var initMaterials = function () {

		var textures = [];
		var textureLoader = new THREE.TextureLoader( this.manager );
		var tgaLoader = new THREE.TGALoader( this.manager );
		var materialLoader = new THREE.MaterialLoader( this.manager );
		var color = new THREE.Color();
		var offset = 0;
		var materialParams = [];

		function loadTexture ( filePath, params ) {

			if ( params === undefined ) {

				params = {};

			}

			var directoryPath = ( params.defaultTexturePath === true ) ? scope.defaultTexturePath : texturePath;
			var fullPath = directoryPath + filePath;

			var loader = THREE.Loader.Handlers.get( fullPath );

			if ( loader === null ) {

				loader = ( filePath.indexOf( '.tga' ) >= 0 ) ? tgaLoader : textureLoader;

			}

			var texture = loader.load( fullPath );
			texture.flipY = false;

			if ( params.sphericalReflectionMapping === true ) {

				texture.mapping = THREE.SphericalReflectionMapping;

			}

			var uuid = THREE.Math.generateUUID();

			textures[ uuid ] = texture;

			return uuid;

		};

		for ( var i = 1; i < model.metadata.materialCount; i++ ) {

			geometry.faceVertexUvs.push( [] );

		}

		for ( var i = 0; i < model.metadata.materialCount; i++ ) {

			var m = model.materials[ i ];
			var params = {

				uuid: THREE.Math.generateUUID(),
				type: 'MMDMaterial'

			};

			for ( var j = 0; j < m.faceCount; j++ ) {

				geometry.faces[ offset ].materialIndex = i;

				var uvs = [];

				for ( var k = 0; k < 3; k++ ) {

					var v = model.vertices[ model.faces[ offset ].indices[ k ] ];
					uvs.push( new THREE.Vector2( v.uv[ 0 ], v.uv[ 1 ] ) );

				}

				geometry.faceVertexUvs[ 0 ].push( uvs );

				offset++;

			}

			params.name = m.name;
			params.color = color.fromArray( [ m.diffuse[ 0 ], m.diffuse[ 1 ], m.diffuse[ 2 ] ] ).getHex();
			params.opacity = m.diffuse[ 3 ];
			params.specular = color.fromArray( [ m.specular[ 0 ], m.specular[ 1 ], m.specular[ 2 ] ] ).getHex();
			params.shininess = m.shininess;

			if ( params.opacity < 1 ) {

				params.transparent = true;

			}

			// temporal workaround
			// TODO: implement correctly
			//params.side = THREE.DoubleSide;

			if ( model.metadata.format === 'pmd' ) {

				if ( m.fileName ) {

					var fileName = m.fileName;
					var fileNames = [];

					var index = fileName.lastIndexOf( '*' );

					if ( index >= 0 ) {

						fileNames.push( fileName.slice( 0, index ) );
						fileNames.push( fileName.slice( index + 1 ) );

					} else {

						fileNames.push( fileName );

					}

					for ( var j = 0; j < fileNames.length; j++ ) {

						var n = fileNames[ j ];

						if ( n.indexOf( '.sph' ) >= 0 || n.indexOf( '.spa' ) >= 0 ) {

							params.envMap = loadTexture( n, { sphericalReflectionMapping: true } );

							if ( n.indexOf( '.sph' ) >= 0 ) {

								params.envMapType = THREE.MultiplyOperation;

							} else {

								params.envMapType = THREE.AddOperation;

							}

						} else {

							params.map = loadTexture( n );

						}

					}

				}

			} else {

				if ( m.textureIndex !== -1 ) {

					var n = model.textures[ m.textureIndex ];
					params.map = loadTexture( n );

				}

				// TODO: support m.envFlag === 3
				if ( m.envTextureIndex !== -1 && ( m.envFlag === 1 || m.envFlag == 2 ) ) {

					var n = model.textures[ m.envTextureIndex ];
					params.envMap = loadTexture( n, { sphericalReflectionMapping: true } );

					if ( m.envFlag === 1 ) {

						params.envMapType = THREE.MultiplyOperation;

					} else {

						params.envMapType = THREE.AddOperation;

					}

				}

			}

			if ( params.map === undefined ) {

				params.emissive = color.fromArray( [ m.emissive[ 0 ], m.emissive[ 1 ], m.emissive[ 2 ] ] ).getHex();

			}

			var shader = THREE.ShaderLib[ 'mmd' ];
			params.uniforms = THREE.UniformsUtils.clone( shader.uniforms );
			params.vertexShader = shader.vertexShader;
			params.fragmentShader = shader.fragmentShader;

			materialParams.push( params );

		}

		materialLoader.setTextures( textures );

		for ( var i = 0; i < materialParams.length; i++ ) {

			var p = materialParams[ i ];
			var p2 = model.materials[ i ];
			var m = materialLoader.parse( p );

			m.skinning = true;
			m.morphTargets = true;
			m.lights = true;

			if ( p.envMap !== undefined ) {

				m.combine = p.envMapType;

			}

			m.uniforms.opacity.value = m.opacity;
			m.uniforms.diffuse.value = m.color;

			if ( m.emissive ) {

				m.uniforms.emissive.value = m.emissive;

			}

			m.uniforms.map.value = m.map;
			m.uniforms.envMap.value = m.envMap;
			m.uniforms.specular.value = m.specular;
			m.uniforms.shininess.value = Math.max( m.shininess, 1e-4 ); // to prevent pow( 0.0, 0.0 )

			if ( model.metadata.format === 'pmd' ) {

				function isDefaultToonTexture ( n ) {

					if ( n.length !== 10 ) {

						return false;

					}

					var prefix = n.slice( 0, 4 );
					var num = parseInt( n.slice( 4, 6 ) );
					var suffix = n.slice( 6, 10 );

					if ( prefix === 'toon' && suffix === '.bmp' && ! isNaN( num ) && num >= 0 && num <= 10 ) {

						return true;

					} else {

						return false;

					}

				};

				m.uniforms.outlineThickness.value = p2.edgeFlag === 1 ? 0.003 : 0.0;
				m.uniforms.outlineColor.value = new THREE.Color( 0.0, 0.0, 0.0 );
				m.uniforms.outlineAlpha.value = 1.0;
				m.uniforms.toonMap.value = textures[ p2.toonIndex ];
				m.uniforms.celShading.value = 1;

				// temporal workaround
				// TODO: handle correctly
				var n = model.toonTextures[ p2.toonIndex === -1 ? 0 : p2.toonIndex ].fileName;
				var uuid = loadTexture( n, { defaultTexturePath: isDefaultToonTexture( n ) } );
				m.uniforms.toonMap.value = textures[ uuid ];

			} else {

				m.uniforms.outlineThickness.value = p2.edgeSize / 300;
				m.uniforms.outlineColor.value = new THREE.Color( p2.edgeColor[ 0 ], p2.edgeColor[ 1 ], p2.edgeColor[ 2 ] );
				m.uniforms.outlineAlpha.value = p2.edgeColor[ 3 ];
				m.uniforms.celShading.value = 1;

				// temporal workaround
				// TODO: handle correctly
				var index = p2.toonIndex === -1 ? -1 : p2.toonIndex;
				var flag = p2.toonIndex === -1 ? 1 : p2.toonFlag;

				if ( flag === 0 ) {

					var n = model.textures[ index ];
					var uuid = loadTexture( n );
					m.uniforms.toonMap.value = textures[ uuid ];

				} else {

					var num = index + 1;
					var fileName = 'toon' + ( num < 10 ? '0' + num : num ) + '.bmp';
					var uuid = loadTexture( fileName, { defaultTexturePath: true } );
					m.uniforms.toonMap.value = textures[ uuid ];

				}

			}

			material.materials.push( m );

		}

	};

	var initPhysics = function () {

		var rigidBodies = [];
		var constraints = [];

		for ( var i = 0; i < model.metadata.rigidBodyCount; i++ ) {

			var b = model.rigidBodies[ i ];
			var keys = Object.keys( b );

			var p = {};

			for ( var j = 0; j < keys.length; j++ ) {

				var key = keys[ j ];
				p[ key ] = b[ key ];

			}

			/*
			 * RigidBody position parameter in PMX seems global position
			 * while the one in PMD seems offset from corresponding bone.
			 * So unify being offset.
			 */
			if ( model.metadata.format === 'pmx' ) {

				if ( p.boneIndex !== -1 ) {

					var bone = model.bones[ p.boneIndex ];
					p.position[ 0 ] -= bone.position[ 0 ];
					p.position[ 1 ] -= bone.position[ 1 ];
					p.position[ 2 ] -= bone.position[ 2 ];

				}

			}

			rigidBodies.push( p );

		}

		for ( var i = 0; i < model.metadata.constraintCount; i++ ) {

			var c = model.constraints[ i ];
			var keys = Object.keys( c );

			var p = {};

			for ( var j = 0; j < keys.length; j++ ) {

				var key = keys[ j ];
				p[ key ] = c[ key ];

			}

			var bodyA = rigidBodies[ p.rigidBodyIndex1 ];
			var bodyB = rigidBodies[ p.rigidBodyIndex2 ];

			/*
			 * Refer http://www20.atpages.jp/katwat/wp/?p=4135 
			 * for what this is for
			 */
			if ( bodyA.type !== 0 && bodyB.type === 2 ) {

				if ( bodyA.boneIndex !== -1 && bodyB.boneIndex !== -1 &&
				     model.bones[ bodyB.boneIndex ].parentIndex === bodyA.boneIndex ) {

					bodyB.type = 1;

				}

			}

			constraints.push( p );

		}

		geometry.rigidBodies = rigidBodies;
		geometry.constraints = constraints;

	};

	var initMotionAnimations = function () {

		var orderedMotions = [];
		var boneTable = {};

		for ( var i = 0; i < model.metadata.boneCount; i++ ) {

			var b = model.bones[ i ];
			boneTable[ b.name ] = i;
			orderedMotions[ i ] = [];

		}

		for ( var i = 0; i < vmd.motions.length; i++ ) {

			var m = vmd.motions[ i ];
			var num = boneTable[ m.boneName ];

			if ( num === undefined )
				continue;

			orderedMotions[ num ].push( m );

		}

		for ( var i = 0; i < orderedMotions.length; i++ ) {

			orderedMotions[ i ].sort( function ( a, b ) {

				return a.frameNum - b.frameNum;

			} ) ;

		}

		var animation = {
			name: 'Action',
			fps: 30,
			length: 0.0,
			hierarchy: []
		};

		for ( var i = 0; i < geometry.bones.length; i++ ) {

			animation.hierarchy.push(
				{
					parent: geometry.bones[ i ].parent,
					keys: []
				}
			);

		}

		var maxTime = 0.0;

		for ( var i = 0; i < orderedMotions.length; i++ ) {

			var array = orderedMotions[ i ];

			for ( var j = 0; j < array.length; j++ ) {

				var t = array[ j ].frameNum / 30;
				var p = array[ j ].position;
				var r = array[ j ].rotation;

				animation.hierarchy[ i ].keys.push(
					{
						time: t,
						pos: [ geometry.bones[ i ].pos[ 0 ] + p[ 0 ],
						       geometry.bones[ i ].pos[ 1 ] + p[ 1 ],
						       geometry.bones[ i ].pos[ 2 ] + p[ 2 ] ],
						rot: [ r[ 0 ], r[ 1 ], r[ 2 ], r[ 3 ] ],
						scl: [ 1, 1, 1 ]
					}
				);

				if ( t > maxTime )
					maxTime = t;

			}

		}

		// add 2 secs as afterglow
		maxTime += 2.0;
		animation.length = maxTime;

		for ( var i = 0; i < orderedMotions.length; i++ ) {

			var keys = animation.hierarchy[ i ].keys;

			if ( keys.length === 0 ) {

				keys.push( { time: 0.0,
				             pos: [ geometry.bones[ i ].pos[ 0 ],
				                    geometry.bones[ i ].pos[ 1 ],
				                    geometry.bones[ i ].pos[ 2 ] ],
				             rot: [ 0, 0, 0, 1 ],
				             scl: [ 1, 1, 1 ]
				           } );

			}

			var k = keys[ 0 ];

			if ( k.time !== 0.0 ) {

				keys.unshift( { time: 0.0,
				                 pos: [ k.pos[ 0 ], k.pos[ 1 ], k.pos[ 2 ] ],
				                 rot: [ k.rot[ 0 ], k.rot[ 1 ], k.rot[ 2 ], k.rot[ 3 ] ],
				                 scl: [ 1, 1, 1 ]
				              } );

			}

			k = keys[ keys.length - 1 ];

			if ( k.time < maxTime ) {

				keys.push( { time: maxTime,
				             pos: [ k.pos[ 0 ], k.pos[ 1 ], k.pos[ 2 ] ],
				             rot: [ k.rot[ 0 ], k.rot[ 1 ], k.rot[ 2 ], k.rot[ 3 ] ],
				             scl: [ 1, 1, 1 ]
			        	   } );

			}

		}

//		geometry.animation = animation;
		geometry.animations = [];
		geometry.animations.push( THREE.AnimationClip.parseAnimation( animation, geometry.bones ) );


	};

	var initMorphAnimations = function () {

		var orderedMorphs = [];
		var morphTable = {}

		for ( var i = 0; i < model.metadata.morphCount; i++ ) {

			var m = model.morphs[ i ];
			morphTable[ m.name ] = i;
			orderedMorphs[ i ] = [];

		}

		for ( var i = 0; i < vmd.morphs.length; i++ ) {

			var m = vmd.morphs[ i ];
			var num = morphTable[ m.morphName ];

			if ( num === undefined )
				continue;

			orderedMorphs[ num ].push( m );

		}

		for ( var i = 0; i < orderedMorphs.length; i++ ) {

			orderedMorphs[ i ].sort( function ( a, b ) {

				return a.frameNum - b.frameNum;

			} ) ;

		}

		var morphAnimation = {
			fps: 30,
			length: 0.0,
			hierarchy: []
		};

		for ( var i = 0; i < model.metadata.morphCount; i++ ) {

			morphAnimation.hierarchy.push( { keys: [] } );

		}

		var maxTime = 0.0;

		for ( var i = 0; i < orderedMorphs.length; i++ ) {

			var array = orderedMorphs[ i ];

			for ( var j = 0; j < array.length; j++ ) {

				var t = array[ j ].frameNum / 30;
				var w = array[ j ].weight;

				morphAnimation.hierarchy[ i ].keys.push( { time: t, value: w } );

				if ( t > maxTime ) {

					maxTime = t;

				}

			}

		}

		// add 2 secs as afterglow
		maxTime += 2.0;

		// use animation's length if exists. animation is master.
		maxTime = ( geometry.animation !== undefined &&
		            geometry.animation.length > 0.0 )
		            	? geometry.animation.length : maxTime;
		morphAnimation.length = maxTime;

		for ( var i = 0; i < orderedMorphs.length; i++ ) {

			var keys = morphAnimation.hierarchy[ i ].keys;

			if ( keys.length === 0 ) {

				keys.push( { time: 0.0, value: 0.0 } );

			}

			var k = keys[ 0 ];

			if ( k.time !== 0.0 ) {

				keys.unshift( { time: 0.0, value: k.value } );

			}

			k = keys[ keys.length - 1 ];

			if ( k.time < maxTime ) {

				keys.push( { time: maxTime, value: k.value } );

			}

		}

//		geometry.morphAnimation = morphAnimation;

		var tracks = [];

		for ( var i = 1; i < orderedMorphs.length; i++ ) {

			var h = morphAnimation.hierarchy[ i ];
			tracks.push( new THREE.NumberKeyframeTrack( '.morphTargetInfluences[' + i + ']', h.keys ) );

		}

		geometry.morphAnimations = [];
		geometry.morphAnimations.push( new THREE.AnimationClip( 'morphAnimation', -1, tracks ) );

	};

	leftToRight();
	initVartices();
	initFaces();
	initBones();
	initIKs();
	initMorphs();
	initMaterials();
	initPhysics();

	if ( vmd !== null ) {

		initMotionAnimations();
		initMorphAnimations();

	}

	geometry.computeFaceNormals();
	geometry.verticesNeedUpdate = true;
	geometry.normalsNeedUpdate = true;
	geometry.uvsNeedUpdate = true;
	geometry.mmdFormat = model.metadata.format;

	var mesh = new THREE.SkinnedMesh( geometry, material );

	// console.log( mesh ); // for console debug

	return mesh;

};

THREE.MMDLoader.DataView = function ( buffer, littleEndian ) {

	this.dv = new DataView( buffer );
	this.offset = 0;
	this.littleEndian = ( littleEndian !== undefined ) ? littleEndian : true;
	this.encoder = new CharsetEncoder();

};

THREE.MMDLoader.DataView.prototype = {

	constructor: THREE.MMDLoader.DataView,

	getInt8: function () {

		var value = this.dv.getInt8( this.offset );
		this.offset += 1;
		return value;

	},

	getInt8Array: function ( size ) {

		var a = [];

		for ( var i = 0; i < size; i++ ) {

			a.push( this.getInt8() );

		}

		return a;

	},

	getUint8: function () {

		var value = this.dv.getUint8( this.offset );
		this.offset += 1;
		return value;

	},

	getUint8Array: function ( size ) {

		var a = [];

		for ( var i = 0; i < size; i++ ) {

			a.push( this.getUint8() );

		}

		return a;

	},


	getInt16: function () {

		var value = this.dv.getInt16( this.offset, this.littleEndian );
		this.offset += 2;
		return value;

	},

	getInt16Array: function ( size ) {

		var a = [];

		for ( var i = 0; i < size; i++ ) {

			a.push( this.getInt16() );

		}

		return a;

	},

	getUint16: function () {

		var value = this.dv.getUint16( this.offset, this.littleEndian );
		this.offset += 2;
		return value;

	},

	getUint16Array: function ( size ) {

		var a = [];

		for ( var i = 0; i < size; i++ ) {

			a.push( this.getUint16() );

		}

		return a;

	},

	getInt32: function () {

		var value = this.dv.getInt32( this.offset, this.littleEndian );
		this.offset += 4;
		return value;

	},

	getInt32Array: function ( size ) {

		var a = [];

		for ( var i = 0; i < size; i++ ) {

			a.push( this.getInt32() );

		}

		return a;

	},

	getUint32: function () {

		var value = this.dv.getUint32( this.offset, this.littleEndian );
		this.offset += 4;
		return value;

	},

	getUint32Array: function ( size ) {

		var a = [];

		for ( var i = 0; i < size; i++ ) {

			a.push( this.getUint32() );

		}

		return a;

	},

	getFloat32: function () {

		var value = this.dv.getFloat32( this.offset, this.littleEndian );
		this.offset += 4;
		return value;

	},

	getFloat32Array: function( size ) {

		var a = [];

		for ( var i = 0; i < size; i++ ) {

			a.push( this.getFloat32() );

		}

		return a;

	},

	getFloat64: function () {

		var value = this.dv.getFloat64( this.offset, this.littleEndian );
		this.offset += 8;
		return value;

	},

	getFloat64Array: function( size ) {

		var a = [];

		for ( var i = 0; i < size; i++ ) {

			a.push( this.getFloat64() );

		}

		return a;

	},

	getNumber: function ( type ) {

		switch ( type ) {

			case 1:
				return this.getInt8();

			case 2:
				return this.getInt16();

			case 4:
				return this.getInt32();

			default:
				throw 'unknown number type ' + type + ' exception.';

		}

	},

	getNumberArray: function ( type, size ) {

		var a = [];

		for ( var i = 0; i < size; i++ ) {

			a.push( this.getNumber( type ) );

		}

		return a;

	},

	getChars: function ( size ) {

		var str = '';

		while ( size > 0 ) {

			var value = this.getUint8();
			size--;

			if ( value === 0 ) {

				break;

			}

			str += String.fromCharCode( value );

		}

		while ( size > 0 ) {

			this.getUint8();
			size--;

		}

		return str;

	},

	getSjisStringsAsUnicode: function ( size ) {

		var a = [];

		while ( size > 0 ) {

			var value = this.getUint8();
			size--;

			if ( value === 0 ) {

				break;

			}

			a.push( value );

		}

		while ( size > 0 ) {

			this.getUint8();
			size--;

		}

		return this.encoder.s2u( new Uint8Array( a ) );

	},

	/*
         * Note: Sometimes to use Japanese Unicode characters runs into problems in Three.js.
	 *       In such a case, use this method to convert it to Unicode hex charcode strings,
         *       like 'あいう' -> '0x30420x30440x3046'
         */
	toCharcodeStrings: function ( s ) {

		var str = '';

		for ( var i = 0; i < s.length; i++ ) {

			str += '0x' + ( '0000' + s[ i ].charCodeAt().toString( 16 ) ).substr( -4 );

		}

		return str;

	},

	getUnicodeStrings: function ( size ) {

		var str = '';

		while ( size > 0 ) {

			var value = this.getUint16();
			size -= 2;

			if ( value === 0 ) {

				break;

			}

			str += String.fromCharCode( value );

		}

		while ( size > 0 ) {

			this.getUint8();
			size--;

		}

		return str;

	},

	getTextBuffer: function () {

		var size = this.getUint32();
		return this.getUnicodeStrings( size );

	}

};

/*
 * Custom shaders based on MeshPhongMaterial.
 * This class extends ShaderMaterial while shader is based on MeshPhongMaterial.
 */
THREE.MMDMaterial = function ( params ) {

	THREE.ShaderMaterial.call( this, params );

//	this.type = 'MMDMaterial';

	// the followings are copied from MeshPhongMaterial
	this.color = new THREE.Color( 0xffffff ); // diffuse
	this.emissive = new THREE.Color( 0x000000 );
	this.specular = new THREE.Color( 0x111111 );
	this.shininess = 30;

	this.metal = false;

	this.map = null;

	this.lightMap = null;
	this.lightMapIntensity = 1.0;

	this.aoMap = null;
	this.aoMapIntensity = 1.0;

	this.emissiveMap = null;

	this.bumpMap = null;
	this.bumpScale = 1;

	this.normalMap = null;
	this.normalScale = new THREE.Vector2( 1, 1 );

	this.displacementMap = null;
	this.displacementScale = 1;
	this.displacementBias = 0;

	this.specularMap = null;

	this.alphaMap = null;

	this.envMap = null;
	this.combine = THREE.MultiplyOperation;
	this.reflectivity = 1;
	this.refractionRatio = 0.98;

	this.fog = true;

	this.shading = THREE.SmoothShading;

	this.wireframe = false;
	this.wireframeLinewidth = 1;
	this.wireframeLinecap = 'round';
	this.wireframeLinejoin = 'round';

	this.vertexColors = THREE.NoColors;

	this.skinning = false;
	this.morphTargets = false;
	this.morphNormals = false;

	this.setValues( params );

};

THREE.MMDMaterial.prototype = Object.create( THREE.ShaderMaterial.prototype );
THREE.MMDMaterial.prototype.constructor = THREE.MMDMaterial;

THREE.ShaderLib[ 'mmd' ] = {

	uniforms: THREE.UniformsUtils.merge( [

		THREE.UniformsLib[ "common" ],
		THREE.UniformsLib[ "aomap" ],
		THREE.UniformsLib[ "lightmap" ],
		THREE.UniformsLib[ "emissivemap" ],
		THREE.UniformsLib[ "bumpmap" ],
		THREE.UniformsLib[ "normalmap" ],
		THREE.UniformsLib[ "displacementmap" ],
		THREE.UniformsLib[ "fog" ],
		THREE.UniformsLib[ "lights" ],
		THREE.UniformsLib[ "shadowmap" ],

		{
			"emissive" : { type: "c", value: new THREE.Color( 0x000000 ) },
			"specular" : { type: "c", value: new THREE.Color( 0x111111 ) },
			"shininess": { type: "f", value: 30 }
		},

		// MMD specific
		{
			"outlineDrawing"  : { type: "i", value: 0 },
			"outlineThickness": { type: "f", value: 0.0 },
			"outlineColor"    : { type: "c", value: new THREE.Color( 0x000000 ) },
			"outlineAlpha"    : { type: "f", value: 1.0 },
			"celShading"      : { type: "i", value: 0 },
			"toonMap"         : { type: "t", value: null }
		}

	] ),

	vertexShader: [

		"#define PHONG",

		"varying vec3 vViewPosition;",

		"#ifndef FLAT_SHADED",

		"	varying vec3 vNormal;",

		"#endif",

		THREE.ShaderChunk[ "common" ],
		THREE.ShaderChunk[ "uv_pars_vertex" ],
		THREE.ShaderChunk[ "uv2_pars_vertex" ],
		THREE.ShaderChunk[ "displacementmap_pars_vertex" ],
		THREE.ShaderChunk[ "envmap_pars_vertex" ],
		THREE.ShaderChunk[ "lights_phong_pars_vertex" ],
		THREE.ShaderChunk[ "color_pars_vertex" ],
		THREE.ShaderChunk[ "morphtarget_pars_vertex" ],
		THREE.ShaderChunk[ "skinning_pars_vertex" ],
		THREE.ShaderChunk[ "shadowmap_pars_vertex" ],
		THREE.ShaderChunk[ "logdepthbuf_pars_vertex" ],

		// MMD specific
		"	uniform bool outlineDrawing;",
		"	uniform float outlineThickness;",

		"void main() {",

			THREE.ShaderChunk[ "uv_vertex" ],
			THREE.ShaderChunk[ "uv2_vertex" ],
			THREE.ShaderChunk[ "color_vertex" ],

			THREE.ShaderChunk[ "beginnormal_vertex" ],
			THREE.ShaderChunk[ "morphnormal_vertex" ],
			THREE.ShaderChunk[ "skinbase_vertex" ],
			THREE.ShaderChunk[ "skinnormal_vertex" ],
			THREE.ShaderChunk[ "defaultnormal_vertex" ],

		"#ifndef FLAT_SHADED", // Normal computed with derivatives when FLAT_SHADED

		"	vNormal = normalize( transformedNormal );",

		"#endif",

			THREE.ShaderChunk[ "begin_vertex" ],
			THREE.ShaderChunk[ "displacementmap_vertex" ],
			THREE.ShaderChunk[ "morphtarget_vertex" ],
			THREE.ShaderChunk[ "skinning_vertex" ],
			THREE.ShaderChunk[ "project_vertex" ],
			THREE.ShaderChunk[ "logdepthbuf_vertex" ],

		"	vViewPosition = - mvPosition.xyz;",

			THREE.ShaderChunk[ "worldpos_vertex" ],
			THREE.ShaderChunk[ "envmap_vertex" ],
			THREE.ShaderChunk[ "lights_phong_vertex" ],
			THREE.ShaderChunk[ "shadowmap_vertex" ],

		// MMD specific: outline drawing
		"	if ( outlineDrawing ) {",
		"		float thickness = outlineThickness;",
		"		float ratio = 1.0;", // TODO: support outline size ratio for each vertex
		"		vec4 epos = projectionMatrix * modelViewMatrix * skinned;",
		"		vec4 epos2 = projectionMatrix * modelViewMatrix * vec4( skinned.xyz + transformedNormal, 1.0 );",
		"		vec4 enorm = normalize( epos2 - epos );",
		"		gl_Position = epos + enorm * thickness * epos.w * ratio;",
		"	}",

		"}"

	].join( "\n" ),

	fragmentShader: [

		"#define PHONG",

		"uniform vec3 diffuse;",
		"uniform vec3 emissive;",
		"uniform vec3 specular;",
		"uniform float shininess;",
		"uniform float opacity;",

		THREE.ShaderChunk[ "common" ],
		THREE.ShaderChunk[ "color_pars_fragment" ],
		THREE.ShaderChunk[ "uv_pars_fragment" ],
		THREE.ShaderChunk[ "uv2_pars_fragment" ],
		THREE.ShaderChunk[ "map_pars_fragment" ],
		THREE.ShaderChunk[ "alphamap_pars_fragment" ],
		THREE.ShaderChunk[ "aomap_pars_fragment" ],
		THREE.ShaderChunk[ "lightmap_pars_fragment" ],
		THREE.ShaderChunk[ "emissivemap_pars_fragment" ],
		THREE.ShaderChunk[ "envmap_pars_fragment" ],
		THREE.ShaderChunk[ "fog_pars_fragment" ],
		THREE.ShaderChunk[ "lights_phong_pars_fragment" ],
		THREE.ShaderChunk[ "shadowmap_pars_fragment" ],
		THREE.ShaderChunk[ "bumpmap_pars_fragment" ],
		THREE.ShaderChunk[ "normalmap_pars_fragment" ],
		THREE.ShaderChunk[ "specularmap_pars_fragment" ],
		THREE.ShaderChunk[ "logdepthbuf_pars_fragment" ],

		// MMD specific
		"	uniform bool outlineDrawing;",
		"	uniform vec3 outlineColor;",
		"	uniform float outlineAlpha;",
		"	uniform bool celShading;",
		"	uniform sampler2D toonMap;",

		// MMD specific: toon shadering
		"	vec3 toon ( vec3 lightDirection, vec3 norm ) {",
		"		vec2 coord = vec2( 0.0, 0.5 * ( 1.0 - dot( lightDirection, norm ) ) );",
		"		return texture2D( toonMap, coord ).rgb;",
		"	}",

		"void main() {",

		// MMD specific: outline drawing
		"	if ( outlineDrawing ) {",
		"		gl_FragColor = vec4( outlineColor, outlineAlpha );",
		"		return;",
		"	}",

		"	vec3 outgoingLight = vec3( 0.0 );",
		"	vec4 diffuseColor = vec4( diffuse, opacity );",
		"	vec3 totalAmbientLight = ambientLightColor;",
		"	vec3 totalEmissiveLight = emissive;",
		"	vec3 shadowMask = vec3( 1.0 );",

			THREE.ShaderChunk[ "logdepthbuf_fragment" ],
			THREE.ShaderChunk[ "map_fragment" ],
			THREE.ShaderChunk[ "color_fragment" ],
			THREE.ShaderChunk[ "alphamap_fragment" ],
			THREE.ShaderChunk[ "alphatest_fragment" ],
			THREE.ShaderChunk[ "specularmap_fragment" ],
			THREE.ShaderChunk[ "normal_phong_fragment" ],
			THREE.ShaderChunk[ "lightmap_fragment" ],
			THREE.ShaderChunk[ "hemilight_fragment" ],
			THREE.ShaderChunk[ "aomap_fragment" ],
			THREE.ShaderChunk[ "emissivemap_fragment" ],

			//THREE.ShaderChunk[ "lights_phong_fragment" ],

		// MMD specific: toon shadering
		"	vec3 viewDir = normalize( vViewPosition );",
		"	vec3 totalDiffuseLight = vec3( 0.0 );",
		"	vec3 totalSpecularLight = vec3( 0.0 );",

		"#if MAX_POINT_LIGHTS > 0",
		"	for ( int i = 0; i < MAX_POINT_LIGHTS; i ++ ) {",
		"		vec3 lightColor = pointLightColor[ i ];",
		"		vec3 lightPosition = pointLightPosition[ i ];",
		"		vec3 lVector = lightPosition + vViewPosition.xyz;",
		"		vec3 lightDir = normalize( lVector );",
		"		// attenuation",
		"		float attenuation = calcLightAttenuation( length( lVector ), pointLightDistance[ i ], pointLightDecay[ i ] );",
		"		// diffuse",
		"		float cosineTerm = saturate( dot( normal, lightDir ) );",

		// MMD specific
		"		if ( celShading ) {",
		"			totalDiffuseLight += lightColor * toon( lightDir, normal );",
		"		} else {",
		"			totalDiffuseLight += lightColor * attenuation * cosineTerm;",
		"		}",

		"		// specular",
		"		vec3 brdf = BRDF_BlinnPhong( specular, shininess, normal, lightDir, viewDir );",
		"		totalSpecularLight += brdf * specularStrength * lightColor * attenuation * cosineTerm;",
		"	}",
		"#endif",

		"#if MAX_SPOT_LIGHTS > 0",
		"	for ( int i = 0; i < MAX_SPOT_LIGHTS; i ++ ) {",
		"		vec3 lightColor = spotLightColor[ i ];",
		"		vec3 lightPosition = spotLightPosition[ i ];",
		"		vec3 lVector = lightPosition + vViewPosition.xyz;",
		"		vec3 lightDir = normalize( lVector );",
		"		float spotEffect = dot( spotLightDirection[ i ], lightDir );",
		"		if ( spotEffect > spotLightAngleCos[ i ] ) {",
		"			spotEffect = saturate( pow( saturate( spotEffect ), spotLightExponent[ i ] ) );",
		"			// attenuation",
		"			float attenuation = calcLightAttenuation( length( lVector ), spotLightDistance[ i ], spotLightDecay[ i ] );",
		"			attenuation *= spotEffect;",
		"			// diffuse",
		"			float cosineTerm = saturate( dot( normal, lightDir ) );",

		// MMD specific
		"			if ( celShading ) {",
		"				totalDiffuseLight += lightColor * toon( lightDir, normal );",
		"			} else {",
		"				totalDiffuseLight += lightColor * attenuation * cosineTerm;",
		"			}",

		"			// specular",
		"			vec3 brdf = BRDF_BlinnPhong( specular, shininess, normal, lightDir, viewDir );",
		"			totalSpecularLight += brdf * specularStrength * lightColor * attenuation * cosineTerm;",
		"		}",
		"	}",
		"#endif",

		"#if MAX_DIR_LIGHTS > 0",
		"	for ( int i = 0; i < MAX_DIR_LIGHTS; i ++ ) {",
		"		vec3 lightColor = directionalLightColor[ i ];",
		"		vec3 lightDir = directionalLightDirection[ i ];",
		"		// diffuse",
		"		float cosineTerm = saturate( dot( normal, lightDir ) );",

		// MMD specific
		"		if ( celShading ) {",
		"			totalDiffuseLight += lightColor * toon( lightDir, normal );",
		"		} else {",
		"			totalDiffuseLight += lightColor * cosineTerm;",
		"		}",

		"		// specular",
		"		vec3 brdf = BRDF_BlinnPhong( specular, shininess, normal, lightDir, viewDir );",
		"		totalSpecularLight += brdf * specularStrength * lightColor * cosineTerm;",
		"	}",
		"#endif",

			THREE.ShaderChunk[ "shadowmap_fragment" ],

			"totalDiffuseLight *= shadowMask;",
			"totalSpecularLight *= shadowMask;",

			"#ifdef METAL",

			"	outgoingLight += diffuseColor.rgb * ( totalDiffuseLight + totalAmbientLight ) * specular + totalSpecularLight + totalEmissiveLight;",

			"#else",

			"	outgoingLight += diffuseColor.rgb * ( totalDiffuseLight + totalAmbientLight ) + totalSpecularLight + totalEmissiveLight;",

			"#endif",

			THREE.ShaderChunk[ "envmap_fragment" ],

			THREE.ShaderChunk[ "linear_to_gamma_fragment" ],

			THREE.ShaderChunk[ "fog_fragment" ],

		"	gl_FragColor = vec4( outgoingLight, diffuseColor.a );",

		"}"

	].join( "\n" )

};

THREE.MMDHelper = function ( mesh, renderer, params ) {

	this.mesh = mesh;
	this.renderer = renderer;

	this.mixer = null;
	this.ikSolver = null;
	this.physics = null;

	this.runAnimation = true;
	this.runIk = true;
	this.runPhysics = true;
	this.drawOutline = true;

	this.init( params );

};

THREE.MMDHelper.prototype = {

	constructor: THREE.MMDHelper,

	init: function ( params ) {

		params = ( params !== undefined && params !== null ) ? params : {};
		this.initRender();
		this.initAnimation( params );

	},

	initRender: function () {

		this.renderer.autoClear = false;
		this.renderer.autoClearColor = false;
		this.renderer.autoClearDepth = false;

	},

	initAnimation: function ( params ) {

		if ( params.noAnimation === true ) {

			this.runAnimation = false;

		} else {

			if ( this.mesh.geometry.animations !== undefined ||
			     this.mesh.geometry.morphAnimations !== undefined ) {

				this.mixer = new THREE.AnimationMixer( this.mesh );

			}

			if ( this.mesh.geometry.animations !== undefined ) {

				this.mixer.addAction( new THREE.AnimationAction( this.mesh.geometry.animations[ 0 ] ) );

			}

			if ( this.mesh.geometry.morphAnimations !== undefined ) {

				this.mixer.addAction( new THREE.AnimationAction( this.mesh.geometry.morphAnimations[ 0 ] ) ) ;

			}

		}

		if ( params.noIk === true ) {

			this.runIk = false;

		} else {

			if ( this.mesh.geometry.animations !== undefined ) {

				this.ikSolver = new THREE.CCDIKSolver( this.mesh );

			}

		}

		if ( params.noPhysics === true ) {

			this.runPhysics = false;

		} else {

			this.physics = new THREE.MMDPhysics( this.mesh );
			this.physics.warmup( 10 );

		}

	},

	animate: function ( delta ) {

		if ( this.mixer !== null && this.runAnimation === true ) {

			this.mixer.update( delta );

		}

		if ( this.ikSolver !== null && this.runIk === true ) {

			this.ikSolver.update();

		}

		if ( this.physics !== null && this.runPhysics === true ) {

			this.physics.update( delta );

		}

	},

	render: function ( scene, camera ) {

		this.renderer.clearColor();
		this.renderer.clearDepth();
		this.renderer.clear( true, true );

		this.renderMain( scene, camera );

		if ( this.drawOutline ) {

			this.renderOutline( scene, camera );

		}

	},

	renderMain: function ( scene, camera ) {

		for ( var i = 0; i < this.mesh.material.materials.length; i++ ) {

			var m = this.mesh.material.materials[ i ];
			m.uniforms.outlineDrawing.value = 0;

			if ( m.opacity === 1.0 ) {

				renderer.setFaceCulling( THREE.CullFaceBack, THREE.FrontFaceDirectionCCW );

			} else {

				renderer.setFaceCulling( THREE.CullFaceNone, THREE.FrontFaceDirectionCCW );

			}

		}

		this.renderer.render( scene, camera );

	},

	renderOutline: function ( scene, camera ) {

		for ( var i = 0; i < mesh.material.materials.length; i++ ) {

			var m = mesh.material.materials[ i ];
			m.uniforms.outlineDrawing.value = 1;
			renderer.setFaceCulling( THREE.CullFaceFront, THREE.FrontFaceDirectionCCW );

		}

		this.renderer.render( scene, camera );

	}

};

