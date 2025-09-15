// app/(pages)/HeaderClient.jsx  ← クライアント
"use client";
import { useRouter, useSearchParams } from "next/navigation";
import styles from "./layout.module.css";

export default function HeaderClient() {
  const router = useRouter();
  const params = useSearchParams();
  const id = params.get("id") ?? "";

  const go = (path) => router.push(`${path}?id=${encodeURIComponent(id)}`);

  return (
    <header className={styles.header}>
      <div className={styles.left}></div>
      <div className={styles.right}>
        <p onClick={() => go("/stamping")}>打刻</p>
        <p onClick={() => go("/stampHistory")}>打刻履歴</p>
        <p onClick={() => go("/displayShift")}>シフト表</p>
        <p onClick={() => go("/displaySalary")}>給料一覧</p>
      </div>
    </header>
  );
}
