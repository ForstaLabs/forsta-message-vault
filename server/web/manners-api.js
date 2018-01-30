
'use strict';

const APIHandler = require('./api').APIHandler;
const ForstaBot = require('../forsta_bot');

class MannersAPIv1 extends APIHandler {

    constructor(options) {
        super(options);
        this.router.get('/stats/v1', this.asyncRoute(this.onGetStats));
    }

    async onGetStats(req, res, next) {
        res.status(200).json(await ForstaBot.stats());
    }
}


module.exports = {
    MannersAPIv1
};
