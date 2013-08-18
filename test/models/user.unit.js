var assert = require('assert');
var sinon = require('sinon');
var support = require('../support');
var User = main.models.User;

describe("User model", function () {
    var user_args;

    beforeEach(function () {
        user_args = {username: support.random.string()};
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
                    done();
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
    });
});
