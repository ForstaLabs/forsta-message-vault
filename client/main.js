addEventListener('load', main);
function main() {
    const Vue = require('vue');
    const VueRouter = require('vue-router');
    const SuiVue = require('semantic-ui-vue');
    Vue.use(VueRouter);
    Vue.use(SuiVue.default);

    const Root = require('./root.vue');
    const routes = [
        { path: '/welcome', name: 'welcome', component: require('./welcome/welcome.vue') },
        { path: '/auth/tag', name: 'loginTag', component: require('./auth/loginTag.vue') },
        { path: '/auth/code', name: 'loginCode', component: require('./auth/loginCode.vue') },
        { path: '/onboard/tag', name: 'onboardTag', component: require('./onboard/onboardTag.vue') },
        { path: '/onboard/code/:tag', name: 'onboardCode', component: require('./onboard/onboardCode.vue') },
        { path: '/messages', name: 'messages', component: require('./messages/messages.vue') },
        { path: '/settings', name: 'settings', component: require('./settings/settings.vue') },
        { path: '*', redirect: '/welcome' },
    ];

    const router = new VueRouter({
        mode: 'history',
        routes
    });

    new Vue({
        el: '#app',
        router,
        render: function (createElement) {
            return createElement(Root);
        }
    });
}