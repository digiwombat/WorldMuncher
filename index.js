const {app, BrowserWindow} = require('electron')
const windowStateKeeper = require('electron-window-state');


let win


function createWindow () {
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
		frame: false
	});

	mainWindowState.manage(win);

	win.loadURL(`file://${__dirname}/index.html#openModal`)

	// Open the DevTools.
	//win.webContents.openDevTools()

	win.on('closed', () => {
		win = null
	})
}


const shouldQuit = app.makeSingleInstance((commandLine, workingDirectory) => {
	if (win)
	{
		if (win.isMinimized()) win.restore()
		win.webContents.send('new', commandLine);
		win.focus()
	}
})

if (shouldQuit) {
	app.quit()
}

app.on('ready', createWindow)

app.on('window-all-closed', () => {
	app.quit()
})

app.on('activate', () => {
	if (win === null) {
	createWindow()
	}

})
