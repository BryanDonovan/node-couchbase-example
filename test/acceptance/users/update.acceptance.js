var assert = require('assert');
var async = require('async');
var support = require('../../support');

function valid_params() {
    return {
        username: support.random.string(),
        email: support.random.email()
    };
}

describe("Feature: User updating", function () {
    var http_client;
    var params;
    var response;
    var raw_res;
    var user;

    before(function () {
        http_client = support.http.client();
    });

    context("Given a user exists", function () {
        before(function (done) {
            params = valid_params();

            http_client.post('/users', params, function (err, result) {
                assert.ifError(err);
                user = result.data;
                done();
            });
        });

        after(function (done) {
            http_client.del('/users/' + user.id, done);
        });

        context("When an api client PUTs to /users/:id with a new username and email", function () {
            before(function (done) {
                params = {
                    username: support.random.string(),
                    email: support.random.email()
                };

                http_client.put('/users/' + user.id, params, function (err, result, raw) {
                    assert.ifError(err);
                    response = result;
                    raw_res = raw;
                    done();
                });
            });

            it("Then the response code should be 200", function () {
                assert.strictEqual(raw_res.statusCode, 200);
            });

            it("And the user record should have the new username and email", function (done) {
                http_client.get('/users/' + user.id, function (err, result) {
                    assert.ifError(err);
                    assert.equal(result.data.username, params.username);
                    assert.equal(result.data.email, params.email);
                    done();
                });
            });
        });
    });

    context("Scenario: Updating the same user multiple times, simultaneously", function () {
        before(function (done) {
            params = valid_params();

            http_client.post('/users', params, function (err, result) {
                assert.ifError(err);
                user = result.data;
                done();
            });
        });

        after(function (done) {
            http_client.del('/users/' + user.id, done);
        });

        it("Then the correct values should be saved each time", function (done) {
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
                        var update_params = {
                            username: username
                        };

                        http_client.put('/users/' + user.id, update_params, parallel_cb);
                    },

                    update_email: function (parallel_cb) {
                        var update_params = {
                            email: email
                        };

                        http_client.put('/users/' + user.id, update_params, parallel_cb);
                    },
                }, function (err) {
                    if (err) { return async_cb(err); }

                    http_client.get('/users/' + user.id, function (err, result) {
                        assert.ifError(err);
                        assert.equal(result.data.username, username);
                        assert.equal(result.data.email, email);
                        async_cb();
                    });
                });
            }, done);
        });
    });
});
