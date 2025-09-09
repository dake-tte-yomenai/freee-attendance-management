// app/components/Calendar.jsx
"use client";
import { useMemo, useState, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import styles from "./displayShift.module.css";

function startOfMonth(d) { return new Date(d.getFullYear(), d.getMonth(), 1); }
function endOfMonth(d)   { return new Date(d.getFullYear(), d.getMonth() + 1, 0); }
function addMonths(d, n) { return new Date(d.getFullYear(), d.getMonth() + n, 1); }
function fmtMonthInput(d){
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  return `${y}-${m}`;
}
// "HH:MM:SS" または "HH:MM" を "HH:MM" に寄せる
function hhmm(s) {
  if (!s) return "";
  const [H, M] = s.split(":");
  return `${H.padStart(2, "0")}:${(M ?? "00").padStart(2, "0")}`;
}

export default function DisplayShift() {
  const [cursor, setCursor] = useState(() => startOfMonth(new Date())); // 表示月（1日固定）
  const router = useRouter();
  const params = useSearchParams();

  const id = params.get("id");
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState("");

  // 6週×7列=35マス（週開始は日曜）
  const cells = useMemo(() => {
    const first = startOfMonth(cursor);
    const last  = endOfMonth(cursor);
    const firstWeekday = first.getDay();
    const daysInMonth  = last.getDate();
    const total = 35;
    const lead = firstWeekday; // 前月埋め数
    const prevLast = endOfMonth(addMonths(cursor, -1)).getDate();
    const arr = [];

    for (let i = 0; i < total; i++) {
      const dayIndex = i - lead + 1; // 当月「日」
      let date, label, inCurrentMonth = true;

      if (dayIndex <= 0) {
        label = prevLast + dayIndex;
        date = new Date(cursor.getFullYear(), cursor.getMonth() - 1, label);
        inCurrentMonth = false;
      } else if (dayIndex > daysInMonth) {
        label = dayIndex - daysInMonth;
        date = new Date(cursor.getFullYear(), cursor.getMonth() + 1, label);
        inCurrentMonth = false;
      } else {
        label = dayIndex;
        date = new Date(cursor.getFullYear(), cursor.getMonth(), label);
      }
      arr.push({ date, label, inCurrentMonth });
    }
    return arr;
  }, [cursor]);

  const goPrev  = () => setCursor(d => addMonths(d, -1));
  const goNext  = () => setCursor(d => addMonths(d,  1));
  const goToday = () => setCursor(startOfMonth(new Date()));

  const year  = cursor.getFullYear();
  const month = cursor.getMonth() + 1;

  // クリックで詳細へ
  const toDetailShift = (day) => {
    router.push(
      `./detailShift?id=${encodeURIComponent(id)}&year=${encodeURIComponent(year)}&month=${encodeURIComponent(month)}&day=${encodeURIComponent(day)}`
    );
  };

  // --- ここから：当月の勤務時間（id限定）を取得してMap化 ---
  // 形式: { 1: "10:00~18:00", 2: "..." , ... }
  const [workByDay, setWorkByDay] = useState({});

  const fetchWorkMonth = async () => {
    if (!id) return;
    setLoading(true);
    try {
      const qs = new URLSearchParams({ id, year, month }).toString();
      const res = await fetch(`/api/getWorkMonth?${qs}`, { cache: "no-store" });
      if (!res.ok) {
        const t = await res.text().catch(() => res.statusText);
        throw new Error(`勤務取得に失敗しました: ${t}`);
      }
      const list = await res.json(); // [{ work_date, start_work, end_work }]
      const map = {};
      for (const row of list) {
        if (!row.start_work || !row.end_work) continue;
        const d = new Date(row.work_date);
        const dayNum = d.getDate();
        map[dayNum] = `${hhmm(row.start_work)}~${hhmm(row.end_work)}`;
      }
      setWorkByDay(map);
    } catch (e) {
      console.error(e);
      setMsg(e.message || "勤務取得でエラーが発生しました");
      setWorkByDay({});
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchWorkMonth();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, year, month]);

  // ----------------------------------------------------------

  return (
    <div className={styles.wrap}>
      <div className={styles.header}>
        <button onClick={goPrev}  className={styles.navBtn} aria-label="前の月">‹</button>
        <div className={styles.title}>{year}年 {month}月</div>
        <button onClick={goNext}  className={styles.navBtn} aria-label="次の月">›</button>
      </div>

      <div className={styles.controlRow}>
        <button onClick={goToday} className={styles.todayBtn}>今日</button>
        <input
          type="month"
          value={fmtMonthInput(cursor)}
          onChange={(e) => {
            const [y, m] = e.target.value.split("-").map(Number);
            setCursor(new Date(y, m - 1, 1));
          }}
          className={styles.monthInput}
          aria-label="月を選択"
        />
      </div>

      {msg && <p className={styles.message}>{msg}</p>}

      <div className={styles.grid}>
        {["日","月","火","水","木","金","土"].map((w, i) => (
          <div
            key={w}
            className={[
              styles.weekday,
              i === 0 ? styles.sun : "",
              i === 6 ? styles.sat : "",
            ].join(" ")}
          >
            {w}
          </div>
        ))}

        {cells.map((c, i) => {
          const now = new Date();
          const isToday =
            c.date.getFullYear() === now.getFullYear() &&
            c.date.getMonth() === now.getMonth() &&
            c.date.getDate() === now.getDate();

          const dow = c.date.getDay();
          const dayNum = c.date.getDate();

          const timeRange =
            c.inCurrentMonth && workByDay[dayNum] ? workByDay[dayNum] : "";

          return (
            <div
              key={i}
              className={[
                styles.cell,
                !c.inCurrentMonth ? styles.dim : "",
                dow === 0 ? styles.sunTxt : "",
                dow === 6 ? styles.satTxt : "",
              ].join(" ")}
              title={c.date.toISOString().slice(0,10)}
              onClick={() => c.inCurrentMonth && toDetailShift(c.label)}
            >
              <div className={[styles.dateBadge, isToday ? styles.today : ""].join(" ")}>
                {c.label}
              </div>

              {/* 勤務時間（当月セルのみ表示） */}
              {timeRange && (
                <div className={styles.shiftTime}>
                  {timeRange}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
