import type {
  BootstrapResponse,
  ChatContact,
  ChatGroup,
  ChatMessage,
  MediaUploadResponse,
  Slice,
} from '../types/chat'

import { API_BASE_URL } from '../config'

async function readErrorMessage(response: Response) {
  const text = await response.text()
  return text || `${response.status} ${response.statusText}`
}

export function authHeaders(token: string) {
  return {
    Accept: 'application/json',
    Authorization: `Bearer ${token}`,
  }
}

export async function fetchBootstrap(token: string) {
  const response = await fetch(`${API_BASE_URL}/api/chat/bootstrap`, {
    headers: authHeaders(token),
  })

  if (!response.ok) {
    throw new Error(`Failed to load bootstrap: ${await readErrorMessage(response)}`)
  }

  return (await response.json()) as BootstrapResponse
}

export async function fetchContacts(token: string) {
  const response = await fetch(`${API_BASE_URL}/api/chat/contacts`, {
    headers: authHeaders(token),
  })

  if (!response.ok) {
    throw new Error(`Failed to load contacts: ${await readErrorMessage(response)}`)
  }

  return (await response.json()) as ChatContact[]
}

export async function fetchGroups(token: string) {
  const response = await fetch(`${API_BASE_URL}/api/chat/groups`, {
    headers: authHeaders(token),
  })

  if (!response.ok) {
    throw new Error(`Failed to load groups: ${await readErrorMessage(response)}`)
  }

  return (await response.json()) as ChatGroup[]
}

export async function fetchRoomHistory(
  roomId: string,
  token: string,
  page = 0,
  size = 20,
) {
  const params = new URLSearchParams({
    page: page.toString(),
    size: size.toString(),
  })
  
  const response = await fetch(
    `${API_BASE_URL}/api/chat/history/room/${encodeURIComponent(roomId)}?${params.toString()}`,
    {
      headers: authHeaders(token),
    },
  )

  if (!response.ok) {
    throw new Error(`Failed to load room history: ${await readErrorMessage(response)}`)
  }

  return (await response.json()) as Slice<ChatMessage>
}

export async function fetchDirectHistory(
  contactId: string,
  token: string,
  page = 0,
  size = 20,
) {
  const params = new URLSearchParams({
    page: page.toString(),
    size: size.toString(),
  })

  const response = await fetch(
    `${API_BASE_URL}/api/chat/history/direct/${encodeURIComponent(contactId)}?${params.toString()}`,
    {
      headers: authHeaders(token),
    },
  )

  if (!response.ok) {
    throw new Error(`Failed to load direct chat history: ${await readErrorMessage(response)}`)
  }

  return (await response.json()) as Slice<ChatMessage>
}

export async function uploadMedia(file: File, token: string) {
  const formData = new FormData()
  formData.append('file', file)

  const response = await fetch(`${API_BASE_URL}/api/chat/media`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
    },
    body: formData,
  })

  if (!response.ok) {
    throw new Error(`Failed to upload media: ${await readErrorMessage(response)}`)
  }

  return (await response.json()) as MediaUploadResponse
}

export async function addContact(username: string, token: string) {
  const response = await fetch(`${API_BASE_URL}/api/chat/contacts/${encodeURIComponent(username)}`, {
    method: 'POST',
    headers: authHeaders(token),
  })

  if (!response.ok) {
    throw new Error(await readErrorMessage(response))
  }
}

export async function removeContact(username: string, token: string) {
  const response = await fetch(`${API_BASE_URL}/api/chat/contacts/${encodeURIComponent(username)}`, {
    method: 'DELETE',
    headers: authHeaders(token),
  })

  if (!response.ok) {
    throw new Error(await readErrorMessage(response))
  }
}

export async function deleteGroup(groupId: number, token: string) {
  const response = await fetch(`${API_BASE_URL}/api/chat/groups/${groupId}`, {
    method: 'DELETE',
    headers: authHeaders(token),
  })

  if (!response.ok) {
    throw new Error(await readErrorMessage(response))
  }
}

