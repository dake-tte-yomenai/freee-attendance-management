// app/api/postShift/route.js
import { NextResponse } from 'next/server';

// "HH:MM" / "HH:MM:SS" を "HH:MM:SS" に寄せる
const toHHMMSS = (s) => {
  if (!s) return null;
  return /^\d{2}:\d{2}:\d{2}$/.test(s) ? s : `${s}:00`;
};

export async function POST(req) {
  const { id, year, month, day, workStart, workEnd, breakRows } = await req.json();

  const y = Number(year);
  const m = Number(month);
  const d = Number(day);
  const workDate = `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;

  const payload = {
    employee_id: id,
    work_date: workDate,
    year: y,    // FastAPI側でテーブル名生成に利用
    month: m,
    day: d,     // 使わないなら送らなくてもOK
    start_work: toHHMMSS(workStart),
    end_work: toHHMMSS(workEnd),
    breaks: (breakRows ?? []).map((br) => ({
      start_break: toHHMMSS(br.start),
      end_break: toHHMMSS(br.end),
    })),
  };
   const base = process.env.BACKEND_BASE_URL;

  const r = await fetch(`${base}/postShifts`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });

  const data = await r.json().catch(() => ({}));
  return NextResponse.json(data, { status: r.status });
}
