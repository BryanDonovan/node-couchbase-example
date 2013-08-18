var User = main.models.User;
var responder = main.server.responder;

var user_controller = {
    create: function (req, res, next) {
        User.create(req.params, function (err, user) {
            responder.respond(res, err, {data: user}, next);
        });
    },

    get: function (req, res, next) {
        User.get(req.params, function (err, user) {
            responder.respond(res, err, {data: user}, next);
        });
    }
};

module.exports = user_controller;
