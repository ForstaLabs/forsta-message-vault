<style>
</style>

<template>
<div class="ui segment container center aligned padded">
    <div class="ui text container">
        <h1 class="ui header">
            <img class="ui image logo" src="/static/images/logo.png"/>
            <div class="content">Forsta Message Vault</div>
        </h1>
        <h3>Safe data retention service for the Forsta messaging platform.</h3>
    </div>

    <br />

    <router-link to="/tag" class="ui big primary button">CONNECT <i class="right arrow icon"></i></router-link>

    <div class="ui divider horizontal">Get full control of your data</div>

    <div class="ui text container">
        <p>
            With Forsta Vault you decide where your data lives and what your retention policies are.
            Vault is completely open source and runs anywhere from the cloud to your own data center.
        </p>
    </div>
</div>
</template>

<script>
module.exports = {
    data: () => ({ }),
    mounted: function() {
        fetch('/api/onboard/status/v1')
        .then(result => {
            if (result.ok) this.$router.push('/dashboard');
        });
    },
}
</script>