var generic_pool = require('generic-pool');
var couchbase = require('couchbase');
var async = require('async');

var pools = {};

function create_client(settings) {
    var self = {};

    self.KEY_NOT_FOUND_CODE = 13;

    self.connect = function (cb) {
        pools[settings.bucket].acquire(function (err, client) {
            if (err) { return cb(err); }
            client.release = function () { pools[settings.bucket].release(client); };
            cb(null, client);
        });
    };

    if (!pools[settings.bucket]) {
        var bucket_pool = generic_pool.Pool({
            name: 'couchbase_' + settings.bucket,

            create: function connect(cb) {
                // I don't like this "pattern" of calling back and returning.
                var conn = new couchbase.Connection(settings, function (err) {
                    cb(err, conn);

                    conn.on("error", function (message) {
                        console.log("Couchbase ERROR: [" + message + "]");
                    });
                });
            },

            destroy: function (client) {
                client.shutdown();
            },

            max: settings.pool_size || 10,

            idleTimeoutMillis: settings.idle_timeout || 5000,

            log: settings.log || false
        });

        pools[settings.bucket] = bucket_pool;
    }

    self.set = function (key, value, cb) {
        self.connect(function (err, conn) {
            if (err) { return cb(err); }
            if (key) {
                key = key.toString();
            }

            conn.set(key, value, function (err) {
                conn.release();
                if (err) { return cb(err); }

                self.get(key, cb);
            });
        });
    };

    self.get = function (key, cb) {
        self.connect(function (err, conn) {
            if (err) { return cb(err); }

            conn.get(key, function (err, result) {
                conn.release();
                if (err && err.code === self.KEY_NOT_FOUND_CODE) {
                    return cb(null, null);
                }

                cb(err, result);
            });
        });
    };

    self.del = function (key, cb) {
        self.connect(function (err, conn) {
            if (err) { return cb(err); }

            conn.remove(key, function (err) {
                if (err && err.code === self.KEY_NOT_FOUND_CODE) {
                    conn.release();
                    return cb(null, null);
                }

                cb(err, null);
                conn.release();
            });
        });
    };

    self.configure_views = function (config, cb) {
        self.connect(function (err, conn) {
            if (err) { return cb(err); }
            async.each(Object.keys(config), function (design_doc_name, async_cb) {
                conn.setDesignDoc(design_doc_name, config[design_doc_name], async_cb);
            }, function (err) {
                conn.release();
                cb(err);
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
