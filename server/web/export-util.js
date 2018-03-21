
'use strict';

module.exports = {
    htmlDoc,
    csvDoc,
    jsonDoc,
    asyncZipToBuffer,
    offsetTimeStr
};

const csvStringify = require('csv-stringify');
const moment = require('moment');


///////////////////// MISC ///////////////////////

async function asyncZipToBuffer(zip) {
    return await new Promise((resolve, reject) => {
        try {
            zip.toBuffer(
                happy => resolve(happy),
                e => reject(e)
            );
        } catch (e) {
            reject(e);
        }
    });
}

function offsetTimeStr(m, tzoffset, compact = false) {
    const fmt = compact ? 'YYYYMMDDHHmmss' : 'ddd, MMM D, YYYY h:mm A';
    return m.utc().utcOffset(-(tzoffset)).format(fmt);
}


///////////////////// HTML ///////////////////////

function htmlDoc({ query, exportDate, rows, tzoffset }) {
    return `
        <!DOCTYPE HTML>
        <html>
        <head>
            <meta charset="utf-8" />
            <title>Vault Export on ${exportDate}</title>
            <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/semantic-ui/2.2.14/semantic.min.css"/>
            <script src="https://cdnjs.cloudflare.com/ajax/libs/jquery/3.1.1/jquery.min.js"></script>
            <script src="https://cdnjs.cloudflare.com/ajax/libs/semantic-ui/2.3.0/semantic.min.js"></script>

            <style>
                div.message-body { padding:5px; overflow: hidden; font-size: 17px; color: black; }
                div.message-body .plain-text { white-space: pre-line; }
                div.message-body img, div.message-body video {
                    max-width:33vw;
                    max-height:25vh;
                }
                div.recipients { margin-left: 1em; }
                a.butspacer { margin-bottom: .25em!important; }
                .hidden { display: none; }
                .clickable { cursor: pointer; }
                .query-item { padding:.25em; }
                .integrity { color: #db2828!important; }
            </style>
        </head>
        <body>
            <div class="ui inverted menu">
                <div class="ui container">
                    <span class="header item">
                        Forsta Message Vault Export
                    </span>
                    <a class="header item float right" onclick="$('.ui.tiny.modal').modal('show');">
                        <i class="large circle info icon"></i> Details
                    </a>
                </div>
            </div>
            <div class="ui tiny modal">
                <div class="header">Export Query Details</div>
                <div class="content">
                    <div class="query-item"><i class="icon caret right"></i> <b>export time</b> = ${exportDate} <em>(local time for exporter)</em></div>
                    <div class="query-item"><i class="icon caret right"></i> <b>messages exported</b> = ${rows.length}</div>
                    ${Object.keys(query).map(key => `
                        <div class="query-item"><i class="icon caret right"></i> <b>${key}</b> = ${query[key]}</div>
                    `).join('')}
                </div>
            </div>
            <div class="ui main text container" style="padding-bottom: 1em;">
                ${rows.map(row => htmlRow(row, tzoffset)).join('')}
            </div>
        </body>
        </html>
    `;
}

function htmlRow(row, tzoffset) {
    return `
        <div class="ui raised fluid card">
            <div class="content">
                <div class="right floated time" data-tooltip="receipt time (local time for exporter)">
                    <small>${offsetTimeStr(moment.utc(row.received), tzoffset)}</small>
                </div>
                <div class="header">
                    <a data-tooltip="thread ID ${row.threadId}"><i class="large comments icon" style="color: ${threadColor(row.threadId)};"></i></a>
                    <span class="thread-title" data-tooltip="thread ID ${row.threadId}">${threadTitle(row)}</span>
                </div>
                <div class="meta">${row.distribution.pretty}</div>
                <div class="description">
                    <span class="clickable" data-tooltip="user ID ${row.senderId}">from ${row.senderLabel}</span>
                </div>
                <div class="description">
                    <a><i class="down caret icon"></i> 
                    ${row.recipientIds.length} recipient${row.recipientIds.length == 1 ? '' : 's'}</a>
                </div>
                <div class="description ${row.recipientIds.length ? '' : 'hidden'}">
                    ${row.recipientLabels.map((who, idx) =>
            `<div class="recipients clickable" data-position="top left"
                             data-tooltip="user ID ${row.recipientIds[idx]}">${who}</div>`
        ).join('')}
                </div>
            </div>
            <div class="content">
                <div class="description">
                    <div class="message-body">${msgBodyHtml(row)}</div>
                </div>
            </div>
            <div class="content ${row.attachmentIds.length ? '' : 'hidden'}">
                ${row.attachmentIds.map((_, idx) => 
                `<a href="${attachmentUrl(row, idx)}" class="butspacer ui compact mini button">
                    <i class="download icon"></i> ${attachmentName(row, idx)}
                 </a>`).join('')}
            </div>
            <div class="content ${extConf(row, tzoffset).url ? '' : 'hidden'}">
                <div class="description">
                    <span data-tooltip="${extConf(row).hover}"><i class="${extConf(row, tzoffset).icon} icon"></i>
                    <small><a href="${extConf(row, tzoffset).url}" target="_blank" >Confirmed Blockchain Checkpoint: ${extConf(row, tzoffset).time}</a></small></span>
                </div>
            </div>
            <div class="content ${integrityIssues(row, tzoffset).length ? '' : 'hidden'}">
                <div class="description integrity">
                    <span><i class="exclamation triangle icon"></i> Integrity Alerts</span>
                    <ul>
                       ${integrityIssues(row, tzoffset).map(issue => `<li data-tooltip="${issue.time}" data-position="top left">${issue.text}</li>`).join('')}
                    </ul>
                </div>
            </div>
        </div>
    `;
}

