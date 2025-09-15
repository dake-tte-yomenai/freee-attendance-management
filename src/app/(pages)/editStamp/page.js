// app/(pages)/editStamp/page.js
"use client";
import { Suspense, useEffect, useMemo, useState } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { changeNotationTime } from "../../utils/changeNotationTime/changeNotationTime";
import { onAuthStateChanged } from "firebase/auth";
import { auth } from "../../lib/firebase";
import { emailToId } from "../../utils/idToEmail/idToEmail";

export const dynamic = "force-dynamic"; // 事前レンダ回避

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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // router は安定なので依存に含めない

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

  const editStamp = async (e) => {
    e.preventDefault();
    if (!row?.date) return;

    const newClockIn = `${row.date} ${changeNotationTime(clockIn)}`;
    const newBreakBegin = `${row.date} ${changeNotationTime(breakBegin)}`;
    const newBreakEnd = `${row.date} ${changeNotationTime(breakEnd)}`;
    const newClockOut = `${row.date} ${changeNotationTime(clockOut)}`;

    try {
      const res = await fetch(
        `/api/putEditStamp?id=${encodeURIComponent(id)}&date=${encodeURIComponent(row.date)}`,
        {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            newClockIn,
            newBreakBegin,
            newBreakEnd,
            newClockOut,
          }),
        }
      );

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.message || "更新に失敗しました。");
      }
      // 成功時のみトップへ戻す
      router.push("/");
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
        <input type="time" value={clockIn} onChange={(e) => setClockIn(e.target.value)} />
        <input type="time" value={breakBegin} onChange={(e) => setBreakBegin(e.target.value)} />
        <input type="time" value={breakEnd} onChange={(e) => setBreakEnd(e.target.value)} />
        <input type="time" value={clockOut} onChange={(e) => setClockOut(e.target.value)} />
        <button type="submit">更新</button>
      </form>
    </>
  );
}
