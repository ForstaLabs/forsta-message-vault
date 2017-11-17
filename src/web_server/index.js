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
        this.router.post('/provision/request/:addr', this.onProvisionRequest.bind(this));
    }

    async onProvisionRequest(req, res) {
        const addr = req.params.addr;
        const uuid = req.body.uuid;
        const key = req.body.key;
        if (!addr) {
            res.status(400).json({error: 'Invalid URL param: addr'});
            return;
        }
        if (!uuid) {
            res.status(400).json({error: 'Missing required field: uuid'});
            return;
        }
        if (!key) {
            res.status(400).json({error: 'Missing required field: key'});
            return;
        }
        console.info("Sending provisioning request to:", addr);
        try {
            const msgBus = await this.server.msgSender.sendMessageToAddrs([addr], [{
                version: 1,
                userAgent: 'superman',
                messageType: 'control',
                messageId: uuid4(),
                sender: {
                    userId: await relay.storage.getState('addr')
                },
                data: {
                    control: 'provisionRequest',
                    uuid,
                    key
                }
            }], null, Date.now());
            let done = false;
            msgBus.on('error', ev => {
                console.error('Provision send error', ev);
                if (!done) {
                    done = true;
                    res.status(400).json(ev);
                }
            });
            msgBus.on('sent', ev => {
                if (!done) {
                    done = true;
                    res.status(200).json(ev);
                }
            });
        } catch(e) {
            console.error('Provision error:', e);
            res.status(500).json({error: e.toString()});
        }
    }
}

module.exports = WebServer;
