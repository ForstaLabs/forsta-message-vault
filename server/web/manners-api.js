
'use strict';

const relay = require('librelay');
const APIHandler = require('./api').APIHandler;

class MannersAPIv1 extends APIHandler {

    constructor(options) {
        super(options);
        this.router.get('/stats/v1', this.asyncRoute(this.onGetStats));
    }

    async onGetStats(req, res, next) {
        const totalMessagesSeen = await relay.storage.getState('messages-seen', 0);
        const flagged = await relay.storage.keys('index-sender-message-timestamp'); // , [senderId, msg.messageId].join, timestamp);
        const counts = flagged.reduce((counts, chideIndex) => {
            const [senderId] = chideIndex.split(',');
            counts[senderId] = (counts[senderId] || 0) + 1;
            return counts;
        }, {});

        let chided = [];
        for (const senderId in counts) {
            const sender = await relay.storage.get('chided-users', senderId, { name: 'Unknown(!)', tag: '@unknown:unknown' });
            sender.count = counts[senderId];
            chided.push(sender);
        }

        res.status(200).json({ totalMessagesSeen, totalMessagesFlagged: flagged.length, chidedUsers: chided });
    }
}


module.exports = {
    MannersAPIv1
};
