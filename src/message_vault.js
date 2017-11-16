// vim: ts=4:sw=4:expandtab

'use strict';

const axios = require('axios');
const http = require('http');
const https = require('https');
const relay = require('librelay');


async function sleep(seconds) {
    await new Promise(done => setTimeout(done, seconds * 1000));
}


class MessageVault {

    async start() {
        this.msgReceiver = await relay.MessageReceiver.factory();
        this.msgReceiver.addEventListener('keychange', this.onKeyChange.bind(this));
        this.msgReceiver.addEventListener('message', ev => {this.onMessage(ev);}); // Run in background
        this.msgReceiver.addEventListener('error', this.onError.bind(this));
        this.msgReceiver.connect();
    }

    stop() {
        this.msgReceiver.close();
        this.msgReceiver = null;
    }

    async onKeyChange(ev) {
        console.warn("Auto-accepting new identity key for:", ev.addr);
        await relay.storage.removeIdentity(ev.addr);
        await relay.storage.saveIdentity(ev.addr, ev.identityKey);
        ev.accepted = true;
    }

    onError(e) {
        console.error('Message Error', e, e.stack);
    }

    async onMessage(ev) {
        const message = ev.data.message;
        const body = JSON.parse(message.body);
        await relay.storage.put('messages', body);
        for (const msgVersion of body) {
            if (message.attachments) {
                const metas = msgVersion.data.attachments || [];
                for (let i = 0; i < message.attachments.length; i++) {
                    const attachment = message.attachments[i];
                    await relay.storage.put('attachments', {
                        attachment,
                        meta: metas[i]
                    });
                }
            }
        }
    }
}

module.exports = MessageVault;
