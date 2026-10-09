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





function mapStatus(s: string) {
  switch (s) {
    case "PICKEDUP": return "picked_up";
    case "TRANSIT": return "in_transit";
    case "WAREHOUSE": return "warehouse";
    case "DISTRIBUTED": return "distributed";
    case "DELIVERING": return "delivering";
    case "DELIVERED": return "delivered";
    case "CANCELED":
    case "REJECTED":
    case "UNREACHABLE":
    case "POSTPONED": return "exception";
    default: return "created";
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors() });

  try {
    const { admin } = await adminUser(req);
    const { data: shipments, error } = await admin
      .from("delivery_shipments")
      .select("*")
      .not("sendit_code", "is", null)
      .order("created_at", { ascending: false });

    if (error) throw error;

    let refreshed = 0;
    let failed = 0;
    const errors: Array<{ code: string; error: string }> = [];

    for (const shipment of shipments || []) {
      const code = String(shipment.sendit_code || "").trim();
      if (!code) continue;

      try {
        const response = await senditFetch(`/deliveries/${encodeURIComponent(code)}`);
        const d = response?.data;
        if (!d) throw new Error("Invalid Sendit response");

        const nextStatus = String(d.status || shipment.sendit_status || "PENDING");
        const changed = nextStatus !== shipment.sendit_status;
        const patch: Record<string, unknown> = {
          sendit_status: nextStatus,
          internal_status: mapStatus(nextStatus),
          sendit_fee: d.fee == null ? shipment.sendit_fee : Number(d.fee),
          label_url: d.labelUrl || shipment.label_url,
          last_action_at_text: d.last_action_at || shipment.last_action_at_text,
          raw_last_payload: d,
          proof_image_url: d.proofImage || shipment.proof_image_url,
          deliver_by: d.deliverBy || shipment.deliver_by,
          counter_unreachable: d.counterUnreachable == null
            ? shipment.counter_unreachable
            : Number(d.counterUnreachable),
          updated_at: new Date().toISOString(),
        };

        if (nextStatus === "PICKEDUP" && !shipment.picked_up_at) patch.picked_up_at = new Date().toISOString();
        if (nextStatus === "DELIVERED" && !shipment.delivered_at) patch.delivered_at = new Date().toISOString();
        if (nextStatus === "CANCELED" && !shipment.canceled_at) patch.canceled_at = new Date().toISOString();

        const { error: updateError } = await admin
          .from("delivery_shipments")
          .update(patch)
          .eq("id", shipment.id);
        if (updateError) throw updateError;

        if (changed) {
          await admin.from("delivery_tracking_events").insert({
            shipment_id: shipment.id,
            sendit_code: code,
            old_status: shipment.sendit_status,
            new_status: nextStatus,
            last_action_at_text: d.last_action_at || null,
            message: d.message || null,
            proof_image_url: d.proofImage || null,
            deliver_by: d.deliverBy || null,
            counter_unreachable: d.counterUnreachable == null ? null : Number(d.counterUnreachable),
            raw_payload: d,
          });
        }

        if (nextStatus === "DELIVERED") {
          await admin.from("orders")
            .update({ status: "delivered", delivered_at: new Date().toISOString() })
            .eq("id", shipment.order_id);
        }

        refreshed++;
      } catch (e) {
        failed++;
        errors.push({ code, error: e instanceof Error ? e.message : String(e) });
      }
    }

    return new Response(JSON.stringify({ success: true, total: shipments?.length || 0, refreshed, failed, errors }), {
      headers: { ...cors(), "Content-Type": "application/json" },
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    const status = /Unauthorized/i.test(msg) ? 401 : /Forbidden/i.test(msg) ? 403 : 400;
    return new Response(JSON.stringify({ error: msg }), {
      status,
      headers: { ...cors(), "Content-Type": "application/json" },
    });
  }
});
