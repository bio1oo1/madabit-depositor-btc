var assert = require('better-assert');
var async = require('async');
var pg = require('pg');
var config = require('./config');
var lib = require('./lib');

var databaseUrl;
if (config.PRODUCTION === config.PRODUCTION_LOCAL) databaseUrl = config.DATABASE_URL_LOCAL;
if (config.PRODUCTION === config.PRODUCTION_LINUX) databaseUrl = config.DATABASE_URL_LINUX;
if (config.PRODUCTION === config.PRODUCTION_WINDOWS) databaseUrl = config.DATABASE_URL_WINDOWS;

console.log('btc daemon connected to db : [', databaseUrl, ']');
lib.log('info', 'btc daemon connected to db : [' + databaseUrl + ']');

pg.types.setTypeParser(20, function (val) { // parse int8 as an integer
    return val === null ? null : parseInt(val);
});

// callback is called with (err, client, done)
function connect (callback) {
    return pg.connect(databaseUrl, callback);
}

function query (query, params, callback) {
    // thrid parameter is optional
    if (typeof params === 'function') {
        callback = params;
        params = [];
    }

    connect(function (err, client, done) {
        if (err) return callback(err);

        client.query(query, params, function (err, result) {
            done();
            if (err) {
                return callback(err);
            }
            callback(null, result);
        });
    });
}

// runner takes (client, callback)

// callback should be called with (err, data)
// client should not be used to commit, rollback or start a new transaction

// callback takes (err, data)

function getClient (runner, callback) {
    connect(function (err, client, done) {
        if (err) return callback(err);

        function rollback (err) {
            client.query('ROLLBACK', done);
            callback(err);
        }

        client.query('BEGIN', function (err) {
            if (err) { return rollback(err); }

            runner(client, function (err, data) {
                if (err) { return rollback(err); }

                client.query('COMMIT', function (err) {
                    if (err) { return rollback(err); }

                    done();
                    callback(null, data);
                });
            });
        });
    });
}

// callback is called with (err, client, done)
exports.getClient = function (callback) {
    var client = new pg.Client(databaseUrl);

    client.connect(function (err) {
        if (err) return callback(err);

        callback(null, client);
    });
};

/**********************************************************************
 * get last block from btc_blocks table
 * @param callback
 */
exports.getLastBlock = function (callback) {
    query('SELECT * FROM btc_blocks ORDER BY height DESC LIMIT 1', function (err, results) {
        if (err) { // db error
            return callback(err);
        }

        if (results.rows.length === 0) {
            if (config.TESTNET === true) {
                return callback(null, { height: 514, hash: '00000000040b4e986385315e14bee30ad876d8b47f748025b26683116d21aa65' }); // genesis block // test net // bio
            } else {
                return callback(null, { height: 0, hash: '000000000019d6689c085ae165831e934ff763ae46a2a6c172b3f1b60a8ce26f' }); // genesis block // main net
            }
        }

        assert(results.rows.length === 1);// check LIMIT 1 : db error
        callback(null, results.rows[0]); // int4:height  text:hash from db:btc_blocks
    });
};

/**********************************************************************
 * get block with height <height> from btc_blocks table
 * @param callback
 */
exports.getBlock = function (height, callback) {
    query('SELECT * FROM btc_blocks WHERE height = $1', [height], function (err, results) {
        if (err) return callback(err);

        if (results.rows.length === 0) { return callback(new Error('Could not find block ' + height)); }

        // assert(results.rows.length === 1);
        // Orphaned blocks exist. so orphaned & mainchain blocks both exist.
        if (results.rows.length !== 1) {
            console.log('btc orphaned block found :' + height);
            lib.log('warning', 'btc orphaned block found :' + height);
            query('DELETE FROM btc_blocks WHERE height>=$1', [height], function (err) {
                if (err) {
                    console.error('btc error - del orphaned block from db. error:' + err);
                    lib.log('error', 'btc error - del orphaned block from db. error:' + err);
                    return callback(err);
                }

                query('SELECT * FROM btc_blocks WHERE height = $1', [height - 1], function (err, prevBlock) {
                    if (err) return callback(err);
                    if (prevBlock.rows.length !== 1) return callback('NO_PREV_BLOCK_IN_DB');
                    return callback(null, prevBlock.rows[0]);
                });
            });
        } else {
            return callback(null, results.rows[0]);
        }
    });
};

/**********************************************************************
 * bio
 * save last block in db
 * @param callback
 */
exports.insertBlock = function (height, hash, callback) {
    query('INSERT INTO btc_blocks(height, hash) VALUES($1, $2)', [height, hash], callback);
};

// notifier is called with the row (bv_moneypots joined bv_user)

