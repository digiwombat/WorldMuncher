const {app, BrowserWindow} = require('electron')
const windowStateKeeper = require('electron-window-state');
require('electron-context-menu')({
	showInspectElement: false
});
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

	// and load the index.html of the app.
	win.loadURL(`file://${__dirname}/index.html#openModal`)

	// Open the DevTools.
	//win.webContents.openDevTools()

	// Emitted when the window is closed.
	win.on('closed', () => {
		win = null
	})
}

app.on('ready', createWindow)

// Quit when all windows are closed.
app.on('window-all-closed', () => {
	if (process.platform !== 'darwin') {
	app.quit()
	}
})

app.on('activate', () => {
	if (win === null) {
	createWindow()
	}

})
