
const relay = require('librelay');

class BotAtlasClient extends relay.AtlasClient {
    static async onboard(onboarderAuth, createBotUser) {
        let botUser = onboarderAuth.user;
        const creator = `@${botUser.tag.slug}:${botUser.org.slug}`;
        console.info(`Bot onboarding performed by: ${creator}`);
        await relay.storage.putState('onboardUser', botUser.id);
        const onboardClient = new this({jwt: onboarderAuth.token});
        if (createBotUser) {
            try {
                botUser = await onboardClient.fetch('/v1/user/', {
                    method: 'POST',
                    json: Object.assign({}, createBotUser, { user_type: 'BOT' })
                });
                console.info(`Created new ${botUser.is_monitor ? 'MONITOR' : ''} bot user @${botUser.tag.slug}:${botUser.org.slug} <${botUser.id}>`);
            } catch (e) {
                console.error('got error during creation of bot user', e);
                throw e;
            }
        }
        const result = await onboardClient.fetch('/v1/userauthtoken/', {
            method: 'POST',
            json: {"userid": botUser.id}
        });
        console.log('userauthtoken creation got result of', result);
        console.info(`Created UserAuthToken for bot user @${botUser.tag.slug}:${botUser.org.slug}`);
        await relay.storage.putState('botUser', botUser.id);
        await relay.storage.putState('botUserAuthToken', result.token);

        const atlasClient = await this.factory();

        try {
            const something = await relay.registerDevice({
                name: `Bot (created by ${creator})`,
                atlasClient: atlasClient
            });
            await something.done;
            console.log('happy with registerDevice');
        } catch (e) {
            console.log('got error on registerDevice', e);
            console.log('proceeding with registerAccount');
            try {
                await relay.registerAccount({
                    name: `Bot (created by ${creator})`,
                    atlasClient: atlasClient
                });
                console.log('happy with registerAccount');
            } catch (e) {
                console.log('got an error in registerAccount', e);
                throw e;
            }
        }
        console.log('happy');

        console.log('returning atlasClient from onboard', atlasClient);
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
