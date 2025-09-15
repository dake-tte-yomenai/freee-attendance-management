// app/api/getShiftBands/route.js
import { NextResponse } from 'next/server';

export async function GET(req) {
  const { searchParams } = new URL(req.url);
  const year  = searchParams.get('year');
  const month = searchParams.get('month');
  const day   = searchParams.get('day');

  if (!year || !month || !day) {
    return NextResponse.json({ error: 'year/month/day is required' }, { status: 400 });
  }

  const base = process.env.BACKEND_BASE_URL;
  const url  = `${base}/getDetailShifts?year=${year}&month=${month}&day=${day}`;

  const r = await fetch(url, { method: 'GET' });
  const data = await r.json().catch(() => ({}));
  return NextResponse.json(data, { status: r.status });
}
