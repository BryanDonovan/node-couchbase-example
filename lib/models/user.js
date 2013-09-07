var restify = require('restify');
var couchbase = require('../couchbase').client(main.settings.couchbase.connection);
var regexes = {
    username: /^[a-z0-9_]+$/i,
    email: /^(([^<>()[\]\\.,;:\s@\"]+(\.[^<>()[\]\\.,;:\s@\"]+)*)|(\".+\"))@((\[[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\])|(([a-zA -Z\-0-9]+\.)+[a-zA-Z]{2,}))$/
};

function assert_valid_username(username) {
    if (!regexes.username.test(username)) {
        return new restify.InvalidArgumentError('Username invalid');
    }
}

function assert_valid_email(email) {
    if (!regexes.email.test(email)) {
        return new restify.InvalidArgumentError('Email invalid');
    }
}

function User(args) {
    var id = args.id || main.utils.random.number(); // poor-man's globally unique ID
    this.id = id.toString();
    this.username = args.username;
    this.email = args.email;
}

User.create = function (args, cb) {
    var user = new User(args);
    user.save(function (err) {
        cb(err, user);
    });
};

User.get = function (args, cb) {
    var err = main.utils.check_required_args(['id'], args);
    if (err) { return cb(err); }

    couchbase.get(args.id, function (err, raw_user) {
        if (err) { return cb(err); }
        if (!raw_user || !raw_user.value) {
            return cb(new restify.ResourceNotFoundError('User not found'));
        }
        cb(null, new User(raw_user.value));
    });
};

User.update = function (args, cb) {
    User.get(args, function (err, user) {
        if (err) { return cb(err); }
        user = main.utils.merge(user, args);
        user.save(cb);
    });
};

User.prototype.save = function (cb) {
    var self = this;

    var err = main.utils.check_required_args(['username', 'email'], self);
    if (err) { return cb(err); }

    err = assert_valid_username(self.username);
    if (err) { return cb(err); }

    err = assert_valid_email(self.email);
    if (err) { return cb(err); }

    couchbase.set(self.id, self, function (err) {
        if (err) { return cb(err); }
        cb(null, true);
    });
};

module.exports = User;
