const { app, BrowserWindow } = require("electron");

function createWindow() {
    let win = new BrowserWindow({
        width: 1200,
        height: 800,
        webPreferences: {
            nodeIntegration: false
        }
    });

    win.loadFile("chair.html"); // Your web app's main page
}

app.whenReady().then(createWindow);
