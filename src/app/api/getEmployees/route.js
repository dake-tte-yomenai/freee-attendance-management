export const runtime = 'nodejs';
import { NextResponse } from "next/server";
import { getAccessToken } from "../../(server)/getAccessToken.js";

export async function GET(){
    try {
        const at = await getAccessToken();
        const url = `https://api.freee.co.jp/hr/api/v1/companies/${process.env.COMPANY_ID}/employees?limit=50&with_no_payroll_calculation=true`;
        const res = await fetch(url, {
            headers: {
                Authorization: `Bearer ${at}`,
                Accept: "application/json",
            },
            cache: 'no-store',
        });
        if (!res.ok) {
            const text=await res.text();
            return NextResponse.json(
                {error:true,message:text},
                {status:res.status}
            );
        }
        const data = await res.json(); 
        return NextResponse.json(data || []);
    } catch (e) {
        console.error(e);
        return NextResponse.json(
            {error:true,message:"インターネットサーバーエラー"},
            {status:500}
        );
    }
}