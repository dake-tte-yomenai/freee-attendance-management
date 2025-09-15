"use client";
import { useMemo,useState } from "react";
import { useSearchParams,useRouter } from "next/navigation"
import { changeNotationTime } from "../../utils/changeNotationTime/changeNotationTime";
import { onAuthStateChanged } from "firebase/auth";
import { auth } from "../../lib/firebase";
import { emailToId } from "../../utils/idToEmail/idToEmail";

export default function EditStamp(){
    const sp=useSearchParams();
    const [id,setId]=useState(sp.get('id'));
    const data=sp.get("data");

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

    const row = useMemo(() => {
        try {
            return data ? JSON.parse(data) : null; // ← パース
        } catch {
            return null;
        }
    }, [data]);

    const [clockIn,setClockIn]=useState(row?.clock_in);
    const [breakBegin,setBreakBegin]=useState(row?.break_begin);
    const [breakEnd,setBreakEnd]=useState(row?.break_end);
    const [clockOut,setClockOut]=useState(row?.clock_out);

    const editStamp=async(e)=>{
        e.preventDefault();
        const newClockIn=`${row?.date} ${changeNotationTime(clockIn)}`;
        const newBreakBegin=`${row?.date} ${changeNotationTime(breakBegin)}`;
        const newBreakEnd=`${row?.date} ${changeNotationTime(breakEnd)}`;
        const newClockOut=`${row?.date} ${changeNotationTime(clockOut)}`;

        try{
            const res=await fetch(`/api/putEditStamp?id=${encodeURIComponent(id)}&date=${encodeURIComponent(row?.date)}`, {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({newClockIn:newClockIn,newBreakBegin:newBreakBegin,newBreakEnd:newBreakEnd,newClockOut:newClockOut}),
            });

            if(!res.ok){
                const err = await res.json().catch(() => ({}));
                throw new Error(err.message || "更新に失敗しました。");
            }
        }catch(e){
            console.error(e);
        }
    }

    return(
        <>
            <h1>編集画面</h1>
            <div>{row?.date}の勤怠を修正します</div>
            <form onSubmit={editStamp}>
                <input type="time" value={clockIn} onChange={(e)=>setClockIn(e.target.value)}/>
                <input type="time" value={breakBegin} onChange={(e)=>setBreakBegin(e.target.value)}/>
                <input type="time" value={breakEnd} onChange={(e)=>setBreakEnd(e.target.value)}/>
                <input type="time" value={clockOut} onChange={(e)=>setClockOut(e.target.value)}/>
                <button type="submit">更新</button>
            </form>
        </>
    )
}