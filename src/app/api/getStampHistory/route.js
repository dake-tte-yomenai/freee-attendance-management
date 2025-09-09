// /app/api/getWorkRecordSummaries/route.js
import { NextResponse } from "next/server";
export const dynamic = "force-dynamic"; // 静的化させない
export const runtime = 'nodejs';
import { refreshOncePerBurst } from '../../../server/freee/refreshGate.js';

export async function GET(req) {
  const { searchParams } = new URL(req.url);
  const employeeId = searchParams.get("employeeId");
  const year = searchParams.get("year");
  const month= searchParams.get("month");

  const at = await refreshOncePerBurst();

  if (!employeeId || !year || !month) {
    return NextResponse.json({ message: "employeeId と year,month は必須です" }, { status: 400 });
  }
  const url = `https://api.freee.co.jp/hr/api/v1/employees/${encodeURIComponent(employeeId)}/work_record_summaries/${year}/${month}?company_id=${process.env.COMPANY_ID}&work_records=true`;

  const res = await fetch(url, {
    headers: {
      Authorization: `Bearer ${at}`,
      Accept: "application/json",
    },
    cache: "no-store",
  });
  const data = await res.json().catch(() => ({}));
  return NextResponse.json(data, { status: res.status, headers: { "Cache-Control": "no-store" } });
}
