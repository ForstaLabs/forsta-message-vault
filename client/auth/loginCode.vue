<style>
</style>

<template>
    <div class="ui main text container" style="margin-top: 80px;">
        <div class="ui container center aligned">
            <div class="ui basic segment huge">
                <h1 class="ui header">
                    <i class="circular sign in icon"></i>
                    Message Vault Login
                </h1>
            </div>
            <div class="ui centered grid">
                <div class="ui nine wide column basic segment left aligned t0 b1">
                    <form class="ui huge form enter-code" :class="{loading: loading}">
                        <div class="field">
                            <label>Login Code Words</label>
                            <div class="ui left icon input">
                                <input v-focus.lazy="true" type="text" name="code" placeholder="enter words" autocomplete="off" v-model='code'>
                                <i class="lock icon"></i>
                            </div>
                        </div>
                        <button class="ui large primary submit button right floated" type="submit">Submit</button>
                        <router-link :to="{name: 'loginTag'}" class="ui large button code-cancel">Cancel</router-link>
                        <div class="ui mini error message" />
                    </form>
                </div>
            </div>
            <div class="ui basic segment">
                <p>Please check your Forsta app for the login codewords you were just sent.</p>
            </div>
        </div>
    </div>
</template>

<script>
util = require('../util');
shared = require('../globalState');
focus = require('vue-focus');

function setup() {
    if (!this.global.userId) {
        this.$router.push({ name: 'loginTag', query: this.$route.query });
        return;
    }

    util.fetch.call(this, '/api/onboard/status/v1')
    .then(result => { 
        this.global.onboardStatus = result.theJson.status;
        if (this.global.onboardStatus !== 'complete') {
            this.$router.push({ name: 'welcome' });
        }
    });

    $('form.ui.form.enter-code').form({
        fields: {
            code: {
                identifier: 'code',
                rules: [{
                    type: 'empty',
                    prompt: 'please enter the codewords you were just sent'
                }]
            }
        },
        onSuccess: (event) => {
            event.preventDefault();
            tryAuthCode.call(this)
        }
    });
}

async function tryAuthCode() {
    var code = (this.code || '').toLowerCase().replace(/[^a-z ]/g, '').replace(/\s+/g, ' ').trim();
    this.code = code;
    this.loading = true;
    let result;
    try {
        result = await util.fetch.call(this, '/api/auth/login/v1', { method: 'post', body: { id: this.global.userId, code }})
    } catch (err) {
        console.error(err);
        return false;
    }
    this.loading = false;
    if (result.ok) {
        const { token } = result.theJson;
        this.global.apiToken = token;
        const forwardTo = this.$route.query.forwardTo;
        this.$router.replace(forwardTo || { name: 'welcome' });
        return false;
    } else {
        util.addFormErrors('enter-code', { code: util.mergeErrors(result.theJson) });
    }
    return false;
}

module.exports = {
    data: () => ({
        code: '',
        loading: false,
        global: shared.state
    }),
    mounted: function() {
        setup.call(this)
    },
    methods: {
    },
    directives: {
        focus: focus.focus
    }
}
</script>