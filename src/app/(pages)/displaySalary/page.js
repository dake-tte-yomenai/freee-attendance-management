"use client";
import { useState,useMemo,useEffect,useRef } from "react";
import { useSearchParams,useRouter } from "next/navigation";
import { onAuthStateChanged } from "firebase/auth";
import { auth } from "../../lib/firebase";
import { emailToId } from "../../utils/idToEmail/idToEmail";

export default function DisplaySalary(){
    const thisYear = useMemo(() => new Date().getFullYear(), []);
    const thisMonth = useMemo(() => new Date().getMonth() + 1, []);

    const [year,setYear]=useState(thisYear);
    const [month,setMonth]=useState(thisMonth);
    const [loading, setLoading] = useState(false);
    const [err,setErr]=useState(null);
    const [data, setData]=useState(null); 
    
    const params=useSearchParams();
    const [id,setId]=useState(params.get('id'));

    const router = useRouter();

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

    const load=async(y,m)=>{
        setLoading(true);
        setErr(null);
        try{
            const res=await fetch(`api/getSalary?employeeId=${encodeURIComponent(id)}&year=${y}&month=${m}`);
            if(!res.ok) throw new Error("failed");
            const json=await res.json();
            setData(json);
            console.log(data);
        }catch(e){
            console.error(e);
            setErr(e?.message ?? "エラーが発生しました");
            setData(null);
        }finally{
            setLoading(false);
        }
        
    }

    const did = useRef(false);
    useEffect(()=>{
        if (!id || did.current) return;
        load(year,month);
    },[id,year,month]);

    const getSalary=(e)=>{
        e.preventDefault();
        load(year,month);
    }

    const stmt = data?.employee_payroll_statement ?? null;
    const gross = stmt?.payment_amount;         // 総支給（例）
    const net   = stmt?.net_payment_amount;     // 手取り（例）
    const name  = stmt?.employee_name;

    return(
        <div>
            <h1>給料一覧</h1>
            <form onSubmit={getSalary}>
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
            {stmt ? (
                <div style={{ border: "1px solid #ddd", padding: 12, borderRadius: 8 }}>
                <div><strong>氏名</strong>: {name ?? "—"}</div>
                <div><strong>年月</strong>: {year}年 {month}月</div>
                <div><strong>総支給</strong>: {gross != null ? gross.toLocaleString() : "—"}</div>
                <div><strong>手取り</strong>: {net != null ? net.toLocaleString() : "—"}</div>
                </div>
            ) : data ? (
                <pre
                style={{
                    background: "#f7f7f7",
                    padding: 12,
                    borderRadius: 8,
                    overflowX: "auto",
                    marginTop: 8,
                }}
                >
        {JSON.stringify(data, null, 2)}
                </pre>
            ) : null}
        </div>
    )
}