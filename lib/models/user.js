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

function validate(user) {
    var err = main.utils.check_required_args(['username', 'email'], user);
    if (err) { return err; }

    err = assert_valid_username(user.username);
    if (err) { return err; }

    err = assert_valid_email(user.email);
    if (err) { return err; }
}


/**
 * @class
 */
function User(args) {
    var id = args.id || main.utils.random.number(); // poor-man's globally unique ID
    this.id = id.toString();
    this.username = args.username;
    this.email = args.email;

}

User.RETRY_DELAY_MS = 10;
User.CAS_RETRIES = 5;

/**
 * @private
 */
User._set_cas_with_retry = function (doc, meta, retries_remaining, retry_args, retry_func, cb) {
    retries_remaining--;

    couchbase.set(doc.id, doc, meta, function (err, meta) {
        if (err && err.code === couchbase.CAS_ERROR_CODE) {
            if (retries_remaining <= 0) {
                return cb(new Error('Failed to save document - too many failed retries'));
            }
            setTimeout(function () {
                retry_func(retry_args, retries_remaining, cb);
            }, User.RETRY_DELAY_MS);
        } else {
            cb(err, true, meta);
        }
    });
};

User.create = function (args, cb) {
    var user = new User(args);
    var err = validate(user);
    if (err) { return cb(err); }
    couchbase.set(user.id, user, function (err, meta) {
        cb(err, user, meta);
    });
};

User.get = function (args, cb) {
    var err = main.utils.check_required_args(['id'], args);
    if (err) { return cb(err); }

    couchbase.get(args.id, function (err, raw_user) {
        if (err) { return cb(err); }
        if (!raw_user || !raw_user.value) {
            // TODO: maybe just return null here.
            return cb(new restify.ResourceNotFoundError('User not found'));
        }
        cb(null, new User(raw_user.value), raw_user);
    });
};

User.update = function (args, retries, cb) {
    if (typeof retries === 'function') {
        cb = retries;
        retries = User.CAS_RETRIES;
    }

    var err = main.utils.check_required_args(['id'], args);
    if (err) { return cb(err); }

    User.get(args, function (err, user, meta) {
        if (err) { return cb(err); }
        user = main.utils.merge(user, args);
        err = validate(user);
        if (err) { return cb(err); }

        User._set_cas_with_retry(user, meta, retries, args, User.update, cb);
    });
};

// TODO: use CAS check
User.destroy = function (args, cb) {
    var err = main.utils.check_required_args(['id'], args);
    if (err) { return cb(err); }

    couchbase.del(args.id, function (err, meta) {
        cb(err, true, meta);
    });
};

module.exports = User;
