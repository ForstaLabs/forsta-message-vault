<style>
    /*Styling for the lines connecting the labels to the slices*/
    polyline{
        opacity: .3;
        stroke: black;
        stroke-width: 2px;
        fill: none;
        shape-rendering: geometricPrecision;
    }

    /* styling for the donut slices*/
    path {
        shape-rendering: geometricPrecision;
        cursor: pointer;
    }

    /* Make the percentage on the text labels bold*/
    .labelName tspan {
        font-weight: normal;
    }

    /* In biology we generally italicise species names. */
    .labelName {
        font-size: 0.8em;
        font-weight: 700;
        cursor: pointer;
    }

    svg text.title {
        opacity: .1;
        font-size: 4em;
        font-weight: bold;
        text-transform: uppercase;
    }
</style>

<template>
<div>
    <div class="ui container center aligned">
        <div class="ui basic segment huge">
            <h1 class="ui header">
                <i class="large circular checkmark icon"></i>
                Message Vault Running
            </h1>
            <div class="column chides pie" style="padding: 0;" />
            <h2>{{totalMessagesSeen}} Messages &mdash; {{totalMessagesFlagged}} NSFW</h2>
        </div>
    </div>
</div>
</template>

<script>

module.exports = {
    data: () => ({ 
        global: shared.state,
    }),
    methods: {
        getStats: function() {
        }
    },
    mounted: function() {
        if (this.global.onboardStatus !== 'complete') {
            this.$router.push({ name: 'welcome' });
            return;
        }
        util.fetch.call(this, '/api/onboard/status/v1')
        .then(result => { 
            this.global.onboardStatus = result.theJson.status;
            if (this.global.onboardStatus !== 'complete') {
                this.$router.push({ name: 'welcome' });
            }
        });

        if (!this.global.apiToken) {
            this.$router.push({ name: 'authenticate', query: { forwardTo: this.$router.path }});
            return;
        }
    },
    beforeDestroy: function() {
    }
}
</script>