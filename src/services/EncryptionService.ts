import {
  KeyHelper,
  SessionBuilder,
  SessionCipher,
  SignalProtocolAddress,
} from '@privacyresearch/libsignal-protocol-typescript'
import { SignalProtocolStore } from './SignalStore'

/**
 * High-level encryption service to handle E2EE logic for FlyChat.
 */
export class EncryptionService {
  private _store: SignalProtocolStore | null = null
  private initialized: boolean = false
  private initializationPromise: Promise<void> | null = null
  private context: { user: any; password?: string } | null = null

  constructor() {}

  /**
   * Binds the service to a specific backend account.
   * If password is provided, keys will be generated deterministically.
   */
  async setAccountContext(user: any, password?: string): Promise<void> {
    const userIdStr = String(user.id || user.username)
    this._store = new SignalProtocolStore(userIdStr)
    this.context = { user, password }
    this.initialized = false // Reset state for new context
  }

  public getStore(): SignalProtocolStore {
    if (!this._store) {
      throw new Error('EncryptionService: Account context not set. Call setAccountContext first.')
    }
    return this._store
  }

  private ensureStore(): SignalProtocolStore {
    return this.getStore()
  }

  async initialize(): Promise<void> {
    if (this.initialized) return
    if (!this._store || !this.context) {
      throw new Error('EncryptionService: Cannot initialize without account context.')
    }
    if (this.initializationPromise) return this.initializationPromise

    this.initializationPromise = (async () => {
      const store = this.ensureStore()
      const identityKey = await store.getIdentityKeyPair()

      if (!identityKey) {
        console.log(`E2EE: No identity keys found for user ${this.context?.user.username}. Generating...`)
        
        // registrationId is now deterministic based on backend ID
        const registrationId = (Number(this.context?.user.id) || 0) % 0x3fff || 1
        
        let identityKeyPair: any
        
        if (this.context?.password) {
          console.log('E2EE: Deriving deterministic identity from password...')
          const seed = await this.deriveSeedFromPassword(this.context.password, this.context.user.username)
          // We manually call the seeded generation if supported, otherwise cast
          identityKeyPair = await (KeyHelper as any).generateIdentityKeyPair(seed)
          
          if (!identityKeyPair || !identityKeyPair.privKey) {
             throw new Error('E2EE: Critical failure - Library does not support seeded key generation.');
          }
        } else {
          identityKeyPair = await KeyHelper.generateIdentityKeyPair()
        }

        await store.saveLocalRegistrationId(registrationId)
        await store.saveIdentityKeyPair(identityKeyPair)

        const SIGNED_PREKEY_ID = 1
        const signedPreKey = await KeyHelper.generateSignedPreKey(identityKeyPair, SIGNED_PREKEY_ID)
        await store.storeSignedPreKey(SIGNED_PREKEY_ID, signedPreKey)

        // Generate one-time prekeys
        for (let i = 0; i < 20; i++) {
          const preKey = await KeyHelper.generatePreKey(i)
          await store.storePreKey(i, preKey)
        }
        console.log('E2EE: Successfully bootstrapped account-bound encryption keys.')
      } else {
        console.log(`E2EE: Account-bound keys loaded for ${this.context?.user.username}.`)
      }

      this.initialized = true
      this.initializationPromise = null
    })()

    return this.initializationPromise
  }

  private async deriveSeedFromPassword(password: string, salt: string): Promise<ArrayBuffer> {
    const enc = new TextEncoder()
    const passwordKey = await window.crypto.subtle.importKey(
      'raw',
      enc.encode(password),
      { name: 'PBKDF2' },
      false,
      ['deriveBits']
    )

    const bits = await window.crypto.subtle.deriveBits(
      {
        name: 'PBKDF2',
        salt: enc.encode(salt + 'flychat-id-v1'),
        iterations: 100000,
        hash: 'SHA-256'
      },
      passwordKey,
      256 // 32 bytes
    )
    return bits
  }

  async reset(): Promise<void> {
    if (this._store) {
      await this._store.deleteAllData()
    }
    this.initialized = false
    this.initializationPromise = null
    this.context = null
    this._store = null
  }

