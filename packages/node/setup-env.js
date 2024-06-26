#!/usr/bin/env node
/* eslint-disable no-console */
/* eslint-disable @typescript-eslint/no-var-requires */
/* eslint-disable no-undef */
const readline = require('node:readline');
const promisify = require('node:util').promisify;
const fs = require('node:fs');
const path = require('node:path');

const dotEnvPath = path.join(__dirname, '.env');

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});
const question = promisify(rl.question).bind(rl);

// eslint-disable-next-line @typescript-eslint/no-floating-promises
(async () => {
  console.log(
    'Welcome to the setup of the POI node.\n' +
      'It needs some environment variables before deploying.\n',
  );

  let dotEnv = '';

  /** @type {string} */
  let pkey = await question(
    '(Required) Enter a private ed25519 key to assign the node: ',
  );
  if (typeof pkey !== 'string' || pkey.length === 0) {
    console.log('Invalid! Private key must be 32 bytes hexadecimal.');
    process.exit(1);
  }
  if (pkey.startsWith('0x')) {
    pkey = pkey.slice(2);
  }
  if (pkey.length !== 64 || !/^[0-9a-fA-F]+$/.test(pkey)) {
    console.log('Invalid! Private key must be 32 bytes hexadecimal.');
    process.exit(1);
  }
  dotEnv += `pkey=0x${pkey}\n`;

  const port = await question(
    '(Required) Enter a port number for the node to run node on: ',
  );
  // Validate port number:
  if (typeof port === 'string' && port.length > 0) {
    const portNumber = parseInt(port, 10);
    if (Number.isNaN(portNumber) || portNumber < 0 || portNumber > 65535) {
      console.log('Invalid! Port number must be between 0 and 65535.');
      process.exit(1);
    }
    dotEnv += `PORT=${port}\n`;
  }

  const nodeConfigs = await question(
    '(Optional) Enter a formatted JSON array of NodeConfigs: ',
  );
  if (typeof nodeConfigs === 'string' && nodeConfigs.length > 0) {
    dotEnv += `NODE_CONFIGS=${nodeConfigs}\n`;
  }

  // If .env exists, refuse to overwrite it:
  if (fs.existsSync(dotEnvPath)) {
    console.log(
      `\nError: refusing to overwrite file ${dotEnvPath}.` +
        '\nDelete it first and run this script again.',
    );
    process.exit(1);
  } else {
    fs.writeFileSync(dotEnvPath, dotEnv);
    console.log(`\nSaved ${dotEnvPath}`);
    process.exit(0);
  }
})();
