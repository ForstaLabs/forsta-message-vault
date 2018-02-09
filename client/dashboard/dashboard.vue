<style>
    div.clipped { overflow: hidden; }
    div.recipients { margin-left: 1em; }
    a.butspacer { margin-bottom: .25em!important; }
    a.prev-arrow { float: left; }
    a.next-arrow { float: right; }

    div.filter {
        position: sticky;
        top: 141px;
        margin: 2em;
        text-align: center;
    }
    .thelayout {
        margin-top: 80px;
        display: grid;
        grid-template-columns: 1fr 3fr 2fr;
        grid-template-areas: "gleft gmiddle gright";
    }
    .theleft {
        grid-area: gleft;
    }
    .themiddle {
        grid-area: gmiddle;
    }
    .theright {
        grid-area: gright;
        min-height: 50vh;
    }

    table.pager {
        width: 100%;
        font-size: 200%;
        min-height: 48px;
        user-select: none;
    }
    table.pager td {
        width: 33%;
        white-space:nowrap;
    }
    table.pager td.tmid { text-align: center; }
    table.pager td.tleft { text-align: right; }
    table.pager td.tright { text-align: left; }
</style>

<template>
<div class="thelayout">
    <div class="theright">
        <div class="filter">
            <form v-on:submit.prevent="addTextFilter">
                <div class="ui action fluid input">
                    <input type="text" v-model="enteredText" placeholder="Add Search Filter...">
                    <select v-model="selectedTextFilter" class="ui compact selection dropdown">
                        <option v-for="f in selectableTextFilters" :value="f.key">{{f.description}}</option>
                    </select>
                    <button type="submit" class="ui button">Add</button>
                </div>
            </form>
            <br />
            <div v-for="(v, k) in filters" :key="k" class="ui label">
                {{v.presentation}} <i class="delete icon" v-on:click="removeFilter(k)"></i> 
            </div>
        </div>
    </div>
    <div class="theleft">
    </div>
    <div class="themiddle">
        <table class="pager">
            <tr>
                <td class="tleft">
                    &nbsp;
                    <a v-if="offerFirstPage" data-tooltip="first page" data-position="bottom left" v-on:click="firstPage"><i class="large angle double left icon"></i></a>
                    <a v-if="offerPrevPage" data-tooltip="previous page" data-position="bottom left" v-on:click="prevPage"><i class="large angle left icon"></i></a>
                </td>
                <td class="tmid">
                    {{rangeStart}}{{rangeEnd}}&nbsp;{{fullCount}} results
                </td>
                <td class="tright">
                    <a v-if="offerNextPage" data-tooltip="next page" data-position="bottom left" v-on:click="nextPage"><i class="large angle right icon"></i></a>
                    <a v-if="offerLastPage" data-tooltip="last page" data-position="bottom left" v-on:click="lastPage"><i class="large angle double right icon"></i></a>
                    &nbsp;
                </td>
            </tr>
        </table>
        <div v-for="m in messages" :key="m.messageId" class="ui raised fluid card">
            <div class="content">
                <div class="right floated time">
                    <a data-tooltip='add BEFORE filter'><i class="chevron left icon"></i></a>
                    <small>{{m.receivedText}}</small>
                    <a data-tooltip='add AFTER filter'><i class="chevron right icon"></i></a>
                </div>
                <div class="header">
                    <a data-tooltip='add THREAD filter' v-on:click="addThreadFilter(m)"><i class="large comments icon" :style="threadColor(m.threadId)"></i></a>
                    {{threadTitle(m)}} 
                </div>
                <div class="meta">{{m.distribution.pretty}}</div>
                <div class="description">
                    from
                    {{m.senderTag}} ({{m.senderName}})
                    <a data-tooltip='add TO filter' v-on:click="addUserIdFilter(m, 'to')"><i class="reply icon"></i></a>
                    <a data-tooltip='add FROM filter' v-on:click="addUserIdFilter(m, 'from')"><i class="share icon"></i></a>
                </div>
                <div class="description">
                    <a v-on:click="toggleDist(m.messageId)"><i class="caret icon" :class="distCaret(m.messageId)"></i> 
                    {{m.recipientTags.length}} recipient{{m.recipientTags.length ? 's':''}}</a>
                </div>
                <div v-show="showDist[m.messageId]" class="description">
                    <div v-for="(r,i) in m.recipientTags" :key="r" class="recipients">
                        to {{r}} ({{m.recipientNames[i]}})
                        <a data-tooltip='add TO filter' v-on:click="addUserIdFilter(m, 'to', i)"><i class="reply icon"></i></a>
                        <a data-tooltip='add FROM filter' v-on:click="addUserIdFilter(m, 'from', i)"><i class="share icon"></i></a>
                    </div>
                </div>
            </div>
            <div class="content">
                <div class="description">
                    <div class="clipped" v-html="messageBody(m)"></div>
                </div>
            </div>
            <div v-if="m.attachmentIds.length" class="content">
                <a :href="`/api/vault/attachment/${a}/v1`" v-for="(a,i) of m.attachmentIds" class="butspacer ui compact mini button">
                    <i class="download icon"></i> {{attachmentName(m, i)}}
                </a>
            </div>
        </div>
    </div>
