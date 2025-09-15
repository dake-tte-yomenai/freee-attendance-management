// app/(server)/freeeTokenApi.js
import 'server-only';

const BASE = process.env.BACKEND_BASE_URL;   // 例: https://freee-shift-api.onrender.com
const SECRET = process.env.INTERNAL_API_KEY; // FastAPI 側と一致

if (!BASE || !SECRET) {
  throw new Error('BACKEND_BASE_URL または INTERNAL_API_KEY が未設定です（サーバー環境変数）。');
}

// FastAPI からアクセストークンを取得（FastAPI 側で自動リフレッシュ）
export async function fetchAccessToken() {
  const r = await fetch(`${BASE}/oauth/freee/access_token`, {
    headers: { 'x-internal-secret': SECRET },
    cache: 'no-store',
  });
  if (!r.ok) throw new Error(`token fetch failed: ${r.status} ${await r.text()}`);
  return r.json(); // { access_token, expires_at }
}

// 初回シード（コード交換後、DB に保存）
export async function seedTokens(payload) {
  const r = await fetch(`${BASE}/oauth/freee/seed`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-internal-secret': SECRET,
    },
    body: JSON.stringify(payload), // { access_token, refresh_token, expires_at }
  });
  if (!r.ok) throw new Error(`seed failed: ${r.status} ${await r.text()}`);
  return r.json();
}
