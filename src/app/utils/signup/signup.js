// app/utils/signup/signup.js
import { createUserWithEmailAndPassword, updateProfile } from "firebase/auth";
import { auth } from "../../lib/firebase";
import { idToEmail } from "../idToEmail/idToEmail";

export async function signUpWithIdPassword(id, password) {
  const email = idToEmail(id); // "＜ID＞@id.login"
  try {
    const cred = await createUserWithEmailAndPassword(auth, email, password);
    try { await updateProfile(cred.user, { displayName: String(id) }); } catch {}
    return cred.user;
  } catch (e) {
    const code = e?.code || "";
    if (code.includes("email-already-in-use")) throw new Error("このIDは登録済みです");
    if (code.includes("weak-password"))       throw new Error("パスワードは6文字以上にしてください");
    throw new Error("サインアップに失敗しました");
  }
}
