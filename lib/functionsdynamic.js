//#region Imports and Variables

const main = require('electron').remote;
const remote = require('electron').remote;
const {dialog} = require('electron').remote;
const {process} = require('electron').remote;
const {shell} = require('electron').remote;
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
const buildEditorContextMenu = remote.require('electron-editor-context-menu');
const removeDiacritics = require('diacritics').remove;

var worlddb;
var fullList = [];
var personList = [];
var placeList = [];
var thingList = [];
var activeLayout = [];
var worldDBLocation = "";
var selectedIDType = "person";
var selectedID = 1;
var zip = new JSZip();
var saving = 0;
var needsSave = 0;

//#endregion

//#region Startup Function Business
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
			if(worlddb && needsSave == 1)
			{
				if (confirm('Unsaved Data. Save before opening?'))
				{
					  saveZip();
				}
			}
			worldDBLocation = ev.dataTransfer.files[0].path;
			loadWorld();
		}
		ev.preventDefault();
	}

	require('electron').ipcRenderer.on('new', function(event, message) {
		if(message[1] && message[1].indexOf('.wmnch') != -1)
		{
			if(worlddb && needsSave == 1)
			{
				if (confirm('Unsaved Data. Save before opening?'))
				{
					  saveZip();
				}
			}
			worldDBLocation = message[1];
			loadWorld();
		}
	});

	$(document).on('keyup', function(e){
		if (e.ctrlKey && e.keyCode == 83)
		{
			saveZip();
		}
		if (e.ctrlKey && e.keyCode == 81)
		{
			if(worlddb && needsSave == 1)
			{
				if (confirm('Unsaved Data. Save before closing?'))
				{
					saveZip(true);
				}
				else
				{
					window.close();
				}
			}
			else
			{
				window.close();
			}


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
		if(worlddb && needsSave == 1)
		{
			if (confirm('Unsaved Data. Save before closing?'))
			{
				  saveZip(true);
			}
			else
			{
				window.close();
			}
		}
		else
		{
			window.close();
		}

	});

	$('.new-world').on('click',function(){
		newWorld();
	});

	$('.load-world').on('click',function(){
		newWorld(false);
	});

	$('.save-world').on('click',function(){
		saveZip();
	});

	$('#collapse-all').on('click', function(){
		$('#list-holder li').removeClass('expanded');
		$('#list-holder li').addClass('collapsed');
		needsSave = 1;
		if($('#current-file').text().indexOf('*') == -1)
		{
			$('#current-file').text($('#current-file').text() + '*');
		}
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
					$('[contenteditable=true].' + selectedIDType + '-field:focus').trigger('focusout');
					loadList('person');
					loadItem();
					break;
				case "place":
					selectedID = hash[1];
					selectedIDType = "place";
					$('[contenteditable=true].' + selectedIDType + '-field:focus').trigger('focusout');
					loadList('place');
					loadItem();
					break;
				case "thing":
					selectedID = hash[1];
					selectedIDType = "thing";
					$('[contenteditable=true].' + selectedIDType + '-field:focus').trigger('focusout');
					loadList('thing');
					loadItem();
					break;
			}
		}
		else{console.error('No slash');}

	});

	$("#pim").on('click', function(e) {
		var newImage = dialog.showOpenDialog(main.getCurrentWindow(), {
			filters: [
				{name: 'Image Files', extensions: ['jpg', 'jpeg', 'png', 'gif']}
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
//#endregion

//#region World Functions
function newWorld(newWorld = true)
{
	if(newWorld == true)
	{
		worldDBLocation = dialog.showSaveDialogSync(main.getCurrentWindow(), {
			defaultPath: 'NewWorld.wmnch',
			filters: [
				{ name: 'WorldMuncher Files (*.wmnch)', extensions: ['wmnch'] },
				{ name: 'All Files', extensions: ['*'] }
			]});
	}
	else
	{
		worldDBLocation = dialog.showOpenDialogSync(main.getCurrentWindow(), {
			filters: [
				{ name: 'WorldMuncher Files (*.wmnch)', extensions: ['wmnch'] },
				{ name: 'All Files', extensions: ['*'] }
			],
			properties: ['openFile']
		})[0];
	}

	if(worldDBLocation == undefined)
	{
		console.log("No location defined. Exiting.")
		return;
	}

	if(Array.isArray(worldDBLocation))
	{
		worldDBLocation = worldDBLocation[0];
	}

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
	$("#current-file").html(' | ' + worldDBLocation.replace(/^.*[\\\/]/, ''));
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
	parseLayout();
}
//#endregion

//#region Load List Function
function loadList(type)
{
	var itemList = document.getElementById('list-holder');
	$(itemList).empty();
	if(worlddb[type + '_order'])
	{
		parseNodes(worlddb[type + '_order'], type, true);
	}
	// Rescue Orphans
	_.orderBy(worlddb[type], type + '_name', 'asc').forEach(function(row) {
		if(!$('#' + type + '-' + row[type + '_id']).length)
		{
			var li = document.createElement('li');
			li.setAttribute('id', type + '-' + row[type + '_id']);
			li.classList.add(type);
			li.classList.add('expanded');
			li.innerHTML = `<div class="li-color"><div class="` + type + `-image"><div></div></div>
					<h3>` + row[type + '_name'] + `</h3><div class="disclose fa fa-fw fa-chevron-circle-right"></div></div>`;
			itemList.appendChild(li);
		}
	});


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
			needsSave = 1;
			if($('#current-file').text().indexOf('*') == -1)
			{
				$('#current-file').text($('#current-file').text() + '*');
			}
		}
	});

	$('.disclose').off();
	$('.disclose').on('click', function() {
		var li = $(this).closest('li');
		li.toggleClass('collapsed').toggleClass('expanded');

		needsSave = 1;
		if($('#current-file').text().indexOf('*') == -1)
		{
			$('#current-file').text($('#current-file').text() + '*');
		}
		$(this).toggleClass('right');
	});

	$('#list-holder li').on('cssClassChanged', function(){
		var itemID = $(this).attr('id').replace(type + '-', '');
		var item = worlddb[type].filter(function (el) {
			return el[type + '_id'] == itemID;
		})[0];
		if($(this).hasClass('collapsed'))
		{
			item[type + '_listState'] = 'collapsed';
		}
		else
		{
			item[type + '_listState'] = 'expanded';
		}
	});

	var anchors = document.querySelectorAll('li.' + type + ' div.li-color');
	for (var i = 0; i < anchors.length; i++) {
		var current = anchors[i];
		current.addEventListener('click', function() {
			var itemID = this.parentNode.getAttribute('id').replace(type + '-', '');
			selectedIDType = type;
			selectedID = itemID;

			$('.list-active').removeClass('list-active');
			$(this).addClass('list-active');
			loadItem();
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
		loadItem();
	}

	makeLists();

	$('#filter').attr('placeholder', plural);
	$('[id$=sel]').removeClass('active');
	$('#' + plural + '-sel').addClass('active');
	$('.list-active').closest('ol').closest('li').removeClass('collapsed').addClass('expanded');
	$('#list-holder').scrollTo($('.list-active'));
}

function loadListDynamic(type)
{
	var itemList = document.getElementById('list-holder');
	$(itemList).empty();
	if (worlddb[type + '_order'])
	{
		parseNodes(worlddb[type + '_order'], type, true);
	}
	// Rescue Orphans
	_.orderBy(worlddb[type], type + '_name', 'asc').forEach(function (row)
	{
		if (!$('#' + type + '-' + row[type + '_id']).length)
		{
			var li = document.createElement('li');
			li.setAttribute('id', type + '-' + row[type + '_id']);
			li.classList.add(type);
			li.classList.add('expanded');
			
			li.innerHTML = `<div class="li-color"><div class="` + type + `-image"><div></div></div>
			<h3>` + row['name'] + `</h3><div class="disclose fa fa-fw fa-chevron-circle-right"></div></div>`;
			itemList.appendChild(li);
		}
	});
}

//#endregion

//#region Load Item Function

function loadItem()
{
	var plural;
	switch(selectedIDType)
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
	var item = worlddb[selectedIDType].filter(function (el) {
		return el[selectedIDType + '_id'] == selectedID;
	})[0];

	// for (var key in item) {
	// 	if (item.hasOwnProperty(key) && key != selectedIDType + '_picture' && document.getElementById(key) !== null)
	// 		document.getElementById(key).innerHTML = item[key];
	// 	if(key == selectedIDType + '_picture')
	// 		document.getElementById(key).src = item[key];
	// }

	$('[id$=-container]').css('display', 'none');
	$('#' + selectedIDType + '-container').css('display', 'block');

	$('[contenteditable=true].' + selectedIDType + '-field').off('focusout');
	$('[contenteditable=true].' + selectedIDType + '-field').on('focusout', function(e) {
		if(item[$(this).attr('id')] != $(this).html() && item[selectedIDType + '_id'] == selectedID)
		{
			item[$(this).attr('id')] = $(this).html();
			needsSave = 1;
			if($('#current-file').text().indexOf('*') == -1)
			{
				$('#current-file').text($('#current-file').text() + '*');
			}
			loadList(selectedIDType);
		}
	});

	$('[contenteditable=true].' + selectedIDType + '-field').off('keyup');
	$('[contenteditable=true].' + selectedIDType + '-field').on('keyup', function () {
		field = this;
		typewatch(function () {
			if(item[$(field).attr('id')] != $(field).html() && item[selectedIDType + '_id'] == selectedID)
			{
				item[$(field).attr('id')] = $(field).html();
				needsSave = 1;
				if($('#current-file').text().indexOf('*') == -1)
				{
					$('#current-file').text($('#current-file').text() + '*');
				}
				if(/_name|_age|_gender/.test($(field).attr('id')))
				{
					loadList(selectedIDType);
				}
			}
		}, 100);
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
	needsSave = 1;
	if($('#current-file').text().indexOf('*') == -1)
	{
		$('#current-file').text($('#current-file').text() + '*');
	}
	selectedIDType = "person";
	selectedID = newPersonID;
	loadList('person');
	loadItem();
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
	needsSave = 1;
	if($('#current-file').text().indexOf('*') == -1)
	{
		$('#current-file').text($('#current-file').text() + '*');
	}
	selectedIDType = "place";
	selectedID = newPlaceID;
	loadList('place');
	loadItem();
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
	needsSave = 1;
	if($('#current-file').text().indexOf('*') == -1)
	{
		$('#current-file').text($('#current-file').text() + '*');
	}
	selectedIDType = "thing";
	selectedID = newThingID;
	loadList('thing');
	loadItem();
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
	needsSave = 1;
	if($('#current-file').text().indexOf('*') == -1)
	{
		$('#current-file').text($('#current-file').text() + '*');
	}
	selectedIDType = "note";
	selectedID = newNoteID;
	loadList('note');
	loadItem();
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
			$('#person-' + selectedID).remove();
			worlddb['person_order'] = $('#list-holder').nestedSortable('toHierarchy', { attribute: 'id'});
		}
		needsSave = 1;
		if($('#current-file').text().indexOf('*') == -1)
		{
			$('#current-file').text($('#current-file').text() + '*');
		}
		selectedID = Math.max.apply(Math,worlddb['people'].map(function(o){return o.person_id;}));
		loadList('person');
		loadItem();
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
			$('#place-' + selectedID).remove();
			worlddb['place_order'] = $('#list-holder').nestedSortable('toHierarchy', { attribute: 'id'});
		}
		needsSave = 1;
		if($('#current-file').text().indexOf('*') == -1)
		{
			$('#current-file').text($('#current-file').text() + '*');
		}
		selectedID = Math.max.apply(Math,worlddb['places'].map(function(o){return o.place_id;}));
		loadList('place');
		loadItem();
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
			$('#thing-' + selectedID).remove();
			worlddb['thing_order'] = $('#list-holder').nestedSortable('toHierarchy', { attribute: 'id'});
		}
		needsSave = 1;
		if($('#current-file').text().indexOf('*') == -1)
		{
			$('#current-file').text($('#current-file').text() + '*');
		}
		selectedID = Math.max.apply(Math,worlddb['things'].map(function(o){return o.thing_id;}));
		loadList('thing');
		loadItem();
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
			$('#note-' + selectedID).remove();
			worlddb['note_order'] = $('#list-holder').nestedSortable('toHierarchy', { attribute: 'id'});
		}
		needsSave = 1;
		if($('#current-file').text().indexOf('*') == -1)
		{
			$('#current-file').text($('#current-file').text() + '*');
		}
		selectedID = Math.max.apply(Math,worlddb['notes'].map(function(o){return o.note_id;}));
		loadList('note');
		loadItem();
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
		needsSave = 1;
		if($('#current-file').text().indexOf('*') == -1)
		{
			$('#current-file').text($('#current-file').text() + '*');
		}
		loadList('person');
	});

}

