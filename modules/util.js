global.crypto	= require('crypto');

require('child_process').spawnSync('bash', ['../commands/buildunbundledassets.sh', '--test']);
require('../shared/assets/js/standalone/global');
require('../shared/assets/js/cyph/util');

module.exports	= Index;
global.Index	= undefined;
