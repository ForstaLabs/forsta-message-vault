'use strict';

const fs = require('fs');
const os = require('os');
const pkg = require('../package');
const childProcess = require('child_process');
const {app, BrowserWindow, Tray, nativeImage, shell, Menu, dialog} = require('electron');
const path = require('path');
const process = require('process');
const menu = require('./menu');

const isUnix = os.platform() !== 'win32';
const pgDataDir = path.join(os.homedir(), '.forsta_message_vault_pgdata');
const pgDir = path.join(__dirname, 'pgsql');
const pgWindowsHost = 'localhost';
const pgWindowsPort = 32245;
const pgUnixSockDir = isUnix && fs.mkdtempSync(path.join(os.tmpdir(), 'vaultdb-'));

const port = Number(process.env['PORT']) || 14096;
const imagesDir = path.join(__dirname, '..', 'dist', 'static', 'images');
const appIcon = nativeImage.createFromPath(path.join(imagesDir, 'logo.png'));

let win;
let started;
let stopping = false;


function showErrorAndDie(title, message) {
    console.error(`${title}: ${message}`);
    dialog.showErrorBox(title, message);
    stopping = true;
    process.exit(1);
    process.kill(0);
}

async function sleep(seconds) {
    await new Promise(resolve => setTimeout(resolve, seconds * 1000));
}

function execFileSync(file, args, options) {
    options = Object.assign({
        encoding: 'utf8',
        cwd: __dirname
    }, options);
    return childProcess.execFileSync(file, args, options);
}

function execFile(file, args, options) {
    options = Object.assign({
        cwd: __dirname
    }, options);
    return childProcess.execFile(file, args, options);
}

async function initDatabase() {
    let needCreate;
    if (!fs.existsSync(pgDataDir)) {
        console.log("Setup database:", pgDataDir);
        console.log(execFileSync(path.join(pgDir, 'bin', 'initdb'), [pgDataDir]));
        needCreate = true;
    }
    let hbaConf;
    if (isUnix) {
        hbaConf = 'local all all trust\n';
    } else {
        hbaConf = 'host all all 127.0.0.1/32 trust\r\n' + 
                  'host all all ::1/128 trust\r\n';
    }
    fs.writeFileSync(path.join(pgDataDir, 'pg_hba.conf'), hbaConf);
    const pgConfData = isUnix ? [
        `listen_addresses = ''`,
        `unix_socket_directories = '${pgUnixSockDir}'`
    ].join('\n') : `port=${pgWindowsPort}`;
    fs.writeFileSync(path.join(pgDataDir, 'postgresql.conf'), pgConfData);
    const dbProc = execFile(path.join(pgDir, 'bin', 'postgres'), ['-D', pgDataDir]);
    console.log('Started PostgreSQL PID:', dbProc.pid);
    const dbLogs = [];
    dbProc.stdout.on('data', x => {
        console.info("DB: " + x);
        dbLogs.push(x);
    });
    dbProc.stderr.on('data', x => {
        console.warn("DB [E]: " + x);
        dbLogs.push(x);
    });
    dbProc.on('exit', () => {
        showErrorAndDie("Database server exited", dbLogs.slice(-100).join('\n'));
    });
    await sleep(2); // XXX timing hack to wait for db ready state.
    if (needCreate) {
        console.warn("Creating NEW database");
        dialog.showMessageBox({
            title: "Creating new database",
            message: `New database will be created at: ${pgDataDir}`
        });
        let args;
        if (isUnix) {
            args = ['-h', pgUnixSockDir];
        } else {
            args = ['-h', pgWindowsHost, '-p', pgWindowsPort];
        }
        console.log(execFileSync(path.join(pgDir, 'bin', 'createdb'), args));
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
        return showErrorAndDie('Database startup error', e.message);
    }
    process.env.PORT = port;
    process.env.RELAY_STORAGE_BACKING = 'postgres';
    process.env.DATABASE_URL = isUnix ? pgUnixSockDir : `postgres://${pgWindowsHost}:${pgWindowsPort}`;
    try {
        await require('../server');
    } catch(e) {
        return showErrorAndDie("Web server startup error", e.message);
    }

    Menu.setApplicationMenu(menu);

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

process.on('unhandledRejection', ev => {
    if (!stopping) {
        console.error('Unhandled rejection: ' + ev.reason);
        dialog.showErrorBox('Unhandled Rejection', ev.reason);
    }
});
