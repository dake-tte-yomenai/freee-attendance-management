// app/api/freee/exchange/route.js
import 'server-only';
// ルートから (server) へは 3 つ上に戻る: /app/api/freee/exchange → /app
import { seedTokens } from '../../../(server)/freeeTokenApi';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const TOKEN_URL = process.env.FREEE_TOKEN_ENDPOINT; // 例: https://accounts.secure.freee.co.jp/public_api/token
const CLIENT_ID = process.env.FREEE_CLIENT_ID;
const CLIENT_SECRET = process.env.FREEE_CLIENT_SECRET;

export async function POST(req) {
  try {
    const { code, redirect_uri } = await req.json();

    const res = await fetch(TOKEN_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type: 'authorization_code',
        code,
        redirect_uri,
        client_id: CLIENT_ID,
        client_secret: CLIENT_SECRET,
      }),
      cache: 'no-store',
    });

    const text = await res.text();
    if (!res.ok) {
      return new Response(
        JSON.stringify({ error: `exchange failed: ${res.status} ${text}` }),
        { status: 502, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const body = JSON.parse(text); // { access_token, refresh_token, expires_in, ... }
    const expiresIn = body.expires_in ?? 21600; // 6h デフォルト
    const expires_at = new Date(Date.now() + expiresIn * 1000).toISOString();

    // 取得直後に FastAPI へ保存（以後の更新は FastAPI が実施）
    await seedTokens({
      access_token: body.access_token,
      refresh_token: body.refresh_token,
      expires_at,
    });

    return new Response(JSON.stringify({ ok: true }), {
      status: 200, headers: { 'Content-Type': 'application/json' },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: String(e) }), {
      status: 500, headers: { 'Content-Type': 'application/json' },
    });
  }
}
