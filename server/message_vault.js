// vim: ts=4:sw=4:expandtab

'use strict';

const VaultAtlasClient = require('./atlas_client');
const cache = require('./cache');
const relay = require('librelay');
const uuid4 = require('uuid/v4');


class MessageVault {

    async start() {
        const ourId = await relay.storage.getState('addr');
        if (!ourId) {
            console.warn("Message Vault unregistered");
            return;
        }
        console.info("Starting message receiver for:", ourId);
        this.atlas = await VaultAtlasClient.factory();
        this.getUsers = cache.ttl(60, this.atlas.getUsers.bind(this.atlas));
        this.resolveTags = cache.ttl(60, this.atlas.resolveTags.bind(this.atlas));
        this.msgReceiver = await relay.MessageReceiver.factory();
        this.msgReceiver.addEventListener('keychange', this.onKeyChange.bind(this));
        this.msgReceiver.addEventListener('message', ev => this.onMessage(ev), null);
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
        await ev.accept();
    }

    onError(e) {
        console.error('Message Error', e, e.stack);
    }

    fqTag(user) {
        return `@${user.tag.slug}:${user.org.slug}`;
    }

    async onMessage(ev) {
        const ts = ev.data.timestamp;
        const message = ev.data.message;
        const msgEnvelope = JSON.parse(message.body);
        let msg;
        for (const x of msgEnvelope) {
            if (x.version === 1) {
                msg = x;
                break;
            }
        }
        if (!msg) {
            console.error("Received unsupported message:", msgEnvelope);
            return;
        }
        const dist = await this.resolveTags(msg.distribution.expression);
        const memberIds = dist.userids;
        const members = await this.getUsers(memberIds);
        const memberTags = members.map(this.fqTag);
        const id = uuid4();
        const entry = {
            id,
            ts,
            messageId: msg.messageId,
            messageType: msg.messageType,
            threadId: msg.threadId,
            threadType: msg.threadType,
            threadTitle: msg.threadTitle,
            sender: msg.sender.userId,
            senderTag: this.fqTag((await this.getUsers([msg.sender.userId]))[0]),
            userAgent: msg.userAgent,
            members: memberIds,
            memberTags,
            distribution: dist.universal,
            distributionPretty: dist.pretty,
            expiration: msg.expiration,
            messageRef: msg.messageRef,
        };
        if (msg.data) {
            const data = msg.data;
            Object.assign(entry, {
                attachments: data.attachments,
                expiration: data.expiration,
                control: data.control,
            });
            if (msg.data.body) {
                entry.body = {};
                for (const x of msg.data.body) {
                    entry.body[x.type] = x.value;
                }
            }
        }
        if (message.attachments) {
            entry.attachments = (msg.data && msg.data.attachments) || [];
            for (let i = 0; i < message.attachments.length; i++) {
                const a = message.attachments[i];
                const aId = uuid4();
                await relay.storage.set('index-attachments-message', [id, aId].join(), aId);
                await relay.storage.set('attachments', aId, a.data);
                if (entry.attachments[i]) {
                    entry.attachments[i].id = aId;
                } else {
                    entry.attachments.push({id: aId});
                }
            }
        }
        await relay.storage.set('index-messages-ts', [ts, id].join(), id);
        await relay.storage.set('index-messages-threadId-ts', [msg.threadId, ts, id].join(), id);
        await relay.storage.set('messages', id, entry);
    }
}

module.exports = MessageVault;
