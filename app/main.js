// vim: ts=4:sw=4:expandtab

(function() {
    'use strict';

    function main() {
        $('button#authorize').on('click', () => {
            $.tab('change tab', 'authenticate');
        });
    }

    addEventListener('load', main);
})();
