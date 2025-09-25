// app/api/freee/work-record/route.js
export const runtime = 'nodejs';
import { NextResponse } from "next/server";
import { getAccessToken } from "../../(server)/getAccessToken.js";

// ---------------------- フォーマッタ／バリデータ ----------------------
const HR_DT = /^\d{4}-\d{2}-\d{2}\s+\d{2}:\d{2}:\d{2}$/;     // "YYYY-MM-DD HH:MM:SS"
const BAD_TOKENS = /^(?:0-:00:00|0000-00-00 00:00:00|null|undefined|\s*)$/i;

function toHrDateTime(input, ymd) {
  if (input == null) return null;
  const s = String(input).trim();
  if (BAD_TOKENS.test(s)) return null;
  if (HR_DT.test(s)) return s;

  // ISO → ローカル表記
  if (/^\d{4}-\d{2}-\d{2}T/.test(s)) {
    const d = new Date(s);
    if (!isNaN(d.getTime())) {
      const p = (n) => String(n).padStart(2, '0');
      return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}`;
    }
    return null;
  }

  // "HH:mm(:ss)" → dateと合成
  if (/^\d{1,2}:\d{2}(:\d{2})?$/.test(s)) {
    const [H, M, S] = s.split(':');
    const p = (n) => String(n).padStart(2, '0');
    return `${ymd} ${p(H)}:${p(M)}:${p(S ?? '00')}`;
  }

  // "YYYY-MM-DD" 単体
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return `${s} 00:00:00`;

  return null; // それ以外は無効として扱う
}

// ---------------------- 共通PUTヘルパ ----------------------
async function putFreee(url, at, payload, debug) {
  const res = await fetch(url, {
    method: "PUT",
    headers: {
      Authorization: `Bearer ${at}`,
      Accept: "application/json",
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });

  const text = await res.text();
  let data; try { data = JSON.parse(text); } catch { data = { raw: text }; }

  if (!res.ok) {
    return NextResponse.json({
      error: "freee PUT failed",
      status: res.status,
      data,
      ...(debug ? { debug: { payload } } : {}),
    }, { status: res.status });
  }
  return NextResponse.json({
    ok: true,
    data,
    ...(debug ? { debug: { payload } } : {}),
  });
}

// ---------------------- ルート本体 ----------------------
export async function PUT(req) {
  const { searchParams } = new URL(req.url);
  const employee_id = searchParams.get("id");      // 必須
  const date = searchParams.get("date");           // "YYYY-MM-DD" 想定（必須）
  const debug = searchParams.get("debug") === "1";

  if (!employee_id || !date) {
    return NextResponse.json({ error: "query 'id' and 'date' are required" }, { status: 400 });
  }
  if (!process.env.COMPANY_ID) {
    return NextResponse.json({ error: "COMPANY_ID is missing" }, { status: 500 });
  }

  let body;
  try { body = await req.json(); }
  catch { return NextResponse.json({ error: "invalid JSON body" }, { status: 400 }); }

  const { newClockIn, newClockOut, newBreakBegin, newBreakEnd } = body ?? {};

  // 正規化（不正値は null）
  const clockIn  = toHrDateTime(newClockIn,  date);
  const clockOut = toHrDateTime(newClockOut, date);
  const breakIn  = toHrDateTime(newBreakBegin, date);
  const breakOut = toHrDateTime(newBreakEnd,  date);

  // メインは両方必須
  if (!clockIn || !clockOut) {
    return NextResponse.json({ error: "invalid clock in/out", detail: { clockIn, clockOut } }, { status: 400 });
  }

  // 休憩は両方 valid の時のみ付ける（片方欠けや壊れ値は「休憩なし」扱い）
  const hasBreak = !!(breakIn && breakOut);

  // アクセストークン取得
  let at;
  try { at = await getAccessToken(); }
  catch (e) {
    return NextResponse.json({ error: `getAccessToken failed: ${String(e)}` }, { status: 500 });
  }

  const url = `https://api.freee.co.jp/hr/api/v1/employees/${employee_id}/work_records/${date}`;

  // 休憩あり：セグメント＋break_records で一発
  if (hasBreak) {
    const payload = {
      company_id: Number(process.env.COMPANY_ID),
      work_record_segments: [{ clock_in_at: clockIn, clock_out_at: clockOut }],
      break_records: [{ clock_in_at: breakIn, clock_out_at: breakOut }],
    };
    return await putFreee(url, at, payload, debug);
  }

  // 休憩なし：まず セグメント形だけ を試す（break_records は送らない）
  const payloadA = {
    company_id: Number(process.env.COMPANY_ID),
    work_record_segments: [{ clock_in_at: clockIn, clock_out_at: clockOut }],
  };
  let res = await putFreee(url, at, payloadA, debug);
  if (res.ok) return res;

  // スキーマ不一致などで落ちた場合はレガシー形でフォールバック
  const payloadB = {
    company_id: Number(process.env.COMPANY_ID),
    clock_in_at:  clockIn,
    clock_out_at: clockOut,
  };
  return await putFreee(url, at, payloadB, debug);
}
