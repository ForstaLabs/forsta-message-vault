// vim: ts=4:sw=4:expandtab

"use strict";

const BotAtlasClient = require("./atlas_client");
const cache = require("./cache");
const relay = require("librelay");
const PGStore = require("./pgstore");
const uuid4 = require("uuid/v4");
const moment = require("moment");
const words = require("./authwords");
const objectHash = require("object-hash");
const OpenTimestamps = require('javascript-opentimestamps');

const AUTH_FAIL_THRESHOLD = 10;

// const BACKGROUND_FREQUENCY_DELAY = 60 * 60 * 1000; // 1 hour
const BACKGROUND_FREQUENCY_DELAY = 2 * 60 * 1000; // 2 minutes
const OTS_ROLLING_VERIFY_COUNT = 24;

const objectHashConfig = {
    algorithm: 'sha256',
    encoding: 'hex',
    excludeKeys: key => ['integrity', 'fullCount'].includes(key)
};

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

        this.verifyIntegrityChain(true);
        this.backgroundInterval = setInterval(this.backgroundWork.bind(this), BACKGROUND_FREQUENCY_DELAY);
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
        if (this.backgroundInterval) clearInterval(this.backgroundInterval);
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
        const tmpBody = message.data && message.data.body;
        const tmpText = tmpBody && tmpBody.find(x => x.type === 'text/plain');
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

        await this.addIntegrity(); 
    }

    async incrementAuthFailCount() {
        let fails = await relay.storage.get('authentication', 'fails', {count: 0, since: new Date()});
        fails.count++;

        if (fails.count >= AUTH_FAIL_THRESHOLD) {
            await this.broadcastNotice({
                note: `SECURITY ALERT!\n\n${fails.count} failed login attempts (last successful login was ${moment(fails.since).fromNow()})`
            });
        }

        await relay.storage.set('authentication', 'fails', fails);
    }

    async resetAuthFailCount() {
        await relay.storage.set('authentication', 'fails', {count: 0, since: new Date()});
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
        const code = `${words.adjective()} ${words.noun()}`;
        const expires = new Date();
        expires.setMinutes(expires.getMinutes() + expirationMinutes);
        return { code, expires };
    }

    removeExpiredAuthCodes(pending) {
        const now = new Date();

        Object.keys(pending).forEach(uid => {
            pending[uid].expires = new Date(pending[uid].expires);
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
                throw { statusCode: 403, info: { tag: ['not an authorized user'] } }; 
            }

            const auth = this.genAuthCode(1);
            this.msgSender.send({
                distribution: resolved,
                threadTitle: 'Vault Login',
                threadId: await this.getGroupAuthThreadId(),
                text: `codewords: ${auth.code}\n(valid for one minute)`
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
            this.incrementAuthFailCount();
            await sleep(500); // throttle guessers
            throw { statusCode: 403, info: { code: ['incorrect codewords, please try again'] } }; 
        }

        delete pending[userId];
        relay.storage.set('authentication', 'pending', pending);

        await this.broadcastNotice({note: 'LOGIN', actorUserId: userId, listAll: false});
        await this.resetAuthFailCount();
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

    async broadcastNotice({note, actorUserId, listAll=true}) {
        const adminIds = await relay.storage.get('authentication', 'adminIds', []);
        let added = false;
        if (actorUserId && !adminIds.includes(actorUserId)) {
            adminIds.push(actorUserId);
            added = true;
        }
        const adminUsers = await this.getUsers(adminIds);
        const actor = adminUsers.find(u => u.id === actorUserId);
        const actorLabel = actor ? this.fqLabel(actor) : '<unknown>';
        const expression = adminUsers.map(u => this.fqTag(u)).join(' + ');
        const distribution = await this.resolveTags(expression);

        const adminList = adminUsers.filter(u => !(added && u.id === actorUserId)).map(u => this.fqLabel(u)).join('\n');

        let fullMessage = note;
        fullMessage += actorUserId ? `\n\nPerformed by ${actorLabel}` : '';
        fullMessage += listAll ? `\n\nCurrent authorized users:\n${adminList}` : '';
        fullMessage = fullMessage.replace(/<<([^>]*)>>/g, (_, id) => {
            const user = adminUsers.find(x => x.id === id);
            return this.fqLabel(user);
        });

        this.msgSender.send({
            distribution,
            threadTitle: 'Vault Alerts',
            threadId: await this.getSoloAuthThreadId(),
            text: fullMessage
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
            await this.broadcastNotice({note: `ADDED <<${uid}>> to authorized users`, actorUserId});
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
        await this.broadcastNotice({note: `REMOVING <<${removeId}>> from authorized users`, actorUserId});
        await relay.storage.set('authentication', 'adminIds', adminIds);

        return this.getAdministrators();
    }


    async addIntegrity() {
        const previous = await this.pgStore.getMessages({ limit: 1, hasIntegrity: true, orderby: 'received', ascending: 'no' });
        let previousId = previous.length ? previous[0].messageId : null;
        let previousChainHash = previous.length ? previous[0].integrity.chainHash : null;

        const messages = await this.pgStore.getMessages({ needsIntegrity: true, orderby: 'received', ascending: 'yes' });

        for (let message of messages) {
            console.log(`adding integrity to ${message.messageId}`);
            const mainHash = objectHash(message, objectHashConfig);
            let attachments = {};
            for (let aid of message.attachmentIds) {
                attachments[aid] = await this.pgStore.getAttachment(aid);
            }
            const attachmentsHash = objectHash(attachments, objectHashConfig);
            const chainHash = objectHash({mainHash, attachmentsHash, previousChainHash}, objectHashConfig);
            const integrity = { mainHash, attachmentsHash, previousId, chainHash };
            await this.pgStore.updateIntegrity(message.messageId, JSON.stringify(integrity));

            previousId = message.messageId;
            previousChainHash = chainHash;
        }
    }

    async verifyIntegrityChain(force=false) {
        const batchThrottle = 1000; // delay after checking each message batch of size limit
        let previousId = null;
        let previousChainHash = null;

        let status = {
            started: Date.now(),
            limit: 3,
            offset: 0,
            fullCount: 0,
            mainHash: 0,
            attachmentsHash: 0,
            chainHash: 0,
            previousId: 0
        };

        console.log('\n\nstarting full verification of integrity chain\n\n');
        const existing = await relay.storage.get('integrity', 'status');
        if (existing && !existing.ended) {
            if (force) {
                console.log('starting new integrity chain even though one appears to be already running:', existing);
            } else {
                console.log('abandoning new integrity chain check because one appears to be already running:', existing);
                return;
            }
        }

        while (true) {
            const messages = await this.pgStore.getMessages({ limit: status.limit, offset: status.offset, hasIntegrity: true, orderby: 'received', ascending: 'yes' });
            status.fullCount = Math.max(status.fullCount, messages.length ? messages[0].fullCount : 0);
            console.log(`retrieved ${status.offset + 1}-${status.offset + messages.length} of ${status.fullCount}`);
            await relay.storage.set('integrity', 'status', status);

            for (let message of messages) {
                console.log(`checking integrity of ${message.messageId}`);
                const mainHash = objectHash(message, objectHashConfig);
                let attachments = {};
                for (let aid of message.attachmentIds) {
                    attachments[aid] = await this.pgStore.getAttachment(aid);
                }
                const attachmentsHash = objectHash(attachments, objectHashConfig);
                const chainHash = objectHash({ mainHash, attachmentsHash, previousChainHash }, objectHashConfig);
                const now = Date.now();
                let integrity = message.integrity;
                let misses = integrity.misses || {};

                if (mainHash !== integrity.mainHash) misses.mainHash = now;
                if (attachmentsHash !== integrity.attachmentsHash) misses.attachmentsHash = now;
                if (chainHash !== integrity.chainHash) misses.chainHash = now;
                if (previousId !== integrity.previousId) misses.previousId = now;

                if (Object.keys(misses).length) {
                    Object.keys(misses).forEach(k => { status[k] += 1;});
                    await this.pgStore.updateIntegrity(message.messageId, Object.assign(integrity, { misses }));
                }

                status.offset++;
                previousId = message.messageId;
                previousChainHash = integrity.chainHash;
            }

            await sleep(batchThrottle);
            if (status.offset >= status.fullCount) break;
        }
        status.ended = Date.now();
        await relay.storage.set('integrity', 'status', status);
        console.log(`integrity chain verification complete`, status);
    }

    async integrityChainVerificationStatus() {
        return await relay.storage.get('integrity', 'status');
    }

    async addOpenTimeStamp() {
        await this.addIntegrity();
        const topNoOTS = await this.pgStore.getMessages({ hasIntegrity: true, needsOTS: true, limit: 1, orderby: 'received', ascending: 'no' });
        if (!topNoOTS.length) return;

        const topOTS = await this.pgStore.getMessages({ hasOTS: true, limit: 1, orderby: 'received', ascending: 'no' });
        if (topOTS.length === 1) {
            if (new Date(topNoOTS[0].received) < new Date(topOTS[0].received)) return;
        }

        try {
            const messageId = topNoOTS[0].messageId;
            console.log(`adding an OTS to ${messageId}`);
            let integrity = topNoOTS[0].integrity;
            const detached = OpenTimestamps.DetachedTimestampFile.fromHash(new OpenTimestamps.Ops.OpSHA256(), OpenTimestamps.Utils.hexToBytes(integrity.chainHash));
            await OpenTimestamps.stamp(detached);
            integrity.OTS = Buffer.from(detached.serializeToBytes()).toString('hex'); // hex of their Uint8Array
            await this.pgStore.updateIntegrity(messageId, JSON.stringify(integrity));
            console.log(`...added an OTS to ${messageId}`);
        } catch(err) {
            console.log(err);
        }
    }


    async verifyAndUpgradeOpenTimeStamps(messages) {
        console.log(`about to verify and upgrade OTS info on ${messages.length} messages`);

        for (let message of messages) {
            console.log(`checking OTS info for ${message.messageId}`);
            const integrity = message.integrity;
            // console.log(`\n\noriginal OTS: https://opentimestamps.org/info.html?ots=${integrity.OTS}\n\n`);
            let otsFile = Uint8Array.from(new Buffer(integrity.OTS, 'hex'));
            const detachedOts = OpenTimestamps.DetachedTimestampFile.deserialize(otsFile);
            // const infoResult = OpenTimestamps.info(detachedOts); // or https://opentimestamps.org/info.html?ots=<otshex>
            // console.log('...OTS info is', infoResult, '\n\n');
            const detached = OpenTimestamps.DetachedTimestampFile.fromHash(new OpenTimestamps.Ops.OpSHA256(), OpenTimestamps.Utils.hexToBytes(integrity.chainHash));
            // console.log('...verifying OTS');
            const verification = await OpenTimestamps.verify(detachedOts, detached);
            if (verification) {
                console.log(`...verified timestamp: ${verification}`);
                integrity.verifiedTimestamp = verification;
                integrity.upgradedOTS = Buffer.from(detachedOts.serializeToBytes()).toString('hex'); // hex of their Uint8Array
                await this.pgStore.updateIntegrity(message.messageId, JSON.stringify(integrity));
                // console.log(`\n\nupgraded OTS: https://opentimestamps.org/info.html?ots=${integrity.upgradedOTS}\n\n`);
                console.log(`... and upgraded OTS`);
            }
            await sleep(5000); // be polite with opentimestamps.org
        }
    }

    async backgroundWork() {
        console.log('background work starting');
        const startTime = Date.now();
        await this.addOpenTimeStamp();

        const messages = await this.pgStore.getMessages({ hasOTS: true, limit: OTS_ROLLING_VERIFY_COUNT, orderby: 'received', ascending: 'no' });
        await this.verifyAndUpgradeOpenTimeStamps(messages);
        const stopTime = Date.now();
        console.log(`\nbackground work finished (took ${stopTime-startTime}ms)\n\n\n`);
    }
}

module.exports = ForstaBot;
