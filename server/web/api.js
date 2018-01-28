const BotAtlasClient = require('../atlas_client');
const csvStringify = require('csv-stringify');
const express = require('express');
const relay = require('librelay');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcrypt');
const uuidv4 = require('uuid/v4');

const bcryptSaltRounds = 12;


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
    AuthenticationAPIV1,
};
