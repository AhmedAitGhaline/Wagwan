const PRODUCTS=[
{id:'taste',name:'TASTE LONGSLEEVE',slug:'taste-longsleeve',price:239,color:'WHITE / RED',image:'assets/taste-front-back.png',images:['assets/taste-front-back.png','assets/taste-detail.png','assets/taste-label.png'],description:'White longsleeve with the red WAGWAN signature on the front and the TASTE cherry artwork on the back.',details:['BOXY FIT','UNISEX','RIBBED CREWNECK','WIDE SLEEVES','ORGANIC PRE-SHRUNK COTTON FABRIC'],stock:{S:10,M:15,L:12,XL:8}},
{id:'luck',name:"IT'S NEVER LUCK LONGSLEEVE",slug:'its-never-luck-longsleeve',price:239,color:'WHITE / CAMO',image:'assets/luck-front-back.png',images:['assets/luck-front-back.png','assets/luck-logo-detail.png','assets/luck-cuff.png','assets/luck-label.png'],description:'White longsleeve with the camouflage WAGWAN signature on the front and the IT’S NEVER LUCK IT’S ALWAYS GOD artwork on the back.',details:['BOXY FIT','UNISEX','RIBBED CREWNECK','WIDE SLEEVES','ORGANIC PRE-SHRUNK COTTON FABRIC'],stock:{S:15,M:20,L:10,XL:12}}
];
const SHIPPING=0, FREE_THRESHOLD=0;
function getProducts(){try{const custom=JSON.parse(localStorage.getItem('wagwan_products')||'[]');const byId=new Map(custom.map(p=>[p.id,p]));return [...PRODUCTS.map(p=>byId.get(p.id)||p),...custom.filter(c=>!PRODUCTS.some(p=>p.id===c.id))]}catch{return [...PRODUCTS]}}
let homeSelections={};
function money(n){return `${Number(n).toLocaleString('fr-FR')} DH`}
function getCart(){try{return JSON.parse(localStorage.getItem('wagwan_cart')||'[]')}catch{return[]}}
function saveCart(c){localStorage.setItem('wagwan_cart',JSON.stringify(c));updateCartCount()}
function updateCartCount(){const n=getCart().reduce((s,x)=>s+x.qty,0);document.querySelectorAll('.cart-count').forEach(e=>e.textContent=n)}
function getSizeStock(p,size){return Math.max(0,Number(p?.stock?.[size])||0)}
function addToCart(id,size='M',qty=1){
  const p=getProducts().find(x=>x.id===id);if(!p)return false;
  const available=getSizeStock(p,size);
  if(available<=0){toast(`SIZE ${size} IS OUT OF STOCK`);return false}
  const requested=Math.max(1,Number(qty)||1);
  const cart=getCart();
  const existing=cart.find(x=>x.id===id&&x.size===size);
  const current=existing?Math.max(0,Number(existing.qty)||0):0;
  if(current+requested>available){
    toast(`Only ${available} item${available===1?'':'s'} available in size ${size}`);
    return false;
  }
  if(existing)existing.qty=current+requested;else cart.push({id,size,qty:requested});
  saveCart(cart);toast(`${p.name} added to cart`);return true;
}
function removeFromCart(i){const c=getCart();c.splice(i,1);saveCart(c);renderCart()}
function changeQty(i,d){
  const c=getCart();const item=c[i];if(!item)return;
  const p=getProducts().find(x=>x.id===item.id);const available=getSizeStock(p,item.size);
  if(available<=0){toast(`SIZE ${item.size} IS OUT OF STOCK`);return}
  const next=Math.max(1,Math.min(available,(Number(item.qty)||1)+d));
  if(next===(Number(item.qty)||1)&&d>0)toast(`Only ${available} available in size ${item.size}`);
  item.qty=next;saveCart(c);renderCart();
}
function cartDetailed(){return getCart().map(x=>({...x,p:getProducts().find(p=>p.id===x.id)})).filter(x=>x.p)}
function totals(){const items=cartDetailed();const subtotal=items.reduce((s,x)=>s+x.p.price*x.qty,0);const shipping=subtotal===0?0:(subtotal>=FREE_THRESHOLD?0:SHIPPING);return{subtotal,shipping,total:subtotal+shipping}}
function productCard(p){return `<article class="product-card" data-product="${p.id}"><a href="product.html?product=${p.id}"><div class="product-image"><img src="${p.image}" alt="${p.name}">${p.promotion?`<span class="promotion-badge">${p.promotion}</span>`:''}</div></a><div class="product-meta"><div><h3>${p.name}</h3><p>${p.color}</p><div class="size-selector"><span class="size-label">SELECT SIZE</span><div class="size-row">${Object.keys(p.stock||{}).map(s=>{const n=getSizeStock(p,s);return `<button type="button" class="size size-home ${n<=0?'out':''}" ${n<=0?'disabled':''} title="${n<=0?'Out of stock':''}" onclick="selectHomeSize(event,'${p.id}','${s}')">${s}</button>`}).join('')}</div></div></div><div class="price"><strong>${money(p.price)}</strong>${p.comparePrice?` <del>${money(p.comparePrice)}</del>`:''}</div><div class="card-actions"><button id="add-${p.id}" class="mini-add" disabled onclick="addHomeProduct(event,'${p.id}')">SELECT A SIZE</button></div></div></article>`}
function selectHomeSize(e,id,size){e.preventDefault();e.stopPropagation();const p=getProducts().find(x=>x.id===id);if(!p||getSizeStock(p,size)<=0){toast(`SIZE ${size} IS OUT OF STOCK`);return}homeSelections[id]=size;const card=document.querySelector(`.product-card[data-product="${id}"]`);if(!card)return;card.querySelectorAll('.size-home').forEach(b=>b.classList.toggle('selected',b.textContent===size));const btn=card.querySelector(`#add-${id}`);if(btn){btn.disabled=false;btn.textContent='ADD TO CART'}}
function addHomeProduct(e,id){e.preventDefault();e.stopPropagation();const size=homeSelections[id];const p=getProducts().find(x=>x.id===id);if(!p||!size){toast('Please select a size first');return}if(getSizeStock(p,size)<=0){toast(`SIZE ${size} IS OUT OF STOCK`);return}addToCart(id,size,1)}
function renderHome(){const el=document.getElementById('home-products');if(el)el.innerHTML=getProducts().map(productCard).join('')}
function renderShop(){const el=document.getElementById('shop-products');if(!el)return;let ps=[...getProducts()];const sort=document.getElementById('sort')?.value;if(sort==='price-low')ps.sort((a,b)=>a.price-b.price);if(sort==='price-high')ps.sort((a,b)=>b.price-a.price);el.innerHTML=ps.map(productCard).join('')}
function renderProduct(){const root=document.getElementById('product-page');if(!root)return;const id=new URLSearchParams(location.search).get('product')||'taste';const p=getProducts().find(x=>x.id===id)||PRODUCTS[0];selectedSize='';productQty=1;root.innerHTML=`<div class="product-gallery"><div class="gallery-main"><img id="main-product-image" src="${p.images[0]}" alt="${p.name}"></div><div class="thumbs">${p.images.map((img,i)=>`<button class="thumb ${i===0?'active':''}" onclick="setProductImage(this,'${img}')"><img src="${img}" alt="${p.name} detail ${i+1}"></button>`).join('')}</div></div><div class="product-info"><small>DROP 001 / LONGSLEEVE</small><h1>${p.name}</h1><div class="big-price">${money(p.price)} ${p.comparePrice?`<del>${money(p.comparePrice)}</del>`:''}</div><p class="description">${p.description}</p><div class="size-help-row"><div class="choice-label">SIZE — <b id="selected-size">SELECT</b></div><button class="size-help-btn" onclick="document.getElementById('size-guide').classList.toggle('open')">SIZE HELP</button></div><div class="choices">${Object.entries(p.stock).map(([s,n])=>`<button class="${n===0?'out':''}" ${n===0?'disabled':''} onclick="selectSize(this,'${s}',${n})">${s}${n===0?' — OUT OF STOCK':''}</button>`).join('')}</div><div id="size-guide" class="size-guide"><div class="size-guide-head"><b>SIZE GUIDE</b><span>Body measurements / cm</span></div><table><thead><tr><th>SIZE</th><th>CHEST</th><th>LENGTH</th><th>SLEEVE</th></tr></thead><tbody><tr><td>S</td><td>52</td><td>68</td><td>61</td></tr><tr><td>M</td><td>55</td><td>70</td><td>62</td></tr><tr><td>L</td><td>58</td><td>72</td><td>63</td></tr><tr><td>XL</td><td>61</td><td>74</td><td>64</td></tr></tbody></table><p>If you prefer a relaxed streetwear fit, we recommend your usual size.</p></div><div class="qty"><button onclick="changeProductQty(-1)">−</button><span id="product-qty">1</span><button onclick="changeProductQty(1)">+</button></div><button id="product-add-btn" class="btn black full" disabled onclick="addCurrentProduct('${p.id}')">SELECT A SIZE TO ADD TO CART</button><div class="product-details"><b>DÉTAILS DU PRODUIT</b><ul>${p.details.map(d=>`<li>${d}</li>`).join('')}</ul></div></div>`}
function setProductImage(btn,img){document.getElementById('main-product-image').src=img;document.querySelectorAll('.thumb').forEach(b=>b.classList.remove('active'));btn.classList.add('active')}
let selectedSize='',productQty=1;function selectSize(btn,s,n){if(n<=0){toast(`SIZE ${s} IS OUT OF STOCK`);return}document.querySelectorAll('.choices button').forEach(b=>b.classList.remove('selected'));btn.classList.add('selected');selectedSize=s;productQty=Math.min(productQty,n);document.getElementById('selected-size').textContent=s;document.getElementById('product-qty').textContent=productQty;const add=document.getElementById('product-add-btn');if(add){add.disabled=false;add.textContent='ADD TO CART →'}}
function changeProductQty(d){
  const id=new URLSearchParams(location.search).get('product')||'taste';const p=getProducts().find(x=>x.id===id);const max=selectedSize?getSizeStock(p,selectedSize):Infinity;
  const next=Math.max(1,Math.min(max,productQty+d));
  if(selectedSize&&d>0&&next===productQty)toast(`Only ${max} available in size ${selectedSize}`);
  productQty=next;document.getElementById('product-qty').textContent=productQty;
}
function addCurrentProduct(id){const p=getProducts().find(x=>x.id===id);if(!p||!selectedSize){toast('Please select a size first');return}const max=getSizeStock(p,selectedSize);if(max<=0){toast(`SIZE ${selectedSize} IS OUT OF STOCK`);return}if(productQty>max)productQty=max;addToCart(id,selectedSize,productQty)}
function renderCart(){const root=document.getElementById('cart-content');if(!root)return;const items=cartDetailed();if(!items.length){root.innerHTML='<div class="empty">YOUR CART IS EMPTY.<br><br><a class="btn black" href="shop.html">SHOP DROP 001</a></div>';return}root.innerHTML=`<div class="cart-layout"><div>${items.map((x,i)=>`<div class="cart-row"><img src="${x.p.image}"><div><h3>${x.p.name}</h3><p>SIZE ${x.size}</p><strong>${money(x.p.price*x.qty)}</strong></div><div class="cart-qty"><button onclick="changeQty(${i},-1)">−</button><span>${x.qty}</span><button onclick="changeQty(${i},1)">+</button></div><button class="remove" onclick="removeFromCart(${i})">REMOVE</button></div>`).join('')}</div><aside class="cart-summary"><h2>SUMMARY</h2><div class="summary-line"><span>Subtotal</span><b>${money(totals().subtotal)}</b></div><div class="summary-line"><span>Delivery</span><b>${totals().shipping?money(totals().shipping):'FREE'}</b></div><div class="summary-line total"><span>Total</span><b>${money(totals().total)}</b></div><a class="btn black full" href="checkout.html">CHECKOUT →</a></aside></div>`}
function renderCheckout(){const root=document.getElementById('checkout-summary');if(!root)return;const items=cartDetailed();if(!items.length){root.innerHTML='<div class="empty">Your cart is empty.</div>';return}root.innerHTML=`<h2>ORDER SUMMARY</h2>${items.map(x=>`<div class="summary-line"><span>${x.p.name} · ${x.size} × ${x.qty}</span><b>${money(x.p.price*x.qty)}</b></div>`).join('')}<div class="summary-line"><span>Subtotal</span><b>${money(totals().subtotal)}</b></div><div class="summary-line"><span>Delivery</span><b>${totals().shipping?money(totals().shipping):'FREE'}</b></div><div class="summary-line total"><span>TOTAL</span><b>${money(totals().total)}</b></div>`;document.getElementById('checkout-form')?.addEventListener('submit',submitOrder)}
function normalizeMoroccanPhone(input){
  if(input==null)return null;
  let raw=String(input).trim();
  // Also accept Arabic-Indic / Persian digits that a customer may paste.
  raw=raw.replace(/[٠-٩]/g,d=>String('٠١٢٣٤٥٦٧٨٩'.indexOf(d)))
         .replace(/[۰-۹]/g,d=>String('۰۱۲۳۴۵۶۷۸۹'.indexOf(d)));
  let phone=raw.replace(/\D/g,'');

  // International prefix written as 00 212 / 00212.
  if(phone.startsWith('00')) phone=phone.slice(2);

  // International Moroccan form: 2126XXXXXXXX / 2127XXXXXXXX.
  // Be forgiving if someone writes 21206XXXXXXXX / 21207XXXXXXXX.
  if(phone.startsWith('212')){
    let local=phone.slice(3);
    if(local.startsWith('0')) local=local.slice(1);
    return /^[67]\d{8}$/.test(local)?'+212'+local:null;
  }

  // Moroccan local mobile form: 06XXXXXXXX / 07XXXXXXXX.
  if(/^0[67]\d{8}$/.test(phone)) return '+212'+phone.slice(1);

  // Local mobile form without the leading zero: 6XXXXXXXX / 7XXXXXXXX.
  if(/^[67]\d{8}$/.test(phone)) return '+212'+phone;

  return null;
}
function validMoroccanPhone(v){return !!normalizeMoroccanPhone(v)}
function submitOrder(e){e.preventDefault();const form=e.currentTarget;const data=Object.fromEntries(new FormData(form));const err=document.getElementById('checkout-error');if(!validMoroccanPhone(data.phone)){err.textContent='Please enter a valid Moroccan phone number (+212 6/7 or 06/07).';return}const items=cartDetailed();if(!items.length){err.textContent='Your cart is empty.';return}for(const x of items){const available=getSizeStock(x.p,x.size);if(available<=0||x.qty>available){err.textContent=`${x.p.name} — size ${x.size} is out of stock or only ${available} available.`;return}}const orders=JSON.parse(localStorage.getItem('wagwan_orders')||'[]');const order={id:'WG-'+(1001+orders.length),firstName:data.firstName,lastName:data.lastName,phone:data.phone,address:data.address,city:data.city,status:'pending',payment:'COD',items:items.map(x=>({product:x.p.name,size:x.size,qty:x.qty,price:x.p.price})),subtotal:totals().subtotal,shipping:totals().shipping,total:totals().total,createdAt:new Date().toISOString()};orders.unshift(order);localStorage.setItem('wagwan_orders',JSON.stringify(orders));localStorage.removeItem('wagwan_cart');location.href='order-success.html?order='+order.id}
function renderSuccess(){const el=document.getElementById('success-text');if(!el)return;const id=new URLSearchParams(location.search).get('order');el.innerHTML=`Thank you. Your order <b>#${id||'WG-1001'}</b> has been received.<br>Payment method: Cash on Delivery.`}
function getOrders(){return JSON.parse(localStorage.getItem('wagwan_orders')||'[]')}
function adminStats(){const o=getOrders(),confirmed=o.filter(x=>x.status==='confirmed'),cancelled=o.filter(x=>x.status==='cancelled');return{orders:o.length,revenue:confirmed.reduce((s,x)=>s+x.total,0),confirmed:confirmed.length,cancelled:cancelled.length,pending:o.filter(x=>x.status==='pending').length}}
function svgIcon(name){
const icons={
check:'<svg viewBox="0 0 24 24"><path d="m5 12 4 4L19 6"/></svg>',
close:'<svg viewBox="0 0 24 24"><path d="m6 6 12 12M18 6 6 18"/></svg>',
eye:'<svg viewBox="0 0 24 24"><rect x="4" y="3" width="16" height="18" rx="2"/><path d="M8 8h8M8 12h8M8 16h5"/></svg>',
user:'<svg viewBox="0 0 24 24"><circle cx="12" cy="8" r="3.5"/><path d="M5 20c.8-3.2 3.2-5 7-5s6.2 1.8 7 5"/></svg>',
phone:'<svg viewBox="0 0 24 24"><path d="M7 3h3l1.3 4-2 1.5a15 15 0 0 0 6.2 6.2l1.5-2 4 1.3v3c0 1.1-.9 2-2 2C10.8 19 5 13.2 5 6c0-1.7.9-3 2-3Z"/></svg>',
location:'<svg viewBox="0 0 24 24"><path d="M12 21s7-6.2 7-12A7 7 0 0 0 5 9c0 5.8 7 12 7 12Z"/><circle cx="12" cy="9" r="2.2"/></svg>',
city:'<svg viewBox="0 0 24 24"><path d="M4 21V9l8-4 8 4v12M8 21v-5h8v5M9 11h1M14 11h1M9 14h1M14 14h1"/></svg>',
print:'<svg viewBox="0 0 24 24"><path d="M7 9V3h10v6M6 18H4V10h16v8h-2M7 14h10v7H7z"/></svg>',
edit:'<svg viewBox="0 0 24 24"><path d="m4 16-.7 4.7L8 20l10.5-10.5a2.8 2.8 0 0 0-4-4Z"/><path d="m13.5 6.5 4 4"/></svg>',
trash:'<svg viewBox="0 0 24 24"><path d="M4 7h16M9 7V4h6v3M7 7l1 14h8l1-14M10 11v6M14 11v6"/></svg>',
plus:'<svg viewBox="0 0 24 24"><path d="M12 5v14M5 12h14"/></svg>'
};return icons[name]||''}
function adminStats(){const o=getOrders(),confirmed=o.filter(x=>x.status==='confirmed'||x.status==='delivered'),cancelled=o.filter(x=>x.status==='cancelled');return{orders:o.length,revenue:confirmed.reduce((s,x)=>s+x.total,0),confirmed:confirmed.length,cancelled:cancelled.length,pending:o.filter(x=>x.status==='pending').length}}
function renderAdmin(){const stats=adminStats();const st=document.getElementById('admin-stats');if(st)st.innerHTML=[['TOTAL ORDERS',stats.orders,'Live','▣'],['TOTAL REVENUE',money(stats.revenue),'Live','◉'],['CONFIRMED ORDERS',stats.confirmed,'Live','✓'],['CANCELLED ORDERS',stats.cancelled,'Live','×']].map((x,i)=>`<div class="stat"><div class="stat-top"><span>${x[0]}</span><span class="stat-icon">${x[3]}</span></div><div class="stat-value">${x[1]}</div><span class="trend ${i===3?'red':''}">${x[2]}</span></div>`).join('');const badge=document.getElementById('pending-badge');if(badge)badge.textContent=stats.pending;renderAdminOrders();renderAdminProducts();renderAdminCategories();renderAdminCustomers();renderCities();renderCategoryOptions();drawChart();renderStatus(stats);applyAdminHash()}
function orderStatusLabel(s){return ({pending:'Pending',confirmed:'Confirmed',cancelled:'Cancelled',delivered:'Delivered'}[s]||s)}
function renderAdminOrders(){
const body=document.getElementById('orders-table');if(!body)return;
let o=getOrders();const q=(document.getElementById('admin-search')?.value||'').toLowerCase();
if(q)o=o.filter(x=>[x.id,x.firstName,x.lastName,x.phone,x.email,x.city,...x.items.map(i=>i.product)].join(' ').toLowerCase().includes(q));
body.innerHTML=o.slice(0,20).map(x=>{
const item=x.items?.[0]||{};
const phone=x.phone||'';
const wa=whatsappLink(phone,`Bonjour ${x.firstName||''}, nous vous contactons de WAGWAN pour confirmer votre commande #${x.id}.`);
return `<tr>
<td><strong>#${x.id}</strong></td>
<td class="customer-cell"><span>${x.firstName||''} ${x.lastName||''}</span></td>
<td><div class="order-product-cell"><img src="${productImageForOrder(item)}" alt=""><strong>${item.product||'—'}</strong></div></td>
<td class="order-phone"><a href="${wa}" target="_blank" rel="noopener" title="Contacter ${phone} sur WhatsApp">${phone||'—'}</a></td>
<td>${x.city||'—'}</td>
<td><strong>${money(x.total)}</strong></td>
<td><span class="status-pill ${x.status}">${orderStatusLabel(x.status)}</span></td>
<td>${new Date(x.createdAt).toLocaleDateString('en-GB')}</td>
<td><div class="order-actions">
<button class="action-btn confirm" title="Confirm" onclick="setOrderStatus('${x.id}','confirmed')">${svgIcon('check')}</button>
<button class="action-btn cancel" title="Cancel" onclick="setOrderStatus('${x.id}','cancelled')">${svgIcon('close')}</button>
<button class="action-btn view" title="View order" onclick="showOrder('${x.id}')">${svgIcon('eye')}</button>
</div></td></tr>`}).join('')||'<tr><td colspan="9" class="empty">No orders yet. Place a COD order from the storefront.</td></tr>'
}
function whatsappLink(phone,message){
const digits=String(phone||'').replace(/\D/g,'');const intl=digits.startsWith('0')?'212'+digits.slice(1):digits;
return `https://wa.me/${intl}?text=${encodeURIComponent(message||'Bonjour, nous vous contactons de WAGWAN.')}`;
}
function assetPath(src){return String(src||'').startsWith('data:')||String(src||'').startsWith('http')?src:'../'+src}function productImageForOrder(item){const p=getProducts().find(p=>p.name===item?.product);return assetPath(p?.image||'assets/wagwan-logo.png')}
function showOrder(id){
const o=getOrders().find(x=>x.id===id);const d=document.getElementById('order-detail');if(!o||!d)return;
const wa=whatsappLink(o.phone,`Bonjour ${o.firstName||''}, nous vous contactons de WAGWAN pour confirmer votre commande #${o.id}.`);
d.innerHTML=`
<div class="panel-head"><h2>Order #${o.id}</h2><button class="detail-close" onclick="closeOrderDetails()" aria-label="Close">×</button></div>
<div class="detail-status-row"><span class="status-pill ${o.status}">${orderStatusLabel(o.status)}</span></div>
<div class="detail-section"><b>Customer Information</b>
<div class="customer-info">
<p><span class="info-icon">${svgIcon('user')}</span><span><small>Full Name</small><strong>${o.firstName||''} ${o.lastName||''}</strong></span></p>
<p><span class="info-icon">${svgIcon('phone')}</span><span><small>Phone Number</small><a class="detail-phone" href="${wa}" target="_blank" rel="noopener">${o.phone||'—'}</a></span></p>
<p><span class="info-icon">${svgIcon('location')}</span><span><small>Address</small><strong>${o.address||'—'}</strong></span></p>
<p><span class="info-icon">${svgIcon('city')}</span><span><small>City</small><strong>${o.city||'—'}</strong></span></p>
</div></div>
<div class="detail-section"><b>Order Items</b>
${(o.items||[]).map(i=>`<div class="detail-item"><img src="${productImageForOrder(i)}" alt=""><div><strong>${i.product||'—'}</strong><span>Size du Produit : <b>${i.size||'—'}</b></span><span>Quantité du Produit : <b>${i.qty||0}</b></span></div><strong>${money((i.price||0)*(i.qty||0))}</strong></div>`).join('')}
</div>
<div class="summary-line total"><span>Total</span><b>${money(o.total)}</b></div>
<div class="detail-actions"><button class="btn black" onclick="setOrderStatus('${o.id}','confirmed')">CONFIRM ORDER</button><button class="btn danger" onclick="setOrderStatus('${o.id}','cancelled')">CANCEL ORDER</button></div>
<button class="print-order-btn" onclick="printOrderLabel('${o.id}')">${svgIcon('print')} IMPRIMER</button>`;
}
function closeOrderDetails(){const d=document.getElementById('order-detail');if(d)d.innerHTML='<div class="empty-detail">Select an order<br><small>Order details will appear here.</small></div>'}
function setOrderStatus(id,status){const orders=getOrders();const o=orders.find(x=>x.id===id);if(!o)return;if(o.status==='delivered'&&status==='cancelled')return; o.status=status;if(status==='delivered')o.deliveredAt=new Date().toISOString();localStorage.setItem('wagwan_orders',JSON.stringify(orders));renderAdmin();showOrder(id);toast(`Order #${id} marked ${status}`)}
function printOrderLabel(id){const o=getOrders().find(x=>x.id===id);if(!o)return;const items=o.items.map(i=>`<div class="item"><b>${i.product}</b><span>Size: ${i.size} · Qty: ${i.qty}</span><span>${money(i.price*i.qty)}</span></div>`).join('');const w=window.open('','_blank','width=500,height=500');w.document.write(`<!doctype html><html><head><title>${o.id}</title><style>@page{size:100mm 100mm;margin:0}*{box-sizing:border-box}body{margin:0;font-family:Arial,sans-serif;color:#111}.label{width:100mm;min-height:100mm;padding:7mm;border:1px solid #111}.brand{font-size:18px;font-weight:900;letter-spacing:3px}.muted{font-size:9px;color:#666}.row{display:flex;justify-content:space-between;gap:10px;margin:3mm 0;font-size:10px}.section{border-top:1px solid #111;padding-top:3mm;margin-top:4mm}.item{display:grid;grid-template-columns:1fr auto;gap:1mm;font-size:9px;margin:2mm 0}.item span{color:#555}.total{font-size:13px;font-weight:900;border-top:1px solid #111;padding-top:3mm;margin-top:4mm}.center{text-align:center;margin-top:4mm;font-size:8px;letter-spacing:1px}</style></head><body><div class="label"><div class="brand">WAGWAN</div><div class="muted">SHIPPING LABEL · CASH ON DELIVERY</div><div class="section"><div class="row"><b>Order</b><b>#${o.id}</b></div><div class="row"><span>Nom & Prénom</span><b>${o.firstName} ${o.lastName}</b></div><div class="row"><span>Numéro</span><b>${o.phone}</b></div><div class="row"><span>Adresse</span><b>${o.address}</b></div><div class="row"><span>Ville</span><b>${o.city}</b></div></div><div class="section"><b>ORDER DETAILS</b>${items}</div><div class="row total"><span>TOTAL</span><span>${money(o.total)}</span></div><div class="center">PAIEMENT À LA LIVRAISON</div></div><script>window.onload=()=>{window.print();}</script></body></html>`);w.document.close()}
function renderAdminProducts(){
const el=document.getElementById('admin-products');if(!el)return;
el.innerHTML=getProducts().map(p=>`<div class="admin-product">
<img src="${assetPath(p.image)}" alt="">
<div><b>${p.name}</b><small>${p.category||'Longsleeves'} ${p.promotion?`· ${p.promotion}`:''}</small></div>
<strong>${money(p.price)} ${p.comparePrice?`<del>${money(p.comparePrice)}</del>`:''}</strong>
<div class="stock-badges">${Object.entries(p.stock||{}).map(([s,n])=>`<span>${s} ${n}</span>`).join('')}</div>
<span class="${p.promotion?'promotion-admin-label':''}">${p.promotion||'Active'}</span>
<div class="product-admin-actions"><button onclick="editProduct('${p.id}')" title="Edit">${svgIcon('edit')}</button><button onclick="deleteProduct('${p.id}')" title="Delete">${svgIcon('trash')}</button></div>
</div>`).join('')||'<div class="empty">No products yet.</div>';
}
function getCategories(){
try{
const saved=JSON.parse(localStorage.getItem('wagwan_categories')||'[]');
const defaults=['Longsleeves','T-Shirts','Hoodies','Shorts','Jogging'];
return [...defaults,...saved.filter(c=>!defaults.includes(c))];
}catch{return ['Longsleeves','T-Shirts','Hoodies','Shorts','Jogging']}
}
function renderCategoryOptions(){
const select=document.querySelector('#product-form select[name="category"]');if(!select)return;
const current=select.value;select.innerHTML=getCategories().map(c=>`<option value="${escapeHtml(c)}">${escapeHtml(c)}</option>`).join('');
if(getCategories().includes(current))select.value=current;
}
function addCategory(){
const input=document.getElementById('new-category-name');if(!input)return;
const name=input.value.trim();if(!name){toast('Enter a category name');return}
if(getCategories().some(c=>c.toLowerCase()===name.toLowerCase())){toast('Category already exists');return}
const saved=JSON.parse(localStorage.getItem('wagwan_categories')||'[]');saved.push(name);localStorage.setItem('wagwan_categories',JSON.stringify(saved));
input.value='';renderCategoryOptions();renderAdminCategories();toast('Category added');
}
function removeCategory(name){
const defaults=['Longsleeves','T-Shirts','Hoodies','Shorts','Jogging'];if(defaults.includes(name)){toast('Default categories cannot be removed');return}
if(!confirm(`Remove category "${name}"?`))return;
const saved=JSON.parse(localStorage.getItem('wagwan_categories')||'[]').filter(c=>c!==name);localStorage.setItem('wagwan_categories',JSON.stringify(saved));
renderCategoryOptions();renderAdminCategories();toast('Category removed');
}
function renderAdminCategories(){
const el=document.getElementById('admin-categories');if(!el)return;
const cats=getCategories();
el.innerHTML=cats.map(c=>{
  const count=getProducts().filter(p=>(p.category||'Longsleeves')===c).length;
  const removable=!['Longsleeves','T-Shirts','Hoodies','Shorts','Jogging'].includes(c);
  const encoded=encodeURIComponent(c);
  return `<div class="category-row"><div class="category-name">${escapeHtml(c)}</div><div class="category-product-count">${count} product${count===1?'':'s'}</div>${removable?`<button class="category-delete" onclick="removeCategory(decodeURIComponent('${encoded}'))" title="Delete category">${svgIcon('trash')}</button>`:''}</div>`;
}).join('');
}
function renderAdminCustomers(){
const el=document.getElementById('admin-customers');if(!el)return;
const map={};
getOrders().forEach(o=>{
const key=o.phone||`${o.firstName} ${o.lastName}`;
if(!map[key])map[key]={name:`${o.firstName} ${o.lastName}`,phone:o.phone,city:o.city,orders:0,total:0};
map[key].orders++;map[key].total+=Number(o.total)||0;
if(new Date(o.createdAt)>new Date(map[key].last||0))map[key].city=o.city;
});
const customers=Object.values(map);
el.innerHTML=customers.length?customers.map(c=>{
const active=c.orders>=3;
return `<tr><td><strong>${c.name}</strong></td><td>${c.phone||'—'}</td><td>${c.city||'—'}</td><td>${c.orders}</td><td><strong>${money(c.total)}</strong></td><td><span class="customer-status ${active?'active':'normal'}">${active?'Actif':'Normal'}</span></td></tr>`
}).join(''):'<tr><td colspan="6" class="empty">No customers yet.</td></tr>';
}
function renderCities(){
const el=document.getElementById('top-cities');if(!el)return;
const counts={};getOrders().forEach(o=>{const city=(o.city||'Non renseignée').trim();counts[city]=(counts[city]||0)+1});
const cities=Object.entries(counts).sort((a,b)=>b[1]-a[1]).slice(0,5);
if(!cities.length){el.innerHTML='<div class="empty">No order data yet.</div>';return}
const max=cities[0][1];
el.innerHTML=cities.map(x=>`<div class="city-row"><strong class="city-count">${x[1]}</strong><span>${escapeHtml(x[0])}</span><div class="bar"><i style="width:${x[1]/max*100}%"></i></div></div>`).join('');
}
function renderStatus(stats){const total=stats.orders||1;const d=document.getElementById('donut');if(d)d.style.background=`conic-gradient(#07915b 0 ${stats.confirmed/total*100}%,#ffb91d ${stats.confirmed/total*100}% ${(stats.confirmed+stats.pending)/total*100}%,#e8333f ${(stats.confirmed+stats.pending)/total*100}% 100%)`;const t=document.getElementById('donut-total');if(t)t.textContent=stats.orders;const l=document.getElementById('status-legend');if(l)l.innerHTML=`<div class="legend-row"><i class="dot"></i>Confirmed ${stats.confirmed}</div><div class="legend-row"><i class="dot yellow"></i>Pending ${stats.pending}</div><div class="legend-row"><i class="dot red"></i>Cancelled ${stats.cancelled}</div>`}
function drawChart(){
const c=document.getElementById('orders-chart');
if(!c)return;
const rect=c.getBoundingClientRect();
const cssW=Math.max(320,Math.round(rect.width||c.parentElement?.clientWidth||700));
const cssH=170;
const dpr=window.devicePixelRatio||1;
c.width=Math.round(cssW*dpr);c.height=Math.round(cssH*dpr);
const ctx=c.getContext('2d');
ctx.setTransform(dpr,0,0,dpr,0,0);
ctx.clearRect(0,0,cssW,cssH);
const orders=getOrders();
const timestamps=orders.map(o=>new Date(o.createdAt).getTime()).filter(Number.isFinite);
const endTs=timestamps.length?Math.max(...timestamps):Date.now();
const end=new Date(endTs);end.setHours(0,0,0,0);
const days=14;
const labels=[];const vals=[];
for(let i=days-1;i>=0;i--){
  const day=new Date(end);day.setDate(end.getDate()-i);
  labels.push(day);
  const next=new Date(day);next.setDate(day.getDate()+1);
  vals.push(orders.filter(o=>{const t=new Date(o.createdAt).getTime();return Number.isFinite(t)&&t>=day.getTime()&&t<next.getTime()}).length);
}
const max=Math.max(4,...vals);
const pad={left:30,right:10,top:18,bottom:28};
const plotW=cssW-pad.left-pad.right,plotH=cssH-pad.top-pad.bottom;
ctx.strokeStyle='#e8eeee';ctx.lineWidth=1;
for(let n=0;n<=4;n++){
  const y=pad.top+plotH-(n/4)*plotH;
  ctx.beginPath();ctx.moveTo(pad.left,y);ctx.lineTo(cssW-pad.right,y);ctx.stroke();
}
ctx.fillStyle='#888';ctx.font='10px Inter, Arial, sans-serif';ctx.textAlign='center';ctx.textBaseline='top';
labels.forEach((day,i)=>{if(i%2===0||i===labels.length-1){const x=pad.left+(i/(labels.length-1))*plotW;ctx.fillText(`${day.getDate()} ${day.toLocaleString('en',{month:'short'})}`,x,cssH-20)}});
const points=vals.map((v,i)=>({x:pad.left+(i/(vals.length-1))*plotW,y:pad.top+plotH-(v/max)*plotH}));
if(points.length){
  const grad=ctx.createLinearGradient(0,pad.top,0,pad.top+plotH);grad.addColorStop(0,'rgba(7,145,91,.18)');grad.addColorStop(1,'rgba(7,145,91,0)');
  ctx.beginPath();ctx.moveTo(points[0].x,pad.top+plotH);points.forEach(p=>ctx.lineTo(p.x,p.y));ctx.lineTo(points.at(-1).x,pad.top+plotH);ctx.closePath();ctx.fillStyle=grad;ctx.fill();
  ctx.strokeStyle='#07915b';ctx.lineWidth=2.5;ctx.lineJoin='round';ctx.lineCap='round';ctx.beginPath();points.forEach((p,i)=>i?ctx.lineTo(p.x,p.y):ctx.moveTo(p.x,p.y));ctx.stroke();
  points.forEach((p,i)=>{if(vals[i]>0){ctx.fillStyle='#07915b';ctx.beginPath();ctx.arc(p.x,p.y,3.5,0,Math.PI*2);ctx.fill()}});
}
}
function adminNavTo(hash){location.hash=hash;applyAdminHash()}
function applyAdminHash(){const hash=location.hash||'#dashboard';document.querySelectorAll('.admin-section').forEach(s=>s.classList.toggle('section-active','#'+s.id===hash));document.querySelectorAll('.admin-sidebar nav a[data-section]').forEach(a=>a.classList.toggle('selected',a.dataset.section===hash.slice(1)));if(hash==='#products'){renderAdminProducts()}if(hash==='#categories'){renderAdminCategories()}if(hash==='#customers'){renderAdminCustomers()}}
function escapeHtml(v){return String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[c]))}
function resetProductImageInputs(){
  const a=document.getElementById('principal-image-input');
  const b=document.getElementById('secondary-images-input');
  if(a)a.value=''; if(b)b.value='';
}
function renderProductImagePreviews(){
  const principal=document.getElementById('principal-image-preview');
  const secondary=document.getElementById('secondary-image-preview');
  const state=window._productImages||{principal:'',secondary:[]};
  if(principal){principal.innerHTML=state.principal?`<div class="image-thumb removable"><img src="${assetPath(state.principal)}" alt="Principal image"><button type="button" onclick="removeProductImage('principal',0)" aria-label="Remove principal image">×</button><small>Principal</small></div>`:'<div class="image-empty">No principal image selected</div>'}
  if(secondary){secondary.innerHTML=(state.secondary||[]).map((src,i)=>`<div class="image-thumb removable"><img src="${assetPath(src)}" alt="Secondary image ${i+1}"><button type="button" onclick="removeProductImage('secondary',${i})" aria-label="Remove secondary image">×</button></div>`).join('')||'<div class="image-empty">No secondary images selected</div>'}
}
function newProductForm(){
  const f=document.getElementById('product-form');if(!f)return;
  f.reset();f.editId.value='';
  window._productImages={principal:'',secondary:[]};window._imagesLoading=false;
  resetProductImageInputs();
  document.querySelectorAll('#stock-fields input[data-size]').forEach(i=>i.value=0);
  renderProductImagePreviews();renderCategoryOptions();
  f.scrollIntoView({behavior:'smooth',block:'start'});
  toast('Ready to add a new product');
}
function clearProductImages(){window._productImages={principal:'',secondary:[]};window._imagesLoading=false;resetProductImageInputs();renderProductImagePreviews()}
function readImageFile(file){
  return new Promise((resolve,reject)=>{
    const reader=new FileReader();
    reader.onerror=reject;
    reader.onload=()=>{
      const img=new Image();
      img.onload=()=>{
        const max=1600;const scale=Math.min(1,max/Math.max(img.naturalWidth,img.naturalHeight));
        const canvas=document.createElement('canvas');canvas.width=Math.max(1,Math.round(img.naturalWidth*scale));canvas.height=Math.max(1,Math.round(img.naturalHeight*scale));
        const ctx=canvas.getContext('2d');ctx.drawImage(img,0,0,canvas.width,canvas.height);
        resolve(canvas.toDataURL('image/jpeg',0.82));
      };
      img.onerror=()=>reject(new Error('Invalid image'));
      img.src=reader.result;
    };
    reader.readAsDataURL(file);
  })
}
async function handlePrincipalImage(input){
  const file=input.files?.[0];
  if(!file)return;
  window._imagesLoading=true;
  try{window._productImages=window._productImages||{principal:'',secondary:[]};window._productImages.principal=await readImageFile(file);renderProductImagePreviews();toast('Principal image selected')}catch{toast('Could not load the principal image')}finally{window._imagesLoading=false;input.value=''}
}
async function handleSecondaryImages(input){
  const files=Array.from(input.files||[]);
  if(!files.length)return;
  window._imagesLoading=true;
  try{const images=await Promise.all(files.map(readImageFile));window._productImages=window._productImages||{principal:'',secondary:[]};window._productImages.secondary=[...(window._productImages.secondary||[]),...images];renderProductImagePreviews();toast(`${images.length} secondary image${images.length>1?'s':''} added`)}catch{toast('Could not load one of the secondary images')}finally{window._imagesLoading=false;input.value=''}
}
function removeProductImage(type,index){
  const state=window._productImages||{principal:'',secondary:[]};
  if(type==='principal')state.principal='';
  else state.secondary.splice(index,1);
  window._productImages=state;renderProductImagePreviews();
}
function saveCustomProduct(){
  const form=document.getElementById('product-form');if(!form)return;
  if(window._imagesLoading){toast('Please wait for the images to finish loading');return}
  const data=new FormData(form);const editId=String(data.get('editId')||'').trim();const id=editId||`custom-${Date.now()}`;
  const state=window._productImages||{principal:'',secondary:[]};
  const stock={};document.querySelectorAll('#stock-fields input[data-size]').forEach(i=>stock[i.dataset.size]=Math.max(0,Number(i.value)||0));
  const name=String(data.get('name')||'').trim();if(!name){toast('Product name is required');return}
  if(!state.principal){toast('Please select one principal image');return}
  const price=Number(data.get('price'))||0;const compare=Number(data.get('comparePrice'))||0;
  const product={id,name,slug:name.toLowerCase().replace(/[^a-z0-9]+/g,'-'),price,comparePrice:compare>price?compare:0,category:data.get('category')||'Longsleeves',promotion:String(data.get('promotion')||'').trim(),color:String(data.get('color')||''),image:state.principal,images:[state.principal,...(state.secondary||[])],description:String(data.get('description')||''),details:['BOXY FIT','UNISEX','RIBBED CREWNECK','WIDE SLEEVES','ORGANIC PRE-SHRUNK COTTON FABRIC'],stock};
  let custom=[];try{custom=JSON.parse(localStorage.getItem('wagwan_products')||'[]')}catch{custom=[]}
  const idx=custom.findIndex(p=>p.id===id);if(idx>=0)custom[idx]=product;else custom.push(product);
  try{localStorage.setItem('wagwan_products',JSON.stringify(custom))}catch{toast('Not enough browser storage for these images');return}
  const message=idx>=0?'Product updated successfully':'Product added successfully';
  newProductForm();renderAdmin();adminNavTo('#products');toast(message);
}
function editProduct(id){
  const p=getProducts().find(x=>x.id===id);if(!p)return;adminNavTo('#products');
  setTimeout(()=>{
    const f=document.getElementById('product-form');if(!f)return;
    f.editId.value=p.id;f.name.value=p.name;f.price.value=p.price;f.comparePrice.value=p.comparePrice||'';renderCategoryOptions();f.category.value=p.category||getCategories()[0];f.promotion.value=p.promotion||'';f.color.value=p.color||'';f.description.value=p.description||'';
    document.querySelectorAll('#stock-fields input[data-size]').forEach(i=>i.value=p.stock?.[i.dataset.size]||0);
    window._productImages={principal:p.image||p.images?.[0]||'',secondary:(p.images||[]).slice(1)};window._imagesLoading=false;resetProductImageInputs();renderProductImagePreviews();
    f.scrollIntoView({behavior:'smooth',block:'start'});
  },50)
}
function deleteProduct(id){if(PRODUCTS.some(p=>p.id===id)){toast('Default products cannot be deleted from the base catalog.');return}if(!confirm('Delete this product?'))return;let custom=JSON.parse(localStorage.getItem('wagwan_products')||'[]');custom=custom.filter(p=>p.id!==id);localStorage.setItem('wagwan_products',JSON.stringify(custom));renderAdmin();toast('Product deleted')}
function openSearch(){document.getElementById('search-modal')?.classList.add('open');document.getElementById('search-input')?.focus()}function closeSearch(){document.getElementById('search-modal')?.classList.remove('open')}function searchProducts(q){const el=document.getElementById('search-results');if(!el)return;const found=getProducts().filter(p=>p.name.toLowerCase().includes(q.toLowerCase()));el.innerHTML=q?found.map(p=>`<a class="search-result" href="product.html?product=${p.id}"><img src="${p.image}"><div><b>${p.name}</b><p>${money(p.price)}</p></div></a>`).join(''):'<p>Search Drop 001...</p>'}
function toggleMobileMenu(){
  const menu=document.getElementById('mobile-menu');
  const btn=document.querySelector('.mobile-menu-toggle');
  if(!menu)return;
  const open=menu.classList.toggle('open');
  document.body.classList.toggle('menu-open',open);
  if(btn)btn.setAttribute('aria-expanded',open?'true':'false');
}
function closeMobileMenu(){
  const menu=document.getElementById('mobile-menu');
  const btn=document.querySelector('.mobile-menu-toggle');
  if(menu)menu.classList.remove('open');
  document.body.classList.remove('menu-open');
  if(btn)btn.setAttribute('aria-expanded','false');
}
function toast(msg){let t=document.getElementById('toast');if(!t){t=document.createElement('div');t.id='toast';t.style.cssText='position:fixed;right:20px;bottom:20px;background:#080808;color:#fff;padding:14px 18px;font-size:11px;z-index:2000;box-shadow:0 10px 30px #0003';document.body.appendChild(t)}t.textContent=msg;t.style.opacity=1;clearTimeout(window._toast);window._toast=setTimeout(()=>t.style.opacity=0,2200)}
window.addEventListener('hashchange',()=>{if(document.querySelector('.admin-body'))applyAdminHash()});document.addEventListener('DOMContentLoaded',()=>{updateCartCount();renderHome();renderShop();renderProduct();renderCart();renderCheckout();renderSuccess();if(document.querySelector('.admin-body'))renderAdmin()});

