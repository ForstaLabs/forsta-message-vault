const VaultAtlasClient = require('../atlas_client');
const csvStringify = require('csv-stringify');
const express = require('express');
const relay = require('librelay');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcrypt');
const uuidv4 = require('uuid/v4');

const bcryptSaltRounds = 12;

// const lineContext = () => new Error().stack.split(/\n/)[2].trim();


class APIHandler {

    constructor({server, requireAuth=true}) {
        this.server = server;
        this.router = express.Router();
    }

    asyncRoute(fn, requireAuth=true) {
        /* Add error handling for async exceptions.  Otherwise the server just hangs
         * the request or subclasses have to do this by hand for each async routine. */
        return (req, res, next) => {
            if (requireAuth) {
                const header = req.get('Authorization');
                const parts = (header || '').split(' ');
                if (!header || parts.length !== 2 || parts[0].toLowerCase() !== 'jwt') {
                    console.log('missing authentication');
                    res.status(403).send({ message: 'forbidden' });
                } else {
                    relay.storage.get('authentication', 'jwtsecret')
                        .then((secret) => {
                            try {
                                jwt.verify(parts[1], secret);
                                console.log('properly authenticated');
                                fn.call(this, req, res, next).catch(e => {
                                    console.error('Async Route Error:', e);
                                    next();
                                });
                            } catch (err) {
                                console.log('bad authentication', err);
                                res.status(403).send({ message: 'forbidden' });
                            }
                        })
                        .catch(err => {
                            console.log('storage error checking authentication', err);
                            res.status(403).send({ message: 'forbidden' });
                        });
                }
            } else {
                console.log('no authentication needed');
                fn.call(this, req, res, next).catch(e => {
                    console.error('Async Route Error:', e);
                    next();
                });
            }
        };
    }

    async toCSV(data) {
        return await new Promise((resolve, reject) => {
            try {
                csvStringify(data, (e, output) => {
                    if (e) {
                        reject(e);
                    } else {
                        resolve(output);
                    }
                });
            } catch(e) {
                reject(e);
            }
        });
    }
}


class OnboardAPIV1 extends APIHandler {

    constructor(options) {
        super(options);
        this.router.get('/status/v1', this.asyncRoute(this.onStatusGet, false));
        this.router.get('/authcode/v1/:tag', this.asyncRoute(this.onAuthCodeGet));
        this.router.post('/authcode/v1/:tag', this.asyncRoute(this.onAuthCodePost));
    }

    async onStatusGet(req, res, next) {
        /* Registration status (local only, we don't check the remote server(s)) */
        console.log('checking registration status');
        const registered = !!await relay.storage.getState('vaultToken');
        console.log('... registration status:', registered);
        if (!registered) {
            res.status(404).json({error: 'not_registered'});
        } else {
            res.status(204).send();
        }
    }

    async onAuthCodeGet(req, res) {
        /* Request authcode for an Atlas admin user.  This request should be followed
         * by an API call to the sibling POST method using a payload of the SMS auth
         * code sent to the user's SMS device. */
        const tag = req.params.tag;
        if (!tag) {
            res.status(412).json({
                error: 'missing_arg',
                message: 'Missing URL param: tag'
            });
            return;
        }
        res.status(200).json(await VaultAtlasClient.authenticate(tag));
    }

    async onAuthCodePost(req, res) {
        /* Complete registration using the SMS auth code that the user should have received
         * following a call to `onAuthCodeGet`. */
        const tag = req.params.tag;
        if (!tag) {
            res.status(412).json({
                error: 'missing_arg',
                message: 'Missing URL param: tag'
            });
            return;
        }
        const code = req.body.code;
        if (!code) {
            res.status(412).json({
                error: 'missing_arg',
                message: 'Missing payload param: code'
            });
            return;
        }
        const atlas = await VaultAtlasClient.onboardVault(tag, code);
        this.server.msgVault.stop();
        await relay.registerAccount({
            name: `Vault (Created by: ${tag})`,
            atlasClient: atlas
        });
        await this.server.msgVault.start();
        await atlas.fetch(`/v1/user/${atlas.userId}/`, {
            method: 'PATCH',
            json: {is_monitor: true}
        });
        res.status(204).send();
    }
}

class MessagesAPIV1 extends APIHandler {

    constructor(options) {
        super(options);
        this.router.get('/v1', this.asyncRoute(this.onGet));
        this.csvFields = [
            [x => x.id, 'id'],
            [x => x.ts, 'ts'],
            [x => x.messageId, 'message_id'],
            [x => x.threadId, 'thread_id'],
            [x => x.sender, 'sender_id'],
            [x => x.senderTag, 'sender_tag'],
            [x => x.body && x.body['text/plain'], 'body'],
            [x => x.threadType, 'thread_type'],
            [x => x.messageType, 'message_type'],
            [x => x.distribution, 'distribution'],
            [x => x.distributionPretty, 'distribution_pretty'],
            [x => x.members.join(), 'members'],
            [x => x.memberTags.join(), 'member_tags'],
        ];
    }

