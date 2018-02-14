var jwtDecode = require('jwt-decode');

var state = {
    onboardStatus: undefined,
    passwordSet: undefined,
    userId: undefined,
    get loginTag() {
        return localStorage.getItem('loginTag') || '';
    },
    set loginTag(value) {
        if (value) localStorage.setItem('loginTag', value);
        else localStorage.removeItem('loginTag');
    },
    get apiToken() {
        const retval = localStorage.getItem('apiToken') || '';
        if (retval != this.prev) autoexpire(retval);
        this.prev = retval;
        return retval;
    },
    set apiToken(value) {
        if (value) localStorage.setItem('apiToken', value);
        else localStorage.removeItem('apiToken');
    }
};

function autoexpire(token) {
    if (this.timer) {
        clearTimeout(this.timer);
    }

    if (token) {
        const decoded = jwtDecode(token);
        const expires = new Date(decoded.exp * 1000);
        const now = new Date();

        this.timer = (setTimeout(() => {
            this.timer = null;
            console.log('apiToken expired');
            state.apiToken = null;
        }, expires - now));
    }
}

module.exports = { 
    state
};