// app/(server)/getAccessToken.js
import 'server-only';
import { fetchAccessToken } from "./freeeToken";

let inFlight = null;
let cache = null; // { token, expMs }

export async function getAccessToken() {
  const now = Date.now();

  // 30秒以上余裕があるならキャッシュを返す
  if (cache && now < cache.expMs - 30_000) return cache.token;

  // 進行中の取得があればそれを待つ
  if (inFlight) return inFlight;

  inFlight = (async () => {
    const { access_token, expires_at } = await fetchAccessToken();
    cache = {
      token: access_token,
      expMs: Date.parse(expires_at) || (now + 5 * 60 * 1000),
    };
    return access_token;
  })();

  try {
    return await inFlight;
  } finally {
    // 小さなバースト吸収
    setTimeout(() => { inFlight = null; }, 50);
  }
}
