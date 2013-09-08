require('../../lib');

var support = {
    http: require('./http'),
    random: require('./random'),
    walk_dir: require('./walk_dir'),
    shallow_clone: main.utils.shallow_clone,

    fake_error: function (message) {
        return new Error(message || support.random.string());
    }
};

module.exports = support;
