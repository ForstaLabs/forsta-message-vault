
'use strict';

const APIHandler = require('./api').APIHandler;

class VaultAPIv1 extends APIHandler {

    constructor(options) {
        super(options);
        this.router.get('/messages/v1', this.asyncRoute(this.onGetMessages, false));
        this.router.get('/attachment/:id/v1', this.asyncRoute(this.onGetAttachment, false));
    }

    async onGetMessages(req, res, next) {
        console.log('query parameters are', req.query);
        const rows = await this.server.bot.pgStore.getMessages(req.query);
        res.status(200).json({messages: rows});
    }

    async onGetAttachment(req, res, next) {
        const { id } = req.params;
        console.log('about to get attachment', id);
        const attachment = await this.server.bot.pgStore.getAttachment(id);
        console.log('found attachment', attachment.name, attachment.type);
        res.set({
            'Content-Type': attachment.type,
            'Content-Disposition': `attachment; filename=${attachment.name}`
        });
        res.status(200).send(attachment.data);
        res.end();
    }
}


module.exports = {
    VaultAPIv1
};
