var productLocal = 'LOCAL';
var productLinux = 'LINUX';
var productWindows = 'WINDOWS';

module.exports = {

    TESTNET: true,

    PRODUCTION: productLocal,
    // PRODUCTION: productLinux,
    // PRODUCTION: productWindows,

    PRODUCTION_LOCAL: productLocal,
    PRODUCTION_LINUX: productLinux,
    PRODUCTION_WINDOWS: productWindows,

    // bitcoind for development
    BITCOIND_HOST_LOCAL: 'localhost',
    BITCOIND_PORT_LOCAL: 8332,
    BITCOIND_USER_LOCAL: 'bio',
    BITCOIND_PASS_LOCAL: '3HTJFDMaDxiRc71jUkdyFcMFLwbB7rZHtY',
    // bitcoind for test
    BITCOIND_HOST_LINUX: 'localhost',
    BITCOIND_PORT_LINUX: 8332,
    BITCOIND_USER_LINUX: 'bio',
    BITCOIND_PASS_LINUX: '3HTJFDMaDxiRc71jUkdyFcMFLwbB7rZHtY',
    // bitcoind for production
    BITCOIND_HOST_WINDOWS: 'localhost',
    BITCOIND_PORT_WINDOWS: 8332,
    BITCOIND_USER_WINDOWS: 'hmm4JzdD8cHT7e2u',
    BITCOIND_PASS_WINDOWS: 'T4ZKxSsE6hx3rw4RBjs4Uh6Cy5zQRp4X',

    DATABASE_URL_LOCAL: 'postgres://postgres:123456@localhost/bustabitdb', // database url for local - developmennt
    DATABASE_URL_LINUX: 'postgres://postgres:123456@47.75.43.93/bustabitdb', // database url for linux server - test
    DATABASE_URL_WINDOWS: 'postgres://postgres:bmUgswMNVK9n4J7S@172.17.0.6/bustabitdb', // database url for windows server - production

    BIP32_DERIVED: 'xprv9wUy87KN49Dwz4Y7KZuJLV9o4a7qvkU51RzYZC8EJ6VeJadtbXvvXjJAvxWzz7aw5fho3fb4CWrevd8B1gwpykp1dSXYsKwrmSzn7qJET5y',
    BIP32_PRIV: 'xprv9wUy87KN49Dwz4Y7KZuJLV9o4a7qvkU51RzYZC8EJ6VeJadtbXvvXjJAvxWzz7aw5fho3fb4CWrevd8B1gwpykp1dSXYsKwrmSzn7qJET5y'
};
