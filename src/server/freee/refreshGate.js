import 'server-only';
import { readTokens, writeTokens } from './tokenFileStore.js';
import { refreshTokens } from './requestAuth.js';

let inFlight = null; // 進行中のrefreshを共有

export async function refreshOncePerBurst() {
  if (inFlight) return inFlight; // 既に進行中ならそれを待つ

  inFlight = (async () => {
    try {
      const { refresh_token } = await readTokens();
      if (!refresh_token) throw new Error('no_refresh_token_seeded');

      const refreshed = await refreshTokens({
        refresh_token,
        client_id: process.env.FREEE_CLIENT_ID,
        client_secret: process.env.FREEE_CLIENT_SECRET,
      });

      // 受け取り次第、必ず差し替え保存
      await writeTokens({
        access_token: refreshed.access_token,
        refresh_token: refreshed.refresh_token,
      });

      return refreshed.access_token;
    } finally {
      // 少しだけ遅延を入れてバースト吸収（任意）
      await new Promise(r => setTimeout(r, 50));
      inFlight = null;
    }
  })();

  return inFlight;
}
