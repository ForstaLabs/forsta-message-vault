
<style>
div.listgap {
    margin-bottom:3em!important;
}
</style>

<template>
    <div class="ui main text container" style="margin-top: 80px;">
        <div class="ui container center aligned">
            <div class="ui basic segment huge">
                <h1 class="ui header">
                    <i class="large circular setting icon"></i>
                    Message Vault Settings
                </h1>
            </div>
            <div class="ui centered grid">
                <div class="ui nine wide column basic segment left aligned b1" :class="{loading: loading}" style="margin-top:-1em;">
                    <h3 style="margin-bottom: 3px;">Authorized Site Users</h3>
                    <div class="ui list listgap">
                        <div v-for="a in admins" :key="a.id" class="item">
                            <a v-if="admins.length > 1" @click="removeAdmin(a.id)" data-tooltip="remove this authorized user"><i class="large remove circle icon"></i></a> 
                            <span v-else data-tooltip="cannot remove last authorized user"><i style="color: lightgray;" class="large remove circle icon"></i></span> 
                            {{a.label}}
                        </div>
                    </div>
                    <form class="ui large form enter-tag" @submit.prevent="addAdmin">
                        <div class="field" :class="{error:!!tagError}">
                            <div data-tooltip="add an authorized user" class="ui left icon action input">
                                <i class="at icon"></i>
                                <input type="text" v-model='tag' name="tag" placeholder="user:org" autocomplete="off">
                                <button class="ui icon button" :disabled="!tag" :class="{primary:!!tag}"><i class="plus icon"></i></button>
                            </div>
                        </div>
                    </form>
                    <div v-if="tagError" class="ui small error message">{{tagError}}</div>
                </div>
            </div>
        </div>
    </div>
</template>

<script>

const util = require('../util');
const REFRESH_POLL_RATE = 15000;


async function addAdmin() {
    this.loading = true;
    let result;
    try {
        result = await util.fetch.call(this, '/api/auth/admins/v1', { method: 'post', body: { op: 'add', tag: this.tag }})
        this.loading = false;
    } catch (err) {
        console.error(err);
        this.loading = false;
        return false;
    }
    if (result.ok) {
        const { administrators } = result.theJson;
        this.admins = administrators;
        this.tag = '';
        this.tagError = '';
    } else {
        this.tagError = util.mergeErrors(result.theJson);
    }
}

async function removeAdmin(id) {
    this.loading = true;
    let result;
    try {
        result = await util.fetch.call(this, '/api/auth/admins/v1', { method: 'post', body: { op: 'remove', id }})
        this.loading = false;
    } catch (err) {
        console.error(err);
        this.loading = false;
        return false;
    }
    if (result.ok) {
        const { administrators } = result.theJson;
        this.admins = administrators;
    } else {
        this.removeError = util.mergeErrors(result.theJson);
    }
}


module.exports = {
    data: () => ({ 
        global: shared.state,
        loading: false,
        interval: null,
        tag: '',
        tagError: '',
        removeError: '',
        admins: []
    }),
    computed: {
    },
    watch: {
    },
    methods: {
        getAdmins: function() {
            util.fetch.call(this, '/api/auth/admins/v1')
            .then(result => {
                if (result.ok) {
                    this.admins = result.theJson.administrators;
                }
            });
        },
        removeAdmin: function(id) {
            removeAdmin.call(this, id);
        },
        addAdmin: function() {
            addAdmin.call(this);
        }
    },
    mounted: function() {
        util.checkPrerequisites.call(this);
        this.getAdmins();
        this.interval = setInterval(() => this.getAdmins(), REFRESH_POLL_RATE); 
    },
    beforeDestroy: function() {
        clearInterval(this.interval);
    }
}
</script>