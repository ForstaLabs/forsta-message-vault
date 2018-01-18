
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
                "user_type": 'BOT',
                "is_monitor": true,
            }
        });
        const ident = `@${vaultUser.tag.slug}:${vaultUser.org.slug} <${vaultUser.id}>`;
        console.info("Created vault user:", ident);
        const result = await onboardClient.fetch('/v1/userauthtoken/', {
            method: 'POST',
            json: {"userid": vaultUser.id}
        });
        console.info("Created UserAuthToken for vault user");
        await relay.storage.putState('vaultUser', vaultUser.id);
        await relay.storage.putState('vaultUserAuthToken', result.token);
        console.info("Authenticating vault user via UserAuthToken");
        const { url, jwt } = await this.authenticateViaToken(result.token);
        return new this({url, jwt});
    }

    static async factory() {
        const userAuthToken = await relay.storage.getState('vaultUserAuthToken');
        console.info("Authenticating vault user via UserAuthToken");
        const { url, jwt } = await this.authenticateViaToken(userAuthToken);
        return new this({url, jwt});
    }
}

module.exports = VaultAtlasClient;
