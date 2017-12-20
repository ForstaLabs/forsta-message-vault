<style>
</style>

<template>
    <div class="ui two column centered grid">
        <div class="middle aligned row">
            <div class="five wide column">
                <img class="ui tiny floated right image" src="/static/images/logo.png"/>
            </div>
            <div class="eleven wide column">
                <h2 class="ui header">Sign In to Forsta</h2>
            </div>
        </div>
        <div class="ui eleven wide column basic left aligned text segment t0 b1">
            <p>Please authenticate as your organization's administrator so we 
                can create a new user in your organization to represent this vault.</p>
        </div>
        <div class="ui nine wide column basic segment left aligned t0 b1">
            <form class="ui huge form enter-code" :class="{loading: loading}">
                <div class="field">
                    <label>Enter Login Code</label>
                    <div class="ui left icon input">
                        <input v-focus.lazy="true" type="text" name="code" placeholder="000000" autocomplete="off" v-model='code'>
                        <i class="lock icon"></i>
                    </div>
                </div>
                <button class="ui large primary submit button" type="submit">Submit</button>
                <router-link :to="{name: 'enterTag'}" class="ui large button right floated code-cancel">Cancel</router-link>
                <div class="ui mini error message" />
            </form>
        </div>
        <div class="ui eleven wide column basic left aligned text segment t0">
            <p>Your administrative credentials will be immediately discarded and all 
                further user-related actions taken by and for the vault will involve only 
                your new Message Vault user.</p>
        </div>
    </div>
</template>

<script>
util = require('../util');
shared = require('../globalState');
focus = require('vue-focus');

function setup() {
    $('form.ui.form.enter-code').form({
        fields: {
            code: {
                identifier: 'code',
                rules: [{
                    type: 'regExp',
                    value: /^\d{6}$/,
                    prompt: 'please enter the six-digit code you were just sent'
                }]
            }
        },
        onSuccess: (event) => {
            event.preventDefault();
            sendLoginCode.call(this);
        }
    });
}

function sendLoginCode() {
    var tag = this.$route.params.tag;
    var code = this.code;
    this.loading = true;
    util.fetch.call(this, '/api/onboard/authcode/v1/' + tag, { method: 'post', body: { code }})
    .then(result => {
        this.loading = false;
        this.global.onboarded = result.ok;
        if (result.ok) {
            this.$router.push({ name: 'dashboard' });
            return false;
        } else {
            util.addFormErrors('enter-code', { code: 'Incorrect code, please try again.' });
            return false;
        }
    })
    .catch(err => {
        console.log('had error', err);
        this.loading = false;
    });
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