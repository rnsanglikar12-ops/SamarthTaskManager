import { Env, ServiceAccountKey } from './types';

const TOKEN_URL = 'https://oauth2.googleapis.com/token';
const SCOPES = 'https://www.googleapis.com/auth/spreadsheets https://www.googleapis.com/auth/drive.file';

// Cached across requests for the lifetime of this Worker isolate. Isolates
// recycle unpredictably (idle eviction, redeploys, scale-out) so this is a
// best-effort speedup, not a durability guarantee — every path below checks
// expiry / falls back to re-minting rather than assuming the cache is warm.
let cachedKey: CryptoKey | null = null;
let cachedServiceAccountEmail: string | null = null;
let cachedToken: { token: string; expiresAt: number } | null = null;

function base64url(bytes: ArrayBuffer | Uint8Array): string {
  const arr = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
  let binary = '';
  for (let i = 0; i < arr.length; i++) binary += String.fromCharCode(arr[i]);
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function base64urlFromString(s: string): string {
  return base64url(new TextEncoder().encode(s));
}

function pemToDer(pem: string): ArrayBuffer {
  const body = pem
    .replace(/-----BEGIN PRIVATE KEY-----/, '')
    .replace(/-----END PRIVATE KEY-----/, '')
    .replace(/\s+/g, '');
  const binary = atob(body);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes.buffer;
}

async function getSigningKey(env: Env): Promise<{ key: CryptoKey; email: string }> {
  if (cachedKey && cachedServiceAccountEmail) {
    return { key: cachedKey, email: cachedServiceAccountEmail };
  }
  const parsed: ServiceAccountKey = JSON.parse(env.GOOGLE_SERVICE_ACCOUNT_JSON);
  const privateKeyPem = parsed.private_key.replace(/\\n/g, '\n');
  const der = pemToDer(privateKeyPem);
  const key = await crypto.subtle.importKey(
    'pkcs8',
    der,
    { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
    false,
    ['sign']
  );
  cachedKey = key;
  cachedServiceAccountEmail = parsed.client_email;
  return { key, email: parsed.client_email };
}

async function mintAccessToken(env: Env): Promise<{ token: string; expiresAt: number }> {
  const { key, email } = await getSigningKey(env);

  const now = Math.floor(Date.now() / 1000);
  const header = { alg: 'RS256', typ: 'JWT' };
  const claims = {
    iss: email,
    scope: SCOPES,
    aud: TOKEN_URL,
    iat: now,
    exp: now + 3600
  };

  const signingInput = `${base64urlFromString(JSON.stringify(header))}.${base64urlFromString(JSON.stringify(claims))}`;
  const signature = await crypto.subtle.sign(
    { name: 'RSASSA-PKCS1-v1_5' },
    key,
    new TextEncoder().encode(signingInput)
  );
  const assertion = `${signingInput}.${base64url(signature)}`;

  const res = await fetch(TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
      assertion
    })
  });

  if (!res.ok) {
    throw new Error(`Google token exchange failed: HTTP ${res.status} ${await res.text()}`);
  }

  const data = (await res.json()) as { access_token: string; expires_in: number };
  return {
    token: data.access_token,
    // Refresh 5 minutes early so an in-flight request never races an expiry.
    expiresAt: now + data.expires_in - 300
  };
}

export async function getAccessToken(env: Env): Promise<string> {
  const nowSeconds = Math.floor(Date.now() / 1000);
  if (cachedToken && cachedToken.expiresAt > nowSeconds) {
    return cachedToken.token;
  }
  cachedToken = await mintAccessToken(env);
  return cachedToken.token;
}
