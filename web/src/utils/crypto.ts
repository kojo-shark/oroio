import CryptoJS from 'crypto-js';

const SALT = 'oroio';

export function decryptKeys(encryptedData: ArrayBuffer): string[] {
  const bytes = new Uint8Array(encryptedData);
  
  // OpenSSL format: "Salted__" + 8-byte salt + ciphertext
  const header = String.fromCharCode(...bytes.slice(0, 8));
  if (header !== 'Salted__') {
    throw new Error('Invalid encrypted file format');
  }
  
  const salt = CryptoJS.lib.WordArray.create(bytes.slice(8, 16) as unknown as number[]);
  const ciphertext = CryptoJS.lib.WordArray.create(bytes.slice(16) as unknown as number[]);
  
  // Derive key and IV using PBKDF2
  const keySize = 256 / 32;
  const ivSize = 128 / 32;
  const derived = CryptoJS.PBKDF2(SALT, salt, {
    keySize: keySize + ivSize,
    iterations: 10000,
    hasher: CryptoJS.algo.SHA256,
  });
  
  const key = CryptoJS.lib.WordArray.create(derived.words.slice(0, keySize));
  const iv = CryptoJS.lib.WordArray.create(derived.words.slice(keySize, keySize + ivSize));
  
  const decrypted = CryptoJS.AES.decrypt(
    { ciphertext } as CryptoJS.lib.CipherParams,
    key,
    { iv, mode: CryptoJS.mode.CBC, padding: CryptoJS.pad.Pkcs7 }
  );
  
  const text = decrypted.toString(CryptoJS.enc.Utf8);
  return text.split('\n').filter(line => line.trim()).map(line => line.split('\t')[0]);
}

export function maskKey(key: string): string {
  if (key.length <= 10) {
    return key.slice(0, 3) + '***';
  }
  return key.slice(0, 6) + '...' + key.slice(-4);
}
