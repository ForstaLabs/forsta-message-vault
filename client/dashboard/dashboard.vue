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
                Manners Monitor Active
            </h1>
            <div class="column chides pie" style="padding: 0;" />
            <h2>{{totalMessagesSeen}} Messages &mdash; {{totalMessagesFlagged}} NSFW</h2>
        </div>
    </div>
</div>
</template>

<script>
const d3 = require('d3');
const donutChart = require('./donut-chart.js');

let chidesDonut;

module.exports = {
    data: () => ({ 
        global: shared.state,
        interval: null,
        totalMessagesSeen: 0,
        totalMessagesFlagged: 0,
    }),
    methods: {
        getStats: function() {
            util.fetch.call(this, '/api/manners/stats/v1')
            .then(result => {
                stats = result.theJson;
                this.totalMessagesSeen = stats.totalMessagesSeen;
                this.totalMessagesFlagged = stats.totalMessagesFlagged;
                if (chidesDonut && stats.chidedUsers.length) chidesDonut.data(stats.chidedUsers);
            });
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

        const chidesPieSelector = 'div.chides.pie';
        const chidesPieWidth = $(chidesPieSelector).innerWidth();
        chidesDonut = donutChart()
            .width(chidesPieWidth)
            .height(chidesPieWidth / 2.5)
            .transTime(750) // length of transitions in ms
            .cornerRadius(3) // sets how rounded the corners are on each slice
            .padAngle(0.015) // effectively dictates the gap between slices
            // .title('')
            .variable('count')
            .category('tag');
        d3.select(chidesPieSelector).call(chidesDonut);
        setTimeout(() => chidesDonut.data([{name: '', tag: 'per-user nsfw counts go here', count: 1 }]), 0);

        this.getStats();
        this.interval = setInterval(() => this.getStats(), 2000); 
    },
    beforeDestroy: function() {
        clearInterval(this.interval);
    }
}
</script>