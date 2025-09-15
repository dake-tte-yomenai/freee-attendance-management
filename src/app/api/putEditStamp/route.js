export const runtime = 'nodejs';
import { NextResponse } from "next/server";
import { getAccessToken } from "../../(server)/getAccessToken.js";

export async function PUT(req) {
  const { searchParams } = new URL(req.url);
  const employee_id = searchParams.get("id");
  const date = searchParams.get("date");

  const { newClockIn, newBreakBegin, newBreakEnd, newClockOut } = await req.json();

  const payload = { company_id: process.env.COMPANY_ID};

  const hasMain = !!(newClockIn && newClockOut);
  const hasBreak = !!(newBreakBegin && newBreakEnd);

  if (hasMain) {
    payload.work_record_segments = [
      { clock_in_at: newClockIn, clock_out_at: newClockOut }
    ];
  }

  // 休憩（break_records）
  if (hasBreak) {
    payload.break_records = [
      { clock_in_at: newBreakBegin, clock_out_at: newBreakEnd }
    ];
  }

  const url = `https://api.freee.co.jp/hr/api/v1/employees/${employee_id}/work_records/${date}`;

  const at = await getAccessToken();

  try {
    const res = await fetch(url, {
      method: "PUT",
      headers: {
        Authorization: `Bearer ${at}`,
        Accept: "application/json",
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });

    const data = await res.json().catch(() => ({}));
    if (!res.ok) return NextResponse.json(data, { status: res.status });
    return NextResponse.json(data);
  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}