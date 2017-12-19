addEventListener('load', main);
function main() {
    const Vue = require('vue');
    const VueRouter = require('vue-router');
    Vue.use(VueRouter);

    const Root = require('./root.vue');
    const routes = [
        { path: '/welcome', name: 'welcome', component: require('./welcome.vue') },
        { path: '/auth/login', name: 'authenticate', component: require('./auth/authenticate.vue') },
        { path: '/auth/password', name: 'setPassword', component: require('./auth/setPassword.vue') },
        { path: '/onboard/tag', name: 'enterTag', component: require('./onboard/enterTag.vue') },
        { path: '/onboard/code/:tag', name: 'enterCode', component: require('./onboard/enterCode.vue') },
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