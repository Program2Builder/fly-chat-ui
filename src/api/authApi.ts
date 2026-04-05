import type { AuthSession, AuthUser, LoginResponse } from '../types/chat'

import { API_BASE_URL } from '../config'

async function readErrorMessage(response: Response) {
  const text = await response.text()
  return text || `${response.status} ${response.statusText}`
}

export async function loginUser(username: string, password: string) {
  const response = await fetch(`${API_BASE_URL}/api/auth/login`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
    body: JSON.stringify({ username, password }),
  })

  if (!response.ok) {
    throw new Error(`Login failed: ${await readErrorMessage(response)}`)
  }

  return (await response.json()) as LoginResponse
}

export async function fetchAuthenticatedUser(token: string) {
  const response = await fetch(`${API_BASE_URL}/api/auth/me`, {
    headers: {
      Accept: 'application/json',
      Authorization: `Bearer ${token}`,
    },
  })

  if (!response.ok) {
    throw new Error(`Failed to load current user: ${await readErrorMessage(response)}`)
  }

  return (await response.json()) as AuthUser
}

export function buildSessionToken(session: AuthSession) {
  return `${session.tokenType || 'Bearer'} ${session.token}`.trim()
}
