import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
const url = Deno.env.get('SUPABASE_URL')!;
const key = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const db = createClient(url, key);
const cors = {'Access-Control-Allow-Origin':'*','Access-Control-Allow-Headers':'content-type,apikey,authorization','Access-Control-Allow-Methods':'POST,OPTIONS','Content-Type':'application/json'};
const json=(body:unknown,status=200)=>new Response(JSON.stringify(body),{status,headers:cors});
const digits=(v:string)=>String(v||'').replace(/\D/g,'').replace(/^0/,'212');
Deno.serve(async req=>{
 if(req.method==='OPTIONS')return new Response('ok',{headers:cors});
 if(req.method!=='POST')return json({ok:false,message:'POST only'},405);
 try{
  const body=await req.json();const code=String(body.order_code||'').trim().replace(/^WG-/i,'').replace(/^0+/,'');const phone=digits(String(body.phone||''));
  if(!code||phone.length<11)return json({ok:false,message:'Invalid details'},400);
  const numeric=Number(code.replace(/\D/g,''));if(!Number.isFinite(numeric)||numeric<=0)return json({ok:false,message:'Order not found'},404);
  const {data:order,error}=await db.from('orders').select('id,order_number,phone,status,updated_at,created_at').eq('order_number',numeric).maybeSingle();
  if(error)throw error;if(!order||digits(order.phone)!==phone)return json({ok:false,message:'Order not found'},404);
  const {data:ship}=await db.from('delivery_shipments').select('sendit_status,internal_status,sendit_code,label_url,updated_at').eq('order_id',order.id).maybeSingle();
  const status=ship?.internal_status||String(order.status);
  return json({ok:true,order_code:`WG-${String(order.order_number).padStart(4,'0')}`,status,updated_at:ship?.updated_at||order.updated_at||order.created_at,tracking_url:ship?.label_url||null});
 }catch(e){console.error(e);return json({ok:false,message:'Tracking temporarily unavailable'},500)}
});
