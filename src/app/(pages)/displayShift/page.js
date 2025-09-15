// app/displayShift/page.js（サーバー）
import { Suspense } from "react";
import DisplayShift from './DisplayShift';

export default function Page() {
  
  return (
    <Suspense fallback={<p>読み込み中・・・</p>}>
      <DisplayShift />
    </Suspense>
  );
}
