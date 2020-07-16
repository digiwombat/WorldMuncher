const {app, BrowserWindow} = require('electron')
const windowStateKeeper = require('electron-window-state');
const gotTheLock = app.requestSingleInstanceLock();

let win;


function createWindow() 
{
	let mainWindowState = windowStateKeeper({
		defaultWidth: 1280,
		defaultHeight: 800
	});

	// Create the window using the state information
	win = new BrowserWindow({
		'x': mainWindowState.x,
		'y': mainWindowState.y,
		'width': mainWindowState.width,
		'height': mainWindowState.height,
		frame: false,
		webPreferences: {
			spellcheck: true,
			nodeIntegration: true,
			enableRemoteModule: true
		}
	});

	const {
		Menu,
		MenuItem
	} = require('electron')

	win.webContents.on('context-menu', (event, params) => {
		const menu = new Menu();
		if (!event.target.closest('textarea, input, [contenteditable="true"]')) return;
		// Add each spelling suggestion
		//console.log(params);
		for (const suggestion of params.dictionarySuggestions)
		{
			menu.append(new MenuItem({
				label: suggestion,
				click: () => mainWindow.webContents.replaceMisspelling(suggestion)
			}))
		}

		// Allow users to add the misspelled word to the dictionary
		if (params.misspelledWord)
		{
			menu.append(
				new MenuItem({
					type: 'separator'
				})
			)
			menu.append(
				new MenuItem({
					label: 'Add to dictionary',
					click: () => win.webContents.session.addWordToSpellCheckerDictionary(params.misspelledWord)
				})
			)
		}

		menu.popup()
	})

	mainWindowState.manage(win);

	win.loadURL(`file://${__dirname}/index.html#openModal`)

	// Open the DevTools.
	//win.webContents.openDevTools()

	win.on('closed', () => {
		win = null
	})
}





if (!gotTheLock) {
	app.quit()
}
else
{
	app.on('second-instance', (event, commandLine, workingDirectory) => {
		// Someone tried to run a second instance, we should focus our window.
		if (myWindow)
		{
			if (myWindow.isMinimized())
			{
				myWindow.restore()
			}
			myWindow.focus()
		}
	})

	// Create myWindow, load the rest of the app, etc...
	app.whenReady().then(() => {
		createWindow();
	})
}

app.on('window-all-closed', () =>
{
	app.quit()
});

app.on('activate', () =>
{
	if (win === null) 
	{
		createWindow();
	}

});
