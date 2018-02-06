
<template>
    <div class="ui main text container" style="margin-top: 80px;">
        <div class="ui container center aligned">
            <div class="ui basic segment huge">
                <h1 class="ui header"><i class="circular icon lock"></i>Set Site Password</h1>
            </div>
            <div class="ui centered grid">
                <div class="ui ten wide column left aligned t0">
                    <form class="ui huge form set-password" :class="{loading: loading}">
                        <div class="field">
                            <label>Password</label>
                            <div class="ui left icon input">
                                <input v-focus.lazy="true" type="password" v-model='password' name="password" placeholder="enter password" autocomplete="off">
                                <i class="icon lock"></i>
                            </div>
                        </div>
                        <div class="field">
                            <label>Confirm</label>
                            <div class="ui left icon input">
                                <input type="password" v-model='confirm' name="confirm" placeholder="confirm password" autocomplete="off">
                                <i class="icon lock"></i>
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

function setup() {
    $('form.ui.form.set-password').form({
        on: 'blur',
        fields: {
            password: {
                identifier: 'password',
                rules: [
                    {
                        type   : 'empty',
                        prompt : 'Please enter a password'
                    },
                    {
                        type   : 'minLength[6]',
                        prompt : 'Your password must be at least {ruleValue} characters'
                    }
                ]
            },
            confirm: {
                identifier: 'confirm',
                rules: [
                    {
                        type   : 'empty',
                        prompt : 'Please repeat the password'
                    },
                    {
                        type   : 'match[password]',
                        prompt : 'Passwords must match'
                    }
                ]
            },
           
        },
        onSuccess: (event) => {
            event.preventDefault();
            setPassword.call(this)
        }
    });
}

async function setPassword() {
    var password = this.password;
    this.loading = true;
    let result;
    try {
        result = await util.fetch.call(this, '/api/auth/password/v1', { method: 'post', body: { password } })
    } catch (err) {
        console.error(err);
        return;
    }
    this.loading = false;
    if (result.ok) {
        const { token } = result.theJson;
        shared.state.apiToken = token;
        const forwardTo = this.$route.query.forwardTo;
        this.$router.push(forwardTo || { name: 'welcome' });
    } else {
        console.log('internal error, password already set (wrong method to change it)');
    }
}

module.exports = {
    data: () => ({
        password: '',
        confirm: '',
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