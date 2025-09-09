"use client";
import { useState,useMemo,useRef,useEffect } from "react";
import { useSearchParams,useRouter } from "next/navigation"; 
import styles from "./stampHistory.module.css";
import { toRows } from "../../utils/toRows/toRows"; 

export default function StampHistory(){
    const searchParams=useSearchParams();
    const id=searchParams.get("id");

    const router=useRouter();
    //1

    const thisYear = useMemo(() => new Date().getFullYear(), []);
    const thisMonth = useMemo(() => new Date().getMonth() + 1, []);

    const [year,setYear]=useState(thisYear);
    const [month,setMonth]=useState(thisMonth);
    const [rows,setRows]=useState([]);
    const [loading, setLoading] = useState(false);
    const [err, setErr] = useState(null);

    const load=async(y,m)=>{
        setLoading(true);
        setErr(null);
        try{
            const res=await fetch(`api/getStampHistory?employeeId=${encodeURIComponent(id)}&year=${y}&month=${m}`);
            if(!res.ok) throw new Error("failed");
            const data=await res.json();
            console.log(data);
            setRows(toRows(data));
        }catch(e){
            console.error(e);
            setErr(e?.message ?? "エラーが発生しました");
        }finally{
            setLoading(false);
        }
    }

    const did = useRef(false);

    useEffect(() => {
        if (!id || did.current) return;
        did.current = true;         
        load(year,month);
    }, [id, year,month]);//1でmonthがそろっているから起動される

    const getStampHistory= (e) => {
        e.preventDefault();
        load(year,month);
    };

     const toEditPage=(data)=>{
        const params = new URLSearchParams();
        params.set("id", String(id));
        params.set("data", JSON.stringify(data)); 

        router.push(`/editStamp?${params.toString()}`); 
    }

    return(
        <div>
            <h1>打刻履歴</h1>
            <form onSubmit={getStampHistory}>
               <input
                    type="month"
                    value={`${year}-${String(month).padStart(2, "0")}`}
                    onChange={(e) => {
                        const [y, m] = e.target.value.split("-");
                        setYear(Number(y));
                        setMonth(Number(m));
                    }}
                    required
                />
                <button type="submit">表示</button>
            </form>
            {loading && <p>読み込み中...</p>}
            {err && <p>{err}</p>}
            {rows.length > 0 && (
                <table className={styles.table}>
                    <thead>
                        <tr>
                            <th>状態</th>
                            <th>日付</th>
                            <th>出勤</th>
                            <th>休憩開始</th>
                            <th>休憩終了</th>
                            <th>退勤</th>
                            <th>操作</th>
                        </tr>
                    </thead>
                    <tbody>
                        {rows.map((r) => {
                            const complete = r.clock_in !== "-" && r.clock_out !== "-";
                            return (
                            <tr key={r.date}>
                                <td>
                                    <span className={`${styles.status} ${complete ? styles.ok : styles.pending}`}>
                                        {complete ? "OK" : "未完"}
                                    </span>
                                </td>
                                <td>{r.date}</td>
                                <td>{r.clock_in}</td>
                                <td>{r.break_begin}</td>
                                <td>{r.break_end}</td>
                                <td>{r.clock_out}</td>
                                <td><p onClick={()=>toEditPage(r)}>編集</p></td>
                            </tr>
                            );
                        })}
                    </tbody>
                </table>
            )} 
        </div>
    )
}