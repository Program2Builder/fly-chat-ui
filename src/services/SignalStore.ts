import { get, set, del, keys } from 'idb-keyval'
import type {
  Direction,
  StorageType,
} from '@privacyresearch/libsignal-protocol-typescript'

/**
 * An IndexedDB-backed store for libsignal-protocol-typescript.
 * Implements the StorageType interface.
 */
export class SignalProtocolStore implements StorageType {
  private userId: string

  constructor(userId: string) {
    this.userId = userId
  }

  private key(inner: string): string {
    return `${this.userId}-${inner}`
  }

  async getIdentityKeyPair(): Promise<any | undefined> {
    const kp = await get(this.key('identityKey'))
    if (!kp) return undefined

    // Deep-copy and handle naming ambiguity (libsignal uses both conventions)
    const pubKey = this.toBuffer(kp.pubKey || kp.publicKey)
    const privKey = this.toBuffer(kp.privKey || kp.privateKey)

    if (pubKey.byteLength !== 33 && pubKey.byteLength !== 32) {
      console.warn(`Identity PubKey has unusual length: ${pubKey.byteLength}`)
    }
    if (privKey.byteLength !== 32) {
      console.error(`CRITICAL: Identity PrivKey has invalid length: ${privKey.byteLength}. Handshake will fail.`)
    }

    return { pubKey, privKey }
  }

  async getLocalRegistrationId(): Promise<number | undefined> {
    return await get(this.key('registrationId'))
  }

  async saveIdentity(identifier: string, identityKey: ArrayBuffer): Promise<boolean> {
    await set(this.key(`identity-${identifier}`), this.toBuffer(identityKey))
    return true
  }

  async isTrustedIdentity(
    identifier: string,
    identityKey: ArrayBuffer,
    _direction: Direction
  ): Promise<boolean> {
    const trusted = await get(this.key(`identity-${identifier}`))
    if (trusted === undefined) {
      return true
    }
    return this.arrayBufferEquals(this.toBuffer(trusted), this.toBuffer(identityKey))
  }

  async loadPreKey(keyId: string | number): Promise<any | undefined> {
    const pk = await get(this.key(`prekey-${keyId}`))
    if (!pk) return undefined

    const kp = pk.keyPair || pk
    return {
      pubKey: this.toBuffer(kp.pubKey || kp.publicKey),
      privKey: this.toBuffer(kp.privKey || kp.privateKey)
    };
  }

  async storePreKey(keyId: string | number, keyPair: any): Promise<void> {
    // Normal storage is fine, loading is where we harden
    await set(this.key(`prekey-${keyId}`), keyPair)
  }

  async removePreKey(keyId: string | number): Promise<void> {
    await del(this.key(`prekey-${keyId}`))
  }

  // async loadSignedPreKey(keyId: string | number): Promise<any | undefined> {
  //   console.log("KeyId", `signedprekey-${keyId}`);
  //   const spk = await get(`signedprekey-${keyId}`)
  //   if (!spk) return undefined

  //   const kp = spk.keyPair || spk
  //   return {
  //     keyId: spk.keyId,
  //     keyPair: {
  //       pubKey: this.toBuffer(kp.pubKey || kp.publicKey),
  //       privKey: this.toBuffer(kp.privKey || kp.privateKey)
  //     },
  //     signature: this.toBuffer(spk.signature)
  //   }
  // }

  async loadSignedPreKey(keyId: string | number): Promise<any | undefined> {
    const spk = await get(this.key(`signedprekey-${keyId}`));
    if (!spk) return undefined;

    const kp = spk.keyPair || spk;

    // Return flattened structure matching KeyPairType
    return {
      pubKey: this.toBuffer(kp.pubKey || kp.publicKey),
      privKey: this.toBuffer(kp.privKey || kp.privateKey)
    };
  }

  async storeSignedPreKey(keyId: string | number, keyPair: any): Promise<void> {
    await set(this.key(`signedprekey-${keyId}`), keyPair)
  }

