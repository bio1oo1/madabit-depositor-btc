var assert = require('better-assert');
var async = require('async');
var bc = require('./src/bitcoin_client');
var db = require('./src/db');
var config = require('./src/config');
var lib = require('./src/lib');
var fs = require('fs');
var sendEmail = require('./src/sendEmail');

// bio : 20180404
// load deposit address(main_net & test_net addresses) : generated from https://walletgenerator.net/?currency=Bitcoin
// we must generate all addresses which is greater than total users to te registered on the site.
// Mapping of deposit_address -> user_id
var depositAddresses = null;
if (config.TESTNET === true) {
    depositAddresses = JSON.parse(fs.readFileSync('./addresses_btc_testnet.json', 'utf8'));
    console.log('btc daemon loaded [ addresses_btc_testnet.json ]');
    lib.log('info', 'btc daemon loaded [ addresses_btc_testnet.json ]');
} else {
    depositAddresses = JSON.parse(fs.readFileSync('./addresses_btc.json', 'utf8'));
    console.log('btc daemon loaded [ addresses_btc.json ]');
    lib.log('info', 'btc daemon loaded [ addresses_btc.json ]');
}
assert(depositAddresses);

/// checking ///////////////////////////////////////////////////////////////////////////////////////////////////////////////////
/// /////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
/// /////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
/// /////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
var swapedDepositAddresses = {};
var nCapacity = 0;
for (var depAddress in depositAddresses) {
    swapedDepositAddresses[depositAddresses[depAddress]] = depAddress;
    nCapacity++;
}
console.log('capacity :' + nCapacity + ' ___ madabit address:' + swapedDepositAddresses[1]);
lib.log('info', 'capacity :' + nCapacity + ' ___ madabit address:' + swapedDepositAddresses[1]);
/// /////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
/// /////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
/// /////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
/// /////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
// start block mornitoring
startBlockLoop();

// bio : 20180404
// process certain transaction : check whether registered addresses are included in this transaction or not
// and the if it includes the target address, sets it in deposit list
function processTransactionIds (txids, callback) {
    bc.getTransactionIdsAddresses(txids, function (err, addressToAmountLists) {
        if (err) return callback(err);

        assert(txids.length === addressToAmountLists.length);

        var tasks = [];

        // check all address in transaction txids
        addressToAmountLists.forEach(function (addressToAmount, i) {
            var txid = txids[i];

            assert(txid);

            var usersToAmounts = {};

            Object.keys(addressToAmount).forEach(function (address) {
                var userId = depositAddresses[address];
                if (userId) {
                    // found addresses that are included in list
                    usersToAmounts[userId] = addressToAmount[address];
                }
            });

            if (Object.keys(usersToAmounts).length > 0) {
                console.log('transaction:' + txid + '   matches:', usersToAmounts);
                lib.log('info', 'transaction:' + txid + '   matches:', usersToAmounts);

                Object.keys(usersToAmounts).forEach(function (userId) {
                    tasks.push(function (callback) {
                        // bio : insert to table:fundings , and update table:users : db
                        db.addDeposit(userId, txid, usersToAmounts[userId], callback);
                        console.log('Start send Email');
                        var param = {};
                        param.cointype = 'BTC';
                        param.amount = usersToAmounts[userId];
                        sendEmail.sendDepositNotifyMail(param, function(err) {
                            //callback(null);
                        });
                    });
                });
            }
        });

        async.parallelLimit(tasks, 3, callback);
    });
}

// Handling the block...

/// block chain loop

var lastBlockCount;
var lastBlockHash;

function startBlockLoop () {
    // initialize...
    // bio : 20180404
    // get last block from db : from btc_block
    // when ophaned block appears, then we have to remove last block and rebuild the blockchains from db
    db.getLastBlock(function (err, block) {
        if (err) {
            throw new Error('Unable to get initial last block: ', err);
        }

        lastBlockCount = block.height;// block height : (block id:index) : ex): 	504809
        lastBlockHash = block.hash; // block hash : ex):	000000000000000000296bad123bcde8c889101cf3986df66dab81b578343332

        console.log('daemon initialized - block:' + lastBlockCount + '   hash:' + lastBlockHash);
        lib.log('info', 'daemon initialized - block:' + lastBlockCount + '   hash:' + lastBlockHash);

        blockLoop();
    });
}

