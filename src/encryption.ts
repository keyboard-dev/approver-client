import { randomBytes, createCipheriv, createDecipheriv } from 'crypto';
import '@dotenvx/dotenvx/config'



const ALGORITHM = 'aes-256-cbc';
const ENCRYPTION_KEY = Buffer.from(process.env.ENCRYPTION_KEY || '', 'hex'); // Load from env
const CUSTOM_ENCRYPTION_KEY = Buffer.from(process.env.CODE_ENCRYPTION_KEY || '', 'hex');

export function encrypt(text: string): string {
  try {
    if (!ENCRYPTION_KEY || ENCRYPTION_KEY.length !== 32) {
      throw new Error('Encryption key must be 32 bytes');
    }
    
    const iv = randomBytes(16);
    const cipher = createCipheriv(ALGORITHM, ENCRYPTION_KEY, iv);
    let encrypted = cipher.update(text, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    const ivString = iv.toString('hex');
    return ivString + ':' + encrypted;
  } catch (error) {
    console.error('Encryption error:', error);
    throw new Error('Failed to encrypt data');
  }
}

export function encryptWithCustomKey(text: string): string {
  try {
    console.warn("CUSTOM_ENCRYPTION_KEY", CUSTOM_ENCRYPTION_KEY)
    console.warn("CUSTOM_ENCRYPTION_KEY length", CUSTOM_ENCRYPTION_KEY.length)
    if (!CUSTOM_ENCRYPTION_KEY || CUSTOM_ENCRYPTION_KEY.length !== 32) {
      throw new Error('Encryption key must be 32 bytes');
    }
    const iv = randomBytes(16);
    const cipher = createCipheriv(ALGORITHM, CUSTOM_ENCRYPTION_KEY, iv);
    let encrypted = cipher.update(text, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    const ivString = iv.toString('hex');
    return ivString + ':' + encrypted;
  } catch (error) {
    console.error('Encryption error:', error);
    throw new Error('Failed to encrypt data');
  }
}



export function decrypt(encryptedText: string): string {
  try {
    const [ivHex, encrypted] = encryptedText.split(':');
    
    if (!ivHex || !encrypted) {
      throw new Error('Invalid encrypted data format');
    }
    
    const iv = Buffer.from(ivHex, 'hex');
    const decipher = createDecipheriv(ALGORITHM, ENCRYPTION_KEY, iv);
    
    let decrypted = decipher.update(encrypted, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    
    return decrypted;
  } catch (error) {
    console.error('Decryption error:', error);
    throw new Error('Failed to decrypt data');
  }
}

export function decryptWithCustomKey(encryptedText: string): string {
  try {
    const [ivHex, encrypted] = encryptedText.split(':');
    
    if (!ivHex || !encrypted) {
      throw new Error('Invalid encrypted data format');
    }
    const iv = Buffer.from(ivHex, 'hex');
    const decipher = createDecipheriv(ALGORITHM, CUSTOM_ENCRYPTION_KEY, iv);
    
    let decrypted = decipher.update(encrypted, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    
    return decrypted;
  } catch (error) {
    console.error('Decryption error:', error);
    throw new Error('Failed to decrypt data');
  }
}