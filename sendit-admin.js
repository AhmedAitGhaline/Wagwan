/* WAGWAN × SENDIT — Admin integration */
(function(){
  const SENDIT_STEPS=[
    ["created","Colis créé"],["picked_up","Ramassé"],["in_transit","En transit"],["warehouse","Arrivé à l'agence"],["delivering","En livraison"],["delivered","Livré"]
  ];
  const state={shipments:[],pickupCities:[],packagings:[],districts:[]};
  const sb=()=>window.wagwanSB;
  const safe=v=>typeof escapeHtml==='function'?escapeHtml(v):String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[c]));
  const money2=v=>typeof money==='function'?money(v):`${Number(v||0).toLocaleString('fr-FR')} DH`;
  const internalLabel=s=>({created:'Colis créé',picked_up:'Ramassé',in_transit:'En transit',warehouse:"Arrivé à l'agence",distributed:'Distribué',delivering:'En livraison',delivered:'Livré',exception:'Exception'}[s]||s||'—');
  const rawLabel=s=>({PENDING:'En attente',TO_PREPARE:'À préparer',NEW_DESTINATION:'À changer',TO_PICKUP:'Ramassage en cours',PICKEDUP:'Ramassé',WAREHOUSE:'Entrepôt',TRANSIT:'En transit',DISTRIBUTED:'Distribué',UNREACHABLE:'Injoignable',POSTPONED:'Reporté',DELIVERING:'En cours de livraison',DELIVERED:'Livré',CANCELED:'Annulé',REJECTED:'Refusé'}[s]||s||'—');
  function shipmentFor(orderId){return state.shipments.find(x=>x.order_id===orderId)}
  function decorateRows(){
    const body=document.getElementById('orders-table'); if(!body)return;
    const orders=typeof getOrders==='function'?getOrders():[];
    body.querySelectorAll('tr').forEach(row=>{
      if(row.children.length<9)return;
      const idText=(row.children[0]?.innerText||'').replace('#','').trim();
      const order=orders.find(o=>o.id===idText||o.uuid===idText);
      const ship=order&&shipmentFor(order.uuid);
      const cell=document.createElement('td');
      cell.innerHTML=ship?`<span class="sendit-pill ${safe(ship.internal_status)}">${safe(internalLabel(ship.internal_status))}</span><div class="sendit-status-note">${safe(ship.sendit_code||'')}</div>`:'<span class="sendit-status-note">—</span>';
      row.insertBefore(cell,row.children[7]||null);
    });
  }
  async function loadShipments(){
    if(!sb())return;
    const {data,error}=await sb().from('delivery_shipments').select('*').order('created_at',{ascending:false});
    if(error){console.error(error);return}
    state.shipments=data||[];
    if(typeof window.__wagwanOriginalRenderOrders==='function')window.__wagwanOriginalRenderOrders();
    decorateRows();
  }
  async function invoke(name,body){
    const {data,error}=await sb().functions.invoke(name,{body});
    if(error)throw error;
    if(data?.error)throw new Error(data.error);
    return data;
  }
  function ensureModal(){
    if(document.getElementById('sendit-modal'))return;
    const m=document.createElement('div');m.id='sendit-modal';m.className='sendit-modal-backdrop';
    m.innerHTML='<div class="sendit-modal"><div class="sendit-modal-head"><h2>Créer l\'expédition Sendit</h2><button class="sendit-modal-close" onclick="closeSenditModal()">×</button></div><div id="sendit-modal-body"><div class="sendit-loading">Chargement…</div></div></div>';
    document.body.appendChild(m);
  }
  window.closeSenditModal=()=>document.getElementById('sendit-modal')?.classList.remove('open');
  const MOROCCAN_CITIES = [
    'Casablanca','Marrakech','Rabat','Salé','Tanger','Fès','Meknès','Agadir','Oujda','Kénitra','Tétouan','Safi','El Jadida','Mohammedia','Béni Mellal','Nador','Taza','Settat','Khouribga','Berrechid','Larache','Ksar El Kebir','Essaouira','Ouarzazate','Errachidia','Zagora','Tinghir','Dakhla','Laâyoune','Guelmim','Inezgane','Taroudant','Chefchaouen','Al Hoceima','Sidi Kacem','Sidi Slimane','Taounate','Taourirt','Berkane','Guercif','Midelt','Azrou','Ifrane','Khémisset','Témara','Skhirat','Bouskoura','Médiouna','Nouaceur','Ben Slimane','Youssoufia','Ben Guerir','Chichaoua','El Kelaâ des Sraghna','Souk El Arbaa','Ouazzane','Asilah','Martil','M’diq','Fnideq','Moulay Idriss Zerhoun','Sefrou','Boulemane','Missour','El Hajeb','Moulay Yacoub','Aïn Taoujdate','Imouzzer Kandar','Tahla','Aknoul','Driouch','Zaio','Ahfir','Figuig','Jerada','Bouarfa','Talsint','Debdou','Saïdia','Demnate','Aït Ourir','Amizmiz','Tahannaout','Moulay Brahim','Tamanar','Imsouane','Tiznit','Sidi Ifni','Tan-Tan','Tarfaya','Smara','Boujdour','Assa','Zag','Sidi Bennour','Azemmour','Oualidia','Sidi Rahal','Bouznika','Aïn Harrouda','Tit Mellil','Dar Bouazza','Marrakesh','Casa','Casa Blanca','Mrakech','Marrakch','Rabat-Salé','Tanger-Tétouan'
  ];
  const normalizeCity=v=>String(v||'').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[’'`]/g,' ').replace(/\s+/g,' ').trim();
  const cityAliases={
    casa:'Casablanca','casa blanca':'Casablanca','casablanca':'Casablanca',mrakech:'Marrakech',marrakesh:'Marrakech',marrakch:'Marrakech',marrakech:'Marrakech','marrakech medina':'Marrakech',
    sale:'Salé','tanger':'Tanger','fes':'Fès','meknes':'Meknès','agadir':'Agadir','oujda':'Oujda','kenitra':'Kénitra','tetouan':'Tétouan','safi':'Safi','el jadida':'El Jadida','beni mellal':'Béni Mellal','nador':'Nador','taza':'Taza','settat':'Settat','khouribga':'Khouribga','berrechid':'Berrechid'
  };
  function canonicalCity(v){const n=normalizeCity(v);return cityAliases[n]||String(v||'').trim();}
  function districtCity(x){return x?.ville ?? x?.city ?? x?.city_name ?? x?.cityName ?? ''}
  function districtMatchesCity(x,city){const d=normalizeCity(districtCity(x));const c=normalizeCity(canonicalCity(city));if(!d||!c)return true;return d===c||d.includes(c)||c.includes(d);}
  async function loadOptions(city){
    const canonical=canonicalCity(city);
    const [pc,pk,dist]=await Promise.all([
      invoke('sendit-pickup-cities',{}),
      invoke('sendit-packagings',{}),
      invoke('sendit-districts',{query:canonical})
    ]);
    state.pickupCities=pc?.data||[];state.packagings=pk?.data||[];state.districts=(dist?.data||[]).filter(x=>districtMatchesCity(x,canonical));
  }
  function buildModalBody(o){
    const currentCity=canonicalCity(o.city||'');
    const cityOptions=[...new Set([currentCity,...MOROCCAN_CITIES])].filter(Boolean).sort((a,b)=>a.localeCompare(b,'fr')).map(x=>'<option value="'+safe(x)+'" '+(normalizeCity(x)===normalizeCity(currentCity)?'selected':'')+'>'+safe(x)+'</option>').join('');
    const pickupOptions=state.pickupCities.map((x,i)=>'<option value="'+safe(x.id)+'" '+(i===0?'selected':'')+'>'+safe(x.name||x.ville||'')+'</option>').join('');
    const districtOptions=state.districts.map(x=>'<option value="'+safe(x.id)+'">'+safe(x.name||x.district_name||x.ville||'District '+x.id)+' — '+safe(districtCity(x)||currentCity)+'</option>').join('');
    const packagingOptions=state.packagings.map(x=>'<option value="'+safe(x.id)+'">'+safe(x.name)+' — '+safe(x.size||'')+'</option>').join('');
    return '<div class="sendit-help">Sendit exige un <b>district de livraison</b>, un <b>district de ramassage</b> et un emballage. La <b>ville client</b> est préremplie depuis la commande. Sélectionne ensuite le quartier Sendit exact correspondant à l’adresse du client.</div>'+
      '<form id="sendit-create-form"><div class="sendit-form-grid">'+
      '<label>VILLE CLIENT<select name="client_city" id="sendit-client-city" required>'+cityOptions+'</select></label>'+
      '<label>DISTRICT CLIENT<select name="district" id="sendit-client-district" required>'+districtOptions+'</select></label>'+
      '<label>VILLE DE RAMASSAGE<select name="pickup" required>'+pickupOptions+'</select></label>'+
      '<label>EMBALLAGE<select name="packaging" required>'+packagingOptions+'</select></label>'+
      '<label>COMMENTAIRE<input name="comment" value="'+safe(o.id)+'" placeholder="Référence / note"></label>'+
      '</div><div class="sendit-checks"><label><input type="checkbox" name="allow_open" checked> Autoriser ouverture</label><label><input type="checkbox" name="allow_try" checked> Autoriser essayage</label></div>'+
      '<div class="sendit-modal-footer"><button type="button" onclick="closeSenditModal()">ANNULER</button><button class="primary" type="submit">CRÉER L\'EXPÉDITION</button></div></form>';
  }
  async function reloadClientDistricts(city){
    const select=document.getElementById('sendit-client-district');if(!select)return;
    select.disabled=true;select.innerHTML='<option>Chargement des districts…</option>';
    try{
      const canonical=canonicalCity(city);const r=await invoke('sendit-districts',{query:canonical});
      state.districts=(r?.data||[]).filter(x=>districtMatchesCity(x,canonical));
      if(!state.districts.length){select.innerHTML='<option value="">Aucun district Sendit trouvé pour cette ville</option>';return;}
      select.innerHTML=state.districts.map(x=>'<option value="'+safe(x.id)+'">'+safe(x.name||x.district_name||x.ville||'District '+x.id)+' — '+safe(districtCity(x)||canonical)+'</option>').join('');
    }catch(err){console.error(err);select.innerHTML='<option value="">Impossible de charger les districts</option>';}finally{select.disabled=false;}
  }
  window.openSenditModal=async function(orderId){
    const orders=typeof getOrders==='function'?getOrders():[];const o=orders.find(x=>x.uuid===orderId||x.id===orderId);if(!o)return;
    const existing=shipmentFor(o.uuid);if(existing){return window.showOrder(o.uuid)}
    ensureModal();const modal=document.getElementById('sendit-modal');modal.classList.add('open');const body=document.getElementById('sendit-modal-body');body.innerHTML='<div class="sendit-loading">Chargement des options Sendit…</div>';
    try{
      await loadOptions(o.city||'');
      if(!state.districts.length)throw new Error(`Aucun district Sendit trouvé pour « ${o.city||'cette ville'} »`);
      if(!state.pickupCities.length)throw new Error('Aucune ville de ramassage Sendit disponible');
      if(!state.packagings.length)throw new Error('Aucun emballage Sendit disponible');
      body.innerHTML=buildModalBody(o);
      const citySelect=document.getElementById('sendit-client-city');
      citySelect?.addEventListener('change',()=>reloadClientDistricts(citySelect.value));
      const form=document.getElementById('sendit-create-form');
      form.onsubmit=async e=>{
        e.preventDefault();
        const fd=new FormData(form);const btn=form.querySelector('button[type=submit]');btn.disabled=true;btn.textContent='CRÉATION…';
        try{
          const r=await invoke('sendit-create-delivery',{order_id:o.uuid,district_id:Number(fd.get('district')),pickup_district_id:Number(fd.get('pickup')),packaging_id:Number(fd.get('packaging')),allow_open:fd.get('allow_open')==='on',allow_try:fd.get('allow_try')==='on',comment:String(fd.get('comment')||'')});
          closeSenditModal();await loadShipments();toast(`Expédition Sendit créée : ${r.shipment.sendit_code}`);window.showOrder(o.uuid);
        }catch(err){console.error(err);toast(err.message||'Impossible de créer l’expédition')}finally{btn.disabled=false;btn.textContent="CRÉER L'EXPÉDITION"}
      };
    }catch(err){console.error(err);body.innerHTML='<div class="sendit-exception">Impossible de charger les options Sendit.<br>'+safe(err.message||err)+'</div>'}
  };
  window.refreshSendit=async function(code,orderId){try{await invoke('sendit-refresh-delivery',{code});await loadShipments();if(orderId)window.showOrder(orderId);toast('Statut Sendit actualisé')}catch(e){console.error(e);toast(e.message||'Impossible d’actualiser Sendit')}};
  function shipmentCard(o){
    const sh=shipmentFor(o.uuid);
    if(!sh&&o.status!=='confirmed'&&o.status!=='delivered')return '';
    if(!sh)return '<div class="sendit-card" data-order-id="'+safe(o.uuid)+'"><div class="sendit-card-head"><h3>🚚 LIVRAISON SENDIT</h3><span class="sendit-pill created">Pas encore créée</span></div><div class="sendit-help">La commande est confirmée. Crée l\'expédition Sendit lorsque le colis est prêt à être remis au transporteur.</div><div class="sendit-actions"><button class="primary" onclick="openSenditModal(\''+safe(o.uuid)+'\')">CRÉER EXPÉDITION SENDIT</button></div></div>';
    const idx=SENDIT_STEPS.findIndex(x=>x[0]===sh.internal_status);const current=Math.max(0,idx);const exception=['UNREACHABLE','POSTPONED','CANCELED','REJECTED'].includes(sh.sendit_status);
    const steps=SENDIT_STEPS.map((st,i)=>'<div class="sendit-step '+(i<current?'done ':'')+(i===current?'current':'')+'"><span class="dot"></span><span>'+safe(st[1])+'</span><span>'+(i<current?'✓':i===current?'●':'')+'</span></div>').join('');
    let exceptionHtml='';if(exception){exceptionHtml='<div class="sendit-exception"><b>'+safe(rawLabel(sh.sendit_status))+'</b>'+(sh.last_action_at_text?' — '+safe(sh.last_action_at_text):'')+(sh.deliver_by?'<br>Prochaine tentative : '+safe(sh.deliver_by):'')+(sh.proof_image_url?'<br><a class="sendit-link" href="'+safe(sh.proof_image_url)+'" target="_blank" rel="noopener">Voir la preuve</a>':'')+'</div>'}
    const labelBtn=sh.label_url?'<button onclick="window.open(\''+safe(sh.label_url)+'\',\'_blank\',\'noopener\')">ÉTIQUETTE</button>':'';
    return '<div class="sendit-card" data-order-id="'+safe(o.uuid)+'"><div class="sendit-card-head"><h3>🚚 LIVRAISON SENDIT</h3><span class="sendit-pill '+safe(sh.internal_status)+'">'+safe(internalLabel(sh.internal_status))+'</span></div><div class="sendit-meta"><div><small>Code colis</small><strong class="sendit-code">'+safe(sh.sendit_code)+'</strong></div><div><small>Statut Sendit</small><strong>'+safe(rawLabel(sh.sendit_status))+'</strong></div><div><small>Frais livraison</small><strong>'+money2(sh.sendit_fee||0)+'</strong></div><div><small>Dernière action</small><strong>'+safe(sh.last_action_at_text||'—')+'</strong></div></div><div class="sendit-timeline">'+steps+'</div>'+exceptionHtml+'<div class="sendit-actions">'+labelBtn+'<button onclick="refreshSendit(\''+safe(sh.sendit_code)+'\',\''+safe(o.uuid)+'\')">ACTUALISER</button></div></div>';
  }
  function patchShowOrder(){
    const original=window.showOrder;if(typeof original!=='function'||original.__senditWrapped)return;
    const wrapped=function(id){
      original(id);
      const orders=typeof getOrders==='function'?getOrders():[];const o=orders.find(x=>x.uuid===id||x.id===id);const panel=document.getElementById('order-detail');if(!o||!panel)return;
      panel.querySelector('.sendit-card')?.remove();
      const holder=document.createElement('div');holder.innerHTML=shipmentCard(o);const node=holder.firstElementChild;if(node)panel.appendChild(node);
    };
    wrapped.__senditWrapped=true;window.showOrder=wrapped;
  }
  function patchRender(){
    if(typeof window.renderAdminOrders!=='function'||window.renderAdminOrders.__senditWrapped)return;
    const original=window.renderAdminOrders;window.__wagwanOriginalRenderOrders=original;
    const wrapped=function(){original();decorateRows()};wrapped.__senditWrapped=true;window.renderAdminOrders=wrapped;
  }
  async function init(){
    if(!document.querySelector('.admin-body')||!sb())return;
    patchRender();patchShowOrder();
    await loadShipments();
    const ch=sb().channel('wagwan-sendit-admin').on('postgres_changes',{event:'*',schema:'public',table:'delivery_shipments'},async()=>{await loadShipments();if(window.location.hash==='#orders'){const open=document.querySelector('#order-detail .sendit-card')?.dataset?.orderId;if(open&&typeof window.showOrder==='function')window.showOrder(open)}}).subscribe();
    window.addEventListener('beforeunload',()=>{try{sb().removeChannel(ch)}catch{}});
  }
  document.addEventListener('DOMContentLoaded',()=>setTimeout(init,100));
})();