function scheduleBlockLoop () {
    // check blocks every 20s.
    setTimeout(blockLoop, 20000); // every 20s
}

var g_nLastNum = 0;

function blockLoop () {
    // get the last block from block chain
    bc.getBlockCount(function (err, num) {
        if (err) {
            console.error('error  - unable to get block count');
            lib.log('error', 'unable to get block count');
            return scheduleBlockLoop();
        }

        if (num === lastBlockCount) {
            // last block has already been processed. there is nothing to do.
            if (num != g_nLastNum) {
                console.log('block:' + num + '   loop ...');
                lib.log('info', 'block:' + num + '   loop ...');
                g_nLastNum = num;
            }

            return scheduleBlockLoop();
        }

        // bio : 20180404
        // get specific block hash from block chain
        bc.getBlockHash(lastBlockCount, function (err, hash) {
            if (err) {
                console.error('error - get block hash error:' + err);
                lib.log('error', 'get block hash error:' + err);
                return scheduleBlockLoop();
            }

            if (lastBlockHash !== hash) {
                // There was a block-chain reshuffle. So let's just jump back a block
                /// found ophaned block
                db.getBlock(lastBlockCount - 1, function (err, block) {
                    if (err) {
                        console.error('error - unable jump back - ' + err);
                        lib.log('error', 'unable jump back - error:' + err);
                        return scheduleBlockLoop();
                    }

                    console.log('jump block back - ' + lastBlockCount - 1);
                    lib.log('info', 'jump block back - ' + lastBlockCount - 1);

                    lastBlockCount = parseInt(block.height);
                    lastBlockHash = block.hash;
                    blockLoop();
                });
                return;
            }

            // go to last block
            bc.getBlockHash(lastBlockCount + 1, function (err, hash) {
                if (err) {
                    console.error('error - get block hash:' + lastBlockCount + 1);
                    lib.log('error', 'get block hash:' + lastBlockCount + 1);
                    return scheduleBlockLoop();
                }

                processBlock(hash, function (err) {
                    if (err) {
                        console.error('error - process block hash:' + hash, '   error:' + err);
                        lib.log('error', 'process block hash:' + hash, '   error:' + err);
                        return scheduleBlockLoop();
                    }

                    ++lastBlockCount;
                    lastBlockHash = hash;

                    db.insertBlock(lastBlockCount, lastBlockHash, function (err) {
                        if (err) {
                            console.error('error - danger, save results in database...');
                            lib.log('error', 'danger, save results in database...');
                        }

                        // All good! Loop immediately!
                        blockLoop();
                    });
                });
            });
        });
    });
}

// bio : 20180404
// process blocks targeted with block-hash
function processBlock (hash, callback) {
    // console.log('BTC: Processing block : ', hash);
    // hash = '00000000000216158256fc23cfca0b82d23f110a0de55037c715772e77834ca5';1275787

    var start = new Date();

    bc.getBlock(hash, function (err, blockInfo) {
        if (err) {
            console.error('error - get block info hash:' + hash + '   error:' + err);
            lib.log('error', 'get block info hash:' + hash + '   error:' + err);
            return callback(err);
        }

        var transactionsIds = blockInfo.tx;

        console.log('block processing - height:' + blockInfo.height);
        lib.log('info', 'block processing - height:' + blockInfo.height);

        // processes all transactions in block blockInfo
        processTransactionIds(transactionsIds, function (err) {
            if (err) {
                console.log('error - process block (in ' + (new Date() - start) / 1000 + ' seconds)');
                lib.log('error', 'process block (in ' + (new Date() - start) / 1000 + ' seconds)');
            }
            callback(err);
        });
    });
}
