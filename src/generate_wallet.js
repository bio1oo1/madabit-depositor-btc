var bitcoinjs = require('bitcoinjs-lib');
var config = require('./config');

var privKey = config.BIP32_PRIV;

// var hdNode = bitcoinjs.HDNode.fromBase58(privKey);

// bio
var hdNode = bitcoinjs.HDNode.fromBase58(privKey, bitcoinjs.networks.bitcoin);

var count = 100; // how many addresses to watch

var rescan = 'false';

for (var i = 1; i <= count; ++i) {
    console.log('bitcoin-cli -rpcuser=' + config.BITCOIND_USER + ' -rpcpassword=' + config.BITCOIND_PASS + ' importprivkey ' + hdNode.derive(i).keyPair.toWIF() + ' ' + i + ' ' + rescan);
}
