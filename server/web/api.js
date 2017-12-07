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

    asyncRoute(fn) {
        /* Add error handling for async exceptions.  Otherwise the server just hangs
         * the request or subclasses have to do this by hand for each async routine. */
        return (req, res, next) => fn.call(this, req, res, next).catch(e => {
            console.error('Async Route Error:', e);
            next();
        });
    }
}


class RegistrationAPIV1 extends VersionedHandler {

    constructor(options) {
        super(options);
        this.router.get('/status/v1', this.asyncRoute(this.onStatusGet));
        this.router.get('/authcode/v1/:tag', this.asyncRoute(this.onAuthCodeGet));
        this.router.post('/authcode/v1/:tag', this.asyncRoute(this.onAuthCodePost));
    }

    async onStatusGet(req, res, next) {
        /* Registration status (local only, we don't check the remote server(s)) */
        const registered = !!await relay.storage.getState('atlasToken');
        if (!registered) {
            res.status(404).json({error: 'not_registered'});
        } else {
            res.status(204).send();
        }
    }

    async onAuthCodeGet(req, res) {
        /* Request authcode for an Atlas admin user.  This request should be followed
         * by an API call to the sibling POST method using a payload of the SMS auth
         * code sent to the user's SMS device. */
        const tag = req.params.tag;
        if (!tag) {
            res.status(412).json({
                error: 'missing_arg',
                message: 'Missing URL param: tag'
            });
            return;
        }
        res.status(200).json(await relay.AtlasClient.authenticate(tag));
    }

    async onAuthCodePost(req, res) {
        /* Complete registration using the SMS auth code that the user should have received
         * following a call to `onAuthCodeGet`. */
        const tag = req.params.tag;
        if (!tag) {
            res.status(412).json({
                error: 'missing_arg',
                message: 'Missing URL param: tag'
            });
            return;
        }
        const code = req.body.code;
        if (!code) {
            res.status(412).json({
                error: 'missing_arg',
                message: 'Missing payload param: code'
            });
            return;
        }
        const {user: regUser, token: regToken} = await relay.AtlasClient.authValidate(tag, code);
        const regAtlas = new relay.AtlasClient({jwt: regToken});
        const vaultUser = await regAtlas.fetch('/v1/user/', {
            method: 'POST',
            json: {
                "first_name": "Vault",
                "last_name": `(${regUser.org.slug})`,
                "email": regUser.email,
                "phone": regUser.phone,
                "user_type": 'BOT',
                "is_monitor": true // XXX Once we can do the PATCH below make this false.
            }
        });
        const vaultToken = await regAtlas.fetch('/v1/provision/token', {
            method: 'POST',
            json: {"user_id": vaultUser.id}
        });
        await relay.storage.putState('vaultUserId', vaultUser.id);
        await relay.storage.putState('vaultToken', vaultToken.token);
        const vaultAtlas = new relay.AtlasClient({token: vaultToken.token, userId: vaultUser.id});
        await relay.registerAccount({
            name: `Vault (${vaultUser.tag.slug})`,
            atlasClient: vaultAtlas
        });
        // XXX Doesn't work just yet.  Atlas token auth handling is work-in-progress.
        //await vaultAtlas.fetch(`/v1/user/${vaultUser.id}/`, {
        //    method: 'PATCH',
        //    json: {is_monitor: true}
        //});
        res.status(204).send();
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
