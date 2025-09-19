// app/api/scheduler/clockout-reminder/route.js
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { linePush } from '../../../../lib/line.js';

// ===== JSTユーティリティ（このファイル内で完結）=====
const NINE_HOURS_MS = 9 * 60 * 60 * 1000;
const toJST = (d) => new Date(d.getTime() + NINE_HOURS_MS);
const ymd = (d) => {
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, '0');
  const dd = String(d.getUTCDate()).padStart(2, '0');
  return `${y}-${m}-${dd}`; // JST日付のYYYY-MM-DD（toJSTしたDateを渡す）
};
// "HH:MM" → {h, m}
const hhmmParse = (s) => {
  if (!s) return null;
  const [H, M] = String(s).trim().replace('：', ':').split(':');
  const h = Number(H), m = Number(M);
  if (!Number.isFinite(h) || !Number.isFinite(m)) return null;
  if (h < 0 || h > 23 || m < 0 || m > 59) return null;
  return { h, m };
};

// ===== 鍵・バイパス =====
const BYPASS = process.env.VERCEL_AUTOMATION_BYPASS_SECRET ?? process.env.VERCEL_BYPASS_TOKEN;
const okKey = (req) => {
  const u = new URL(req.url);
  const k = req.headers.get('x-cron-secret') || u.searchParams.get('key');
  return k && k === process.env.CRON_SECRET;
};

// ===== 単体処理本体（UTC比較へ修正）=====
async function remindOne(origin, employeeId, to, afterMin, lenMin) {
  // 1) 現在時刻はUTCを比較用に保持。JSTは“今日”の判定専用。
  const nowUtc = new Date();       // 比較は常にUTC
  const nowJst = toJST(nowUtc);    // JSTの“今日”を得るため
  const ymdJst = ymd(nowJst);      // "YYYY-MM-DD"
  const [Y, M] = ymdJst.split('-');

  // 2) 今日のシフト（end_workをHH:mmで取得）
  const qs1 = new URLSearchParams({ id: employeeId, year: Y, month: M }).toString();
  const resShift = await fetch(`${origin}/api/getWorkMonth?${qs1}`, {
    cache: 'no-store',
    headers: BYPASS ? { 'x-vercel-protection-bypass': BYPASS } : undefined,
  });
  const bodyShift = await resShift.text();
  if (!resShift.ok) return { employeeId, to, step: 'getWorkMonth', status: resShift.status, body: bodyShift };

  let shiftList;
  try { shiftList = JSON.parse(bodyShift); }
  catch { return { employeeId, to, step: 'getWorkMonth', parse: 'json-failed', sample: bodyShift.slice(0, 200) }; }

  const todayShift = Array.isArray(shiftList)
    ? shiftList.find(r => ymd(toJST(new Date(r.work_date))) === ymdJst)
    : null;

  const endStr = todayShift?.end_work ? String(todayShift.end_work).slice(0, 5) : null; // "HH:MM"
  const end = hhmmParse(endStr);
  if (!end) return { employeeId, to, ok: true, reason: 'no end_work today' };

  // 3) JST「今日の end(HH:MM)」→ UTCの予定退勤Dateを一発生成（JST=UTC+9）
  const [YY, MM, DD] = ymdJst.split('-').map(Number);
  const plannedEndUtc = new Date(Date.UTC(YY, MM - 1, DD, end.h - 9, end.m)); // 例: JST14:00 → 05:00Z

  // 4) ウィンドウ（UTC）を作成してUTCで比較（※ここが以前のズレ原因）
  const winStart = new Date(plannedEndUtc.getTime() + afterMin * 60_000);
  const winEnd   = new Date(winStart.getTime() + lenMin   * 60_000);

  if (!(nowUtc >= winStart && nowUtc < winEnd)) {
    return {
      employeeId, to, ok: true, reason: 'outside reminder window',
      window: { start: winStart.toISOString(), end: winEnd.toISOString() },
      planned: endStr
    };
  }

  // 5) 勤怠サマリ（本日 already clock out かを確認）
  const qs2 = new URLSearchParams({ employeeId, year: Y, month: M }).toString();
  const resSum = await fetch(`${origin}/api/getWorkRecordSummaries?${qs2}`, {
    cache: 'no-store',
    headers: BYPASS ? { 'x-vercel-protection-bypass': BYPASS } : undefined,
  });
  const bodySum = await resSum.text();
  if (!resSum.ok) return { employeeId, to, step: 'getWorkRecordSummaries', status: resSum.status, body: bodySum };

  let summary;
  try { summary = JSON.parse(bodySum); }
  catch { return { employeeId, to, step: 'getWorkRecordSummaries', parse: 'json-failed', sample: bodySum.slice(0, 200) }; }

  const todayRec = Array.isArray(summary?.work_records)
    ? summary.work_records.find(r => ymd(toJST(new Date(r.work_date))) === ymdJst)
    : null;

  const clockedOut = !!(todayRec?.clock_out || todayRec?.clock_out_at || todayRec?.actual_work_end_time);
  if (clockedOut) return { employeeId, to, ok: true, reason: 'already clocked out' };

  // 6) LINE push（送信文言はお好みで）
  const delayed = Math.max(0, Math.floor((nowUtc.getTime() - plannedEndUtc.getTime()) / 60_000)); // 経過分（丸め）
  const msg = `本日${endStr}に退勤予定です。現在${delayed}分経過しています。退勤の打刻をお願いします。`;
  await linePush(to, [{ type: 'text', text: msg }]);

  return {
    employeeId, to, ok: true, sent: true, planned: endStr,
    window: { start: winStart.toISOString(), end: winEnd.toISOString() }
  };
}

export async function GET(req) { return handle(req); }
export async function POST(req) { return handle(req); }

async function handle(req) {
  if (!okKey(req)) return Response.json({ error: 'Forbidden' }, { status: 403 });

  const u = new URL(req.url);
  // after/len は分単位（例: after=-5, len=10 → 予定-5分〜+5分の10分幅）
  const after = +(u.searchParams.get('after') ?? -5);
  const len   = +(u.searchParams.get('len') ?? 10);

  // 自サイトのオリジン（内部API呼び出し用）
  const proto = req.headers.get('x-forwarded-proto') ?? 'http';
  const host  = req.headers.get('x-forwarded-host') ?? req.headers.get('host') ?? 'localhost:3000';
  const origin = process.env.INTERNAL_BASE_URL || `${proto}://${host}`;

  // 単体モード（個別テスト用）
  const employeeId = u.searchParams.get('employeeId');
  const to = u.searchParams.get('to');
  if (employeeId && to) {
    const r = await remindOne(origin, employeeId, to, after, len);
    return Response.json(r);
  }

  // 一括モード（全員分）
  const backend = process.env.BACKEND_BASE_URL;
  const listRes = await fetch(`${backend}/bindings?active=true`, { cache: 'no-store' });
  if (!listRes.ok) {
    const t = await listRes.text();
    return new Response(`bindings fetch failed: ${t}`, { status: 502 });
  }
  const list = await listRes.json(); // 期待: [{employee_id, line_user_id, ...}]

  const results = [];
  for (const b of list) {
    try {
      const r = await remindOne(origin, String(b.employee_id), b.line_user_id, after, len);
      results.push(r);
      // LINE送信のレート制御（必要に応じ調整）
      await new Promise(res => setTimeout(res, 200));
    } catch (e) {
      results.push({ employeeId: b.employee_id, error: String(e).slice(0, 200) });
    }
  }
  const sent = results.filter(x => x.sent).length;
  return Response.json({ ok: true, total: results.length, sent, results: results.slice(0, 10) });
}
