<style>
</style>

<template>
    <div class="ui main text container" style="margin-top: 80px;">
        <div class="ui container center aligned">
            <div v-if="monitor" class="ui basic segment huge">
                <h1>
                    <i class="circular icon add user"></i>
                    Create Catch-All User
                </h1>
                This bot will send and receive messages autonomously <br />
                as a <b>new</b> Forsta user configured to be a "monitor" <br />
                so it will receive copies of <b>all</b> organization traffic.<br />
                <br />
                Please authenticate as an <b>org administrator</b> to create this new user.
            </div>
            <div v-if="!monitor" class="ui basic segment huge">
                <h1>
                    <i class="large circular icon user"></i>
                    Connect User
                </h1>
                This bot will send and receive messages autonomously <br />
                as a particular Forsta user. Please authenticate as that user.
            </div>
            <div class="ui centered grid">
                <div class="ui nine wide column basic segment left aligned b1">
                    <form class="ui huge form enter-tag" :class="{loading: loading}">
                        <div class="field">
                            <label>Forsta {{monitor ? 'Organization Admin' : ''}} Login</label>
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
            <div v-if="monitor" class="ui basic segment">
                <p>Your administrator credentials will be immediately discarded<br />
                and all further actions taken by this bot will be as the new user.</p>
            </div>
        </div>
    </div>
</template>

<script>
util = require('../util');
focus = require('vue-focus');
shared = require('../globalState');

function setup() {
    util.fetch.call(this, '/api/onboard/status/v1')
    .then(result => { 
        this.global.onboardStatus = result.theJson.status;
        if (this.global.onboardStatus === 'complete') {
            this.$router.push(authDash);
        }
    });

    $('form.ui.form.enter-tag').form({
        fields: {
            tag: {
                identifier: 'tag',
                rules: [{
                    type: 'regExp',
                    value: /^([\da-z_]([.][\da-z_]|[\da-z_])*):([\da-z_]([.]+[\da-z_]|[\da-z_])*)$/,
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
    util.fetch.call(this, '/api/onboard/atlasauth/request/v1/' + tag)
    .then(result => {
        this.loading = false;
        if (result.ok) {
            this.$router.push({ name: 'onboardAuth', params: { tag: this.tag, type: result.theJson.type }});
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
        monitor: function () { return this.global.onboardStatus === 'authenticate-admin'; },
        gotoSetPassword: function () {
            return {
                name: 'setPassword',
                query: { forwardTo: this.$route.query.forwardTo }
            };
        }
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