const SENDIT_BASE = (Deno.env.get("SENDIT_BASE_URL") || "https://app.sendit.ma/api/v1").replace(/\\/$/, "");
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const SENDIT_PUBLIC_KEY = Deno.env.get("SENDIT_PUBLIC_KEY")!;
const SENDIT_SECRET_KEY = Deno.env.get("SENDIT_SECRET_KEY")!;

function cors(extra: Record<string,string> = {}) {
  return {"Access-Control-Allow-Origin":"*","Access-Control-Allow-Headers":"authorization, x-client-info, apikey, content-type","Access-Control-Allow-Methods":"POST,GET,OPTIONS",...extra};
}

async function senditToken() {
  if (!SENDIT_PUBLIC_KEY || !SENDIT_SECRET_KEY) throw new Error("Sendit API secrets are not configured");
  const r = await fetch(`${SENDIT_BASE}/login`, {method:"POST", headers:{"Content-Type":"application/json","Accept":"application/json"}, body:JSON.stringify({public_key:SENDIT_PUBLIC_KEY, secret_key:SENDIT_SECRET_KEY})});
  const j = await r.json().catch(()=>({}));
  if (!r.ok || !j?.data?.token) throw new Error(`Sendit login failed (${r.status})`);
  return j.data.token as string;
}

async function senditFetch(path:string, init:RequestInit={}) {
  const token = await senditToken();
  const headers = new Headers(init.headers || {});
  headers.set("Authorization", `Bearer ${token}`);
  headers.set("Accept", "application/json");
  if (init.body && !headers.has("Content-Type")) headers.set("Content-Type","application/json");
  const r = await fetch(`${SENDIT_BASE}${path}`, {...init, headers});
  const j = await r.json().catch(()=>({}));
  if (!r.ok || j?.success === false) throw new Error(j?.message || `Sendit request failed (${r.status})`);
  return j;
}

async function adminUser(req:Request) {
  const auth = req.headers.get("Authorization") || "";
  if (!auth.startsWith("Bearer ")) throw new Error("Unauthorized");
  const token = auth.slice(7);
  const { createClient } = await import("https://esm.sh/@supabase/supabase-js@2");
  const admin = createClient(SUPABASE_URL, SERVICE_ROLE);
  const {data:{user},error:userError} = await admin.auth.getUser(token);
  if (userError || !user) throw new Error("Unauthorized");
  const {data:profile,error:profileError} = await admin.from("profiles").select("role").eq("id",user.id).single();
  if (profileError || profile?.role !== "admin") throw new Error("Forbidden");
  return {admin,user};
}




Deno.serve(async (req)=>{
  if(req.method==="OPTIONS") return new Response("ok",{headers:cors()});
  try{await adminUser(req);const u=new URL(req.url);const q=(u.searchParams.get("query")||"").trim();const p=new URLSearchParams({page:"1"});if(q)p.set("querystring",q);const j=await senditFetch(`/packagings?${p.toString()}`);return new Response(JSON.stringify(j),{headers:{...cors(),"Content-Type":"application/json"}})}catch(e){const msg=e instanceof Error?e.message:String(e);const status=/Unauthorized/i.test(msg)?401:/Forbidden/i.test(msg)?403:400;return new Response(JSON.stringify({error:msg}),{status,headers:{...cors(),"Content-Type":"application/json"}})}});
