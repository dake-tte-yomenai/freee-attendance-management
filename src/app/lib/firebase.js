// app/lib/firebase.js
import { initializeApp, getApps, getApp } from "firebase/app";
import { getAuth, setPersistence, browserLocalPersistence } from "firebase/auth";

const cfg = {
  apiKey: process.env.NEXT_PUBLIC_FB_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FB_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FB_PROJECT_ID,
  appId: process.env.NEXT_PUBLIC_FB_APP_ID,
};

// 開発時は欠落を即座に気づけるように
if (process.env.NODE_ENV !== 'production') {
  const missing = Object.entries(cfg).filter(([,v]) => !v).map(([k]) => k);
  if (missing.length) {
    throw new Error(`Firebase env 未設定: ${missing.join(', ')}`);
  }
}

const app = getApps().length ? getApp() : initializeApp(cfg);
export const auth = getAuth(app);
setPersistence(auth, browserLocalPersistence);
