"use client";
import { Suspense, useEffect, useMemo, useState } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import styles from "./editStamp.module.css";
import { changeNotationTime } from "../../utils/changeNotationTime/changeNotationTime";
import { onAuthStateChanged } from "firebase/auth";
import { auth } from "../../lib/firebase";
import { emailToId } from "../../utils/idToEmail/idToEmail";

export const dynamic = "force-dynamic";

export default function Page() {
  return (
    <Suspense fallback={<p className={styles.pageLoading}>読み込み中…</p>}>
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
    try {
      return data ? JSON.parse(data) : null;
    } catch {
      return null;
    }
  }, [data]);

  const [clockIn, setClockIn] = useState(row?.clock_in ?? "");
  const [breakBegin, setBreakBegin] = useState(row?.break_begin ?? "");
  const [breakEnd, setBreakEnd] = useState(row?.break_end ?? "");
  const [clockOut, setClockOut] = useState(row?.clock_out ?? "");

  // 休憩なしトグル（初期は「両方空なら休憩なし」）
  const [noBreak, setNoBreak] = useState(!row?.break_begin && !row?.break_end);

  const toggleNoBreak = (checked) => {
    setNoBreak(checked);
    if (checked) {
      setBreakBegin("");
      setBreakEnd("");
    }
  };

  const toDateTimeOrNull = (hhmm) => {
    if (!hhmm) return null;
    return `${row.date} ${changeNotationTime(hhmm)}`;
  };

  const editStamp = async (e) => {
    e.preventDefault();
    if (!row?.date) return;

    const newClockIn  = toDateTimeOrNull(clockIn);
    const newClockOut = toDateTimeOrNull(clockOut);

    // 休憩は両方そろった時だけ採用
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

  if (!row) return <p className={styles.pageLoading}>不正なパラメータです。</p>;

  return (
    <div className={styles.page}>
      <h1 className={styles.title}>編集画面</h1>
      <p className={styles.sub}>
        <span className={styles.date}>{row.date}</span> の勤怠を修正します
      </p>

      <form onSubmit={editStamp} className={styles.card}>
        {/* 出勤・退勤 */}
        <div className={styles.grid}>
          <label className={styles.field}>
            <span className={styles.label}>出勤</span>
            <input
              className={styles.input}
              type="time"
              value={clockIn}
              onChange={(e) => setClockIn(e.target.value)}
              required
            />
          </label>

          <label className={styles.field}>
            <span className={styles.label}>退勤</span>
            <input
              className={styles.input}
              type="time"
              value={clockOut}
              onChange={(e) => setClockOut(e.target.value)}
              required
            />
          </label>
        </div>

        {/* 休憩なし */}
        <label className={styles.switchRow}>
          <input
            className={styles.checkbox}
            type="checkbox"
            checked={noBreak}
            onChange={(e) => toggleNoBreak(e.target.checked)}
          />
          <span>休憩なし（--:--）</span>
        </label>

        {/* 休憩開始・休憩終了 */}
        <div className={styles.grid}>
          <label className={styles.field}>
            <span className={styles.label}>休憩開始</span>
            <input
              className={styles.input}
              type="time"
              value={breakBegin}
              onChange={(e) => setBreakBegin(e.target.value)}
              disabled={noBreak}
            />
          </label>

          <label className={styles.field}>
            <span className={styles.label}>休憩終了</span>
            <input
              className={styles.input}
              type="time"
              value={breakEnd}
              onChange={(e) => setBreakEnd(e.target.value)}
              disabled={noBreak}
            />
          </label>
        </div>

        {/* 操作ボタン */}
        <div className={styles.actions}>
          <button type="button" className={styles.btnGhost} onClick={() => router.back()}>
            戻る
          </button>
          <div className={styles.actionsRight}>
            <button type="submit" className={styles.btnPrimary}>
              更新
            </button>
            <button type="button" className={styles.btnDanger} onClick={deleteStamp}>
              削除
            </button>
          </div>
        </div>
      </form>
    </div>
  );
}
