const relay = require("librelay");

class BotAtlasClient extends relay.AtlasClient {

    static get onboardingCreatedUser() {
        return {
            first_name: "Message",
            last_name: "Vault",
            is_monitor: true
        };
    }

    static get userAuthTokenDescription() {
        return 'message vault bot';
    }

    static async onboard(onboardClient) {
        let botUser = await onboardClient.fetch(
            "/v1/user/" + onboardClient.userId + "/"
        );
        const creator = `@${botUser.tag.slug}:${botUser.org.slug}`;
        console.info(`Bot onboarding performed by: ${creator}`);
        await relay.storage.set('authentication', 'adminIds', [botUser.id]);
        await relay.storage.putState("onboardUser", botUser.id);
        if (this.onboardingCreatedUser) {
            try {
                botUser = await onboardClient.fetch("/v1/user/", {
                    method: "POST",
                    json: Object.assign({}, this.onboardingCreatedUser, { user_type: "BOT" })
                });
                console.info(
                    `Created new ${botUser.is_monitor ? "MONITOR" : ""} bot user @${
                    botUser.tag.slug
                    }:${botUser.org.slug} <${botUser.id}>`
                );
            } catch (e) {
                console.error("error during creation of bot user", e);
                throw e;
            }
        }
        const result = await onboardClient.fetch("/v1/userauthtoken/", {
            method: "POST",
            json: { userid: botUser.id, description: this.userAuthTokenDescription }
        });
        console.info(
            `Created UserAuthToken for bot user @${botUser.tag.slug}:${
            botUser.org.slug
            }`
        );
        await relay.storage.putState("botUser", botUser.id);
        await relay.storage.putState("botUserAuthToken", result.token);

        const atlasClient = await this.factory();

        try {
            console.log('trying to registerDevice');
            const something = await relay.registerDevice({
                name: `Bot (created by ${creator})`,
                atlasClient: atlasClient
            });
            await something.done();
            console.log("registerDevice success");
        } catch (e) {
            console.log("registerDevice didn't work out, trying registerAccount instead");
            await relay.registerAccount({
                name: `Bot (created by ${creator})`,
                atlasClient: atlasClient
            });
            console.log("registerAccount success");
        }

        return atlasClient;
    }

    static async onboardComplete() {
        return !!await relay.storage.getState("addr");
    }

    static async factory() {
        const userAuthToken = await relay.storage.getState("botUserAuthToken");
        const client = await this.authenticateViaToken(userAuthToken);
        client.maintainJWT(
            false,
            this.authenticateViaToken.bind(this, userAuthToken)
        );
        return client;
    }
}

module.exports = BotAtlasClient;