function integrityIssues(row, tzoffset) {
    let issues = [];
    if (!row.integrity || !row.integrity.misses) return issues;
    if (row.integrity.misses.mainHash) issues.push({ text: 'Envelope/Body Integrity Corruption', time: 'recorded ' + offsetTimeStr(moment.utc(row.integrity.misses.mainHash), tzoffset) });
    if (row.integrity.misses.attachmentsHash) issues.push({ text: 'Attachments Integrity Corruption', time: 'recorded ' + offsetTimeStr(moment.utc(row.integrity.misses.attachmentsHash), tzoffset) });
    if (row.integrity.misses.previousId) issues.push({ text: 'Previous-Message-ID Corruption', time: 'recorded ' + offsetTimeStr(moment.utc(row.integrity.misses.previousId), tzoffset) });
    if (row.integrity.misses.chainHash) issues.push({ text: 'Integrity Chain Corruption', time: 'recorded ' + offsetTimeStr(moment.utc(row.integrity.misses.chainHash), tzoffset) });
    return issues;
}
function extConf(row, tzoffset) {
    if (!row.integrity || !row.integrity.verifiedTimestamp) return {time: '', url: '', icon: '', hover: ''};
    return {
        time: offsetTimeStr(moment.utc(row.integrity.verifiedTimestamp * 1000), tzoffset),
        url: `https://opentimestamps.org/info.html?ots=${row.integrity.upgradedOTS}`,
        icon: row.integrity.misses ? 'red exclamation triangle' : 'green check circle',
        hover: row.integrity.misses ? 'WARNING: this confirms corrupt data -- click to view anyway' : 'click to view external blockchain confirmation',
    };
}

function attachmentUrl(record, idx) {
    const message = record.payload.find(x => x.version === 1);
    const attachments = message && message.data && message.data.attachments;
    const attachmentIds = record.attachmentIds;

    return `attachments/${record.messageId}/${attachmentIds[idx]}/${attachments[idx].name}`;
}

function attachmentName(record, idx) {
    const message = record.payload.find(x => x.version === 1);
    const attachments = message && message.data && message.data.attachments;

    return attachments[idx].name;
}

function msgBodyText(record) {
    const message = record.payload.find(x => x.version === 1);
    const tmpText = message.data && message.data.body && message.data.body.find(x => x.type === 'text/plain');
    const text = (tmpText && tmpText.value) || '';
    return text;
}

function msgBodyHtml(record) {
    const message = record.payload.find(x => x.version === 1);
    const tmpText = message.data && message.data.body && message.data.body.find(x => x.type === 'text/plain');
    const text = (tmpText && tmpText.value) || '';
    const tmpHtml = message.data && message.data.body && message.data.body.find(x => x.type === 'text/html');
    const html = (tmpHtml && tmpHtml.value) || '';
    return html || `<p class="plain-text">${text}</p>`;
}

function threadTitle(record) {
    const message = record.payload.find(x => x.version === 1);
    return message.threadTitle || '&lt;thread title not defined&gt;';
}

function threadColor(id) {
    // map id to a randomish darkish color from a clumpy, visually-differentiable collection
    const val = parseInt(id.replace('-', ''), 16);
    const hue = (val % 90) * 4;
    const lum = (val % 5) * 10 + 20;
    return `hsl(${hue}, 100%, ${lum}%)`;
}


///////////////////// CSV ///////////////////////

function integrityAlerts(record) {
    if (!record.integrity || !record.integrity.misses) return '';
    return Object.keys(record.integrity.misses).reduce((r, k) => [...r, k], []).join('|');
}

const csvFields = [
    [(x, tzo) => offsetTimeStr(moment.utc(x.received), tzo), 'Received At (local to exporter)'],
    [x => x.messageId, 'Message ID'],
    [x => x.threadId, 'Thread ID'],
    [x => x.senderId, 'Sender ID'],
    [x => x.senderLabel, 'Sender Label'],
    [x => x.recipientIds.join('|'), 'Recipient IDs'],
    [x => x.recipientLabels.map(x => x.replace('|', '?')).join('|'), 'Recipient Labels'],
    [x => msgBodyText(x), 'Body Text'],
    [x => x.distribution.pretty, 'Distribution'],
    [x => x.attachmentIds.join('|'), 'Attachment IDs'],
    [x => integrityAlerts(x), 'Integrity Alerts'],
];

async function asyncCsvStringify(data) {
    return await new Promise((resolve, reject) => {
        try {
            csvStringify(data, (e, output) => {
                if (e) {
                    reject(e);
                } else {
                    resolve(output);
                }
            });
        } catch (e) {
            reject(e);
        }
    });
}

async function csvDoc({rows, tzoffset}) {
    const csvrows = [csvFields.map(x => x[1])];
    for (const row of rows) {
        csvrows.push(csvFields.map(x => x[0](row, tzoffset)));
    }
    return asyncCsvStringify(csvrows);
}


///////////////////// JSON ///////////////////////

function jsonDoc({ query, exportDate, rows, tzoffset }) {
    return JSON.stringify({
        query,
        clientExportDate: exportDate,
        records: rows
    });
}