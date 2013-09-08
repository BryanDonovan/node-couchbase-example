var assert = require('assert');
var sinon = require('sinon');
var async = require('async');
var support = require('../support');
var User = main.models.User;
var couchbase = main.couchbase.client(main.settings.couchbase.connection);

describe("User model", function () {
    var user_args;

    beforeEach(function () {
        user_args = {
            username: support.random.string(),
            email: support.random.email()
        };
    });

    describe("instantiating", function () {
        it("lets us set a username", function () {
            var user = new User(user_args);
            assert.strictEqual(user.username, user_args.username);
        });

        it("lets us set an id and casts it to a string", function () {
            user_args.id = support.random.number();
            var user = new User(user_args);
            assert.strictEqual(user.id, user_args.id.toString());
        });

        it("sets a random id if not provided", function () {
            var num = support.random.number();
            sinon.stub(main.utils.random, 'number').returns(num);

            var user = new User(user_args);
            assert.ok(main.utils.random.number.called);
            assert.strictEqual(user.id, num.toString());
            assert.strictEqual(user.username, user_args.username);
            main.utils.random.number.restore();
        });
    });

    describe("create()", function () {
        context("when no username provided", function () {
            it("calls back with a MissingParameter error", function (done) {
                delete user_args.username;

                User.create(user_args, function (err) {
                    assert.equal(err.restCode, 'MissingParameter');
                    done();
                });
            });
        });

        context("when username contains non-allowed characters", function () {
            it("calls back with an InvalidArgument error", function (done) {
                user_args.username = '@#$@#$foo';

                User.create(user_args, function (err) {
                    assert.equal(err.restCode, 'InvalidArgument');
                    assert.ok(err.message.match(/username/i));
                    done();
                });
            });
        });

        context("when no email provided", function () {
            it("calls back with a MissingParameter error", function (done) {
                delete user_args.email;

                User.create(user_args, function (err) {
                    assert.equal(err.restCode, 'MissingParameter');
                    done();
                });
            });
        });

        context("when email is invalid", function () {
            it("calls back with an InvalidArgument error", function (done) {
                user_args.email = 'foo.bar.com';

                User.create(user_args, function (err) {
                    assert.equal(err.restCode, 'InvalidArgument');
                    assert.ok(err.message.match(/email/i));
                    done();
                });
            });
        });

        context("when args are valid", function () {
            it("returns the newly-created record", function (done) {
                User.create(user_args, function (err, result) {
                    assert.ifError(err);
                    assert.ok(result);
                    assert.ok(result.id);
                    assert.equal(result.username, user_args.username);
                    assert.ok(result instanceof User);

                    User.destroy(result, done);
                });
            });
        });

        context("uniqueneness constraints", function () {
            context("when email already taken by another user", function () {
                beforeEach(function (done) {
                    User.create(user_args, done);
                });

                it("calls back with ResourceAlreadyExists", function (done) {
                    user_args.username = support.random.string();

                    User.create(user_args, function (err) {
                        assert.equal(err.restCode, 'ResourceAlreadyExists');
                        assert.ok(err.message.match(/email/));
                        done();
                    });
                });

                it("doesn't leave dangling references", function (done) {
                    user_args.username = support.random.string();

                    User.create(user_args, function (err) {
                        assert.ok(err);
                        var username_key = User._make_key('username', user_args.username);

                        couchbase.get(username_key, function (err, result) {
                            assert.ifError(err);
                            assert.strictEqual(result, null);
                            done();
                        });
                    });
                });
            });

            context("when username already taken by another user", function () {
                beforeEach(function (done) {
                    User.create(user_args, done);
                });

                it("calls back with ResourceAlreadyExists", function (done) {
                    user_args.email = support.random.email();

                    User.create(user_args, function (err) {
                        assert.equal(err.restCode, 'ResourceAlreadyExists');
                        assert.ok(err.message.match(/username/));
                        done();
                    });
                });

                it("doesn't leave dangling references", function (done) {
                    user_args.email = support.random.email();

                    User.create(user_args, function (err) {
                        assert.ok(err);
                        var email_key = User._make_key('email', user_args.email);

                        couchbase.get(email_key, function (err, result) {
                            assert.ifError(err);
                            assert.strictEqual(result, null);
                            done();
                        });
                    });
                });
            });
        });
    });

    describe("get()", function () {
        context("when user exists", function () {
            var user;

            beforeEach(function (done) {
                User.create(user_args, function (err, result) {
                    assert.ifError(err);
                    user = result;
                    done();
                });
            });

            afterEach(function (done) {
                User.destroy(user, done);
            });

            it("returns the user record", function (done) {
                User.get({id: user.id}, function (err, result) {
                    assert.ifError(err);
                    assert.ok(result);
                    assert.equal(result.id, user.id);
                    assert.ok(result instanceof User);
                    done();
                });
            });
        });

        context("when couchbase client.get() calls back with an error", function () {
            it("bubbles up that error", function (done) {
                var fake_err = support.fake_error();

                sinon.stub(couchbase, 'get', function (args, cb) {
                    cb(fake_err);
                });

                var fake_id = support.random.number().toString();

                User.get({id: fake_id}, function (err) {
                    assert.equal(err, fake_err);
                    couchbase.get.restore();
                    done();
                });
            });
        });

        context("when id not provided", function () {
            it("it calls back with MissingParameter error", function (done) {
                User.get({}, function (err) {
                    assert.equal(err.restCode, 'MissingParameter');
                    assert.ok(err.message.match(/id/i));
                    done();
                });
            });
        });

        context("when id not found", function () {
            it("it calls back with ResourceNotFound error", function (done) {
                var fake_id = support.random.number().toString();

                User.get({id: fake_id}, function (err) {
                    assert.equal(err.restCode, 'ResourceNotFound');
                    done();
                });
            });
        });
    });

    describe("get_by_username()", function () {
        var user;

        context("when user does not exist", function () {
            it("calls back with ResourceNotFound error", function (done) {
                User.get_by_username(user_args.username, function (err) {
                    assert.equal(err.restCode, 'ResourceNotFound');
                    done();
                });
            });
        });

        context("when user exists", function () {
            beforeEach(function (done) {
                User.create(user_args, function (err, result) {
                    assert.ifError(err);
                    user = result;
                    done();
                });
            });

            it("returns the matching user", function (done) {
                User.get_by_username(user_args.username, function (err, result) {
                    assert.ifError(err);
                    assert.deepEqual(result, user);
                    done();
                });
            });
        });
    });

    describe("get_by_email()", function () {
        var user;

        context("when user does not exist", function () {
            it("calls back with ResourceNotFound error", function (done) {
                User.get_by_email(user_args.email, function (err) {
                    assert.equal(err.restCode, 'ResourceNotFound');
                    done();
                });
            });
        });

        context("when user exists", function () {
            beforeEach(function (done) {
                User.create(user_args, function (err, result) {
                    assert.ifError(err);
                    user = result;
                    done();
                });
            });

            it("returns the matching user", function (done) {
                User.get_by_email(user_args.email, function (err, result) {
                    assert.ifError(err);
                    assert.deepEqual(result, user);
                    done();
                });
            });
        });
    });

    describe("update()", function () {
        var user;
        var update_args;

        beforeEach(function (done) {
            User.create(user_args, function (err, result) {
                assert.ifError(err);
                user = result;

                update_args = {
                    id: user.id
                };

                done();
            });
        });

        afterEach(function (done) {
            User.destroy(user, done);
        });

        context("when no id provided", function () {
            it("calls back with a MissingParameter error", function (done) {
                delete update_args.id;

                User.update(update_args, function (err) {
                    assert.equal(err.restCode, 'MissingParameter');
                    assert.ok(err.message.match(/id/i));
                    done();
                });
            });
        });

        context("when user not found", function () {
            it("calls back with a ResourceNotFound error", function (done) {
                update_args.id = support.random.number();

                User.update(update_args, function (err) {
                    assert.equal(err.restCode, 'ResourceNotFound');
                    done();
                });
            });
        });

        context("when args are valid", function () {
            beforeEach(function () {
                update_args.username = support.random.string();
                update_args.email = support.random.email();
            });

            context("when new username and email are provided", function () {
                it("updates username and email", function (done) {
                    User.update(update_args, function (err, result) {
                        assert.ifError(err);
                        assert.equal(result, true);

                        User.get({id: user.id}, function (err, updated_user) {
                            assert.ifError(err);
                            assert.equal(updated_user.username, update_args.username);
                            assert.equal(updated_user.email, update_args.email);
                            done();
                        });
                    });
                });

                it("doesn't leave dangling references", function (done) {
                    var orig_username_key = User._make_key('username', user.username);
                    var orig_email_key = User._make_key('email', user.email);

                    User.update(update_args, function (err) {
                        assert.ifError(err);

                        couchbase.get(orig_username_key, function (err, result) {
                            assert.ifError(err);
                            assert.strictEqual(result, null);

                            couchbase.get(orig_email_key, function (err, result) {
                                assert.ifError(err);
                                assert.strictEqual(result, null);
                                done();
                            });
                        });
                    });
                });

                it.skip("creates new references", function (done) {
                    done();
                });
            });

            context("when only id and username are provided", function () {
                it("updates the username, not email", function (done) {
                    delete update_args.email;

                    User.update(update_args, function (err, result) {
                        assert.ifError(err);
                        assert.equal(result, true);

                        User.get({id: user.id}, function (err, updated_user) {
                            assert.ifError(err);
                            assert.equal(updated_user.username, update_args.username);
                            assert.equal(updated_user.email, user.email);
                            done();
                        });
                    });
                });
            });

            context("when only id and email are provided", function () {
                it("updates the email, not username", function (done) {
                    delete update_args.username;

                    User.update(update_args, function (err, result) {
                        assert.ifError(err);
                        assert.equal(result, true);

                        User.get({id: user.id}, function (err, updated_user) {
                            assert.ifError(err);
                            assert.equal(updated_user.username, user.username);
                            assert.equal(updated_user.email, update_args.email);
                            done();
                        });
                    });
                });
            });
        });

        context("when username contains non-allowed characters", function () {
            it("calls back with an InvalidArgument error", function (done) {
                update_args.username = '@#$@#$foo';

                User.update(update_args, function (err) {
                    assert.equal(err.restCode, 'InvalidArgument');
                    assert.ok(err.message.match(/username/i));
                    done();
                });
            });
        });

        context("when email is invalid", function () {
            it("calls back with an InvalidArgument error", function (done) {
                update_args.email = 'foo.bar.com';

                User.update(update_args, function (err) {
                    assert.equal(err.restCode, 'InvalidArgument');
                    assert.ok(err.message.match(/email/i));
                    done();
                });
            });
        });

        context("when couchbase client.set() calls back with an error", function () {
            it("bubbles up that error", function (done) {
                var fake_err = support.fake_error();

                sinon.stub(couchbase, 'set', function (key, args, meta, cb) {
                    cb(fake_err);
                });

                User.update(update_args, function (err) {
                    assert.equal(err, fake_err);
                    couchbase.set.restore();
                    done();
                });
            });
        });

        context("when updating the same user multiple times, simultaneously", function () {
            it("the correct values should be saved each time", function (done) {
                var nbr_of_runs = 10;
                var runs = [];

                for (var i = 0; i < nbr_of_runs; i++) {
                    runs.push(i);
                }

                async.eachSeries(runs, function (run, async_cb) {
                    var username = support.random.string();
                    var email = support.random.email();

                    async.parallel({
                        update_username: function (parallel_cb) {
                            var args = support.shallow_clone(update_args);
                            args.username = username;
                            User.update(args, parallel_cb);
                        },

                        update_email: function (parallel_cb) {
                            var args = support.shallow_clone(update_args);
                            args.email = email;
                            User.update(args, parallel_cb);
                        },
                    }, function (err) {
                        if (err) { return async_cb(err); }

                        User.get({id: user.id}, function (err, updated_user) {
                            assert.ifError(err);
                            assert.equal(updated_user.username, username);
                            assert.equal(updated_user.email, email);
                            async_cb();
                        });
                    });
                }, done);
            });

            context("when we run out of CAS retries", function () {
                var orig_retries = User.CAS_RETRIES;

                beforeEach(function () {
                    User.CAS_RETRIES = 0;
                });

                afterEach(function () {
                    User.CAS_RETRIES = orig_retries;
                });

                it("calls back with a 'too many failed retries' error", function (done) {
                    var nbr_of_runs = 5;
                    var runs = [];

                    for (var i = 0; i < nbr_of_runs; i++) {
                        runs.push(i);
                    }

                    async.eachSeries(runs, function (run, async_cb) {
                        var username = support.random.string();
                        var email = support.random.email();

                        async.parallel({
                            update_username: function (parallel_cb) {
                                var args = support.shallow_clone(update_args);
                                args.username = username;
                                User.update(args, parallel_cb);
                            },

                            update_email: function (parallel_cb) {
                                var args = support.shallow_clone(update_args);
                                args.email = email;
                                User.update(args, parallel_cb);
                            },
                        }, async_cb);
                    }, function (err) {
                        assert.ok(err.message.match(/too many failed retries/i));
                        done();
                    });
                });
            });
        });
    });

    describe("destroy()", function () {
        context("when user exists", function () {
            var user;

            beforeEach(function (done) {
                User.create(user_args, function (err, result) {
                    assert.ifError(err);
                    user = result;
                    done();
                });
            });

            it("returns true", function (done) {
                User.destroy({id: user.id}, function (err, result) {
                    assert.ifError(err);
                    assert.strictEqual(result, true);
                    done();
                });
            });

            it("removes the record", function (done) {
                User.destroy({id: user.id}, function (err) {
                    assert.ifError(err);

                    User.get({id: user.id}, function (err) {
                        assert.equal(err.restCode, 'ResourceNotFound');
                        done();
                    });
                });
            });

            it("doesn't leave dangling references", function (done) {
                User.destroy({id: user.id}, function (err) {
                    assert.ifError(err);

                    var username_key = User._make_key('username', user_args.username);
                    var email_key = User._make_key('email', user_args.email);

                    couchbase.get(username_key, function (err, result) {
                        assert.ifError(err);
                        assert.strictEqual(result, null);

                        couchbase.get(email_key, function (err, result) {
                            assert.ifError(err);
                            assert.strictEqual(result, null);
                            done();
                        });
                    });
                });
            });

            context("when couchbase client.del() calls back with an error", function () {
                it("bubbles up that error", function (done) {
                    var fake_err = support.fake_error();

                    sinon.stub(couchbase, 'del', function (args, cb) {
                        cb(fake_err);
                    });

                    User.destroy({id: user.id}, function (err) {
                        assert.equal(err, fake_err);
                        couchbase.del.restore();

                        User.destroy({id: user.id}, done); // cleanup
                    });
                });
            });
        });

        context("when id not provided", function () {
            it("it calls back with MissingParameter error", function (done) {
                User.destroy({}, function (err) {
                    assert.equal(err.restCode, 'MissingParameter');
                    assert.ok(err.message.match(/id/i));
                    done();
                });
            });
        });

        context("when id not found", function () {
            it("it calls back ResourceNotFound error", function (done) {
                var fake_id = support.random.number().toString();

                User.destroy({id: fake_id}, function (err) {
                    assert.equal(err.restCode, 'ResourceNotFound');
                    done();
                });
            });
        });
    });
});
