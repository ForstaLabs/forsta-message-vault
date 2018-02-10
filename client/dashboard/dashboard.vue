
<style>
    h1.ruled { 
        font-size: 28px;
        padding-bottom: 4px;
        border-bottom: 1px lightgray solid !important; 
    }
    div.message-body { padding:5px; overflow: hidden; font-size: 17px; color: black; }
    div.message-body .plain-text { white-space: pre-line; }

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
    .nowrap { white-space: nowrap; }

    div.filter {
        position: sticky;
        top: 75px;
        padding: 1.5em;
        margin-top: -5px;
        padding-top: 0;
        text-align: center;
    }
    div.obscurer {
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
        grid-template-columns: 1fr 3fr 2fr;
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
                <span v-if="dot.isActive" :key="idx" :data-tooltip="dot.tooltip"><i class="red circle icon"></i></span>
                <a v-else :key="idx" :data-tooltip="dot.tooltip" @click="dot.go"><i class="circle icon"></i></a>
            </template>
        </div>
        <div v-for="m in messages" :key="m.messageId" class="ui raised fluid card">
            <div class="content">
                <div class="right floated time">
                    <a data-tooltip='add UNTIL filter' @click="addTimeFilter(m, 'Until')"><i class="chevron left icon"></i></a>
                    <small>{{m.receivedText}}</small>
                    <a class="icobut" data-tooltip='add SINCE filter' @click="addTimeFilter(m, 'Since')"><i class="chevron right icon"></i></a>
                </div>
                <div class="header">
                    <a data-tooltip='add THREAD-ID filter' @click="addThreadFilter(m)"><i class="large comments icon" :style="threadColor(m.threadId)"></i></a>
                    <span class="thread-title" :class="{obscured: obscured}" @click="flipscure">{{threadTitle(m)}}</span>
                </div>
                <div class="meta">{{m.distribution.pretty}}</div>
                <div class="description">
                    from {{m.senderLabel}}
                    <a class="icobut" data-tooltip='add TO-ID filter' @click="addUserIdFilter(m, 'To')"><i class="selected radio icon"></i></a>
                    <a data-tooltip='add FROM-ID filter' @click="addUserIdFilter(m, 'From')"><i class="move icon"></i></a>
                </div>
                <div class="description">
                    <a @click="toggleDist(m.messageId)"><i class="caret icon" :class="distCaret(m.messageId)"></i> 
                    {{m.recipientLabels.length}} recipient{{m.recipientLabels.length ? 's':''}}</a>
                </div>
                <div v-show="showDist[m.messageId]" class="description">
                    <div v-for="(label,idx) in m.recipientLabels" :key="idx" class="recipients">
                        {{label}}
                        <a class="icobut" data-tooltip='add TO-ID filter' @click="addUserIdFilter(m, 'To', idx)"><i class="selected radio icon"></i></a>
                        <a data-tooltip='add FROM-ID filter' @click="addUserIdFilter(m, 'From', idx)"><i class="move icon"></i></a>
                    </div>
                </div>
            </div>
            <div class="content">
                <div class="description">
                    <div @click="flipscure" class="message-body" :class="{obscured: obscured}" v-html="messageBody(m)"></div>
                </div>
            </div>
            <div v-if="m.attachmentIds.length" class="content">
                <a :href="`/api/vault/attachment/${a}/v1`" v-for="(a,i) of m.attachmentIds" class="butspacer ui compact mini button">
                    <i class="download icon"></i> {{attachmentName(m, i)}}
                </a>
            </div>
        </div>
        <div class="pager" style="padding-bottom: 1em;">
            <template v-for="(dot, idx) in pagerDots">
                <span v-if="dot.isActive" :key="idx" :data-tooltip="dot.tooltip"><i class="red circle icon"></i></span>
                <a v-else :key="idx" :data-tooltip="dot.tooltip" @click="dot.go"><i class="circle icon"></i></a>
            </template>
        </div>
    </div>
    <div class="theleft">
        <div class="obscurer" @click="flipscure" v-if="messages.length">
            <div class="clickable ui toggle checkbox">
                <input type="checkbox" v-model="obscured">
                <label>Obscure</label>
            </div>
        </div>
    </div>
    <div class="theright">
        <div class="filter">
            <h1 class="ruled">{{fullCount}} Result{{fullCount == 1 ? '' : 's'}}</h1>
            <div class="filter-section nowrap">
                Showing
                <select v-model="pageSize" class="ui compact selection dropdown" @change="offset=0">
                    <option v-for="limit in selectablePageSizes" :value="limit">{{limit + ' Messages per Page'}}</option>
                </select>
                <select v-model="ascending" class="ui compact selection dropdown">
                    <option value="yes">Oldest First</option>
                    <option value="no">Newest First</option>
                </select>
            </div>
            <div class="filter-section">
                <form v-on:submit.prevent="addTextFilters">
                    <div class="ui fluid input">
                        <input type="text" v-model="enteredText" placeholder="Add and Update Filters">
                    </div>
                    <small><em><span class="nowrap">body words</span> | <span class="nowrap"><b>title:</b>words</span> | <span class="nowrap"><b>to:</b>fragment</span> | <span class="nowrap"><b>from:</b>fragment</span> | <span class="nowrap"><b>has:</b>[no] attach[ment[s]]</span></em></small>
                </form>
            </div>
            <div class="filter-section">
                <a v-for="(v,k) in filters" @click="removeFilter(k)" data-tooltip="click to remove filter" class="butspacer ui compact blue button">
                    <i class="remove icon"></i> {{v.presentation}}
                </a>
            </div>
            <div class="filter-section">
            </div>
            <div v-if="fullCount" class="export">
                <button class="ui fluid button" @click="exportData">Export {{fullCount}} Result{{fullCount == 1 ? '' : 's'}}</button>
            </div>
        </div>
    </div>
</div>
</template>

<script>

moment = require('moment');

const REFRESH_POLL_RATE = 15000;

const PAGE_SIZES = [5, 10, 20, 50, 100, 1000];
const DEFAULT_PAGE_SIZE = PAGE_SIZES[1];

module.exports = {
    data: () => ({ 
        global: shared.state,
        obscured: true,
        interval: null,
        enteredText: '',
        filters: {},
        showDist: {},
        selectablePageSizes: PAGE_SIZES,
        pageSize: DEFAULT_PAGE_SIZE,
        fullCount: 0,
        offset: 0,
        ascending: 'no',
        messages: []
    }),
    computed: {
        queryString: function() {
            let q = Object.keys(this.filters).map(k => `${k}=${this.filters[k].value}`);
            q.push(`offset=${this.offset}`);
            q.push(`limit=${this.pageSize}`);
            q.push(`ascending=${this.ascending}`);
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
        }
    },
    watch: {
        queryString: function(val) {
            this.getMessages();
            window.scrollTo(0, 0);
        },
    },
    methods: {
        flipscure: function() {
            this.obscured = !this.obscured;
        },
        addTextFilters: function() {
            let text = this.enteredText.trim();
            let match = text.match(/(^|\W+)has:\s*(no\s+)?attach(ment(s)?)?(\W+|$)/i);
            if (match) {
                text = text.replace(match[0], ' ').trim();
                this.$set(this.filters, 'attachments', { value: (match[2] || 'yes').toLowerCase().trim(), presentation: `${(match[2]||'').toUpperCase()} Attachments` });
            }
            match = text.match(/(^|\W+)to:\s*(\w+)(\W+|$)/i);
            if (match) {
                text = text.replace(match[0], ' ').trim();
                this.$set(this.filters, 'to', { value: match[2], presentation: `To ${match[2]}` });
            }
            match = text.match(/(^|\W+)from:\s*(\w+)(\W+|$)/i);
            if (match) {
                text = text.replace(match[0], ' ').trim();
                this.$set(this.filters, 'from', { value: match[2], presentation: `From ${match[2]}` });
            }
            match = text.match(/(^|\W+)title:\s*(.*)$/i);
            if (match) {
                text = text.replace(match[0], ' ').trim();
                this.$set(this.filters, 'title', { value: match[2], presentation: `Title: ${match[2]}` });
            }
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
            const id = (idx < 0) ? m.senderId : m.recipientIds[idx];
            const who = (idx < 0) ? m.senderLabel : m.recipientLabels[idx];
            const key = direction.toLowerCase() + 'Id';
            this.$set(this.filters, key, { value: id, presentation: `${direction} ${who}` });
            this.offset = 0;
        },
        addTimeFilter: function(m, direction) {
            const val = m.receivedMoment.format('YYYY-MM-DD HH:mm:ss.SSS');
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
        getMessages: function() {
            const q = this.queryString;
            util.fetch.call(this, '/api/vault/messages/v1?' + q)
            .then(result => {
                this.messages = result.theJson.messages.forEach(m => {
                    m.receivedMoment = moment(m.received);
                    m.receivedText = m.receivedMoment.format('llll');
                });
                this.messages = result.theJson.messages;
                this.fullCount = (this.messages.length && this.messages[0].fullCount) || 0;
            });
        },
        messageBody: function(m) {
            const message = m.payload.find(x => x.version === 1);
            const tmpText = message.data && message.data.body.find(x => x.type === 'text/plain');
            const text = (tmpText && tmpText.value) || '';
            const tmpHtml = message.data && message.data.body.find(x => x.type === 'text/html');
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
            // map id to a darkish color from a clumpy, visually-differentiable collection
            const val = parseInt(id.replace('-', ''), 16);
            const hue = (val % 90) * 4;
            const lum = (val % 5) * 10 + 20;

            return { color: `hsl(${hue}, 100%, ${lum}%)` };
        },
        exportData: function() {
            alert('TBD');
        }
    },
    mounted: function() {
        if (this.global.onboardStatus !== 'complete') {
            this.$router.push({ name: 'welcome' });
            return;
        }
        util.fetch.call(this, '/api/onboard/status/v1')
        .then(result => { 
            this.global.onboardStatus = result.theJson.status;
            if (this.global.onboardStatus !== 'complete') {
                this.$router.push({ name: 'welcome' });
            }
        });

        if (!this.global.apiToken) {
            this.$router.push({ name: 'authenticate', query: { forwardTo: this.$router.path }});
            return;
        }

        this.getMessages();
        this.interval = setInterval(() => this.getMessages(), REFRESH_POLL_RATE); 
    },
    beforeDestroy: function() {
        clearInterval(this.interval);
    }
}
</script>