"use client";
import { useSearchParams,useRouter } from "next/navigation";
import styles from "./layout.module.css"

export default function RootLayout({ children }) {
  const router=useRouter();
  const params = useSearchParams();
  const id=params.get("id");
  
  const toStamp=()=>{
    router.push(`./stamping?id=${encodeURIComponent(id)}`)
  }

  const toStampHistory=()=>{
    router.push(`./stampHistory?id=${encodeURIComponent(id)}`)
  }

  const toDisplaySalary=()=>{
    router.push(`./displaySalary?id=${encodeURIComponent(id)}`)
  }

  const toDisplayShift=()=>{
    router.push(`./displayShift?id=${encodeURIComponent(id)}`)
  }

  return (
   <>
    <header className={styles.header}>
      <div className={styles.left}></div>
      <div className={styles.right}>
        <p onClick={toStamp}>打刻</p>
        <p onClick={toStampHistory}>打刻履歴</p>
        <p onClick={toDisplayShift}>シフト表</p>
        <p onClick={toDisplaySalary}>給料一覧</p>
      </div>
    </header>
    {children}
   </>
  );
}