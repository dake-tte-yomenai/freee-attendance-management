// app/api/scheduler/clockout-reminder/route.js
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { linePush } from '../../../../lib/line.js';

// ===== JSTユーティリティ =====
const NINE_HOURS_MS = 9 * 60 * 60 * 1000;
const toJST = (d) => new Date(d.getTime() + NINE_HOURS_MS);
const ymd = (d) => {
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, '0');
  const dd = String(d.getUTCDate()).padStart(2, '0');
  return `${y}-${m}-${dd}`; // JST日付のYYYY-MM-DD（toJSTされたDateを渡す）
};
const hhmmParse = (s) => {
  if (!s) return null;
  const [H, M] = String(s).trim().replace('：', ':').split(':');
  const h = Number(H), m = Number(M);
  if (!Number.isFinite(h) || !Number.isFinite(m)) return null;
  if (h < 0 || h > 23 || m < 0 || m > 59) return null;
  return { h, m };
};

// ===== 環境・バイパス =====
const BYPASS = process.env.VERCEL_AUTOMATION_BYPASS_SECRET ?? process.env.VERCEL_BYPASS_TOKEN;
const okKey = (req) => {
  const u = new URL(req.url);
  const k = req.headers.get('x-cron-secret') || u.searchParams.get('key');
  return k && k === process.env.CRON_SECRET;
};
// 軽い正規化（https, https://... などのtypo救済）
function normalizeBase(input) {
  let s = String(input || '').trim();
  s = s.replace(/^https,\s*/i, 'https://').replace(/^http,\s*/i, 'http://');
  s = s.replace(/\/+$/,'');
  return s;
}
function safeOriginOrThrow(base) {
  const s = normalizeBase(base);
  const u = new URL(s);
  return u.origin;
}

// ===== 本体 =====
async function remindOne(origin, employeeId, to, afterMin, lenMin, { force = false, debug = false } = {}) {
  // 1) JSTの“今日”判定（UTC比較用の now は後で再取得）
  const nowJst = toJST(new Date());
  const ymdJst = ymd(nowJst); // "YYYY-MM-DD"
  const [Y, M] = ymdJst.split('-');

  // 2) 今日のシフト取得
  const qs1 = new URLSearchParams({ id: employeeId, year: Y, month: M }).toString();
  const resShift = await fetch(`${origin}/api/getWorkMonth?${qs1}`, {
    cache: 'no-store',
    headers: BYPASS ? { 'x-vercel-protection-bypass': BYPASS } : undefined,
  });
  const bodyShift = await resShift.text();
  if (!resShift.ok) {
    return { employeeId, to, step: 'getWorkMonth', status: resShift.status, body: bodyShift };
  }

  let shiftList;
  try { shiftList = JSON.parse(bodyShift); }
  catch {
    return { employeeId, to, step: 'getWorkMonth', parse: 'json-failed', sample: bodyShift.slice(0, 200) };
  }

  // Dateパース由来のTZズレを避けるため、文字列で一致判定
  const todayShift = Array.isArray(shiftList)
    ? shiftList.find(r => String(r.work_date).slice(0, 10) === ymdJst)
    : null;

  const endStrRaw = todayShift?.end_work ? String(todayShift.end_work) : null;  // "HH:MM:SS" など
  const endStr = endStrRaw ? endStrRaw.trim().replace('：', ':').slice(0, 5) : null; // "HH:MM"
  const end = hhmmParse(endStr);
  if (!end) {
    return {
      employeeId, to, ok: true, reason: 'no end_work today',
      ...(debug ? { debug: { ymdJst, foundTodayShift: !!todayShift, todayShiftSample: todayShift, endStrRaw } } : {})
    };
  }

  // 3) JST「今日の end(HH:MM)」→ UTCの予定退勤（JST=UTC+9）
  const [YY, MM, DD] = ymdJst.split('-').map(Number);
  const plannedEndUtc = new Date(Date.UTC(YY, MM - 1, DD, end.h - 9, end.m)); // 例: JST14:00 → 05:00Z

  // 4) ウィンドウ（UTC）作成：上限包括＋猶予
  const winStart = new Date(plannedEndUtc.getTime() + afterMin * 60_000);
  const GRACE_SEC = 30;
  const winEnd   = new Date(winStart.getTime() + lenMin * 60_000 + GRACE_SEC * 1000);

  // ★ 比較は直前に取得（遅延でズレないように）
  const nowUtc = new Date();
  if (!force && !(nowUtc >= winStart && nowUtc <= winEnd)) {
    return {
      employeeId, to, ok: true, reason: 'outside reminder window',
      window: { start: winStart.toISOString(), end: winEnd.toISOString() },
      planned: endStr,
      plannedEndUtc: plannedEndUtc.toISOString(),
      nowUtc: nowUtc.toISOString(),
      ...(debug ? { debug: { ymdJst, todayShiftSample: todayShift } } : {})
    };
  }

  // 5) 勤怠サマリ（退勤済みなら送らない）— パラメータ両載せ＋二重確認
  const qs2 = new URLSearchParams({ employeeId, id: employeeId, year: Y, month: M }).toString();

  const resSum = await fetch(`${origin}/api/getWorkRecordSummaries?${qs2}`, {
    cache: 'no-store',
    headers: BYPASS ? { 'x-vercel-protection-bypass': BYPASS } : undefined,
  });
  const bodySum = await resSum.text();
  if (!resSum.ok) return { employeeId, to, step: 'getWorkRecordSummaries', status: resSum.status, body: bodySum };

  let summary;
  try { summary = JSON.parse(bodySum); } catch {
    return { employeeId, to, step: 'getWorkRecordSummaries', parse: 'json-failed', sample: bodySum.slice(0, 200) };
  }

  const todayRec = Array.isArray(summary?.work_records)
    ? summary.work_records.find(r => String(r.work_date).slice(0, 10) === ymdJst)
    : null;

  const clockedOut = !!(todayRec?.clock_out || todayRec?.clock_out_at || todayRec?.actual_work_end_time || todayRec?.checkout_time || todayRec?.end_time);
  if (!force && clockedOut) {
    return { employeeId, to, ok: true, reason: 'already clocked out' };
  }

  // 送信直前の最終確認（反映遅延対策）
  if (!force) {
    const resSum2 = await fetch(`${origin}/api/getWorkRecordSummaries?${qs2}`, {
      cache: 'no-store',
      headers: BYPASS ? { 'x-vercel-protection-bypass': BYPASS } : undefined,
    }).catch(() => null);
    if (resSum2?.ok) {
      const summary2 = await resSum2.json().catch(() => null);
      const today2 = Array.isArray(summary2?.work_records)
        ? summary2.work_records.find(r => String(r.work_date).slice(0, 10) === ymdJst)
        : null;
      const clockedOut2 = !!(today2?.clock_out || today2?.clock_out_at || today2?.actual_work_end_time || today2?.checkout_time || today2?.end_time);
      if (clockedOut2) {
        return { employeeId, to, ok: true, reason: 'already clocked out (final check)' };
      }
    }
  }

  // 6) LINE push
  const delayedMin = Math.max(0, Math.floor((new Date().getTime() - plannedEndUtc.getTime()) / 60_000));
  const msg = `本日${endStr}に退勤予定です。現在${delayedMin}分経過しています。退勤の打刻をお願いします。`;
  await linePush(to, [{ type: 'text', text: msg }]);

  return {
    employeeId, to, ok: true, sent: true, planned: endStr,
    window: { start: winStart.toISOString(), end: winEnd.toISOString() },
    plannedEndUtc: plannedEndUtc.toISOString(),
    nowUtc: new Date().toISOString()
  };
}

