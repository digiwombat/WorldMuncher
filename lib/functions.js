window.$ = window.jQuery = require('jquery');
const main = require('electron').remote;
const {dialog} = require('electron').remote;
const {process} = require('electron').remote;
const fs = require('fs-extra');
const url = require('url')
const trumbo = require('trumbowyg');
const complete = require('jquery-textcomplete');
const _ = require('lodash');
const smartcrop = require('smartcrop');
const JSZip = require('jszip');


var worlddb;
var fullList = [];
var personList = [];
var placeList = [];
var thingList = [];
var worldDBLocation = "";
var selectedIDType = "person";
var selectedID = 1;
var zip = new JSZip();

var onKeydownFunc = function (e, commands) {
	// `commands` has `KEY_UP`, `KEY_DOWN`, `KEY_ENTER`, `KEY_PAGEUP`, `KEY_PAGEDOWN`,
	// `KEY_ESCAPE` and `SKIP_DEFAULT`.
	if (e.keyCode === 13)
	{
		return;
	}
};


function init()
{
	document.getElementById("min-button").addEventListener("click", function (e) {
		const window = main.getCurrentWindow();
		window.minimize();
	});

	$("[contenteditable=true]").on("paste", function(e) {
		e.preventDefault();
		clipboardData = e.originalEvent.clipboardData || window.clipboardData;
		var text = clipboardData.getData('text/plain');
		document.execCommand("insertText", false, text);
	});
	console.log(process.argv);

	const window = main.getCurrentWindow();
	window.on('unmaximize', function(){
		document.getElementById("max-button").classList.remove('fa-window-restore');
		document.getElementById("max-button").classList.add('fa-window-maximize');
	});
	window.on('maximize', function(){
		document.getElementById("max-button").classList.remove('fa-window-maximize');
		document.getElementById("max-button").classList.add('fa-window-restore');
	});

	document.getElementById("max-button").addEventListener("click", function (e) {

		if (!window.isMaximized()) {
			window.maximize();
		} else {

			window.unmaximize();
		}
	});

	$('.exit-button').on('click',function(){
		const window = main.getCurrentWindow();
		window.close();
	});
	
	$('.new-world').on('click',function(){
		newWorld();
	});
	
	$('.load-world').on('click',function(){
		newWorld(false);
	});
	
	document.getElementById("people").addEventListener("click", function (e) {
		loadPersonList();
	});
	
	document.getElementById("places").addEventListener("click", function (e) {
		loadPlaceList();
	});
	
	document.getElementById("things").addEventListener("click", function (e) {
		loadThingList();
	});

	var anchors = document.querySelectorAll(".editable-nobar");
	for (var i = 0; i < anchors.length; i++) {
		var current = anchors[i];
		current.addEventListener('keypress', function(e){ return e.which != 13; }, false);
	}
	
	$('.editable').trumbowyg({
		svgPath: 'node_modules/trumbowyg/dist/ui/icons.svg',
		btns: [
			['viewHTML'],
			['formatting'],
			'btnGrp-semantic',
			['superscript', 'subscript'],
			['insertImage'],
			'btnGrp-justify',
			'btnGrp-lists',
			['horizontalRule'],
			['removeformat']
		],
		autogrow: true
	});

	$('#main-area').on("click", "a", function(e) {
		e.preventDefault();     
		var pid = $(this).text();
		var hash = this.hash;
		if(hash.includes('/'))
		{
			hash = hash.slice(1).split('/');
			switch(hash[0])
			{
				case "person":
					selectedID = hash[1];
					selectedIDType = "person";
					loadPersonList();
					loadPerson();
					$('.list-active').removeClass('list-active');
					$('#person-' + hash[1]).addClass('list-active');
					break;
				case "place":
					selectedID = hash[1];
					selectedIDType = "place";
					loadPlaceList();
					loadPlace();
					$('.list-active').removeClass('list-active');
					$('#place-' + hash[1]).addClass('list-active');
					break;
			}
		}
		else{console.error('No slash');}
			
	});

	$("#pim").on('click', function(e) {
		var newImage = dialog.showOpenDialog(main.getCurrentWindow(), {
			filters: [
				{name: 'Image Files', extensions: ['jpg', 'jpeg', 'png', 'gif']},
				{ name: 'All Files', extensions: ['*'] }
			],
			properties: ['openFile']
		});
		if(newImage == undefined)
		{
			return;
		}
		img = new Image();
		img.onload = function() {
			characterCrop();
		};
		img.src = newImage[0];
	});
}

