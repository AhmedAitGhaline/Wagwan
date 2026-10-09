import { createClient } from 'npm:@supabase/supabase-js@2';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SERVICE_ROLE = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const META_TOKEN = Deno.env.get('WHATSAPP_ACCESS_TOKEN')!;
const PHONE_NUMBER_ID = Deno.env.get('WHATSAPP_PHONE_NUMBER_ID')!;
const TEMPLATE = Deno.env.get('WHATSAPP_ORDER_TEMPLATE') || 'wagwan_order_confirmation';
const TEMPLATE_LANGUAGE = Deno.env.get('WHATSAPP_ORDER_TEMPLATE_LANGUAGE') || 'fr';
const WEBHOOK_SECRET = Deno.env.get('WAGWAN_INTERNAL_WEBHOOK_SECRET') || '';
const GRAPH_VERSION = Deno.env.get('WHATSAPP_GRAPH_VERSION') || 'v23.0';

const admin = createClient(SUPABASE_URL, SERVICE_ROLE);

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json' } });
}

function cleanPhone(v: string) {
  return String(v || '').replace(/\D/g, '');
}

async function sendTemplate(to: string, bodyParams: string[]) {
  const url = `https://graph.facebook.com/${GRAPH_VERSION}/${PHONE_NUMBER_ID}/messages`;
  const res = await fetch(url, {
    method: 'POST',
    headers: { Authorization: `Bearer ${META_TOKEN}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      messaging_product: 'whatsapp',
      to: cleanPhone(to),
      type: 'template',
      template: {
        name: TEMPLATE,
        language: { code: TEMPLATE_LANGUAGE },
        components: [{ type: 'body', parameters: bodyParams.map(text => ({ type: 'text', text: String(text) })) }],
      },
    }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(`WhatsApp send failed: ${JSON.stringify(data)}`);
  return data;
}

Deno.serve(async (req) => {
  if (req.method !== 'POST') return json({ error: 'POST only' }, 405);
  if (WEBHOOK_SECRET && req.headers.get('x-wagwan-webhook-secret') !== WEBHOOK_SECRET) return json({ error: 'Forbidden' }, 403);

  try {
    const payload = await req.json();
    const orderId = payload?.record?.id || payload?.order_id || payload?.id;
    if (!orderId) return json({ error: 'Missing order id' }, 400);

    const { data: order, error: orderError } = await admin
      .from('orders')
      .select('*,order_items(*)')
      .eq('id', orderId)
      .single();
    if (orderError) throw orderError;
    if (order.status !== 'pending') return json({ ok: true, skipped: 'order-not-pending' });

    const { data: existing } = await admin
      .from('whatsapp_order_confirmations')
      .select('*')
      .eq('order_id', order.id)
      .maybeSingle();

    if (existing?.sent_at || existing?.status === 'confirmed' || existing?.status === 'cancelled') {
      return json({ ok: true, skipped: 'already-sent-or-closed' });
    }

    await admin.from('whatsapp_order_confirmations').upsert({
      order_id: order.id,
      customer_phone: cleanPhone(order.phone),
      status: 'sending',
      updated_at: new Date().toISOString(),
    }, { onConflict: 'order_id' });

    const result = await sendTemplate(cleanPhone(order.phone), [
      `${order.first_name} ${order.last_name}`.trim(),
      `WG-${String(order.order_number).padStart(4, '0')}`,
      String(order.total),
      order.city,
    ]);

    const messageId = result?.messages?.[0]?.id || null;
    await admin.from('whatsapp_order_confirmations').update({
      status: 'sent',
      sent_at: new Date().toISOString(),
      message_id: messageId,
      error_message: null,
      updated_at: new Date().toISOString(),
    }).eq('order_id', order.id);

    return json({ ok: true, order_id: order.id, message_id: messageId });
  } catch (error) {
    console.error(error);
    try {
      const payload = await req.clone().json();
      const orderId = payload?.record?.id || payload?.order_id || payload?.id;
      if (orderId) await admin.from('whatsapp_order_confirmations').update({ status: 'failed', error_message: String(error), updated_at: new Date().toISOString() }).eq('order_id', orderId);
    } catch (_) {}
    return json({ ok: false, error: String(error) }, 500);
  }
});
