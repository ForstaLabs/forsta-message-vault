#!/usr/bin/env node

const MessageVault = require('./message_vault');
const WebServer = require('./web');
const process = require('process');
const relay = require('librelay');


let _rejectCount = 0;
process.on('unhandledRejection', ev => {
    console.error(ev);
    if (_rejectCount++ > 100) {
        console.error("Reject count too high, killing process.");
        process.exit(1);
    }
});


async function run() {
    relay.storage.setLabel('vault-1');
    const msgVault = new MessageVault();
    await msgVault.start();
    const webServer = new WebServer(msgVault);
    await webServer.start();
}


run().catch(e => {
    console.error("RUN ERROR:", e);
    process.exit(1);
});
