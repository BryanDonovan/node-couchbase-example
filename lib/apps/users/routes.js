var controller = require('./controller');

var routes = [
    {
        method     : "post",
        url        : "/users",
        func       : controller.create,
        middleware : []
    },

    {
        method     : "get",
        url        : "/users/:id",
        func       : controller.get,
        middleware : []
    },

    {
        method     : "put",
        url        : "/users/:id",
        func       : controller.update,
        middleware : []
    }
];

module.exports = routes;
