<template>
    <div class="ui fixed inverted menu" style="z-index: 1;">
        <div class="ui container">
            <router-link :to="{name: 'welcome'}" class="header item">
                <img class="logo" src="/static/images/forsta-logo-invert.svg"/>
                &nbsp;&nbsp;Forsta Message Vault
            </router-link>
            <div v-if="global.apiToken" class="header item float right" style="padding:0;">
                <div class="ui simple dropdown item">
                    <i class="large user icon"></i>
                    <i class="dropdown icon"></i>
                    <div class="menu left">
                    <div class="item" @click="logout">sign out</div>
                    <div class="item" @click="settings">settings</div>
                    <div class="item" @click="dashboard">dashboard</div>
                    </div>
                </div>
            </div>
        </div>
    </div>
</template>

<script>
shared = require('../globalState');

module.exports = {
    data: () => ({ 
        global: shared.state,
        loggedIn: false
    }),
    methods: {
        logout: function () {
            this.global.apiToken = null;
        },
        settings: function () {
            this.$router.push({ name: 'settings' });
        },
        dashboard: function () {
            this.$router.push({ name: 'dashboard' });
        }
    }
}
</script>