function saveZip(close = false)
{
	if(saving != 1)
	{
		saving = 1;
		console.log('Saving...');
		zip.file('userDB.json', JSON.stringify(worlddb));
		var saveWrite = zip.generateNodeStream({type:'nodebuffer',compression:"DEFLATE",streamFiles:true}).pipe(fs.createWriteStream(worldDBLocation));
		saveWrite.on('finish', function(){
			saving = 0;
			needsSave = 0;
			if($('#current-file').text().indexOf('*') != -1)
			{
				$('#current-file').text($('#current-file').text().slice(0, -1));
			}
			console.log('Finished saving');
			if(close == true)
			{
				window.close();
			}

		});

	}

}

(function autosave(){
	if(worldDBLocation && worlddb)
	{
		saveZip();
	}
	setTimeout(autosave, 300000);
})();

function parseLayout(loadLayout = undefined)
{
	var sidebar = document.getElementById("top-section");
	var mainarea = document.getElementById("main-area");
	sidebar.innerHTML = "";
	mainarea.innerHTML = "";
	if(loadLayout == undefined)
	{
		loadLayout = newDB['layout'];
	}

	console.log(loadLayout);
	for(var section in loadLayout)
	{
		// Add Sidebar Icon
		var sideBarIcon = `<a style="margin-top: 10px;" class="TYPEHERE-link" id="TYPEHERE-sel">
					<span class = "fa-stack fa-fw fa-lg" style="color: COLORHERE;">
						<i class="CLASSHERE"></i>
						<span class="tooltiptext">TYPEHERE</span>
					</span>
		</a>`;
		console.log("Adding " + section);
		sideBarIcon = sideBarIcon.replace(/CLASSHERE/g, loadLayout[section].icon_class);
		sideBarIcon = sideBarIcon.replace(/TYPEHERE/g, section);
		sideBarIcon = sideBarIcon.replace(/COLORHERE/g, loadLayout[section].color);
		sidebar.insertAdjacentHTML('beforeend', sideBarIcon);
		document.getElementById(section + "-sel").addEventListener("click", function (e)
		{
			loadListDynamic(section);
		});

		// Add main section
		var sectionHolder = '<div id="' + section + '-container" class="container">';
		// Draw Top level Row
		for (i = 0; i < loadLayout[section].rows.length; i++)
		{
			let margin = '';
			if (i > 0)
			{
				margin = 'margin-top: 15px;';
			}
			sectionHolder += '<div class="row" style="' + margin + '">';
			// Draw column for row[i]
			for (j = 0; j < loadLayout[section].rows[i].columns.length; j++)
			{
				sectionHolder += '<div class="col col-' + loadLayout[section].rows[i].columns[j] + '">';
				// Draw rows that belong to column[j]
				for (k = 0; k < loadLayout[section].rows[i].subrows[j]; k++)
				{
					sectionHolder += '<div class="row">';
					for (var row in loadLayout[section].fields) {
						rowObject = loadLayout[section].fields[row];
						console.log('Checking row ' + row + ' | ' + (rowObject.row == i && rowObject.column == j && rowObject.subrow == k))
						if (rowObject.row == i && rowObject.column == j && rowObject.subrow == k) {
							console.log('Adding row ' + row)
							let big = '';
							if (rowObject.big) {
								big = "big";
							}

							switch (rowObject.type) {
								case "display":
									sectionHolder += '<div id="' + section + "_" + row + '" class="' + section + '-field" style="display:none;"></div>';
									break;
								case "text":
									
									sectionHolder += '<div id="' + section + "_" + row + '" placeholder="' + rowObject.placeholder + '" contenteditable="true" class="' + section + '-field col col-' + rowObject.columnspan + ' editable-nobar ' + big + '"></div>';
									break;
								case "editor":
									sectionHolder += '<div class="col col-' + rowObject.columnspan + '">';
									sectionHolder += '<div class="big title">' + rowObject.placeholder + '</div>';
									sectionHolder += '<div id="' + section + "_" + row + '" placeholder="' + rowObject.placeholder + '" contenteditable="true" class="' + section + '-field editable"></div>';
									sectionHolder += '</div>';
									break;
							}
						}
					}
					sectionHolder += '</div>';
				}
				sectionHolder += '</div>';
			}
			sectionHolder += '</div>';
			//console.log('Adding row ' + i)
		}
		sectionHolder += '</div>';
		mainarea.insertAdjacentHTML('beforeend', sectionHolder);
		
	}
	
	$('.editable').trumbowyg({
			svgPath: 'node_modules/trumbowyg/dist/ui/icons.svg',
			btns: [
				['viewHTML'],
				['formatting'],
				['strong', 'em', 'del'],
				['link'],
				'btnGrp-semantic',
				'btnGrp-lists',
				['removeformat'],
				['fullscreen']
			],
			autogrow: true
		})
		.on('tbwopenfullscreen', function () {
			$('#list-bar, #section-bar').hide();
			$('#header').css('position', 'fixed');
		})
		.on('tbwclosefullscreen', function () {
			$('#list-bar, #section-bar').show();
			$('#header').css('position', 'relative');
		});
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
		ol.appendChild(parseNodeDynamic(nodes[i], type));
	}
	return ol;
}

