// app/(pages)/editStamp/page.js
"use client";
import { Suspense, useEffect, useMemo, useState } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { changeNotationTime } from "../../utils/changeNotationTime/changeNotationTime";
import { onAuthStateChanged } from "firebase/auth";
import { auth } from "../../lib/firebase";
import { emailToId } from "../../utils/idToEmail/idToEmail";

export const dynamic = "force-dynamic";

export default function Page() {
  return (
    <Suspense fallback={<p>読み込み中…</p>}>
      <EditStampInner />
    </Suspense>
  );
}

function EditStampInner() {
  const router = useRouter();
  const sp = useSearchParams();

  const [id, setId] = useState(() => sp.get("id") ?? "");
  const data = sp.get("data");

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (u) => {
      if (!u) {
        router.replace("/");
        return;
      }
      setId(emailToId(u.email ?? ""));
    });
    return () => unsub();
  }, [router]);

  const row = useMemo(() => {
    try { return data ? JSON.parse(data) : null; } catch { return null; }
  }, [data]);

  const [clockIn, setClockIn] = useState(row?.clock_in ?? "");
  const [breakBegin, setBreakBegin] = useState(row?.break_begin ?? "");
  const [breakEnd, setBreakEnd] = useState(row?.break_end ?? "");
  const [clockOut, setClockOut] = useState(row?.clock_out ?? "");

  // 休憩なしトグル（初期は「両方空なら休憩なし」）
  const [noBreak, setNoBreak] = useState(!row?.break_begin && !row?.break_end);

  // トグル切替時の同期
  const toggleNoBreak = (checked) => {
    setNoBreak(checked);
    if (checked) {
      setBreakBegin("");
      setBreakEnd("");
    }
  };

  const toDateTimeOrNull = (hhmm) => {
    if (!hhmm) return null; // ← ここで null を返す（--:-- 相当）
    return `${row.date} ${changeNotationTime(hhmm)}`;
  };

  const editStamp = async (e) => {
    e.preventDefault();
    if (!row?.date) return;

    const newClockIn  = toDateTimeOrNull(clockIn);   // 必須はフロントでもバリデ可
    const newClockOut = toDateTimeOrNull(clockOut);  // 必須

    // 休憩は「両方そろった時だけ値」「どちらか欠けたら両方 null」
    const hasBothBreak = !!(breakBegin && breakEnd) && !noBreak;
    const newBreakBegin = hasBothBreak ? toDateTimeOrNull(breakBegin) : null;
    const newBreakEnd   = hasBothBreak ? toDateTimeOrNull(breakEnd)   : null;

    try {
      const res = await fetch(
        `/api/putEditStamp?id=${encodeURIComponent(id)}&date=${encodeURIComponent(row.date)}`,
        {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ newClockIn, newBreakBegin, newBreakEnd, newClockOut }),
        }
      );

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.message || "更新に失敗しました。");
      }
      router.push(`/stampHistory?id=${encodeURIComponent(id)}`);
    } catch (e) {
      console.error(e);
    }
  };

  const deleteStamp = async () => {
    try {
      const res = await fetch(
        // 先頭スラッシュを付ける（相対 → 変なパスになる事故を防ぐ）
        `/api/deleteStamp?id=${encodeURIComponent(id)}&date=${encodeURIComponent(row.date)}`,
        { method: "DELETE" }
      );
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.message || "削除に失敗しました。");
      }
      router.push(`/stampHistory?id=${encodeURIComponent(id)}`);
    } catch (e) {
      console.error(e);
    }
  };

  if (!row) return <p>不正なパラメータです。</p>;

  return (
    <>
      <h1>編集画面</h1>
      <div>{row.date} の勤怠を修正します</div>

      <form onSubmit={editStamp}>
        <label>
          出勤
          <input type="time" value={clockIn} onChange={(e) => setClockIn(e.target.value)} required />
        </label>

        <div style={{ marginTop: 8 }}>
          <label style={{ display: "inline-flex", gap: 8, alignItems: "center" }}>
            <input
              type="checkbox"
              checked={noBreak}
              onChange={(e) => toggleNoBreak(e.target.checked)}
            />
            休憩なし（--:--）
          </label>
        </div>

        <label>
          休憩開始
          <input
            type="time"
            value={breakBegin}
            onChange={(e) => setBreakBegin(e.target.value)}
            disabled={noBreak}
          />
        </label>

        <label>
          休憩終了
          <input
            type="time"
            value={breakEnd}
            onChange={(e) => setBreakEnd(e.target.value)}
            disabled={noBreak}
          />
        </label>

        <label>
          退勤
          <input type="time" value={clockOut} onChange={(e) => setClockOut(e.target.value)} required />
        </label>

        <div style={{ marginTop: 12 }}>
          <button type="submit">更新</button>
        </div>
      </form>

      <div style={{ marginTop: 12 }}>
        <button onClick={deleteStamp}>削除</button>
      </div>
    </>
  );
}
