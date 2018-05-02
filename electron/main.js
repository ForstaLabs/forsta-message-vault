'use strict';

const fs = require('fs');
const os = require('os');
const childProcess = require('child_process');
const {app, BrowserWindow, Tray, nativeImage, shell} = require('electron');
const path = require('path');
const process = require('process');
const platform = os.platform();

const pgdata = path.join(__dirname, 'pgdata');
const pgsql = path.join(__dirname, 'pgsql');
const pgconf = path.join(__dirname, 'pgconf');
const pgsock = fs.mkdtempSync(path.join(os.tmpdir(), '/vaultdb-'));
const pgConfData = [
    `unix_socket_directories = '${pgsock}'`
].join('\n');

const title = 'Forsta Message Vault';
const port = Number(process.env['PORT']) || 14096;
const imagesDir = path.join(__dirname, '../dist/static/images/');
const appIcon = nativeImage.createFromPath(imagesDir + 'logo.png');

async function sleep(seconds) {
    await new Promise(resolve => setTimeout(resolve, seconds * 1000));
}

async function initDatabase() {
    let needCreate;
    if (!fs.existsSync(pgdata)) {
        console.log("Setup database...", __dirname);
        console.log(childProcess.execSync(`${pgsql}/bin/initdb ${pgdata}`, {encoding: 'utf8'}));
        fs.copyFileSync(`${pgconf}/pg_hba.conf`, `${pgdata}/pg_hba.conf`);
        needCreate = true;
    }
    fs.writeFileSync(`${pgdata}/postgresql.conf`, pgConfData);
    childProcess.exec(`${pgsql}/bin/pg_ctl -D ${pgdata} start`);
    await sleep(1); // XXX timing hack to wait for db ready state.
    if (needCreate) {
        console.warn("Creating NEW database");
        console.log(childProcess.execSync(`${pgsql}/bin/createdb -h ${pgsock}`, {encoding: 'utf8'}));
    }
}

let win;

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

    win.on('close', ev => {
        ev.preventDefault();
        win.hide();  // Keep it alive to avoid closing our websocket.
    });

    win.on('closed', () => {
        // Dereference the window object, usually you would store windows
        // in an array if your app supports multi windows, this is the time
        // when you should delete the corresponding element.
        console.warn("Window closed");
        win = null;
    });

    win.webContents.on('new-window', (ev, url) => {
        // Open clicked links in external browser
        ev.preventDefault();
        shell.openExternal(url);
    });

    win.loadURL(`http://localhost:${port}`);
}


app.on('ready', async () => {
    // This method will be called when Electron has finished
    // initialization and is ready to create browser windows.
    // Some APIs can only be used after this event occurs.
    await initDatabase();
    process.env.PORT = port;
    process.env.RELAY_STORAGE_BACKING = 'postgres';
    process.env.DATABASE_URL = pgsock;
    await require('../server');

    const tray = new Tray(appIcon);
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
