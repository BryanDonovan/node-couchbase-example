module.exports = {
    common: {
        server: {
            port: 8080
        },

        apps: {
            users: {
                port: 12100,
                proxies: 2
            }
        },

        couchbase: {
            hosts: ['localhost:8091'],
            user: 'Administrator',
            password: 'password',
            bucket: 'default'
        }
    },

    dev: {},

    test: {}
};
