// cloudfunctions/shared/crypto.js - AES encryption for sensitive user data
const crypto = require('crypto');

// IMPORTANT: In production, store this key in cloud environment variables
// or use a dedicated key management service. Never hardcode in source.
const ENCRYPTION_KEY = process.env.ENCRYPTION_KEY || 'tea-shop-aes-key-change-in-production';
const ALGORITHM = 'aes-256-cbc';

/**
 * Encrypt a plaintext string
 * @param {string} text - Text to encrypt
 * @returns {string} Encrypted string (iv:ciphertext, base64)
 */
function encrypt(text) {
  if (!text) return text;
  const iv = crypto.randomBytes(16);
  const key = Buffer.from(ENCRYPTION_KEY.padEnd(32).slice(0, 32), 'utf8');
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);
  let encrypted = cipher.update(text, 'utf8', 'base64');
  encrypted += cipher.final('base64');
  return iv.toString('base64') + ':' + encrypted;
}

/**
 * Decrypt an encrypted string
 * @param {string} encryptedText - Encrypted string (iv:ciphertext)
 * @returns {string} Decrypted plaintext
 */
function decrypt(encryptedText) {
  if (!encryptedText || !encryptedText.includes(':')) return encryptedText;
  const parts = encryptedText.split(':');
  const iv = Buffer.from(parts[0], 'base64');
  const key = Buffer.from(ENCRYPTION_KEY.padEnd(32).slice(0, 32), 'utf8');
  const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
  let decrypted = decipher.update(parts[1], 'base64', 'utf8');
  decrypted += decipher.final('utf8');
  return decrypted;
}

/**
 * Encrypt sensitive fields in an address object
 * @param {object} address - Address object with name, phone, detail fields
 * @returns {object} Address with encrypted sensitive fields
 */
function encryptAddress(address) {
  if (!address) return null;
  return {
    ...address,
    name: encrypt(address.name),
    phone: encrypt(address.phone),
    detail: encrypt(address.detail),
    province: address.province,  // Province/city/district are not sensitive
    city: address.city,
    district: address.district,
    isDefault: address.isDefault,
    _encrypted: true
  };
}

/**
 * Decrypt sensitive fields in an address object
 * @param {object} address - Address with encrypted fields
 * @returns {object} Address with decrypted sensitive fields
 */
function decryptAddress(address) {
  if (!address || !address._encrypted) return address;
  return {
    ...address,
    name: decrypt(address.name),
    phone: decrypt(address.phone),
    detail: decrypt(address.detail),
    _encrypted: false
  };
}

/**
 * Encrypt buyer info object
 * @param {object} buyerInfo - { name, phone }
 * @returns {object} Encrypted buyer info
 */
function encryptBuyerInfo(buyerInfo) {
  if (!buyerInfo) return {};
  return {
    name: encrypt(buyerInfo.name),
    phone: encrypt(buyerInfo.phone),
    _encrypted: true
  };
}

/**
 * Decrypt buyer info object
 * @param {object} buyerInfo - Encrypted buyer info
 * @returns {object} Decrypted buyer info
 */
function decryptBuyerInfo(buyerInfo) {
  if (!buyerInfo || !buyerInfo._encrypted) return buyerInfo;
  return {
    name: decrypt(buyerInfo.name),
    phone: decrypt(buyerInfo.phone),
    _encrypted: false
  };
}

module.exports = {
  encrypt,
  decrypt,
  encryptAddress,
  decryptAddress,
  encryptBuyerInfo,
  decryptBuyerInfo
};
