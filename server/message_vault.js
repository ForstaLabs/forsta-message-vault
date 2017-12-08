// vim: ts=4:sw=4:expandtab

'use strict';

const relay = require('librelay');


class MessageVault {

    async start() {
        const ourId = await relay.storage.getState('addr');
        if (!ourId) {
            console.warn("Message Vault unregistered");
            return;
        }
        console.info("Starting message receiver for:", ourId);
        this.msgReceiver = await relay.MessageReceiver.factory();
        this.msgReceiver.addEventListener('keychange', this.onKeyChange.bind(this));
        this.msgReceiver.addEventListener('message', this.onMessage.bind(this));
        this.msgReceiver.addEventListener('error', this.onError.bind(this));
        await this.msgReceiver.connect();
    }

    stop() {
        if (this.msgReceiver) {
            console.warn("Stopping message receiver");
            this.msgReceiver.close();
            this.msgReceiver = null;
        }
    }

    async restart() {
        this.stop();
        await this.start();
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
