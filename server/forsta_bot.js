// vim: ts=4:sw=4:expandtab

"use strict";

const BotAtlasClient = require("./atlas_client");
const cache = require("./cache");
const relay = require("librelay");
const PGStore = require("./pgstore");
const uuid4 = require("uuid/v4");

async function sleep(ms) { 
    return await new Promise(resolve => setTimeout(resolve, ms)); 
}

class ForstaBot {
    async start() {
        const ourId = await relay.storage.getState('addr');
        if (!ourId) {
            console.warn('bot is not yet registered');
            return;
        }
        await this.migrate();
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

    async migrate() {
        const adminIds = await relay.storage.get('authentication', 'adminIds');
        if (!adminIds) {
            // need to convert from a password-auth sort of bot to the new auth-code system
            const onboardUser = await relay.storage.getState("onboardUser");
            if (!onboardUser) return; // should never happen, but just in case..
            await relay.storage.set('authentication', 'adminIds', [onboardUser]);
            await relay.storage.remove('authentication', 'pwhash');
        }
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
    fqLabel(user) { return `${this.fqTag(user)} (${this.fqName(user)})`; }


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
        const senderLabel = this.fqLabel(sender);
        const distribution = await this.resolveTags(message.distribution.expression);
        const recipients = await this.getUsers(distribution.userids);
        const recipientIds = recipients.map(user => user.id);
        const recipientLabels = recipients.map(user => this.fqLabel(user));

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
            senderId,
            senderLabel,
            recipientIds,
            recipientLabels,
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

    async getSoloAuthThreadId() {
        let id = await relay.storage.get('authentication', 'soloThreadId');
        if (!id) {
            id = uuid4();
            relay.storage.set('authentication', 'soloThreadId', id);
        }

        return id;
    }

    async getGroupAuthThreadId() {
        let id = await relay.storage.get('authentication', 'groupThreadId');
        if (!id) {
            id = uuid4();
            relay.storage.set('authentication', 'groupThreadId', id);
        }

        return id;
    }

    genAuthCode(expirationMinutes) {
        const code = ('000000' + Math.floor(Math.random() * 1000000)).slice(-6);
        const expires = new Date();
        expires.setMinutes(expires.getMinutes() + expirationMinutes);
        return { code, expires };
    }

    removeExpiredAuthCodes(pending) {
        const now = new Date();

        Object.keys(pending).forEach(uid => {
            pending[uid].expires = new Date(pending[uid].expires); // todo: fix store encoding...
            if (pending[uid].expires < now) {
                delete pending[uid];
            }
        });

        return pending;
    }

    async sendAuthCode(tag) {
        tag = (tag && tag[0] === '@') ? tag : '@' + tag;
        const resolved = await this.resolveTags(tag);
        if (resolved.userids.length === 1 && resolved.warnings.length === 0) {
            const uid = resolved.userids[0];
            const adminIds = await relay.storage.get('authentication', 'adminIds');
            if (!adminIds.includes(uid)) {
                throw { statusCode: 403, info: { tag: ['not an approved administrator'] } }; 
            }

            const auth = this.genAuthCode(1);
            this.msgSender.send({
                distribution: resolved,
                threadTitle: 'Message Vault Login',
                threadId: await this.getGroupAuthThreadId(),
                text: `${auth.code} is your authentication code, valid for one minute`
            });
            const pending = await relay.storage.get('authentication', 'pending', {});
            pending[uid] = auth;
            await relay.storage.set('authentication', 'pending', pending);
            
            return resolved.userids[0];
        } else {
            throw { statusCode: 400, info: { tag: ['not a recognized tag, please try again'] } }; 
        }
    }

    async validateAuthCode(userId, code) {
        let pending = await relay.storage.get('authentication', 'pending', {});
        pending = this.removeExpiredAuthCodes(pending);
        const auth = pending[userId];
        if (!auth) {
            throw { statusCode: 403, info: { code: ['no authentication pending, please start over'] } }; 
        }
        if (auth.code != code) {
            await sleep(500); // throttle guessers
            throw { statusCode: 403, info: { code: ['incorrect code, please try again'] } }; 
        }

        delete pending[userId];
        relay.storage.set('authentication', 'pending', pending);

        await this.broadcastNotice('successfully SIGNED IN as an administrator', userId);
        return true;
    }

    async getAdministrators() {
        const adminIds = await relay.storage.get('authentication', 'adminIds', []);
        const adminUsers = await this.getUsers(adminIds);
        const admins = adminUsers.map(u => {
            return {
                id: u.id,
                label: this.fqLabel(u)
            };
        });
        return admins;
    }

    async broadcastNotice(action, actorUserId) {
        const adminIds = await relay.storage.get('authentication', 'adminIds', []);
        let added = false;
        if (!adminIds.includes(actorUserId)) {
            adminIds.push(actorUserId);
            added = true;
        }
        const adminUsers = await this.getUsers(adminIds);
        const actor = adminUsers.find(u => u.id === actorUserId);
        const actorLabel = actor ? this.fqLabel(actor) : '<unknown>';
        const expression = adminUsers.map(u => this.fqTag(u)).join(' + ');
        const distribution = await this.resolveTags(expression);

        const adminList = adminUsers.filter(u => !(added && u.id === actorUserId)).map(u => this.fqLabel(u)).join('\n');

        const fullMessage = `Note: ${actorLabel} ${action}.\n\nCurrent administrators are:\n${adminList}`;
        const subbedFullMessage = fullMessage.replace(/<<([^>]*)>>/g, (_, id) => {
            const user = adminUsers.find(x => x.id === id);
            return this.fqLabel(user);
        });

        this.msgSender.send({
            distribution,
            threadTitle: 'Message Vault Administration',
            threadId: await this.getSoloAuthThreadId(),
            text: subbedFullMessage
        });
    }

    async addAdministrator({addTag, actorUserId}) {
        const tag = (addTag && addTag[0] === '@') ? addTag : '@' + addTag;
        const resolved = await this.resolveTags(tag);
        if (resolved.userids.length === 1 && resolved.warnings.length === 0) {
            const uid = resolved.userids[0];
            const adminIds = await relay.storage.get('authentication', 'adminIds');
            if (!adminIds.includes(uid)) {
                adminIds.push(uid);
                await relay.storage.set('authentication', 'adminIds', adminIds);
            }
            await this.broadcastNotice(`has ADDED <<${uid}>> to the administrator list`, actorUserId);
            return this.getAdministrators();
        }
        throw { statusCode: 400, info: { tag: ['not a recognized tag, please try again'] } }; 
    }

    async removeAdministrator({removeId, actorUserId}) {
        const adminIds = await relay.storage.get('authentication', 'adminIds', []);
        const idx = adminIds.indexOf(removeId);

        if (idx < 0) {
            throw { statusCode: 400, info: { id: ['administrator id not found'] } };
        }
        adminIds.splice(idx, 1);
        await this.broadcastNotice(`is REMOVING <<${removeId}>> from the administrator list`, actorUserId);
        await relay.storage.set('authentication', 'adminIds', adminIds);

        return this.getAdministrators();
    }
}

module.exports = ForstaBot;
