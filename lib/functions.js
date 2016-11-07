window.$ = window.jQuery = require('jquery');
const main = require('electron').remote;
const {dialog} = require('electron').remote;
const {process} = require('electron').remote;
const fs = require('fs-extra');
const url = require('url')
const trumbo = require('trumbowyg');
const complete = require('jquery-textcomplete');
const zipvfs = require('zip-vfs');
const _ = require('lodash');

var worlddb;
var fullList = [];
var personList = [];
var placeList = [];
var thingList = [];
var worldDBLocation = "temp";
var needSave = true;
var selectedSection = "people";
var selectedIDType = "person";
var selectedID = 1;
var vfs;

var onKeydownFunc = function (e, commands) {
	// `commands` has `KEY_UP`, `KEY_DOWN`, `KEY_ENTER`, `KEY_PAGEUP`, `KEY_PAGEDOWN`,
	// `KEY_ESCAPE` and `SKIP_DEFAULT`.
	if (e.keyCode === 13) {
		// Treat CTRL-J as enter key.
		return;
	}
};


function init()
{
	document.getElementById("min-button").addEventListener("click", function (e) {
		const window = main.getCurrentWindow();
		window.minimize();
	});
	console.log(process.argv);

	document.getElementById("max-button").addEventListener("click", function (e) {
		const window = main.getCurrentWindow();
		if (!window.isMaximized()) {
			this.classList.remove('fa-window-maximize');
			this.classList.add('fa-window-restore');
			window.maximize();
		} else {
			this.classList.remove('fa-window-restore');
			this.classList.add('fa-window-maximize');
			window.unmaximize();
		}
	});

	document.getElementById("close-button").addEventListener("click", function (e) {
		const window = main.getCurrentWindow();
		window.close();
	});
	
	document.getElementById("modal_close").addEventListener("click", function (e) {
		const window = main.getCurrentWindow();
		window.close();
	});
	document.getElementById("new_world").addEventListener("click", function (e) {
		newWorld();
	});
	
	document.getElementById("load_world").addEventListener("click", function (e) {
		newWorld(false);
	});
	
	document.getElementById("people").addEventListener("click", function (e) {
		loadPersonList();
	});
	
	document.getElementById("places").addEventListener("click", function (e) {
		loadPlaceList();
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
			console.log(hash);
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
};

document.onreadystatechange = function ()
{
	if (document.readyState == "complete")
	{
		init();         
	}
};

function newWorld(newWorld = true)
{
	if(needSave)
	{
		//var saveFirst = confirm("You have unsaved changes?!");
	}
	
	if(newWorld == true)
	{	
		worldDBLocation = dialog.showSaveDialog({
			filters: [
				{ name: 'WorldMuncher Files (*.wmnch)', extensions: ['wmnch'] },
				{ name: 'All Files', extensions: ['*'] }
			]});
	}
	else
	{
		worldDBLocation = dialog.showOpenDialog({
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
		vfs = new zipvfs(worldDBLocation[0]);
	else
		vfs = new zipvfs(worldDBLocation);
	if(newWorld == true)
	{
		vfs.writeFileSync('userDB.json', fs.readFileSync('dbproto.json'));
	}

	mkdirVFS('people');
	mkdirVFS('places');
	mkdirVFS('things');
	
	loadWorld();
	document.location.hash = 'close';
	document.location.hash = 'people';
}

function loadWorld()
{
	worlddb = JSON.parse(vfs.readFileSync('userDB.json'));
	console.log("Loaded world.");
	loadPersonList();
	makeLists();
}

function loadPersonList()
{
	var peopleList = document.getElementById('list-holder');
	$(peopleList).empty();
	_.orderBy(worlddb['people'], 'id', 'asc').forEach(function(row) {
		console.log("Selected Rows.");
		var li = document.createElement('li');
		li.setAttribute('id', 'person-' + row.person_id);
		li.classList.add('person');
		li.innerHTML = `<div class="person-image"><div></div></div>
			<h3>` + row.person_name + `</h3>
			<p>
				<span><strong>Age: </strong>` + row.person_age + `</span>
				<span><strong>Gender: </strong>` + row.person_gender + `</span>
			</p>`;
		peopleList.appendChild(li);
		console.log("Added Person.");
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
	
	$('#list-type').html = 'People';
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
		console.log("Selected Rows.");
		var li = document.createElement('li');
		li.setAttribute('id', 'place-' + row.place_id);
		li.classList.add('place');
		li.innerHTML = `<div class="place-image"><div></div></div>
			<h3>` + row.place_name + `</h3>`;
		placeList.appendChild(li);
		console.log("Added Place.");
		
	});

	var placeLI = placeList.getElementsByTagName("li");
	for (var i = 0; i < placeLI.length; i++)
	{
		worlddb['places'].filter(function (el) {
			var placeID = placeLI[i].getAttribute('id').replace('place-', '');
			return el.place_parent == placeID;
		}).forEach(function(row) {
			console.log("Selected Rows.");
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
			console.log("Added Child Place. | " + row.place_parent);
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

	makeLists();

	$('#list-type').html('Places');
	$('#people').removeClass('active');
	$('#places').addClass('active');
	$('#things').removeClass('active');

}

function loadPerson()
{
	var person = worlddb['people'].filter(function (el) {
		return el.person_id == selectedID;
	})[0];

	for (var key in person) {
		if (person.hasOwnProperty(key) && key != 'person_picture' && document.getElementById(key) !== null) {
			document.getElementById(key).innerHTML = person[key];
		}
	}

	document.querySelector('#place-container').style.display = "none";
	document.querySelector('#thing-container').style.display = "none";
	document.querySelector('#person-container').style.display = "block";
	
	$('[contenteditable=true].person-field').off('focusout');
	$('[contenteditable=true].person-field').on('focusout', function(e) {
		if(person[$(this).attr('id')] != $(this).html())
		{
			person[$(this).attr('id')] = $(this).html();
			vfs.writeFileSync('userDB.json', JSON.stringify(worlddb));
			if(selectedIDType == 'person')
				loadPersonList();
			console.log('Saved DB.');
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
		console.log(children);
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
			vfs.writeFileSync('userDB.json', JSON.stringify(worlddb));
			if(selectedIDType == 'place')
				loadPlaceList();
			$('#place_parent').empty();
			var optn = document.createElement("OPTION");
			optn.text = 'None';
			optn.value = '';
			document.getElementById('place_parent').options.add(optn)
			placeList.forEach(function(pl){
				var children = worlddb['places'].filter(function(row){ return row.place_parent == place['place_id']}).map(function(row) { return row['place_id'] });
				console.log(children);
				if(pl['listID'] != place['place_id'] && children.indexOf(pl['listID']) == -1)
				{
					optn = document.createElement("OPTION");
					optn.text = pl['listValue'];
					optn.value = pl['listID'];
					document.getElementById('place_parent').options.add(optn)
				}

			});
			console.log('Saved DB.');
		}
	});

	$('#place_parent').off('change');
	$('#place_parent').on('change', function(e){
		if(place['place_parent'] != $(this).val())
		{
			place['place_parent'] = $(this).val();
			vfs.writeFileSync('userDB.json', JSON.stringify(worlddb));
			if(selectedIDType == 'place')
				loadPlaceList();
			console.log('Saved DB.');
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
		"person_last_appearance": ""
	};
	worlddb['people'].push(newPerson);
	loadPersonList();
}

function addPlace()
{
	var newPlaceID = Math.max.apply(Math,worlddb['places'].map(function(o){return o.place_id;})) + 1;
	var newPlace = {
		"place_id": newPlaceID,
		"place_name": "New Place",
		"place_description": "",
		"place_map": "",
		"place_parent": "",
		"place_ruler": ""
	};
	worlddb['places'].push(newPlace);
	loadPlaceList();
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

var mkdirVFS = function (path) {
	try {
		vfs.mkdirSync(path);
	} catch(e) {
		if ( e.code != 'EEXIST' ) throw e;
	}
}
