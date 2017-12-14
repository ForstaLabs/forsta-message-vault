addEventListener('load', main);
function main() {
    const Vue = require('vue');
    const VueRouter = require('vue-router');
    Vue.use(VueRouter);

    const Top = require('./top.vue');
    const routes = [
        { path: '/welcome', component: require('./welcome.vue') },
        { path: '/tag', component: require('./enterTag.vue') },
        { path: '/code/:tag', component: require('./enterCode.vue') },
        { path: '/dashboard', component: require('./dashboard.vue') },
        { path: '*', redirect: '/welcome' },
    ];

    const router = new VueRouter({
        routes
    });

    new Vue({
        el: '#app',
        router,
        render: function (createElement) {
            return createElement(Top);
        }
    });
}