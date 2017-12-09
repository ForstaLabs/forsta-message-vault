// vim: ts=4:sw=4:expandtab

const crypto = require('crypto');

const _stores = [];


function sha1(data) {
    return crypto.createHash('sha1').update(data).digest('hex');
}

class CacheMiss extends Error {}

class CacheStore {
    constructor(ttl, bucket, jitter) {
        this.ttl = ttl;
        this.bucket = bucket;
        this.jitter = jitter || 1;
    }

    get(key) {
        /* Return hit value or throw CacheMiss if not present or stale. */
        throw new Error("Implementation required");
    }

    set(key, value) {
        throw new Error("Implementation required");
    }

    expiry() {
        /* Jiterized expiration timestamp */
        const skew = 1 + (Math.random() * this.jitter) - (this.jitter / 2);
        return Date.now() + (this.ttl * skew);
    }

    flush() {
    }
}

class MemoryCacheStore extends CacheStore {
    constructor(ttl, bucket, jitter) {
        super(ttl, bucket, jitter);
        this.cache = new Map();
    }

    get(key) {
        if (this.cache.has(key)) {
            const hit = this.cache.get(key);
            if (Date.now() <= hit.expiration) {
                return hit.value;
            } else {
                this.cache.delete(key);
            }
        }
        throw new CacheMiss(key);
    }

    set(key, value) {
        this.cache.set(key, {
            expiration: this.expiry(),
            value
        });
    }

    flush() {
        this.cache = new Map();
    }
}

const ttlCacheBackingStores = {
    memory: MemoryCacheStore
};

exports.ttl = function(expiration, func, options) {
    /* Wrap a static function with a basic Time-To-Live cache.  The `expiration`
     * argument controls how long cached entries should be used for future
     * requests.  The key for a cache lookup is based on the function
     * signature.
     *
     * NOTE: The function being wrapped should be static to avoid corruption.
     */
    options = options || {};
    const ttl = expiration * 1000;
    const Store = ttlCacheBackingStores[options.store || 'memory'];
    if (!Store) {
        throw new TypeError("Invalid store option");
    }
    const bucket = sha1(func.toString() + ttl + JSON.stringify(options));
    const store = new Store(ttl, bucket, options.jitter || 0.20);
    _stores.push(store);
    const locks = new Map();
    return async function wrap() {
        const key = sha1(JSON.stringify(arguments));
        const scope = this;
        const args = arguments;
        while (locks.has(key)) {
            await locks.get(key);
        }
        let lockRelease;
        locks.set(key, new Promise(resolve => lockRelease = resolve));
        try {
            try {
                return await store.get(key);
            } catch(e) {
                if (!(e instanceof CacheMiss)) {
                    throw e;
                }
            }
            const value = await func.apply(scope, args);
            await store.set(key, value);
            return value;
        } finally {
            locks.delete(key);
            lockRelease();
        }
    };
};

exports.flushAll = async function() {
    await Promise.all(_stores.map(x => x.flush()));
};
