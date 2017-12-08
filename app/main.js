// vim: ts=4:sw=4:expandtab

(function() {
    'use strict';

    addEventListener('load', main);

    var state = {
        pane: 'welcome',
        tag: null
    };

    function main() {
        // page
        $('div.menu').tab();
        checkStatus();

        // welcome pane
        $('button#connect').on('click', () => { setPane('enter-tag'); });

        // enter-tag pane
        $('form.ui.form.enter-tag').form({
            fields: {
                tag: {
                    identifier: 'tag',
                    rules: [{
                        type: 'regExp',
                        value: /^([\da-z_]([.][\da-z_]|[\da-z_])*):([\da-z_]([.]+[\da-z_]|[\da-z_])*)$/,
                        prompt: 'please enter full @your.name:your.org'
                    }]
                }
            },
            onSuccess: requestAuth
        });

        // enter-code pane
        $('div.code-cancel').on('click', () => { setPane('enter-tag'); });
        $('form.ui.form.enter-code').form({
            fields: {
                code: {
                    identifier: 'code',
                    rules: [{
                        type: 'regExp',
                        value: /^\d{6}$/,
                        prompt: 'please enter the six-digit code you were just sent'
                    }]
                }
            },
            onSuccess: sendLoginCode
        });

        // dashboard pane
        $('button#export').on('click', () => { exportCSV(); });
    }

    function setPane(name) {
        $.tab('change tab', name);
        state.pane = name;
    }

    function formLoading(form, isLoading) {
        if (isLoading) {
            $('form.ui.form' + form).addClass('loading');
        } else {
            $('form.ui.form' + form).removeClass('loading');
        }
    }

    function buttonLoading(button, isLoading) {
        if (isLoading) {
            $('button' + button).addClass('loading');
        } else {
            $('button' + button).removeClass('loading');
        }
    }

    function formFieldVal(formClass, fieldName) {
        return $('form.ui.form.' + formClass).form('get field', fieldName).val();
    }

    function addFormErrors(formClass, errors) {
        $('form.ui.form.' + formClass).form('add errors', errors);
        Object.keys(errors).forEach(key => $('form.ui.form.' + formClass).form('add prompt', key));
    }

    function checkStatus() {
        fetch('/api/onboard/status/v1/')
        .then(result => {
            state.isRegistered = result.ok;
            if (state.isRegistered) setPane('dashboard');
        });
    }

    function requestAuth() {
        event.preventDefault();
        var tag = formFieldVal('enter-tag', 'tag');
        formLoading('.enter-tag', true);
        fetch('/api/onboard/authcode/v1/' + tag)
        .then(result => {
            formLoading('.enter-tag', false);
            if (result.ok) {
                state.tag = tag;
                setPane('enter-code');
                return false;
            } else {
                addFormErrors('enter-tag', { tag: 'Unrecognized name and/or org.' });
                return false;
            }
        })
        .catch(err => {
            console.log('had error', err);
            formLoading('.enter-tag', false);
        });
        return false;
    }

    function sendLoginCode() {
        event.preventDefault();
        var code = formFieldVal('enter-code', 'code');
        formLoading('.enter-code', true);
        fetch('/api/onboard/authcode/v1/' + state.tag, {
            method: 'post',
            headers: {
                'Accept': 'application/json, text/plain, */*',
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ code })
        })
        .then(result => {
            formLoading('.enter-code', false);
            if (result.ok) {
                setPane('dashboard');
                return false;
            } else {
                addFormErrors('enter-code', { code: 'Incorrect code.' });
                return false;
            }
        })
        .catch(err => {
            console.log('had error', err);
            formLoading('.enter-code', false);
        });
        return false;
    }

    function exportCSV() {
        console.log('exporting csv...');
        formLoading('.enter-tag', true);
        fetch('/api/messages/v1')
        .then(result => {
            buttonLoading('#export', false);
            console.log('got result', result);
            if (result.ok) {
                return false;
            } else {
                return false;
            }
        })
        .catch(err => {
            buttonLoading('#export', false);
            console.log('had error', err);
        });
        return false;
    }

})();
