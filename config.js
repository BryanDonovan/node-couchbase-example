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
            bucket: 'default',
            views: {
                'default': {
                    users: {
                        views: {
                            users: {
                                map: "function (doc, meta) {\n" +
                                    "  if(meta && meta.id && doc && doc.id) {\n" +
                                    "    emit(doc.id, doc.username);\n" +
                                    "  }\n" +
                                    "}"
                            }
                        }
                    }
                }
            }
        }
    },

    dev: {},

    test: {}
};
