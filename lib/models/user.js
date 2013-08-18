var couchbase = require('couchbase');
var restify = require('restify');

var cached_connection = null;

function connect(cb) {
    if (cached_connection) {
        return cb(null, cached_connection);
    }

    couchbase.connect(main.settings.couchbase, function (err, conn) {
        cb(err, conn);

        conn.on("error", function (message) {
            console.log("Couchbase ERROR: [" + message + "]");
        });
    });
}

function assert_valid_username(username) {
    var username_regex = /^[a-z0-9_]+$/i;
    if (!username_regex.test(username)) {
        return new restify.InvalidArgumentError('Username invalid');
    }
}

function User(args) {
    var id = args.id || main.utils.random.number(); // poor-man's globally unique ID
    this.id = id.toString();
    this.username = args.username;
}

User.prototype.to_dict = function () {
    return {
        id: this.id,
        username: this.username
    };
};

User.create = function (args, cb) {
    var user = new User(args);
    var data = user.to_dict();
    var err = main.utils.check_required_args(['username'], args);
    if (err) { return cb(err); }

    err = assert_valid_username(args.username);
    if (err) { return cb(err); }

    connect(function (err, conn) {
        if (err) { return cb(err); }

        conn.set(data.id.toString(), data, function (err) {
            if (err) { return cb(err); }
            cb(null, user);
        });
    });
};

User.get = function (args, cb) {
    connect(function (err, conn) {
        if (err) { return cb(err); }

        conn.get(args.id, function (err, raw_user) {
            if (err) { return cb(err); }
            cb(null, new User(raw_user));
        });
    });
};

module.exports = User;
