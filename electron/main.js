'use strict';

const fs = require('fs');
const os = require('os');
const pkg = require('../package');
const childProcess = require('child_process');
const {app, BrowserWindow, Tray, nativeImage, shell, Menu, dialog} = require('electron');
const path = require('path');
const process = require('process');
const platform = os.platform();
const menu = require('./menu');

const pgdata = path.join(os.homedir(), '.forsta_message_vault_pgdata');
const pgsql = path.join(__dirname, 'pgsql');
const pgconf = path.join(__dirname, 'pgconf');
const pgsock = fs.mkdtempSync(path.join(os.tmpdir(), 'vaultdb-'));
const pgConfData = [
    `listen_addresses = ''`,
    `unix_socket_directories = '${pgsock}'`
].join('\n');

const port = Number(process.env['PORT']) || 14096;
const imagesDir = path.join(__dirname, '..', 'dist', 'static', 'images');
const appIcon = nativeImage.createFromPath(path.join(imagesDir, 'logo.png'));

let win;
let started;

process.on('unhandledRejection', ev => {
    console.error(ev.reason);
    dialog.showErrorBox('Unhandled Rejection', ev.reason);
});

async function sleep(seconds) {
    await new Promise(resolve => setTimeout(resolve, seconds * 1000));
}

async function initDatabase() {
    let needCreate;
    if (!fs.existsSync(pgdata)) {
        console.log("Setup database...", __dirname);
        console.log(childProcess.execFileSync(path.join(pgsql, 'bin', 'initdb'), [pgdata], {encoding: 'utf8'}));
        fs.copyFileSync(path.join(pgconf, 'pg_hba.conf'), path.join(pgdata, 'pg_hba.conf'));
        needCreate = true;
    }
    fs.writeFileSync(path.join(pgdata, 'postgresql.conf'), pgConfData);
    const dbProc = childProcess.execFile(path.join(pgsql, 'bin', 'postgres'), ['-D', pgdata]);
    console.log('Started PostgreSQL PID:', dbProc.pid);
    dbProc.stdout.on('data', x => console.info("DB: " + x));
    dbProc.stderr.on('data', x => console.warn("DB [E]: " + x));
    dbProc.on('exit', ev => {
        console.error("Database server exited", ev);
    });
    await sleep(1); // XXX timing hack to wait for db ready state.
    if (needCreate) {
        console.warn("Creating NEW database");
        console.log(childProcess.execFileSync(path.join(pgsql, 'bin', 'createdb'), ['-h', pgsock], {encoding: 'utf8'}));
    }
}


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
    if (!started) {
        console.warn("Ignore early createWindow attempt");
        return;
    }
    console.info("Creating Window");
    win = new BrowserWindow({ 
        width: 1024,
        height: 768,
        icon: appIcon,
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


app.once('ready', async () => {
    // This method will be called when Electron has finished
    // initialization and is ready to create browser windows.
    // Some APIs can only be used after this event occurs.
    try {
        await initDatabase();
    } catch(e) {
        console.error("Database startup error: " + e.message);
        dialog.showErrorBox("Database startup error", e.message);
        process.exit(1);
        return;
    }
    process.env.PORT = port;
    process.env.RELAY_STORAGE_BACKING = 'postgres';
    process.env.DATABASE_URL = pgsock;
    try {
        await require('../server');
    } catch(e) {
        console.error("Web server startup error: " + e.message);
        dialog.showErrorBox("Web server startup error", e.message);
        process.exit(1);
        return;
    }

    Menu.setApplicationMenu(menu)

    const tray = new Tray(appIcon);
    tray.setToolTip(pkg.description || 'Forsta Message Vault');
    tray.on('click', showWindow);
    started = true;
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
