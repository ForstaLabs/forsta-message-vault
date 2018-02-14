<style>
</style>

<template>
    <div>
        <top-menu />
        <router-view />
        <bottom-menu />
    </div>
</template>

<script>
shared = require('./globalState');
util = require('./util');
topMenu = require('./menu/top.vue');
bottomMenu = require('./menu/bottom.vue');

module.exports = {
    data: () => ({ 
        global: shared.state
    }),
    components: {
        'top-menu': topMenu,
        'bottom-menu': bottomMenu
    },
    computed: {
        globalApiToken: function() { return this.global.apiToken; },
    },
    watch: {
        globalApiToken: function (next, prev) {
            if (!next && prev) {
                console.log('reauthenticating for', this.$route.path)
                this.$router.push({ name: 'loginTag', query: { forwardTo: this.$route.path }});
            }
        }
    },
    mounted: function() {
        util.fetch.call(this, '/api/auth/status/v1')
        .then(result => { this.global.passwordSet = result.ok; });
    },
}
</script>