  async getEncryptionBundle(): Promise<any> {
    await this.initialize()
    const store = this.ensureStore()

    const registrationId = await store.getLocalRegistrationId()
    const identityKey = await store.getIdentityKeyPair()
    const signedPreKey = await store.loadSignedPreKey(1)

    const oneTimePreKeys = []
    for (let i = 0; i < 20; i++) {
      const pk = await store.loadPreKey(i)
      if (pk) {
        oneTimePreKeys.push({
          keyId: i,
          publicKey: this.arrayBufferToBase64(pk.pubKey)
        })
      }
    }

    return {
      registrationId,
      identityPublicKey: this.arrayBufferToBase64(identityKey!.pubKey),
      signedPreKey: {
        keyId: 1,
        publicKey: this.arrayBufferToBase64(signedPreKey!.pubKey),
        signature: this.arrayBufferToBase64(signedPreKey!.signature)
      },
      oneTimePreKeys
    }
  }

  async encryptMessage(recipientId: string, plaintext: string, bundle?: any): Promise<any> {
    await this.initialize()
    const address = new SignalProtocolAddress(recipientId, 1)

    const store = this.ensureStore()
    const hasSession = await store.loadSession(address.toString())
    if (!hasSession && bundle) {
      const sessionBuilder = new SessionBuilder(store as any, address)
      const preKeyBundle: any = {
        registrationId: bundle.registrationId,
        identityKey: this.base64ToArrayBuffer(bundle.identityPublicKey),
        signedPreKey: {
          keyId: bundle.signedPreKey.keyId,
          publicKey: this.base64ToArrayBuffer(bundle.signedPreKey.publicKey),
          signature: this.base64ToArrayBuffer(bundle.signedPreKey.signature)
        },
        preKey: bundle.oneTimePreKeys?.[0] ? {
          keyId: bundle.oneTimePreKeys[0].keyId,
          publicKey: this.base64ToArrayBuffer(bundle.oneTimePreKeys[0].publicKey)
        } : undefined
      }
      await sessionBuilder.processPreKey(preKeyBundle)
    }

    const sessionCipher = new SessionCipher(store as any, address)
    const encoded = new TextEncoder().encode(plaintext)
    const plainBuffer = encoded.buffer.slice(encoded.byteOffset, encoded.byteOffset + encoded.byteLength)
    const ciphertext = await sessionCipher.encrypt(plainBuffer);

    const body = (ciphertext.body as any) instanceof ArrayBuffer 
      ? this.arrayBufferToBase64(ciphertext.body as unknown as ArrayBuffer) 
      : (ciphertext.body || '') as string
      
    return {
      type: ciphertext.type,
      body: body,
      registrationId: await this.ensureStore().getLocalRegistrationId()
    }
  }

  async decryptMessage(senderId: string, ciphertext: any): Promise<string> {
    await this.initialize();

    // ── 1. Validate that OUR OWN private keys are present and sane ──────────
    await this.assertPrivateKeysValid();

    const store = this.ensureStore()
    const address = new SignalProtocolAddress(senderId, 1);
    const sessionCipher = new SessionCipher(store as any, address);

    // ── 2. Decode the body robustly ─────────────────────────────────────────
    const bodyBuffer = this.decodeBody(ciphertext.body);

    // ── 3. Decrypt ──────────────────────────────────────────────────────────
    let decrypted: ArrayBuffer;
    try {
      if (ciphertext.type === 3) {
        // PreKeyWhisperMessage – triggers SessionBuilder internally,
        // which needs our identity PRIVATE key + pre-key PRIVATE key.
        decrypted = await sessionCipher.decryptPreKeyWhisperMessage(
          bodyBuffer,
          'binary'
        ) as ArrayBuffer;
      } else {
        decrypted = await sessionCipher.decryptWhisperMessage(
          bodyBuffer,
          'binary'
        ) as ArrayBuffer;
      }
    } catch (e: any) {
      console.error(`[E2EE] Decryption failed | type=${ciphertext.type} | sender=${senderId} |`, e.message);
      throw e;
    }

    return new TextDecoder().decode(decrypted);
  }

