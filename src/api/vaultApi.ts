import { authHeaders } from './chatApi';
import { API_BASE_URL as BASE_URL } from '../config';

const API_BASE_URL = `${BASE_URL}/api/chat/vault`;

export interface VaultEntry {
  messageId: string;
  ciphertext: string;
}

export interface VaultPageResponse {
  entries: VaultEntry[];
  hasMore: boolean;
  page: number;
  size: number;
}

/** 
 * API Layer for Zero-Knowledge Message Vault.
 * Uses standard Fetch with JWT authentication.
 */
export const vaultApi = {
  // Store single encrypted entry in the vault
  store: async (messageId: string, ciphertext: string, token: string) => {
    const response = await fetch(`${API_BASE_URL}`, {
      method: 'POST',
      headers: { ...authHeaders(token), 'Content-Type': 'application/json' },
      body: JSON.stringify({ messageId, ciphertext }),
    });
    if (!response.ok) throw new Error('[Vault] Store failed');
    return response;
  },

  // Batch store entries (handy for initial message sync)
  batchStore: async (entries: VaultEntry[], token: string) => {
    const response = await fetch(`${API_BASE_URL}/batch`, {
      method: 'POST',
      headers: { ...authHeaders(token), 'Content-Type': 'application/json' },
      body: JSON.stringify({ entries }),
    });
    if (!response.ok) throw new Error('[Vault] Batch store failed');
    return await response.json();
  },

  // Fetch all paginated vault entries
  fetchAll: async (token: string, page = 0, size = 100): Promise<VaultPageResponse> => {
    const params = new URLSearchParams({ page: String(page), size: String(size) });
    const response = await fetch(`${API_BASE_URL}/fetch?${params}`, {
      headers: authHeaders(token),
    });
    if (!response.ok) throw new Error('[Vault] Fetch all failed');
    return await response.json();
  },

  // Fetch a single vault entry by message ID
  fetchOne: async (messageId: string, token: string): Promise<VaultEntry | null> => {
    const response = await fetch(`${API_BASE_URL}/${encodeURIComponent(messageId)}`, {
      headers: authHeaders(token),
    });
    if (response.status === 404) return null;
    if (!response.ok) throw new Error('[Vault] Single fetch failed');
    return await response.json();
  },

  // Delete a vault entry
  delete: async (messageId: string, token: string) => {
    const response = await fetch(`${API_BASE_URL}/${encodeURIComponent(messageId)}`, {
      method: 'DELETE',
      headers: authHeaders(token),
    });
    if (!response.ok) throw new Error('[Vault] Delete failed');
    return response;
  }
};
