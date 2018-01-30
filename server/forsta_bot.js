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

        const distribution = await this.resolveTags(msg.distribution.expression);

        const botId = await relay.storage.getState('addr');
        const botUser = (await this.getUsers([botId]))[0];
        const botTag = this.fqTag(botUser);
        if (msg.data.body.some(x => this.askedForScorecard(x.value, botTag))) {
            const stats = await ForstaBot.stats();
            const prelude = `${stats.totalMessagesFlagged} NSFW messages seen:`;
            const chidees = stats.chidedUsers.sort((a, b) => a.count < b.count).map(u => `${u.count} - ${u.tag} (${u.name})`);
            const postscript = `(of ${stats.totalMessagesSeen} total messages)`;
            this.msgSender.send({
                distribution,
                threadId: msg.threadId,
                html: `${prelude}<br />${chidees.join('<br />')}<br />${postscript}`,
                text: `${prelude}\n${chidees.join('\n')}\n${postscript}\n`,
            });
        }

        if (msg.data.body.some(x => swearjar.profane(x.value))) {
            const senderId = msg.sender.userId;
            const senderUser = (await this.getUsers([senderId]))[0];
            const senderTag = this.fqTag(senderUser);
            const emptiness = {};
            let chidee = await relay.storage.get('chided-users', senderId, emptiness);
            // ensure name and tag are current
            chidee.name = [senderUser.first_name, senderUser.middle_name, senderUser.last_name].map(x => x.trim()).filter(x => !!x).join(' ');
            chidee.tag = senderTag;
            await relay.storage.set('chided-users', senderId, chidee);

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

    static async stats() {
        const totalMessagesSeen = await relay.storage.getState('messages-seen', 0);
        const flagged = await relay.storage.keys('index-sender-message-timestamp');
        const counts = flagged.reduce((counts, chideIndex) => {
            const [senderId] = chideIndex.split(',');
            counts[senderId] = (counts[senderId] || 0) + 1;
            return counts;
        }, {});

        let chided = [];
        for (const senderId in counts) {
            const sender = await relay.storage.get('chided-users', senderId, { name: 'Unknown(!)', tag: '@unknown:unknown' });
            sender.count = counts[senderId];
            chided.push(sender);
        }

        return { totalMessagesSeen, totalMessagesFlagged: flagged.length, chidedUsers: chided };
    }

    askedForScorecard(text, myTag) {
        const [localTag] = myTag.split(':');
        const lctext = text.toLowerCase();

        const mentioned = lctext.indexOf(localTag) >= 0;
        const requested = mentioned && ['win', 'leader', 'total', 'score', 'status'].some(x => lctext.indexOf(x) >= 0);

        return requested;
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
