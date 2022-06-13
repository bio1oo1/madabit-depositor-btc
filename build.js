var NodeUglifier = require('node-uglifier');
var nodeUglifier = new NodeUglifier('daemon.js');

nodeUglifier.merge().uglify();
nodeUglifier.exportToFile('./build/daemon.min.js');
