"use client";
import { useState } from "react";
import {useRouter} from "next/navigation";
import styles from "./page.module.css";
import { loginWithIdPassword } from "./utils/login/login";

export default function LoginForm(){
  const [id,setId]=useState("");
  const [password,setPassword]=useState("");
  const [err,setErr]=useState(null);
  const router=useRouter();

  const doLogin=async(e)=>{
    e.preventDefault();
    try{
      await loginWithIdPassword(id,password);
      router.push(`./stamping?id=${encodeURIComponent(id)}`)
    }catch(e){
      setErr(e.message);
    }
  }

  return(
    <div>
      <form onSubmit={doLogin}>
        <input
         type="text"
         value={id}
         placeholder="ID"
         onChange={(e)=>setId(e.target.value)}
        />
        <br/>
        <input
          type="password"
          placeholder="パスワード"
          value={password}
          onChange={(e)=>setPassword(e.target.value)}
        />
        <br/>
        <button type="submit">ログイン</button>
        {err && <p>{err}</p>}
      </form>
    </div>
  )
}