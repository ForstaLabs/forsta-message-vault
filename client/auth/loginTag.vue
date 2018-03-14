<style>
</style>

<template>
    <div class="ui main text container" style="margin-top: 80px;">
        <div class="ui container center aligned">
            <div class="ui basic segment huge">
                <h1 class="ui header">
                    <i class="circular icon user"></i>
                    Message Vault Login
                </h1>
            </div>
            <div class="ui centered grid">
                <div class="ui nine wide column basic segment left aligned t0 b1">
                    <form class="ui huge form enter-tag" :class="{loading: loading}">
                        <div class="field">
                            <label>Authorized User</label>
                            <div class="ui left icon input">
                                <input v-focus.lazy="true" type="text" v-model='tag' name="tag" placeholder="user:org" autocomplete="off">
                                <i class="at icon"></i>
                            </div>
                        </div>
                        <button class="ui large primary submit button right floated" type="submit">Submit</button>
                        <div class="ui mini error message" />
                    </form>
                </div>
            </div>
            <div class="ui basic segment">
                <p>Please enter your Forsta address tag to receive login codewords for this site.</p>
            </div>
        </div>
    </div>
</template>

<script>
util = require('../util');
focus = require('vue-focus');
shared = require('../globalState');
jwtDecode = require('jwt-decode');

function setup() {
    const apiToken = this.global.apiToken;
    const forwardTo = this.$route.query.forwardTo;
    if (apiToken) {
        const decoded = jwtDecode(apiToken);
        const expires = new Date(decoded.exp * 1000);
        const now = new Date();

        if (now < expires) {
            this.$router.replace(forwardTo ? forwardTo : { name: 'welcome' });
            return;
        }
    }

    util.fetch.call(this, '/api/onboard/status/v1')
    .then(result => { 
        this.global.onboardStatus = result.theJson.status;
        if (this.global.onboardStatus !== 'complete') {
            this.$router.push({ name: 'welcome' });
        }
    });

    this.tag = this.global.loginTag;

    $('form.ui.form.enter-tag').form({
        fields: {
            tag: {
                identifier: 'tag',
                rules: [{
                    type: 'regExp',
                    value: /^([\da-z_]([.][\da-z_]|[\da-z_])*)(:([\da-z_]([.]+[\da-z_]|[\da-z_])*))?$/,
                    prompt: 'please enter full @your.name:your.org'
                }]
            }
        },
        onSuccess: (event) => {
            event.preventDefault();
            requestAuth.call(this)
        }
    });
}

function requestAuth() {
    var tag = this.tag;
    this.loading = true;
    util.fetch.call(this, '/api/auth/login/v1/' + tag)
    .then(result => {
        this.loading = false;
        if (result.ok) {
            const { id } = result.theJson;
            this.global.userId = id;
            this.global.loginTag = tag;
            this.$router.push({ name: 'loginCode', query: this.$route.query });
            return false;
        } else {
            util.addFormErrors('enter-tag', { tag: util.mergeErrors(result.theJson) });
            return false;
        }
    })
    .catch(err => {
        console.log('got an err in requestAuth', err);
        this.loading = false;
    });
    return false;
}

module.exports = {
    data: () => ({
        global: shared.state,
        tag: '',
        loading: false
    }),
    computed: {
    },
    mounted: function () {
        setup.call(this)
    },
    methods: {
    },
    directives: {
        focus: focus.focus
    }
}
</script>