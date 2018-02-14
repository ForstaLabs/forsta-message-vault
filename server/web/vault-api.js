
'use strict';

const APIHandler = require('./api').APIHandler;
const moment = require('moment');
const AdmZip = require('adm-zip');
const exputil = require('./export-util');

class VaultAPIv1 extends APIHandler {

    constructor(options) {
        super(options);
        this.router.get('/export/v1', this.asyncRoute(this.onGetExport, true));
        this.router.get('/messages/v1', this.asyncRoute(this.onGetMessages, true));
        this.router.get('/attachment/:id/v1', this.asyncRoute(this.onGetAttachment, true));
    }

    async fetchAttachments(record) {
        const attachmentIds = record.attachmentIds;

        let results = attachmentIds.map(async id => {
            return {
                id,
                attachment: await this.server.bot.pgStore.getAttachment(id)
            };
        });
        const retval = await Promise.all(results);

        return retval;
    }

    async onGetExport(req, res, next) {
        delete req.query['offset'];
        delete req.query['limit'];

        const tzoffset = +(req.query['tzoffset'] || 0);

        var zip = new AdmZip();
        const rows = await this.server.bot.pgStore.getMessages(req.query);

        const topdir = `Vault-Export-${exputil.offsetTimeStr(moment(), tzoffset, 'compact')}`;
        res.attachment(`${topdir}.zip`);

        const csvdoc = await exputil.csvDoc({rows, tzoffset});
        zip.addFile(`${topdir}/messages-csv.csv`, new Buffer(csvdoc), "CSV for selected messages");

        const htmldoc = exputil.htmlDoc({query: req.query, exportDate: exputil.offsetTimeStr(moment(), tzoffset), rows, tzoffset});
        zip.addFile(`${topdir}/messages-html.html`, new Buffer(htmldoc), "HTML for selected messages");

        const jsondoc = exputil.jsonDoc({query: req.query, exportDate: exputil.offsetTimeStr(moment(), tzoffset), rows, tzoffset});
        zip.addFile(`${topdir}/messages-json.json`, new Buffer(jsondoc), "JSON for selected messages");

        for (const row of rows) {
            const attachments = await this.fetchAttachments(row);
            for (const a of attachments) {
                zip.addFile(`${topdir}/attachments/${row.messageId}/${a.id}/${a.attachment.name}`, a.attachment.data, "attachment");
            }
        }

        // todo: the exports could get really big; we should make this generally streamy instead of buffery...
        res.status(200).send(await exputil.asyncZipToBuffer(zip));
    }

    async onGetMessages(req, res, next) {
        console.log('query parameters are', req.query);
        const rows = await this.server.bot.pgStore.getMessages(req.query);
        res.status(200).json({messages: rows});
    }

    async onGetAttachment(req, res, next) {
        const { id } = req.params;
        const attachment = await this.server.bot.pgStore.getAttachment(id);

        res.attachment(attachment.name);
        res.type(attachment.type);
        res.status(200).send(attachment.data);
        res.end();
    }
}


module.exports = {
    VaultAPIv1
};
