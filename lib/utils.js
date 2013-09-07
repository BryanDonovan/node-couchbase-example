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
    },

    merge: function (obj1, obj2) {
        for (var p in obj2) {
            if (obj2.hasOwnProperty(p)) {
                try {
                    if (obj2[p].constructor == Object) {
                        obj1[p] = utils.merge(obj1[p], obj2[p]);
                    } else {
                        obj1[p] = obj2[p];
                    }
                } catch (e) {
                    obj1[p] = obj2[p];
                }
            }
        }
        return obj1;
    },
};

module.exports = utils;