  async removeSignedPreKey(keyId: string | number): Promise<void> {
    await del(this.key(`signedprekey-${keyId}`))
  }

  async loadSession(identifier: string): Promise<any | undefined> {
    return await get(this.key(`session-${identifier}`))
  }

  async storeSession(identifier: string, record: any): Promise<void> {
    await set(this.key(`session-${identifier}`), record)
  }

  async removeSession(identifier: string): Promise<void> {
    await del(this.key(`session-${identifier}`))
  }

  async removeAllSessions(identifier: string): Promise<void> {
    const allKeys = await keys()
    const prefix = this.key(`session-${identifier}`)
    for (const key of allKeys) {
      if (typeof key === 'string' && key.startsWith(prefix)) {
        await del(key)
      }
    }
  }

  async saveLocalRegistrationId(registrationId: number): Promise<void> {
    await set(this.key('registrationId'), registrationId)
  }

  async saveIdentityKeyPair(keyPair: any): Promise<void> {
    await set(this.key('identityKey'), keyPair)
  }

  // --- Group Key Management ---
  async loadGroupKey(roomId: string): Promise<string | undefined> {
    return await get(this.key(`group-key-${roomId}`))
  }

  async storeGroupKey(roomId: string, key: string): Promise<void> {
    await set(this.key(`group-key-${roomId}`), key)
  }

  async loadGroupMetadata(roomId: string): Promise<any | undefined> {
    return await get(this.key(`group-meta-${roomId}`))
  }

  async storeGroupMetadata(roomId: string, meta: any): Promise<void> {
    await set(this.key(`group-meta-${roomId}`), meta)
  }

  async deleteAllData(): Promise<void> {
    const allKeys = await keys()
    const userPrefix = `${this.userId}-`
    for (const key of allKeys) {
      if (typeof key === 'string' && key.startsWith(userPrefix)) {
        await del(key)
      }
    }
  }

  /**
   * FOOLPROOF BUFFER CONVERSION
   * Ensures the return value is exactly a PURE ArrayBuffer (not SharedArrayBuffer or Subclass).
   * This is critical to satisfy libsignal's (thing instanceof ArrayBuffer) check.
   */
  private toBuffer(thing: any): ArrayBuffer {
    if (thing === undefined || thing === null) {
      console.error('toBuffer received null/undefined. This will cause an "Invalid private key" error.')
      return new ArrayBuffer(0)
    }

    let uint8: Uint8Array

    if (thing instanceof Uint8Array) {
      uint8 = thing
    } else if (thing instanceof ArrayBuffer || (typeof SharedArrayBuffer !== 'undefined' && thing instanceof SharedArrayBuffer)) {
      uint8 = new Uint8Array(thing)
    } else if (ArrayBuffer.isView(thing)) {
      uint8 = new Uint8Array(thing.buffer, thing.byteOffset, thing.byteLength)
    } else if (typeof thing === 'string') {
      try {
        const binary = atob(thing)
        uint8 = new Uint8Array(binary.length)
        for (let i = 0; i < binary.length; i++) {
          uint8[i] = binary.charCodeAt(i)
        }
      } catch (e) {
        console.error('Failed to decode Base64 string in toBuffer:', e)
        return new ArrayBuffer(0)
      }
    } else {
      console.warn('toBuffer received unusual type:', typeof thing, thing)
      return new ArrayBuffer(0)
    }

    // CRITICAL for libsignal: Always create a fresh, plain ArrayBuffer copy
    const pureBuffer = new ArrayBuffer(uint8.byteLength)
    new Uint8Array(pureBuffer).set(uint8)
    return pureBuffer
  }

  private arrayBufferEquals(a: ArrayBuffer, b: ArrayBuffer): boolean {
    if (a.byteLength !== b.byteLength) return false
    const viewA = new Uint8Array(a)
    const viewB = new Uint8Array(b)
    for (let i = 0; i < viewA.length; i++) {
      if (viewA[i] !== viewB[i]) return false
    }
    return true
  }
}
