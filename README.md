Forsta Vault
========
Decentralized data retention application for the Forsta messaging platform.

[![NPM](https://img.shields.io/npm/v/forsta-vault.svg)](https://www.npmjs.com/package/forsta-vault)
[![Change Log](https://img.shields.io/badge/change-log-blue.svg)](https://github.com/ForstaLabs/vault/blob/master/CHANGELOG.md)
[![License](https://img.shields.io/npm/l/forsta-vault.svg)](https://github.com/ForstaLabs/vault)


About
--------
Forsta Vault is a Node.js application that leverages end-to-end encryption
for collection of your organization's messages and data.  Your data lives with
the provider of your choice, be it a cloud provider or a server inside your own
data center.

**Your data lives where it belongs - with you.**


Quick Start
--------
These deployment buttons can be used to validate that Forsta Vault will
meet your organizations needs with as little setup pain as possible.  For some
organizations they may also be perfectly sufficient for your data retention
needs.

[![Deploy](https://www.herokucdn.com/deploy/button.svg)](https://heroku.com/deploy?template=https://github.com/ForstaLabs/vault)
[![Deploy to Docker Cloud](https://files.cloud.docker.com/images/deploy-to-dockercloud.svg)](https://cloud.docker.com/stack/deploy/)


Install Requirements
--------
 * Node.js 8 (or newer)
 * Ruby
   * sass (`gem install sass`)
   

Installation
--------
You can choose from our official docker image or NPM package depending on your
preference.

### Docker
    docker run -p4096:4096 forstalabs/vault

Or to run a stack using docker-compose that includes redis for storage...

    docker-compose up

### NPM
    npm install -g forsta-vault
    vault


Developer Install
--------
If you want to build upon Vault or just get closer to the code you can install
and run directly from the source code.

    git clone https://github.com/ForstaLabs/vault.git
    cd vault
    npm install
    npm start


Usage
--------
Once running, the default port and listening address are `0.0.0.0:4096`.  If
you are running locally you can access the web interface by opening
*http://localhost:4096*.

You can change the listening address by setting `LISTEN_ADDR` to a valid host
address for your server, E.g. something like `localhost` or `127.0.0.1` to only
accept local connections.

The default listening port can be changed by setting `PORT` to any valid
numeric port, e.g. `8000`.

Storage is managed through Forsta
[librelay](https://github.com/ForstaLabs/librelay-node) which currently
supports local filesystem and Redis.  For more information about setting
up custom storage see: https://github.com/ForstaLabs/librelay-node#storage.


License
--------
Licensed under the GPLv3: http://www.gnu.org/licenses/gpl-3.0.html

* Copyright 2015-2016 Open Whisper Systems
* Copyright 2017 Forsta Inc.