window.addEventListener('storage',()=>{if(document.querySelector('.admin-body'))renderAdmin()});
window.addEventListener('focus',()=>{if(document.querySelector('.admin-body'))renderAdmin()});
setInterval(()=>{if(document.querySelector('.admin-body')&&document.visibilityState==='visible')renderAdmin()},1000);

window.addEventListener('storage',()=>{
if(!document.querySelector('.admin-body')){
updateCartCount();renderHome();renderShop();renderProduct();renderCart();
}
});

/* ========================= WAGWAN SUPABASE PRODUCTION LAYER =========================
   This layer replaces browser localStorage for catalog/orders/admin data.
   Cart remains local because it is temporary client state; checkout is committed atomically by RPC.
*/
(function(){
  const SB=()=>window.wagwanSB;
  const configured=()=>!!SB();
  const state=window.__WAGWAN_STATE||(window.__WAGWAN_STATE={products:[],categories:[],orders:[],ready:false});
  const defaults=['Longsleeves','T-Shirts','Hoodies','Shorts','Jogging'];
  const resolveUrl=(u)=>{
    if(!u)return '';
    if(/^https?:\/\//i.test(u)||u.startsWith('data:')||u.startsWith('blob:'))return u;
    const clean=String(u).replace(/^\.\//,'').replace(/^\/+/, '');
    const base=location.pathname.includes('/admin/')?new URL('../', location.href):new URL('./', location.href);
    return new URL(clean, base).href;
  };
  const slugify=s=>String(s||'product').toLowerCase().trim().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'')||'product';
  const mapProduct=(p,imgs)=>({
    id:p.id,slug:p.slug,name:p.name,color:p.color||'',description:p.description||'',details:Array.isArray(p.details)?p.details:['BOXY FIT','UNISEX','RIBBED CREWNECK','WIDE SLEEVES','ORGANIC PRE-SHRUNK COTTON FABRIC'],
    price:Number(p.price)||0,comparePrice:p.compare_price==null?null:Number(p.compare_price),promotion:p.promotion||'',category:p.categories?.name||p.category_name||'',
    image:resolveUrl(p.main_image_url),images:[resolveUrl(p.main_image_url),...(imgs||[]).map(x=>resolveUrl(x.image_url))].filter(Boolean),
    stock:{S:Number(p.stock_s)||0,M:Number(p.stock_m)||0,L:Number(p.stock_l)||0,XL:Number(p.stock_xl)||0}
  });
  async function loadCatalog(){
    if(!configured())return;
    const {data:cats,error:ce}=await SB().from('categories').select('*').eq('is_active',true).order('name'); if(ce)throw ce;
    const {data:ps,error:pe}=await SB().from('products').select('*,categories(name)').eq('is_active',true).order('created_at'); if(pe)throw pe;
    const ids=(ps||[]).map(p=>p.id); let imgs=[];
    if(ids.length){const r=await SB().from('product_images').select('*').in('product_id',ids).order('sort_order'); if(r.error)throw r.error; imgs=r.data||[];}
    state.categories=cats||[];state.products=(ps||[]).map(p=>mapProduct(p,imgs.filter(i=>i.product_id===p.id)));state.ready=true;
  }
  async function loadOrders(){
    if(!configured())return;
    const {data,error}=await SB().from('orders').select('*,order_items(*)').order('created_at',{ascending:false}); if(error)throw error;
    state.orders=(data||[]).map(o=>({id:`WG-${String(o.order_number).padStart(4,'0')}`,uuid:o.id,orderNumber:o.order_number,firstName:o.first_name,lastName:o.last_name,phone:o.phone,email:o.customer_email||'',address:o.address,city:o.city,status:o.status,payment:o.payment_method,subtotal:Number(o.subtotal),shipping:Number(o.shipping),couponCode:o.coupon_code||'',couponDiscount:Number(o.coupon_discount||0),loyaltyPointsUsed:Number(o.loyalty_points_used||0),loyaltyDiscount:Number(o.loyalty_discount||0),discountTotal:Number(o.discount_total||0),total:Number(o.total),createdAt:o.created_at,updatedAt:o.updated_at,confirmedAt:o.confirmed_at,cancelledAt:o.cancelled_at,deliveredAt:o.delivered_at,items:(o.order_items||[]).map(i=>({productId:i.product_id,product:i.product_name,productImage:i.product_image_url,size:i.size,qty:i.quantity,price:Number(i.unit_price),lineTotal:Number(i.line_total)}))}));
  }
  const getProductsSB=()=>state.products.length?state.products:[];
  const getOrdersSB=()=>state.orders||[];
  window.getProducts=()=>getProductsSB();
  window.getOrders=()=>getOrdersSB();
  window.getCategories=()=>state.categories.length?state.categories.map(c=>c.name):defaults.slice();
  window.getSizeStock=(p,size)=>Math.max(0,Number(p?.stock?.[size])||0);

  function renderAll(){
    try{updateCartCount();renderHome();renderShop();renderProduct();renderCart();renderCheckout();renderSuccess();}catch(e){console.error(e)}
  }
  async function bootstrapStore(){
    if(!configured())return;
    try{await loadCatalog();renderAll();}catch(e){console.error(e);toast('Unable to load store data from Supabase');}
  }

  async function submitOrderSB(e){
    e.preventDefault();
    const form=e.currentTarget,data=Object.fromEntries(new FormData(form)),err=document.getElementById('checkout-error'); if(err)err.textContent='';
    const normalizedPhone=normalizeMoroccanPhone(data.phone);
    if(!normalizedPhone){if(err)err.textContent='Numéro marocain invalide. Utilisez 06/07, 6/7, +212 6/7, 212 6/7 ou 00212 6/7.';return;}
    const cart=getCart(); if(!cart.length){if(err)err.textContent='Your cart is empty.';return;}
    if(!configured()){if(err)err.textContent='Supabase is not configured yet.';return;}
    const items=cart.map(x=>({product_id:x.id,size:x.size,quantity:Number(x.qty)}));
    try{
      const {data:result,error}=await SB().rpc('create_cod_order',{p_first_name:data.firstName,p_last_name:data.lastName,p_phone:normalizedPhone,p_email:String(data.email||'').trim().toLowerCase(),p_address:data.address,p_city:data.city,p_items:items});
      if(error)throw error;
      localStorage.removeItem('wagwan_cart');
      await loadCatalog();
      const orderNumber=String(result.order_number).padStart(4,'0');
      location.href='order-success.html?order=WG-'+orderNumber;
    }catch(ex){console.error(ex);if(err)err.textContent=ex.message?.includes('Out of stock')?ex.message:'Unable to place the order. Please try again.';}
  }
  window.submitOrder=submitOrderSB;
  window.renderCheckout=function(){
    const root=document.getElementById('checkout-summary');if(!root)return;const items=cartDetailed();
    if(!items.length){root.innerHTML='<div class="empty">Your cart is empty.</div>';return;}
    root.innerHTML=`<h2>ORDER SUMMARY</h2>${items.map(x=>`<div class="summary-line"><span>${escapeHtml(x.p.name)} · ${x.size} × ${x.qty}</span><b>${money(x.p.price*x.qty)}</b></div>`).join('')}<div class="summary-line"><span>Subtotal</span><b>${money(totals().subtotal)}</b></div><div class="summary-line"><span>Delivery</span><b>FREE</b></div><div class="summary-line total"><span>TOTAL</span><b>${money(totals().total)}</b></div>`;
    const form=document.getElementById('checkout-form');if(form&&!form.dataset.sbBound){form.dataset.sbBound='1';form.addEventListener('submit',submitOrderSB)}
  };

  async function adminReady(){
    if(!configured()){location.href='login.html';return false;}
    const {data:{session}}=await SB().auth.getSession(); if(!session){location.href='login.html';return false;}
    const {data:profile,error}=await SB().from('profiles').select('role,full_name').eq('id',session.user.id).single();
    if(error||profile?.role!=='admin'){await SB().auth.signOut();location.href='login.html?error=unauthorized';return false;}
    const userEl=document.querySelector('.admin-user span');if(userEl)userEl.innerHTML=`${escapeHtml(profile.full_name||session.user.email||'Admin')}<small>Admin</small>`;
    return true;
  }

  function adminStatsSB(){const o=getOrdersSB(),confirmed=o.filter(x=>x.status==='confirmed'||x.status==='delivered'),cancelled=o.filter(x=>x.status==='cancelled');return{orders:o.length,revenue:confirmed.reduce((s,x)=>s+x.total,0),confirmed:confirmed.length,cancelled:cancelled.length,pending:o.filter(x=>x.status==='pending').length}}
  window.adminStats=adminStatsSB;
  window.renderAdmin=async function(){
    const stats=adminStatsSB();const st=document.getElementById('admin-stats');
    if(st)st.innerHTML=[['TOTAL ORDERS',stats.orders,'Live','▣'],['TOTAL REVENUE',money(stats.revenue),'Live','◉'],['CONFIRMED ORDERS',stats.confirmed,'Live','✓'],['CANCELLED ORDERS',stats.cancelled,'Live','×']].map(x=>`<div class="stat"><div class="stat-top"><span>${x[0]}</span><span class="stat-icon">${x[3]}</span></div><div class="stat-value">${x[1]}</div><span class="trend">${x[2]}</span></div>`).join('');
    const badge=document.getElementById('pending-badge');if(badge)badge.textContent=stats.pending;
    renderAdminOrders();renderAdminProducts();renderAdminCategories();renderAdminCustomers();renderCities();renderCategoryOptions();drawChart();renderStatus(stats);applyAdminHash();
  };
  window.renderAdminOrders=window.renderAdminOrders||function(){};
  window.renderAdminOrders=function(){
    const body=document.getElementById('orders-table');if(!body)return;let o=getOrdersSB();const q=(document.getElementById('admin-search')?.value||'').toLowerCase();
    if(q)o=o.filter(x=>[x.id,x.firstName,x.lastName,x.phone,x.email,x.city,...x.items.map(i=>i.product)].join(' ').toLowerCase().includes(q));
    body.innerHTML=o.slice(0,50).map(x=>{const item=x.items?.[0]||{};const wa=whatsappLink(x.phone,`Bonjour ${x.firstName||''}, nous vous contactons de WAGWAN pour confirmer votre commande #${x.id}.`);return `<tr><td><strong>#${x.id}</strong></td><td class="customer-cell"><span>${escapeHtml(x.firstName||'')} ${escapeHtml(x.lastName||'')}</span></td><td><div class="order-product-cell"><img src="${resolveUrl(item.productImage||'assets/wagwan-logo.png')}" alt=""><strong>${escapeHtml(item.product||'—')}</strong></div></td><td class="order-phone"><a href="${wa}" target="_blank" rel="noopener">${escapeHtml(x.phone||'—')}</a></td><td>${escapeHtml(x.city||'—')}</td><td><strong>${money(x.total)}</strong></td><td><span class="status-pill ${x.status}">${orderStatusLabel(x.status)}</span></td><td>${new Date(x.createdAt).toLocaleDateString('en-GB')}</td><td><div class="order-actions"><button class="action-btn confirm" title="Confirm" onclick="setOrderStatus('${x.uuid}','confirmed')">${svgIcon('check')}</button><button class="action-btn cancel" title="Cancel" onclick="setOrderStatus('${x.uuid}','cancelled')">${svgIcon('close')}</button><button class="action-btn view" title="View order" onclick="showOrder('${x.uuid}')">${svgIcon('eye')}</button></div></td></tr>`}).join('')||'<tr><td colspan="9" class="empty">No orders yet.</td></tr>';
  };
  function findOrder(id){return getOrdersSB().find(o=>o.uuid===id||o.id===id)}
  window.showOrder=function(id){const o=findOrder(id),d=document.getElementById('order-detail');if(!o||!d)return;const wa=whatsappLink(o.phone,`Bonjour ${o.firstName||''}, nous vous contactons de WAGWAN pour confirmer votre commande #${o.id}.`);d.innerHTML=`<div class="panel-head"><h2>Order #${o.id}</h2><button class="detail-close" onclick="closeOrderDetails()">×</button></div><div class="detail-status-row"><span class="status-pill ${o.status}">${orderStatusLabel(o.status)}</span></div><div class="detail-section"><b>Customer Information</b><div class="customer-info"><p><span class="info-icon">${svgIcon('user')}</span><span><small>Full Name</small><strong>${escapeHtml(o.firstName)} ${escapeHtml(o.lastName)}</strong></span></p><p><span class="info-icon">${svgIcon('phone')}</span><span><small>Phone Number</small><a class="detail-phone" href="${wa}" target="_blank" rel="noopener">${escapeHtml(o.phone)}</a></span></p><p><span class="info-icon">${svgIcon('mail')}</span><span><small>Email</small><strong>${escapeHtml(o.email||'—')}</strong></span></p><p><span class="info-icon">${svgIcon('location')}</span><span><small>Address</small><strong>${escapeHtml(o.address)}</strong></span></p><p><span class="info-icon">${svgIcon('city')}</span><span><small>City</small><strong>${escapeHtml(o.city)}</strong></span></p></div></div><div class="detail-section"><b>Order Items</b>${o.items.map(i=>`<div class="detail-item"><img src="${resolveUrl(i.productImage||'assets/wagwan-logo.png')}" alt=""><div><strong>${escapeHtml(i.product)}</strong><span>Size du Produit : <b>${escapeHtml(i.size)}</b></span><span>Quantité du Produit : <b>${i.qty}</b></span></div><strong>${money(i.lineTotal)}</strong></div>`).join('')}</div><div class="detail-section order-discount-breakdown"><b>Order Summary</b><div class="summary-line"><span>Subtotal</span><b>${money(o.subtotal)}</b></div>${o.couponDiscount>0?`<div class="summary-line"><span>Promo Code${o.couponCode?` (${escapeHtml(o.couponCode)})`:''}</span><b>-${money(o.couponDiscount)}</b></div>`:''}${o.loyaltyDiscount>0?`<div class="summary-line"><span>WAGWAN Points${o.loyaltyPointsUsed?` (${o.loyaltyPointsUsed} points)`:''}</span><b>-${money(o.loyaltyDiscount)}</b></div>`:''}<div class="summary-line"><span>Delivery</span><b>${o.shipping>0?money(o.shipping):'FREE'}</b></div><div class="summary-line total"><span>Total</span><b>${money(o.total)}</b></div></div><div class="detail-actions"><button class="btn black" onclick="setOrderStatus('${o.uuid}','confirmed')">CONFIRM ORDER</button><button class="btn danger" onclick="setOrderStatus('${o.uuid}','cancelled')">CANCEL ORDER</button></div>${(o.status==='confirmed'||o.status==='delivered')?`<button class="print-order-btn" onclick="printOrderLabel('${o.uuid}')">${svgIcon('print')} IMPRIMER LE RECU</button>`:''}`};
  window.setOrderStatus=async function(id,status){const o=findOrder(id);if(!o)return;try{const patch={status};if(status==='delivered')patch.delivered_at=new Date().toISOString();const {error}=await SB().from('orders').update(patch).eq('id',o.uuid);if(error)throw error;await loadOrders();renderAdmin();showOrder(o.uuid);toast(`Order #${o.id} marked ${status}`)}catch(e){console.error(e);toast('Could not update order')}};
  window.printOrderLabel=function(id){const o=findOrder(id);if(!o)return;if(o.status!=='confirmed'&&o.status!=='delivered'){toast('Receipt available only for confirmed orders');return;}const items=o.items.map(i=>`<div class="item"><div><b>${escapeHtml(i.product)}</b><span>Size: ${escapeHtml(i.size)} · Qty: ${i.qty}</span></div><span>${money(i.lineTotal)}</span></div>`).join('');const discountRows=`${o.couponDiscount>0?`<div class="row discount"><span>Promo Code${o.couponCode?` (${escapeHtml(o.couponCode)})`:''}</span><b>-${money(o.couponDiscount)}</b></div>`:''}${o.loyaltyDiscount>0?`<div class="row discount"><span>WAGWAN Points${o.loyaltyPointsUsed?` (${o.loyaltyPointsUsed} points)`:''}</span><b>-${money(o.loyaltyDiscount)}</b></div>`:''}`;const w=window.open('','_blank','width=600,height=800');if(!w){toast('Allow pop-ups to print the receipt');return;}w.document.write(`<!doctype html><html><head><title>WAGWAN Receipt ${escapeHtml(o.id)}</title><style>@page{size:80mm auto;margin:0}*{box-sizing:border-box}body{margin:0;font-family:Arial,sans-serif;color:#111;background:#fff}.receipt{width:80mm;padding:7mm}.brand{font-size:22px;font-weight:900;letter-spacing:5px;text-align:center}.title{text-align:center;font-size:10px;letter-spacing:2px;margin-top:2mm}.muted{font-size:9px;color:#666}.section{border-top:1px solid #111;padding-top:3mm;margin-top:4mm}.row{display:flex;justify-content:space-between;gap:8px;margin:2mm 0;font-size:10px}.item{display:flex;justify-content:space-between;gap:8px;font-size:10px;margin:3mm 0}.item span{display:block;color:#666;font-size:9px;margin-top:1mm}.discount{color:#078b55}.total{font-size:14px;font-weight:900;border-top:1px solid #111;padding-top:3mm;margin-top:4mm}.status{text-align:center;font-weight:900;font-size:10px;margin-top:3mm}.footer{text-align:center;border-top:1px solid #ddd;margin-top:5mm;padding-top:3mm;font-size:8px;color:#666}</style></head><body><div class="receipt"><div class="brand">WAGWAN</div><div class="title">ORDER RECEIPT</div><div class="section"><div class="row"><span>Order</span><b>${escapeHtml(o.id)}</b></div><div class="row"><span>Date</span><b>${escapeHtml(new Date(o.createdAt).toLocaleString('fr-FR'))}</b></div><div class="row"><span>Status</span><b>${escapeHtml(o.status.toUpperCase())}</b></div><div class="row"><span>Payment</span><b>${escapeHtml(o.payment||'COD')}</b></div></div><div class="section"><b>CUSTOMER</b><div class="row"><span>Name</span><b>${escapeHtml(o.firstName)} ${escapeHtml(o.lastName)}</b></div><div class="row"><span>Phone</span><b>${escapeHtml(o.phone)}</b></div>${o.email?`<div class="row"><span>Email</span><b>${escapeHtml(o.email)}</b></div>`:''}<div class="row"><span>Address</span><b>${escapeHtml(o.address)}</b></div><div class="row"><span>City</span><b>${escapeHtml(o.city)}</b></div></div><div class="section"><b>ITEMS</b>${items}</div><div class="section"><div class="row"><span>Subtotal</span><b>${money(o.subtotal)}</b></div>${discountRows}<div class="row"><span>Delivery</span><b>${o.shipping>0?money(o.shipping):'FREE'}</b></div><div class="row total"><span>TOTAL</span><b>${money(o.total)}</b></div></div><div class="status">CASH ON DELIVERY</div><div class="footer">Thank you for shopping with WAGWAN.</div></div><script>window.onload=()=>{window.focus();window.print();}</script></body></html>`);w.document.close()};

  async function uploadImage(file,folder){
    const ext=(file.name.split('.').pop()||'jpg').toLowerCase().replace(/[^a-z0-9]/g,'')||'jpg';const path=`${folder}/${crypto.randomUUID()}.${ext}`;
    const {error}=await SB().storage.from('product-images').upload(path,file,{cacheControl:'31536000',upsert:false,contentType:file.type||'image/jpeg'});if(error)throw error;
    return SB().storage.from('product-images').getPublicUrl(path).data.publicUrl;
  }
  window._productUploadFiles={principal:null,secondary:[]};window._productImages={principal:'',secondary:[]};
  window.handlePrincipalImage=function(input){const f=input.files?.[0];if(!f)return;window._productUploadFiles.principal=f;const r=new FileReader();r.onload=()=>{window._productImages.principal=r.result;renderProductImagePreviews()};r.readAsDataURL(f);input.value=''};
  window.handleSecondaryImages=function(input){const fs=[...(input.files||[])];window._productUploadFiles.secondary.push(...fs);fs.forEach(f=>{const r=new FileReader();r.onload=()=>{window._productImages.secondary.push(r.result);renderProductImagePreviews()};r.readAsDataURL(f)});input.value=''};
  window.removeProductImage=function(type,index){if(type==='principal'){window._productUploadFiles.principal=null;window._productImages.principal='';}else{window._productUploadFiles.secondary.splice(index,1);window._productImages.secondary.splice(index,1)}renderProductImagePreviews()};
  window.renderProductImagePreviews=function(){const p=document.getElementById('principal-image-preview'),s=document.getElementById('secondary-image-preview');if(p)p.innerHTML=window._productImages.principal?`<div class="preview-tile"><img src="${window._productImages.principal}"><button type="button" onclick="removeProductImage('principal',0)">×</button></div>`:'';if(s)s.innerHTML=window._productImages.secondary.map((img,i)=>`<div class="preview-tile"><img src="${img}"><button type="button" onclick="removeProductImage('secondary',${i})">×</button></div>`).join('')};
  window.clearProductImages=function(){window._productImages={principal:'',secondary:[]};window._productUploadFiles={principal:null,secondary:[]};document.getElementById('principal-image-input')?.removeAttribute('value');renderProductImagePreviews()};
  window.newProductForm=function(){const f=document.getElementById('product-form');if(!f)return;f.reset();f.elements.editId.value='';clearProductImages();document.querySelector('#products .form-title')?.scrollIntoView({behavior:'smooth',block:'start'});toast('New product form ready')};
  window.editProduct=function(id){const p=getProductsSB().find(x=>x.id===id);if(!p)return;const f=document.getElementById('product-form');if(!f)return;f.elements.editId.value=p.id;f.elements.name.value=p.name;f.elements.category.value=p.category;f.elements.price.value=p.price;f.elements.comparePrice.value=p.comparePrice??'';f.elements.promotion.value=p.promotion||'';f.elements.color.value=p.color||'';f.elements.description.value=p.description||'';document.querySelectorAll('#stock-fields input[data-size]').forEach(i=>i.value=p.stock[i.dataset.size]??0);window._productUploadFiles={principal:null,secondary:[]};window._productImages={principal:p.image,secondary:p.images.slice(1)};renderProductImagePreviews();location.hash='#products';toast('Product loaded for editing')};
  window.saveCustomProduct=async function(){
    const f=document.getElementById('product-form');if(!f)return;const btn=f.querySelector('button[type=submit]');if(btn){btn.disabled=true;btn.textContent='SAVING...'}
    try{
      const {data:{user}}=await SB().auth.getUser();if(!user)throw new Error('Admin session expired');
      const editId=f.elements.editId.value||null;const name=f.elements.name.value.trim();const categoryName=f.elements.category.value;const price=Number(f.elements.price.value);const compare=f.elements.comparePrice.value===''?null:Number(f.elements.comparePrice.value);const promotion=f.elements.promotion.value.trim()||null;const color=f.elements.color.value.trim();const description=f.elements.description.value.trim();const stock={};document.querySelectorAll('#stock-fields input[data-size]').forEach(i=>stock[i.dataset.size]=Math.max(0,Number(i.value)||0));if(!window._productImages.principal&&!editId)throw new Error('Principal image is required');
      let categoryId=state.categories.find(c=>c.name===categoryName)?.id;if(!categoryId){const cr=await SB().from('categories').select('id').eq('name',categoryName).single();categoryId=cr.data?.id}
      let mainUrl=editId?getProductsSB().find(p=>p.id===editId)?.image:null;if(window._productUploadFiles.principal)mainUrl=await uploadImage(window._productUploadFiles.principal,`products/${editId||crypto.randomUUID()}`);else if(window._productImages.principal&&!/^data:|^blob:/.test(window._productImages.principal))mainUrl=window._productImages.principal;
      const payload={name,slug:slugify(name)+'-'+Date.now().toString(36),category_id:categoryId||null,color,description,details:['BOXY FIT','UNISEX','RIBBED CREWNECK','WIDE SLEEVES','ORGANIC PRE-SHRUNK COTTON FABRIC'],price,compare_price:compare,promotion,main_image_url:mainUrl,is_active:true,stock_s:stock.S,stock_m:stock.M,stock_l:stock.L,stock_xl:stock.XL,updated_at:new Date().toISOString()};
      let productId=editId;
      if(editId){delete payload.slug;const {error}=await SB().from('products').update(payload).eq('id',editId);if(error)throw error;}
      else{const {data,error}=await SB().from('products').insert(payload).select('id').single();if(error)throw error;productId=data.id}
      const current=window._productImages.secondary.filter(u=>/^https?:\/\//.test(u));
      if(window._productUploadFiles.secondary.length){for(const file of window._productUploadFiles.secondary){current.push(await uploadImage(file,`products/${productId}`))}}
      await SB().from('product_images').delete().eq('product_id',productId);if(current.length){const rows=current.map((u,i)=>({product_id:productId,image_url:u,sort_order:i}));const {error}=await SB().from('product_images').insert(rows);if(error)throw error}
      await loadCatalog();renderAll();renderAdmin();newProductForm();toast(editId?'Product updated successfully':'Product added successfully');
    }catch(e){console.error(e);toast(e.message||'Could not save product')}finally{if(btn){btn.disabled=false;btn.textContent='SAVE PRODUCT'}}
  };
  window.deleteProduct=async function(id){const p=getProductsSB().find(x=>x.id===id);if(!p)return;if(!confirm(`Delete ${p.name}?`))return;try{const {error}=await SB().from('products').delete().eq('id',id);if(error)throw error;await loadCatalog();renderAdmin();renderAll();toast('Product deleted')}catch(e){toast('Unable to delete product')}};
  window.renderAdminProducts=function(){const el=document.getElementById('admin-products');if(!el)return;el.innerHTML=getProductsSB().map(p=>`<div class="admin-product"><img src="${p.image}" alt=""><div><b>${escapeHtml(p.name)}</b><small>${escapeHtml(p.category||'')} ${p.promotion?`· ${escapeHtml(p.promotion)}`:''}</small></div><strong>${money(p.price)} ${p.comparePrice?`<del>${money(p.comparePrice)}</del>`:''}</strong><div class="stock-badges">${Object.entries(p.stock).map(([s,n])=>`<span>${s} ${n}</span>`).join('')}</div><span class="${p.promotion?'promotion-admin-label':''}">${escapeHtml(p.promotion||'Active')}</span><div class="product-admin-actions"><button onclick="editProduct('${p.id}')">${svgIcon('edit')}</button><button onclick="deleteProduct('${p.id}')">${svgIcon('trash')}</button></div></div>`).join('')||'<div class="empty">No products yet.</div>'};
  window.renderCategoryOptions=function(){const select=document.querySelector('#product-form select[name="category"]');if(!select)return;const cur=select.value;select.innerHTML=state.categories.map(c=>`<option value="${escapeHtml(c.name)}">${escapeHtml(c.name)}</option>`).join('');if(cur)select.value=cur};
  window.addCategory=async function(){const input=document.getElementById('new-category-name');const name=input?.value.trim();if(!name)return toast('Enter a category name');if(state.categories.some(c=>c.name.toLowerCase()===name.toLowerCase()))return toast('Category already exists');try{const {error}=await SB().from('categories').insert({name,is_active:true,is_system:false});if(error)throw error;await loadCatalog();renderAdmin();input.value='';toast('Category added')}catch(e){toast('Could not add category')}};
  window.removeCategory=async function(name){const c=state.categories.find(x=>x.name===name);if(!c||c.is_system)return toast('System categories cannot be removed');if(!confirm(`Remove category "${name}"?`))return;try{const {error}=await SB().from('categories').delete().eq('id',c.id);if(error)throw error;await loadCatalog();renderAdmin();toast('Category removed')}catch(e){toast('Could not remove category')}};
  window.renderAdminCategories=function(){const el=document.getElementById('admin-categories');if(!el)return;el.innerHTML=state.categories.map(c=>{const count=getProductsSB().filter(p=>p.category===c.name).length;return `<div class="category-row"><div class="category-name">${escapeHtml(c.name)}</div><div class="category-product-count">${count} product${count===1?'':'s'}</div>${c.is_system?'':`<button class="category-delete" onclick="removeCategory('${escapeHtml(c.name).replace(/'/g,"\\'")}')">${svgIcon('trash')}</button>`}</div>`}).join('')};
  window.renderAdminCustomers=function(){const el=document.getElementById('admin-customers');if(!el)return;const map={};getOrdersSB().forEach(o=>{const k=o.phone||`${o.firstName} ${o.lastName}`;if(!map[k])map[k]={name:`${o.firstName} ${o.lastName}`,phone:o.phone,city:o.city,orders:0,total:0};map[k].orders++;map[k].total+=o.total;if(new Date(o.createdAt)>new Date(map[k].last||0)){map[k].city=o.city;map[k].last=o.createdAt}});const cs=Object.values(map);el.innerHTML=cs.length?cs.map(c=>`<tr><td><strong>${escapeHtml(c.name)}</strong></td><td>${escapeHtml(c.phone)}</td><td>${escapeHtml(c.city)}</td><td>${c.orders}</td><td><strong>${money(c.total)}</strong></td><td><span class="customer-status ${c.orders>=3?'active':'normal'}">${c.orders>=3?'Actif':'Normal'}</span></td></tr>`).join(''):'<tr><td colspan="6" class="empty">No customers yet.</td></tr>'};
  window.renderCities=function(){const el=document.getElementById('top-cities');if(!el)return;const counts={};getOrdersSB().forEach(o=>{const city=(o.city||'Non renseignée').trim();counts[city]=(counts[city]||0)+1});const cities=Object.entries(counts).sort((a,b)=>b[1]-a[1]).slice(0,5);if(!cities.length){el.innerHTML='<div class="empty">No order data yet.</div>';return}const max=cities[0][1];el.innerHTML=cities.map(([city,n])=>`<div class="city-row"><strong class="city-count">${n}</strong><span>${escapeHtml(city)}</span><div class="bar"><i style="width:${n/max*100}%"></i></div></div>`).join('')};

  async function start(){
    if(!configured())return;
    if(document.querySelector('.admin-body')){
      const ok=await adminReady();if(!ok)return;
      document.body.style.visibility='visible';
      try{await Promise.all([loadCatalog(),loadOrders()]);await renderAdmin();}catch(e){console.error(e);toast('Admin data could not be loaded')}
      const channel=SB().channel('wagwan-admin').on('postgres_changes',{event:'*',schema:'public',table:'orders'},async()=>{await loadOrders();renderAdmin()}).on('postgres_changes',{event:'*',schema:'public',table:'products'},async()=>{await loadCatalog();renderAdmin();renderAll()}).on('postgres_changes',{event:'*',schema:'public',table:'categories'},async()=>{await loadCatalog();renderAdmin()}).subscribe();
      window.addEventListener('beforeunload',()=>{try{SB().removeChannel(channel)}catch{}});
    }else{
      await bootstrapStore();
    }
  }
  document.addEventListener('DOMContentLoaded',start);
})();
window.adminLogout=async function(){if(window.wagwanSB){await window.wagwanSB.auth.signOut()}location.href='login.html'};


/* ========================= WAGWAN FEEDBACK SYSTEM ========================= */
(function(){
  const feedbackState={items:[],filter:'all',publicPage:0,publicPageSize:6};
  const publicPageSize=()=>window.matchMedia('(max-width: 640px)').matches?3:6;
  const sb=()=>window.wagwanSB;
  const configured=()=>!!sb();
  function safe(v){return typeof escapeHtml==='function'?escapeHtml(v):String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[c]));}
  function stars(n){return Array.from({length:5},(_,i)=>`<span class="feedback-star ${i<n?'filled':''}">★</span>`).join('')}
  function formatDate(v){try{return new Intl.DateTimeFormat('fr-FR',{day:'2-digit',month:'short',year:'numeric'}).format(new Date(v))}catch{return ''}}
  async function loadPublicFeedback(){
    const el=document.getElementById('public-feedback-list'); if(!el||!configured())return;
    const {data,error}=await sb().from('feedback').select('id,customer_name,city,rating,comment,created_at').eq('status','approved').order('created_at',{ascending:false}).limit(100);
    if(error){console.error(error);el.innerHTML='<div class="feedback-empty">Feedback will appear here soon.</div>';return;}
    feedbackState.items=data||[];
    const total=feedbackState.items.length;
    const average=total?feedbackState.items.reduce((sum,x)=>sum+(Number(x.rating)||0),0)/total:0;
    const score=document.getElementById('feedback-rating-score');
    const ratingStars=document.getElementById('feedback-rating-stars');
    const count=document.getElementById('feedback-rating-count');
    if(score)score.textContent=total?average.toFixed(1):'—';
    if(ratingStars){const rounded=Math.round(average);ratingStars.textContent=Array.from({length:5},(_,i)=>i<rounded?'★':'☆').join('');ratingStars.setAttribute('aria-label',total?`Average rating ${average.toFixed(1)} out of 5`:'No reviews yet')}
    if(count)count.textContent=`${total} REVIEW${total===1?'':'S'}`;
    if(!data?.length){el.innerHTML='<div class="feedback-empty">Be the first to share your WAGWAN experience.</div>';return;}
    const pageSize=publicPageSize();
    const maxPage=Math.max(0,Math.ceil(data.length/pageSize)-1);
    if(feedbackState.publicPage>maxPage)feedbackState.publicPage=maxPage;
    const start=feedbackState.publicPage*pageSize;
    const visible=data.slice(start,start+pageSize);
    el.innerHTML=`${data.length>pageSize?`<div class="feedback-carousel-toolbar"><button type="button" class="feedback-carousel-arrow" id="feedback-prev" aria-label="Previous feedback" ${feedbackState.publicPage===0?'disabled':''}>←</button><span>${start+1}–${Math.min(start+pageSize,data.length)} / ${data.length}</span><button type="button" class="feedback-carousel-arrow" id="feedback-next" aria-label="Next feedback" ${feedbackState.publicPage>=maxPage?'disabled':''}>→</button></div>`:''}<div class="feedback-list">${visible.map(x=>`<article class="feedback-card"><div class="feedback-card-top"><div>${stars(Number(x.rating))}</div><span>${formatDate(x.created_at)}</span></div><p>“${safe(x.comment)}”</p><div class="feedback-author"><strong>${safe(x.customer_name)}</strong><span>${safe(x.city)}</span></div></article>`).join('')}</div>`;
    el.querySelector('#feedback-prev')?.addEventListener('click',()=>{feedbackState.publicPage=Math.max(0,feedbackState.publicPage-1);loadPublicFeedback()});
    el.querySelector('#feedback-next')?.addEventListener('click',()=>{feedbackState.publicPage=Math.min(maxPage,feedbackState.publicPage+1);loadPublicFeedback()});
  }
  function setStars(n){
    const input=document.getElementById('feedback-rating'); if(input)input.value=String(n);
    document.querySelectorAll('#star-input button').forEach((b,i)=>b.classList.toggle('selected',i<n));
  }
  async function submitFeedback(e){
    e.preventDefault();
    const form=e.currentTarget,msg=document.getElementById('feedback-form-message'),btn=form.querySelector('button[type=submit]');
    if(!configured()){msg.textContent='Feedback is temporarily unavailable.';return;}
    const data=Object.fromEntries(new FormData(form)); const rating=Math.min(5,Math.max(1,Number(data.rating)||5));
    if(String(data.name).trim().length<2||String(data.city).trim().length<2||String(data.comment).trim().length<5){msg.textContent='Please complete all fields.';return;}
    btn.disabled=true;btn.textContent='SENDING…';msg.textContent='';
    try{
      const {error}=await sb().from('feedback').insert({customer_name:String(data.name).trim(),city:String(data.city).trim(),rating,comment:String(data.comment).trim()});
      if(error)throw error;
      form.reset();setStars(5);msg.textContent='';if(window.wagwanShowFeedbackThanks)window.wagwanShowFeedbackThanks();else{const box=document.createElement('div');box.className='wagwan-thanks-overlay';box.innerHTML='<div class="wagwan-thanks-dialog"><small>WAGWAN / COMMUNITY</small><h2>Thank you for your feedback.</h2><p>Your review has been received and is awaiting approval.</p><button class="wagwan-thanks-ok" type="button">CONTINUE</button></div>';document.body.appendChild(box);box.querySelector('button').onclick=()=>box.remove();}
    }catch(err){console.error(err);msg.textContent='Unable to send feedback. Please try again.';}
    finally{btn.disabled=false;btn.textContent='SEND FEEDBACK →';}
  }
  window.setFeedbackRating=setStars;
  window.setFeedbackFilter=function(filter){feedbackState.filter=filter;document.querySelectorAll('.feedback-filter').forEach(b=>b.classList.toggle('active',b.dataset.filter===filter));renderAdminFeedback()};
  async function loadAdminFeedback(){
    const el=document.getElementById('admin-feedback'); if(!el||!configured())return;
    const {data,error}=await sb().from('feedback').select('*').order('created_at',{ascending:false});
    if(error){console.error(error);el.innerHTML='<tr><td colspan="7" class="empty">Unable to load feedback.</td></tr>';return;}
    feedbackState.items=data||[];renderAdminFeedback();
  }
  function renderAdminFeedback(){
    const el=document.getElementById('admin-feedback'); if(!el)return;
    const all=feedbackState.items||[];const f=feedbackState.filter==='all'?all:all.filter(x=>x.status===feedbackState.filter);
    const counts={all:all.length,pending:all.filter(x=>x.status==='pending').length,approved:all.filter(x=>x.status==='approved').length,rejected:all.filter(x=>x.status==='rejected').length};
    const st=document.getElementById('feedback-admin-stats');if(st)st.innerHTML=`<div><b>${counts.all}</b><span>Total</span></div><div><b>${counts.pending}</b><span>Pending</span></div><div><b>${counts.approved}</b><span>Approved</span></div><div><b>${counts.rejected}</b><span>Rejected</span></div>`;
    const badge=document.getElementById('feedback-pending-badge');if(badge)badge.textContent=counts.pending;
    if(!f.length){el.innerHTML='<tr><td colspan="7" class="empty">No feedback in this filter.</td></tr>';return;}
    el.innerHTML=f.map(x=>`<tr><td><strong>${safe(x.customer_name)}</strong></td><td>${safe(x.city)}</td><td><span class="feedback-stars-inline">${stars(Number(x.rating))}</span></td><td class="feedback-comment-cell">${safe(x.comment)}</td><td>${formatDate(x.created_at)}</td><td><span class="feedback-status ${safe(x.status)}">${safe(x.status)}</span></td><td><div class="feedback-actions">${x.status!=='approved'?`<button class="feedback-action approve" onclick="moderateFeedback('${x.id}','approved')">✓</button>`:''}${x.status!=='rejected'?`<button class="feedback-action reject" onclick="moderateFeedback('${x.id}','rejected')">×</button>`:''}<button class="feedback-action edit" title="Edit" aria-label="Edit feedback" onclick="editFeedback('${x.id}')">✎</button><button class="feedback-action delete" title="Delete" aria-label="Delete feedback" onclick="deleteFeedback('${x.id}')">⌫</button></div></td></tr>`).join('');
  }
  window.moderateFeedback=async function(id,status){
    if(!configured())return;const {error}=await sb().from('feedback').update({status,moderated_at:new Date().toISOString()}).eq('id',id);if(error){toast('Unable to update feedback');return}await loadAdminFeedback();toast(status==='approved'?'Feedback approved':'Feedback rejected');
  };
  window.editFeedback=async function(id){if(!configured())return;const item=(feedbackState.items||[]).find(x=>String(x.id)===String(id));if(!item)return;const name=prompt('Client name',item.customer_name||'');if(name===null)return;const city=prompt('City',item.city||'');if(city===null)return;const ratingText=prompt('Rating (1–5)',String(item.rating||5));if(ratingText===null)return;const rating=Number(ratingText);if(!Number.isInteger(rating)||rating<1||rating>5){toast('Rating must be between 1 and 5');return}const comment=prompt('Feedback',item.comment||'');if(comment===null)return;if(name.trim().length<2||city.trim().length<2||comment.trim().length<5){toast('Please enter valid feedback details');return}const {error}=await sb().from('feedback').update({customer_name:name.trim(),city:city.trim(),rating,comment:comment.trim()}).eq('id',id);if(error){toast('Unable to edit feedback');return}await loadAdminFeedback();toast('Feedback updated')};
  window.deleteFeedback=async function(id){if(!configured()||!confirm('Delete this feedback permanently?'))return;const {error}=await sb().from('feedback').delete().eq('id',id);if(error){toast('Unable to delete feedback');return}await loadAdminFeedback();toast('Feedback deleted')};
  async function init(){
    if(document.getElementById('feedback-form')){
      let lastPublicSize=publicPageSize();window.addEventListener('resize',()=>{const next=publicPageSize();if(next!==lastPublicSize){lastPublicSize=next;feedbackState.publicPage=0;loadPublicFeedback()}});
      setStars(5);document.querySelectorAll('#star-input button').forEach(b=>b.addEventListener('click',()=>setStars(Number(b.dataset.rating))));document.getElementById('feedback-form').addEventListener('submit',submitFeedback);loadPublicFeedback();
      if(configured()){const ch=sb().channel('wagwan-feedback-public').on('postgres_changes',{event:'*',schema:'public',table:'feedback'},()=>loadPublicFeedback()).subscribe();window.addEventListener('beforeunload',()=>{try{sb().removeChannel(ch)}catch{}})}
    }
    if(document.querySelector('.admin-body')){
      const {data:{session}}=configured()?await sb().auth.getSession():{data:{session:null}};
      if(session){await loadAdminFeedback();const ch=sb().channel('wagwan-feedback-admin').on('postgres_changes',{event:'*',schema:'public',table:'feedback'},loadAdminFeedback).subscribe();window.addEventListener('beforeunload',()=>{try{sb().removeChannel(ch)}catch{}})}
    }
  }
  document.addEventListener('DOMContentLoaded',init);
})();
