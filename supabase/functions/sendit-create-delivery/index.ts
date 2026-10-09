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





Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", {headers:cors()});
  try {
    const {admin} = await adminUser(req);
    const body = await req.json();
    const orderId = String(body.order_id || "");
    const districtId = Number(body.district_id);
    const pickupDistrictId = Number(body.pickup_district_id);
    const packagingId = Number(body.packaging_id);
    const allowOpen = body.allow_open !== false;
    const allowTry = body.allow_try !== false;
    const comment = String(body.comment || "").trim();
    if (!orderId || !Number.isInteger(districtId) || !Number.isInteger(pickupDistrictId) || !Number.isInteger(packagingId)) {
      return new Response(JSON.stringify({error:"order_id, district_id, pickup_district_id and packaging_id are required"}), {status:400,headers:{...cors(),"Content-Type":"application/json"}});
    }

    const {data:existing} = await admin.from("delivery_shipments").select("*").eq("order_id",orderId).maybeSingle();
    if (existing) return new Response(JSON.stringify({success:true,existing:true,shipment:existing}), {headers:{...cors(),"Content-Type":"application/json"}});

    const {data:order,error:orderError} = await admin.from("orders").select("*,order_items(*)").eq("id",orderId).single();
    if (orderError || !order) throw new Error("Order not found");
    if (!['confirmed','delivered'].includes(order.status)) throw new Error("The order must be confirmed before creating a Sendit shipment");

    const name = `${order.first_name || ""} ${order.last_name || ""}`.trim();
    const reference = `WG-${String(order.order_number).padStart(4,"0")}`;
    const payload = {
      pickup_district_id: pickupDistrictId,
      district_id: districtId,
      name,
      amount: Number(order.total),
      address: order.address,
      phone: order.phone,
      comment: comment || reference,
      reference,
      allow_open: allowOpen ? 1 : 0,
      allow_try: allowTry ? 1 : 0,
      products_from_stock: 0,
      products: "",
      packaging_id: packagingId,
      option_exchange: 0,
      delivery_exchange_id: ""
    };

    const response = await senditFetch("/deliveries", {method:"POST",body:JSON.stringify(payload),headers:{"Content-Type":"application/json"}});
    const d = response?.data;
    if (!d?.code) throw new Error("Sendit did not return a delivery code");

    const {data:shipment,error:insertError} = await admin.from("delivery_shipments").insert({
      order_id:order.id,
      sendit_code:d.code,
      sendit_reference:d.reference || reference,
      sendit_status:d.status || "PENDING",
      internal_status:"created",
      district_id:districtId,
      pickup_district_id:pickupDistrictId,
      packaging_id:packagingId,
      allow_open:allowOpen,
      allow_try:allowTry,
      sendit_fee:d.fee == null ? null : Number(d.fee),
      label_url:d.labelUrl || null,
      last_action_at_text:d.last_action_at || null,
      raw_last_payload:d
    }).select("*").single();
    if (insertError) {
      // Do not hide a successfully created Sendit parcel.
      throw new Error(`Sendit shipment created (${d.code}) but local save failed: ${insertError.message}`);
    }
    return new Response(JSON.stringify({success:true,shipment}), {headers:{...cors(),"Content-Type":"application/json"}});
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    const status = /Unauthorized/i.test(msg) ? 401 : /Forbidden/i.test(msg) ? 403 : 400;
    return new Response(JSON.stringify({error:msg}), {status,headers:{...cors(),"Content-Type":"application/json"}});
  }
});
