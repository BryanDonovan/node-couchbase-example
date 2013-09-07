var assert = require('assert');
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
});
