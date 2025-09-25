"use client";
import { useMemo, useState, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import styles from "./displayShift.module.css";
import { onAuthStateChanged } from "firebase/auth";
import { auth } from "../../lib/firebase";
import { emailToId } from "../../utils/idToEmail/idToEmail";

function startOfMonth(d){ return new Date(d.getFullYear(), d.getMonth(), 1); }
function endOfMonth(d){ return new Date(d.getFullYear(), d.getMonth()+1, 0); }
function addMonths(d,n){ return new Date(d.getFullYear(), d.getMonth()+n, 1); }
function fmtMonthInput(d){ const y=d.getFullYear(); const m=String(d.getMonth()+1).padStart(2,"0"); return `${y}-${m}`; }
function hhmm(s){ if(!s) return ""; const [H,M] = s.split(":"); return `${String(H).padStart(2,"0")}:${String(M??"00").padStart(2,"0")}`; }

export default function DisplayShift(){
  const [cursor, setCursor] = useState(() => startOfMonth(new Date()));
  const router = useRouter();
  const params = useSearchParams();

  const [id, setId] = useState(params.get("id"));
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState("");

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (u) => {
      if (!u) { router.replace("/"); return; }
      setId(emailToId(u.email));
    });
    return () => unsub();
  }, [router]);

  // 6週×7列
  const cells = useMemo(() => {
    const first = startOfMonth(cursor), last = endOfMonth(cursor);
    const lead = first.getDay(), daysInMonth = last.getDate(), total = 42; // 6週固定
    const prevLast = endOfMonth(addMonths(cursor,-1)).getDate();
    const arr = [];
    for(let i=0;i<total;i++){
      const dayIndex = i - lead + 1;
      let date, label, inCurrentMonth = true;
      if (dayIndex <= 0){ label = prevLast + dayIndex; date = new Date(cursor.getFullYear(), cursor.getMonth()-1, label); inCurrentMonth = false; }
      else if (dayIndex > daysInMonth){ label = dayIndex - daysInMonth; date = new Date(cursor.getFullYear(), cursor.getMonth()+1, label); inCurrentMonth = false; }
      else { label = dayIndex; date = new Date(cursor.getFullYear(), cursor.getMonth(), label); }
      arr.push({ date, label, inCurrentMonth });
    }
    return arr;
  }, [cursor]);

  const go = (n)=> setCursor(d=>addMonths(d,n));
  const goToday = () => setCursor(startOfMonth(new Date()));

  const year = cursor.getFullYear();
  const month = cursor.getMonth()+1;

  const toDetailShift = (day) => {
    router.push(`./detailShift?id=${encodeURIComponent(id)}&year=${encodeURIComponent(year)}&month=${encodeURIComponent(month)}&day=${encodeURIComponent(day)}`);
  };

  // 当月勤務Map
  const [workByDay, setWorkByDay] = useState({});
  const fetchWorkMonth = async () => {
    if(!id) return;
    setLoading(true);
    try{
      const qs = new URLSearchParams({ id, year, month }).toString();
      const res = await fetch(`/api/getWorkMonth?${qs}`, { cache: "no-store" });
      if(!res.ok) throw new Error(await res.text().catch(()=>res.statusText));
      const list = await res.json();
      const map = {};
      for(const row of list){
        if(!row.start_work || !row.end_work) continue;
        const d = new Date(row.work_date);
        map[d.getDate()] = `${hhmm(row.start_work)}〜${hhmm(row.end_work)}`;
      }
      setWorkByDay(map);
    }catch(e){
      console.error(e); setMsg(e.message || "勤務取得でエラーが発生しました"); setWorkByDay({});
    }finally{ setLoading(false); }
  };
  useEffect(()=>{ fetchWorkMonth(); /* eslint-disable-next-line */ }, [id, year, month]);

  const weekLabels = ["日","月","火","水","木","金","土"];
  const now = new Date();

  return (
    <div className={styles.page}>
      {/* 操作バー */}
      <div className={styles.toolbar} role="group" aria-label="カレンダー操作">
        <div className={styles.toolLeft}>
          <button onClick={()=>go(-1)} className={styles.iconBtn} aria-label="前の月">‹</button>
          <button onClick={goToday} className={styles.ghostBtn}>今日</button>
        </div>

        <div className={styles.monthTitle} aria-live="polite">
          {year}年 {month}月
        </div>

        <div className={styles.toolRight}>
          <input
            type="month"
            value={fmtMonthInput(cursor)}
            onChange={(e)=>{ const [y,m] = e.target.value.split("-").map(Number); setCursor(new Date(y, m-1, 1)); }}
            className={styles.monthInput}
            aria-label="月を選択"
          />
          <button onClick={()=>go(1)} className={styles.iconBtn} aria-label="次の月">›</button>
        </div>
      </div>

      {msg && <p className={styles.message}>{msg}</p>}
      {loading && <div className={styles.skel} aria-hidden />}

      {/* カレンダー本体 */}
      <div className={styles.calendar} role="grid" aria-readonly="true">
        {weekLabels.map((w,i)=>(
          <div key={w} role="columnheader" className={`${styles.weekday} ${i===0?styles.sun: i===6?styles.sat:""}`}>{w}</div>
        ))}

        {cells.map((c, idx)=>{
          const isToday = c.date.getFullYear()===now.getFullYear() && c.date.getMonth()===now.getMonth() && c.date.getDate()===now.getDate();
          const dow = c.date.getDay();
          const dayNum = c.date.getDate();
          const timeRange = c.inCurrentMonth && workByDay[dayNum] ? workByDay[dayNum] : "";

          return (
            <button
              key={idx}
              role="gridcell"
              title={c.date.toISOString().slice(0,10)}
              className={[
                styles.cell,
                !c.inCurrentMonth ? styles.dim  : "",
                dow===0 ? styles.sunTxt : "",
                dow===6 ? styles.satTxt : "",
                timeRange ? styles.hasShift : ""
              ].join(" ")}
              onClick={()=> c.inCurrentMonth && toDetailShift(c.label)}
            >
              <span className={`${styles.dateBadge} ${isToday ? styles.today : ""}`}>{c.label}</span>
              {timeRange && <span className={styles.shiftChip}>{timeRange}</span>}
            </button>
          );
        })}
      </div>
    </div>
  );
}
