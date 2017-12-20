<style>
</style>

<template>
<div>
    <div class="ui two column centered grid">
        <div class="middle aligned row">
            <div class="five wide column">
                <img class="ui small floated right image" src="/static/images/logo.png"/>
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
                <router-link :to="{name: 'authenticate', query: { forwardTo: '/onboard/tag' }}"
                            class="ui huge primary button">
                CONNECT <i class="right arrow icon"></i>
                </router-link>
            </div>
        </div>
    </div>

    <div class="ui divider horizontal">Benefits</div>
    <div class="ui left aligned text container">
        <ul>
            <li>All messages for your organization are sent to your vault via <b>end-to-end encryption</b>.</li>
            <li>It is trivial to <b>host your vault anywhere</b>: in your datacenter, on AWS, at Heroku, etc.</li>
            <li>This code is <b>100% open source</b> so you know how your information is being handled.</li>
        </ul>
    </div>
</div>
</template>

<script>
module.exports = {
    data: () => ({ 
        global: shared.state
    }),
    mounted: function() {
        const authDash = { name: 'authenticate', query: { forwardTo: '/dashboard' }};
        if (this.global.onboarded) {
            this.$router.push(authDash);
            return;
        }
        util.fetch.call(this, '/api/onboard/status/v1')
        .then(result => { 
            this.global.onboarded = result.ok;
            if (result.ok) {
                this.$router.push(authDash);
            }
        });
    }
}
</script>