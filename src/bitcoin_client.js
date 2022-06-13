var assert = require('better-assert');
var bitcoin = require('bitcoin');
var lib = require('./lib');
var config = require('./config');

var btcHost;
var btcPort;
var btcUser;
var btcPass;

if (config.PRODUCTION === config.PRODUCTION_LOCAL) {
    btcHost = config.BITCOIND_HOST_LOCAL;
    btcPort = config.BITCOIND_PORT_LOCAL;
    btcUser = config.BITCOIND_USER_LOCAL;
    btcPass = config.BITCOIND_PASS_LOCAL;
} else if (config.PRODUCTION === config.PRODUCTION_LINUX) {
    btcHost = config.BITCOIND_HOST_LINUX;
    btcPort = config.BITCOIND_PORT_LINUX;
    btcUser = config.BITCOIND_USER_LINUX;
    btcPass = config.BITCOIND_PASS_LINUX;
} else if (config.PRODUCTION === config.PRODUCTION_WINDOWS) {
    btcHost = config.BITCOIND_HOST_WINDOWS;
    btcPort = config.BITCOIND_PORT_WINDOWS;
    btcUser = config.BITCOIND_USER_WINDOWS;
    btcPass = config.BITCOIND_PASS_WINDOWS;
}

console.log('btc daemon connected to bitcoind-rpc : [', btcHost + ':' + btcPort, ']');
lib.log('info', 'btc daemon connected to bitcoind-rpc : [', btcHost + ':' + btcPort, ']');

var client = new bitcoin.Client({
    host: btcHost,
    port: btcPort,
    user: btcUser,
    pass: btcPass,
    timeout: 240000
});

assert(client.rpc.opts.host);
assert(client.rpc.opts.user);
assert(client.rpc.opts.pass);

function doGetTransactions (txIds, callback) {
    if (txIds.length === 0) { return callback(null, []); }

    var batch = txIds.map(function (txId) {
        return {
            method: 'getrawtransaction',
            params: [txId, 1]
        };
    });

    var abort = false;
    var transactions = [];
    var count = 0;

    client.cmd(batch, function (err, transaction) {
        if (abort) return;

        if (err) {
            abort = true;
            return callback(err);
        }

        transactions.push(transaction);

        if (++count === txIds.length) {
            return callback(null, transactions);
        }

        assert(count < txIds.length);
    });
}

client.getTransactions = function (txIds, callback) {
    return lib.chunkRun(doGetTransactions, txIds, 3, 1, function (err, data) {
        if (err) {
            console.error('error: when fetching ', txIds.length, ' transactions, got error: ', err);
            lib.log('error', 'error: when fetching ', txIds.length, ' transactions, got error: ' + err);
            return callback(err);
        }

        callback(null, data);
    });
};

client.getTransaction = function (transactionHash, callback) {
    client.getRawTransaction(transactionHash, 1, callback);
};

// returns [{address: amount}])
function transactionsAddresses (transactions) {
    return transactions.map(function (transaction) {
        var addressToAmount = {};

        transaction.vout.forEach(function (out) {
            var addresses = out.scriptPubKey.addresses;
            if (!addresses || addresses.length !== 1) {
                return;
            }

            assert(out.value >= 0);
            var oldAmount = addressToAmount[addresses[0]] || 0;
            addressToAmount[addresses[0]] = oldAmount + out.value;
        });

        return addressToAmount;
    });
}

function doGetTransactionIdsAddresses (txids, callback) {
    doGetTransactions(txids, function (err, transactions) {
        if (err) return callback(err);

        callback(null, transactionsAddresses(transactions));
    });
}

// callback(err, listOfAddressToAmount
client.getTransactionIdsAddresses = function (txIds, callback) {
    lib.chunkRun(doGetTransactionIdsAddresses, txIds, 20, 2, callback);
};

module.exports = client;
