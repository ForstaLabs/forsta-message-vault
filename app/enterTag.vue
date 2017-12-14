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
        <form class="ui huge form enter-tag" :class="{loading: loading}">
            <div class="field">
            <label>Org Admin Login</label>
            <div class="ui left icon input">
                <input type="text" v-model='tag' name="tag" placeholder="user:org" autocomplete="off">
                <i class="at icon"></i>
            </div>
            </div>
            <button class="ui large primary submit button" type="submit">Submit</button>
            <div class="ui mini error message" />
        </form>
    </div>
</div>
</div>
</template>

<script>
util = require('./util');

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
        onSuccess: requestAuth.bind(this)
    });
}

function requestAuth() {
    var tag = this.tag;
    this.loading = true;
    fetch('/api/onboard/authcode/v1/' + tag)
    .then(result => {
        this.loading = false;
        if (result.ok) {
            this.$router.push('/code/' + this.tag);
            return false;
        } else {
            util.addFormErrors('enter-tag', { tag: 'Unrecognized name and/or org.' });
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
        tag: '',
        loading: false
    }),
    mounted: function () {
        setup.bind(this)()
    },
    methods: {
    }
}
</script>