<style>
</style>

<template>
    <div class="ui main text container" style="margin-top: 80px;">
        <div class="ui two column centered grid">
            <div class="middle aligned row">
                <div class="five wide column">
                    <img class="ui small floated right image" src="/static/images/forsta-logo.svg"/>
                </div>
                <div class="eleven wide column">
                    <h1 class="ui header">Forsta Message Vault
                        <div class="sub header">Secure data retention. Under your control.</div>
                    </h1>
                </div>
            </div>
        </div>
        <br />
        <div class="ui two column centered grid">
            <div class="middle aligned row">
                <div class="five wide column centered">
                    <router-link :to="{name: 'onboardTag'}"
                                class="ui huge primary button">
                    CONNECT <i class="right arrow icon"></i>
                    </router-link>
                </div>
            </div>
        </div>

        <div class="ui divider horizontal">Benefits</div>
        <div class="ui left aligned text container">
            <ul>
                <li>All messages are sent to and from this message bot via <b>end-to-end encryption</b>.</li>
                <li>It is trivial to <b>host this bot anywhere</b>: in your datacenter, on AWS, at Heroku, etc.</li>
                <li>This code is <b>100% open source</b> so you know how your information is being handled.</li>
            </ul>
        </div>
    </div>
</template>

<script>
const util = require('../util');
shared = require('../globalState');

module.exports = {
    data: () => ({ 
        global: shared.state
    }),
    mounted: function() {
        const authDash = { name: 'loginTag', query: { forwardTo: '/dashboard' }};
        if (this.global.onboardStatus === 'complete') {
            this.$router.push(authDash);
            return;
        }
        util.fetch.call(this, '/api/onboard/status/v1')
        .then(result => { 
            this.global.onboardStatus = result.theJson.status;
            if (this.global.onboardStatus === 'complete') {
                this.$router.push(authDash);
            }
        });
    }
}
</script>