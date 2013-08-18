var restify = require('restify');

var utils = {
    random: {
        number: function (range) {
            range = range || 100000000;
            return Math.floor(Math.random() * range);
        }
    },

    check_required_args: function (required_args, args) {
        for (var i = 0; i < required_args.length; i++) {
            var arg = required_args[i];
            if (!args || !args.hasOwnProperty(arg) || args[arg] === undefined) {
                return new restify.MissingParameterError('Missing param: ' + arg);
            }
        }
    }
};

module.exports = utils;
