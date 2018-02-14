addEventListener('load', main);
function main() {
    const Vue = require('vue');
    const VueRouter = require('vue-router');
    Vue.use(VueRouter);

    const Root = require('./root.vue');
    const routes = [
        { path: '/welcome', name: 'welcome', component: require('./welcome/welcome.vue') },
        { path: '/auth/tag', name: 'loginTag', component: require('./auth/loginTag.vue') },
        { path: '/auth/code', name: 'loginCode', component: require('./auth/loginCode.vue') },
        { path: '/onboard/tag', name: 'onboardTag', component: require('./onboard/enterTag.vue') },
        { path: '/onboard/code/:tag', name: 'onboardCode', component: require('./onboard/enterCode.vue') },
        { path: '/dashboard', name: 'dashboard', component: require('./dashboard/dashboard.vue') },
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