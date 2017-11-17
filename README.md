Forsta Messaging Vault
========
Safe data retention service for the Forsta messaging platform.


Usage
--------
Forsta vault is a Node.js application but it is designed to be easily
deployable in any environment that supports Docker.  Better yet there
are fast installation options for Heroku and AWS.

### Heroku Deploy
[![Deploy](https://www.herokucdn.com/deploy/button.svg)](https://heroku.com/deploy?template=https://github.com/ForstaLabs/vault&env[AUTH_TAG]=@username:organization)

### Amazon EC2 Machine Image (us-west-2)
Coming soon!


Installation
--------
If you want to install and run vault by hand you can install on *NIX platform
that has Node.js version 8 or newer installed.

    git clone https://github.com/ForstaLabs/vault.git
    cd vault
    npm install
    npm start
