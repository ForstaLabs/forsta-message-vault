Forsta Messaging Vault
========
Safe data retention service for the Forsta messaging platform.


Quick Start
--------
Forsta vault is a Node.js application but it is designed to be easily
deployable in any environment that supports Docker too.  If you want to test
the vault in a heroku we have an App button for that too.

### Heroku Deploy _(requires a Heroku account)_
[![Deploy](https://www.herokucdn.com/deploy/button.svg)](https://heroku.com/deploy?template=https://github.com/ForstaLabs/vault)

### Docker Cloud Deploy _(requires a Docker Cloud account)_
[![Deploy to Docker Cloud](https://files.cloud.docker.com/images/deploy-to-dockercloud.svg)](https://cloud.docker.com/stack/deploy/)

### Docker Locally
    docker run -p4096:4096 forstalabs/vault


Expert Installation
--------
If you want to install and run vault by hand you can install on *NIX platform
that has Node.js version 8 or newer installed, and ruby and the sass gem.

    git clone https://github.com/ForstaLabs/vault.git
    cd vault
    npm install
    npm start


Usage
--------
Once running the default port and listening address are `0.0.0.0:4096` so if you are
running locally you can access the web interface by opening *http://localhost:4096*.

You can change the listening address by setting `LISTEN_ADDR` to a valid host address
for your server, E.g. something like `localhost` or `127.0.0.1` to only accept local
connections.

The default listening port can be changed by setting `PORT` to any valid numeric
port, e.g. `8000`.

License
--------
Licensed under the GPLv3: http://www.gnu.org/licenses/gpl-3.0.html

* Copyright 2015-2016 Open Whisper Systems
* Copyright 2017 Forsta Inc.
