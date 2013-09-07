var assert = require('assert');
var support = require('../../support');

function valid_params() {
    return {
        username: support.random.string(),
        email: support.random.email()
    };
}

describe("Feature: Destroying a user", function () {
    var http_client;
    var params;
    var response;
    var raw_res;

    before(function () {
        http_client = support.http.client();
    });

    context("Given a user exists", function () {
        var user;

        before(function (done) {
            params = valid_params();

            http_client.post('/users', params, function (err, result) {
                assert.ifError(err);
                user = result.data;
                done();
            });
        });

        context("When an api client requests DELETE /users/:id with an invalid id", function () {
            before(function (done) {
                var fake_id = 'invalid123';

                http_client.del('/users/' + fake_id, function (err, result, raw) {
                    response = result;
                    raw_res = raw;
                    done();
                });
            });

            it("Then the response code should be 200", function () {
                assert.strictEqual(raw_res.statusCode, 200);
            });
        });

        context("When an api client requests DELETE /users/:id with a valid id", function () {
            before(function (done) {
                http_client.get('/users/' + user.id, function (err) {
                    assert.ifError(err);

                    http_client.del('/users/' + user.id, function (err, result, raw) {
                        response = result;
                        raw_res = raw;
                        done();
                    });
                });
            });

            it("Then the response code should be 200", function () {
                assert.strictEqual(raw_res.statusCode, 200);
            });

            it("And the user record should no longer be available", function (done) {
                http_client.get('/users/' + user.id, function (err, result) {
                    assert.equal(result.code, 'ResourceNotFound');
                    done();
                });
            });
        });
    });
});
