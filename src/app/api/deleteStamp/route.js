export const runtime = 'nodejs';
import { NextResponse } from 'next/server';
import { getAccessToken } from '../../(server)/getAccessToken.js';

export async function DELETE(req) {
  const { searchParams } = new URL(req.url);
  const employee_id = searchParams.get('id');
  const date = searchParams.get('date');

  if (!employee_id || !date) {
    return NextResponse.json(
      { error: "query 'id' and 'date' are required" },
      { status: 400, headers: { 'Cache-Control': 'no-store' } }
    );
  }

  const at = await getAccessToken();

  const url =
    `https://api.freee.co.jp/hr/api/v1/employees/${employee_id}/work_records/${date}` +
    `?company_id=${encodeURIComponent(process.env.COMPANY_ID)}`;

  const res = await fetch(url, {
    method: 'DELETE',
    headers: {
      Authorization: `Bearer ${at}`,
      Accept: 'application/json',
      // Content-Type は DELETE には不要（送信ボディがないため）
    },
  });

  // ★ ここがポイント：204 は空で返す（json を呼ばない・ボディを付けない）
  if (res.status === 204) {
    return new Response(null, {
      status: 204,
      headers: { 'Cache-Control': 'no-store' },
    });
  }

  // それ以外は content-type を見て返す
  const ct = res.headers.get('content-type') || '';
  if (ct.includes('application/json')) {
    const data = await res.json();
    return NextResponse.json(data, {
      status: res.status,
      headers: { 'Cache-Control': 'no-store' },
    });
  } else {
    const text = await res.text();
    return new Response(text, {
      status: res.status,
      headers: {
        'Content-Type': ct || 'text/plain; charset=utf-8',
        'Cache-Control': 'no-store',
      },
    });
  }
}
