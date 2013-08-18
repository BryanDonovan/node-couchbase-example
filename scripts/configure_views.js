#!/usr/bin/env node
process.env.NODE_ENV = 'test';
require('../lib/index');
var bucket = 'default';
var couchbase = main.couchbase.client({bucket: bucket});
var view_configs = main.settings.couchbase.views;

function configure_views(cb) {
    var config = view_configs[bucket];
    couchbase.configure_views(config, cb);
}

configure_views(function (err) {
    if (err) { throw err; }
    console.log("\nDone");
    process.exit();
});
