var generic_pool = require('generic-pool');
var couchbase = require('couchbase');

var pools = {};

function create_client(settings) {
    var self = {};

    self.connect = function (cb) {
        pools[settings.bucket].acquire(function (err, client) {
            if (err) {
                client = {release: function () {}};
                return cb(err, client);
            }
            client.release = function () { pools[settings.bucket].release(client); };
            cb(null, client);
        });
    };

    if (!pools[settings.bucket]) {
        var bucket_pool = generic_pool.Pool({
            name: 'couchbase_' + settings.bucket,

            create: function connect(cb) {
                couchbase.connect(settings, function (err, conn) {
                    cb(err, conn);

                    conn.on("error", function (message) {
                        console.log("Couchbase ERROR: [" + message + "]");
                    });
                });
            },

            destroy: function (/*client*/) {
                // Not sure how to close the client.
                //client.end();
            },

            max: settings.pool_size || 10,

            idleTimeoutMillis: settings.idle_timeout || 5000,

            log: settings.log || false
        });

        pools[settings.bucket] = bucket_pool;
    }

    self.set = function (key, value, cb) {
        self.connect(function (err, conn) {
            if (err) { conn.release(); return cb(err); }

            conn.set(key, value, function (err) {
                if (err && err.code === self.KEY_NOT_FOUND_CODE) {
                    conn.release();
                    return cb(null, null);
                }

                if (err) { conn.release(); return cb(err); }
                conn.release();

                self.get(key, cb);
            });
        });
    };

    self.get = function (key, cb) {
        self.connect(function (err, conn) {
            if (err) { conn.release(); return cb(err); }

            conn.get(key, function (err, result) {
                if (err && err.code === self.KEY_NOT_FOUND_CODE) {
                    conn.release();
                    return cb(null, null);
                }

                cb(err, result);
                conn.release();
            });
        });
    };

    return self;
}

var client = (function () {
    var pool_cache = {};

    function fetch(settings) {
        var cache_key = JSON.stringify(settings);
        if (!pool_cache[cache_key]) {
            pool_cache[cache_key] = create_client(settings);
        }
        return pool_cache[cache_key];
    }

    return fetch;
}());

module.exports = client;
