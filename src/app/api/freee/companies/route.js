export const runtime = 'nodejs'; // Prismaやrequest等はEdge不可

import { NextResponse } from 'next/server';
import { readTokens, writeTokens } from '../../../../server/freee/tokenFileStore';
import { refreshTokens } from '../../../../server/freee/requestAuth';

const API_BASE = process.env.FREEE_API_BASE;

export async function GET() {
  const { refresh_token } = await readTokens();
  if (!refresh_token) {
    return NextResponse.json({ error: 'no_refresh_token_seeded' }, { status: 400 });
  }

  // 1) 毎回リフレッシュ（A方式）
  const refreshed = await refreshTokens({
    refresh_token,
    client_id: process.env.FREEE_CLIENT_ID,
    client_secret: process.env.FREEE_CLIENT_SECRET,
  });

  // 2) 受け取った refresh_token に差し替え保存（使い切り対策）
  await writeTokens({
    access_token: refreshed.access_token,
    refresh_token: refreshed.refresh_token,
  });

  // 3) 実API呼び出し例（事業所一覧）
  const res = await fetch(`${API_BASE}/api/1/companies`, {
    method: 'GET',
    headers: {
      Authorization: `Bearer ${refreshed.access_token}`,
      'Content-Type': 'application/json',
    },
    cache: 'no-store',
  });

  if (!res.ok) {
    const text = await res.text();
    if (res.status === 401) {
      return NextResponse.json({ error: 'reauthorize_required', detail: text }, { status: 401 });
    }
    return NextResponse.json({ error: text }, { status: res.status });
  }

  const json = await res.json();
  return NextResponse.json(json);
}
