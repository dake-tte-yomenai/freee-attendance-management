export const runtime = 'nodejs';
import { NextResponse } from "next/server";
import { refreshOncePerBurst } from '../../../server/freee/refreshGate.js';

export async function POST(req){
    const {searchParams}=new URL(req.url);
    const employee_id=searchParams.get("id");
    
    const { type,base_date, datetime } = await req.json();

    const at = await refreshOncePerBurst();

    const url=`https://api.freee.co.jp/hr/api/v1/employees/${employee_id}/time_clocks`;

    try{
        const res=await fetch(url,{
            method: "POST",
            headers:{
                Authorization: `Bearer ${at}`,
                Accept: "application/json",
                "Content-Type": "application/json",
            },
            body:JSON.stringify({
                company_id:`${process.env.COMPANY_ID}`,
                type:type,
                base_date:base_date,
                datetime:datetime,
            }),
        });

        const data=await res.json();
        return NextResponse.json(data);
    }catch(e){
        return NextResponse.json({error:e.message},{status:500})
    }
}