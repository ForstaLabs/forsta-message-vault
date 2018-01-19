
var shared = require('./globalState');

function addFormErrors(formClass, errors) {
    const $f = $('form.ui.form.' + formClass);
    $f.form('add errors', errors);
    $f.find('div.error.message').addClass('visible'); // seriously, semantic?
    Object.keys(errors).forEach(key => $f.form('add prompt', key));
}

async function _fetch(url, { method='get', headers={}, body={} }={}) {
    const token = shared.state.apiToken;
    const _headers = Object.assign({
        'Accept': 'application/json, text/plain */*',
        'Content-Type': 'application/json'
    }, token ? { 'Authorization': 'JWT ' + token } : {}, headers);
    const _body = JSON.stringify(body);
    const parms = Object.assign({
        method,
        headers: _headers,
    }, method.toLowerCase() === 'get' ? {} : { body: _body });

    // console.log('about to do a fetch with url', url, 'and parms', parms);
    const result = await fetch(url, parms);
    if (result.status === 403) {
        this.$router.push({ name: 'authenticate', query: { forwardTo: this.$route.fullPath }});
        throw Error('not authenticated');
    }
    return result;
}

module.exports = {
    addFormErrors,
    fetch: _fetch
};
