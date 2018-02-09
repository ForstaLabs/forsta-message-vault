const { Client } = require("pg");

class PGStore {
    constructor(label) {
        this.prefix = label.toLowerCase().replace(/[^a-z0-9_]/g, "_");
        this.client = new Client({
            connectionString: process.env.DATABASE_URL
        });
        this.queryCreateMessageTableIfNeeded = `
            CREATE TABLE IF NOT EXISTS ${this.prefix}_message (
                payload         jsonb,
                received        timestamp,
                distribution    jsonb,

                message_id       uuid PRIMARY KEY,
                thread_id        uuid,
                sender_name      text,
                sender_id        uuid,
                sender_tag       text,
                recipient_names  text,
                recipient_ids    uuid[],
                recipient_tags   text,

                attachment_ids   uuid[],

                ts_main          tsvector,
                ts_title         tsvector
            );`;

        this.queryCreateAttachmentTableIfNeeded = `
            CREATE TABLE IF NOT EXISTS ${this.prefix}_attachment (
                id        uuid PRIMARY KEY,
                data      bytea,
                type      text,
                name      text,
                message_id uuid REFERENCES ${this.prefix}_message
            );`;

        this.queryAddMessage = `
            INSERT INTO ${this.prefix}_message (
                payload,
                received,
                distribution,
                message_id,
                thread_id,
                sender_name,
                sender_id,
                sender_tag,
                recipient_names,
                recipient_ids,
                recipient_tags,
                attachment_ids,
                ts_main,
                ts_title
            ) VALUES (
                $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, to_tsvector($13), to_tsvector($14)
            )`;

        this.queryAddAttachment = `
            INSERT INTO ${this.prefix}_attachment (
                id,
                data,
                type,
                name,
                message_id
            ) VALUES (
                $1, $2, $3, $4, $5
            )`;

        this.queryGetAttachment = `
            SELECT data, type, name FROM ${this.prefix}_attachment WHERE id=$1`;
    }

    async initialize() {
        console.log('starting up db stuff');
        await this.client.connect();
        return [
            this.client.query(this.queryCreateMessageTableIfNeeded),
            this.client.query(this.queryCreateAttachmentTableIfNeeded)
        ];
    }

    async shutdown() {
        console.log('shutting down db stuff');
        await this.client.end();
        this.client = null;
    }

    async addMessage(entry) {
        const {
            payload,
            received,
            distribution,
            messageId,
            threadId,
            senderName,
            senderId,
            senderTag,
            recipientNames,
            recipientIds,
            recipientTags,
            attachmentIds,
            tsMain,
            tsTitle
        } = entry;

        const result = await this.client.query(this.queryAddMessage, [
            payload,
            received,
            distribution,
            messageId,
            threadId,
            senderName,
            senderId,
            senderTag,
            recipientNames && recipientNames.join('<*>'),
            recipientIds,
            recipientTags && recipientTags.join(','),
            attachmentIds,
            tsMain,
            tsTitle
        ]);
        if (result.rowCount !== 1)
            throw new Error("Failure in postgres message insert");
        
        return result;
    }

    async getMessages({ 
            limit, offset, 
            orderby='received', ascending='no', 
            until, since, 
            body, title,
            attachments,
            threadId,
            from, fromTag, fromId,
            to, toTag, toId }) {
        console.warn('TODO: Need to parameterize getMessage to make it safe!');
        const _selectfrom = `SELECT *, count(*) OVER() AS full_count FROM ${this.prefix}_message`;

        const _limit = limit ? `LIMIT ${limit}` : '';
        const _offset = offset ? `OFFSET ${offset}` : '';

        let predicates = [];
        if (until) predicates.push(`received <= '${until}'::timestamp`);
        if (since) predicates.push(`received >= '${since}'::timestamp`);
        if (body) predicates.push(`ts_main @@ plainto_tsquery('${body}')`);
        if (title) predicates.push(`ts_title @@ plainto_tsquery('${title}')`);
        if (threadId) predicates.push(`thread_id = '${threadId}'`);
        if (from) predicates.push(`sender_name ILIKE '%${from}%'`);
        if (fromTag) predicates.push(`sender_tag ILIKE '%${fromTag}%'`);
        if (fromId) predicates.push(`sender_id = '${fromId}'`);
        if (to) predicates.push(`recipient_names ILIKE '%${to}%'`);
        if (toTag) predicates.push(`recipient_tags ILIKE '%${toTag}%'`);
        if (toId) predicates.push(`recipient_ids @> ARRAY['${toId}'::uuid]`);
        if (attachments === 'yes') predicates.push('array_length(attachment_ids, 1) > 0');
        if (attachments === 'no') predicates.push(`attachment_ids = '{}'`);
        const _where = (predicates.length) ? `WHERE ${predicates.join(' AND ')}` : '';

        const _orderby = orderby ? `ORDER BY ${orderby} ${ascending === 'yes' ? 'ASC' : 'DESC'}` : '';

        const query = `${_selectfrom} ${_where} ${_orderby} ${_limit} ${_offset};`;

        console.log('Message query:', query);
        const result = await this.client.query(query);
        
        return result.rows.map(row => {
            return {
                payload: row.payload,
                received: row.received,
                distribution: row.distribution,
                messageId: row.message_id,
                threadId: row.thread_id,
                senderName: row.sender_name,
                senderId: row.sender_id,
                senderTag: row.sender_tag,
                recipientNames: row.recipient_names.split('<*>'),
                recipientIds: row.recipient_ids,
                recipientTags: row.recipient_tags.split(','),
                attachmentIds: row.attachment_ids,
                fullCount: row.full_count
            };
        });
    }

    async addAttachment(entry) {
        const { id, data, type, name, messageId } = entry;

        const result = await this.client.query(this.queryAddAttachment, [
            id,
            data,
            type,
            name,
            messageId
        ]);
        if (result.rowCount !== 1)
            throw new Error("Failure in postgres attachment insert");

        return result;
    }

    async getAttachment(id) {
        const result = await this.client.query(this.queryGetAttachment, [id]);
        if (result.rowCount !== 1)
            throw new Error("Failure in postgres attachment retrieval");

        return result.rows[0];
    }
}

module.exports = PGStore;