export async function uploadProfilePicture(file: File, token: string) {
  const formData = new FormData()
  formData.append('file', file)

  const response = await fetch(`${API_BASE_URL}/api/chat/profile/picture`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
    },
    body: formData,
  })

  if (!response.ok) {
    throw new Error(`Failed to upload profile picture: ${await readErrorMessage(response)}`)
  }
}

export interface CreateGroupRequest {
  name: string
  description?: string
  members: string[]
}

export async function apiCreateGroup(data: CreateGroupRequest, token: string) {
  const response = await fetch(`${API_BASE_URL}/api/chat/groups`, {
    method: 'POST',
    headers: {
      ...authHeaders(token),
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(data),
  })

  if (!response.ok) {
    throw new Error(`Failed to create group: ${await readErrorMessage(response)}`)
  }

  return (await response.json()) as ChatGroup
}

export async function uploadEncryptionKeys(bundle: any, token: string) {
  // Backend schema: KeyRegistrationRequest {
  //   registrationId, identityPublicKey,
  //   signedPreKey: { keyId, publicKey, signature },
  //   oneTimePreKeys: [{ keyId, publicKey }, ...]   ← array
  // }
  // getEncryptionBundle() already produces this exact shape — send it as-is.
  const payload = {
    registrationId:   bundle.registrationId,
    identityPublicKey: bundle.identityPublicKey,
    signedPreKey:     bundle.signedPreKey,          // { keyId, publicKey, signature }
    oneTimePreKeys:   (bundle.oneTimePreKeys ?? []).map((pk: any) => ({
      keyId:     pk.keyId,
      publicKey: pk.publicKey,
    })),
  }

  console.debug(
    '[E2EE] uploadEncryptionKeys | regId:', payload.registrationId,
    '| sigPreKeyId:', payload.signedPreKey?.keyId,
    '| sigLen:', payload.signedPreKey?.signature?.length ?? 0,
    '| oneTimePreKeys count:', payload.oneTimePreKeys.length
  )

  const response = await fetch(`${API_BASE_URL}/api/chat/keys`, {
    method: 'POST',
    headers: {
      ...authHeaders(token),
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  })

  if (!response.ok) {
    throw new Error(`Failed to upload encryption keys: ${await readErrorMessage(response)}`)
  }
}

export async function fetchUserEncryptionBundle(username: string, token: string) {
  const response = await fetch(`${API_BASE_URL}/api/chat/keys/${encodeURIComponent(username)}`, {
    headers: authHeaders(token),
  })

  if (!response.ok) {
    throw new Error(`Failed to fetch encryption bundle for ${username}: ${await readErrorMessage(response)}`)
  }

  const raw = await response.json()

  // ── Normalise backend shape → frontend shape ─────────────────────────────
  // Backend returns { oneTimePreKey: { keyId, publicKey } }  (singular object)
  // Frontend expects { oneTimePreKeys: [{ keyId, publicKey }] }  (array)
  const normalised: any = {
    registrationId: raw.registrationId,
    identityPublicKey: raw.identityPublicKey,
    signedPreKey: raw.signedPreKey,   // { keyId, publicKey, signature } – matches
    // Wrap the singular pre-key into an array; drop nulls
    oneTimePreKeys: raw.oneTimePreKey
      ? [{ keyId: raw.oneTimePreKey.keyId, publicKey: raw.oneTimePreKey.publicKey }]
      : (raw.oneTimePreKeys ?? []),
  }

  console.debug('[E2EE] fetchUserEncryptionBundle →', username,
    '| regId:', normalised.registrationId,
    '| sigPreKeyId:', normalised.signedPreKey?.keyId,
    '| oneTimePreKeys:', normalised.oneTimePreKeys.length)

  return normalised
}

export async function updateProfile(data: { displayName: string; about?: string }, token: string) {
  const response = await fetch(`${API_BASE_URL}/api/chat/profile`, {
    method: 'PUT',
    headers: {
      ...authHeaders(token),
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(data),
  })

  if (!response.ok) {
    throw new Error(`Failed to update profile: ${await readErrorMessage(response)}`)
  }

  return await response.json()
}

// ─── Message Vault API ──────────────────────────────────────────────────────
// Zero-knowledge storage: server only ever sees ciphertext, never plaintext.

