// app/stamping/page.jsx（または同等のファイル）
// 変更点のみ抜粋（そのまま貼り替え可）

"use client";
import { useState, useEffect, useMemo, useRef, useCallback } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import styles from "./stamping.module.css";
import { toISO8601WithOffset } from "../../utils/toISO8601WithOffset/toISO8601WithOffset";
import { onAuthStateChanged } from "firebase/auth";
import { auth } from "../../lib/firebase";
import { emailToId } from "../../utils/idToEmail/idToEmail";

export default function DetailPage() {
  const params = useSearchParams();
  const [id, setId] = useState(params.get("id"));
  const [name, setName] = useState("");
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  const [open, setOpen] = useState(false);
  const [selectedType, setSelectedType] = useState(null);

  const [dateStr, setDateStr] = useState(""); // "YYYY-MM-DD"
  const [timeStr, setTimeStr] = useState(""); // "HH:mm"
  const [submitting, setSubmitting] = useState(false);
  const [msg, setMsg] = useState(null); // トースト兼モーダル内メッセージ

  // モーダル初期フォーカス用
  const confirmBtnRef = useRef(null);
  const modalRef = useRef(null);

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

  useEffect(() => {
    const now = new Date();
    const y = now.getFullYear();
    const m = String(now.getMonth() + 1).padStart(2, "0");
    const d = String(now.getDate()).padStart(2, "0");
    const hh = String(now.getHours()).padStart(2, "0");
    const mm = String(now.getMinutes()).padStart(2, "0");
    setDateStr(`${y}-${m}-${d}`);
    setTimeStr(`${hh}:${mm}`);
  }, []);

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch("/api/getEmployees");
        if (!res.ok) throw new Error("failed");
        const data = await res.json();
        const hit = data.find((emp) => String(emp.id) === String(id));
        if (hit) setName(hit.display_name || "");
      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    })();
  }, [id]);

  const openModal = (type) => {
    setSelectedType(type);
    setOpen(true);
    setMsg(null);
  };
  const closeModal = useCallback(() => setOpen(false), []);

  // モーダル：Esc/背景クリックで閉じる
  useEffect(() => {
    if (!open) return;
    const onKey = (e) => {
      if (e.key === "Escape") closeModal();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, closeModal]);

  useEffect(() => {
    if (open && confirmBtnRef.current) {
      confirmBtnRef.current.focus();
    }
  }, [open]);

  const typeLabel = useMemo(() => {
    switch (selectedType) {
      case "clock_in":
        return "出勤";
      case "break_begin":
        return "休憩開始";
      case "break_end":
        return "休憩終了";
      case "clock_out":
        return "退勤";
      default:
        return "";
    }
  }, [selectedType]);

  const handleSubmit = async () => {
    if (!id || !selectedType || !dateStr || !timeStr) {
      setMsg("必要な情報が足りません。");
      return;
    }
    const date = toISO8601WithOffset(dateStr, timeStr);
    const basedate = date?.base_date;
    const datetime = date?.datetime;

    try {
      setSubmitting(true);
      setMsg(null);
      const res = await fetch(`/api/postTimeClocks?id=${encodeURIComponent(id)}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type: selectedType, base_date: basedate, datetime }),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.message || "打刻に失敗しました。");
      }
      await res.json();
      setMsg("打刻が完了しました。");
      setOpen(false);
    } catch (e) {
      console.error(e);
      setMsg(e.message || "通信エラーが発生しました。");
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className={styles.container}>
        <div className={styles.skelHeader} aria-hidden />
        <div className={styles.skelLine} aria-hidden />
        <div className={styles.skelGrid} aria-hidden>
          <div className={styles.skelBtn} />
          <div className={styles.skelBtn} />
          <div className={styles.skelBtn} />
          <div className={styles.skelBtn} />
        </div>
      </div>
    );
  }

  return (
    <div className={styles.container}>
      {/* トースト（画面右上） */}
      <div className={styles.toast} aria-live="polite" aria-atomic="true">
        {msg && <div className={styles.toastItem}>{msg}</div>}
      </div>

      <h1 className={styles.title}>打刻システム</h1>

      {name ? (
        <p className={styles.welcome}>
          <span className="visually-hidden">ログイン中のユーザー：</span>
          ようこそ {name} さん
        </p>
      ) : (
        <p className={styles.alert} role="alert">
          対象が見つかりません
        </p>
      )}

      <div className={styles.actions} role="group" aria-label="打刻アクション">
        <button
          onClick={() => openModal("clock_in")}
          className={`${styles.btn} ${styles.primary}`}
          disabled={submitting}
        >
          出勤
        </button>
        <button onClick={() => openModal("break_begin")} className={styles.btn} disabled={submitting}>
          休憩開始
        </button>
        <button onClick={() => openModal("break_end")} className={styles.btn} disabled={submitting}>
          休憩終了
        </button>
        <button
          onClick={() => openModal("clock_out")}
          className={`${styles.btn} ${styles.danger}`}
          disabled={submitting}
        >
          退勤
        </button>
      </div>

      {open && (
        <div
          className={styles.modal}
          role="dialog"
          aria-modal="true"
          aria-labelledby="modalTitle"
          aria-describedby="modalDesc"
          onMouseDown={(e) => {
            // 背景クリックで閉じる（内容クリックは閉じない）
            if (e.target === e.currentTarget) closeModal();
          }}
          ref={modalRef}
        >
          <div className={styles.modalBody} onMouseDown={(e) => e.stopPropagation()}>
            <h2 id="modalTitle" className={styles.modalTitle}>
              {typeLabel || "操作の選択"}
            </h2>
            <p id="modalDesc" className={styles.modalText}>
              {typeLabel ? "この時刻で記録します。よろしいですか？" : "アクションを選択してください。"}
            </p>

            <div className={styles.modalFields}>
              <label className={styles.label}>
                日付
                <input
                  type="date"
                  value={dateStr}
                  onChange={(e) => setDateStr(e.target.value)}
                  disabled={submitting}
                />
              </label>
              <label className={styles.label}>
                時刻
                <input
                  type="time"
                  value={timeStr}
                  onChange={(e) => setTimeStr(e.target.value)}
                  disabled={submitting}
                />
              </label>
            </div>

            <div className={styles.modalActions}>
              <button
                onClick={handleSubmit}
                disabled={submitting}
                ref={confirmBtnRef}
                className={`${styles.mBtn} ${styles.mPrimary}`}   // ← ここを変更
                aria-busy={submitting ? "true" : "false"}
              >
                {submitting ? "送信中…" : "確定"}
              </button>
              <button onClick={closeModal} disabled={submitting} className={`${styles.mBtn} ${styles.mGhost}`}>
                閉じる
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
