// app/(pages)/layout.jsx  ← サーバー（"use client" なし）
import { Suspense } from "react";
import styles from "./layout.module.css";
import HeaderClient from "./HeaderClient";

export const dynamic = "force-dynamic"; // セグメント全体を動的化（SSG回避）

export default function RootLayout({ children }) {
  return (
    <>
      <Suspense fallback={<header className={styles.header}><div className={styles.left}></div><div className={styles.right}>…</div></header>}>
        <HeaderClient />
      </Suspense>

      <Suspense fallback={<p>読み込み中…</p>}>
        {children}
      </Suspense>
    </>
  );
}
