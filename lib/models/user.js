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

User.prototype.to_dict = function () {
    return {
        id: this.id,
        username: this.username,
        email: this.email
    };
};

User.create = function (args, cb) {
    var user = new User(args);
    var data = user.to_dict();
    var err = main.utils.check_required_args(['username', 'email'], args);
    if (err) { return cb(err); }

    err = assert_valid_username(args.username);
    if (err) { return cb(err); }

    err = assert_valid_email(args.email);
    if (err) { return cb(err); }

    couchbase.set(data.id, data, function (err) {
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

        err = assert_valid_username(user.username);
        if (err) { return cb(err); }

        err = assert_valid_email(user.email);
        if (err) { return cb(err); }

        couchbase.set(user.id, user, function (err) {
            if (err) { return cb(err); }
            cb(null, true);
        });
    });
};

module.exports = User;
