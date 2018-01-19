
const relay = require('librelay');


class BotAtlasClient extends relay.AtlasClient {

    static async requestAuthenticationCode(tag, options) {
        return this.authenticate(tag, options); // todo: just rename this in AtlasClient
    }
    static async authenticateViaCode(tag, code, options) {
        return this.authValidate(tag, code, options); // todo: just rename this in AtlasClient
    }

    static async onboard(onboarderAuth, createBotUser) {
        let botUser = onboarderAuth.user;
        const creator = `@${botUser.tag.slug}:${botUser.org.slug}`;
        console.info(`Bot onboarding performed by: ${creator}`);
        await relay.storage.putState('onboardUser', botUser.id);
        const onboardClient = new this({jwt: onboarderAuth.token});
        if (createBotUser) {
            botUser = await onboardClient.fetch('/v1/user/', {
                method: 'POST',
                json: Object.assign({}, createBotUser, {user_type: 'BOT'})
            });
            console.info(`Created new ${botUser.is_monitor ? 'MONITOR' : ''} bot user @${botUser.tag.slug}:${botUser.org.slug} <${botUser.id}>`);
        }
        const result = await onboardClient.fetch('/v1/userauthtoken/', {
            method: 'POST',
            json: {"userid": botUser.id}
        });
        console.info(`Created UserAuthToken for bot user @${botUser.tag.slug}:${botUser.org.slug}`);
        await relay.storage.putState('botUser', botUser.id);
        await relay.storage.putState('botUserAuthToken', result.token);

        const atlasClient = await this.factory();

        await relay.registerAccount({
            name: `Bot (created by ${creator})`,
            atlasClient: atlasClient
        });

        return atlasClient;
    }

    static async onboardComplete() {
        return !!await relay.storage.getState('addr');
    }

    static async factory() {
        const userAuthToken = await relay.storage.getState('botUserAuthToken');
        const { url, jwt } = await this.authenticateViaToken(userAuthToken);
        const that = new this({url, jwt});
        that.maintainJWT(false, this.authenticateViaToken.bind(this, userAuthToken));
        return that;
    }
}

module.exports = BotAtlasClient;