    async onGet(req, res) {
        const format = req.query.format ||
                       (req.accepts('json') && 'json') ||
                       (req.accepts('csv') && 'csv') ||
                       null;
        if (!format) {
            res.status(400).send('Unsupported format or "Accept" header requirement');
            return;
        }
        const limit = parseInt(req.query.limit) || 10000;
        const offset = parseInt(req.query.offset) || 0;
        const index = await relay.storage.keys('index-messages-ts');
        index.sort();
        if (req.query.order && req.query.order.toLowerCase() === 'desc') {
            index.reverse();
        }
        const keys = index.slice(offset, offset + limit);
        const messages = await Promise.all(keys.map(async x => {
            const [ts, id] = x.split(',');
            const msg = await relay.storage.get('messages', id);
            return Object.assign({ts: Number(ts)}, msg);
        }));
        if (format === 'json') {
            res.status(200).json({
                meta: {
                    total_count: index.length,
                    limit,
                    offset
                },
                data: messages
            });
        } else if (format === 'csv') {
            const buf = [this.csvFields.map(x => x[1])];
            for (const msg of messages) {
                buf.push(this.csvFields.map(x => x[0](msg)));
            }
            res.attachment(`messages-${Date.now()}.csv`);
            res.status(200).send(await this.toCSV(buf));
        } else {
            res.status(400).send('Unsupported format: ' + format);
        }
    }
}

class AttachmentsAPIV1 extends APIHandler {

    constructor(options) {
        super(options);
        this.router.get('/v1/:id', this.asyncRoute(this.onGet));
    }

    async onGet(req, res) {
        const id = req.params.id;
        const attachment = await relay.storage.get('attachments', id);
        const msgKey = (await relay.storage.keys('index-attachments-message',
                                                 new RegExp(`,${id}$`)))[0];
        if (!msgKey || !attachment) {
            res.status(404).send();
            return;
        }
        const message = await relay.storage.get('messages', msgKey.split(',')[0]);
        if (message && message.attachments) {
            for (const a of message.attachments) {
                if (a.id === id) {
                    res.attachment(a.name);
                    res.header('Content-Type', a.type);
                    break;
                }
            }
        }
        res.status(200).send(attachment);
    }
}

class AuthenticationAPIV1 extends APIHandler {

    constructor(options) {
        super(options);
        this.router.get('/status/v1', this.asyncRoute(this.onGetStatus, false));
        this.router.post('/login/v1', this.asyncRoute(this.onLogin, false));
        this.router.post('/password/v1', this.asyncRoute(this.onPost, false));
        this.router.put('/password/v1', this.asyncRoute(this.onPut));
    }

    async genToken() {
        let secret = await relay.storage.get('authentication', 'jwtsecret');
        if (!secret) {
            secret = uuidv4();
            await relay.storage.set('authentication', 'jwtsecret', secret);
        }
        return jwt.sign({}, secret, { algorithm: "HS512", expiresIn: 2*60*60 /* later: "2 days" */ });
    }

    async passwordHash(hash) {
        if (hash) {
            return await relay.storage.set('authentication', 'pwhash', hash);
        } else {
            return await relay.storage.get('authentication', 'pwhash');
        }
    }

    async onGetStatus(req, res) {
        console.log('getting status');
        const stashedHash = await this.passwordHash();
        if (stashedHash) {
            res.status(204).json({ });
        } else {
            res.status(404).json({error: 'not_configured'});
        }
    }

    async onLogin(req, res) {
        const password = req.body.password;
        const stashedHash = await this.passwordHash();
        if (!stashedHash || bcrypt.compareSync(password, stashedHash)) {
            // yes, if there is no stashed password hash, we give them a session
            const token = await this.genToken();
            res.status(200).json({ token });
        } else {
            res.status(401).json({ password: 'incorrect password' });
        }
    }

    async onPost(req, res) {
        const exists = !!await this.passwordHash();
        if (!exists) {
            const password = req.body.password;
            const hash = await bcrypt.hash(password, bcryptSaltRounds);
            this.passwordHash(hash);
            const token = await this.genToken();
            res.status(201).json({ token });
        } else {
            res.status(405).json({ password: 'already exists' });
        }
    }

    async onPut(req, res) {
        const exists = !!this.passwordHash();
        if (exists) {
            const password = req.body.password;
            const hash = await bcrypt.hash(password, bcryptSaltRounds);
            this.passwordHash(hash);
            const token = await this.genToken();
            res.status(201).json({ token });
        } else {
            res.status(405).json({ password: 'does not exist' });
        }
    }
}


module.exports = {
    OnboardAPIV1,
    MessagesAPIV1,
    AttachmentsAPIV1,
    AuthenticationAPIV1,
};
