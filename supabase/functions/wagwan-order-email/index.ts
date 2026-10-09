import { createClient } from 'npm:@supabase/supabase-js@2';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SERVICE_ROLE = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY')!;
const WEBHOOK_SECRET = Deno.env.get('WAGWAN_INTERNAL_WEBHOOK_SECRET') || '';
const RESEND_FROM = Deno.env.get('RESEND_FROM_EMAIL') || 'WAGWAN <onboarding@resend.dev>';

const admin = createClient(SUPABASE_URL, SERVICE_ROLE);

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

function escapeHtml(value: unknown) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

function money(value: unknown) {
  return `${Number(value || 0).toFixed(2).replace('.', ',')} DH`;
}

function formatDate(value: unknown) {
  const d = new Date(String(value || ''));
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
}

function getStoreUrl() {
  return Deno.env.get('WAGWAN_STORE_URL') || 'https://ahmedaitghaline.github.io/WAGWAN/';
}

async function sendEmail(to: string, order: any) {
  const orderNumber = `WG-${String(order.order_number).padStart(4, '0')}`;
  const customerName = `${order.first_name || ''} ${order.last_name || ''}`.trim();
  const storeUrl = getStoreUrl();
  const orderDate = formatDate(order.created_at);
  const shipping = Number(order.shipping ?? order.shipping_fee ?? 0);
  const subtotal = Number(order.subtotal || 0);
  const total = Number(order.total || subtotal + shipping);
  const items = (order.order_items || []).map((item: any) => {
    const image = String(item.product_image_url || '').trim();
    const imageCell = image
      ? `<img src="${escapeHtml(image)}" width="92" height="92" alt="${escapeHtml(item.product_name)}" style="display:block;width:92px;height:92px;object-fit:contain;border-radius:8px;background:#f5f5f3;border:0;">`
      : `<div style="width:92px;height:92px;border-radius:8px;background:#f5f5f3;"></div>`;

    return `
      <tr>
        <td style="padding:16px 0;border-bottom:1px solid #e5e7eb;vertical-align:middle;width:108px;">
          ${imageCell}
        </td>
        <td style="padding:16px 12px;border-bottom:1px solid #e5e7eb;vertical-align:middle;">
          <div style="font-size:15px;line-height:1.35;font-weight:700;letter-spacing:.1px;color:#111827;">${escapeHtml(item.product_name)}</div>
          <div style="font-size:13px;line-height:1.5;color:#7b8491;margin-top:5px;">Size: ${escapeHtml(item.size)} &nbsp;·&nbsp; Quantity: ${escapeHtml(item.quantity)}</div>
        </td>
        <td style="padding:16px 0;border-bottom:1px solid #e5e7eb;vertical-align:middle;text-align:right;white-space:nowrap;font-size:14px;font-weight:600;color:#111827;">${money(item.line_total)}</td>
      </tr>
    `;
  }).join('');

  const html = `
  <!doctype html>
  <html lang="en">
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width,initial-scale=1">
    <title>WAGWAN — ${escapeHtml(orderNumber)}</title>
  </head>
  <body style="margin:0;padding:0;background:#f5f5f3;color:#111827;font-family:Arial,Helvetica,sans-serif;-webkit-font-smoothing:antialiased;">
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background:#f5f5f3;">
      <tr>
        <td align="center" style="padding:28px 12px;">
          <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="max-width:680px;background:#ffffff;">
            <tr>
              <td style="padding:42px 42px 0;">
                <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0">
                  <tr>
                    <td align="center" style="font-size:30px;line-height:36px;font-weight:800;letter-spacing:9px;color:#0b0f14;padding:0 0 12px 9px;">WAGWAN</td>
                    <td align="right" valign="top" style="width:125px;font-size:11px;line-height:18px;color:#7b8491;white-space:nowrap;">
                      <span style="text-transform:uppercase;">ORDER ${escapeHtml(orderNumber)}</span><br>${escapeHtml(orderDate)}
                    </td>
                  </tr>
                </table>

                <div style="height:1px;background:#d9dde2;margin:30px 0 36px;"></div>

                <h1 style="margin:0;color:#111827;font-size:34px;line-height:40px;letter-spacing:-1.2px;font-weight:700;">Thank you for your order!</h1>
                <p style="margin:14px 0 24px;color:#7b8491;font-size:16px;line-height:25px;max-width:560px;">We've received your order and it's being prepared. You'll get another email when it's shipped.</p>

                <table role="presentation" cellspacing="0" cellpadding="0" border="0">
                  <tr>
                    <td style="border-radius:5px;background:#0b0f14;">
                      <a href="${escapeHtml(storeUrl)}" target="_blank" style="display:inline-block;padding:15px 25px;color:#ffffff;text-decoration:none;font-size:14px;font-weight:700;letter-spacing:.1px;">Visit our website&nbsp; →</a>
                    </td>
                  </tr>
                </table>

                <div style="height:1px;background:#d9dde2;margin:34px 0 26px;"></div>

                <h2 style="margin:0 0 14px;color:#111827;font-size:23px;line-height:29px;font-weight:700;">Order summary</h2>
                <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="border-collapse:collapse;">
                  ${items}
                </table>

                <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="margin-top:22px;">
                  <tr>
                    <td style="width:58%;"></td>
                    <td style="padding:7px 0;color:#7b8491;font-size:14px;">Subtotal</td>
                    <td align="right" style="padding:7px 0;color:#111827;font-size:14px;white-space:nowrap;">${money(subtotal)}</td>
                  </tr>
                  <tr>
                    <td></td>
                    <td style="padding:7px 0;color:#7b8491;font-size:14px;">Shipping</td>
                    <td align="right" style="padding:7px 0;color:#111827;font-size:14px;white-space:nowrap;">${money(shipping)}</td>
                  </tr>
                  <tr>
                    <td></td>
                    <td style="padding:7px 0;color:#7b8491;font-size:14px;">Taxes</td>
                    <td align="right" style="padding:7px 0;color:#111827;font-size:14px;white-space:nowrap;">0.00 DH</td>
                  </tr>
                  <tr><td colspan="3" style="height:14px;border-bottom:1px solid #d9dde2;"></td></tr>
                  <tr>
                    <td></td>
                    <td style="padding:18px 0 4px;color:#111827;font-size:19px;font-weight:700;">Total</td>
                    <td align="right" style="padding:14px 0 4px;color:#111827;font-size:27px;font-weight:800;white-space:nowrap;">${money(total)}</td>
                  </tr>
                </table>

                <div style="height:1px;background:#d9dde2;margin:28px 0 30px;"></div>

                <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0">
                  <tr>
                    <td width="50%" valign="top" style="padding:0 25px 26px 0;border-right:1px solid #e1e4e8;">
                      <div style="font-size:17px;font-weight:700;color:#111827;margin-bottom:9px;">Shipping address</div>
                      <div style="font-size:14px;line-height:22px;color:#687280;">${escapeHtml(customerName)}<br>${escapeHtml(order.address)}<br>${escapeHtml(order.city)}<br>Morocco<br>${escapeHtml(order.phone)}</div>
                    </td>
                    <td width="50%" valign="top" style="padding:0 0 26px 25px;">
                      <div style="font-size:17px;font-weight:700;color:#111827;margin-bottom:9px;">Billing address</div>
                      <div style="font-size:14px;line-height:22px;color:#687280;">${escapeHtml(customerName)}<br>${escapeHtml(order.address)}<br>${escapeHtml(order.city)}<br>Morocco<br>${escapeHtml(order.phone)}</div>
                    </td>
                  </tr>
                  <tr>
                    <td width="50%" valign="top" style="padding:23px 25px 0 0;border-right:1px solid #e1e4e8;border-top:1px solid #e1e4e8;">
                      <div style="font-size:17px;font-weight:700;color:#111827;margin-bottom:9px;">Payment method</div>
                      <div style="font-size:14px;color:#687280;line-height:22px;">Cash on Delivery (COD)</div>
                    </td>
                    <td width="50%" valign="top" style="padding:23px 0 0 25px;border-top:1px solid #e1e4e8;">
                      <div style="font-size:17px;font-weight:700;color:#111827;margin-bottom:9px;">Shipping method</div>
                      <div style="font-size:14px;color:#687280;line-height:22px;">Standard</div>
                    </td>
                  </tr>
                </table>

                <div style="height:1px;background:#d9dde2;margin:32px 0 28px;"></div>

                <div style="text-align:center;padding-bottom:36px;">
                  <div style="font-size:21px;font-weight:800;letter-spacing:7px;color:#111827;padding-left:7px;">WAGWAN</div>
                  <div style="margin-top:10px;font-size:13px;color:#8a929d;">Thank you for being part of the WAGWAN community.</div>
                </div>
              </td>
            </tr>
            <tr>
              <td style="padding:0 42px 34px;">
                <div style="height:1px;background:#e1e4e8;"></div>
                <div style="padding-top:20px;text-align:center;font-size:12px;line-height:20px;color:#9299a3;">If you have any questions, reply to this email or contact us through our website.<br>© 2026 WAGWAN. All rights reserved.</div>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
  </html>`;

  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${RESEND_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from: RESEND_FROM,
      to: [to],
      subject: `WAGWAN — Confirmation de commande ${orderNumber}`,
      html,
    }),
  });

  const data = await response.json();
  if (!response.ok) throw new Error(`Resend send failed: ${JSON.stringify(data)}`);
  return data;
}

