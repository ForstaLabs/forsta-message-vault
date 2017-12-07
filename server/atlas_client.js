
const relay = require('librelay');


class VaultAtlasClient extends relay.AtlasClient {

    static async onboardVault(onboardingUserTag, code) {
        /* Complete onboarding of a vault user/token and signal account.  The tag and
         * code should be for an admin user in the org the vault is being added to. */
        const onboardAuth = await this.authValidate(onboardingUserTag, code);
        console.warn(`Vault onboarding initiated by: ${onboardingUserTag} <${onboardAuth.user.id}>`);
        await relay.storage.putState('onboardUser', onboardAuth.user.id);
        const onboardClient = new this({jwt: onboardAuth.token});
        const vaultUser = await onboardClient.fetch('/v1/user/', {
            method: 'POST',
            json: {
                "first_name": "Message",
                "last_name": "Vault",
                "gravatar_hash": '4f6bf2b1952eb7ba06f066e6a101341b',
                "user_type": 'BOT',
                "is_monitor": false // turn on once we are fully configured.,
            }
        });
        const ident = `@${vaultUser.tag.slug}:${vaultUser.org.slug} <${vaultUser.id}>`;
        console.info("Created vault user:", ident);
        const vaultToken = await onboardClient.fetch('/v1/authtoken/', {
            method: 'POST',
            json: {"user_id": vaultUser.id}
        });
        console.info("Created vault API token");
        await relay.storage.putState('vaultUser', vaultUser.id);
        await relay.storage.putState('vaultToken', vaultToken.token);
        return new this({userId: vaultUser.id, token: vaultToken.token});
    }

    static async factory() {
        const userId = await relay.storage.getState('vaultUser');
        const token = await relay.storage.getState('vaultToken');
        return new this({userId, token});
    }
}

module.exports = VaultAtlasClient;
