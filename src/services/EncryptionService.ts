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
   * Resets the service context and store. 
   * MUST be called on logout to prevent session crossover.
   */
  public logout(): void {
    this._store = null;
    this.context = null;
    this.initialized = false;
    this.initializationPromise = null;
  }

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

  /**
   * Returns true when the service already has a context set for the given user.
   * Used to avoid double-initialization (login vs session-restore paths).
   */
  public isContextSet(userId?: number | string): boolean {
    if (!this._store || !this.context) return false
    if (userId === undefined) return true
    const currentId = String(this.context.user?.id ?? this.context.user?.username ?? '')
    return currentId === String(userId)
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

  /**
   * Wipes all Signal keys from IndexedDB and resets in-memory state.
   * The caller MUST call setAccountContext() + initialize() afterwards
   * to generate and upload a fresh key set.
   */
  async reset(): Promise<void> {
    if (this._store) {
      console.log('[E2EE] Wiping all local keys from IndexedDB...')
      await this._store.deleteAllData()
      console.log('[E2EE] Local key store cleared.')
    }
    // Reset flags but keep _store and context so resetEncryption() can
    // immediately call initialize() without needing a full re-login.
    this.initialized = false
    this.initializationPromise = null
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

  async getEncryptionBundle(): Promise<any> {
    await this.initialize()
    const store = this.ensureStore()

    const registrationId = await store.getLocalRegistrationId()
    const identityKey = await store.getIdentityKeyPair()
    if (!identityKey?.pubKey) throw new Error('[E2EE] Cannot build bundle: identity key missing from store.')

    const signedPreKey = await store.loadSignedPreKey(1)
    if (!signedPreKey?.pubKey) throw new Error('[E2EE] Cannot build bundle: signed pre-key missing from store.')
    if (!signedPreKey?.signature) {
      throw new Error(
        '[E2EE] Cannot build bundle: signed pre-key SIGNATURE is missing. ' +
        'The SignalStore.loadSignedPreKey() must return the signature field.'
      )
    }

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

    const bundle = {
      registrationId,
      identityPublicKey: this.arrayBufferToBase64(identityKey.pubKey),
      signedPreKey: {
        keyId: 1,
        publicKey: this.arrayBufferToBase64(signedPreKey.pubKey),
        signature: this.arrayBufferToBase64(signedPreKey.signature)
      },
      oneTimePreKeys
    }

    // Sanity-check: signature must be a non-empty base64 string
    if (!bundle.signedPreKey.signature) {
      throw new Error('[E2EE] Signed pre-key signature serialized to empty string. Aborting bundle upload.')
    }

    console.debug('[E2EE] getEncryptionBundle | sigLen:', bundle.signedPreKey.signature.length,
      '| preKeys:', oneTimePreKeys.length)
    return bundle
  }

  /**
   * Eagerly performs an X3DH key agreement with a recipient using their public
   * bundle fetched from the server.  Call this when a direct conversation is
   * opened so the Signal session is ready before the first message is sent.
   *
   * If a session already exists for this recipient the call is a no-op.
   */
  async preEstablishSession(recipientId: string, bundle: any): Promise<void> {
    if (!bundle?.identityPublicKey) {
      console.warn('[E2EE] preEstablishSession: no bundle for', recipientId, '– skipping.')
      return
    }

    await this.initialize()
    const address = new SignalProtocolAddress(recipientId, 1)
    const store = this.ensureStore()

    const hasSession = await store.loadSession(address.toString())
    if (hasSession) {
      console.debug('[E2EE] Session already exists for', recipientId, '– no X3DH needed.')
      return
    }

    const sessionBuilder = new SessionBuilder(store as any, address)
    const preKeyBundle: any = {
      registrationId: bundle.registrationId,
      identityKey: this.base64ToArrayBuffer(bundle.identityPublicKey),
      signedPreKey: {
        keyId: bundle.signedPreKey.keyId,
        publicKey: this.base64ToArrayBuffer(bundle.signedPreKey.publicKey),
        signature: this.base64ToArrayBuffer(bundle.signedPreKey.signature),
      },
      preKey: bundle.oneTimePreKeys?.[0]
        ? {
            keyId: bundle.oneTimePreKeys[0].keyId,
            publicKey: this.base64ToArrayBuffer(bundle.oneTimePreKeys[0].publicKey),
          }
        : undefined,
    }

    await sessionBuilder.processPreKey(preKeyBundle)
    console.log('[E2EE] Session pre-established with', recipientId,
      '| regId:', bundle.registrationId,
      '| preKeyId:', bundle.oneTimePreKeys?.[0]?.keyId ?? 'none')
  }

  async encryptMessage(recipientId: string, plaintext: string, bundle?: any): Promise<any> {
    await this.initialize()
    const address = new SignalProtocolAddress(recipientId, 1)

    const store = this.ensureStore()

    // ── KEY DEBUG ────────────────────────────────────────────────────────────
    const localIdentity = await store.getIdentityKeyPair()
    const localPubKeyHex = localIdentity?.pubKey
      ? this.bufToHex(localIdentity.pubKey)
      : '(none)'
    const recipientPubKeyHex = bundle?.identityPublicKey
      ? this.bufToHex(this.base64ToArrayBuffer(bundle.identityPublicKey))
      : '(no bundle)'
    console.groupCollapsed(`[E2EE] encryptMessage → ${recipientId}`)
    console.log('  My identity pubkey  :', localPubKeyHex)
    console.log('  Recipient pubkey    :', recipientPubKeyHex)
    console.log('  Plaintext preview   :', plaintext.slice(0, 40))
    console.groupEnd()
    // ─────────────────────────────────────────────────────────────────────────

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

    // libsignal might return Uint8Array or string (base64)
    const body = (typeof ciphertext.body === 'string') 
      ? ciphertext.body 
      : (ciphertext.body ? this.toBase64(ciphertext.body) : '')
      
    console.log(`[E2EE] encryptMessage done | type=${ciphertext.type} | bodyLen=${body.length}`)
    return {
      type: ciphertext.type,
      body: body,
      registrationId: await this.ensureStore().getLocalRegistrationId()
    }
  }

  async decryptMessage(senderId: string, ciphertext: any): Promise<string> {
    await this.initialize();

    // Guard: ciphertext must exist and have a body
    if (!ciphertext || !ciphertext.body) {
      throw new Error(`[E2EE] decryptMessage called with missing ciphertext/body for sender=${senderId}`);
    }

    // Validate our own private keys before attempting any decryption
    await this.assertPrivateKeysValid();

    const store = this.ensureStore()
    const address = new SignalProtocolAddress(senderId, 1);

    // ── KEY DEBUG ────────────────────────────────────────────────────────────
    const localIdentity = await store.getIdentityKeyPair()
    const localPubKeyHex = localIdentity?.pubKey
      ? this.bufToHex(localIdentity.pubKey)
      : '(none)'
    const storedSenderIdentity = await store.loadSession(address.toString())
    console.groupCollapsed(`[E2EE] decryptMessage ← ${senderId}`)
    console.log('  My identity pubkey  :', localPubKeyHex)
    console.log('  Session for sender  :', storedSenderIdentity ? 'EXISTS' : 'NONE (will X3DH)')
    console.log('  Ciphertext type     :', ciphertext.type ?? '(none, using fallback=3)')
    console.log('  Body length         :', String(ciphertext.body).length)
    console.groupEnd()
    // ─────────────────────────────────────────────────────────────────────────

    const sessionCipher = new SessionCipher(store as any, address);

    const bodyBuffer = this.decodeBody(ciphertext.body);

    // Helper that tries one message type, returns decrypted buffer or throws
    const tryDecrypt = async (type: number): Promise<ArrayBuffer> => {
      if (type === 3) {
        // PreKeyWhisperMessage — establishes a new session
        return await sessionCipher.decryptPreKeyWhisperMessage(
          bodyBuffer, 'binary'
        ) as ArrayBuffer;
      } else {
        return await sessionCipher.decryptWhisperMessage(
          bodyBuffer, 'binary'
        ) as ArrayBuffer;
      }
    }

    let decrypted: ArrayBuffer;
    const primaryType = ciphertext.type ?? 3;
    const alternateType = primaryType === 3 ? 1 : 3;

    try {
      decrypted = await tryDecrypt(primaryType);
    } catch (primaryErr: any) {
      console.warn(`[E2EE] Primary decrypt (type=${primaryType}) failed, retrying with type=${alternateType}:`, primaryErr.message);
      try {
        decrypted = await tryDecrypt(alternateType);
      } catch (altErr: any) {
        // Both failed — re-throw the original error for upstream handling
        console.error(`[E2EE] Both decrypt attempts failed | sender=${senderId}`);
        throw primaryErr;
      }
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
    return this.toBase64(buffer)
  }

  /** Robustly converts ArrayBuffer or Uint8Array to base64 string. */
  public toBase64(data: ArrayBuffer | Uint8Array): string {
    const bytes = data instanceof Uint8Array ? data : new Uint8Array(data)
    let binary = ''
    const len = bytes.byteLength
    for (let i = 0; i < len; i++) {
      binary += String.fromCharCode(bytes[i])
    }
    return btoa(binary)
  }

  /** Converts an ArrayBuffer to a printable hex string (first 16 bytes + length suffix). */
  private bufToHex(buf: ArrayBuffer): string {
    const bytes = new Uint8Array(buf)
    const hexBytes = Array.from(bytes.slice(0, 16))
      .map(b => b.toString(16).padStart(2, '0'))
      .join(' ')
    return `${hexBytes}${bytes.length > 16 ? ' …' : ''} (${bytes.length}B)`
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
      body: this.service.toBase64(new Uint8Array(encryptedContent)),
      iv: this.service.toBase64(iv),
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
