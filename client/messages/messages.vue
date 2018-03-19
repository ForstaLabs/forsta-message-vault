
<style>
    h1.ruled { 
        font-size: 28px;
        padding-bottom: 4px;
        border-bottom: 1px lightgray solid!important;
    }
    .topruled {
        padding-top: .5em;
        border-top: 1px lightgray solid!important;
    }
    div.message-body {
        padding: 5px;
        overflow: hidden;
        font-size: 17px;
        color: black; 
    }
    div.message-body .plain-text { white-space: pre-line; }
    div.message-body img, div.message-body video {
        max-width: 33vw;
        max-height: 33vh;
    }
    div.message-body a {
        display: inline-block;
        max-width: 40vw;
    }

    span.thread-title.obscured, div.message-body.obscured { 
        color: transparent;
        text-shadow: rgba(0, 0, 0, 0.8) 0px 0px 12px;
        cursor: pointer;
        user-select: none;
    }
    div.message-body.obscured a { color: transparent; }
    div.message-body.obscured img, div.message-body.obscured video {
        filter: blur(10px) grayscale(60%) contrast(50%) opacity(33%);
    }

    div.recipients { margin-left: 1em; }
    a.butspacer { margin-bottom: .25em!important; }
    a.icobut { margin-left: .5em; }
    a.prev-arrow { float: left; }
    a.next-arrow { float: right; }
    div.filter-section {
        padding-bottom: 2.5em;
    }
    .clickable { cursor: pointer; }
    .capsify { text-transform: capitalize!important; }
    .nowrap { white-space: nowrap; }
    select.rightify { text-align-last: right; }

    div.filter {
        position: sticky;
        top: 75px;
        padding: 1.5em;
        margin-top: -5px;
        padding-top: 0;
        text-align: center;
    }
    div.obscure-control {
        position: sticky;
        top: 125px;
        padding: 1.5em;
        margin-top: -5px;
        padding-top: 0;
        text-align: center;
    }
    .thelayout {
        padding-top: 80px;
        display: grid;
        grid-template-columns: 150px 1fr 425px;
        grid-template-areas: "gleft gmiddle gright";
    }
    .theleft {
        grid-area: gleft;
    }
    .themiddle {
        grid-area: gmiddle;
        min-height: 80vh;
    }
    .theright {
        grid-area: gright;
    }

    div.pager {
        width: 100%;
        text-align: center;
        font-size: 130%;
        user-select: none;
    }
    div.pager .active-page {
        color: #FF6666;
    }

    div.zero {
        width: 100%;
        text-align: center;
        padding-top: 20vh;
    }
    div.export {
        position: fixed;
        bottom: 1.5em;
        right: 1.5em;
    }
    .integrity {
        color: red!important;
    }
</style>

