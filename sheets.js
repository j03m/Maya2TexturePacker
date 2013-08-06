var fs = require('fs');
//var async = require('async');
var exec = require('child_process').exec;
var renderCmd = '/Applications/Autodesk/maya2013/Maya.app/Contents/bin/Render -sw:mb on ';
var imagePath = '/Users/jmordetsky/Documents/maya/projects/Monsters/images/';
var scenePath = '/Users/jmordetsky/Documents/maya/projects/Monsters/scenes/';
var sheetPost = 'Sheet.png';
var plistPost = 'Sheet.plist';
var configDir = 'spriteConfigs/';
var release = true;
var doRender = true;

var onlyDo = [
    'monsterbase.js',
    'orge.js'
    ,
    'orc.js'
    ,
    'troll.js',
    'wizard.js',
    'snakeThing.js',
    'goblin.js'
];

//get list of config files
//loop,

var configs;
if (!onlyDo){
    configs = fs.readdirSync(configDir);
}else{
    configs = onlyDo;
}

var configObj = {};
console.log("Read Dir: " + JSON.stringify(configs));


//todo: last render timestamp
//todo: last sheet timestamp

var configData = {};
for(var i =0; i<configs.length; i++){
    var config = configs[i];
    if (config.indexOf('.js')!=-1){
        console.log("reading: " + config);
        var character = fs.readFileSync(configDir+config);
        console.log("contents: " + character.toString());
        var charObj = JSON.parse(character);
        configObj[config] = charObj;
    }
}

var count = -1;
function go(){
	count++;
	if (count<configs.length)
    {
            var character = configObj[configs[count]];
            if (character){
                if (character.inherit)
                {
                    var parent = configObj[character.inherit];
                    for (var prop in parent) //apply but no override if exists
                    {
                        if (!character[prop])
                        {
                            character[prop] = parent[prop];
                        }
                    }

                }

                if (!character.scenes && character.name){
                    character.scenes = [];
                    character.scenes.push(character.name + ".mb");
                }

                if (character.scenes){
                    if (doRender){
                        render(character, function(err, stdout, stderr){
                            makeSheet(character, go);
                        });
                    }else{
                        makeSheet(character, go);
                    }
                }else{
                    go(); //inheritance only, no name.
                }
            }else{
                go();
            }
    }
};

go();

function render(character, callback){
	var renderCount = -1;
    var imageDir = imagePath + character.name + '/';
    execWrapper('rm -rf ' + imageDir + '/*', renderMe);
    function renderMe(err, stdout, stderr){
		stdOutStuff('render', err, stdout, stderr);

		renderCount++;
		if (renderCount<character.scenes.length){
            var scene = scenePath + character.scenes[renderCount];
            execWrapper(renderCmd + '-rd ' + imageDir + ' ' + scene, renderMe);

        }else{
			callback();
		}

	}
}

function stdOutStuff(prefix, err, stdout, stderr){
	console.log(prefix + ' err:' + err);
	console.log(prefix + ' stdout:' + stdout);
	console.log(prefix + ' stderr:' + stderr);
}


function stdOutStuffWithCall(prefix, err, stdout, stderr, callback){
    console.log(prefix + ' err:' + err);
    console.log(prefix + ' stdout:' + stdout);
    console.log(prefix + ' stderr:' + stderr);
    callback(err, stdout, stderr);
}

function makeSheet(character, callback){
	var imageDir = imagePath + character.name + '/';
	var imageToDir = imageDir + 'sheet/';
	var imageSheetDir = imageDir + 'final/';
	var imageNamePrefix = imageDir + character.name + '.';
	var imageNameToPrefix = imageToDir + character.name + '.';
	var imagePost = '.png';
	var images = [];

	var pngFile = imageSheetDir + character.name + sheetPost;
	var plistFile = imageSheetDir + character.name + plistPost;


	console.log("imagePath:" + imagePath);
	console.log("imageDir:" + imageDir);
	console.log("imageToDir:" +imageToDir);
	console.log("pngFile:" + pngFile);
	console.log("plistFile:" + plistFile);


    if (character.shouldFix){
        fix(character, complete)
    }else{
        complete();
    }

    function complete(){
        //get a list of images need for animations (we don't need all of them)
        //mv them to a holding area
        console.log("mv files - ");
        execWrapper('mkdir ' + imageToDir, function(err, stdout, stderr){
            stdOutStuff('mkdir', err, stdout, stderr);
            execWrapper('mkdir ' + imageSheetDir, function(err, stdout, stderr){
                stdOutStuff('mkdir2', err, stdout, stderr);
                for (var animation in character.animations){
                    var props = character.animations[animation];
                    for (var i = props.start; i<= props.end; i++){
                        var image = imageNamePrefix + i + imagePost;
                        images.push(image);
                    }
                }

                execWrapper('mv ' + images.join(' ') + ' ' + imageToDir, function(err, stdout, stderr){
                    stdOutStuff('mv', err, stdout, stderr);
                    var texturePackerCommand = 'TexturePacker --data ' + plistFile + ' --format cocos2d --sheet ' + pngFile + ' --max-size ' + character.sheetSize + ' ' + imageToDir + '*.png';
                    execWrapper(texturePackerCommand, function(err, stdout, stderr){
                        stdOutStuff('tp', err, stdout, stderr);
                        execWrapper('mv ' + pngFile + ' ' + plistFile + ' ' + imageSheetDir, function(){
                            stdOutStuff('final mv', err, stdout, stderr);
                            callback();
                        });


                    });

                });

            });

        });
    }

}

function fix(character, callback){
	var fs = require('fs');
	var dir = '/Users/jmordetsky/Documents/maya/projects/Monsters/images/' + character.name+ '/';
	var prefix = character.name
	var charImages = fs.readdirSync(dir);
    charImages = charImages.sort(stringNumberSort);

	var count = -1;
	var countPlus1 =0;
	function goFix(){
		count++;
		countPlus1 = count+1;
		if (count<charImages.length){
            if (charImages[count].indexOf('.png')!=-1){
                execWrapper('mv ' + dir+charImages[count] + ' ' + dir + prefix + '.' + countPlus1 + '.png',
                    function(){
                        execWrapper('rm ' +  dir+charImages[count], goFix);
                    });
            }else{
                goFix();
            }
		}else{
            callback();
        }
	};

	goFix();

}

function execWrapper(cmd, callback){
	if (release){
        console.log(cmd);
        exec(cmd,callback);
	}else{
        console.log(cmd);
		callback();
	}
	
}

function stringNumberSort( a, b ) {

    // Normalize the file names with fixed-
    // width numeric data.
    var aMixed = normalizeMixedDataValue( a );
    var bMixed = normalizeMixedDataValue( b );

    return( aMixed < bMixed ? -1 : 1 );

}

function normalizeMixedDataValue( value ) {

    var padding = "000000000000000";

    // Loop over all numeric values in the string and
    // replace them with a value of a fixed-width for
    // both leading (integer) and trailing (decimal)
    // padded zeroes.
    value = value.replace(
        /(\d+)((\.\d+)+)?/g,
        function( $0, integer, decimal, $3 ) {

            // If this numeric value has "multiple"
            // decimal portions, then the complexity
            // is too high for this simple approach -
            // just return the padded integer.
            if ( decimal !== $3 ) {

                return(
                    padding.slice( integer.length ) +
                        integer +
                        decimal
                    );

            }

            decimal = ( decimal || ".0" );

            return(
                padding.slice( integer.length ) +
                    integer +
                    decimal +
                    padding.slice( decimal.length )
                );

        }
    );

    console.log( value );

    return( value );

}