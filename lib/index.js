process.env.NODE_ENV = process.env.NODE_ENV || 'dev';
var Settings = require('settings');
var settings = new Settings(require('../config'));

if (!global.main) {
    global.main = {};
}

main.settings = settings;
main.utils = require('./utils');
main.errors = require('./errors');
main.app = require('./app');
main.models = require('./models');
main.server = require('./server');