function parseNodeDynamic(node, type)
{
	row = worlddb[layout[type].plural].filter(function (el) {
		return el[type + '_id'] == node['id']
	})[0];
	var li = null;
	if (row) {
		var listState = 'expanded';
		if (row[type + '_listState']) {
			listState = row[type + '_listState'];
		}
		li = document.createElement('li');
		li.setAttribute('id', type + '-' + row[type + '_id']);
		li.classList.add(type);
		li.classList.add(listState);
		li.innerHTML = `<div class="li-color"><div class="` + type + `-image"><div></div></div>
		<h3>` + row['name'] + `</h3><div class="disclose fa fa-fw fa-chevron-circle-right"></div></div>`;
		
		if (node.children) li.appendChild(parseNodes(node.children, type));
	}
}

var onKeydownFunc = function (e, commands) {
	// `commands` has `KEY_UP`, `KEY_DOWN`, `KEY_ENTER`, `KEY_PAGEUP`, `KEY_PAGEDOWN`,
	// `KEY_ESCAPE` and `SKIP_DEFAULT`.
	if (e.keyCode === 13)
	{
		return;
	}
};

var typewatch = (function(){
  var timer = 0;
  return function(callback, ms){
	clearTimeout (timer);
	timer = setTimeout(callback, ms);
  };
})();

