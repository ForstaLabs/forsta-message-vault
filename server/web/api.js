const BotAtlasClient = require('../atlas_client');
const csvStringify = require('csv-stringify');
const express = require('express');
const relay = require('librelay');
const jwt = require('jsonwebtoken');
const uuidv4 = require('uuid/v4');


async function genToken(userId) {
    let secret = await relay.storage.get('authentication', 'jwtsecret');
    if (!secret) {
        secret = uuidv4();
        await relay.storage.set('authentication', 'jwtsecret', secret);
    }
    return jwt.sign({ userId }, secret, { algorithm: "HS512", expiresIn: 2*60*60 /* later maybe: "2 days" */ });
}

class APIHandler {

    constructor({server, requireAuth=true}) {
        this.server = server;
        this.router = express.Router();
    }

    asyncRoute(fn, requireAuth=true) {
        if (process.env.API_AUTH_OVERRIDE === 'insecure') requireAuth = false;

        /* Add error handling for async exceptions.  Otherwise the server just hangs
         * the request or subclasses have to do this by hand for each async routine. */
        return (req, res, next) => {
            if (requireAuth) {
                const header = req.get('Authorization');
                const parts = (header || '').split(' ');
                if (!header || parts.length !== 2 || parts[0].toLowerCase() !== 'jwt') {
                    console.log('missing authentication for this bot server request');
                    res.status(401).send({ message: 'forbidden' });
                } else {
                    relay.storage.get('authentication', 'jwtsecret')
                        .then((secret) => {
                            try {
                                const jwtInfo = jwt.verify(parts[1], secret);
                                fn.call(this, req, res, next, jwtInfo.userId).catch(e => {
                                    console.error('Async Route Error:', e);
                                    next();
                                });
                            } catch (err) {
                                console.log('bad authentication for this bot server request', err);
                                res.status(401).send({ message: 'forbidden' });
                            }
                        })
                        .catch(err => {
                            console.log('storage error while checking authentication for this bot server request', err);
                            res.status(401).send({ message: 'forbidden' });
                        });
                }
            } else {
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
        this.router.get('/authcode/v1/:tag', this.asyncRoute(this.onRequestAtlasLoginCode, false));
        this.router.post('/authcode/v1/:tag', this.asyncRoute(this.onCompleteAtlasLoginAndOnboard, false));
    }

    async onStatusGet(req, res, next) {
        const registered = await BotAtlasClient.onboardComplete();
        res.status(200).json({
            status: registered ? 'complete' : (BotAtlasClient.onboardingCreatedUser ? 'authenticate-admin' : 'authenticate-user')
        });
    }

    async onRequestAtlasLoginCode(req, res) {
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
        try {
            await BotAtlasClient.requestAuthenticationCode(tag);
        } catch (e) {
            res.status(e.code).json(e.json);
            return;
        }
        res.status(200).json({status: 'happy'});
        return;
    }

    async onCompleteAtlasLoginAndOnboard(req, res) {
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
        let onboarderClient;
        try {
            onboarderClient = await BotAtlasClient.authenticateViaCode(tag, code);
        } catch (e) {
            if (e.code == 429) {
                res.status(403).json({ "non_field_errors": ["Too many requests, please try again later."] });
            } else {
                res.status(e.code).json(e.json || {non_field_errors: ['Internal error, please try again.']});
            }
            return;
        }
        try {
            await BotAtlasClient.onboard(onboarderClient);
        } catch (e) {
            if (e.code === 403) {
                res.status(403).json({non_field_errors: ['Insufficient permission. Need to be an administrator?']});
            } else  {
                res.status(e.code || 500).json({non_field_errors: ['Internal error.']});
            }
            return;
        }
        await this.server.bot.start(); // it could not have been running without a successful onboard

        const token = await genToken(await relay.storage.getState("onboardUser"));
        res.status(200).json({ token });
    }
}

class AuthenticationAPIV1 extends APIHandler {

    constructor(options) {
        super(options);
        this.router.get('/login/v1/:tag', this.asyncRoute(this.onRequestLoginCode, false));
        this.router.post('/login/v1', this.asyncRoute(this.onCompleteLogin, false));
        this.router.get('/admins/v1', this.asyncRoute(this.onGetAdministrators));
        this.router.post('/admins/v1', this.asyncRoute(this.onUpdateAdministrators));
    }

    async onRequestLoginCode(req, res) {
        const tag = req.params.tag;
        if (!tag) {
            res.status(412).json({
                error: 'missing_arg',
                message: 'Missing URL param: tag'
            });
            return;
        }
        try {
            const id = await this.server.bot.sendAuthCode(tag);
            res.status(200).json({ id });
            return;
        } catch (e) {
            res.status(e.statusCode || 500).json(e.info || { message: 'internal error'});
            return;
        }
    }

    async onCompleteLogin(req, res) {
        const userId = req.body.id;
        const code = req.body.code;

        try {
            await this.server.bot.validateAuthCode(userId, code);
            const token = await genToken(userId);
            res.status(200).json({ token });
            return;
        } catch (e) {
            res.status(e.statusCode || 500).json(e.info || { message: 'internal error'});
            return;
        }
    }

    async onGetAdministrators(req, res) {
        try {
            const admins = await this.server.bot.getAdministrators();
            res.status(200).json({ administrators: admins });
            return;
        } catch (e) {
            console.log('problem in get administrators', e);
            res.status(e.statusCode || 500).json(e.info || { message: 'internal error'});
            return;
        }
    }

    async onUpdateAdministrators(req, res, next, userId) {
        const op = req.body.op;
        const id = req.body.id;
        const tag = req.body.tag;

        if (!(op === 'add' && tag || op === 'remove' && id)) {
            res.status(400).json({ non_field_errors: ['must either add tag or remove id'] });
        }

        try {
            const admins = (op === 'add')
                ? await this.server.bot.addAdministrator({addTag: tag, actorUserId: userId})
                : await this.server.bot.removeAdministrator({removeId: id, actorUserId: userId});
            res.status(200).json({ administrators: admins });
            return;
        } catch (e) {
            console.log('problem in update administrators', e);
            res.status(e.statusCode || 500).json(e.info || { message: 'internal error'});
            return;
        }
    }
}


module.exports = {
    APIHandler,
    OnboardAPIV1,
    AuthenticationAPIV1,
};
