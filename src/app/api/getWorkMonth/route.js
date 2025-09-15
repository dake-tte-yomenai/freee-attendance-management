// app/api/getWorkMonth/route.js
import { NextResponse } from 'next/server';

export async function GET(req) {
  const url = new URL(req.url);
  const id = url.searchParams.get('id');
  const year = url.searchParams.get('year');
  const month = url.searchParams.get('month');

  if (!id || !year || !month) {
    return NextResponse.json({ error: 'id/year/month is required' }, { status: 400 });
  }

  const base =process.env.BACKEND_BASE_URL;
  const r = await fetch(`${base}/getWorkMonth?id=${encodeURIComponent(id)}&year=${encodeURIComponent(year)}&month=${encodeURIComponent(month)}`, {
    method: 'GET',
  });

  const data = await r.json().catch(() => ({}));
  return NextResponse.json(data, { status: r.status });
}