document.onreadystatechange = function ()
{
	if (document.readyState == "complete")
	{
		init();         
	}
};

function newWorld(newWorld = true)
{
	if(newWorld == true)
	{	
		worldDBLocation = dialog.showSaveDialog(main.getCurrentWindow(), {
			filters: [
				{ name: 'WorldMuncher Files (*.wmnch)', extensions: ['wmnch'] },
				{ name: 'All Files', extensions: ['*'] }
			]});
	}
	else
	{
		worldDBLocation = dialog.showOpenDialog(main.getCurrentWindow(), {
			filters: [
				{ name: 'WorldMuncher Files (*.wmnch)', extensions: ['wmnch'] },
				{ name: 'All Files', extensions: ['*'] }
			],
			properties: ['openFile']
		});	
	}
	
	if(worldDBLocation == undefined)
	{
		return;	
	}
	
	if(Array.isArray(worldDBLocation))
	{
		worldDBLocation = worldDBLocation[0];
	}
	$("#current-file").html(' | ' + worldDBLocation.replace(/^.*[\\\/]/, ''));

	if(newWorld == true)
	{
		zip.file('userDB.json', fs.readFileSync('dbproto.json'));	zip.generateNodeStream({type:'nodebuffer',compression:"DEFLATE",streamFiles:true}).pipe(fs.createWriteStream(worldDBLocation));
	}
	loadWorld();

	document.location.hash = 'close';
	document.location.hash = 'people';
}

function loadWorld()
{
	fs.readFile(worldDBLocation, function(err, data) {
		if (err) throw err;
		JSZip.loadAsync(data).then(function (zip) {
			return zip.file('userDB.json').async("text");
		}).then(function (txt) {
			worlddb = JSON.parse(txt);
			selectedID = 1;
			selectedIDType = "person";
			loadPersonList();
			makeLists();
		});
	});

}

function loadPersonList()
{
	var peopleList = document.getElementById('list-holder');
	$(peopleList).empty();
	_.orderBy(worlddb['people'], 'id', 'asc').forEach(function(row) {
		var li = document.createElement('li');
		li.setAttribute('id', 'person-' + row.person_id);
		li.classList.add('person');
		var pic = '';
		if(row.person_picture != "" && row.person_picture != undefined)
			pic = `style="background-image: url('` + row.person_picture + `'); background-size: cover;"`;
		li.innerHTML = `<div class="person-image"` + pic + `><div></div></div>
			<h3>` + row.person_name + `</h3>
			<p>
				<span><strong>Age: </strong>` + row.person_age + `</span>
				<span><strong>Gender: </strong>` + row.person_gender + `</span>
			</p>`;
		peopleList.appendChild(li);
	});
	
	var anchors = document.querySelectorAll("li.person");
	for (var i = 0; i < anchors.length; i++) {
		var current = anchors[i];
		current.addEventListener('click', function() {
			var personID = this.getAttribute('id').replace('person-', '');
			selectedIDType = "person";
			selectedID = personID;
			loadPerson();
			$('.list-active').removeClass('list-active');
			$(this).addClass('list-active');
		}, false);
	}
	
	$('#add-item').off('click');
	$('#add-item').on('click', function(evt){
		evt.stopImmediatePropagation();
		addPerson();
	});
	
	$('#remove-item').off('click');
	$('#remove-item').on('click', function(evt){
		evt.stopImmediatePropagation();
		removePerson();
	});

	if(selectedIDType == "person")
	{
		$('#person-' + selectedID).addClass('list-active');
		loadPerson();
	}
	
	makeLists();

	$('#list-type').html('People');
	$('#people').addClass('active');
	$('#places').removeClass('active');
	$('#things').removeClass('active');
	
}

