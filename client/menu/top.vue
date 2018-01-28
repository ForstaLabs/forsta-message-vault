<style>
</style>

<template>
    <div class="ui fixed inverted menu">
        <div class="ui container">
            <router-link :to="{name: 'welcome'}" class="header item">
                <img class="logo" src="/static/images/forsta-logo-invert.svg"/>
                &nbsp;&nbsp;Forsta Messaging Bot
            </router-link>
            <a v-if="global.apiToken" class="header item float right" @click.prevent="logout">
                sign out
            </a>
        </div>
    </div>
</template>

<script>
shared = require('../globalState');
util = require('../util');

module.exports = {
    data: () => ({ 
        global: shared.state,
        loggedIn: false
    }),
    computed: {
    },
    methods: {
        logout: function () {
            if (this.global.apiToken) {
                console.log('signing out');
                this.global.apiToken = null;
            }
        }
    },
    watch: {
    },
    mounted: function() {
    },
}
</script>