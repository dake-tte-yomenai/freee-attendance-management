// src/lib/freeeToken.js
import { writeFile, readFile } from "node:fs/promises";
import path from "node:path";

const TOKEN_FILE = path.join("/tmp", "freee_token.json"); // 本番はDB/Secretsへ
let memoryCache = null; // { access_token, refresh_token, expires_at }

const now = () => Date.now();
const willExpireSoon = (expiresAt, skewMs = 60_000) => now() > (expiresAt - skewMs);

async function readCache() {
  if (memoryCache) return memoryCache;
  try {
    const raw = await readFile(TOKEN_FILE, "utf-8");
    memoryCache = JSON.parse(raw);
    return memoryCache;
  } catch {
    return null;
  }
}

async function writeCache(token) {
  memoryCache = token;
  await writeFile(TOKEN_FILE, JSON.stringify(token), "utf-8");
}

async function refreshAccessToken(currentRefreshToken) {
  const form = new URLSearchParams({
    grant_type: "refresh_token",
    client_id: process.env.FREEE_CLIENT_ID,
    client_secret: process.env.FREEE_CLIENT_SECRET,
    refresh_token: currentRefreshToken,
  });

  const res = await fetch("https://accounts.secure.freee.co.jp/public_api/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: form,
    // Next.jsのfetchはデフォルトでKeep-Alive
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`freee refresh failed: ${res.status} ${text}`);
  }

  const json = await res.json(); // { access_token, refresh_token, expires_in }
  const token = {
    access_token: json.access_token,
    refresh_token: json.refresh_token, // ←ここが毎回更新される
    expires_at: now() + (json.expires_in * 1000), // 6時間=21600秒
  };
  await writeCache(token);
  return token;
}

export async function getAccessToken() {
  let cache = await readCache();

  if (cache && !willExpireSoon(cache.expires_at)) {
    return cache.access_token;
  }

  const refreshToken = (cache && cache.refresh_token) || process.env.FREEE_REFRESH_TOKEN;
  if (!refreshToken) throw new Error("No refresh token available");

  cache = await refreshAccessToken(refreshToken);
  return cache.access_token;
}

export async function forceRefreshAndGetAccess() {
  const cache = await readCache();
  const refreshToken = (cache && cache.refresh_token) || process.env.FREEE_REFRESH_TOKEN;
  if (!refreshToken) throw new Error("No refresh token available for force refresh");
  const fresh = await refreshAccessToken(refreshToken);
  return fresh.access_token;
}