<template>
<div class="thelayout">
    <div class="themiddle">
        <div v-if="!messages.length" class="zero">
            <h1>No Messages Found</h1>
            <h3>(Are your search filters conflicting or too restrictive?)</h3>
        </div>
        <div class="pager">
            <template v-for="(dot, idx) in pagerDots">
                <span v-if="dot.isActive" :key="idx" :data-tooltip="dot.tooltip"><i class="active-page circle icon"></i></span>
                <a v-else :key="idx" :data-tooltip="dot.tooltip" @click="dot.go"><i class="circle icon clickable"></i></a>
            </template>
        </div>
        <div v-for="m in messages" :key="m.messageId" class="ui raised fluid card">
            <div class="content">
                <div class="right floated time nowrap">
                    <a data-tooltip='filter UNTIL this time' @click="addTimeFilter(m, 'Until')"><i class="chevron left icon"></i></a>
                    <small>{{m.receivedText}}</small>
                    <a class="icobut" data-tooltip='filter SINCE this time' @click="addTimeFilter(m, 'Since')"><i class="chevron right icon"></i></a>
                </div>
                <div class="header">
                    <a data-tooltip='filter for this thread ID' @click="addThreadFilter(m)"><i class="large comments icon" :style="threadColor(m.threadId)"></i></a>
                    <span class="thread-title" :class="{obscured: obscured}" @click="flipscure">{{threadTitle(m)}}</span>
                </div>
                <div class="meta">{{m.distribution.pretty}}</div>
                <div class="description">
                    from {{m.senderLabel}}
                    <a class="icobut" data-tooltip='filter TO this user ID' @click="addUserIdFilter(m, 'To')"><i class="selected radio icon"></i></a>
                    <a data-tooltip='filter FROM this user ID' @click="addUserIdFilter(m, 'From')"><i class="move icon"></i></a>
                </div>
                <div class="description">
                    <a @click="toggleDist(m.messageId)"><i class="caret icon" :class="distCaret(m.messageId)"></i> 
                    {{m.recipientLabels.length}} recipient{{m.recipientLabels.length ? 's':''}}</a>
                </div>
                <div v-show="showDist[m.messageId]" class="description">
                    <div v-for="(label,idx) in m.recipientLabels" :key="idx" class="recipients">
                        {{label}}
                        <a class="icobut" data-tooltip='filter TO this user ID' @click="addUserIdFilter(m, 'To', idx)"><i class="selected radio icon"></i></a>
                        <a data-tooltip='filter FROM this user ID' @click="addUserIdFilter(m, 'From', idx)"><i class="move icon"></i></a>
                    </div>
                </div>
            </div>
            <div class="content">
                <div class="description">
                    <a @click="toggleBody(m.messageId)"><i class="caret icon" :class="bodyCaret(m.messageId)"></i> 
                    body</a>
                </div>
                <div class="description">
                    <div v-if="bodyVisible(m.messageId)" @click="flipscure" class="message-body" :class="{obscured: obscured}" v-html="messageBody(m)"></div>
                </div>
            </div>
            <div v-if="m.attachmentIds.length" class="content">
                <a @click="getAttachment(m, i)" v-for="(_, i) of m.attachmentIds" data-tooltip="click to download" class="butspacer ui compact mini button">
                    <i class="download icon"></i> {{attachmentName(m, i)}}
                </a>
            </div>
            <div class="content" v-if="attestation(m)">
                <div class="description attestation">
                    <span data-tooltip="click to view blockchain attestation"><i class="big green check circle icon"></i> 
                    <a :href="attestation(m).url" target="_blank" >Verified Blockchain Attestation Checkpoint: {{attestation(m).time}}</a></span>
                </div>
            </div>
            <div class="content" v-if="integrityIssues(m).length">
                <div class="description integrity">
                    <span><i class="exclamation triangle icon"></i> Integrity Warnings</span>
                    <ul>
                        <li v-for="issue in integrityIssues(m)" :data-tooltip="issue.time" data-position="top left">{{issue.text}}</li>
                    </ul>
                </div>
            </div>
        </div>
        <div class="pager" style="padding-bottom: 1em;">
            <template v-for="(dot, idx) in pagerDots">
                <span v-if="dot.isActive" :key="idx" :data-tooltip="dot.tooltip"><i class="active-page circle icon"></i></span>
                <a v-else :key="idx" :data-tooltip="dot.tooltip" @click="dot.go"><i class="circle icon clickable"></i></a>
            </template>
        </div>
    </div>
    <div class="theleft">
        <div class="obscure-control" @click="flipscure" v-if="messages.length">
            <div class="filter-section">
                <div class="clickable ui toggle checkbox">
                    <input type="checkbox" v-model="obscured">
                    <label>Obscure</label>
                </div>
            </div>
            <div class="filter-section">
                <button class="ui button primary" :class="scanningClass" @click.prevent.stop="beginScan">Integrity Scan</button>
            </div>
            <div>
              {{scanPercentage}}%
            </div>
        </div>
    </div>
    <div class="theright">
        <div class="filter">
            <h1 class="ruled">{{fullCount}} Result{{fullCount == 1 ? '' : 's'}}</h1>
            <div class="filter-section ui form">
                <form class="ui form">
                <div class="fields">
                    <select v-model="pageSize" class="ui selection dropdown rightify" @change="offset=0">
                        <option v-for="limit in selectablePageSizes" :value="limit">{{limit + ' Results / Page&nbsp;'}}</option>
                    </select>
                    <select v-model="ascending" class="ui selection dropdown">
                        <option value="yes">Oldest First</option>
                        <option value="no">Newest First</option>
                    </select>
                </div>
                </form>
            </div>
            <div class="filter-section">
                <h3>Add Text Filters</h3>
                <form v-on:submit.prevent="addTextFilters" class="ui form">
                    <div class="fields" style="margin-bottom:0;">
                        <input class="ui input" type="text" v-model="enteredText" placeholder="Add and Update Text Filters">
                    </div>
                    <small><em>
                        <span class="nowrap">body words</span> 
                        <span class="nowrap">| <b>title:</b> words</span> 
                        <span class="nowrap">| <b>to:</b> fragment</span> 
                        <span class="nowrap">| <b>from: </b>fragment</span> 
                        <span class="nowrap">| <b>has: </b>[no] attach[ment[s]]</span>
                        <span class="nowrap">| <b>has: </b>[no] [chain|body|attach[ment[s]]] warn[ing[s]]</span>
                    </em></small>
                </form>
            </div>
            <div class="filter-section" v-if="Object.keys(filters).length">
                <h3>Current Filters</h3>
                <a v-for="(v,k) in filters" @click="removeFilter(k)" data-tooltip="click to remove filter" class="butspacer ui compact primary basic button capsify">
                    <i class="remove icon"></i> {{v.presentation}}
                </a>
            </div>
            <div class="filter-section">
            </div>
            <div v-if="fullCount" class="export">
                <button class="ui fluid primary button" :class="{loading: exporting}" @click="getExport">Export {{fullCount}} Result{{fullCount == 1 ? '' : 's'}}</button>
            </div>
        </div>
    </div>
