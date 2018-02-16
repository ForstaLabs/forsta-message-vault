#!/usr/bin/env node

const ForstaBot = require('./forsta_bot');
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
    if (process.env.RELAY_STORAGE_BACKING !== 'postgres') {
        const msg = 'Message Vault reqires a postgres backing store -- have you set RELAY_STORAGE_BACKING in your environment?';
        console.error(msg);
        throw Error(msg);
    }

    relay.storage.setLabel('message-vault');
    await relay.storage.initialize();
    const bot = new ForstaBot();
    await bot.start();
    const webServer = new WebServer(bot);
    await webServer.start();
}


run().catch(e => {
    console.error("RUN ERROR:", e);
    process.exit(1);
});
