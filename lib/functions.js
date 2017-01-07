//#region Imports and Variables

const main = require('electron').remote;
const remote = require('electron').remote;
const {dialog} = require('electron').remote;
const {process} = require('electron').remote;
const {shell} = require('electron').remote;
const {Menu, MenuItem} = require('electron').remote;
const fs = require('fs-extra');
const url = require('url')
const trumbo = require('trumbowyg');
const complete = require('jquery-textcomplete');
const _ = require('lodash');
const smartcrop = require('smartcrop');
const JSZip = require('jszip');
const pjson = require('./package.json');
const semver = require('semver');
const webFrame = require('electron').webFrame;
const spellchecker = require('spellchecker');
const buildEditorContextMenu = remote.require('electron-editor-context-menu');
const SpellCheckProvider = require('electron-spell-check-provider');
const removeDiacritics = require('diacritics').remove;

var worlddb;
var fullList = [];
var personList = [];
var placeList = [];
var thingList = [];
var worldDBLocation = "";
var selectedIDType = "person";
var selectedID = 1;
var zip = new JSZip();

//#endregion

//#region Startup Function Business
var onKeydownFunc = function (e, commands) {
	// `commands` has `KEY_UP`, `KEY_DOWN`, `KEY_ENTER`, `KEY_PAGEUP`, `KEY_PAGEDOWN`,
	// `KEY_ESCAPE` and `SKIP_DEFAULT`.
	if (e.keyCode === 13)
	{
		return;
	}
};

var speller = new SpellCheckProvider('en-US').on('misspelling', function(suggestions) {
	if (window.getSelection().toString()) {
	  selection.isMisspelled = true;
	  selection.spellingSuggestions = suggestions.slice(0, 3);
	}
});
var selection;
function resetSelection() {
  selection = {
	isMisspelled: false,
	spellingSuggestions: []
  };
}
resetSelection();

function addToDic()
{
	let provider = new SpellCheckProvider('en-US');
	let newWord = window.getSelection().toString();
	provider.add(newWord);
	resetSelection();
}