Deno.serve(async (req) => {
  if (req.method !== 'POST') return json({ error: 'POST only' }, 405);
  if (WEBHOOK_SECRET && req.headers.get('x-wagwan-webhook-secret') !== WEBHOOK_SECRET) {
    return json({ error: 'Forbidden' }, 403);
  }

  let orderId: string | null = null;
  try {
    const payload = await req.json();
    orderId = payload?.record?.id || payload?.order_id || payload?.id || null;
    if (!orderId) return json({ error: 'Missing order id' }, 400);

    const { data: order, error: orderError } = await admin
      .from('orders')
      .select('*,order_items(*)')
      .eq('id', orderId)
      .single();

    if (orderError) throw orderError;
    if (!order.customer_email) return json({ ok: true, skipped: 'no-customer-email' });

    const { data: existing } = await admin
      .from('email_order_confirmations')
      .select('*')
      .eq('order_id', order.id)
      .maybeSingle();

    if (existing?.status === 'sent' || existing?.sent_at) {
      return json({ ok: true, skipped: 'already-sent' });
    }

    await admin.from('email_order_confirmations').upsert({
      order_id: order.id,
      customer_email: order.customer_email,
      status: 'sending',
      error_message: null,
      updated_at: new Date().toISOString(),
    }, { onConflict: 'order_id' });

    const result = await sendEmail(order.customer_email, order);
    const messageId = result?.id || null;

    await admin.from('email_order_confirmations').update({
      status: 'sent',
      sent_at: new Date().toISOString(),
      message_id: messageId,
      error_message: null,
      updated_at: new Date().toISOString(),
    }).eq('order_id', order.id);

    return json({ ok: true, order_id: order.id, message_id: messageId });
  } catch (error) {
    console.error(error);
    if (orderId) {
      await admin.from('email_order_confirmations').update({
        status: 'failed',
        error_message: String(error),
        updated_at: new Date().toISOString(),
      }).eq('order_id', orderId);
    }
    return json({ ok: false, error: String(error) }, 500);
  }
});
