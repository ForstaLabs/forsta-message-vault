// vim: ts=4:sw=4:expandtab

'use strict';

const BotAtlasClient = require('./atlas_client');
const cache = require('./cache');
const relay = require('librelay');
const swearjar = require('swearjar');


class ForstaBot {

    async start() {
        const ourId = await relay.storage.getState('addr');
        if (!ourId) {
            console.warn("bot is not yet registered");
            return;
        }
        console.info("Starting message receiver for:", ourId);
        this.atlas = await BotAtlasClient.factory();
        this.getUsers = cache.ttl(60, this.atlas.getUsers.bind(this.atlas));
        this.resolveTags = cache.ttl(60, this.atlas.resolveTags.bind(this.atlas));
        this.msgReceiver = await relay.MessageReceiver.factory();
        this.msgReceiver.addEventListener('keychange', this.onKeyChange.bind(this));
        this.msgReceiver.addEventListener('message', ev => this.onMessage(ev), null);
        this.msgReceiver.addEventListener('error', this.onError.bind(this));

        this.msgSender = await relay.MessageSender.factory();

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
        const timestamp = ev.data.timestamp;
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

        await relay.storage.putState('messages-seen', 1 + await relay.storage.getState('messages-seen', 0));

        if (msg.data.body.some(x => swearjar.profane(x.value))) {
            const senderId = msg.sender.userId;
            const senderUser = (await this.getUsers([senderId]))[0];
            const senderTag = this.fqTag(senderUser);
            const emptiness = {};
            console.log('getting from chided-users', senderId, emptiness);
            let chidee = await relay.storage.get('chided-users', senderId, emptiness);
            console.log('got chidee of', chidee);
            // ensure name and tag are current
            chidee.name = [senderUser.first_name, senderUser.middle_name, senderUser.last_name].map(x => x.trim()).filter(x => !!x).join(' ');
            chidee.tag = senderTag;
            await relay.storage.set('chided-users', senderId, chidee);

            const distribution = await this.resolveTags(msg.distribution.expression);
            const memberIds = distribution.userids;
            const members = await this.getUsers(memberIds);
            const memberTags = members.map(this.fqTag);

            // only keeping some metadata, not message content (letting that be another bot's business)
            const entry = {
                sendTime: msg.sendTime,
                receiveTime: timestamp,
                senderId,
                senderTag,
                distribution,
                memberTags,
                messageId: msg.messageId,
                threadId: msg.threadId,
                threadTitle: msg.threadTitle
            };
            await relay.storage.set('flagged-messages', msg.messageId, entry);
            await relay.storage.set('index-sender-message-timestamp', [senderId, msg.messageId, timestamp.toString()].join(), true);

            const reply = this.chide(senderUser.first_name);
            this.msgSender.send({
                distribution,
                threadId: msg.threadId,
                html: `${reply}`,
                text: reply
            });
        }
    }

    chide(name) {
        const chides = [
            'You kiss your mother with that mouth, <name>?',
            "Let's keep it classy, <name>.",
            'Easy there, <name>.',
        ];

        return chides[Math.floor(Math.random() * chides.length)].replace('<name>', name);
    }

}

module.exports = ForstaBot;
