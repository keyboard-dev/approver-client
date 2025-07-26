/* eslint-disable @typescript-eslint/no-require-imports */
const crypto = require('crypto')

/**
 * Generate two different encryption keys for the application
 * - ENCRYPTION_KEY: Used for general encryption/decryption
 * - CODE_ENCRYPTION_KEY: Used for code-specific encryption/decryption
 */

function generateEncryptionKey() {
  // Generate 32 random bytes (256 bits) for AES-256-CBC
  return crypto.randomBytes(32).toString('hex')
}

function generateKeys() {
  const encryptionKey = generateEncryptionKey()
  const codeEncryptionKey = generateEncryptionKey()

  console.log('Generated Encryption Keys:')
  console.log('========================')
  console.log(`ENCRYPTION_KEY=${encryptionKey}`)
  console.log(`CODE_ENCRYPTION_KEY=${codeEncryptionKey}`)
  console.log('========================')
  console.log('')
  console.log('Add these to your .env file:')
  console.log(`ENCRYPTION_KEY=${encryptionKey}`)
  console.log(`CODE_ENCRYPTION_KEY=${codeEncryptionKey}`)
  console.log('')
  console.log('Note: Keep these keys secure and never commit them to version control!')
}

// Generate keys when script is run directly
if (require.main === module) {
  generateKeys()
}

module.exports = { generateKeys, generateEncryptionKey }