export async function GET(req) { return handle(req); }
export async function POST(req) { return handle(req); }

async function handle(req) {
  if (!okKey(req)) return Response.json({ error: 'Forbidden' }, { status: 403 });

  const u = new URL(req.url);
  const after = +(u.searchParams.get('after') ?? -10); // デフォ少し広め
  const len   = +(u.searchParams.get('len') ?? 20);
  const force = u.searchParams.get('force') === '1';
  const debug = u.searchParams.get('debug') === '1';

  // 自サイトのオリジン（内部API呼び出し用）
  const proto = req.headers.get('x-forwarded-proto') ?? 'http';
  const host  = req.headers.get('x-forwarded-host') ?? req.headers.get('host') ?? 'localhost:3000';
  let origin;
  try {
    origin = safeOriginOrThrow(process.env.INTERNAL_BASE_URL ?? `${proto}://${host}`);
  } catch (e) {
    return new Response(`Bad INTERNAL_BASE_URL: "${process.env.INTERNAL_BASE_URL}". ${e}`, { status: 500 });
  }

  // 単体モード
  const employeeId = u.searchParams.get('employeeId');
  const to = u.searchParams.get('to');
  if (employeeId && to) {
    const r = await remindOne(origin, employeeId, to, after, len, { force, debug });
    if (debug) r._debug = { origin };
    return Response.json(r);
  }

  // 一括モード
  let backendBase;
  try {
    backendBase = safeOriginOrThrow(process.env.BACKEND_BASE_URL);
  } catch (e) {
    return new Response(`Bad BACKEND_BASE_URL: ${String(e)}`, { status: 500 });
  }

  const listRes = await fetch(`${backendBase}/bindings?active=true`, { cache: 'no-store' });
  if (!listRes.ok) {
    const t = await listRes.text();
    return new Response(`bindings fetch failed: ${t}`, { status: 502 });
  }
  const list = await listRes.json(); // 期待: [{employee_id, line_user_id, ...}]

  const results = [];
  for (const b of list) {
    try {
      const r = await remindOne(origin, String(b.employee_id), b.line_user_id, after, len, { force, debug });
      if (debug) r._debug = { origin };
      results.push(r);
      await new Promise(res => setTimeout(res, 200)); // レート制御
    } catch (e) {
      results.push({ employeeId: b.employee_id, error: String(e).slice(0, 200) });
    }
  }
  const sent = results.filter(x => x.sent).length;
  return Response.json({ ok: true, total: results.length, sent, results: results.slice(0, 10) });
}
