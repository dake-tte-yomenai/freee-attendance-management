import { signInWithEmailAndPassword } from "firebase/auth";
import { auth } from "../../lib/firebase";
import { idToEmail } from "../idToEmail/idToEmail";

export async function loginWithIdPassword(id,password){
    const email=idToEmail(id);
    try{
        const {user}=await signInWithEmailAndPassword(auth,email,password);
        return user;
    }catch(e){
        throw new Error("IDまたはpasswordが違います");
    }
}