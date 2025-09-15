// app/api/scheduler/clockout-reminder/route.js
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { linePush } from '../../../../lib/line.js'; // ←既存のままでOK

// --- JSTユーティリティ（既存のを流用） ---
const n9 = 9 * 60 * 60 * 1000;
const toJST = (d) => new Date(d.getTime() + n9);
const ymd = (d) => {
  const y = d.getUTCFullYear(), m = String(d.getUTCMonth()+1).padStart(2,'0'), dd = String(d.getUTCDate()).padStart(2,'0');
  return `${y}-${m}-${dd}`;
};
const hhmmParse = (s) => { if (!s) return null; const [H,M] = String(s).split(':'); return {h:+H||0, m:+M||0}; };
const jstTimeOn = (dateJst, hh, mm) => new Date(Date.UTC(dateJst.getUTCFullYear(), dateJst.getUTCMonth(), dateJst.getUTCDate(), -9, 0) + (hh*60+mm)*60*1000);

// --- 簡易認証 ---
const okKey = (req) => {
  const u = new URL(req.url);
  const k = req.headers.get('x-cron-secret') || u.searchParams.get('key');
  return k && k === process.env.CRON_SECRET;
};

// ★ 既存の「単体処理」本体をここに引っ越し
async function remindOne(origin, employeeId, to, after, len) {
  const now = toJST(new Date());
  const ymdStr = ymd(now);
  const [Y,M] = ymdStr.split('-');

  // 1) 今日のシフト
  const qs1 = new URLSearchParams({ id: employeeId, year: Y, month: M }).toString();
  const resShift = await fetch(`${origin}/api/getWorkMonth?${qs1}`, { cache: 'no-store' });
  const bodyShift = await resShift.text();
  if (!resShift.ok) return { employeeId, to, step:'getWorkMonth', status: resShift.status, body: bodyShift };

  let shiftList;
  try { shiftList = JSON.parse(bodyShift); } catch { return { employeeId, to, step:'getWorkMonth', parse:'json-failed', sample: bodyShift.slice(0,200) }; }

  const todayShift = Array.isArray(shiftList) ? shiftList.find(r => ymd(toJST(new Date(r.work_date))) === ymdStr) : null;
  const endStr = todayShift?.end_work ? String(todayShift.end_work).slice(0,5) : null;
  const end = hhmmParse(endStr);
  if (!end) return { employeeId, to, ok:true, reason:'no end_work today' };

  const jst0 = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  const winStart = new Date(jstTimeOn(jst0, end.h, end.m)); winStart.setUTCMinutes(winStart.getUTCMinutes() + after);
  const winEnd   = new Date(winStart);                      winEnd.setUTCMinutes(winEnd.getUTCMinutes() + len);
  if (!(now >= winStart && now < winEnd)) {
    return { employeeId, to, ok:true, reason:'outside reminder window', window:{ start: winStart.toISOString(), end: winEnd.toISOString() }, planned:endStr };
  }

  // 2) 勤怠サマリ
  const qs2 = new URLSearchParams({ employeeId, year: Y, month: M }).toString();
  const resSum  = await fetch(`${origin}/api/getWorkRecordSummaries?${qs2}`, { cache: 'no-store' });
  const bodySum = await resSum.text();
  if (!resSum.ok) return { employeeId, to, step:'getWorkRecordSummaries', status: resSum.status, body: bodySum };

  let summary;
  try { summary = JSON.parse(bodySum); } catch { return { employeeId, to, step:'getWorkRecordSummaries', parse:'json-failed', sample: bodySum.slice(0,200) }; }

  const todayRec = Array.isArray(summary?.work_records) ? summary.work_records.find(r => ymd(toJST(new Date(r.work_date))) === ymdStr) : null;
  const clockedOut = !!(todayRec?.clock_out || todayRec?.clock_out_at || todayRec?.actual_work_end_time);
  if (clockedOut) return { employeeId, to, ok:true, reason:'already clocked out' };

  // 3) LINE push
  const msg = `本日${endStr}に退勤予定です。現在${after}分経過しています。退勤の打刻をお願いします。`;
  await linePush(to, [{ type: 'text', text: msg }]);
  return { employeeId, to, ok:true, sent:true, planned:endStr };
}

export async function GET(req) { return handle(req); }
export async function POST(req){ return handle(req); }

async function handle(req) {
  if (!okKey(req)) return Response.json({ error: 'Forbidden' }, { status: 403 });

  // 内部APIを叩くためのオリジン
  const u = new URL(req.url);
  const after = +(u.searchParams.get('after') ?? 5);
  const len   = +(u.searchParams.get('len') ?? 10);

  const proto = req.headers.get('x-forwarded-proto') ?? 'http';
  const host  = req.headers.get('x-forwarded-host') ?? req.headers.get('host') ?? 'localhost:3000';
  const origin = process.env.INTERNAL_BASE_URL || `${proto}://${host}`;

  // 単体モード（既存の動作）
  const employeeId = u.searchParams.get('employeeId');
  const to = u.searchParams.get('to');
  if (employeeId && to) {
    const r = await remindOne(origin, employeeId, to, after, len);
    return Response.json(r);
  }

  // 一括モード
  const backend = process.env.BACKEND_BASE_URL;
  const listRes = await fetch(`${backend}/bindings?active=true`, { cache: 'no-store' });
  if (!listRes.ok) {
    const t = await listRes.text();
    return new Response(`bindings fetch failed: ${t}`, { status: 502 });
  }
  const list = await listRes.json(); // [{employee_id, line_user_id, ...}]

  const results = [];
  for (const b of list) {
    try {
      const r = await remindOne(origin, String(b.employee_id), b.line_user_id, after, len);
      results.push(r);
      // LINE/外部APIへの礼儀に少し間隔
      await new Promise(res => setTimeout(res, 200));
    } catch (e) {
      results.push({ employeeId: b.employee_id, error: String(e).slice(0,200) });
    }
  }
  const sent = results.filter(x => x.sent).length;
  return Response.json({ ok:true, total: results.length, sent, results: results.slice(0, 10) }); // 先頭だけ返す
}
