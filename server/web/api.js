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
        this.router.get('/v1', this.onGet.bind(this));
        this.router.put('/v1/:tag', this.onPut.bind(this));
    }

    async onGet(req, res, next) {
        /* Registration status (local only, we don't check the remote server(s)) */
        const regid = await relay.storage.getOurRegistrationId();
        if (!regid) {
            res.status(404).json({error: 'no_config'});
        } else {
            res.status(204).send();
        }
    }

    async onPut(req, res) {
        const tag = req.params.tag;
        if (!tag) {
            res.status(412).json({
                error: 'missing_arg',
                message: 'Missing URL param: tag'
            });
            return;
        }
        res.status(200).json({});
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
