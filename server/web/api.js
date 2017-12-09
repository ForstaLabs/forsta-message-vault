const VaultAtlasClient = require('../atlas_client');
const csvStringify = require('csv-stringify');
const express = require('express');
const relay = require('librelay');

const lineContext = () => new Error().stack.split(/\n/)[2].trim();


class APIHandler {

    constructor({server, requireAuth=true}) {
        this.server = server;
        this.router = express.Router();
        if (requireAuth) {
            /* XXX For Greg: insert auth middleware here maybe? */
            console.warn("IMPLEMENT ME: requireAuth", lineContext());
        }
    }

    asyncRoute(fn) {
        /* Add error handling for async exceptions.  Otherwise the server just hangs
         * the request or subclasses have to do this by hand for each async routine. */
        return (req, res, next) => fn.call(this, req, res, next).catch(e => {
            console.error('Async Route Error:', e);
            next();
        });
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
        this.router.get('/status/v1', this.asyncRoute(this.onStatusGet));
        this.router.get('/authcode/v1/:tag', this.asyncRoute(this.onAuthCodeGet));
        this.router.post('/authcode/v1/:tag', this.asyncRoute(this.onAuthCodePost));
    }

    async onStatusGet(req, res, next) {
        /* Registration status (local only, we don't check the remote server(s)) */
        const registered = !!await relay.storage.getState('vaultToken');
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
            [x => x.sendTime, 'Sent'],
            [x => x.messageId, 'Message ID'],
            [x => x.threadId, 'Thread ID'],
            [x => x.sender.userId, 'Sender'],
            [this.msgBodyGetter('text/plain'), 'Message Body'],
            [x => x.threadType, 'Thread Type'],
            [x => x.messageType, 'Message Type'],
            [x => x.distribution.expression, 'Distribution'],
        ];
    }

    msgBodyGetter(type) {
        return msg => {
            if (!msg.data || !msg.data.body) {
                return;
            }
            for (const body of msg.data.body) {
                if (body.type === type) {
                    return body.value;
                }
            }
        };
    }

    async onGet(req, res) {
        const keys = await relay.storage.keys('messages');
        keys.sort();
        const messages = await Promise.all(keys.map(x => relay.storage.get('messages', x)));
        if (req.accepts('json')) {
            res.status(200).json({
                meta: {
                    total_count: messages.length,
                    limit: null,
                    offset: 0
                },
                data: messages
            });
        } else if (req.accepts('csv')) {
            const buf = [this.csvFields.map(x => x[1])];
            for (const msg of messages) {
                buf.push(this.csvFields.map(x => x[0](msg)));
            }
            res.attachment(`messages-${Date.now()}.csv`);
            res.status(200).send(await this.toCSV(buf));
        } else {
            res.status(400).send('Unsupported "Accept" header');
        }
    }
}

module.exports = {
    OnboardAPIV1,
    MessagesAPIV1
};
