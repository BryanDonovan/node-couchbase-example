var async = require('async');
var restify = require('restify');
var errors = require('../errors');
var couchbase = require('../couchbase').client(main.settings.couchbase.connection);
var prefix = main.settings.couchbase.key_prefix;
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
 * @public
 * Create a new user.
 */
User.create = function (args, cb) {
    var user = new User(args);
    var err = validate(user);
    if (err) { return cb(err); }

    User._create_reference_docs(user, function (err) {
        if (err) { return cb(err); }

        var key = User._make_key('id', user.id);
        couchbase.set(key, user, function (err, meta) {
            cb(err, user, meta);
        });
    });
};

/**
 * @public
 * Get an existing user.
 */
User.get = function (args, cb) {
    var err = main.utils.check_required_args(['id'], args);
    if (err) { return cb(err); }

    var key = User._make_key('id', args.id);
    couchbase.get(key, function (err, meta) {
        if (err) { return cb(err); }
        if (!meta || !meta.value) {
            // TODO: maybe just return null here.
            return cb(new restify.ResourceNotFoundError('User not found'));
        }
        cb(null, new User(meta.value), meta);
    });
};

/**
 * @public
 * Get an existing user by username.
 */
User.get_by_username = function (username, cb) {
    User._get_by_field('username', username, cb);
};

/**
 * @public
 * Get an existing user by email.
 */
User.get_by_email = function (email, cb) {
    User._get_by_field('email', email, cb);
};

/**
 * @public
 * Update an existing user.
 */
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

/**
 * @public
 * Destroy an existing user.
 * NOTE: Ignoring CAS for deletes for now.
 */
User.destroy = function (args, cb) {
    var err = main.utils.check_required_args(['id'], args);
    if (err) { return cb(err); }

    var key = User._make_key('id', args.id);
    couchbase.del(key, function (err, meta) {
        cb(err, true, meta);
    });
};


/**
 * @private
 * Create a document key.
 */
User._make_key = function (type, val) {
    return prefix + ':' + type + ':' + val;
};

/**
 * @private
 */
User._get_by_field = function (field, value, cb) {
    var key = User._make_key(field, value);
    couchbase.get(key, function (err, meta) {
        if (err) { return cb(err); }
        if (!meta || !meta.value) {
            return cb(new restify.ResourceNotFoundError('User not found'));
        }

        User.get({id: meta.value}, cb);
    });
};

/**
 * @private
 */
User._create_reference_docs = function (user, cb) {
    async.series({
        create_username_doc: function (async_cb) {
            var username_key = User._make_key('username', user.username);
            couchbase.get(username_key, function (err, meta) {
                if (err) { return async_cb(err); }
                if (meta && meta.value) {
                    return async_cb(new errors.ResourceAlreadyExists('username already taken'));
                }

                couchbase.set(username_key, user.id, async_cb);
            });
        },

        create_email_doc: function (async_cb) {
            var email_key = User._make_key('email', user.email);
            couchbase.get(email_key, function (err, meta) {
                if (err) { return async_cb(err); }
                if (meta && meta.value) {
                    return async_cb(new errors.ResourceAlreadyExists('email already taken'));
                }

                couchbase.set(email_key, user.id, async_cb);
            });
        }
    }, cb);
};

/**
 * @private
 */
User._set_cas_with_retry = function (doc, meta, retries_remaining, retry_args, retry_func, cb) {
    retries_remaining--;

    var key = User._make_key('id', doc.id);
    couchbase.set(key, doc, meta, function (err, meta) {
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

module.exports = User;
