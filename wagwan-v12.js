/* WAGWAN V12 client enhancements: unique analytics, cart/checkout leads, coupons, loyalty. */
(function(){
  const configured=()=>!!(window.wagwanSB&&window.WAGWAN_SUPABASE_URL&&!String(window.WAGWAN_SUPABASE_URL).startsWith('YOUR_'));
  const sb=()=>window.wagwanSB;
  const VID_KEY='wagwan_visitor_id';
  const SID_KEY='wagwan_session_id';
  const safeJSON=(v,f)=>{try{return JSON.parse(v)}catch{return f}};
  const randomToken=()=>{try{if(window.crypto?.randomUUID)return window.crypto.randomUUID().replace(/-/g,'');if(window.crypto?.getRandomValues){const a=new Uint32Array(4);window.crypto.getRandomValues(a);return Array.from(a).map(x=>x.toString(16).padStart(8,'0')).join('')}}catch(e){}return `${Date.now().toString(36)}${Math.random().toString(36).slice(2)}${Math.random().toString(36).slice(2)}`};
  const visitorId=()=>{let v=null;try{v=localStorage.getItem(VID_KEY)}catch(e){console.error('[WAGWAN visitor storage]',e)}if(!v){v='V_'+randomToken();try{localStorage.setItem(VID_KEY,v)}catch(e){console.error('[WAGWAN visitor storage]',e)}}return v};
  const sessionId=()=>{let v=null;try{v=sessionStorage.getItem(SID_KEY)}catch(e){console.error('[WAGWAN session storage]',e)}if(!v){v='S_'+randomToken();try{sessionStorage.setItem(SID_KEY,v)}catch(e){console.error('[WAGWAN session storage]',e)}}return v};
  const vid=visitorId(),sid=sessionId();
  const eventKey=(type,product)=> type==='product_view'?`${vid}:product_view:${product}`:type==='add_to_cart'?`${vid}:add_to_cart`:type==='visit'?`${vid}:visit`:`${vid}:${type}:${Date.now()}`;
  async function track(type,product=null,metadata={}){
    if(!configured())return;
    try{
      if(type==='visit'){
        await sb().from('analytics_visitors').upsert({visitor_id:vid,last_seen_at:new Date().toISOString()},{onConflict:'visitor_id'});
      }
      const uuidLike=typeof product==='string'&&/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(product);
      const eventMeta={...(metadata||{})}; if(product&&!eventMeta.product_id)eventMeta.product_id=product;
      await sb().from('analytics_events').upsert({visitor_id:vid,event_type:type,product_id:uuidLike?product:null,event_key:eventKey(type,product),session_id:sid,metadata:eventMeta},{onConflict:'event_key',ignoreDuplicates:true});
    }catch(e){console.error('[WAGWAN analytics ERROR]',e)}
  }
  async function markCartPresence(active){
    if(!configured())return;
    try{
      await sb().rpc('mark_cart_presence',{p_visitor_id:vid,p_active:!!active});
    }catch(e){console.debug('[WAGWAN presence]',e)}
  }
  async function saveCart(){
    if(!configured())return;
    const cart=safeJSON(localStorage.getItem('wagwan_cart')||'[]',[]);
    const products=window.getProducts?window.getProducts():[];
    if(!cart.length){ await markCartPresence(false); return; }
    const items=cart.map(x=>({product_id:x.id,size:x.size,quantity:Number(x.qty)||1}));
    const subtotal=cart.reduce((sum,x)=>{const product=products.find(p=>p.id===x.id);return sum+(product?Number(product.price)*Number(x.qty||1):0)},0);
    try{await sb().rpc('save_cart_session',{p_visitor_id:vid,p_cart_items:items,p_subtotal:subtotal})}catch(e){console.debug('[WAGWAN cart]',e)}
  }
  async function startCheckoutLead(){
    const form=document.getElementById('checkout-form');if(!form||!configured())return;
    const data=Object.fromEntries(new FormData(form));
    if(!String(data.phone||'').trim())return;
    const normalize=window.normalizeMoroccanPhone||((x)=>String(x).trim());
    const leadPhone=normalize(String(data.phone).trim());
    const cart=safeJSON(localStorage.getItem('wagwan_cart')||'[]',[]);const products=window.getProducts?window.getProducts():[];
    const items=cart.map(x=>({product_id:x.id,size:x.size,quantity:Number(x.qty)||1}));
    const subtotal=cart.reduce((sum,x)=>{const product=products.find(p=>p.id===x.id);return sum+(product?Number(product.price)*Number(x.qty||1):0)},0);
    try{
      await sb().from('analytics_events').upsert({visitor_id:vid,event_type:'checkout_started',event_key:`${vid}:checkout_started`,session_id:sid,metadata:{subtotal}},{onConflict:'event_key',ignoreDuplicates:true});
      await sb().rpc('save_checkout_lead',{p_visitor_id:vid,p_phone:leadPhone,p_email:String(data.email||'').trim(),p_first_name:String(data.firstName||'').trim(),p_last_name:String(data.lastName||'').trim(),p_address:String(data.address||'').trim(),p_city:String(data.city||'').trim(),p_cart_items:items,p_subtotal:subtotal});
      await markCartPresence(true);
    }catch(e){console.debug('[WAGWAN checkout lead]',e)}
  }
  async function applyCoupon(code){
    const el=document.getElementById('coupon-message');if(el)el.textContent='Checking...';
    if(!configured()){if(el)el.textContent='Supabase is not configured.';return null}
    const {data,error}=await sb().from('coupons').select('*').eq('code',String(code||'').trim().toUpperCase()).eq('is_active',true).maybeSingle();
    if(error||!data){if(el){el.textContent='Invalid or expired coupon.';el.className='coupon-message error';}return null}
    if(data.expires_at&&new Date(data.expires_at)<=new Date()){if(el){el.textContent='This coupon has expired.';el.className='coupon-message error';}return null}
    if(data.max_uses!=null&&data.uses_count>=data.max_uses){if(el){el.textContent='This coupon has reached its maximum uses.';el.className='coupon-message error';}return null}
    const subtotal=window.totals?window.totals().subtotal:0;
    if(subtotal<Number(data.minimum_order||0)){if(el){el.textContent=`Minimum order: ${Number(data.minimum_order)} DH`;el.className='coupon-message error';}return null}
    let discount=Math.round(subtotal*Number(data.discount_percent)/100*100)/100;if(data.maximum_discount!=null)discount=Math.min(discount,Number(data.maximum_discount));
    localStorage.setItem('wagwan_coupon',JSON.stringify({code:data.code,discountPercent:Number(data.discount_percent),discount,expiresAt:data.expires_at}));
    if(el){el.textContent=`${data.code} applied — -${discount.toFixed(2)} DH`;el.className='coupon-message success';}
    renderCheckoutEnhancement();return data;
  }
  async function loadPoints(phone){
    if(!configured()||!phone)return 0;try{const normalize=window.normalizeMoroccanPhone||((x)=>String(x).trim());const normalized=normalize(String(phone).trim());const {data}=await sb().rpc('get_loyalty_balance',{p_phone:normalized});return Number(data?.points||0)}catch{return 0}
  }
  async function renderCheckoutEnhancement(){
    const summary=document.getElementById('checkout-summary');if(!summary)return;
    let box=document.getElementById('v12-checkout-box');
    if(!box){box=document.createElement('div');box.id='v12-checkout-box';box.className='v12-checkout-box';summary.appendChild(box)}
    const coupon=safeJSON(localStorage.getItem('wagwan_coupon')||'null',null);
    const phone=document.querySelector('#checkout-form input[name="phone"]')?.value||'';
    const points=phone?await loadPoints(phone):0;
    const subtotal=window.totals?window.totals().subtotal:0;
    const couponDiscount=coupon&&coupon.discount?Number(coupon.discount):0;
    const usable=Math.floor(Math.max(0,Math.min(points,subtotal-couponDiscount))/5)*5;
    const current=Number(localStorage.getItem('wagwan_loyalty_use')||0);const use=Math.min(current,usable);
    localStorage.setItem('wagwan_loyalty_use',String(use));
    const shipping=window.totals?Number(window.totals().shipping||0):0;
    const totalAfter=Math.max(0,subtotal+shipping-couponDiscount-use);
    const baseSummary=document.getElementById('checkout-summary');
    if(baseSummary){
      const totalEl=baseSummary.querySelector('.summary-line.total b');
      if(totalEl) totalEl.textContent=money(totalAfter);
      let discountRow=baseSummary.querySelector('#v12-main-discount-row');
      const discountTotal=Number(couponDiscount||0)+Number(use||0);
      if(discountTotal>0){
        if(!discountRow){
          const deliveryRow=Array.from(baseSummary.querySelectorAll('.summary-line')).find(r=>r.textContent.trim().startsWith('Delivery'));
          discountRow=document.createElement('div');
          discountRow.id='v12-main-discount-row';
          discountRow.className='summary-line';
          discountRow.innerHTML='<span>Discount</span><b></b>';
          if(deliveryRow) baseSummary.insertBefore(discountRow,deliveryRow);
          else baseSummary.appendChild(discountRow);
        }
        const discountEl=discountRow.querySelector('b');
        if(discountEl) discountEl.textContent='- '+money(discountTotal);
      }else if(discountRow){
        discountRow.remove();
      }
    }
    box.innerHTML=`<div class="v12-box-section"><b>PROMO CODE</b><div class="v12-inline"><input id="coupon-input" value="${coupon?.code||''}" placeholder="Enter discount code"><button type="button" class="btn black" id="coupon-apply">APPLY</button></div><small id="coupon-message">${coupon?`${coupon.code} applied — -${Number(coupon.discount).toFixed(2)} DH`:''}</small></div><div class="v12-box-section"><b>WAGWAN POINTS</b><p>You have <strong>${points}</strong> points · 5 points = 5 DH</p>${points>=5?`<label class="v12-check"><input type="checkbox" id="loyalty-use" ${use>0?'checked':''}> Use ${usable} points for <strong>${usable} DH</strong> off</label>`:'<small>Points are earned after a delivered order.</small>'}</div><div class="v12-box-section v12-discount-line"><div class="summary-line"><span>DISCOUNT</span><b>- ${((couponDiscount||0)+use).toFixed(2)} DH</b></div></div>`;
    box.querySelector('#coupon-apply')?.addEventListener('click',()=>applyCoupon(box.querySelector('#coupon-input').value));
    box.querySelector('#loyalty-use')?.addEventListener('change',e=>{localStorage.setItem('wagwan_loyalty_use',e.target.checked?String(usable):'0');renderCheckoutEnhancement()});
  }
  function injectWelcomePopup(){
    if(!document.body||document.getElementById('wagwan-welcome-popup'))return;
    if(location.pathname.includes('/admin'))return;
    if(!(location.pathname.endsWith('/index.html')||location.pathname==='/'||location.pathname===''))return;
    if(localStorage.getItem('wagwan_welcome_claimed')==='1')return;
    document.body.insertAdjacentHTML('beforeend',`<div class="wagwan-welcome-overlay" id="wagwan-welcome-popup" aria-hidden="true"><div class="wagwan-welcome-modal" role="dialog" aria-modal="true" aria-labelledby="wagwan-welcome-title"><button type="button" class="wagwan-welcome-close" id="wagwan-welcome-close" aria-label="Close">×</button><div class="wagwan-welcome-content"><div class="wagwan-welcome-brand">W A G W A N</div><h2 id="wagwan-welcome-title">OBTENS <em>5% OFFERTS</em><br>SUR TA PREMIÈRE COMMANDE.</h2><p>Laisse ton numéro WhatsApp ci-dessous et notre équipe t'enverra ton <strong>code de réduction de 5%</strong>.</p><p class="wagwan-welcome-ar" dir="rtl">اترك رقم واتساب الخاص بك وسنرسل لك كود خصم 5%.</p><label class="wagwan-welcome-label">Ton numéro WhatsApp<div class="wagwan-phone-row"><span>MA +212</span><input id="wagwan-welcome-phone" inputmode="tel" autocomplete="tel" maxlength="14" placeholder="6 12 34 56 78"></div></label><button type="button" class="wagwan-welcome-submit" id="wagwan-welcome-submit"><span class="wa-mini">⌕</span><span>RECEVOIR MON CODE</span><span>→</span></button><p class="wagwan-welcome-message" id="wagwan-welcome-message" aria-live="polite"></p><div class="wagwan-welcome-note">Gratuit. Pas de spam, juste votre code promo et nos drops.</div><div class="wagwan-welcome-benefits"><div><b>ϟ</b><span>Réponse<br>rapide</span></div><div><b>◇</b><span>Code de réduction<br><strong>5% offert</strong></span></div><div><b>♙</b><span>Vos données<br>sécurisées</span></div></div></div></div></div>`);
    const overlay=document.getElementById('wagwan-welcome-popup');
    const close=()=>{overlay?.classList.remove('open');overlay?.setAttribute('aria-hidden','true');document.body.classList.remove('wagwan-modal-open')};
    document.getElementById('wagwan-welcome-close')?.addEventListener('click',close);
    overlay?.addEventListener('click',e=>{if(e.target===overlay)close()});
    const submit=document.getElementById('wagwan-welcome-submit'),input=document.getElementById('wagwan-welcome-phone'),msg=document.getElementById('wagwan-welcome-message');
    submit?.addEventListener('click',async()=>{
      const normalize=window.normalizeMoroccanPhone||((x)=>String(x).trim());const phone=normalize(input?.value||'');
      if(!phone){msg.textContent='Entre un numéro WhatsApp marocain valide.';msg.className='wagwan-welcome-message error';input?.focus();return}
      submit.disabled=true;msg.textContent='Enregistrement de votre numéro…';msg.className='wagwan-welcome-message';
      try{
        const {error}=await sb().rpc('claim_welcome_discount',{p_visitor_id:vid,p_phone:phone});
        if(error)throw error;
        localStorage.setItem('wagwan_welcome_claimed','1');
        msg.textContent='Votre numéro est bien enregistré. Notre équipe vous enverra votre code promo.';msg.className='wagwan-welcome-message success';
        await saveCart();
        setTimeout(close,2200);
      }catch(e){console.error(e);msg.textContent='Impossible d’enregistrer le numéro pour le moment. Réessayez.';msg.className='wagwan-welcome-message error';submit.disabled=false}
    });
    setTimeout(()=>{overlay.classList.add('open');overlay.setAttribute('aria-hidden','false');document.body.classList.add('wagwan-modal-open');input?.focus()},5000);
  }
  function patchAddToCart(){
    if(window._wagwanV12AddPatched||typeof window.addToCart!=='function')return;
    const original=window.addToCart;window.addToCart=function(id,size='M',qty=1){const ok=original.apply(this,arguments);if(ok){track('add_to_cart',null,{product_id:id,size,quantity:Number(qty)||1});saveCart()}return ok};window._wagwanV12AddPatched=true;
  }
  function patchProductView(){
    const id=new URLSearchParams(location.search).get('product');if(id)track('product_view',id,{source:'product_page'});
    document.addEventListener('click',e=>{const a=e.target.closest('a[href*="product.html?product="]');if(!a)return;const m=new URL(a.href,location.href).searchParams.get('product');if(m)track('product_view',m,{source:'product_link'})},{capture:true});
  }
  function patchCheckoutForm(){
    const form=document.getElementById('checkout-form');if(!form||form.dataset.v12Bound)return;
    const clone=form.cloneNode(true);form.replaceWith(clone);
    clone.dataset.v12Bound='1';
    ['input','change'].forEach(evt=>clone.addEventListener(evt,()=>{
      clearTimeout(clone._v12Timer);
      clone._v12Timer=setTimeout(()=>{startCheckoutLead();renderCheckoutEnhancement()},350);
    }));
    clone.addEventListener('submit',submitV12Order);
    setTimeout(()=>{renderCheckoutEnhancement();startCheckoutLead()},150);
  }
  async function submitV12Order(e){
    e.preventDefault();
    const form=e.currentTarget,data=Object.fromEntries(new FormData(form)),err=document.getElementById('checkout-error');if(err)err.textContent='';
    const normalize=window.normalizeMoroccanPhone||((x)=>x);const phone=normalize(data.phone);const cart=safeJSON(localStorage.getItem('wagwan_cart')||'[]',[]);
    if(!phone){if(err)err.textContent='Numéro marocain invalide.';return}if(!cart.length){if(err)err.textContent='Your cart is empty.';return}
    const coupon=safeJSON(localStorage.getItem('wagwan_coupon')||'null',null);const points=Number(localStorage.getItem('wagwan_loyalty_use')||0);
    const items=cart.map(x=>({product_id:x.id,size:x.size,quantity:Number(x.qty)}));
    try{
      if(configured()){
        const {data:result,error}=await sb().rpc('create_cod_order',{p_first_name:data.firstName,p_last_name:data.lastName,p_phone:phone,p_email:String(data.email||'').trim().toLowerCase(),p_address:data.address,p_city:data.city,p_items:items,p_coupon_code:coupon?.code||null,p_loyalty_points:points,p_visitor_id:vid});
        if(error)throw error;
        localStorage.removeItem('wagwan_cart');localStorage.removeItem('wagwan_coupon');localStorage.removeItem('wagwan_loyalty_use');
        if(window.loadCatalog)await window.loadCatalog();location.href='order-success.html?order=WG-'+String(result.order_number).padStart(4,'0');
      }else{if(err)err.textContent='Supabase is not configured yet.'}
    }catch(ex){console.error(ex);if(err)err.textContent=ex.message||'Unable to place the order. Please try again.'}
  }
  function init(){
    track('visit');
    patchAddToCart();patchProductView();saveCart();
    if(window.renderCheckout&&!window._wagwanV12CheckoutRenderPatched){
      const baseRenderCheckout=window.renderCheckout;
      window.renderCheckout=function(){
        baseRenderCheckout.apply(this,arguments);
        setTimeout(()=>renderCheckoutEnhancement(),0);
      };
      window._wagwanV12CheckoutRenderPatched=true;
    }
    if(document.getElementById('checkout-form'))patchCheckoutForm();
    setTimeout(saveCart,1200);
    if((location.pathname.endsWith('/index.html')||location.pathname==='/'||location.pathname==='')&&configured())injectWelcomePopup();
    document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='hidden'){markCartPresence(false)}else{markCartPresence(true);saveCart()}}); setInterval(()=>{if(document.visibilityState==='visible')markCartPresence(true)},20000); window.addEventListener('beforeunload',()=>{try{navigator.sendBeacon&&configured()&&markCartPresence(false)}catch{}});
    window.addEventListener('hashchange',()=>{if(location.hash==='#abandoned-carts'){markAbandonedNotificationsRead();}if(location.hash==='#analytics'||location.hash==='#coupons'||location.hash==='#loyalty'||location.hash==='#abandoned-carts')setTimeout(renderAdminV12,50)});
    if(document.querySelector('.admin-body'))setTimeout(renderAdminV12,200);
  }
  window.wagwanV12={track,saveCart,markCartPresence,applyCoupon,loadPoints,renderCheckoutEnhancement,renderAdminV12:()=>renderAdminV12()};
  document.addEventListener('DOMContentLoaded',init);

  let v12Channel=null;
  async function renderAdminV12(){
    const admin=document.querySelector('.admin-body');if(!admin||!configured())return;
    const nav=document.querySelector('.admin-sidebar nav');
    const main=document.querySelector('.admin-content');if(!main)return;
    if(!document.getElementById('analytics'))main.insertAdjacentHTML('beforeend',`<section class="admin-section" id="analytics"><div class="admin-title"><div><h1>Analytics</h1><p>Unique visitor, product interest and conversion analytics.</p></div><span class="v12-live-pill"><i></i> LIVE</span></div><div class="v12-kpis" id="v12-analytics-kpis"></div><div class="v12-grid"><div class="panel"><div class="panel-head"><h2>Conversion Funnel</h2></div><div id="v12-funnel" class="v12-funnel"></div></div><div class="panel"><div class="panel-head"><h2>Product Views</h2></div><div id="v12-product-views"></div></div></div></section>`);
    if(!document.getElementById('abandoned-carts'))main.insertAdjacentHTML('beforeend',`<section class="admin-section" id="abandoned-carts"><div class="admin-title"><div><h1>Abandoned Carts</h1><p>Track active and lost carts by how the visitor shared their number.</p></div></div><div class="v12-kpis" id="v12-abandoned-kpis"></div><div class="panel"><div class="panel-head"><div><h2>Checkout Leads</h2><p class="section-note">Clients who filled the checkout but did not click the order button.</p></div></div><div class="table-wrap"><table class="v12-table"><thead><tr><th>Visitor ID</th><th>Phone</th><th>Total</th><th>Items left</th><th>Status</th><th>Last activity</th></tr></thead><tbody id="v12-leads"></tbody></table></div></div><div class="panel v12-abandoned-panel"><div class="panel-head"><div><h2>Number Promo Leads</h2><p class="section-note">Visitors who gave their number in the 5% announcement and then left their cart.</p></div></div><div class="table-wrap"><table class="v12-table"><thead><tr><th>Visitor ID</th><th>Phone</th><th>Total</th><th>Items left</th><th>Status</th><th>Last activity</th></tr></thead><tbody id="v12-promo-leads"></tbody></table></div></div><div class="panel v12-abandoned-panel"><div class="panel-head"><div><h2>Anonymous Cart Sessions</h2><p class="section-note">Visitors who neither shared a number nor filled the checkout.</p></div></div><div class="table-wrap"><table class="v12-table"><thead><tr><th>Visitor ID</th><th>Phone</th><th>Total</th><th>Items left</th><th>Status</th><th>Last activity</th></tr></thead><tbody id="v12-carts"></tbody></table></div></div></section>`);
    if(!document.getElementById('coupons'))main.insertAdjacentHTML('beforeend',`<section class="admin-section" id="coupons"><div class="admin-title"><div><h1>Coupons</h1><p>Create discount codes and track their revenue.</p></div></div><div class="v12-coupon-layout"><div class="panel"><div class="panel-head"><h2>Create Coupon</h2></div><form id="v12-coupon-form" class="v12-form"><input name="code" placeholder="Discount code" required><input name="discount" type="number" min="0.01" max="100" step="0.01" placeholder="Discount %" required><input name="maxUses" type="number" min="1" placeholder="Maximum uses"><input name="expires" type="date"><input name="minimum" type="number" min="0" step="0.01" placeholder="Minimum order DH"><input name="commission" type="number" min="0" max="100" step="0.01" placeholder="Commission %"><button class="btn black" type="submit">CREATE COUPON</button></form></div><div class="panel"><div class="panel-head"><h2>Coupon Performance</h2></div><div id="v12-coupons-list"></div></div></div></section>`);
    if(!document.getElementById('loyalty'))main.insertAdjacentHTML('beforeend',`<section class="admin-section" id="loyalty"><div class="admin-title"><div><h1>WAGWAN Loyalty</h1><p>1 delivered order = 5 points · 5 points = 5 DH.</p></div></div><div class="v12-kpis" id="v12-loyalty-kpis"></div><div class="panel"><div class="panel-head"><h2>Loyalty Accounts</h2></div><div class="table-wrap"><table class="v12-table"><thead><tr><th>Customer</th><th>Phone</th><th>Points</th><th>Lifetime earned</th><th>Redeemed</th></tr></thead><tbody id="v12-loyalty-list"></tbody></table></div></div></section>`);
    if(!v12Channel){v12Channel=sb().channel('wagwan-v12-realtime').on('postgres_changes',{event:'*',schema:'public',table:'analytics_visitors'},()=>loadAnalytics()).on('postgres_changes',{event:'*',schema:'public',table:'analytics_events'},()=>loadAnalytics()).on('postgres_changes',{event:'*',schema:'public',table:'coupon_usages'},()=>loadCoupons()).on('postgres_changes',{event:'*',schema:'public',table:'coupons'},()=>loadCoupons()).on('postgres_changes',{event:'*',schema:'public',table:'loyalty_accounts'},()=>loadLoyalty()).on('postgres_changes',{event:'*',schema:'public',table:'checkout_leads'},()=>loadAbandoned()).on('postgres_changes',{event:'*',schema:'public',table:'wagwan_cart_sessions'},()=>loadAbandoned()).subscribe()}
    await Promise.all([loadAnalytics(),loadAbandoned(),loadCoupons(),loadLoyalty(),loadAdminSettings()]);
    if(document.getElementById('v12-coupon-form')&&!document.getElementById('v12-coupon-form').dataset.bound){document.getElementById('v12-coupon-form').dataset.bound='1';document.getElementById('v12-coupon-form').addEventListener('submit',createCoupon)}
    document.querySelectorAll('.admin-section').forEach(s=>s.classList.toggle('section-active','#'+s.id===location.hash));
  }
  async function loadAnalytics(){if(!configured())return;const [{data:v},{data:e}]=await Promise.all([sb().from('analytics_visitors').select('visitor_id'),sb().from('analytics_events').select('event_type,product_id,created_at,metadata')]);const ev=e||[];const unique=v?.length||0;const count=t=>ev.filter(x=>x.event_type===t).length;const orders=count('order_created');const pv=count('product_view');const cart=count('add_to_cart');const checkout=count('checkout_started');const rate=unique?orders/unique*100:0;const k=document.getElementById('v12-analytics-kpis');if(k){const icons={visitors:'<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="8" r="3"/><path d="M5 20c.7-3.4 3-5 7-5s6.3 1.6 7 5"/></svg>',views:'<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 12s3.2-5 9-5 9 5 9 5-3.2 5-9 5-9-5-9-5Z"/><circle cx="12" cy="12" r="2"/></svg>',cart:'<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 5h2l1.4 9h9.9L20 8H7"/><circle cx="10" cy="19" r="1.5"/><circle cx="17" cy="19" r="1.5"/></svg>',checkout:'<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 4h10l4 4v12H5z"/><path d="M15 4v5h4M8 13h8M8 16h5"/></svg>',orders:'<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 5h14v14H5z"/><path d="M8 9h8M8 13h8M8 17h5"/></svg>',rate:'<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 19 10 13l4 4 6-8"/><path d="M15 9h5v5"/></svg>'};const data=[['UNIQUE VISITORS',unique,'visitors'],['PRODUCT VIEWERS',pv,'views'],['ADD TO CART',cart,'cart'],['CHECKOUT STARTED',checkout,'checkout'],['ORDERS',orders,'orders'],['CONVERSION RATE',rate.toFixed(2)+'%','rate']];k.innerHTML=data.map(x=>`<div class="stat"><div class="stat-top"><span>${x[0]}</span><span class="stat-icon">${icons[x[2]]}</span></div><div class="stat-value">${x[1]}</div><span class="trend">Live</span></div>`).join('')}const funnel=document.getElementById('v12-funnel');if(funnel)funnel.innerHTML=[['Unique Visitors',unique],['Product Viewers',pv],['Add to Cart',cart],['Checkout Started',checkout],['Orders',orders]].map(x=>`<div class="v12-funnel-row"><b>${x[0]}</b><span>${x[1]}</span><div><i style="width:${unique?Math.min(100,x[1]/unique*100):0}%"></i></div></div>`).join('');const pvEl=document.getElementById('v12-product-views');if(pvEl){const map={};ev.filter(x=>x.event_type==='product_view').forEach(x=>{const key=x.product_id||x.metadata?.product_id||'unknown';map[key]=(map[key]||0)+1});const ps=window.getProducts?window.getProducts():[];pvEl.innerHTML=Object.entries(map).sort((a,b)=>b[1]-a[1]).map(([id,n])=>`<div class="v12-rank"><span>${ps.find(p=>p.id===id)?.name||id}</span><b>${n}</b></div>`).join('')||'<div class="empty">No product views yet.</div>'}}
  const ABANDONED_SEEN_KEY='wagwan_abandoned_notifications_seen_at';
  function abandonedNotificationsSeenAt(){try{return Number(localStorage.getItem(ABANDONED_SEEN_KEY)||0)||0}catch{return 0}}
  function markAbandonedNotificationsRead(){try{localStorage.setItem(ABANDONED_SEEN_KEY,String(Date.now()))}catch{};const b=document.getElementById('abandoned-pending-badge');if(b)b.textContent='0'}
  function abandonedNotificationCount(rows){const seen=abandonedNotificationsSeenAt();return rows.filter(x=>x.status==='abandoned'&&(!seen||new Date(x.abandoned_at||x.updated_at||x.last_activity_at||0).getTime()>seen)).length}
  async function loadAbandoned(){
    if(!configured())return;
    const [{data:c},{data:l}]=await Promise.all([
      sb().from('wagwan_cart_sessions').select('*').neq('status','converted').order('last_activity_at',{ascending:false}),
      sb().from('checkout_leads').select('*').in('status',['active','abandoned']).order('last_activity_at',{ascending:false})
    ]);
    const carts=c||[],leads=l||[];
    const now=Date.now();
    const normalizeRows=(rows)=>rows.map(x=>{const fresh=x.status==='active' && (now-new Date(x.last_activity_at).getTime())<65000;return {...x,status:fresh?'active':'abandoned'}});
    const normalizedCarts=normalizeRows(carts), normalizedLeads=normalizeRows(leads);
    const staleCartIds=normalizedCarts.filter((x,i)=>carts[i]?.status==='active'&&x.status==='abandoned').map(x=>x.id).filter(Boolean); const staleLeadIds=normalizedLeads.filter((x,i)=>leads[i]?.status==='active'&&x.status==='abandoned').map(x=>x.id).filter(Boolean); if(staleCartIds.length)sb().from('wagwan_cart_sessions').update({status:'abandoned',abandoned_at:new Date().toISOString(),updated_at:new Date().toISOString()}).in('id',staleCartIds).then(()=>{}); if(staleLeadIds.length)sb().from('checkout_leads').update({status:'abandoned',abandoned_at:new Date().toISOString(),updated_at:new Date().toISOString()}).in('id',staleLeadIds).then(()=>{});
    const checkoutVisitors=new Set(normalizedLeads.map(x=>x.visitor_id));
    const promo=normalizedCarts.filter(x=>x.lead_type==='number_promo' && !checkoutVisitors.has(x.visitor_id));
    const anonymous=normalizedCarts.filter(x=>(x.lead_type||'anonymous')==='anonymous' && !checkoutVisitors.has(x.visitor_id));
    const activeCount=[...normalizedLeads,...promo,...anonymous].filter(x=>x.status==='active').length;
    const lostCount=[...normalizedLeads,...promo,...anonymous].filter(x=>x.status==='abandoned').length;
    const k=document.getElementById('v12-abandoned-kpis');if(k)k.innerHTML=[['ACTIVE',activeCount],['PERDU',lostCount],['CART VALUE',[...normalizedLeads,...promo,...anonymous].reduce((sum,x)=>sum+Number(x.subtotal||0),0).toFixed(2)+' DH']].map(x=>`<div class="stat"><div class="stat-top"><span>${x[0]}</span></div><div class="stat-value">${x[1]}</div></div>`).join('');
    const badge=document.getElementById('abandoned-pending-badge');if(badge)badge.textContent=String(abandonedNotificationCount([...normalizedCarts,...normalizedLeads]));
    const productMap=(()=>{try{return Object.fromEntries((window.getProducts?window.getProducts():[]).map(p=>[String(p.id),p.name]))}catch{return{}}})();
    const itemLabel=x=>{const items=Array.isArray(x.cart_items)?x.cart_items:[];return items.length?items.map(i=>`${i.product_name||productMap[String(i.product_id)]||i.product_id||'Article'}${i.size?' · '+i.size:''} × ${Number(i.quantity||i.qty||1)}`).join(' · '):'—'};
    const statusLabel=x=>`<span class="abandoned-status ${x.status==='active'?'is-active':'is-lost'}"><i></i>${x.status==='active'?'ACTIVE':'PERDU'}</span>`;
    const row=x=>`<tr><td><code>${String(x.visitor_id||'').slice(0,14)}…</code></td><td>${x.phone||'—'}</td><td>${Number(x.subtotal||0).toFixed(2)} DH</td><td class="v12-items-left" title="${itemLabel(x).replace(/"/g,'&quot;')}">${itemLabel(x)}</td><td>${statusLabel(x)}</td><td>${new Date(x.last_activity_at).toLocaleString('fr-FR')}</td></tr>`;
    const render=(id,rows,empty)=>{const el=document.getElementById(id);if(el)el.innerHTML=rows.length?rows.map(row).join(''):`<tr><td colspan="6" class="empty">${empty}</td></tr>`};
    render('v12-leads',normalizedLeads,'No checkout leads.');
    render('v12-promo-leads',promo,'No number promo leads.');
    render('v12-carts',anonymous,'No anonymous cart sessions.');
  }
  async function loadCoupons(){if(!configured())return;const {data,error}=await sb().from('coupon_analytics').select('*').order('created_at',{ascending:false});if(error)return;const el=document.getElementById('v12-coupons-list');if(el)el.innerHTML=(data||[]).map(x=>`<div class="v12-coupon-row"><div><b>${x.code}</b><small>${x.discount_percent}% · ${x.uses_count}${x.max_uses?' / '+x.max_uses:''} uses</small></div><strong>${Number(x.revenue_from_coupon_orders||0).toFixed(2)} DH</strong><span>Commission ${Number(x.commission||0).toFixed(2)} DH</span><button type="button" class="v12-delete-btn" onclick="deleteCoupon('${x.code}')">DELETE</button></div>`).join('')||'<div class="empty">No coupons yet.</div>'}
  async function createCoupon(e){e.preventDefault();const f=e.currentTarget,d=Object.fromEntries(new FormData(f));const {error}=await sb().from('coupons').insert({code:String(d.code).trim().toUpperCase(),discount_percent:Number(d.discount),max_uses:d.maxUses?Number(d.maxUses):null,expires_at:d.expires?new Date(`${d.expires}T23:59:59`).toISOString():null,minimum_order:Number(d.minimum||0),commission_percent:Number(d.commission||0)});if(error){toast(error.message||'Could not create coupon');return}f.reset();await loadCoupons();toast('Coupon created')}
  async function deleteCoupon(code){ if(!configured()) return; if(!confirm(`Delete coupon ${code}?`)) return; const {error}=await sb().from('coupons').delete().eq('code',code); if(error){toast(error.message||'Could not delete coupon');return;} await loadCoupons(); toast('Coupon deleted'); }
  window.deleteCoupon=deleteCoupon;
  async function saveAdminSettings(){ if(!configured()) return; const payload={store_name:document.getElementById('setting-store-name')?.value||'WAGWAN',currency:document.getElementById('setting-currency')?.value||'MAD',payment_method:document.getElementById('setting-payment')?.value||'Cash on Delivery',delivery_method:document.getElementById('setting-delivery')?.value||'Free delivery — Morocco',cod_enabled:!!document.getElementById('setting-cod')?.checked,realtime_enabled:!!document.getElementById('setting-realtime')?.checked}; const {error}=await sb().from('admin_settings').upsert({id:'store',settings:payload,updated_at:new Date().toISOString()},{onConflict:'id'}); if(error){toast(error.message||'Could not save settings');return;} toast('Settings saved'); }
  window.saveAdminSettings=saveAdminSettings;
  async function loadAdminSettings(){ if(!configured()) return; const {data}=await sb().from('admin_settings').select('settings').eq('id','store').maybeSingle(); if(!data?.settings)return; const s=data.settings; if(document.getElementById('setting-store-name'))document.getElementById('setting-store-name').value=s.store_name||'WAGWAN'; if(document.getElementById('setting-currency'))document.getElementById('setting-currency').value=s.currency||'MAD'; if(document.getElementById('setting-payment'))document.getElementById('setting-payment').value=s.payment_method||'Cash on Delivery'; if(document.getElementById('setting-delivery'))document.getElementById('setting-delivery').value=s.delivery_method||'Free delivery — Morocco'; if(document.getElementById('setting-cod'))document.getElementById('setting-cod').checked=s.cod_enabled!==false; if(document.getElementById('setting-realtime'))document.getElementById('setting-realtime').checked=s.realtime_enabled!==false; }
  async function loadLoyalty(){if(!configured())return;const {data}=await sb().from('loyalty_accounts').select('*').order('points_balance',{ascending:false});const rows=data||[];const k=document.getElementById('v12-loyalty-kpis');if(k)k.innerHTML=[['LOYALTY MEMBERS',rows.length],['POINTS IN CIRCULATION',rows.reduce((s,x)=>s+x.points_balance,0)],['POINTS EARNED',rows.reduce((s,x)=>s+x.lifetime_earned,0)],['POINTS REDEEMED',rows.reduce((s,x)=>s+x.lifetime_redeemed,0)]].map(x=>`<div class="stat"><div class="stat-top"><span>${x[0]}</span></div><div class="stat-value">${x[1]}</div></div>`).join('');const el=document.getElementById('v12-loyalty-list');if(el)el.innerHTML=rows.length?rows.map(x=>`<tr><td>${x.full_name||'—'}</td><td>${x.phone}</td><td><b>${x.points_balance}</b> (${x.points_balance} DH)</td><td>${x.lifetime_earned}</td><td>${x.lifetime_redeemed}</td></tr>`).join(''):'<tr><td colspan="5" class="empty">No loyalty accounts yet.</td></tr>'}
})();
