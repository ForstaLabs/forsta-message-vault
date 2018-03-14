<style>
</style>

<template>
    <div class="ui main text container" style="margin-top: 80px;">
        <div class="ui container center aligned">
            <div class="ui basic segment huge">
                <h1 class="ui header">
                    <i class="large circular sign in icon"></i>
                    Enter Forsta Login Code
                </h1>
            </div>
            <div class="ui centered grid">
                <div class="ui nine wide column basic segment left aligned t0 b1">
                    <form class="ui huge form enter-code" :class="{loading: loading}">
                        <div class="field">
                            <label>Forsta Login Code</label>
                            <div class="ui left icon input">
                                <input v-focus.lazy="true" type="text" name="code" placeholder="000000" autocomplete="off" v-model='code'>
                                <i class="lock icon"></i>
                            </div>
                        </div>
                        <button class="ui large primary submit button right floated" type="submit">Submit</button>
                        <router-link :to="{name: 'onboardTag'}" class="ui large button code-cancel">Cancel</router-link>
                        <div class="ui mini error message" />
                    </form>
                </div>
            </div>
            <div class="ui basic segment">
                <p>Please enter the Forsta login code that was sent to you.</p>
            </div>
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
        if (result.ok) {
            const { token } = result.theJson;
            this.global.apiToken = token;
            this.global.onboardStatus = 'complete';
            this.$router.push({ name: 'messages' });
            return false;
        } else {
            util.addFormErrors('enter-code', { code: util.mergeErrors(result.theJson) });
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