function init()
{
	$.getJSON('https://api.github.com/repos/digiwombat/WorldMuncher/releases/latest', function(data) {
		if(semver.gt(data['tag_name'], pjson['version']))
		{
			$('#vercheck').html('New version!<br /><a href="https://github.com/digiwombat/WorldMuncher/releases/latest">Download WorldMuncher ' + data['tag_name'] + '</a>');
			$('#vercheck a').on('click', function(){
				event.preventDefault();
				shell.openExternal(this.href);
			});
		}
		else
		{
			$('#vercheck').html('WorldMuncher v' + pjson['version']);
		}
	}).fail(function() { $('#vercheck').html('WorldMuncher v' + pjson['version'] + ' | Error'); });

	if(process.argv[1] && process.argv[1].indexOf('.wmnch') != -1)
	{
		worldDBLocation = process.argv[1];
		loadWorld();
	}

	document.ondragover = document.ondrop = (ev) => {
		ev.preventDefault();
	}

	document.body.ondrop = (ev) => {
		if(ev.dataTransfer.files[0].path && ev.dataTransfer.files[0].path.indexOf('.wmnch') != -1)
		{
			if(worlddb)
			{
			  saveZip();
			}
			worldDBLocation = ev.dataTransfer.files[0].path;
			loadWorld();
		}
		ev.preventDefault();
	}

	require('electron').ipcRenderer.on('new', function(event, message) {
		if(message[1] && message[1].indexOf('.wmnch') != -1)
		{
			if(worlddb)
			{
			  saveZip();
			}
			worldDBLocation = message[1];
			loadWorld();
		}
	});

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

	$('#collapse-all').on('click', function(){
		$('#list-holder li').removeClass('expanded');
		$('#list-holder li').addClass('collapsed');
	});

	document.getElementById("people-sel").addEventListener("click", function (e) {
		loadList('person');
	});

	document.getElementById("places-sel").addEventListener("click", function (e) {
		loadList('place');
	});

	document.getElementById("things-sel").addEventListener("click", function (e) {
		loadList('thing');
	});

	document.getElementById("notes-sel").addEventListener("click", function (e) {
		loadList('note');
	});

	$('.editable-nobar').on('keypress', function(e){
		if(e.keyCode == 13)
		{
			return false;
		}
	});

	$(window).blur(function() {
		if(worldDBLocation && worlddb)
		{
			saveZip();
		}
	});

	$('.editable').trumbowyg({
		svgPath: 'node_modules/trumbowyg/dist/ui/icons.svg',
		btns: [
			['viewHTML'],
			['formatting'],
			'btnGrp-semantic',
			'btnGrp-lists',
			['removeformat'],
			['fullscreen']
		],
		autogrow: true
	})
	.on('tbwopenfullscreen', function(){
		$('#list-bar, #section-bar').hide();
		$('#header').css('position', 'fixed');
	})
	.on('tbwclosefullscreen', function(){
		$('#list-bar, #section-bar').show();
		$('#header').css('position', 'relative');
	});

	$('#filter').on('keyup', function(){
		var filter = removeDiacritics(jQuery(this).val());
		jQuery("#list-holder li").each(function () {
			if (removeDiacritics(jQuery(this).text()).search(new RegExp(filter, "i")) < 0) {
				jQuery(this).hide();
			} else {
				jQuery(this).show();
				jQuery(this).children().show();
			}
		});

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
					loadList('person');
					loadPerson();
					break;
				case "place":
					selectedID = hash[1];
					selectedIDType = "place";
					loadList('place');
					loadPlace();
					break;
				case "thing":
					selectedID = hash[1];
					selectedIDType = "thing";
					loadList('thing');
					loadThing();
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

	$(window).on('beforeunload', function(){
		if(worldDBLocation != '')
			saveZip();
	});
}

document.onreadystatechange = function ()
{
	if (document.readyState == "complete")
	{
		init();

		window.addEventListener('mousedown', resetSelection);

		webFrame.setSpellCheckProvider('en-US', true, speller);


		window.addEventListener('contextmenu', function(e) {
			if (!e.target.closest('[contenteditable="true"]')) return;
			selection
			var menu = buildEditorContextMenu(selection);
			if(selection.isMisspelled)
			{
				menu.insert(4,new MenuItem({
					type: 'separator'
				}));
				menu.insert(4,new MenuItem({
					label: 'Add to Dictionary',
					click: function(){
						//BrowserWindow.getFocusedWindow().webContents.send('add', '');
						addToDic();
					}
				}));
			}

			setTimeout(function() {
				menu.popup(remote.getCurrentWindow());
			}, 30);
		});

		require('electron').ipcRenderer.on('add', function(event, message) {
			addToDic();
		});
	}
};
//#endregion

//#region World Functions
function newWorld(newWorld = true)
{
	if(newWorld == true)
	{
		worldDBLocation = dialog.showSaveDialog(main.getCurrentWindow(), {
			defaultPath: 'NewWorld.wmnch',
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
		zip.file('userDB.json', JSON.stringify(newDB));	zip.generateNodeStream({type:'nodebuffer',compression:"DEFLATE",streamFiles:true}).pipe(fs.createWriteStream(worldDBLocation)).on('finish', loadWorld);
	}
	else
	{
		loadWorld();
	}

}

function loadWorld()
{
	document.location.hash = 'close';
	document.location.hash = 'people';
	fs.readFile(worldDBLocation, function(err, data) {
		if (err) throw err;
		JSZip.loadAsync(data).then(function (zip) {
			return zip.file('userDB.json').async("text");
		}).then(function (txt) {
			worlddb = JSON.parse(txt);
			if(worlddb['dbversion'] == undefined)
			{
				worlddb['dbversion'] =  '0.5.0';
				worlddb['notes'] = [{
					"note_id": 1,
					"note_name": "New Note",
					"note_description": ""
				}];
			}

			selectedID = 1;
			selectedIDType = "person";
			loadList('person');
			makeLists();
		});
	});
}
//#endregion

//#region Load List Function
function loadList(type)
{
	var plural;
	switch(type)
	{
		case 'person':
			plural = 'people';
			break;
		case 'place':
			plural = 'places';
			break;
		case 'thing':
			plural = 'things';
			break;
		case 'note':
			plural = 'notes';
			break;
	}
	var itemList = document.getElementById('list-holder');
	$(itemList).empty();
	if(worlddb[type + '_order'])
	{
		parseNodes(worlddb[type + '_order'], type, true);
	}
	else
	{
		_.orderBy(worlddb[plural], type + '_name', 'asc').forEach(function(row) {
			var li = document.createElement('li');
			li.setAttribute('id', type + '-' + row[type + '_id']);
			li.classList.add(type);
			li.classList.add('expanded');
			switch(type)
			{
				case 'person':
					var pic = '';
					if(row.person_picture != "" && row.person_picture != undefined)
						pic = `style="background-image: url('` + row.person_picture + `'); background-size: cover;"`;
					li.innerHTML = `<div class="li-color"><div class="person-image"` + pic + `><div></div></div>
						<h3>` + row.person_name + `</h3>
						<p>
							<span><strong>Age: </strong>` + row.person_age + `</span>
							<span><strong>Gender: </strong>` + row.person_gender + `</span>
						</p><div class="disclose fa fa-fw fa-chevron-circle-right"></div></div>`;
					break;
				default:
					li.innerHTML = `<div class="li-color"><div class="` + type + `-image"><div></div></div>
					<h3>` + row[type + '_name'] + `</h3><div class="disclose fa fa-fw fa-chevron-circle-right"></div></div>`;
					break;

			}
			itemList.appendChild(li);
		});
	}


	$('#list-holder').nestedSortable({
		handle: 'h3',
		items: 'li',
		toleranceElement: '> div',
		isTree: true,
		forcePlaceholderSize: true,
		scroll: true,
		startCollapsed: true,
		branchClass: 'has-children',
		collapsedClass: 'collapsed',
		expandedClass: 'expanded',
		relocate: function(){
			worlddb[type + '_order'] = $('#list-holder').nestedSortable('toHierarchy', { attribute: 'id'});
			$('.disclose').off();
			$('.disclose').on('click', function() {
				$(this).closest('li').toggleClass('collapsed').toggleClass('expanded');
				$(this).toggleClass('right');
			});
			saveZip();
		}
	});

	$('.disclose').off();
	$('.disclose').on('click', function() {
		$(this).closest('li').toggleClass('collapsed').toggleClass('expanded');
		$(this).toggleClass('right');
	});

	var anchors = document.querySelectorAll('li.' + type + ' div.li-color');
	for (var i = 0; i < anchors.length; i++) {
		var current = anchors[i];
		current.addEventListener('click', function() {
			var itemID = this.parentNode.getAttribute('id').replace(type + '-', '');
			selectedIDType = type;
			selectedID = itemID;
			switch(type)
			{
				case 'person':
					loadPerson();
					break;
				case 'place':
					loadPlace();
					break;
				case 'thing':
					loadThing();
					break;
				case 'note':
					loadNote();
					break;
			}
			$('.list-active').removeClass('list-active');
			$(this).addClass('list-active');
		}, false);
	}

	$('#add-item').off('click');
	$('#add-item').on('click', function(evt){
		evt.stopImmediatePropagation();
		switch(type)
		{
			case 'person':
				addPerson();
				break;
			case 'place':
				addPlace();
				break;
			case 'thing':
				addThing();
				break;
			case 'note':
				addNote();
				break;
		}
	});

	$('#remove-item').off('click');
	$('#remove-item').on('click', function(evt){
		evt.stopImmediatePropagation();
		switch(type)
		{
			case 'person':
				removePerson();
				break;
			case 'place':
				removePlace();
				break;
			case 'thing':
				removeThing();
				break;
			case 'note':
				removeNote();
				break;
		}
	});

	if(selectedIDType == type)
	{
		$('#' + type + '-' + selectedID + ' > div.li-color').addClass('list-active');
		switch(type)
		{
			case 'person':
				loadPerson();
				break;
			case 'place':
				loadPlace();
				break;
			case 'thing':
				loadThing();
				break;
			case 'note':
				loadNote();
				break;
		}
	}

	makeLists();

	$('#filter').attr('placeholder', plural);
	$('[id$=sel]').removeClass('active');
	$('#' + plural + '-sel').addClass('active');


}

//#endregion

//#region Load Item Functions
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
	document.querySelector('#note-container').style.display = "none";

	$('[contenteditable=true].person-field').off('focusout');
	$('[contenteditable=true].person-field').on('focusout', function(e) {
		if(person[$(this).attr('id')] != $(this).html())
		{
			person[$(this).attr('id')] = $(this).html();
			saveZip();
			if(selectedIDType == 'person')
				loadList('person');
		}
	});

	$('.editable').textcomplete([{
		match: /(^|\b)(\w{2,})$/,
		search: function (term, callback) {
			callback($.map(fullList, function (word) {
				var	cleanValue = removeDiacritics(word.listValue);
				return cleanValue.indexOf(removeDiacritics(term)) === 0 ? word : null;
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
				var	cleanValue = removeDiacritics(word.listValue);
				return cleanValue.indexOf(removeDiacritics(term)) === 0 ? word : null;
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
		if (place.hasOwnProperty(key) && document.getElementById(key) !== null) {
			document.getElementById(key).innerHTML = place[key];
		}
	}

	document.querySelector('#place-container').style.display = "block";
	document.querySelector('#thing-container').style.display = "none";
	document.querySelector('#person-container').style.display = "none";
	document.querySelector('#note-container').style.display = "none";

	$('[contenteditable=true].place-field').off('focusout');
	$('[contenteditable=true].place-field').on('focusout', function(e) {
		if(place[$(this).attr('id')] != $(this).html())
		{
			place[$(this).attr('id')] = $(this).html();
			saveZip();
			if(selectedIDType == 'place')
				loadList('place');
		}
	});

	$('.editable').textcomplete([{
		match: /(^|\b)(\w{2,})$/,
		search: function (term, callback) {
			callback($.map(fullList, function (word) {
				var	cleanValue = removeDiacritics(word.listValue);
				return cleanValue.indexOf(removeDiacritics(term)) === 0 ? word : null;
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
				var	cleanValue = removeDiacritics(word.listValue);
				return cleanValue.indexOf(removeDiacritics(term)) === 0 ? word : null;
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
	document.querySelector('#note-container').style.display = "none";

	$('[contenteditable=true].thing-field').off('focusout');
	$('[contenteditable=true].thing-field').on('focusout', function(e) {
		if(thing[$(this).attr('id')] != $(this).html())
		{
			thing[$(this).attr('id')] = $(this).html();
			saveZip();
			if(selectedIDType == 'thing')
				loadList('thing');
		}
	});

	$('.editable').textcomplete([{
		match: /(^|\b)(\w{2,})$/,
		search: function (term, callback) {
			callback($.map(fullList, function (word) {
				var	cleanValue = removeDiacritics(word.listValue);
				return cleanValue.indexOf(removeDiacritics(term)) === 0 ? word : null;
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
				var	cleanValue = removeDiacritics(word.listValue);
				return cleanValue.indexOf(removeDiacritics(term)) === 0 ? word : null;
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

function loadNote()
{
	var note = worlddb['notes'].filter(function (el) {
		return el.note_id == selectedID;
	})[0];

	for (var key in note) {
		if (note.hasOwnProperty(key) && document.getElementById(key) !== null) {
			document.getElementById(key).innerHTML = note[key];
		}
	}

	document.querySelector('#place-container').style.display = "none";
	document.querySelector('#thing-container').style.display = "none";
	document.querySelector('#person-container').style.display = "none";
	document.querySelector('#note-container').style.display = "block";

	$('[contenteditable=true].note-field').off('focusout');
	$('[contenteditable=true].note-field').on('focusout', function(e) {
		if(note[$(this).attr('id')] != $(this).html())
		{
			note[$(this).attr('id')] = $(this).html();
			saveZip();
			if(selectedIDType == 'note')
				loadList('note');
		}
	});

	$('.editable').textcomplete([{
		match: /(^|\b)(\w{2,})$/,
		search: function (term, callback) {
			callback($.map(fullList, function (word) {
				var	cleanValue = removeDiacritics(word.listValue);
				return cleanValue.indexOf(removeDiacritics(term)) === 0 ? word : null;
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
				var	cleanValue = removeDiacritics(word.listValue);
				return cleanValue.indexOf(removeDiacritics(term)) === 0 ? word : null;
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


//#endregion

//#region Add Item Functions
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
	if(worlddb['person_order'])
	{
		worlddb['person_order'].push({id: ''+newPersonID});
	}
	saveZip();
	selectedIDType = "person";
	selectedID = newPersonID;
	loadList('person');
	loadPerson();
	$('#list-holder').scrollTo($('.list-active'), 400);
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
	if(worlddb['place_order'])
	{
		worlddb['place_order'].push({id: ''+newPlaceID});
	}
	saveZip();
	selectedIDType = "place";
	selectedID = newPlaceID;
	loadList('place');
	loadPlace();
	$('#list-holder').scrollTo($('.list-active'), 400);
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
	if(worlddb['thing_order'])
	{
		worlddb['thing_order'].push({id: ''+newThingID});
	}
	saveZip();
	selectedIDType = "thing";
	selectedID = newThingID;
	loadList('thing');
	loadThing();
	$('#list-holder').scrollTo($('.list-active'), 400);
}

function addNote()
{
	var newNoteID = Math.max.apply(Math,worlddb['notes'].map(function(o){return o.note_id;})) + 1;
	if (newNoteID === Number.NEGATIVE_INFINITY)
		newNoteID = 1;
	var newNote = {
		"note_id": newNoteID,
		"note_name": "New Note",
		"note_description": ""
	};
	worlddb['notes'].push(newNote);
	if(worlddb['note_order'])
	{
		worlddb['note_order'].push({id: ''+newNoteID});
	}
	saveZip();
	selectedIDType = "note";
	selectedID = newNoteID;
	loadList('note');
	loadNote();
	$('#list-holder').scrollTo($('.list-active'), 400);
}
//#endregion

//#region Remove Item Functions
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
		if(worlddb['person_order'])
		{
			_.remove(worlddb['person_order'], function(el) {
				return el.id == selectedID;
			});
		}
		saveZip();
		selectedID = Math.max.apply(Math,worlddb['people'].map(function(o){return o.person_id;}));
		loadList('person');
		loadPerson();
		if(worlddb['people'].length == 0)
		{
			document.querySelector('#person-container').style.display = "none";
		}
		$('#list-holder').scrollTo($('li.list-active'), 400);
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
		if(worlddb['place_order'])
		{
			_.remove(worlddb['place_order'], function(el) {
				return el.id == selectedID;
			});
		}
		saveZip();
		selectedID = Math.max.apply(Math,worlddb['places'].map(function(o){return o.place_id;}));
		loadList('place');
		loadPlace();
		if(worlddb['places'].length == 0)
		{
			document.querySelector('#place-container').style.display = "none";
		}
		$('#list-holder').scrollTo($('li.list-active'), 400);
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
		if(worlddb['thing_order'])
		{
			_.remove(worlddb['thing_order'], function(el) {
				return el.id == selectedID;
			});
		}
		saveZip();
		selectedID = Math.max.apply(Math,worlddb['things'].map(function(o){return o.thing_id;}));
		loadList('thing');
		loadThing();
		if(worlddb['things'].length == 0)
		{
			document.querySelector('#thing-container').style.display = "none";
		}
		$('#list-holder').scrollTo($('li.list-active'), 400);
	}
	else
		return;

}

function removeNote()
{
	var choice = dialog.showMessageBox(
		main.getCurrentWindow(),
		{
			type: 'warning',
			buttons: ['No', 'Yes'],
			title: 'Remove Note',
			message: 'Remove the currently selected note?'
		});
	if(choice && selectedIDType == 'note')
	{
		_.remove(worlddb['notes'], function(n) {
			return n['note_id'] == selectedID;
		});
		if(worlddb['note_order'])
		{
			_.remove(worlddb['note_order'], function(el) {
				return el.id == selectedID;
			});
		}
		saveZip();
		selectedID = Math.max.apply(Math,worlddb['notes'].map(function(o){return o.note_id;}));
		loadList('note');
		loadNote();
		if(worlddb['notes'].length == 0)
		{
			document.querySelector('#note-container').style.display = "none";
		}
		$('#list-holder').scrollTo($('li.list-active'), 400);
	}
	else
		return;

}
//#endregion

//#region Random Task Functions
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
					  result['topCrop']['x'], result['topCrop']['y'],
					  result['topCrop']['width'], result['topCrop']['height'],
					  0,0,
					  result['topCrop']['width'], result['topCrop']['height']
					 );
		var HERMITE = new Hermite_class();
		HERMITE.resample_single(canvas, 175, 180, true, function(){return;});

		document.getElementById("person_picture").src = canvas.toDataURL();
		worlddb['people'].filter(function (el) {
			return el.person_id == selectedID;
		})[0]['person_picture'] = canvas.toDataURL();
		saveZip();
		loadList('person');
	});

}

function saveZip()
{
	zip.file('userDB.json', JSON.stringify(worlddb));	zip.generateNodeStream({type:'nodebuffer',compression:"DEFLATE",streamFiles:true}).pipe(fs.createWriteStream(worldDBLocation));
}

function parseNodes(nodes, type, first = false)
{
	if(first == false)
	{
		var ol = document.createElement("OL");
	}
	else
	{
		var ol = document.getElementById('list-holder');
	}

	for(var i=0; i<nodes.length; i++) {
		ol.appendChild(parseNode(nodes[i], type));
	}
	return ol;
}

function parseNode(node, type)
{
	var plural;
	switch(type)
	{
		case 'person':
			plural = 'people';
			break;
		case 'place':
			plural = 'places';
			break;
		case 'thing':
			plural = 'things';
			break;
		case 'note':
			plural = 'notes';
			break;
	}
	row = worlddb[plural].filter(function(el){return el[type + '_id'] == node['id']})[0];
	var li = document.createElement('li');
	li.setAttribute('id', type + '-' + row[type + '_id']);
	li.classList.add(type);
	li.classList.add('expanded');
	switch(type)
	{
		case 'person':
			var pic = '';
			if(row.person_picture != "" && row.person_picture != undefined)
				pic = `style="background-image: url('` + row.person_picture + `'); background-size: cover;"`;
			li.innerHTML = `<div class="li-color"><div class="person-image"` + pic + `><div></div></div>
				<h3>` + row.person_name + `</h3>
				<p>
					<span><strong>Age: </strong>` + row.person_age + `</span>
					<span><strong>Gender: </strong>` + row.person_gender + `</span>
				</p><div class="disclose fa fa-fw fa-chevron-circle-right"></div></div>`;
			break;
		default:
			li.innerHTML = `<div class="li-color"><div class="` + type + `-image"><div></div></div>
			<h3>` + row[type + '_name'] + `</h3><div class="disclose fa fa-fw fa-chevron-circle-right"></div></div>`;
			break;

	}

	if(node.children) li.appendChild(parseNodes(node.children, type));
	return li;
}

var newDB = {
	"people": [
		{
			"person_id": 1,
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
		}
	],
	"places": [
		{
			"place_id": 1,
			"place_name": "New Place",
			"place_description": "",
			"place_map": "",
			"place_parent": "",
			"place_ruler": ""
		}
	],
	"things": [
		{
			"thing_id": 1,
			"thing_name": "New Thing",
			"thing_description": ""
		}
	],
	"notes": [
		{
			"note_id": 1,
			"note_name": "New Note",
			"note_description": ""
		}
	],
	"settings": [
		{
			"setting_id": 1,
			"option": "",
			"value": ""
		}
	],
	"dbversion": "0.5.0"
}
//#endregion