/* ================= WAGWAN SHIPPING CENTER V11.1 ================= */
(function(){
  const sb=()=>window.wagwanSB;
  const esc=v=>typeof window.escapeHtml==='function'?window.escapeHtml(v):String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[c]));
  const money=v=>typeof window.money==='function'?window.money(v):`${Number(v||0).toLocaleString('fr-FR')} DH`;
  const labels={created:'Colis créé',picked_up:'Ramassé',in_transit:'En transit',warehouse:"Arrivé à l'agence",distributed:'Distribué',delivering:'En livraison',delivered:'Livré',exception:'Exception'};
  const raw={PENDING:'En attente',TO_PREPARE:'À préparer',NEW_DESTINATION:'À changer',TO_PICKUP:'Ramassage en cours',PICKEDUP:'Ramassé',WAREHOUSE:'Entrepôt',TRANSIT:'En transit',DISTRIBUTED:'Distribué',UNREACHABLE:'Injoignable',POSTPONED:'Reporté',DELIVERING:'En cours de livraison',DELIVERED:'Livré',CANCELED:'Annulé',REJECTED:'Refusé'};
  const steps=[['created','Colis créé'],['picked_up','Ramassé'],['in_transit','En transit'],['warehouse',"Arrivé à l'agence"],['delivering','En livraison'],['delivered','Livré']];
  let shipments=[];let events=[];let selected=null;
  const orders=()=>typeof window.getOrders==='function'?window.getOrders():[];
  function orderFor(s){return orders().find(o=>o.uuid===s.order_id||o.id===s.order_id)||null}
  function invoke(name,body){return sb().functions.invoke(name,{body}).then(r=>{if(r.error)throw r.error;if(r.data?.error)throw new Error(r.data.error);return r.data})}
  async function load(){
    if(!sb())return;
    const [sr,er]=await Promise.all([
      sb().from('delivery_shipments').select('*').order('created_at',{ascending:false}),
      sb().from('delivery_tracking_events').select('*').order('received_at',{ascending:false}).limit(250)
    ]);
    if(sr.error){console.error('Shipping shipments:',sr.error);return}
    shipments=sr.data||[];events=er.error?[]:(er.data||[]);
    window.__senditShipmentsV11=shipments;
    const badge=document.getElementById('shipping-badge');if(badge)badge.textContent=shipments.filter(s=>s.internal_status!=='delivered'&&s.internal_status!=='exception').length;
    if(location.hash==='#shipping')render();
    if(selected)showDetail(selected);
  }
  function statusMatch(s,f){return f==='all'||s.internal_status===f}
  function renderStats(list){
    const el=document.getElementById('shipping-stats');if(!el)return;
    const count=k=>list.filter(s=>s.internal_status===k).length;
    const cards=[['TOTAL',list.length,'All shipments'],['TO PREPARE',count('created'),'Created / awaiting pickup'],['IN TRANSIT',count('in_transit'),'Moving with Sendit'],['DELIVERING',count('delivering'),'Out for delivery'],['DELIVERED',count('delivered'),'Completed']];
    el.innerHTML=cards.map(c=>`<div class="shipping-stat"><span class="label">${c[0]}</span><span class="value">${c[1]}</span><span class="sub">${c[2]}</span></div>`).join('');
  }
  function filtered(){
    const q=(document.getElementById('shipping-search')?.value||'').trim().toLowerCase();const f=document.getElementById('shipping-status-filter')?.value||'all';
    return shipments.filter(s=>{const o=orderFor(s);const hay=[s.sendit_code,s.sendit_reference,s.sendit_status,o?.id,o?.firstName,o?.lastName,o?.phone,o?.city].join(' ').toLowerCase();return statusMatch(s,f)&&(!q||hay.includes(q))});
  }
  function row(s){
    const o=orderFor(s);const active=selected===s.id?'selected':'';
    return `<div class="shipping-row ${active}" data-shipment-id="${esc(s.id)}" onclick="selectShipping('${esc(s.id)}')">
      <div class="shipping-row-main"><div class="shipping-order-code">#${esc(o?.id||s.sendit_reference||'—')}</div><div class="shipping-client">${esc(`${o?.firstName||''} ${o?.lastName||''}`.trim()||'Client')}</div></div>
      <div class="shipping-row-meta"><small>Sendit</small><strong class="shipping-code">${esc(s.sendit_code||'—')}</strong></div>
      <div class="shipping-row-meta"><small>Status</small><span class="sendit-pill ${esc(s.internal_status)}">${esc(labels[s.internal_status]||s.internal_status)}</span></div>
      <div class="shipping-row-actions"><button type="button" title="Open" onclick="event.stopPropagation();selectShipping('${esc(s.id)}')">→</button></div>
    </div>`;
  }
  window.renderShipping=function(){
    const list=filtered();renderStats(list);const el=document.getElementById('shipping-list');if(!el)return;
    const note=document.getElementById('shipping-list-note');if(note)note.textContent=`${list.length} shipment${list.length===1?'':'s'} matching current filters`;
    el.innerHTML=list.length?list.map(row).join(''):'<div class="shipping-no-results">No Sendit shipment matches your filters.</div>';
    if(selected&&!list.some(s=>s.id===selected))showDetail(null);
  };
  function timeline(s){
    const idx=steps.findIndex(x=>x[0]===s.internal_status);const current=idx<0?0:idx;
    return `<div class="shipping-timeline">${steps.map((x,i)=>`<div class="shipping-timeline-item ${i<current?'done ':''}${i===current?'current ':''}${i>current?'pending':''}"><span class="shipping-timeline-dot"></span><div class="t-title">${esc(x[1])}</div><div class="t-time">${i<current?'✓':i===current?'NOW':'—'}</div></div>`).join('')}</div>`;
  }
  function detailHTML(s){
    const o=orderFor(s);const ev=events.filter(e=>e.shipment_id===s.id||e.sendit_code===s.sendit_code).slice(0,12);const exception=['UNREACHABLE','POSTPONED','CANCELED','REJECTED'].includes(s.sendit_status);
    const product=(o?.items||[]).map(i=>`${i.product||'Product'} — ${i.size||''} × ${i.quantity||1}`).join('<br>')||'—';
    const actions=[];
    if(s.label_url)actions.push(`<button class="primary" onclick="window.open('${esc(s.label_url)}','_blank','noopener')">PRINT LABEL</button>`);
    actions.push(`<button onclick="refreshShippingCode('${esc(s.sendit_code)}','${esc(s.id)}')"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M20 11a8 8 0 0 0-14.9-4M4 5v4h4M4 13a8 8 0 0 0 14.9 4M20 19v-4h-4"/></svg> REFRESH STATUS</button>`);
    if(o?.uuid)actions.push(`<button class="green" onclick="openShippingOrder('${esc(o.uuid)}')">OPEN ORDER</button>`);
    let ex='';if(exception)ex=`<div class="shipping-error"><b>${esc(raw[s.sendit_status]||s.sendit_status)}</b>${s.last_action_at_text?` — ${esc(s.last_action_at_text)}`:''}${s.deliver_by?`<br>Next attempt: ${esc(s.deliver_by)}`:''}${s.counter_unreachable?`<br>Unreachable attempts: ${esc(s.counter_unreachable)}`:''}${s.proof_image_url?`<br><a class="sendit-link" href="${esc(s.proof_image_url)}" target="_blank" rel="noopener">View delivery proof</a>`:''}</div>`;
    const eventsHtml=ev.length?ev.map(e=>`<div class="shipping-event"><div class="shipping-event-top"><strong>${esc(raw[e.new_status]||e.new_status)}</strong><span>${esc(e.last_action_at_text||new Date(e.received_at).toLocaleString('fr-FR'))}</span></div>${e.message?`<p>${esc(e.message)}</p>`:''}</div>`).join(''):'<div class="shipping-no-results">No tracking events received yet.</div>';
    return `<div class="shipping-detail-inner"><div class="shipping-detail-head"><div><h2>#${esc(o?.id||s.sendit_reference||'Shipment')}</h2><p>${esc(`${o?.firstName||''} ${o?.lastName||''}`.trim())} · ${esc(o?.city||'')}</p></div><span class="sendit-pill ${esc(s.internal_status)}">${esc(labels[s.internal_status]||s.internal_status)}</span></div>
      <div class="shipping-detail-grid"><div class="shipping-detail-field"><small>Sendit code</small><strong class="shipping-code">${esc(s.sendit_code||'—')}</strong></div><div class="shipping-detail-field"><small>Sendit status</small><strong>${esc(raw[s.sendit_status]||s.sendit_status||'—')}</strong></div><div class="shipping-detail-field"><small>Delivery fee</small><strong>${money(s.sendit_fee||0)}</strong></div><div class="shipping-detail-field"><small>Last action</small><strong>${esc(s.last_action_at_text||'—')}</strong></div><div class="shipping-detail-field"><small>Phone</small><strong>${esc(o?.phone||'—')}</strong></div><div class="shipping-detail-field"><small>City</small><strong>${esc(o?.city||'—')}</strong></div><div class="shipping-detail-field"><small>Address</small><strong>${esc(o?.address||'—')}</strong></div><div class="shipping-detail-field"><small>Products</small><strong>${product}</strong></div></div>
      ${timeline(s)}${ex}<div class="shipping-detail-actions">${actions.join('')}</div>
      <div class="shipping-events"><h3>TRACKING HISTORY</h3>${eventsHtml}</div></div>`;
  }
  window.selectShipping=function(id){selected=id;render();showDetail(id)};
  function showDetail(id){const panel=document.getElementById('shipping-detail');if(!panel)return;const s=shipments.find(x=>x.id===id);if(!s){panel.innerHTML='<div class="shipping-empty"><div class="shipping-empty-icon" aria-hidden="true"><svg viewBox="0 0 48 48"><path d="M7 8.5 12 5l5 3.5v7L12 19l-5-3.5z"/><path d="M7 8.5 12 12l5-3.5M12 12v7"/><path d="M3 12h3M18 12h3"/></svg></div><h3>Select a shipment</h3><p>Tracking details, timeline and delivery events will appear here.</p></div>';return}panel.innerHTML=detailHTML(s)}
  window.refreshShipping=async function(){
    const btn=document.getElementById('shipping-refresh-btn');
    const label=btn?.querySelector('span');
    if(btn?.disabled)return;
    if(btn){btn.disabled=true;btn.classList.add('is-loading');if(label)label.textContent='Refreshing…';}
    try{
      const result=await invoke('sendit-refresh-all',{});
      await load();
      if(selected){render();showDetail(selected);}
      const count=Number(result?.refreshed||0);
      const failed=Number(result?.failed||0);
      if(typeof toast==='function')toast(failed?`Shipping refreshed: ${count} updated, ${failed} failed`:`Shipping refreshed: ${count} shipment${count===1?'':'s'} updated`);
    }catch(e){
      console.error('Shipping refresh failed:',e);
      await load();
      if(typeof toast==='function')toast(e.message||'Unable to refresh Sendit');
    }finally{
      if(btn){btn.disabled=false;btn.classList.remove('is-loading');if(label)label.textContent='Refresh';}
    }
  };
  window.refreshShippingCode=async function(code,id){
    try{
      const r=await invoke('sendit-refresh-delivery',{code});
      await load();selected=id;render();showDetail(id);
      if(typeof toast==='function')toast(`Sendit status: ${r?.shipment?.sendit_status||'updated'}`)
    }catch(e){
      console.error(e);if(typeof toast==='function')toast(e.message||'Unable to refresh Sendit')
    }
  };
  window.openShippingOrder=function(id){location.hash='#orders';setTimeout(()=>window.showOrder&&window.showOrder(id),30)};
  function init(){
    if(!document.querySelector('.admin-body')||!sb())return;
    window.addEventListener('hashchange',()=>{if(location.hash==='#shipping'){render();if(!shipments.length)load()}});
    load();
    const ch=sb().channel('wagwan-shipping-center-v11').on('postgres_changes',{event:'*',schema:'public',table:'delivery_shipments'},()=>load()).on('postgres_changes',{event:'*',schema:'public',table:'delivery_tracking_events'},()=>load()).subscribe();
    window.addEventListener('beforeunload',()=>{try{sb().removeChannel(ch)}catch{}});
    setTimeout(()=>{if(location.hash==='#shipping')render()},250);
  }
  document.addEventListener('DOMContentLoaded',()=>setTimeout(init,160));
})();
