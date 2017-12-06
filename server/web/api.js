const express = require('express');
const relay = require('librelay');


class VersionedHandler {
    constructor() {
        this.router = express.Router();
    }
}


class V1Handler extends VersionedHandler {

    constructor(server) {
        super();
        this.server = server;
        this.router.get('/auth', this.onAuthGet.bind(this));
        this.router.put('/auth/:tag', this.onAuthPut.bind(this));
        this.router.get('/messages', this.onMessagesGet.bind(this));
    }

    async onAuthGet(req, res, next) {
        const config = await relay.hub.getAtlasConfig();
        if (!config) {
            res.status(404).json({error: 'no_config'});
        } else {
            res.status(200).json(config);
        }
    }

    async onAuthPut(req, res) {
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

    async onMessagesGet(req, res) {
        res.status(200).json(await relay.storage.get('messages'));
    }
}

module.exports = {
    VersionedHandler,
    V1Handler
};
