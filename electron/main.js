'use strict';

const fs = require('fs');
const childProcess = require('child_process');
const {app, BrowserWindow, Tray, nativeImage, shell} = require('electron');
const path = require('path');
const process = require('process');
const platform = require('os').platform();

const pgdata = path.join(__dirname, 'pgdata');
const pgsql = path.join(__dirname, 'pgsql');
const pgconf = path.join(__dirname, 'pgconf');
const pgsock = path.join(pgdata, 'unixsock');
const pgConfData = [
    `unix_socket_directories = '${pgsock}'`
].join('\n');

const title = 'Forsta Message Vault';
const port = Number(process.env['PORT']) || 14096;
const imagesDir = path.join(__dirname, '../dist/static/images/');
const appIcon = nativeImage.createFromPath(imagesDir + 'app.png');

async function sleep(seconds) {
    await new Promise(resolve => setTimeout(resolve, seconds * 1000));
}

async function initDatabase() {
    let needCreate;
    if (!fs.existsSync(pgdata)) {
        console.log("Setup database...", __dirname);
        console.log(childProcess.execSync(`${pgsql}/bin/initdb ${pgdata}`, {encoding: 'utf8'}));
        fs.copyFileSync(`${pgconf}/pg_hba.conf`, `${pgdata}/pg_hba.conf`);
        fs.writeFileSync(`${pgdata}/postgresql.conf`, pgConfData);
        fs.mkdirSync(pgsock);
        needCreate = true;
    }
    childProcess.exec(`${pgsql}/bin/pg_ctl -D ${pgdata} start`);
    if (needCreate) {
        // XXX Hack time.
        console.warn("Creating database");
        await sleep(1);
        console.log(childProcess.execSync(`${pgsql}/bin/createdb -h ${pgsock}`, {encoding: 'utf8'}));
    }
}

let trayIcon;
let trayIconPending;
if (platform === 'darwin') {
    trayIcon = nativeImage.createFromPath(imagesDir + 'macTrayIcon.png');
    trayIcon.setTemplateImage(true);
    trayIconPending = nativeImage.createFromPath(imagesDir + 'macTrayIconPending.png');
    trayIconPending.setTemplateImage(true);
} else {
    trayIcon = nativeImage.createFromPath(imagesDir + 'favicon.png');
    trayIconPending = nativeImage.createFromPath(imagesDir + 'favicon-pending.png');
}

let win;
let tray;

if (app.dock) {
    app.dock.setIcon(appIcon);
}

function showWindow() {
    if (!win) {
        createWindow();
    } else {
        win.show();
    }
}

function createWindow() {
    console.info("Creating Window");
    win = new BrowserWindow({ 
        width: 1024,
        height: 768,
        icon: appIcon,
        title,
        webPreferences: {
            nodeIntegration: false,
            sandbox: true
        }
    });

    win.loadURL(`http://localhost:${port}`);

    win.on('close', ev => {
        ev.preventDefault();
        console.warn("Translating window close into hide.");
        win.hide();  // Keep it alive to avoid closing our websocket.
    });
    win.on('closed', () => {
        // Dereference the window object, usually you would store windows
        // in an array if your app supports multi windows, this is the time
        // when you should delete the corresponding element.
        console.warn("Window closed");
        win = null;
    });

    // Open clicked links in external browser
    // source: https://stackoverflow.com/questions/32402327/how-can-i-force-external-links-from-browser-window-to-open-in-a-default-browser
    win.webContents.on('new-window', function(e, url) {
        e.preventDefault();
        shell.openExternal(url);
    });
}


app.on('ready', async () => {
    // This method will be called when Electron has finished
    // initialization and is ready to create browser windows.
    // Some APIs can only be used after this event occurs.
    await initDatabase();
    process.env.PORT = port;
    process.env.RELAY_STORAGE_BACKING = 'postgres';
    process.env.DATABASE_URL = pgsock;
    require('../server');

    tray = new Tray(trayIcon);
    tray.setToolTip(title);
    tray.on('click', showWindow);

    createWindow();
});
app.on('before-quit', () => {
    console.warn("Shutdown: Destroying window");
    if (win) {
        win.destroy();
        win = null;
    }
});
app.on('activate', showWindow);
