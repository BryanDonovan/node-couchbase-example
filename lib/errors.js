var util = require('util');
var restify = require('restify');

var ApiError = function (code, status_code, message) {
    status_code = status_code || 200;

    restify.RestError.call(this, {
        restCode: code,
        statusCode: status_code,
        message: message,
        constructorOpt: ApiError
    });
    var error = new Error(code);
    var stack = error.stack;

    if (message instanceof Error) {
        message = message.message;
        stack = message.stack;
    }

    this.message = message;
    this.code = code;
    this.name = code;

    error.message = message;
    error.name = code;
    error.code = code;

    this.stack = error.stack;
};

util.inherits(ApiError, restify.RestError);

var ResourceAlreadyExists = function (message) {
    ApiError.call(this, "ResourceAlreadyExists", 409,
        message || "The playlist already exists. Try another name."
    );
};

util.inherits(ResourceAlreadyExists, ApiError);

exports.ResourceAlreadyExists = ResourceAlreadyExists;
