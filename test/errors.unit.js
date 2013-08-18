var assert = require('assert');
var restify = require('restify');
require('./support');
var errors = main.errors;

var custom_errors = {
    ResourceAlreadyExists: 409
};

describe("API Errors", function () {
    describe("custom errors", function () {
        describe("throwing with no message sets message to default", function () {
            Object.keys(custom_errors).forEach(function (error_class) {
                it(error_class, function () {
                    try {
                        throw new errors[error_class]();
                    } catch (e) {
                        assert.ok(e instanceof Error);
                        assert.ok(e instanceof restify.RestError, "expected " + error_class + " to be a RestError");
                        assert.ok(e instanceof errors[error_class]);
                        assert.ok(e.stack);
                        assert.strictEqual(e.statusCode, custom_errors[error_class]);
                        assert.equal(e.code, error_class);
                        assert.ok(e.message);
                    }
                });
            });
        });

        describe("instantiating with no message sets message to default", function () {
            Object.keys(custom_errors).forEach(function (error_class) {
                it(error_class, function () {
                    var e = new errors[error_class]();
                    assert.ok(e instanceof Error);
                    assert.ok(e instanceof restify.RestError);
                    assert.ok(e instanceof errors[error_class]);
                    assert.ok(e.stack);
                    assert.strictEqual(e.statusCode, custom_errors[error_class]);
                    assert.equal(e.code, error_class);
                    assert.ok(e.message);
                });
            });
        });
    });
});
