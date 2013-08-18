var assert = require('assert');
var support = require('../../support');

describe("Feature: User creation", function () {
    var http_client;
    var params;
    var response;
    var raw_res;

    before(function () {
        http_client = support.http.client();
    });

    context("when an api client POSTs to /users with an invalid username", function () {
        before(function (done) {
            params = {
                username: support.random.string() + '@#$@#$'
            };

            http_client.post('/users', params, function (err, result, raw) {
                response = result;
                raw_res = raw;
                done();
            });
        });

        it("then the response code should be 409", function () {
            assert.strictEqual(raw_res.statusCode, 409);
        });

        it("and the response should be an InvalidArgument error", function () {
            assert.equal(response.code, 'InvalidArgument');
        });
    });

    context("when an api client POSTs to /users with a valid username", function () {
        before(function (done) {
            params = {
                username: support.random.string()
            };

            http_client.post('/users', params, function (err, result, raw) {
                assert.ifError(err);
                response = result;
                raw_res = raw;
                done();
            });
        });

        it("then the response code should be 200", function () {
            assert.strictEqual(raw_res.statusCode, 200);
        });

        it("and the response data should include the user's id and username", function () {
            assert.ok(response.data.id);
            assert.equal(response.data.username, params.username);
        });
    });
});
