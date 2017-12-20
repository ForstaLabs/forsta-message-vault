<style>
</style>

<template>
<div>
    <button class="ui big primary button" id='export' @click.stop="boundExportCSV">EXPORT CSV &nbsp;<i class="download icon"></i></button>
</div>
</template>

<script>
async function exportCSV() {
    this.loading = true;
    let result;

    try {
        result = await util.fetch.call(this, '/api/messages/v1', { headers: { 'Accept': 'text/csv' } });
    } catch (err) {
        console.error('had error', err);
        return;
    }

    this.loading = false;
    if (result.ok) {
        const blob = await result.blob();
        const anchor = document.createElement('a');
        anchor.href = URL.createObjectURL(blob);
        anchor.download = result.headers.get('content-disposition').match(/ filename="(.*?)"/)[1];
        anchor.click();
    }
}
module.exports = {
    data: () => ({ 
        global: shared.state
    }),
    methods: {
        boundExportCSV: exportCSV.bind(this)
    },
    mounted: function() {
        if (this.global.onboarded === false) {
            this.$router.push({ name: 'welcome' });
            return;
        }
        util.fetch.call(this, '/api/onboard/status/v1')
        .then(result => { 
            this.global.onboarded = result.ok;
            if (!result.ok) {
                this.$router.push({ name: 'welcome' });
            }
        });

        if (!this.global.apiToken) {
            this.$router.push({ name: 'authenticate', query: { forwardTo: this.$router.path }});
            return;
        }
    }
}
</script>