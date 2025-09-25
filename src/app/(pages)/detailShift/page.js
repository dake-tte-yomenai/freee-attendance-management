"use client";
import { useSearchParams, useRouter } from "next/navigation";
import { useState, useEffect, useMemo } from "react";
import ShiftBandFrame from "./ShiftBandFrame";
import styles from "./detailShift.module.css";
import { onAuthStateChanged } from "firebase/auth";
import { auth } from "../../lib/firebase";
import { emailToId } from "../../utils/idToEmail/idToEmail";

export default function DetailShift() {
  const router = useRouter();
  const params = useSearchParams();
  const year = params.get("year");
  const month = params.get("month");
  const day = params.get("day");

  const [id, setId] = useState(params.get("id"));
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (u) => {
      if (!u) {
        router.replace("/");
        return;
      }
      setId(emailToId(u.email));
    });
    return () => unsub();
  }, [router]);

  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState("");
  const [empData, setEmpData] = useState([]);
  const startHour = 9;
  const endHour = 22;

  // util
  const fmt = (h) => {
    const m = Math.round(h * 60);
    const hh = String(Math.floor(m / 60)).padStart(2, "0");
    const mm = String(m % 60).padStart(2, "0");
    return `${hh}:${mm}`;
  };
  const parse = (s) => {
    if (!s) return NaN;
    const [hh, mm] = s.split(":").map((v) => parseInt(v, 10));
    return (isNaN(hh) ? NaN : hh) + ((isNaN(mm) ? 0 : mm) / 60);
  };
  const snap15 = (h) => Math.round(h * 4) / 4;
  const clamp = (h) => Math.min(Math.max(h, startHour), endHour);

  const timeStrToHour = (s) => {
    if (!s) return NaN;
    const [hh, mm = "0", ss = "0"] = s.split(":");
    const h = parseInt(hh, 10), m = parseInt(mm, 10), sec = parseInt(ss, 10);
    if (Number.isNaN(h)) return NaN;
    return h + (Number.isNaN(m) ? 0 : m) / 60 + (Number.isNaN(sec) ? 0 : sec) / 3600;
  };

  // fetch employees
  useEffect(() => {
    setLoading(true);
    (async () => {
      try {
        const res = await fetch("/api/getEmployees");
        if (!res.ok) throw new Error("従業員の取得に失敗しました");
        const data = await res.json();
        setEmpData(data || []);
      } catch (e) {
        console.error(e);
        setMsg(e.message || "従業員の取得に失敗しました");
      } finally {
        setLoading(false);
      }
    })();
  }, [id]);

  const labels = useMemo(() => empData.map((e) => e.display_name), [empData]);

  // bands
  const [bands, setBands] = useState([]);

  const fetchBandsFromDB = async () => {
    if (!year || !month || !day || empData.length === 0) return;
    const qs = new URLSearchParams({ year, month, day }).toString();
    const res = await fetch(`/api/getShiftBands?${qs}`, { cache: "no-store" });
    if (!res.ok) {
      const t = await res.text().catch(() => res.statusText);
      throw new Error(`シフト取得に失敗しました: ${t}`);
    }
    const list = await res.json(); // [{ employee_id, start_work, end_work, breaks:[...] }]
    const byId = new Map(list.map((r) => [r.employee_id, r]));

    const next = [];
    empData.forEach((emp, laneIdx) => {
      const rec = byId.get(emp.id);
      if (!rec || !rec.start_work || !rec.end_work) return;

      const ws = timeStrToHour(rec.start_work);
      const we = timeStrToHour(rec.end_work);
      if (Number.isNaN(ws) || Number.isNaN(we)) return;

      const breaks = (rec.breaks ?? [])
        .map((br) => ({
          start: timeStrToHour(br.start_break),
          end: timeStrToHour(br.end_break),
        }))
        .filter((b) => !Number.isNaN(b.start) && !Number.isNaN(b.end));

      next.push({ lane: laneIdx, work: { start: ws, end: we }, breaks });
    });

    next.sort((a, b) => a.lane - b.lane);
    setBands(next);
  };

  useEffect(() => {
    fetchBandsFromDB().catch((e) => {
      console.error(e);
      setMsg(e.message || "シフト取得でエラーが発生しました");
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [year, month, day, empData]);

  // editing
  const [editingLane, setEditingLane] = useState(null);
  const [workStart, setWorkStart] = useState("10:00");
  const [workEnd, setWorkEnd] = useState("18:00");
  const [breakRows, setBreakRows] = useState([]); // [{start,end}]

  const onPickLane = (laneIdx) => {
    setEditingLane(laneIdx);
    const existing = bands.find((b) => b.lane === laneIdx);
    if (existing?.work) {
      const f = (x) => fmt(x);
      setWorkStart(f(existing.work.start));
      setWorkEnd(f(existing.work.end));
      setBreakRows((existing.breaks ?? []).map((br) => ({ start: fmt(br.start), end: fmt(br.end) })));
    } else {
      setWorkStart("10:00");
      setWorkEnd("18:00");
      setBreakRows([]);
    }
  };

  const addBreakRow = () => setBreakRows((p) => [...p, { start: "12:00", end: "13:00" }]);
  const removeBreakRow = (idx) => setBreakRows((p) => p.filter((_, i) => i !== idx));
  const changeBreakRow = (idx, field, value) => setBreakRows((p) => p.map((r, i) => (i === idx ? { ...r, [field]: value } : r)));

  const normalizeAndValidate = (laneIdx) => {
    let ws = snap15(clamp(parse(workStart)));
    let we = snap15(clamp(parse(workEnd)));
    if (isNaN(ws) || isNaN(we)) return null;
    if (we < ws + 0.25) we = Math.min(endHour, ws + 0.25);

    const clean = breakRows
      .map((r) => {
        let s = snap15(clamp(parse(r.start)));
        let e = snap15(clamp(parse(r.end)));
        if (isNaN(s) || isNaN(e)) return null;
        s = Math.max(ws, s);
        e = Math.min(we, e);
        if (e < s + 0.25) return null;
        return { start: s, end: e };
      })
      .filter(Boolean)
      .sort((a, b) => a.start - b.start);

    const merged = [];
    for (const cur of clean) {
      if (merged.length === 0) merged.push(cur);
      else {
        const last = merged[merged.length - 1];
        if (cur.start <= last.end + 1e-6) last.end = Math.max(last.end, cur.end);
        else merged.push(cur);
      }
    }
    return { lane: laneIdx, work: { start: ws, end: we }, breaks: merged };
  };

  const onConfirm = async () => {
    if (editingLane == null) return;
    const normalized = normalizeAndValidate(editingLane);
    if (!normalized) return;

    const emp = empData[editingLane];
    if (!emp?.id) {
      console.error("employee id not found");
      setEditingLane(null);
      return;
    }
    try {
      setLoading(true);
      const res = await fetch("/api/postShift", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: emp.id,
          year,
          month,
          day,
          workStart,
          workEnd,
          breakRows,
        }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || err.message || "シフトが作成できませんでした。");
      }
      await fetchBandsFromDB();
    } catch (e) {
      console.error(e);
      setMsg(e.message || "通信エラーが発生しました。");
    } finally {
      setEditingLane(null);
      setLoading(false);
    }
  };

  const deleteTime = async () => {
    if (editingLane == null) return;
    const emp = empData[editingLane];
    if (!emp?.id) {
      setEditingLane(null);
      return;
    }
    setWorkStart("");
    setWorkEnd("");
    setBreakRows([]);
    try {
      setLoading(true);
      const res = await fetch("/api/postShift", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: emp.id,
          year,
          month,
          day,
          workStart: null,
          workEnd: null,
          breakRows: [],
        }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || err.message || "削除に失敗しました。");
      }
      await fetchBandsFromDB();
    } catch (e) {
      console.error(e);
      setMsg(e.message || "通信エラーが発生しました。");
    } finally {
      setEditingLane(null);
      setLoading(false);
    }
  };

  const title = `${year}年${month}月${day}日のシフト詳細`;

  return (
    <div className={styles.page}>
      <h1 className={styles.title}>{title}</h1>
      {msg && <p className={styles.alert} role="status" aria-live="polite">{msg}</p>}

      {/* 名前チップ（横スクロール可） */}
      <div className={styles.nameBar}>
        {empData.map((emp, idx) => (
          <button
            key={emp.id}
            onClick={() => onPickLane(idx)}
            className={`${styles.chip} ${editingLane === idx ? styles.chipActive : ""}`}
          >
            {emp.display_name}
          </button>
        ))}
      </div>

      {/* 編集カード */}
      {editingLane != null && (
        <div className={styles.card}>
          <div className={styles.cardHeader}>
            <span className={styles.empName}>{labels[editingLane] ?? `Lane ${editingLane + 1}`}</span>
          </div>

          {/* 勤務時間 */}
          <div className={styles.grid}>
            <label className={styles.field}>
              <span className={styles.label}>開始</span>
              <input
                className={styles.input}
                type="time"
                step={900}
                value={workStart}
                min={fmt(startHour)}
                max={fmt(endHour)}
                onChange={(e) => setWorkStart(e.target.value)}
                placeholder="--:--"
              />
            </label>
            <label className={styles.field}>
              <span className={styles.label}>終了</span>
              <input
                className={styles.input}
                type="time"
                step={900}
                value={workEnd}
                min={fmt(startHour)}
                max={fmt(endHour)}
                onChange={(e) => setWorkEnd(e.target.value)}
                placeholder="--:--"
              />
            </label>
          </div>

          {/* 休憩 */}
          <div className={styles.breakHeader}>
            <span>休憩</span>
            <button type="button" onClick={addBreakRow} className={styles.btnGhost}>＋ 休憩を追加</button>
          </div>

          <div className={styles.breakList}>
            {breakRows.length === 0 && <div className={styles.empty}>休憩は未設定です</div>}
            {breakRows.map((br, i) => (
              <div key={i} className={styles.breakItem}>
                <label className={styles.field}>
                  <span className={styles.label}>開始</span>
                  <input
                    className={styles.input}
                    type="time"
                    step={900}
                    value={br.start}
                    min={fmt(startHour)}
                    max={fmt(endHour)}
                    onChange={(e) => changeBreakRow(i, "start", e.target.value)}
                  />
                </label>
                <label className={styles.field}>
                  <span className={styles.label}>終了</span>
                  <input
                    className={styles.input}
                    type="time"
                    step={900}
                    value={br.end}
                    min={fmt(startHour)}
                    max={fmt(endHour)}
                    onChange={(e) => changeBreakRow(i, "end", e.target.value)}
                  />
                </label>
                <button type="button" onClick={() => removeBreakRow(i)} className={styles.btnDangerOutline}>削除</button>
              </div>
            ))}
          </div>

          {/* アクション */}
          <div className={styles.actions}>
            <button onClick={() => setEditingLane(null)} className={styles.btnGhost}>キャンセル</button>
            <div className={styles.actionsRight}>
              <button onClick={onConfirm} className={styles.btnPrimary} disabled={!workStart || !workEnd}>確定</button>
              <button onClick={deleteTime} className={styles.btnDanger}>全消去</button>
            </div>
          </div>
        </div>
      )}

      {/* バンド表示（DB反映） */}
      <div className={styles.frameWrap}>
        <ShiftBandFrame
          startHour={startHour}
          endHour={endHour}
          lanes={empData.length}
          hourWidth={80}
          labels={labels}
          bands={bands}
        />
      </div>
    </div>
  );
}
