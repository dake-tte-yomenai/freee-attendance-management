"use client";
import { useState,useEffect,useMemo } from "react";
import { useSearchParams } from "next/navigation";
import styles from "./stamping.module.css";
import { toISO8601WithOffset } from "../../utils/toISO8601WithOffset/toISO8601WithOffset";

export default function DetailPage(){
    const searchParams=useSearchParams();
    const id=searchParams.get("id");
    const [name, setName] = useState("");
    const [loading, setLoading] = useState(true);

    const [open,setOpen]=useState(false);
    const [selectedType, setSelectedType] = useState(null);

    const [dateStr, setDateStr] = useState(""); // "YYYY-MM-DD"
    const [timeStr, setTimeStr] = useState(""); // "HH:mm"
    const [submitting, setSubmitting] = useState(false);
    const [msg, setMsg] = useState(null);

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

    useEffect(()=>{
        (async()=>{
            try{
                const res=await fetch("/api/getEmployees");
                if(!res.ok) throw new Error("failed");
                const data=await res.json();
                const hit = data.find(emp => String(emp.id) === String(id));
                if (hit) setName(hit.display_name || "");
            }catch(e){
                console.error(e);
            }finally{
                setLoading(false);
            }
        })();
    },[id]);

    const openModal=(type)=>{
        setSelectedType(type);
        setOpen(true);
        setMsg(null);
    };
    const closeModal=()=>setOpen(false);

    const typeLabel = useMemo(() => {
        switch (selectedType) {
        case "clock_in": return "出勤";
        case "break_begin": return "休憩開始";
        case "break_end": return "休憩終了";
        case "clock_out": return "退勤";
        default: return "";
        }
    }, [selectedType]);

    const handleSubmit = async () => {
        if (!id || !selectedType || !dateStr || !timeStr) {
            setMsg("必要な情報が足りません。");
            return;
        }
        const date = toISO8601WithOffset(dateStr, timeStr);
        const basedate=date?.base_date;
        const datetime=date?.datetime;

        try {
            setSubmitting(true);
            setMsg(null);

            // id はクエリ、type/datetime は JSON body
            const res = await fetch(`/api/postTimeClocks?id=${encodeURIComponent(id)}`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ type: selectedType,base_date:basedate, datetime: datetime}),
            });

            if (!res.ok) {
                const err = await res.json().catch(() => ({}));
                throw new Error(err.message || "打刻に失敗しました。");
            }
            const data = await res.json();
            setMsg("打刻が完了しました。");
            setOpen(false);
        } catch (e) {
            console.error(e);
            setMsg(e.message || "通信エラーが発生しました。");
        } finally {
            setSubmitting(false);
        }
    };

    if (loading) return <div>読み込み中・・・</div>;

    return (
    <div className={styles.container}>
        <h1>打刻システム</h1>
        {name ? (
            <div className={styles.welcome}>ようこそ {name} さん</div>
        ):(
            <div className={styles.alert}>対象が見つかりません</div>
        )}
        {msg && <div className={styles.message}>{msg}</div>}

        <div className={styles.actions}>
            <button onClick={() => openModal("clock_in")}>出勤</button>
            <button onClick={() => openModal("break_begin")}>休憩開始</button>
            <button onClick={() => openModal("break_end")}>休憩終了</button>
            <button onClick={() => openModal("clock_out")}>退勤</button>
        </div>

        {open && (
            <div className={styles.modal} role="dialog" aria-modal="true">
                <div className={styles.modalBody}>
                    <p>
                        {typeLabel}
                        {typeLabel ? "時刻を記録します。よろしいですか？" : "を選択してください。"}
                    </p>
                    <div className={styles.modalActions}>
                        <input type="date" value={dateStr} onChange={(e) => setDateStr(e.target.value)}/>
                        <input type="time" value={timeStr} onChange={(e) => setTimeStr(e.target.value)}/>
                         <button onClick={handleSubmit} disabled={submitting}>
                            {submitting ? "送信中..." : "確定"}
                        </button>
                        <button onClick={closeModal} disabled={submitting}>
                            閉じる
                        </button>
                    </div>
                </div>
            </div>
        )}
    </div>
  );
}