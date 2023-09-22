const crypto = require('crypto');

const keyPair = crypto.generateKeyPairSync('ed25519');

// Export the public key to PEM format
const publicKeyBuffer = keyPair.publicKey.export({
  format: 'der',
  type: 'spki',
});

// Export the private key to PEM format
const privateKeyBuffer = keyPair.privateKey.export({
  format: 'der',
  type: 'pkcs8',
});

// Extract the last 32 bytes for the Ed25519 public key
const publicKeyHex = publicKeyBuffer.slice(-32).toString('hex');

// Extract the last 32 bytes for the Ed25519 private key
const privateKeyHex = privateKeyBuffer.slice(-32).toString('hex');

console.log('Public Key (Hex 32 bytes):', publicKeyHex);
console.log('Private Key (Hex 32 bytes):', privateKeyHex);
