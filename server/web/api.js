const BotAtlasClient = require('../atlas_client');
const csvStringify = require('csv-stringify');
const express = require('express');
const relay = require('librelay');
const jwt = require('jsonwebtoken');
const uuidv4 = require('uuid/v4');


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
                    console.log('missing authentication for this bot server request');
                    res.status(401).send({ message: 'forbidden' });
                } else {
                    relay.storage.get('authentication', 'jwtsecret')
                        .then((secret) => {
                            try {
                                jwt.verify(parts[1], secret);
                                fn.call(this, req, res, next).catch(e => {
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
        this.router.get('/authcode/v1/:tag', this.asyncRoute(this.onAuthCodeGet));
        this.router.post('/authcode/v1/:tag', this.asyncRoute(this.onAuthCodePost));
    }

    async onStatusGet(req, res, next) {
        const registered = await BotAtlasClient.onboardComplete();
        res.status(200).json({
            status: registered ? 'complete' : (BotAtlasClient.onboardingCreatedUser ? 'authenticate-admin' : 'authenticate-user')
        });
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
        try {
            await BotAtlasClient.requestAuthenticationCode(tag);
        } catch (e) {
            res.status(e.code).json(e.response.theJson);
            return;
        }
        res.status(200).json({status: 'happy'});
        return;
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
        res.status(204).send();
    }
}

class AuthenticationAPIV1 extends APIHandler {

    constructor(options) {
        super(options);
        this.router.get('/login/v1/:tag', this.asyncRoute(this.onRequestLoginCode, false));
        this.router.post('/login/v1', this.asyncRoute(this.onValidateLoginCode, false));
        // this.router.get('/admins/v1', this.asyncRoute(this.onGetAdministrators));
        // this.router.put('/admins/v1', this.asyncRoute(this.onPutAdministrators));
    }

    async genToken() {
        let secret = await relay.storage.get('authentication', 'jwtsecret');
        if (!secret) {
            secret = uuidv4();
            await relay.storage.set('authentication', 'jwtsecret', secret);
        }
        return jwt.sign({}, secret, { algorithm: "HS512", expiresIn: 2*60*60 /* later: "2 days" */ });
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
        } catch (e) {
            res.status(e.statusCode).json(e.info);
            return;
        }
        return;
    }

    async onValidateLoginCode(req, res) {
        const userId = req.body.id;
        const code = req.body.code;

        try {
            await this.server.bot.validateAuthCode(userId, code);
            const token = await this.genToken();
            res.status(200).json({ token });
        } catch (e) {
            res.status(e.statusCode).json(e.info);
            return;
        }
    }
}


module.exports = {
    APIHandler,
    OnboardAPIV1,
    AuthenticationAPIV1,
};
