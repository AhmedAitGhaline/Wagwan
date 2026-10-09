import { createClient } from 'npm:@supabase/supabase-js@2';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SERVICE_ROLE = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const VERIFY_TOKEN = Deno.env.get('WHATSAPP_VERIFY_TOKEN') || '';
const META_TOKEN = Deno.env.get('WHATSAPP_ACCESS_TOKEN') || '';
const PHONE_NUMBER_ID = Deno.env.get('WHATSAPP_PHONE_NUMBER_ID') || '';
const ADMIN_PHONE = Deno.env.get('WAGWAN_ADMIN_WHATSAPP') || '212783509122';
const ADMIN_CONFIRMED_TEMPLATE = Deno.env.get('WHATSAPP_ADMIN_CONFIRMED_TEMPLATE') || 'wagwan_admin_order_confirmed';
const ADMIN_CANCELLED_TEMPLATE = Deno.env.get('WHATSAPP_ADMIN_CANCELLED_TEMPLATE') || 'wagwan_admin_order_cancelled';
const ADMIN_TEMPLATE_LANGUAGE = Deno.env.get('WHATSAPP_ADMIN_TEMPLATE_LANGUAGE') || 'fr';
const GRAPH_VERSION = Deno.env.get('WHATSAPP_GRAPH_VERSION') || 'v23.0';
const admin = createClient(SUPABASE_URL, SERVICE_ROLE);

function json(data: unknown, status = 200) { return new Response(JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json' } }); }
function normalize(v: string) { return String(v || '').replace(/\D/g, ''); }
function getAction(message: any) {
  const id = String(message?.interactive?.button_reply?.id || '').toLowerCase();
  const title = String(message?.interactive?.button_reply?.title || '').toUpperCase().replace(/[’']/g, "'").trim();
  const text = String(message?.text?.body || '').toUpperCase().replace(/[’']/g, "'").trim();
  if (id.includes('confirm') || title === 'JE CONFIRME' || text === 'JE CONFIRME') return 'confirmed';
  if (id.includes('cancel') || title === "J'ANNULE" || text === "J'ANNULE") return 'cancelled';
  return null;
}
function details(items: any[]) { return (items || []).map(i => `${i.product_name} — Taille ${i.size} × ${i.quantity}`).join(' | '); }
async function sendAdminTemplate(name: string, params: string[]) {
  const res = await fetch(`https://graph.facebook.com/${GRAPH_VERSION}/${PHONE_NUMBER_ID}/messages`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${META_TOKEN}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ messaging_product: 'whatsapp', to: normalize(ADMIN_PHONE), type: 'template', template: { name, language: { code: ADMIN_TEMPLATE_LANGUAGE }, components: [{ type: 'body', parameters: params.map(text => ({ type: 'text', text: String(text) })) }] } }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(`Admin WhatsApp failed: ${JSON.stringify(data)}`);
  return data;
}

async function processMessage(message: any) {
  const action = getAction(message);
  if (!action) return { ignored: true };
  const from = normalize(message?.from);
  if (!from) return { ignored: true };

  const { data: confirmations, error } = await admin
    .from('whatsapp_order_confirmations')
    .select('*,orders(*,order_items(*))')
    .eq('customer_phone', from)
    .eq('status', 'sent')
    .order('sent_at', { ascending: false })
    .limit(1);
  if (error) throw error;
  const confirmation = confirmations?.[0];
  const order = confirmation?.orders;
  if (!confirmation || !order || order.status !== 'pending') return { ignored: true, reason: 'no-active-order' };

  const { data: result, error: transitionError } = await admin.rpc('handle_whatsapp_order_response', {
    p_order_id: order.id,
    p_action: action,
  });
  if (transitionError) throw transitionError;
  const updated = result?.order || {};
  const orderLabel = `WG-${String(updated.order_number || order.order_number).padStart(4, '0')}`;
  const clientName = `${updated.first_name || order.first_name} ${updated.last_name || order.last_name}`.trim();
  const itemDetails = details(order.order_items);

  if (action === 'confirmed') {
    await sendAdminTemplate(ADMIN_CONFIRMED_TEMPLATE, [clientName, orderLabel, itemDetails, updated.city || order.city, String(updated.total ?? order.total)]);
  } else {
    await sendAdminTemplate(ADMIN_CANCELLED_TEMPLATE, [clientName, orderLabel, itemDetails]);
  }

  return { ok: true, action, order: orderLabel };
}

Deno.serve(async (req) => {
  if (req.method === 'GET') {
    const url = new URL(req.url);
    if (url.searchParams.get('hub.mode') === 'subscribe' && url.searchParams.get('hub.verify_token') === VERIFY_TOKEN) return new Response(url.searchParams.get('hub.challenge') || '', { status: 200 });
    return new Response('Forbidden', { status: 403 });
  }
  if (req.method !== 'POST') return new Response('Method Not Allowed', { status: 405 });
  try {
    const body = await req.json();
    console.log('WhatsApp webhook received:', JSON.stringify(body));
    for (const entry of body.entry || []) for (const change of entry.changes || []) for (const message of change.value?.messages || []) {
      await processMessage(message);
    }
    return json({ success: true });
  } catch (error) {
    console.error('Webhook error:', error);
    return json({ success: false, error: 'Webhook processing failed' }, 200);
  }
});
