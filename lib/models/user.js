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
    args = args || {};
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
 * Gets multiple records by id. Ignores any records not found.
 * @param {Object} args
 * @param {Array} args.ids - Array of User ids.
 * @return {Array}
 */
User.get_multi = function (args, cb) {
    var err = main.utils.check_required_args(['ids'], args);
    if (err) { return cb(err); }

    var keys = User._make_keys('id', args.ids);
    couchbase.get_multi(keys, function (err, meta) {
        if (err && err.code !== couchbase.CHECK_RESULTS_CODE) {
            return cb(err);
        }

        var users = [];
        Object.keys(meta).forEach(function (key) {
            if (meta[key].value) {
                users.push(new User(meta[key].value));
            }
        });
        cb(null, users);
    });
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
        var orig_user = new User(user);
        user = main.utils.merge(user, args);
        err = validate(user);
        if (err) { return cb(err); }

        User._set_cas_with_retry(user, meta, retries, args, User.update, function (cas_err, result) {
            // cas_err dealt with below.
            User._destroy_reference_docs({username: orig_user.username, email: orig_user.email}, function (err) {
                if (err) { return cb(err); }

                User._destroy_reference_docs({username: user.username, email: user.email}, function (err) {
                    if (err) { return cb(err); }

                    User._refresh_reference_docs({id: user.id}, function (err) {
                        err = err || cas_err;
                        return cb(err, result);
                    });
                });
            });
        });
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

    User.get(args, function (err, user) {
        if (err || !user) {
            return cb(new restify.ResourceNotFoundError('User not found'));
        }

        var key = User._make_key('id', user.id);

        couchbase.del(key, function (err) {
            if (err) { return cb(err); }
            User._destroy_reference_docs({username: user.username, email: user.email}, cb);
        });
    });
};

/**
 * @private
 * Create a document key.
 */
User._make_key = function (type, val) {
    return prefix + ':' + type + ':' + val.toString().toLowerCase();
};

/**
 * @private
 * Create document keys for each value in an array.
 * @return {Array}
 */
User._make_keys = function (type, vals) {
    var keys = [];
    vals.forEach(function (val) {
        keys.push(User._make_key(type, val));
    });
    return keys;
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
 * TODO: This could of course be refactored and probably abstracted to be model-agnostic.
 */
User._create_reference_docs = function (args, cb) {
    var err = main.utils.check_required_args(['id'], args);
    if (err) { return cb(err); }

    var username_key = User._make_key('username', args.username);
    var email_key = User._make_key('email', args.email);

    async.series({
        create_username_doc: function (async_cb) {
            couchbase.get(username_key, function (err, meta) {
                if (err) { return async_cb(err); }
                if (meta && meta.value) {
                    if (meta.value === args.id) {
                        return async_cb();
                    } else {
                        return async_cb(new errors.ResourceAlreadyExists('username already taken'));
                    }
                }

                couchbase.set(username_key, args.id, null, async_cb);
            });
        },

        create_email_doc: function (async_cb) {
            couchbase.get(email_key, function (err, meta) {
                if (err) { return async_cb(err); }
                if (meta && meta.value) {
                    if (meta.value === args.id) {
                        return async_cb();
                    } else {
                        return async_cb(new errors.ResourceAlreadyExists('email already taken'));
                    }
                }

                couchbase.set(email_key, args.id, null, async_cb);
            });
        }
    }, function (err, result) {
        if (err) {
            // Rollback on error: remove any docs we just created.
            var del_args = {};
            var fields = ['username', 'email'];
            fields.forEach(function (field) {
                if (result['create_' + field + '_doc']) {
                    del_args[field] = args[field];
                }
            });

            User._destroy_reference_docs(del_args, function () {
                cb(err);
            });
        } else {
            cb();
        }
    });
};

User._destroy_reference_docs = function (args, cb) {
    var fields = Object.keys(args);
    if (fields.length === 0) {
        return cb(null, true);
    }

    var processed = 0;

    function check_done() {
        if (++processed === fields.length) {
            return cb(null, true);
        }
    }

    fields.forEach(function (field) {
        var key = User._make_key(field, args[field]);
        couchbase.del(key, function (err) {
            if (err) {
                console.log(err); // TODO: add real logging.
            }
            check_done();
        });
    });
};

/**
 * @private
 * Fetches user from database and refreshes the reference docs.
 */
User._refresh_reference_docs = function (args, cb) {
    User.get(args, function (err, user) {
        if (err) { return cb(err); }
        var ref_args = {
            id: user.id,
            username: user.username,
            email: user.email
        };
        User._create_reference_docs(ref_args, cb);
    });
};

/**
 * @private
 */
User._set_cas_with_retry = function (doc, meta, retries_remaining, retry_args, retry_func, cb) {
    retries_remaining--;

    var key = User._make_key('id', doc.id);
    couchbase.set(key, doc, meta, function (err) {
        if (err && err.code === couchbase.CAS_ERROR_CODE) {
            if (retries_remaining <= 0) {
                return cb(new Error('Failed to save document - too many failed retries'));
            }
            setTimeout(function () {
                retry_func(retry_args, retries_remaining, cb);
            }, User.RETRY_DELAY_MS);
        } else {
            cb(err, true);
        }
    });
};

module.exports = User;