  /**
   * Decodes a message body that may arrive as Base64, a raw binary string,
   * or already an ArrayBuffer.
   */
  private decodeBody(body: string | ArrayBuffer): ArrayBuffer {
    if (body instanceof ArrayBuffer) return body;

    if (this.isBase64(body as string)) {
      return this.base64ToArrayBuffer(body as string);
    }

    // Raw binary string fallback
    const bodyStr = body as string;
    const bytes = new Uint8Array(bodyStr.length);
    for (let i = 0; i < bodyStr.length; i++) {
      bytes[i] = bodyStr.charCodeAt(i);
    }
    return bytes.buffer;
  }

  /**
   * Validates that the local identity key pair and at least one pre-key
   * exist and contain a valid 32-byte Curve25519 private key.
   */
  private async assertPrivateKeysValid(): Promise<void> {
    const store = this.ensureStore()
    // ── identity key ────────────────────────────────────────────────────────
    const identityKeyPair = await store.getIdentityKeyPair();
    if (!identityKeyPair?.privKey) {
      throw new Error('[E2EE] Identity private key is missing from store.');
    }
    this.assertKeyBuffer(identityKeyPair.privKey, 'identity');

    // ── signed pre-key (keyId 1 is what we register) ──
    const signedPreKey = await store.loadSignedPreKey(1);
    if (!signedPreKey?.privKey) {
      throw new Error('[E2EE] Signed pre-key (id=1) private key is missing from store.');
    }
    this.assertKeyBuffer(signedPreKey.privKey, 'signedPreKey#1');

    const oneTimePreKey = await store.loadPreKey(0);
    if (oneTimePreKey && !oneTimePreKey.privKey) {
      throw new Error('[E2EE] One-time pre-key (id=0) exists but has no private key.');
    }
    if (oneTimePreKey?.privKey) {
      this.assertKeyBuffer(oneTimePreKey.privKey, 'oneTimePreKey#0');
    }
  }

  /**
   * Asserts that a key stored in the Signal store is an ArrayBuffer of
   * exactly 32 bytes (Curve25519 scalar).
   */
  private assertKeyBuffer(key: ArrayBuffer, label: string): void {
    if (!(key instanceof ArrayBuffer)) {
      throw new Error(`[E2EE] ${label} private key is not an ArrayBuffer.`);
    }
    if (key.byteLength !== 32) {
      throw new Error(`[E2EE] ${label} private key has wrong length: expected 32, got ${key.byteLength}.`);
    }
  }

  private isBase64(str: string): boolean {
    if (!str || str.length % 4 !== 0) return false;
    const base64Regex = /^[A-Za-z0-9+/]*={0,2}$/;
    return base64Regex.test(str);
  }

  async encryptFile(file: File): Promise<{ encryptedBlob: Blob; key: string; iv: string }> {
    const key = await window.crypto.subtle.generateKey(
      { name: 'AES-GCM', length: 256 },
      true,
      ['encrypt', 'decrypt']
    )
    const iv = window.crypto.getRandomValues(new Uint8Array(12))
    const fileBuffer = await file.arrayBuffer()
    const encryptedBuffer = await window.crypto.subtle.encrypt(
      { name: 'AES-GCM', iv },
      key,
      fileBuffer
    )

    const exportedKey = await window.crypto.subtle.exportKey('raw', key)

    return {
      encryptedBlob: new Blob([encryptedBuffer], { type: 'application/octet-stream' }),
      key: this.arrayBufferToBase64(exportedKey),
      iv: this.arrayBufferToBase64(iv.buffer)
    }
  }

  async decryptFile(encryptedBlob: Blob, keyBase64: string, ivBase64: string): Promise<Blob> {
    const keyBuffer = this.base64ToArrayBuffer(keyBase64)
    const ivBuffer = this.base64ToArrayBuffer(ivBase64)

    const key = await window.crypto.subtle.importKey(
      'raw',
      keyBuffer,
      'AES-GCM',
      true,
      ['decrypt']
    )

    const encryptedBuffer = await encryptedBlob.arrayBuffer()
    const decryptedBuffer = await window.crypto.subtle.decrypt(
      { name: 'AES-GCM', iv: new Uint8Array(ivBuffer) },
      key,
      encryptedBuffer
    )

    return new Blob([decryptedBuffer])
  }

