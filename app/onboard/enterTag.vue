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
            <form class="ui huge form enter-tag" :class="{loading: loading}">
                <div class="field">
                    <label>Org Administrator Login</label>
                    <div class="ui left icon input">
                        <input v-focus.lazy="true" type="text" v-model='tag' name="tag" placeholder="user:org" autocomplete="off">
                        <i class="at icon"></i>
                    </div>
                </div>
                <button class="ui large primary submit button" type="submit">Submit</button>
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
focus = require('vue-focus');

function setup() {
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
    util.fetch.call(this, '/api/onboard/authcode/v1/' + tag)
    .then(result => {
        this.loading = false;
        if (result.ok) {
            this.$router.push({ name: 'enterCode', params: { tag: this.tag }});
            return false;
        } else {
            util.addFormErrors('enter-tag', { tag: 'Unrecognized name and/or org.' });
            return false;
        }
    })
    .catch(err => {
        console.log(err);
        this.loading = false;
    });
    return false;
}

module.exports = {
    data: () => ({
        tag: '',
        loading: false
    }),
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