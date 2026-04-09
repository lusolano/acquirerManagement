import { Auth } from './auth.js';

const BASE = 'https://www.googleapis.com/drive/v3';

async function authHeaders() {
  const token = await Auth.getAccessToken();
  return { Authorization: `Bearer ${token}` };
}

async function apiFetch(url, options = {}) {
  const headers = { ...(await authHeaders()), ...(options.headers || {}) };
  const resp = await fetch(url, { ...options, headers });
  if (!resp.ok) {
    const body = await resp.text().catch(() => '');
    throw new Error(`Drive API ${resp.status}: ${body}`);
  }
  return resp.json();
}

export const Drive = {
  /** List the user's Google Sheets files, most recently modified first. */
  async listSpreadsheets() {
    const params = new URLSearchParams({
      q: "mimeType='application/vnd.google-apps.spreadsheet' and trashed=false",
      orderBy: 'modifiedTime desc',
      fields: 'files(id,name,modifiedTime)',
      pageSize: '100',
    });
    const data = await apiFetch(`${BASE}/files?${params}`);
    return data.files || [];   // [{id, name, modifiedTime}]
  },
};