(function(){
	// Your base, I'm in it!
	var originalAddClassMethod = jQuery.fn.addClass;

	jQuery.fn.addClass = function(){
		// Execute the original method.
		var result = originalAddClassMethod.apply( this, arguments );

		// trigger a custom event
		jQuery(this).trigger('cssClassChanged');

		// return the original result
		return result;
	}
})();

function capitalize(str) {
	str = str.split(" ");

	for (var i = 0, x = str.length; i < x; i++) {
		str[i] = str[i][0].toUpperCase() + str[i].substr(1);
	}

	return str.join(" ");
}

var newDB = {
	"layout":
	{
		"people": {
			"icon_class": "fa fa-users fa-stack-1x",
			"color": "#C0846E",
			"rows": [
				{ "columns": [12], "subrows": [1] },
				{ "columns": [9, 3], "subrows": [6, 1] },
				{ "columns": [12], "subrows": [1] },
				{ "columns": [12], "subrows": [1] }
			],
			"fields": {
				"id": {
					"row": 0,
					"column": 0,
					"subrow": 0,
					"columnspan": 1,
					"type": "display",
					"placeholder": "",
					"big": true
				}, // REQUIRED
				"name": {
					"row": 0,
					"column": 0,
					"subrow": 0,
					"columnspan": 12,
					"type": "text",
					"default": "New Person",
					"placeholder": "Name",
					"big": true
				}, // REQUIRED
				"age": {
					"row": 1,
					"column": 0,
					"subrow": 0,
					"columnspan": 6,
					"type": "text",
					"default": "Unknown",
					"placeholder": "Age"
				},
				"gender": {
					"row": 1,
					"column": 0,
					"subrow": 0,
					"columnspan": 6,
					"type": "text",
					"default": "Unknown",
					"placeholder": "Gender"
				},
				"height": {
					"row": 1,
					"column": 0,
					"subrow": 1,
					"columnspan": 6,
					"type": "text",
					"default": "",
					"placeholder": "Gender"
				},
				"weight": {
					"row": 1,
					"column": 0,
					"subrow": 1,
					"columnspan": 6,
					"type": "text",
					"default": "",
					"placeholder": "Weight"
				},
				"hair_color": {
					"row": 1,
					"column": 0,
					"subrow": 2,
					"columnspan": 6,
					"type": "text",
					"default": "",
					"placeholder": "Hair Color"
				},
				"eye_color": {
					"row": 1,
					"column": 0,
					"subrow": 2,
					"columnspan": 6,
					"type": "text",
					"default": "",
					"placeholder": "Eye Color"
				},
				"from_place": {
					"row": 1,
					"column": 0,
					"subrow": 3,
					"columnspan": 6,
					"type": "text",
					"default": "",
					"placeholder": "From"
				},
				"current_place": {
					"row": 1,
					"column": 0,
					"subrow": 3,
					"columnspan": 6,
					"type": "text",
					"default": "",
					"placeholder": "Currently in"
				},
				"first_appearance": {
					"row": 1,
					"column": 0,
					"subrow": 4,
					"columnspan": 6,
					"type": "text",
					"default": "",
					"placeholder": "First Appearance"
				},
				"last_appearance": {
					"row": 1,
					"column": 0,
					"subrow": 4,
					"columnspan": 6,
					"type": "text",
					"default": "",
					"placeholder": "Last Appearance"
				},
				"status": {
					"row": 1,
					"column": 0,
					"subrow": 5,
					"columnspan": 12,
					"type": "text",
					"default": "",
					"placeholder": "Status"
				},
				"information": {
					"row": 2,
					"column": 0,
					"subrow": 0,
					"columnspan": 6,
					"type": "editor",
					"default": "",
					"placeholder": "About"
				},
				"personality": {
					"row": 2,
					"column": 0,
					"subrow": 0,
					"columnspan": 6,
					"type": "editor",
					"default": "",
					"placeholder": "Personality"
				},
				"background": {
					"row": 3,
					"column": 0,
					"subrow": 0,
					"columnspan": 12,
					"type": "editor",
					"default": "",
					"placeholder": "Notes"
				}				
			}
		}
	},
	"people": [
		{
			"id": 1,
			"name": "New Person",
			"age": "Unknown",
			"gender": "Unknown",
			"height": "",
			"weight": "",
			"hair_color": "",
			"eye_color": "",
			"from_place": "",
			"current_place": "",
			"information": "",
			"personality": "",
			"background": "",
			"status": "",
			"first_appearance": "",
			"last_appearance": "",
			"picture": ""
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