</div>
</template>

<script>

const moment = require('moment');
const util = require('../util');

const REFRESH_POLL_RATE = 15000;

const PAGE_SIZES = [5, 10, 20, 50, 100, 500, 1000, 2000, 5000, 10000];
const DEFAULT_PAGE_SIZE = PAGE_SIZES[4];

async function getExport(queryString, acceptType) {
    let result;
    try {
        result = await util.fetch.call(this, '/api/vault/export/v1?' + queryString, { headers: { 'Accept': acceptType } });
    } catch (err) {
        console.error('had error', err);
        return;
    }

    if (result.ok) {
        const blob = await result.blob();
        const anchor = document.createElement('a');
        const burl = window.URL.createObjectURL(blob);
        anchor.href = burl;
        anchor.style = "display: none";  
        anchor.download = result.headers.get('content-disposition').match(/ filename="(.*?)"/)[1];
        document.body.appendChild(anchor);
        anchor.click();
        setTimeout(() => {
            document.body.removeChild(anchor);
            window.URL.revokeObjectURL(burl);
        }, 500);
    }
}

async function getAttachment(id, acceptType) {
    let result;
    try {
        result = await util.fetch.call(this, `/api/vault/attachment/${id}/v1`, { headers: { 'Accept': acceptType } });
    } catch (err) {
        console.error('had error', err);
        return;
    }

    if (result.ok) {
        const blob = await result.blob();
        const anchor = document.createElement('a');
        const burl = window.URL.createObjectURL(blob);
        anchor.href = burl;
        anchor.style = "display: none";  
        anchor.download = result.headers.get('content-disposition').match(/ filename="(.*?)"/)[1];
        document.body.appendChild(anchor);
        anchor.click();
        setTimeout(() => {
            document.body.removeChild(anchor);
            window.URL.revokeObjectURL(burl);
        }, 500);
    }
}

function extract(text, regex, action) {
    let stripped = text;
    let match;
    while ((match = regex.exec(text)) !== null) {
        stripped = stripped.replace(match[0], ' ').trim();
        action(match);
    }
    return stripped;
}

