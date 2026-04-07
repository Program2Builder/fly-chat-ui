const PBKDF2_ITERATIONS = 100000;
const AES_KEY_LEN = 256; // bits

/** 
 * Derives a deterministic vault key from user password + userId. 
 * Call this once after login.
 */
export async function deriveVaultKey(password: string, userId: string): Promise<CryptoKey> {
  const encoder = new TextEncoder();
  const baseKey = await window.crypto.subtle.importKey(
    'raw', encoder.encode(password), 'PBKDF2', false, ['deriveKey']
  );

  return await window.crypto.subtle.deriveKey(
    {
      name: 'PBKDF2',
      salt: encoder.encode(userId + "vault-v1"),
      iterations: PBKDF2_ITERATIONS,
      hash: 'SHA-256'
    },
    baseKey,
    { name: 'AES-GCM', length: AES_KEY_LEN },
    true, // Extractable for sessionStorage bridge
    ['encrypt', 'decrypt']
  );
}

/** 
 * Encrypts plaintext → base64(IV + Ciphertext)
 */
export async function encryptForVault(plaintext: string, key: CryptoKey): Promise<string> {
  const iv = window.crypto.getRandomValues(new Uint8Array(12));
  const encoded = new TextEncoder().encode(plaintext);
  
  const encrypted = await window.crypto.subtle.encrypt(
    { name: 'AES-GCM', iv }, key, encoded
  );

  const combined = new Uint8Array(iv.length + encrypted.byteLength);
  combined.set(iv);
  combined.set(new Uint8Array(encrypted), iv.length);
  
  return btoa(String.fromCharCode(...combined));
}

/** 
 * Decrypts base64(IV + Ciphertext) → plaintext
 */
export async function decryptFromVault(base64: string, key: CryptoKey): Promise<string> {
  const combined = new Uint8Array(atob(base64).split('').map(c => c.charCodeAt(0)));
  const iv = combined.slice(0, 12);
  const data = combined.slice(12);

  const decrypted = await window.crypto.subtle.decrypt(
    { name: 'AES-GCM', iv }, key, data
  );

  return new TextDecoder().decode(decrypted);
}
