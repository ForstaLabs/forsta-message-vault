Forsta Message Vault
========
This is a bot that performs secure autonomous monitoring of 
an entire organization's messaging traffic, storing all messages 
and useful metadata to support basic forensic investigation and export
via a web-based UI.

Integrity of all data and its appearance through time
is ensured via SHA256 fingerprints and Merkle-chains; proof of no regeneration
of fingerprints is ensured via external blockchain association 
(using opentimestamps.org).

This is a descendant of the [Forsta Messaging Bot](https://github.com/ForstaLabs/messaging-bot) 
codebase, which you can use for secure message receipt, processing, storage, and/or transmission 
on the Forsta messaging platform.

Please see the [CHANGELOG](https://github.com/ForstaLabs/message-vault/blob/master/CHANGELOG.md)
for the current set of features!

[![NPM](https://img.shields.io/npm/v/forsta-message-vault.svg)](https://www.npmjs.com/package/forsta-message-vault)
[![Change Log](https://img.shields.io/badge/change-log-blue.svg)](https://github.com/ForstaLabs/message-vault/blob/master/CHANGELOG.md)
[![License](https://img.shields.io/npm/l/forsta-message-vault.svg)](https://github.com/ForstaLabs/message-vault)


The Why &mdash; Decentralized Data Security
--------

What is important to Forsta is that **your messaging data** is only accessible to 
messaging clients that **you are in control** of, whether the client is an app 
running on the phone in your pocket, or a bot that is running on a server in your
datacenter or the compute cloud of your choice. 

Some organizations need to be able perform forensic e-discovery on past 
messages. Others may need to be able to automatically monitor for 
transmission of sensitive information. Or maybe they want something to 
automatically deliver sensitive information, or answer 
help-desk questions and handle after-hours inquires. Or individual users 
might want to be able to securely access their own message histories after 
buying a new phone and reinstalling their messaging client.

There are countless needs like these, and typically they are satisfied using 
**centrally-managed** infrastructure that can receive, store, process, and respond 
to messages as needed. Even systems that have pluggable architectures 
to facilitate outside development of these sorts of capabilities usually rely on a 
centralized approach. Unfortunately, the centralized approach provides a 
tempting, centralized target for outside 
attackers -- and it also requires users to trust that *insiders* won't abuse 
their access to all messages. Forsta is different.

Forsta does not offer anything that depends on centralized receipt, storage, or 
processing of users’ messaging data.  Instead, Forsta makes it trivial for 
*others* to run messaging “bots” to perform these functions. These bots are just 
another kind of messaging client, like the messaging clients running in users’ 
browsers and on their phones. And just like the other messaging clients, Forsta 
bots send and receive end-to-end encrypted messages to do their work **while 
running in a context controlled by the user**.


Quick Start
--------
These deployment buttons can be used to validate that this message vault
will meet your organizations needs with as little setup pain as possible.  

[![Deploy](https://www.herokucdn.com/deploy/button.svg)](https://heroku.com/deploy?template=https://github.com/ForstaLabs/message-vault)
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
To run a stack using docker-compose that includes postgres for storage, just get the [`docker-compose.yml`](./docker-compose.yml) file from the top level of this repository and

    docker-compose up

### NPM
    npm install -g forsta-message-vault
    message-vault


Developer Install
--------
If you want to extend the Forsta Message Vault or just get closer to the code, 
you can install and run directly from the source code:

    git clone https://github.com/ForstaLabs/message-vault.git
    cd message-vault
    make
    npm start

You will also need to have an instance of Postgres available. Before running
the server, be sure to set the following environment variables:

    RELAY_STORAGE_BACKING=postgres
    DATABASE_URL=postgres://postgres@localhost/postgres

(That database URL is for the default docker postgres you'll get if you do a `make docker-db-run`.)

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
supports local filesystem, Redis, and Postgresql.  For more information about setting
up custom storage see: https://github.com/ForstaLabs/librelay-node#storage.


License
--------
Licensed under the GPLv3: http://www.gnu.org/licenses/gpl-3.0.html

* Copyright 2015-2016 Open Whisper Systems
* Copyright 2017-2018 Forsta Inc.
