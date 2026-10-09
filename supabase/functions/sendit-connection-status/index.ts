const SENDIT_BASE = (Deno.env.get("SENDIT_BASE_URL") || "https://app.sendit.ma/api/v1").replace(/\/$/, "");
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const SENDIT_PUBLIC_KEY = Deno.env.get("SENDIT_PUBLIC_KEY") || "";
const SENDIT_SECRET_KEY = Deno.env.get("SENDIT_SECRET_KEY") || "";

function cors(extra: Record<string,string> = {}) {
  return {"Access-Control-Allow-Origin":"*","Access-Control-Allow-Headers":"authorization, x-client-info, apikey, content-type","Access-Control-Allow-Methods":"POST,OPTIONS",...extra};
}
function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {status, headers:{...cors(),"Content-Type":"application/json","Cache-Control":"no-store"}});
}
async function requireAdmin(req: Request) {
  const auth = req.headers.get("Authorization") || "";
  if (!auth.startsWith("Bearer ")) throw Object.assign(new Error("Admin authentication required"), {status:401});
  const { createClient } = await import("https://esm.sh/@supabase/supabase-js@2");
  const admin = createClient(SUPABASE_URL, SERVICE_ROLE);
  const {data:{user},error:userError} = await admin.auth.getUser(auth.slice(7));
  if (userError || !user) throw Object.assign(new Error("Admin authentication required"), {status:401});
  const {data:profile,error:profileError} = await admin.from("profiles").select("role").eq("id",user.id).single();
  if (profileError || profile?.role !== "admin") throw Object.assign(new Error("Administrator access required"), {status:403});
}
Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", {headers:cors()});
  if (req.method !== "POST") return json({connected:false, category:"request", message:"POST required"},405);
  try { await requireAdmin(req); }
  catch (e) { const status = Number((e as {status?:number})?.status) || 401; return json({connected:false,category:"admin_auth",message:status===403?"Administrator access required":"Admin authentication required"},status); }
  if (!SENDIT_PUBLIC_KEY || !SENDIT_SECRET_KEY) return json({connected:false,category:"configuration",message:"Sendit credentials are not configured"});

  const timeout = () => AbortSignal.timeout(8000);
  let loginResponse: Response;
  try {
    loginResponse = await fetch(`${SENDIT_BASE}/login`, {
      method:"POST", headers:{"Content-Type":"application/json","Accept":"application/json"},
      body:JSON.stringify({public_key:SENDIT_PUBLIC_KEY,secret_key:SENDIT_SECRET_KEY}), signal:timeout()
    });
  } catch (e) {
    const timedOut = e instanceof DOMException && e.name === "TimeoutError";
    return json({connected:false,category:timedOut?"timeout":"network",message:timedOut?"Sendit login timed out":"Sendit login endpoint is unreachable"});
  }
  const login = await loginResponse.json().catch(()=>({}));
  const token = login?.data?.token;
  if (!loginResponse.ok || !token) {
    const status = loginResponse.status;
    const authFailure = [401,403].includes(status) || /unauthori[sz]ed|invalid.*(key|credential)|forbidden|authentication/i.test(String(login?.message||""));
    return json({connected:false,category:authFailure?"authentication":status>=500?"service":"api_error",message:authFailure?"Sendit credentials were rejected":`Sendit login failed (HTTP ${status})`});
  }

  // Safe, read-only request: confirms that the issued token can access Sendit's districts API.
  let checkResponse: Response;
  try {
    checkResponse = await fetch(`${SENDIT_BASE}/districts?page=1`, {method:"GET",headers:{"Authorization":`Bearer ${token}`,"Accept":"application/json"},signal:timeout()});
  } catch (e) {
    const timedOut = e instanceof DOMException && e.name === "TimeoutError";
    return json({connected:false,category:timedOut?"timeout":"network",message:timedOut?"Sendit verification timed out":"Sendit verification endpoint is unreachable"});
  }
  const check = await checkResponse.json().catch(()=>({}));
  if (!checkResponse.ok || check?.success === false || (!check || typeof check !== "object") || (check.data == null && check.success !== true)) {
    const status = checkResponse.status;
    const authFailure = [401,403].includes(status);
    return json({connected:false,category:authFailure?"authentication":status>=500?"service":"api_error",message:authFailure?"Sendit rejected the access token":`Sendit read-only verification failed (HTTP ${status})`});
  }
  return json({connected:true,category:"connected",message:"Sendit API authenticated and read-only endpoint responded",checked_at:new Date().toISOString()});
});
