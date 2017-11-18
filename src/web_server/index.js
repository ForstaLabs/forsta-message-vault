// Superman API for bridging communications through signal protocol.

const bodyParser = require('body-parser');
const express = require('express');
const morgan = require('morgan');
const path = require('path');
const process = require('process');
const relay = require('librelay');
const uuid4 = require('uuid/v4');

const root = `${__dirname}/../..`;
const port = process.env.PORT || '4096';


class WebServer {

    constructor() {
        this.port = port;
        this.app = express();
        this.app.use(morgan('dev')); // logging
        this.app.use(bodyParser.json());
        this.app.use('/v1/', (new V1Handler(this)).router);
        this.app.use('/static/', express.static(path.join(root, 'static'), {strict: true}));
        this.app.get('/', (req, res) => res.sendFile('static/index.html', {root}));
        this.app.get('/env.js', (req, res) => {
            res.setHeader('Content-Type', 'application/javascript');
            res.send(`self.F = self.F || {}; F.env = ${JSON.stringify({
                AUTH_TAG: process.env.AUTH_TAG
            })};\n`);
        });
    }

    async start() {
        this.app.listen(this.port);
    }
}


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

    async onAuthGet(req, res) {
        res.status(200).json(await relay.hub.getAtlasConfig());
    }

    async onAuthPut(req, res) {
        const tag = req.params.tag;
        //const uuid = req.body.uuid;
        //const key = req.body.key;
        if (!addr) {
            res.status(400).json({error: 'Missing URL param: tag'});
            return;
        }
        res.status(200).json({});
    }

    async onMessagesGet(req, res) {
        res.status(200).json(await relay.storage.get('messages'));
    }
}

module.exports = WebServer;
