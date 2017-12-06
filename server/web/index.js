const api = require('api');
const bodyParser = require('body-parser');
const express = require('express');
const morgan = require('morgan');
const path = require('path');
const process = require('process');

const root = `${__dirname}/../..`;
const port = process.env.PORT || '4096';


class WebServer {

    constructor() {
        this.port = port;
        this.app = express();
        this.app.use(morgan('dev')); // logging
        this.app.use(bodyParser.json());
        this.app.use('/v1/', (new api.V1Handler(this)).router);
        this.app.use('/static/', express.static(path.join(root, 'static'), {strict: true}));
        this.app.get('/*', (req, res) => res.sendFile('static/main.html', {root}));
        this.app.get('/install', (req, res) => res.sendFile('static/install.html', {root}));
        this.app.get('/env.js', (req, res) => {
            res.setHeader('Content-Type', 'application/javascript');
            res.send(`self.F = self.F || {}; F.env = ${JSON.stringify({})};\n`);
        });
        this.app.use((req, res, next) => {
            res.status(404).json({
                error: 'bad_request',
                message: 'not_found'
            });
        });
        this.app.use((error, req, res, next) => {
            res.status(500).json({
                error: 'server',
                message: error
            });
        });
    }

    async start() {
        this.app.listen(this.port, process.env.LISTEN_ADDR);
    }
}

module.exports = WebServer;