/**********************************************************************
 * bio
 * process deposit amount in db
 * @param callback
 */
exports.addDeposit = function (userId, txid, amount_btc, callback) {
    assert(typeof amount_btc === 'number');
    // Amount is in bitcoins...
    //  var amount_satoshi = Math.round(amount_btc * 1e8);

    getBTCvsBitRate(function (err, nRateBTCvsBit) {
        if (err) callback(err);

        var nGamePoints = Math.round(amount_btc * nRateBTCvsBit * 100);
        console.log('btc trying to add deposit - user_id:' + userId + '   transaction:' + txid + '   amount(btc)' + amount_btc + '=' + nGamePoints);
        lib.log('info', 'btc trying to add deposit - user_id:' + userId + '   transaction:' + txid + '   amount(btc)' + amount_btc + '=' + nGamePoints);
        getClient(function (client, callback) {
            query('SELECT * FROM users WHERE id=$1', [userId], function (err, result) {
                if (err) return callback(err);
                if (result.rowCount !== 1) {
                    console.log('user not exists - user_id:' + userId);
                    lib.log('error', 'user not exists - user_id:' + userId);
                    return callback(null, 'NO_USER');
                }

                async.parallel([
                    function (callback) {
                        client.query('INSERT INTO fundings(user_id, amount, deposit_txid, description, baseunit, currency) ' +
                                "VALUES($1, $2, $3, 'BTC Deposit', $4, 'BTC')",
                        [userId, nGamePoints, txid, amount_btc], callback);
                    },
                    function (callback) {
                        client.query("UPDATE users SET balance_satoshis = balance_satoshis + $1 WHERE id = $2 AND username != 'madabit' AND username != 'staff'",
                            [nGamePoints, userId], callback);
                    }],
                callback);
            });
        }, function (err) {
            if (err) {
                if (err.code === '23505') { // constraint violation
                    console.log('btc - deposit constraint violation - user_id:' + userId + '   transaction:' + txid);
                    lib.log('error', 'btc - deposit constraint violation - user_id:' + userId + '   transaction:' + txid);
                    return callback(null);
                }

                console.log('btc - save error - user_id:' + userId + '   trasaction:' + txid + '   err:' + err);
                lib.log('error', 'btc - save error - user_id:' + userId + '   trasaction:' + txid + '   err:' + err);
                return callback(err);
            }

            callback(null);
        });
    });
};

function getBTCvsBitRate (callback) {
    query('SELECT ' +
        "(SELECT strvalue AS rate_USD_bit FROM common WHERE strkey='rate_USD_bit'), " +
        "(SELECT strvalue AS rate_BTC_USD FROM common WHERE strkey='rate_BTC_USD')", [], function (err, result) {
        if (err) return callback(err);
        if (result.rowCount !== 1) return callback(null, 1000000);
        if(result.rows[0].rate_usd_bit == undefined || result.rows[0].rate_btc_usd == undefined)
            return callback(null, 1000000);
        var nRateUSDvsBit = parseInt(result.rows[0].rate_usd_bit);
        var nRateBTCvsUSD = parseInt(result.rows[0].rate_btc_usd);
        return callback(null, nRateUSDvsBit * nRateBTCvsUSD);
    });
}

/**
 * Getting Contact us Email
 * @author Bio
 * @since 2018.6.4
 * Copied From Web Server
 */
exports.getContactUsEmail = function (callback) {
    var sql = "SELECT * FROM common WHERE strkey = 'contactus_email'";
    query(sql, function (err, res) {
        if (err) { return callback(err); }

        if (res.rowCount === 0) { return callback(null, ''); }
        return callback(null, res.rows[0]['strvalue']);
    });
};


/*
 * Getting Madabit Company Email
 * @author Bio
 * @since 2018.6.5
 * @return string - company email address
 */
exports.getCompanyMail = function (callback) {
    query("SELECT strvalue FROM common WHERE strkey='company_mail'", function (err, res) {
        if (err) {
            console.log('error', 'db.get_company_mail:', err);
            return callback(null, '');
        }

        if (res.rowCount === 0) {
            return callback(null, '');
        } else {
            return callback(null, res.rows[0].strvalue);
        }
    });
};

/*
 * Getting Madabit Company Email
 * @author Bio
 * @since 2018.6.5
 * @return string - company email password
 */
exports.getCompanyPassword = function (callback) {

    query("SELECT strvalue FROM common WHERE strkey='mail_password'", function (err, res) {
        if (err) {
            console.log('error', 'db.get_company_password:', err);
            return callback(null, '');
        }

        if (res.rowCount === 0) {
            return callback(null, '');
        } else {
            return callback(null, res.rows[0].strvalue);
        }
    });
};