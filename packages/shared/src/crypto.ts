/**
 * End-to-End Encryption (E2EE) utilities using Web Crypto API.
 * Compatible with modern browsers and Node.js 19+.
 * Uses AES-256-GCM with 96-bit (12-byte) initialization vectors and 128-bit authentication tags.
 */

// Get SubtleCrypto across Browser & Node environments
function getSubtle(): SubtleCrypto {
  if (typeof globalThis !== 'undefined' && globalThis.crypto?.subtle) {
    return globalThis.crypto.subtle;
  }
  throw new Error('Web Crypto API (crypto.subtle) is not available in this environment');
}

/**
 * Derive a 256-bit AES-GCM CryptoKey from a human pairing code or shared token.
 */
export async function deriveKeyFromSecret(secret: string, salt = 'ShareLAN-E2EE-Salt'): Promise<CryptoKey> {
  const subtle = getSubtle();
  const encoder = new TextEncoder();
  const keyMaterial = await subtle.importKey(
    'raw',
    encoder.encode(secret),
    { name: 'PBKDF2' },
    false,
    ['deriveKey']
  );

  return subtle.deriveKey(
    {
      name: 'PBKDF2',
      salt: encoder.encode(salt),
      iterations: 100000,
      hash: 'SHA-256',
    },
    keyMaterial,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt']
  );
}

/**
 * Encrypt a chunk of data with AES-256-GCM.
 * Output format: [12 bytes IV][Ciphertext + 16-byte Auth Tag]
 */
export async function encryptChunk(chunk: Uint8Array, key: CryptoKey): Promise<Uint8Array> {
  const subtle = getSubtle();
  const iv = new Uint8Array(12);
  globalThis.crypto.getRandomValues(iv);

  const encryptedBuffer = await subtle.encrypt(
    {
      name: 'AES-GCM',
      iv: iv as any,
    },
    key,
    chunk as any
  );

  const encryptedArray = new Uint8Array(encryptedBuffer);
  const result = new Uint8Array(iv.length + encryptedArray.length);
  result.set(iv, 0);
  result.set(encryptedArray, iv.length);

  return result;
}

/**
 * Decrypt a chunk encrypted by encryptChunk.
 * Expects: [12 bytes IV][Ciphertext + 16-byte Auth Tag]
 */
export async function decryptChunk(packedChunk: Uint8Array, key: CryptoKey): Promise<Uint8Array> {
  const subtle = getSubtle();
  if (packedChunk.length < 28) {
    // 12 bytes IV + 16 bytes auth tag minimum
    throw new Error('Malformed encrypted chunk: insufficient length');
  }

  const iv = packedChunk.subarray(0, 12);
  const ciphertext = packedChunk.subarray(12);

  const decryptedBuffer = await subtle.decrypt(
    {
      name: 'AES-GCM',
      iv: iv as any,
    },
    key,
    ciphertext as any
  );

  return new Uint8Array(decryptedBuffer);
}
