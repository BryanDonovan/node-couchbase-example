var assert = require('assert');
var support = require('../../support');

function valid_params() {
    return {
        username: support.random.string(),
        email: support.random.email()
    };
}

describe("Feature: User creation", function () {
    var http_client;
    var params;
    var response;
    var raw_res;

    before(function () {
        http_client = support.http.client();
    });

    context("When an api client POSTs to /users with an invalid username", function () {
        before(function (done) {
            params = valid_params();
            params.username = support.random.string() + '@#$@#$';

            http_client.post('/users', params, function (err, result, raw) {
                response = result;
                raw_res = raw;
                done();
            });
        });

        it("Then the response code should be 409", function () {
            assert.strictEqual(raw_res.statusCode, 409);
        });

        it("And the response should be an InvalidArgument error", function () {
            assert.equal(response.code, 'InvalidArgument');
            assert.ok(response.message.match(/username/i));
        });
    });

    context("When an api client POSTs to /users with an invalid email", function () {
        before(function (done) {
            params = valid_params();
            params.email = 'foo.bar.com';

            http_client.post('/users', params, function (err, result, raw) {
                response = result;
                raw_res = raw;
                done();
            });
        });

        it("Then the response code should be 409", function () {
            assert.strictEqual(raw_res.statusCode, 409);
        });

        it("And the response should be an InvalidArgument error", function () {
            assert.equal(response.code, 'InvalidArgument');
            assert.ok(response.message.match(/email/i));
        });
    });

    context("When an api client POSTs to /users with a valid username and email", function () {
        before(function (done) {
            params = valid_params();

            http_client.post('/users', params, function (err, result, raw) {
                assert.ifError(err);
                response = result;
                raw_res = raw;
                done();
            });
        });

        it("Then the response code should be 200", function () {
            assert.strictEqual(raw_res.statusCode, 200);
        });

        it("And the response data should include the user's id and username", function () {
            assert.ok(response.data.id);
            assert.equal(response.data.username, params.username);
        });
    });
});
