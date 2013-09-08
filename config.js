module.exports = {
    common: {
        server: {
            port: 8080
        },

        apps: {
            users: {
                port: 12100,
                proxies: 1
            }
        },

        couchbase: {
            connection: {
                host: 'localhost:8091',
                bucket: 'default',
            },
            key_prefix: 'cb_example',
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