function loadPlaceList()
{
	var placeList = document.getElementById('list-holder');
	$(placeList).empty();
	_.orderBy(worlddb['places'], 'id', 'asc').filter(function (el) {
		return el.place_parent == '';
	}).forEach(function(row) {
		var li = document.createElement('li');
		li.setAttribute('id', 'place-' + row.place_id);
		li.classList.add('place');
		li.innerHTML = `<div class="place-image"><div></div></div>
			<h3>` + row.place_name + `</h3>`;
		placeList.appendChild(li);
	});

	var placeLI = placeList.getElementsByTagName("li");
	for (var i = 0; i < placeLI.length; i++)
	{
		worlddb['places'].filter(function (el) {
			var placeID = placeLI[i].getAttribute('id').replace('place-', '');
			return el.place_parent == placeID;
		}).forEach(function(row) {
			var li = document.createElement('li');
			li.setAttribute('id', 'place-' + row.place_id);
			li.classList.add('place');
			li.innerHTML = `<div class="place-image"><div></div></div>
				<h3>` + row.place_name + `</h3>`;
			li.classList.add('place-child');
			if($('#place-' + row.place_parent).hasClass('place-child'))
				li.classList.add('place-second-child');
			if($('#place-' + row.place_parent).hasClass('place-second-child'))
				li.classList.add('place-third-child');
			$('#place-' + row.place_parent).after(li);
		});
	}

	var anchors = document.querySelectorAll("li.place");
	for (var i = 0; i < anchors.length; i++) {
		var current = anchors[i];
		current.addEventListener('click', function() {
			var placeID = this.getAttribute('id').replace('place-', '');
			selectedIDType = 'place'
			selectedID = placeID;
			loadPlace();
			$('.list-active').removeClass('list-active');
			$(this).addClass('list-active');
		}, false);
	}
	
	$('#add-item').off('click');
	$('#add-item').on('click', function(evt){
		evt.stopImmediatePropagation();
		addPlace();
	});

	$('#remove-item').off('click');
	$('#remove-item').on('click', function(evt){
		evt.stopImmediatePropagation();
		removePlace();
	});

	makeLists();

	$('#list-type').html('Places');
	$('#people').removeClass('active');
	$('#places').addClass('active');
	$('#things').removeClass('active');

}

function loadThingList()
{
	var thingList = document.getElementById('list-holder');
	$(thingList).empty();
	_.orderBy(worlddb['things'], 'id', 'asc').forEach(function(row) {
		var li = document.createElement('li');
		li.setAttribute('id', 'thing-' + row.thing_id);
		li.classList.add('thing');
		var pic = '';
		li.innerHTML = `<div class="thing-image"><div></div></div>
			<h3>` + row.thing_name + `</h3>`;
		thingList.appendChild(li);
	});

	var anchors = document.querySelectorAll("li.thing");
	for (var i = 0; i < anchors.length; i++) {
		var current = anchors[i];
		current.addEventListener('click', function() {
			var thingID = this.getAttribute('id').replace('thing-', '');
			selectedIDType = "thing";
			selectedID = thingID;
			loadThing();
			$('.list-active').removeClass('list-active');
			$(this).addClass('list-active');
		}, false);
	}

	$('#add-item').off('click');
	$('#add-item').on('click', function(evt){
		evt.stopImmediatePropagation();
		addThing();
	});

	$('#remove-item').off('click');
	$('#remove-item').on('click', function(evt){
		evt.stopImmediatePropagation();
		removeThing();
	});

	if(selectedIDType == "thing")
	{
		$('#thing-' + selectedID).addClass('list-active');
		loadThing();
	}

	makeLists();

	$('#list-type').html('Things');
	$('#people').removeClass('active');
	$('#places').removeClass('active');
	$('#things').addClass('active');

}

