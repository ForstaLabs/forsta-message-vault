// vim: ts=4:sw=4:expandtab

"use strict";

const BotAtlasClient = require("./atlas_client");
const cache = require("./cache");
const relay = require("librelay");
const PGStore = require("./pgstore");
const uuid4 = require("uuid/v4");

class ForstaBot {
    async start() {
        const ourId = await relay.storage.getState('addr');
        if (!ourId) {
            console.warn('bot is not yet registered');
            return;
        }
        console.info('Starting message receiver for:', ourId);
        this.pgStore = new PGStore('message_vault');
        await this.pgStore.initialize();
        this.atlas = await BotAtlasClient.factory();
        this.getUsers = cache.ttl(60, this.atlas.getUsers.bind(this.atlas));
        this.resolveTags = cache.ttl(
            60,
            this.atlas.resolveTags.bind(this.atlas)
        );
        this.msgReceiver = await relay.MessageReceiver.factory();
        this.msgReceiver.addEventListener(
            'keychange',
            this.onKeyChange.bind(this)
        );
        this.msgReceiver.addEventListener(
            'message',
            ev => this.onMessage(ev),
            null
        );
        this.msgReceiver.addEventListener('error', this.onError.bind(this));

        this.msgSender = await relay.MessageSender.factory();

        await this.msgReceiver.connect();
    }

    async stop() {
        if (this.msgReceiver) {
            console.warn('Stopping message receiver');
            this.msgReceiver.close();
            this.msgReceiver = null;
        }
        await this.pgStore.shutdown();
    }

    async restart() {
        this.stop();
        await this.start();
    }

    async onKeyChange(ev) {
        console.warn('Auto-accepting new identity key for:', ev.addr);
        await ev.accept();
    }

    onError(e) {
        console.error('Message Error', e, e.stack);
    }

    fqTag(user) { return `@${user.tag.slug}:${user.org.slug}`; }
    fqName(user) { 
        return [user.first_name, user.middle_name, user.last_name].map(s => (s || '').trim()).filter(s => !!s).join(' ');
    }

    async onMessage(ev) {
        const received = new Date(ev.data.timestamp);
        const envelope = JSON.parse(ev.data.message.body);
        const message = envelope.find(x => x.version === 1);
        if (!message) {
            console.error('Dropping unsupported message:', envelope);
            return;
        }

        const senderId = message.sender.userId;
        const sender = (await this.getUsers([senderId]))[0];
        const senderTag = this.fqTag(sender);
        const senderName = this.fqName(sender);
        const distribution = await this.resolveTags(message.distribution.expression);
        const recipientIds = distribution.userids;
        const recipients = await this.getUsers(recipientIds);
        const recipientNames = recipients.map(this.fqName);
        const recipientTags = recipients.map(this.fqTag);

        const messageId = message.messageId;
        const threadId = message.threadId;

        const threadTitle = message.threadTitle;
        const tmpText = message.data && message.data.body.find(x => x.type === 'text/plain');
        const messageText = (tmpText && tmpText.value) || '';

        const attachmentData = ev.data.message.attachments || [];
        const attachmentMeta = (message.data && message.data.attachments) || [];
        if (attachmentData.length != attachmentMeta.length) {
            console.error('Received mismatched attachments with message:', envelope);
            return;
        }
        let attachmentIds = attachmentData.map(x => uuid4());

        await this.pgStore.addMessage({
            payload: JSON.stringify(envelope),
            received,
            distribution: JSON.stringify(distribution),
            messageId,
            threadId,
            senderName,
            senderId,
            senderTag,
            recipientNames,
            recipientIds,
            recipientTags,
            attachmentIds,
            tsMain: messageText,
            tsTitle: threadTitle
        });

        for (let i = 0; i < attachmentIds.length; i++) {
            await this.pgStore.addAttachment({  // todo: wrap all adds in a transaction
                id: attachmentIds[i],
                data: attachmentData[i].data,
                type: attachmentMeta[i].type,
                name: attachmentMeta[i].name,
                messageId: messageId
            });
        }
    }
}

module.exports = ForstaBot;