</div>
</template>

<script>

moment = require('moment');

const REFRESH_POLL_RATE = 5000;

const TEXT_FILTERS = [
    { key: 'body', description: 'Body Words' },
    { key: 'title', description: 'Title Words' },
    { key: 'to', description: 'To Name' },
    { key: 'toTag', description: 'To Tag' },
    { key: 'from', description: 'From Name' },
    { key: 'fromTag', description: 'From Tag' }
];
const DEFAULT_TEXT_FILTER = TEXT_FILTERS[0].key;

const PAGE_SIZES = [5, 10, 20, 50, 100];
const DEFAULT_PAGE_SIZE = PAGE_SIZES[0];

module.exports = {
    data: () => ({ 
        global: shared.state,
        interval: null,
        enteredText: '',
        selectableTextFilters: TEXT_FILTERS,
        selectedTextFilter: DEFAULT_TEXT_FILTER,
        filters: {},
        showDist: {},
        selectablePageSizes: PAGE_SIZES,
        pageSize: DEFAULT_PAGE_SIZE,
        fullCount: 0,
        offset: 0,
        messages: []
    }),
    computed: {
        queryString: function() {
            let q = Object.keys(this.filters).map(k => `${k}=${this.filters[k].value}`);
            q.push(`offset=${this.offset}`);
            q.push(`limit=${this.pageSize}`);
            return q.join('&');
        },
        rangeStart: function() {
            return (this.offset > 0) ? `${this.offset + 1}-` : '';
        },
        rangeEnd: function() {
            const last = this.messages.length + this.offset;
            return (this.offset > 0 || last < this.fullCount) ? `${last} of` : '';
        },
        offerFirstPage: function() {
            return this.offset > this.pageSize;
        },
        offerPrevPage: function() {
            return this.offset > 0;
        },
        offerNextPage: function() {
            return this.offset + this.pageSize < this.fullCount;
        },
        offerLastPage: function() {
            return this.offset + this.pageSize < this.fullCount - this.pageSize;
        },
    },
    watch: {
        queryString: function(val) {
            this.getMessages();
        }
    },
    methods: {
        firstPage: function() {
            this.offset = 0;
            console.log('firstPage', this.offset);
        },
        prevPage: function() {
            this.offset = Math.max(0, this.offset - this.pageSize);
            console.log('prevPage', this.offset);
        },
        nextPage: function() {
            this.offset = Math.min(this.fullCount - this.pageSize, this.offset + this.pageSize);
            console.log('nextPage', this.offset);
        },
        lastPage: function() {
            this.offset = Math.max(0, this.fullCount - this.pageSize);
            console.log('lastPage', this.offset);
        },
        addTextFilter: function() {
            const filt = this.selectableTextFilters.find(x => x.key === this.selectedTextFilter);
            const text = this.enteredText.trim();
            if (!filt || !text) return;
            console.log(`adding ${filt.description} filter for "${text}"`);
            this.$set(this.filters, filt.key, { value: text, presentation: `${filt.description}: ${text}` });
            this.enteredText = '';
            this.offset = 0;
        },
        addThreadFilter: function(m) {
            this.$set(this.filters, 'threadId', { value: m.threadId, presentation: 'Thread by ID' });
            this.offset = 0;
        },
        addUserIdFilter: function(m, direction, idx=-1) {
            const id = (idx < 0) ? m.senderId : m.recipientIds[idx];
            const who = (idx < 0) ? `${m.senderTag} (${m.senderName})` : `${m.recipientTags[idx]} (${m.recipientNames[idx]})`;
            const key = direction + 'Id';
            this.$set(this.filters, key, { value: id, presentation: `${direction} ${who}` });
            this.offset = 0;
        },
        removeFilter: function(k) {
            console.log(`removing ${k} from filters`);
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
            console.log('messages query:', q);
            util.fetch.call(this, '/api/vault/messages/v1?' + q)
            .then(result => {
                console.log('received messages:', result.theJson.messages);
                this.messages = result.theJson.messages.forEach(m => {
                    m.received = moment(m.received);
                    m.receivedText = m.received.format('llll');
                });
                this.messages = result.theJson.messages;
                this.fullCount = (this.messages.length && this.messages[0].fullCount) || 0;
            });
        },
        messageBody: function(m) {
            const message = m.payload.find(x => x.version === 1);
            const tmpText = message.data && message.data.body.find(x => x.type === 'text/plain');
            const tmpHtml = message.data && message.data.body.find(x => x.type === 'text/html');
            return (tmpHtml && tmpHtml.value) || `<p style="white-space: pre-line">${(tmpText && tmpText.value) || ''}</p>`;
        },
        threadTitle: function(m) {
            const message = m.payload.find(x => x.version === 1);
            return message.threadTitle || '<title not defined>';
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