function loadPerson()
{
	var person = worlddb['people'].filter(function (el) {
		return el.person_id == selectedID;
	})[0];

	for (var key in person) {
		if (person.hasOwnProperty(key) && key != 'person_picture' && document.getElementById(key) !== null)
			document.getElementById(key).innerHTML = person[key];
		if(key == 'person_picture')
			document.getElementById(key).src = person[key];
	}

	document.querySelector('#place-container').style.display = "none";
	document.querySelector('#thing-container').style.display = "none";
	document.querySelector('#person-container').style.display = "block";
	
	$('[contenteditable=true].person-field').off('focusout');
	$('[contenteditable=true].person-field').on('focusout', function(e) {
		if(person[$(this).attr('id')] != $(this).html())
		{
			person[$(this).attr('id')] = $(this).html();
			saveZip();
			if(selectedIDType == 'person')
				loadPersonList();
		}
	});
	
	$('.editable').textcomplete([{
		match: /(^|\b)(\w{2,})$/,
		search: function (term, callback) {
			callback($.map(fullList, function (word) {
				return word.listValue.indexOf(term) === 0 ? word : null;
			}));
		},
		template: function (value) {
            return value.listValue;
        },
		replace: function (word) {
			return '<a href="#' + word.listType + '/' + word.listID + '" class="' + word.listType + '-link">' + word.listValue + '</a> ';
		},
		onKeydown: onKeydownFunc
	}]);
	
	$('.ac-place').textcomplete([{
		match: /(^|\b)(\w{2,})$/,
		search: function (term, callback) {
			callback($.map(placeList, function (word) {
				return word.listValue.indexOf(term) === 0 ? word : null;
			}));
		},
		template: function (value) {
            return value.listValue;
        },
		replace: function (word) {
			return '<a href="#' + word.listType + '/' + word.listID + '" class="' + word.listType + '-link">' + word.listValue + '</a> ';
		},
		onKeydown: onKeydownFunc
	}]);
}

function loadPlace()
{
	var place = worlddb['places'].filter(function (el) {
		return el.place_id == selectedID;
	})[0];

	for (var key in place) {
		if (place.hasOwnProperty(key) && key != 'place_parent' && document.getElementById(key) !== null) {
			document.getElementById(key).innerHTML = place[key];
		}
	}
	
	$('#place_parent').empty();
	var optn = document.createElement("OPTION");
	optn.text = 'None';
	optn.value = '';
	document.getElementById('place_parent').options.add(optn)
	placeList.forEach(function(pl){
		var children = worlddb['places'].filter(function(row){ return row.place_parent == place['place_id']}).map(function(row) { return row['place_id'] });
		if(pl['listID'] != place['place_id'] && children.indexOf(pl['listID']) == -1)
		{
			optn = document.createElement("OPTION");
			optn.text = pl['listValue'];
			optn.value = pl['listID'];
			document.getElementById('place_parent').options.add(optn)
		}

	});


	document.getElementById('place_parent').value = place['place_parent'];

	document.querySelector('#place-container').style.display = "block";
	document.querySelector('#thing-container').style.display = "none";
	document.querySelector('#person-container').style.display = "none";
	
	$('[contenteditable=true].place-field').off('focusout');
	$('[contenteditable=true].place-field').on('focusout', function(e) {
		if(place[$(this).attr('id')] != $(this).html())
		{
			place[$(this).attr('id')] = $(this).html();
			saveZip();
			if(selectedIDType == 'place')
				loadPlaceList();
			$('#place_parent').empty();
			var optn = document.createElement("OPTION");
			optn.text = 'None';
			optn.value = '';
			document.getElementById('place_parent').options.add(optn)
			placeList.forEach(function(pl){
				var children = worlddb['places'].filter(function(row){ return row.place_parent == place['place_id']}).map(function(row) { return row['place_id'] });
				if(pl['listID'] != place['place_id'] && children.indexOf(pl['listID']) == -1)
				{
					optn = document.createElement("OPTION");
					optn.text = pl['listValue'];
					optn.value = pl['listID'];
					document.getElementById('place_parent').options.add(optn)
				}

			});
		}
	});

	$('#place_parent').off('change');
	$('#place_parent').on('change', function(e){
		if(place['place_parent'] != $(this).val())
		{
			place['place_parent'] = $(this).val();
			saveZip();
			if(selectedIDType == 'place')
				loadPlaceList();
		}
	});

	$('.editable').textcomplete([{
		match: /(^|\b)(\w{2,})$/,
		search: function (term, callback) {
			callback($.map(fullList, function (word) {
				return word.listValue.indexOf(term) === 0 ? word : null;
			}));
		},
		template: function (value) {
			return value.listValue;
		},
		replace: function (word) {
			return '<a href="#' + word.listType + '/' + word.listID + '" class="' + word.listType + '-link">' + word.listValue + '</a> ';
		},
		onKeydown: onKeydownFunc
	}]);

	$('.ac-place').textcomplete([{
		match: /(^|\b)(\w{2,})$/,
		search: function (term, callback) {
			callback($.map(placeList, function (word) {
				return word.listValue.indexOf(term) === 0 ? word : null;
			}));
		},
		template: function (value) {
			return value.listValue;
		},
		replace: function (word) {
			return '<a href="#' + word.listType + '/' + word.listID + '" class="' + word.listType + '-link">' + word.listValue + '</a> ';
		},
		onKeydown: onKeydownFunc
	}]);
}

