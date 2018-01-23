
var shared = require('./globalState');

function addFormErrors(formClass, errors) {
    const $f = $('form.ui.form.' + formClass);
    $f.form('add errors', errors);
    $f.find('div.error.message').addClass('visible'); // seriously, semantic?
    Object.keys(errors).forEach(key => $f.form('add prompt', key));
}


class RequestError extends Error {
    constructor(message, code, resp) {
        super(message);
        this.name = 'RequestError';
        this.code = code;
        this.response = resp;
    }
}

function mergeErrors(errObj) {
    // scoop up all form/response error messages no matter the field(s) as a single string...
    return Object.values(errObj).map(x => Array.isArray(x) ? x.join('; ') : x).join('; ');
}

async function _fetch(url, { method='get', headers={}, body={} }={}, noBodyAwaits) {
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
    const resp = await fetch(url, parms);
    if (noBodyAwaits) return resp;

    const text = await resp.text();
    if ((resp.headers.get('content-type') || '').startsWith('application/json')) {
        resp.theJson = JSON.parse(text.trim() || '{}');
    } else {
        resp.theText = text;
    }
    if (resp.status === 401) {
        console.log('401 from bot api, so we will visit bot authentication...');
        this.$router.push({ name: 'authenticate', query: { forwardTo: this.$route.fullPath }});
        // throw Error('not authenticated with bot server -- looping through authentication');
    }
    return resp;
}

module.exports = {
    addFormErrors,
    mergeErrors,
    RequestError,
    fetch: _fetch
};
