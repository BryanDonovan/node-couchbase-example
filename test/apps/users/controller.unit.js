var restify = require('restify');
var assert = require('assert');
var sinon = require('sinon');
var support = require('../../support');
var http = support.http;
var User = main.models.User;

describe("users/controller.js", function () {
    var app;
    var http_client;

    before(function () {
        http_client = http.client();
        app = main.app();
        app.register('users', {port: http.port});
    });

    after(function () {
        app.close_server();
    });

    describe("POST /users", function () {
        var params;

        beforeEach(function () {
            params = {username: support.random.string(), password: support.random.string()};
        });

        it("passes params to User model", function (done) {
            sinon.stub(User, 'create', function (args, cb) {
                cb(null, {});
            });

            http_client.post('/users', params, function (err) {
                assert.ifError(err);
                assert.ok(User.create.calledWith(params));
                User.create.restore();
                done();
            });
        });

        context("when model returns an error", function () {
            it("responds with the error", function (done) {
                var fake_err = support.fake_error();
                sinon.stub(User, 'create', function (args, cb) {
                    cb(fake_err, {});
                });

                http_client.post('/users', params, function (err, result) {
                    assert.ok(User.create.calledWith(params));
                    assert.equal(result.message, fake_err.message);
                    User.create.restore();
                    done();
                });
            });
        });
    });

    describe("GET /users/:id", function () {
        var id;

        beforeEach(function () {
            id = support.random.number();
        });

        it("passes id to User model", function (done) {
            sinon.stub(User, 'get', function (args, cb) {
                cb(null, {});
            });

            http_client.get('/users/' + id, function (err) {
                assert.ifError(err);
                assert.ok(User.get.calledWith({id: id.toString()}));
                User.get.restore();
                done();
            });
        });

        context("when model returns an error", function () {
            it("responds with the error", function (done) {
                var fake_err = support.fake_error();
                sinon.stub(User, 'get', function (args, cb) {
                    cb(fake_err);
                });

                http_client.get('/users/' + id, function (err, result) {
                    assert.equal(result.message, fake_err.message);
                    User.get.restore();
                    done();
                });
            });
        });
    });
});
