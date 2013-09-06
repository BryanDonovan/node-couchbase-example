var assert = require('assert');
var support = require('../../support');

describe("Feature: Fetching a user", function () {
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
            params = {
                username: support.random.string()
            };

            http_client.post('/users', params, function (err, result) {
                assert.ifError(err);
                user = result.data;
                done();
            });
        });

        context("When an api client requests GET /users/:id with an invalid id", function () {
            before(function (done) {
                var fake_id = 'invalid123';

                http_client.get('/users/' + fake_id, function (err, result, raw) {
                    response = result;
                    raw_res = raw;
                    done();
                });
            });

            it("Then the response code should be 404", function () {
                assert.strictEqual(raw_res.statusCode, 404);
            });

            it("And the response should be a ResourceNotFound error", function () {
                assert.equal(response.code, 'ResourceNotFound');
            });
        });

        context("When an api client requests GET /users/:id with a valid id", function () {
            before(function (done) {
                http_client.get('/users/' + user.id, function (err, result, raw) {
                    assert.ifError(err);
                    response = result;
                    raw_res = raw;
                    done();
                });
            });

            it("Then the response code should be 200", function () {
                assert.strictEqual(raw_res.statusCode, 200);
            });

            it("And the response data should have the user data", function () {
                assert.equal(response.data.id, user.id);
            });
        });
    });
});
