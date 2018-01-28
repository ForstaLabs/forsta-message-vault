Forsta Messaging Bot
========
Autonomous message receipt, processing, storage, and/or transmission on the Forsta messaging platform.

[![NPM](https://img.shields.io/npm/v/forsta-messaging-bot.svg)](https://www.npmjs.com/package/forsta-messaging-bot)
[![Change Log](https://img.shields.io/badge/change-log-blue.svg)](https://github.com/ForstaLabs/vault/blob/master/CHANGELOG.md)
[![License](https://img.shields.io/npm/l/forsta-messaging-bot.svg)](https://github.com/ForstaLabs/messaging-bot)


About
-------
This repository is a (skeleton) Node.js-based Forsta end-to-end-encrypted messaging client.
It allows for autonomous receipt, processing, storage, and/or transmission of messaging 
data to perform some useful task. Please fork it or one of our several projects based 
off of it!

A Forsta messaging bot can be set up to receive messages sent to a particular user, 
**or** (if you are an organization administrator) it can be set up as a special 
organization "monitor" which will receive copies of *all* messaging traffic to, from, 
or among users in your organization.

The "Why": Decentralized Data Security
--------

What is important to Forsta is that **your messaging data** is only accessible to messaging 
clients that **you are in control** of, whether the client is an app running on 
the phone in your pocket, or a bot that is running on a server in your
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
These deployment buttons can be used to validate that this messaging bot
will meet your organizations needs with as little setup pain as possible.  

[![Deploy](https://www.herokucdn.com/deploy/button.svg)](https://heroku.com/deploy?template=https://github.com/ForstaLabs/messaging-bot)
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
    docker run -p4096:4096 forstalabs/messaging-bot

Or to run a stack using docker-compose that includes redis for storage...

    docker-compose up

### NPM
    npm install -g forsta-messaging-bot
    messaging-bot


Developer Install
--------
If you want to build upon the Forsta Messaging Bot or just get closer to the code, 
you can install and run directly from the source code.

    git clone https://github.com/ForstaLabs/messaging-bot.git
    cd messaging-bot
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
* Copyright 2017-2018 Forsta Inc.
