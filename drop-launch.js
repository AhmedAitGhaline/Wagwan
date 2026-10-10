/* WAGWAN public Next Drop gate. This script only replaces the storefront when Drop Mode is enabled. */
(function(){
'use strict';
const sb=()=>window.wagwanSB;
const safe=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
function reveal(){document.body.classList.remove('drop-mode-pending');document.body.style.visibility='visible';}
function normalizePhone(v){let d=String(v||'').trim().replace(/[^\d]/g,'');if(d.startsWith('00'))d=d.slice(2);if(d.startsWith('212'))d=d.slice(3);if(d.startsWith('0'))d=d.slice(1);return /^[67]\d{8}$/.test(d)?'+212'+d:null;}
function renderPage(drop, cfg){
 const launch=new Date(drop.launch_at);
 const modeClosed=!drop.registration_open || (drop.auto_close_registrations && Date.now()>=launch.getTime());
 document.title='WAGWAN — '+(drop.name||'NEXT DROP');
 document.body.innerHTML=`<main class="drop-launch-page">
  <header class="drop-launch-header"><img src="assets/wagwan-logo-transparent.png" alt="WAGWAN"></header>
  <section class="drop-launch-main">
   <p class="drop-eyebrow">WAGWAN / NEXT DROP</p>
   <p class="drop-name">${safe(drop.name||cfg.drop_name||'NEXT DROP')}</p>
   <h1>THE NEXT DROP<br><span>IS COMING.</span></h1>
   <p class="drop-intro">Inscrivez-vous pour être informé du lancement et ne pas manquer le prochain drop WAGWAN.</p>
   <div class="drop-countdown" id="drop-countdown" aria-live="off">
    <div><strong data-time="days">00</strong><span>DAYS</span></div><i>:</i><div><strong data-time="hours">00</strong><span>HOURS</span></div><i>:</i><div><strong data-time="minutes">00</strong><span>MINUTES</span></div><i>:</i><div><strong data-time="seconds">00</strong><span>SECONDS</span></div>
   </div>
   <p id="drop-launch-status" class="drop-launch-status" aria-live="polite"></p>
   <form id="drop-register-form" class="drop-register-form" ${modeClosed?'hidden':''}>
    <label>Nom complet<input name="full_name" type="text" maxlength="120" autocomplete="name" placeholder="Votre nom complet" required></label>
    <label>Numéro de téléphone<input name="phone" type="tel" inputmode="tel" autocomplete="tel" placeholder="Numéro de téléphone" required></label>
    <button type="submit">REGISTER FOR THE NEXT DROP</button><p class="drop-register-result" id="drop-register-result" aria-live="polite"></p>
   </form>
   <p class="drop-closed-note" id="drop-closed-note" ${modeClosed?'':'hidden'}></p>
  </section>
  <div class="drop-thanks-overlay" id="drop-thanks-overlay" hidden>
   <section class="drop-thanks-modal" role="dialog" aria-modal="true" aria-labelledby="drop-thanks-title" aria-describedby="drop-thanks-message">
    <button class="drop-thanks-close" type="button" aria-label="Fermer la fenêtre">×</button>
    <div class="drop-thanks-mark" aria-hidden="true">✓</div>
    <p class="drop-eyebrow">WAGWAN / COMMUNITY</p>
    <h2 id="drop-thanks-title">THANK YOU<br><span>FOR REGISTERING.</span></h2>
    <p id="drop-thanks-message">Merci de rejoindre la communauté WAGWAN. Votre inscription a bien été enregistrée. Vous serez informé du lancement du prochain drop.</p>
    <button class="drop-thanks-action" type="button">CONTINUER</button>
   </section>
  </div>
  <footer class="drop-launch-footer">© 2026 WAGWAN. ALL RIGHTS RESERVED.</footer>
 </main>`;
 const $=s=>document.querySelector(s);
 const status=$('#drop-launch-status'),form=$('#drop-register-form'),closed=$('#drop-closed-note');
 const thanks=$('#drop-thanks-overlay');
 const closeThanks=()=>{if(thanks){thanks.hidden=true;document.body.classList.remove('drop-thanks-open')}};
 const openThanks=()=>{if(thanks){thanks.hidden=false;document.body.classList.add('drop-thanks-open');const close=thanks.querySelector('.drop-thanks-close');if(close)close.focus()}};
 if(thanks){
  thanks.querySelector('.drop-thanks-close')?.addEventListener('click',closeThanks);
  thanks.querySelector('.drop-thanks-action')?.addEventListener('click',closeThanks);
  thanks.addEventListener('click',e=>{if(e.target===thanks)closeThanks()});
  document.addEventListener('keydown',e=>{if(e.key==='Escape'&&!thanks.hidden)closeThanks()});
 }
 function paintCountdown(){
  let ms=Math.max(0,launch.getTime()-Date.now());
  const days=Math.floor(ms/86400000);ms%=86400000;
  const hours=Math.floor(ms/3600000);ms%=3600000;
  const minutes=Math.floor(ms/60000);ms%=60000;
  const seconds=Math.floor(ms/1000);
  const vals={days:String(days).padStart(2,'0'),hours:String(hours).padStart(2,'0'),minutes:String(minutes).padStart(2,'0'),seconds:String(seconds).padStart(2,'0')};
  Object.entries(vals).forEach(([k,v])=>{const el=$(`[data-time="${k}"]`);if(el)el.textContent=v});
  const ended=Date.now()>=launch.getTime();
  if(ended){
    status.textContent='LE DROP EST ARRIVÉ.';
    if(drop.auto_close_registrations && form){form.hidden=true;closed.hidden=false;closed.textContent='Les inscriptions pour ce drop sont terminées.'}
    else if(!drop.registration_open && form){form.hidden=true;closed.hidden=false;closed.textContent='Les inscriptions pour ce drop sont fermées.'}
  } else if(!drop.registration_open){
    status.textContent='INSCRIPTIONS FERMÉES';
    if(form)form.hidden=true;closed.hidden=false;closed.textContent='Les inscriptions pour ce drop sont fermées.';
  } else status.textContent='INSCRIVEZ-VOUS AVANT LE LANCEMENT.';
 }
 paintCountdown();const timer=setInterval(paintCountdown,1000);
 window.addEventListener('pagehide',()=>clearInterval(timer),{once:true});
 if(form)form.addEventListener('submit',async e=>{
  e.preventDefault();const button=form.querySelector('button'),result=$('#drop-register-result');
  if(button.disabled)return;
  const name=String(form.elements.full_name.value||'').trim(),phone=normalizePhone(form.elements.phone.value);
  result.textContent='';
  if(name.length<2){result.textContent='Veuillez saisir votre nom complet.';form.elements.full_name.focus();return}
  if(!phone){result.textContent='Veuillez saisir un numéro de téléphone mobile marocain valide.';form.elements.phone.focus();return}
  if(!sb()){result.textContent='Service temporairement indisponible. Réessayez plus tard.';return}
  button.disabled=true;button.textContent='INSCRIPTION…';
  try{
   const {data,error}=await sb().rpc('wagwan_register_for_drop',{p_full_name:name,p_phone:phone,p_drop_id:drop.id});
   if(error)throw error;
   const resultStatus=data?.status;
   if(resultStatus==='registered'){result.textContent='';form.reset();form.querySelectorAll('input').forEach(i=>i.disabled=true);button.hidden=true;openThanks()}
   else if(resultStatus==='already_registered')result.textContent='Ce numéro est déjà inscrit à ce drop.';
   else if(resultStatus==='invalid_phone')result.textContent='Numéro de téléphone invalide.';
   else if(resultStatus==='invalid_name')result.textContent='Veuillez saisir un nom complet valide.';
   else if(resultStatus==='registrations_closed'){result.textContent='Les inscriptions sont fermées pour ce drop.';form.hidden=true;closed.hidden=false;closed.textContent='Les inscriptions pour ce drop sont terminées.'}
   else result.textContent='Inscription impossible. Veuillez réessayer.';
  }catch(err){console.warn('[WAGWAN drop registration]',err);result.textContent='Impossible d’enregistrer votre inscription pour le moment. Réessayez plus tard.'}
  finally{if(button.isConnected&&!button.hidden){button.disabled=false;button.textContent='REGISTER FOR THE NEXT DROP'}}
 });
 reveal();
}
async function start(){
 if(!document.body)return;
 document.body.classList.add('drop-mode-pending');
 try{
  if(!sb())return;
  const {data,error}=await sb().from('wagwan_store_settings').select('drop_mode_enabled,drop_name,drop_launch_at,drop_timezone,drop_registration_open,drop_auto_close_registrations,active_drop_id').eq('id',1).maybeSingle();
  if(error||!data?.drop_mode_enabled)return;
  if(!data.active_drop_id){document.body.innerHTML='<main class="drop-launch-page"><header class="drop-launch-header"><img src="assets/wagwan-logo-transparent.png" alt="WAGWAN"></header><section class="drop-launch-main"><p class="drop-eyebrow">WAGWAN / NEXT DROP</p><h1>THE NEXT DROP<br><span>IS COMING.</span></h1><p>Le prochain drop est en préparation. Revenez bientôt.</p></section></main>';reveal();return}
  const {data:drop,error:dropError}=await sb().from('wagwan_drops').select('id,name,launch_at,timezone,registration_open,auto_close_registrations').eq('id',data.active_drop_id).maybeSingle();
  if(dropError||!drop){
   document.body.innerHTML='<main class="drop-launch-page"><header class="drop-launch-header"><img src="assets/wagwan-logo-transparent.png" alt="WAGWAN"></header><section class="drop-launch-main"><p class="drop-eyebrow">WAGWAN / NEXT DROP</p><h1>THE NEXT DROP<br><span>IS COMING.</span></h1><p>Les inscriptions seront bientôt disponibles.</p></section></main>';return
  }
  renderPage(drop,data);
 }catch(e){console.warn('[WAGWAN drop mode]',e)}finally{reveal()}
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start,{once:true});else start();
})();