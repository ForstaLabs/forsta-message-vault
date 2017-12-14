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
    <button class="ui big primary button" id='export'>EXPORT CSV &nbsp;<i class="download icon"></i></button>
</div>
</template>

<script>
async function exportCSV() {
    console.log('exporting csv...');
    formLoading('.enter-tag', true);
    let result;
    try {
        result = await fetch('/api/messages/v1', {
            headers: {
                'Accept': 'text/csv'
            }
        });
    } catch (err) {
        buttonLoading('#export', false);
        console.error('had error', err);
        return;
    }
    buttonLoading('#export', false);
    if (result.ok) {
        const blob = await result.blob();
        const anchor = document.createElement('a');
        anchor.href = URL.createObjectURL(blob);
        anchor.download = result.headers.get('content-disposition').match(/ filename="(.*?)"/)[1];
        anchor.click();
    }
}
module.exports = {
  data: () => ({ })
}
</script>