import { NextResponse } from 'next/server';
export const dynamic = 'force-dynamic';
export const runtime  = 'nodejs';

// プロジェクト構成に合わせて相対パスを調整してください。
// 以下は `src/app/api/getWorkRecordSummaries/route.js` から
// `src/server/freee/refreshGate.js` を参照する想定です。
import { getAccessToken } from "../../(server)/getAccessToken.js";

export async function GET(req) {
  const { searchParams } = new URL(req.url);
  const employeeId = searchParams.get('employeeId');
  // freeeは /YYYY/MM の形式。先頭ゼロがあってもOKですが、数値化しておくと安全です。
  const year  = String(Number(searchParams.get('year')));
  const month = String(Number(searchParams.get('month')));

  if (!employeeId || !year || !month) {
    return NextResponse.json(
      { message: 'employeeId, year, month は必須です' },
      { status: 400 }
    );
  }

  const at = await getAccessToken();
  const url =
    `https://api.freee.co.jp/hr/api/v1/employees/${encodeURIComponent(employeeId)}` +
    `/work_record_summaries/${year}/${month}?company_id=${process.env.COMPANY_ID}&work_records=true`;

  const res = await fetch(url, {
    headers: {
      Authorization: `Bearer ${at}`,
      Accept: 'application/json',
    },
    cache: 'no-store',
  });

  // そのまま透過返却（失敗時も本文を見たいので text で受ける）
  const text = await res.text().catch(() => '');
  return new NextResponse(text, {
    status: res.status,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'no-store',
    },
  });
}