function loadThing()
{
	var thing = worlddb['things'].filter(function (el) {
		return el.thing_id == selectedID;
	})[0];

	for (var key in thing) {
		if (thing.hasOwnProperty(key) && document.getElementById(key) !== null) {
			document.getElementById(key).innerHTML = thing[key];
		}
	}

	document.querySelector('#place-container').style.display = "none";
	document.querySelector('#thing-container').style.display = "block";
	document.querySelector('#person-container').style.display = "none";

	$('[contenteditable=true].thing-field').off('focusout');
	$('[contenteditable=true].thing-field').on('focusout', function(e) {
		if(thing[$(this).attr('id')] != $(this).html())
		{
			thing[$(this).attr('id')] = $(this).html();
			saveZip();
			if(selectedIDType == 'thing')
				loadThingList();
		}
	});

	$('.editable').textcomplete([{
		match: /(^|\b)(\w{2,})$/,
		search: function (term, callback) {
			callback($.map(fullList, function (word) {
				return word.listValue.indexOf(term) === 0 ? word : null;
			}));
		},
		template: function (value) {
			return value.listValue;
		},
		replace: function (word) {
			return '<a href="#' + word.listType + '/' + word.listID + '" class="' + word.listType + '-link">' + word.listValue + '</a> ';
		},
		onKeydown: onKeydownFunc
	}]);

	$('.ac-place').textcomplete([{
		match: /(^|\b)(\w{2,})$/,
		search: function (term, callback) {
			callback($.map(placeList, function (word) {
				return word.listValue.indexOf(term) === 0 ? word : null;
			}));
		},
		template: function (value) {
			return value.listValue;
		},
		replace: function (word) {
			return '<a href="#' + word.listType + '/' + word.listID + '" class="' + word.listType + '-link">' + word.listValue + '</a> ';
		},
		onKeydown: onKeydownFunc
	}]);
}

function addPerson()
{
	var newPersonID = Math.max.apply(Math,worlddb['people'].map(function(o){return o.person_id;})) + 1;
	if (newPersonID === Number.NEGATIVE_INFINITY)
		newPersonID = 1;
	var newPerson = {
		"person_id": newPersonID,
		"person_name": "New Person",
		"person_age": "Unknown",
		"person_gender": "Unknown",
		"person_height": "",
		"person_weight": "",
		"person_hair_color": "",
		"person_eye_color": "",
		"person_from_place": "",
		"person_current_place": "",
		"person_information": "",
		"person_personality": "",
		"person_background": "",
		"person_status": "",
		"person_first_appearance": "",
		"person_last_appearance": "",
		"person_picture": ""
	};
	worlddb['people'].push(newPerson);
	saveZip();
	loadPersonList();
}

function addPlace()
{
	var newPlaceID = Math.max.apply(Math,worlddb['places'].map(function(o){return o.place_id;})) + 1;
	if (newPlaceID === Number.NEGATIVE_INFINITY)
		newPlaceID = 1;
	var newPlace = {
		"place_id": newPlaceID,
		"place_name": "New Place",
		"place_description": "",
		"place_map": "",
		"place_parent": "",
		"place_ruler": ""
	};
	worlddb['places'].push(newPlace);
	saveZip();
	loadPlaceList();
}

function addThing()
{
	var newThingID = Math.max.apply(Math,worlddb['things'].map(function(o){return o.thing_id;})) + 1;
	if (newThingID === Number.NEGATIVE_INFINITY)
		newThingID = 1;
	var newThing = {
		"thing_id": newThingID,
		"thing_name": "New Thing",
		"thing_description": ""
	};
	worlddb['things'].push(newThing);
	saveZip();
	loadThingList();
}

