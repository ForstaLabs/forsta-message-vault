const express = require('express');
const relay = require('librelay');

const lineContext = () => new Error().stack.split(/\n/)[2].trim();

class VersionedHandler {
    constructor({requireAuth=true}) {
        this.router = express.Router();
        if (requireAuth) {
            /* XXX For Greg: insert auth middleware here maybe? */
            console.warn("IMPLEMENT ME: requireAuth", lineContext());
        }
    }
}


class RegistrationAPIV1 extends VersionedHandler {

    constructor(options) {
        super(options);
        this.router.get('/status/v1', this.onStatusGet.bind(this));
        this.router.get('/authcode/v1/:tag', this.onAuthCodeGet.bind(this));
        this.router.post('/authcode/v1/:tag', this.onAuthCodePost.bind(this));
    }

    async onStatusGet(req, res, next) {
        /* Registration status (local only, we don't check the remote server(s)) */
        const regid = await relay.storage.getOurRegistrationId();
        if (!regid) {
            res.status(404).json({error: 'no_config'});
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
        try {
            res.status(200).json(await relay.AtlasClient.authenticate(tag));
        } catch(e) {
            console.error('Atlas Request Error:', e);
            res.status(500).json(e);
            throw e;
        }
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
        try {
            res.status(200).json(await relay.AtlasClient.authValidate(tag, code));
        } catch(e) {
            console.error('Atlas Request Error:', e);
            res.status(500).json(e);
            throw e;
        }
    }
}

class MessagesAPIV1 extends VersionedHandler {

    constructor(options) {
        super(options);
        this.router.get('/v1', this.onGet.bind(this));
    }

    async onGet(req, res) {
        res.status(200).json(await relay.storage.get('messages'));
    }
}

module.exports = {
    RegistrationAPIV1,
    MessagesAPIV1
};