  arePublicKeysEqual(key1: ArrayBuffer | string, key2: ArrayBuffer | string): boolean {
    const buf1 = typeof key1 === 'string' ? this.base64ToArrayBuffer(key1) : key1
    const buf2 = typeof key2 === 'string' ? this.base64ToArrayBuffer(key2) : key2

    if (buf1.byteLength !== buf2.byteLength) return false
    const view1 = new Uint8Array(buf1)
    const view2 = new Uint8Array(buf2)
    for (let i = 0; i < view1.length; i++) {
      if (view1[i] !== view2[i]) return false
    }
    return true
  }

  private arrayBufferToBase64(buffer: ArrayBuffer): string {
    let binary = ''
    const bytes = new Uint8Array(buffer)
    const len = bytes.byteLength
    for (let i = 0; i < len; i++) {
      binary += String.fromCharCode(bytes[i])
    }
    return btoa(binary)
  }

  private base64ToArrayBuffer(base64: string): ArrayBuffer {
    const binary = atob(base64)
    const len = binary.length
    const bytes = new Uint8Array(len)
    for (let i = 0; i < len; i++) {
      bytes[i] = binary.charCodeAt(i)
    }
    return bytes.buffer
  }
}

export const encryptionService = new EncryptionService()

/**
 * Group Encryption Logic
 */
export class GroupEncryptionService {
  private service: EncryptionService

  constructor(service: EncryptionService) {
    this.service = service
  }

  async encryptGroupMessage(roomId: string, memberIds: string[], plaintext: string): Promise<any> {
    await this.service.initialize()
    const store = this.service.getStore()

    let groupKey = await store.loadGroupKey(roomId)
    let keysForMembers: Record<string, any> = {}

    if (!groupKey) {
      const rawKey = window.crypto.getRandomValues(new Uint8Array(32))
      groupKey = btoa(String.fromCharCode(...rawKey))
      await store.storeGroupKey(roomId, groupKey)

      for (const memberId of memberIds) {
        try {
          const encryptedKey = await this.service.encryptMessage(memberId, groupKey)
          keysForMembers[memberId] = encryptedKey
        } catch (e) {
          console.warn(`Could not encrypt group key for member ${memberId}:`, e)
        }
      }
    }

    const iv = window.crypto.getRandomValues(new Uint8Array(12))
    const keyBuffer = Uint8Array.from(atob(groupKey), c => c.charCodeAt(0))
    const cryptoKey = await window.crypto.subtle.importKey(
      'raw',
      keyBuffer,
      'AES-GCM',
      true,
      ['encrypt']
    )

    const encryptedContent = await window.crypto.subtle.encrypt(
      { name: 'AES-GCM', iv },
      cryptoKey,
      new TextEncoder().encode(plaintext)
    )

    return {
      isGroupEncryption: true,
      roomId,
      body: btoa(String.fromCharCode(...new Uint8Array(encryptedContent))),
      iv: btoa(String.fromCharCode(...iv)),
      keys: Object.keys(keysForMembers).length > 0 ? keysForMembers : undefined
    }
  }

  async decryptGroupMessage(roomId: string, senderId: string, ciphertext: any, myId: string): Promise<string> {
    await this.service.initialize()
    const store = this.service.getStore()

    if (ciphertext.keys && ciphertext.keys[myId]) {
      try {
        const decryptedKey = await this.service.decryptMessage(senderId, ciphertext.keys[myId])
        await store.storeGroupKey(roomId, decryptedKey)
      } catch (e) {
        console.error('Failed to decrypt and store new group key:', e)
      }
    }

    let groupKey = await store.loadGroupKey(roomId)
    if (!groupKey) {
      throw new Error('No group key found for decryption')
    }

    const iv = Uint8Array.from(atob(ciphertext.iv), c => c.charCodeAt(0))
    const keyBuffer = Uint8Array.from(atob(groupKey), c => c.charCodeAt(0))
    const cryptoKey = await window.crypto.subtle.importKey(
      'raw',
      keyBuffer,
      'AES-GCM',
      true,
      ['decrypt']
    )

    const decryptedBuffer = await window.crypto.subtle.decrypt(
      { name: 'AES-GCM', iv },
      cryptoKey,
      Uint8Array.from(atob(ciphertext.body), c => c.charCodeAt(0))
    )

    return new TextDecoder().decode(decryptedBuffer)
  }
}

export const groupEncryptionService = new GroupEncryptionService(encryptionService)
