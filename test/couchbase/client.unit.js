var assert = require('assert');
var sinon = require('sinon');
var support = require('../support');
var couchbase = main.couchbase.client(main.settings.couchbase.connection);

describe("lib/couchbase/client.js",  function () {
    var key;
    var val;
    var fake_err;

    beforeEach(function () {
        key = support.random.string();
        val = support.random.string();
    });

    afterEach(function (done) {
        couchbase.del(key, function () {
            done(); // ignore errors
        });
    });

    describe("set()",  function () {
        context("when key is null", function () {
            beforeEach(function () {
                key = null;
            });

            it("returns 'key invalid' error", function (done) {
                couchbase.set(key, val, function (err) {
                    assert.ok(err.message.match(/invalid key/i));

                    couchbase.get('null', function (err, result) {
                        assert.ifError(err);
                        assert.strictEqual(result, null);
                        done();
                    });
                });
            });
        });

        context("when key is a string", function () {
            it("returns the new record", function (done) {
                couchbase.set(key, val, function (err, result) {
                    assert.ifError(err);
                    assert.equal(result.value, val);
                    done();
                });
            });
        });

        context("when key is a number", function () {
            beforeEach(function () {
                key = support.random.number();
            });

            it("returns the new record", function (done) {
                couchbase.set(key, val, function (err, result) {
                    assert.ifError(err);
                    assert.equal(result.value, val);
                    done();
                });
            });
        });

        context("when value is an object", function () {
            beforeEach(function () {
                val = {foo: support.random.string()};
            });

            it("returns the object", function (done) {
                couchbase.set(key, val, function (err, result) {
                    assert.ifError(err);
                    assert.deepEqual(result.value, val);
                    done();
                });
            });
        });

        context("when connect() errors", function () {
            beforeEach(function () {
                fake_err = support.fake_error();
                sinon.stub(couchbase, 'connect', function (cb) {
                    cb(fake_err);
                });
            });

            afterEach(function () {
                couchbase.connect.restore();
            });

            it("calls back with the connection error", function (done) {
                couchbase.set(key, val, function (err) {
                    assert.equal(err, fake_err);
                    done();
                });
            });
        });

        context("when conn.set() errors", function () {
            beforeEach(function () {
                fake_err = support.fake_error();

                var fake_conn = {
                    set: function (key, value, meta, cb) {
                        cb(fake_err);
                    },

                    release: function () {}
                };

                sinon.stub(couchbase, 'connect', function (cb) {
                    cb(null, fake_conn);
                });
            });

            afterEach(function () {
                couchbase.connect.restore();
            });

            it("calls back with the error from set()", function (done) {
                couchbase.set(key, val, function (err) {
                    assert.equal(err, fake_err);
                    done();
                });
            });
        });

        context("when checking CAS", function () {
            context("and CAS changes", function () {
                it("calls back with an error", function (done) {
                    couchbase.set(key, val, function (err, first_meta) {
                        assert.ifError(err);
                        var new_val = support.random.string();

                        couchbase.set(key, new_val, function (err) {
                            assert.ifError(err);
                            var new_val2 = support.random.string();

                            couchbase.set(key, new_val2, first_meta, function (err) {
                                assert.equal(err.code, couchbase.CAS_ERROR_CODE);
                                done();
                            });
                        });
                    });
                });
            });
        });
    });

    describe("get()", function () {
        context("when record exists", function () {
            beforeEach(function (done) {
                couchbase.set(key, val, done);
            });

            it("returns the record", function (done) {
                couchbase.get(key, function (err, result) {
                    assert.ifError(err);
                    assert.deepEqual(result.value, val);
                    done();
                });
            });
        });

        context("when record does not exist", function () {
            it("returns null", function (done) {
                couchbase.get(key, function (err, result) {
                    assert.ifError(err);
                    assert.strictEqual(result, null);
                    done();
                });
            });
        });

        context("when connect() errors", function () {
            beforeEach(function () {
                fake_err = support.fake_error();
                sinon.stub(couchbase, 'connect', function (cb) {
                    cb(fake_err);
                });
            });

            afterEach(function () {
                couchbase.connect.restore();
            });

            it("calls back with the connection error", function (done) {
                couchbase.get(key, function (err) {
                    assert.equal(err, fake_err);
                    done();
                });
            });
        });
    });

    describe("del()", function () {
        context("when record exists", function () {
            beforeEach(function (done) {
                couchbase.set(key, val, done);
            });

            it("returns meta data", function (done) {
                couchbase.del(key, function (err, result) {
                    assert.ifError(err);
                    assert.ok(result.cas);
                    done();
                });
            });

            it("removes the record", function (done) {
                couchbase.del(key, function (err) {
                    assert.ifError(err);

                    couchbase.get(key, function (err, result) {
                        assert.ifError(err);
                        assert.strictEqual(result, null);
                        done();
                    });
                });
            });

            context("and record is a number", function () {
                beforeEach(function (done) {
                    key = support.random.number();
                    couchbase.set(key, val, done);
                });

                it("removes the record", function (done) {
                    couchbase.del(key, function (err) {
                        assert.ifError(err);

                        couchbase.get(key, function (err, result) {
                            assert.ifError(err);
                            assert.strictEqual(result, null);
                            done();
                        });
                    });
                });
            });

            context("and key is null", function () {
                beforeEach(function () {
                    key = null;
                });

                it("returns 'key is not a string' error", function (done) {
                    couchbase.del(key, function (err) {
                        assert.ok(err.message.match(/key is not a string/i));
                        done();
                    });
                });
            });
        });

        context("when record does not exist", function () {
            it("returns empty meta object", function (done) {
                couchbase.del(key, function (err, result) {
                    assert.ifError(err);
                    assert.deepEqual(result, {});
                    done();
                });
            });
        });

        context("when connect() errors", function () {
            beforeEach(function () {
                fake_err = support.fake_error();
                sinon.stub(couchbase, 'connect', function (cb) {
                    cb(fake_err);
                });
            });

            afterEach(function () {
                couchbase.connect.restore();
            });

            it("calls back with the connection error", function (done) {
                couchbase.del(key, function (err) {
                    assert.equal(err, fake_err);
                    done();
                });
            });
        });
    });

    describe("configure_views()", function () {
        it("calls conn.setDesignDoc() with each view config", function (done) {
            var fake_conn = {
                setDesignDoc: function (name, config, cb) {
                    cb(null, {});
                },

                release: function () {}
            };

            sinon.stub(couchbase, 'connect', function (cb) {
                cb(null, fake_conn);
            });

            sinon.spy(fake_conn, 'setDesignDoc');

            var view_config = {
                users: {
                    views: {
                        users: {
                            map: 'blah'
                        }
                    }
                },

                foo: {
                    views: {
                        bar: {
                            map: 'bar'
                        }
                    }
                }
            };
            
            couchbase.configure_views(view_config, function (err) {
                assert.ifError(err);
                assert.ok(fake_conn.setDesignDoc.calledWith('users', view_config.users));
                assert.ok(fake_conn.setDesignDoc.calledWith('foo', view_config.foo));

                fake_conn.setDesignDoc.restore();
                couchbase.connect.restore();
                done();
            });
        });

        context("when connect() errors", function () {
            beforeEach(function () {
                fake_err = support.fake_error();
                sinon.stub(couchbase, 'connect', function (cb) {
                    cb(fake_err);
                });
            });

            afterEach(function () {
                couchbase.connect.restore();
            });

            it("calls back with the connection error", function (done) {
                var view_config = {foo: 'bar'};

                couchbase.configure_views(view_config, function (err) {
                    assert.equal(err, fake_err);
                    done();
                });
            });
        });
    });
});
