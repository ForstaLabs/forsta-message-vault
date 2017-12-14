<style>
</style>

<template>
<div class="ui segment container center aligned padded">
    <div class="ui text container">
        <h2 class="ui header">
            <img class="ui image logo" src="/static/images/logo.png"/>
            <div class="content">Sign In to Forsta</div>
        </h2>
    </div>
    <div class="ui grid basic segment center aligned">
        <div class="ui eight wide column segment left aligned">
            <form class="ui huge form enter-code" :class="{loading: loading}">
                <div class="field">
                    <label>Enter Login Code</label>
                    <div class="ui left icon input">
                        <input type="text" name="code" placeholder="000000" autocomplete="off" v-model='code'>
                        <i class="lock icon"></i>
                    </div>
                </div>
                <button class="ui large primary submit button" type="submit">Submit</button>
                <router-link to="/tag" class="ui large button right floated code-cancel">Cancel</router-link>
                <div class="ui mini error message" />
            </form>
        </div>
    </div>
</div>
</template>

<script>
util = require('./util');

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
        onSuccess: sendLoginCode.bind(this)
    });
}

function sendLoginCode() {
    var tag = this.$route.params.tag;
    var code = this.code;
    this.loading = true;
    fetch('/api/onboard/authcode/v1/' + tag, {
        method: 'post',
        headers: {
            'Accept': 'application/json, text/plain */*',
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({ code })
    })
    .then(result => {
        this.loading = false;
        if (result.ok) {
            this.$router.push('/dashboard');
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
        loading: false
    }),
    mounted: function() {
        setup.bind(this)()
    },
    methods: {
    }
}
</script>