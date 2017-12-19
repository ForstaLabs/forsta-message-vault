
<template>
<div>
    <div v-show="!global.passwordSet" class="ui container center aligned padded">
        <div class="ui two column centered grid">
            <div class="middle aligned row">
                <div class="four wide column">
                    <img class="ui tiny floated right image" src="/static/images/logo.png"/>
                </div>
                <div class="eleven wide column">
                    <h1 class="ui header">Secure Your Vault?</h1>
                </div>
            </div>
        </div>
        <div class="ui basic segment huge">
            We recommend setting a strong password <br />
            if this website will ever be visible to others.
        </div>
        <div class="ui two column centered grid">
            <div class="middle aligned row">
                <div class="twelve wide column middle aligned">
                    <router-link :to="gotoSetPassword" class="ui huge primary submit button">Set Vault Password</router-link>
                    <button @click="establishSession" class="ui huge submit button">Not Now</button>
                </div>
            </div>
        </div>
    </div>
    <div v-show="global.passwordSet" class="ui basic segment center aligned">
        <div class="ui two column centered grid">
            <div class="middle aligned row">
                <div class="four wide column">
                    <img class="ui tiny floated right image" src="/static/images/logo.png"/>
                </div>
                <div class="eleven wide column">
                    <h1 class="ui header">Verify Vault Access</h1>
                </div>
            </div>
        </div>
        <div class="ui centered grid">
            <div class="ui ten wide column left aligned t0">
                <form class="ui huge form authenticate" :class="{loading: loading}">
                    <div class="field">
                        <label>Vault Password</label>
                        <div class="ui left icon input">
                            <input v-focus.lazy="true" type="password" v-model='password' name="password" placeholder="enter password" autocomplete="off">
                            <i class="lock icon" />
                        </div>
                    </div>
                    <button class="ui large primary submit button" type="submit">Submit</button>
                    <div class="ui mini error message" />
                </form>
            </div>
        </div>
    </div>
</div>
</template>

<script>
util = require('../util');
shared = require('../globalState');
focus = require('vue-focus');
var jwtDecode = require('jwt-decode');

function init() {
    const apiToken = this.global.apiToken;
    const forwardTo = this.$route.query.forwardTo;
    if (apiToken && forwardTo) {
        const decoded = jwtDecode(apiToken);
        const expires = new Date(decoded.exp * 1000);
        const now = new Date();

        if (now < expires) {
            this.$router.replace(forwardTo);
            return;
        }
    }

    // ensure that global.passwordSet is up-to-date
    util.fetch.call(this, '/api/auth/status/v1')
    .then(result => { this.global.passwordSet = result.ok; });

    $('form.ui.form.authenticate').form({
        on: 'blur',
        fields: {
            password: {
                identifier: 'password',
                rules: [
                    {
                        type   : 'empty',
                        prompt : 'Please enter a password'
                    }
                ]
            }
        },
        onSuccess: (event) => {
            event.preventDefault();
            tryPassword.call(this)
        }
    });
}

async function tryPassword() {
    var password = this.password;
    this.loading = true;
    let result;
    try {
        result = await util.fetch.call(this, '/api/auth/login/v1/', { method: 'post', body: { password }});
    } catch (err) {
        console.error(err);
        return false;
    }
    this.loading = false;
    if (result.ok) {
        result.json().then(data => {
            const { token } = data;
            this.global.apiToken = token;
            const forwardTo = this.$route.query.forwardTo;
            this.$router.replace(forwardTo || { name: 'welcome' });
            return false;
        });
        return false;
    } else {
        util.addFormErrors('authenticate', { password: 'Incorrect password, please try again.'});
    }
    return false;
}

module.exports = {
    data: () => ({
        global: shared.state,
        password: '',
        loading: false
    }),
    computed: {
        globalPasswordSet: function () { return this.global.passwordSet; },
        gotoSetPassword: function () {
            return {
                name: 'setPassword',
                query: { forwardTo: this.$route.query.forwardTo }
            };
        }
    },
    mounted: function () {
        init.call(this);
    },
    methods: {
        establishSession: function () {
            tryPassword.call(this);
        }
    },
    directives: {
        focus: focus.focus
    }
}
</script>