module.exports = {
    data: () => ({ 
        global: shared.state,
        obscured: true,
        interval: null,
        enteredText: '',
        filters: {},
        showDist: {},
        hideBody: {},
        selectablePageSizes: PAGE_SIZES,
        pageSize: DEFAULT_PAGE_SIZE,
        fullCount: 0,
        offset: 0,
        ascending: 'no',
        exporting: false,
        messages: [],
        integrityStatus: {}
    }),
    computed: {
        queryString: function() {
            let q = Object.keys(this.filters).map(k => `${k}=${this.filters[k].value}`);
            q.push(`offset=${this.offset}`);
            q.push(`limit=${this.pageSize}`);
            q.push(`ascending=${this.ascending}`);
            q.push(`tzoffset=${(new Date()).getTimezoneOffset()}`);
            return q.join('&').replace("'","");
        },
        pagerDots: function() {
            const count = Math.ceil(this.fullCount / this.pageSize);
            return Array.from(new Array(count), (_, idx) => {
                const isActive = Math.round(this.offset / this.pageSize) === idx;
                const first = this.pageSize * idx + 1;
                const last = Math.min(first + this.pageSize - 1, this.fullCount);
                return {
                    isActive,
                    tooltip: `show${isActive ? 'ing' : ''} ${first}${first != last ? '-' + last : ''}`,
                    go: () => { this.offset = first - 1; }
                }
            });
        },
        scanPercentage: function() {
            return Math.floor(100 * (this.integrityStatus.offset / this.integrityStatus.fullCount));
        }
    },
    watch: {
        queryString: function(val) {
            this.getMessages();
            window.scrollTo(0, 0);
        },
    },
    methods: {
        flipscure: function() { this.obscured = !this.obscured; },
        addTextFilters: function() {
            let text = this.enteredText.trim();

            const warns = /(^|\W)has:\s*(no\s+)?((body|chain|prev(ious)?|attach(ment(s)?)?)\s+)?warn(ing(s)?)?(\W|$)/ig;
            text = extract(text, warns, match => {
                const yesNo = (match[2] || 'yes').toLowerCase().trim();
                let type = (match[4] || 'any').toLowerCase().trim();
                if (type.startsWith('attach')) type = 'attachments';
                if (type.startsWith('prev')) type = 'previous';
                this.$set(this.filters, `${type}Warnings`, { value: yesNo, presentation: `${yesNo === 'no' ? 'NO ' : ''}${type !== 'any' ? type + ' ' : ''}Warnings` });
            });

            const attaches = /(^|\W)has:\s*(no\s+)?attach(ment(s)?)?(\W|$)/ig;
            text = extract(text, attaches, match => this.$set(this.filters, 'attachments', { value: (match[2] || 'yes').toLowerCase().trim(), presentation: `${(match[2] || '').toUpperCase()} Attachments` }));

            const tos = /(^|\W)to:\s*([.:@\w]+)/ig;
            text = extract(text, tos, match => this.$set(this.filters, 'to', { value: match[2], presentation: `To "${match[2]}"` }));

            const froms = /(^|\W)from:\s*([.:@\w]+)/ig;
            text = extract(text, froms, match => this.$set(this.filters, 'from', { value: match[2], presentation: `From "${match[2]}"` }));

            const titles = /(^|\W)title:\s*(.*)$/ig;
            text = extract(text, titles, match => this.$set(this.filters, 'title', { value: match[2], presentation: `Title: ${match[2]}` }));

            if (text) {
                this.$set(this.filters, 'body', { value: text, presentation: `Body: ${text}` });
            }

            this.enteredText = '';
            this.offset = 0;
        },
        addThreadFilter: function(m) {
            this.$set(this.filters, 'threadId', { value: m.threadId, presentation: 'Thread ID' });
            this.offset = 0;
        },
        addUserIdFilter: function(m, direction, idx=-1) {
            const key = direction.toLowerCase() + 'Id';
            const id = (idx < 0) ? m.senderId : m.recipientIds[idx];
            const who = (idx < 0) ? m.senderLabel : m.recipientLabels[idx];
            this.$set(this.filters, key, { value: id, presentation: `${direction} ${who}` });
            this.offset = 0;
        },
        addTimeFilter: function(m, direction) {
            const val = m.receivedMoment.format('YYYY-MM-DD HH:mm:ss.SSSZ');
            this.$set(this.filters, direction.toLowerCase(), { value: val, presentation: `${direction} ${m.receivedMoment.format('lll') }`});
            this.offset = 0;
        },
        removeFilter: function(k) {
            this.$delete(this.filters, k);
            this.offset = 0;
        },
        toggleDist: function(id) {
            this.$set(this.showDist, id, !this.showDist[id])
        },
        distCaret: function(id) {
            return {
                down: !!this.showDist[id],
                right: !this.showDist[id]
            }
        },
        integrityIssues: function(message) {
            let issues = [];
            if (!message.integrity || !message.integrity.misses) return issues;
            if (message.integrity.misses.mainHash) issues.push({text: 'Envelope/Body Integrity Mismatch', time: 'recorded ' + moment(message.integrity.misses.mainHash).format('llll')});
            if (message.integrity.misses.attachmentsHash) issues.push({text: 'Attachments Integrity Mismatch', time: 'recorded ' + moment(message.integrity.misses.attachmentsHash).format('llll')});
            if (message.integrity.misses.previousId) issues.push({text: 'Previous-Message-ID Mismatch', time: 'recorded ' + moment(message.integrity.misses.previousId).format('llll')});
            if (message.integrity.misses.chainHash) issues.push({text: 'Integrity Chain Mismatch', time: 'recorded ' + moment(message.integrity.misses.chainHash).format('llll')});
            return issues;
        },
        attestation: function(message) {
            if (!message.integrity || !message.integrity.verifiedTimestamp) return null;
            return {
                time: moment(message.integrity.verifiedTimestamp * 1000).format('llll'),
                url: `https://opentimestamps.org/info.html?ots=${message.integrity.upgradedOTS}`
            };
        },
        toggleBody: function(id) {
            this.$set(this.hideBody, id, !this.hideBody[id])
        },
        bodyCaret: function(id) {
            return {
                right: !!this.hideBody[id],
                down: !this.hideBody[id]
            }
        },
        bodyVisible: function(id) {
            return !this.hideBody[id];
        },
        getMessages: function() {
            const q = this.queryString;
            util.fetch.call(this, '/api/vault/messages/v1?' + q)
            .then(result => {
                this.messages = result.theJson.messages;
                this.messages.forEach(m => {
                    m.receivedMoment = moment(m.received);
                    m.receivedText = m.receivedMoment.format('llll');
                    if (m.recipientIds.length <= 5 && !(m.messageId in this.showDist)) {
                        this.$set(this.showDist, m.messageId, true);
                    }
                });
                this.fullCount = (this.messages.length && this.messages[0].fullCount) || 0;
                console.log('got messages', this.messages);
            });

            util.fetch.call(this, '/api/vault/integrity/v1')
            .then(result => {
                this.integrityStatus = result.theJson.status;
                console.log('got integrity result', this.integrityStatus);
            });
        },
        beginScan: function() {
            util.fetch.call(this, '/api/vault/integrity/v1', { method: 'post', body: { }})
            .then(result => {
                console.log('initiated integrity scan', result);
            });
        },
        getExport: function() {
            this.exporting = true;
            const q = this.queryString;
            getExport(q, 'application/zip').then(() => { this.exporting = false; });
        },
        getAttachment: function(m, idx) {
            const message = m.payload.find(x => x.version === 1);
            const attachment = message && message.data && message.data.attachments[idx];
            const id = m.attachmentIds[idx];
            getAttachment(m.attachmentIds[idx], attachment.type);
        },
        messageBody: function(m) {
            const message = m.payload.find(x => x.version === 1);
            const tmpText = message.data && message.data.body && message.data.body.find(x => x.type === 'text/plain');
            const text = (tmpText && tmpText.value) || '';
            const tmpHtml = message.data && message.data.body && message.data.body.find(x => x.type === 'text/html');
            let html = (tmpHtml && tmpHtml.value) || '';
            if (this.obscured) html = html.replace('autoplay', 'xautoplay');
            return html || `<p class="plain-text">${text}</p>`;
        },
        threadTitle: function(m) {
            const message = m.payload.find(x => x.version === 1);
            return message.threadTitle || '<thread title not defined>';
        },
        attachmentName: function(m, idx) {
            const message = m.payload.find(x => x.version === 1);
            const attachment = message && message.data && message.data.attachments[idx];
            return attachment && attachment.name;
        },
        threadColor: function(id) {
            // map id to a randomish darkish color from a clumpy, visually-differentiable collection
            const val = parseInt(id.replace('-', ''), 16);
            const hue = (val % 90) * 4;
            const lum = (val % 5) * 10 + 20;
            return { color: `hsl(${hue}, 100%, ${lum}%)` };
        }
    },
    mounted: function() {
        util.checkPrerequisites.call(this);

        this.getMessages();
        this.interval = setInterval(() => this.getMessages(), REFRESH_POLL_RATE); 
    },
    beforeDestroy: function() {
        clearInterval(this.interval);
    }
}
</script>