function removePerson()
{
	var choice = dialog.showMessageBox(
		main.getCurrentWindow(),
		{
			type: 'warning',
			buttons: ['No', 'Yes'],
			title: 'Remove Person',
			message: 'Remove the currently selected person?'
		});
	if(choice && selectedIDType == 'person')
	{
		_.remove(worlddb['people'], function(n) {
			return n['person_id'] == selectedID;
		});
		saveZip();
		selectedID = Math.max.apply(Math,worlddb['people'].map(function(o){return o.thing_id;}));
		loadPersonList();
		loadPerson();
		if(worlddb['people'].length == 0)
		{
			document.querySelector('#person-container').style.display = "none";
		}
	}
	else
		return;

}

function removePlace()
{
	var choice = dialog.showMessageBox(
		main.getCurrentWindow(),
		{
			type: 'warning',
			buttons: ['No', 'Yes'],
			title: 'Remove Place',
			message: 'Remove the currently selected place?'
		});
	if(choice && selectedIDType == 'place')
	{
		_.remove(worlddb['places'], function(el) {
			return el.place_id == selectedID;
		});
		worlddb['places'].filter(function (el) {
			return el.place_parent == selectedID;
		}).forEach(function(row){
			row.place_parent = '';
		});

		selectedID = Math.max.apply(Math,worlddb['places'].map(function(o){return o.thing_id;}));
		loadPlaceList();
		loadPlace();
		if(worlddb['places'].length == 0)
		{
			document.querySelector('#place-container').style.display = "none";
		}
	}
	else
		return;

}

function removeThing()
{
	var choice = dialog.showMessageBox(
		main.getCurrentWindow(),
		{
			type: 'warning',
			buttons: ['No', 'Yes'],
			title: 'Remove Thing',
			message: 'Remove the currently selected thing?'
		});
	if(choice && selectedIDType == 'thing')
	{
		_.remove(worlddb['things'], function(n) {
			return n['thing_id'] == selectedID;
		});
		saveZip();
		selectedID = Math.max.apply(Math,worlddb['things'].map(function(o){return o.thing_id;}));
		loadThingList();
		loadThing();
		if(worlddb['things'].length == 0)
		{
			document.querySelector('#thing-container').style.display = "none";
		}
	}
	else
		return;

}

function makeLists()
{
	personList = [];
	placeList = [];
	thingList = [];
	worlddb['people'].forEach(function(json){
		personList.push({listType: 'person', listID: json['person_id'], listValue: json['person_name']});
	});
	worlddb['places'].forEach(function(json){
		placeList.push({listType: 'place', listID: json['place_id'], listValue: json['place_name']});
	});
	worlddb['things'].forEach(function(json){
		thingList.push({listType: 'thing', listID: json['thing_id'], listValue: json['thing_name']});
	});
	fullList = personList.concat(placeList, thingList);
}

function characterCrop()
{
	if (!img) return;
	var options = {
		width: 175,
		height: 180,
		minScale: 1.0,
		ruleOfThirds: true
	};

	smartcrop.crop(img, options).then(function(result){
		var canvas = document.createElement('canvas');
		canvas.width = result['topCrop']['width'];
		canvas.height = result['topCrop']['height'];
		ctx = canvas.getContext('2d');
		ctx.imageSmoothingEnabled = false;
		ctx.drawImage(img,
					  result['topCrop']['x'], result['topCrop']['y'],   // Start at 70/20 pixels from the left and the top of the image (crop),
					  result['topCrop']['width'], result['topCrop']['height'],
					  0,0,
					  result['topCrop']['width'], result['topCrop']['height']
					 ); // With as width / height: 100 * 100 (scale)
		var HERMITE = new Hermite_class();
		HERMITE.resample_single(canvas, 175, 180, true, function(){return;});

		document.getElementById("person_picture").src = canvas.toDataURL();
		worlddb['people'].filter(function (el) {
			return el.person_id == selectedID;
		})[0]['person_picture'] = canvas.toDataURL();
		saveZip();
		loadPersonList();
	});

}

function saveZip()
{
	zip.file('userDB.json', JSON.stringify(worlddb));	zip.generateNodeStream({type:'nodebuffer',compression:"DEFLATE",streamFiles:true}).pipe(fs.createWriteStream(worldDBLocation));
}
