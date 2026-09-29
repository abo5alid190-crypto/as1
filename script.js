
const SUPABASE_URL="https://lpdhvtoayrlffrvthlsp.supabase.co";
const SUPABASE_PUBLISHABLE_KEY="sb_publishable_vZNa5FvZrHT2ZvJq_e7quA_88ihYsYb";
let supabaseClient=null;
try{if(window.supabase&&typeof window.supabase.createClient==="function"){supabaseClient=window.supabase.createClient(SUPABASE_URL,SUPABASE_PUBLISHABLE_KEY)}}catch(e){console.error(e)}
window.__cloudReady=!!supabaseClient;
const $=id=>document.getElementById(id);let offers=[];let favorites=new Set(JSON.parse(localStorage.getItem('uroodi_favorites')||'[]'));let favoritesOnly=false;let favoritesSyncBusy=false;let map,markers=[],pendingImages=[],editingId=null,currentUser=null;const imageUrlCache=new Map();const localOffers=JSON.parse(localStorage.getItem('uroodi_offers')||'[]');
function setAuthMsg(t,err=false){$('authMsg').textContent=t;$('authMsg').className=err?'err':'ok'}
function setAppVisible(v){$('appMain').classList.toggle('hidden',!v);$('addBtn').classList.toggle('hidden',!v);$('logoutBtn').classList.toggle('hidden',!v);$('auth').classList.toggle('hidden',v);$('bottomNav')?.classList.add('hidden');if(v){$('editor').classList.add('hidden');setTimeout(()=>{if(!map)initMap();if(map){map.invalidateSize(true);if(markers.length===1)map.setView(markers[0].getLatLng(),15);else if(offers.length)updateMap(filtered())}},120)}}
async function login(){try{const email=$('authEmail').value.trim(),password=$('authPassword').value;if(!email||!password)return setAuthMsg('أدخل البريد الإلكتروني وكلمة المرور.',true);if(!supabaseClient)return setAuthMsg('خدمة تسجيل الدخول لم تُحمّل. اضغط تحديث الصفحة ثم جرّب مرة أخرى.',true);if($('rememberMe').checked)localStorage.setItem('uroodi_login_email',email);else localStorage.removeItem('uroodi_login_email');setAuthMsg('جاري تسجيل الدخول...');const {data,error}=await supabaseClient.auth.signInWithPassword({email,password});if(error)return setAuthMsg(error.message||'تعذر تسجيل الدخول.',true);await onSignedIn(data.user)}catch(e){console.error(e);setAuthMsg(e.message||'تعذر تشغيل تسجيل الدخول.',true)}}
async function signup(){try{const email=$('authEmail').value.trim(),password=$('authPassword').value;if(!email||!password)return setAuthMsg('أدخل البريد الإلكتروني وكلمة المرور.',true);if(!supabaseClient)return setAuthMsg('خدمة تسجيل الدخول لم تُحمّل. حدّث الصفحة ثم جرّب.',true);if(password.length<6)return setAuthMsg('كلمة المرور يجب أن تكون 6 أحرف على الأقل.',true);setAuthMsg('جاري إنشاء الحساب...');const {data,error}=await supabaseClient.auth.signUp({email,password});if(error)return setAuthMsg(error.message||'تعذر إنشاء الحساب.',true);if(data.session){await onSignedIn(data.user)}else setAuthMsg('تم إنشاء الحساب. افتح بريدك الإلكتروني واضغط رابط التأكيد، ثم سجّل الدخول.')}catch(e){setAuthMsg(e.message||'تعذر إنشاء الحساب.',true)}} 
async function resetPassword(){try{const email=$('authEmail').value.trim();if(!email)return setAuthMsg('اكتب بريدك الإلكتروني أولًا.',true);if(!supabaseClient)return setAuthMsg('خدمة تسجيل الدخول لم تُحمّل. حدّث الصفحة ثم جرّب.',true);const {error}=await supabaseClient.auth.resetPasswordForEmail(email,{redirectTo:location.origin});setAuthMsg(error?error.message:'تم إرسال رابط إعادة تعيين كلمة المرور إلى بريدك الإلكتروني.',!!error)}catch(e){setAuthMsg(e.message||'تعذر إرسال الرابط.',true)}}
async function logout(){if(!supabaseClient)return;await supabaseClient.auth.signOut();currentUser=null;offers=[];setAppVisible(false);$('userEmail').textContent='';render()}
async function onSignedIn(user){currentUser=user;const hasCloudFavorites=Array.isArray(user?.user_metadata?.uroodi_favorites);favorites=new Set(hasCloudFavorites?user.user_metadata.uroodi_favorites:JSON.parse(localStorage.getItem('uroodi_favorites')||'[]'));localStorage.setItem('uroodi_favorites',JSON.stringify([...favorites]));updateFavoritesUI();if(!hasCloudFavorites&&favorites.size)syncFavoritesToCloud();$('userEmail').textContent=user.email||'';setAppVisible(true);ensureAccountContactPhone().catch(e=>console.warn('contact phone',e));await loadOffers();render();/* لا نعيد ترميم بيانات المدينة تلقائيًا أثناء التصفح؛ ذلك كان يسبب إعادة بناء البطاقات والقفز في الصفحة. */if(localOffers.length&&!sessionStorage.getItem('uroodi_migrated')&&!offers.length){setTimeout(async()=>{try{await migrateLocalOffers();sessionStorage.setItem('uroodi_migrated','1');await loadOffers();render();if(offers.length)showToast('تم نقل عروضك القديمة إلى حسابك السحابي ✓','success')}catch(e){console.error('migration',e)}},1500)}}
let requests=[];let editingRequestId=null;
function selectedRequestCities(){const el=$('requestCity');return el?[...el.selectedOptions].map(o=>canonicalCity(o.value)).filter(Boolean):[]}
function getAllSaudiRequestCities(){return [...new Set(saudiCities.map(canonicalCity).filter(Boolean))].sort((a,b)=>a.localeCompare(b,'ar'))}
function getRequestCitiesFromOffers(){return getAllSaudiRequestCities()}
function allRequestCitiesSelected(){const el=$('requestCity');const all=getAllSaudiRequestCities();return !!el&&all.length>0&&all.every(c=>[...el.options].some(o=>canonicalCity(o.value)===c&&o.selected))}
function toggleAllRequestCities(){const el=$('requestCity');if(!el)return;const all=getRequestCitiesFromOffers();const selectAll=!allRequestCitiesSelected();[...el.options].forEach(o=>o.selected=selectAll);renderRequestCities()}
function getRequestViewCities(){const cities=new Set();requests.forEach(r=>String(r.city||'').split(/[،,\n]+/).map(canonicalCity).filter(Boolean).forEach(c=>cities.add(c)));return [...cities].sort((a,b)=>a.localeCompare(b,'ar'))}
function renderRequestCities(){const select=$('requestCity'),box=$('requestCityOptions'),selectedBox=$('requestCitySelected');if(!select||!box)return;const allCities=getRequestCitiesFromOffers();const selected=new Set([...select.options].filter(o=>o.selected).map(o=>canonicalCity(o.value)));const q=normalizeArabicKey($('requestCitySearch')?.value||'');select.innerHTML=allCities.map(c=>`<option value="${escapeHtml(c)}"${selected.has(c)?' selected':''}>${escapeHtml(c)}</option>`).join('');const cities=q?allCities.filter(c=>normalizeArabicKey(c).includes(q)):[];box.classList.toggle('has-results',!!q);box.innerHTML=q?(cities.length?cities.map(c=>{const isSel=selected.has(c);const safe=String(c).replace(/\\/g,'\\\\').replace(/'/g,"\\'");return `<button type="button" class="request-city-option${isSel?' selected':''}" onclick="toggleRequestCity('${safe}')"><span>${escapeHtml(c)}</span><span class="request-city-check">${isSel?'✓':'○'}</span></button>`}).join(''):'<div class="request-city-empty">لا توجد مدينة مطابقة للبحث.</div>'):'';if(selectedBox){if(allRequestCitiesSelected()){selectedBox.innerHTML='<span class="request-city-all-summary">✓ كل المدن</span>'}else if(selected.size){const names=[...selected];const compact=names.length<=5?names.join('، '):names.slice(0,4).join('، ')+'، …';selectedBox.innerHTML=`<span class="request-city-compact">${escapeHtml(compact)}</span>`}else{selectedBox.innerHTML='<span class="request-city-none">لم يتم تحديد مدينة</span>'}}const allBtn=$('requestCitySearch')?.parentElement?.querySelector('.request-all-cities-btn');if(allBtn)allBtn.textContent=allRequestCitiesSelected()?'✓ كل المدن':'✓ كل المدن'}
function toggleRequestCity(city){const select=$('requestCity');if(!select)return;const wanted=canonicalCity(city);[...select.options].forEach(o=>{if(canonicalCity(o.value)===wanted)o.selected=!o.selected});renderRequestCities()}
function filterRequestCityOptions(){renderRequestCities()}
function populateRequestViewCities(){const el=$('requestViewCity');if(!el)return;const current=el.value||'';const cities=getRequestViewCities();el.innerHTML=(cities.length?'<option value="">كل المدن</option>':'<option value="">لا توجد طلبات</option>')+cities.map(c=>`<option value="${escapeHtml(c)}">${escapeHtml(c)}</option>`).join('');if(cities.includes(current))el.value=current;else el.value=''}
function selectRequestViewCity(city){const el=$('requestViewCity');if(el)el.value=city||'';renderRequests()}
function requestCitiesMatch(r,city){const raw=String(city||'').trim();if(!raw||raw==='كل المدن'||raw==='جميع المدن')return true;const wanted=canonicalCity(raw);if(!wanted||wanted==='كل المدن'||wanted==='جميع المدن')return true;return String(r.city||'').split(/[،,\n]+/).map(c=>canonicalCity(c)).filter(Boolean).includes(wanted)}
function compactRequestValues(value,icon,id,kind){
  const raw=String(value||'').trim(); if(!raw)return '';
  const parts=raw.split(/[،,\n]+/).map(c=>String(c).trim()).filter(Boolean);
  const isAll=parts.length>=20 || parts.some(c=>canonicalCity(c)==='كل المدن');
  if(isAll)return `<div class="request-compact-line"><span>${icon} كل المدن</span></div>`;
  const limit=4, shown=parts.slice(0,limit), more=parts.length>limit;
  const key='req_'+kind+'_'+id;
  const full=parts.map(x=>escapeHtml(x)).join('، ');
  const short=shown.map(x=>escapeHtml(x)).join('، ');
  return `<div class="request-compact-line" data-request-compact="${key}"><span>${icon}</span><span class="request-compact-short">${short}</span>${more?`<button type="button" class="request-more" onclick="toggleRequestCompact('${key}')">المزيد</button><span class="request-compact-full" hidden>${full}</span>`:''}</div>`;
}
function toggleRequestCompact(key){
  const row=document.querySelector(`[data-request-compact="${key}"]`);if(!row)return;
  const short=row.querySelector('.request-compact-short'),full=row.querySelector('.request-compact-full'),btn=row.querySelector('.request-more');
  if(!full||!btn)return;
  const open=!full.hidden;
  full.hidden=open; short.hidden=!open; btn.textContent=open?'المزيد':'أقل';
}
function toggleRequestMode(on){requestMode=!!on;const panel=$('requestsPanel'),mapCard=document.querySelector('.map-card'),offersCard=document.querySelector('#offersSection');if(requestMode){panel?.classList.remove('hidden');mapCard?.classList.add('hidden');offersCard?.classList.add('hidden');$('advancedFilters')?.classList.add('hidden');$('requestQuickBtn')?.classList.add('active');$('allFilterBtn')?.classList.remove('active');populateRequestViewCities()}else{panel?.classList.add('hidden');mapCard?.classList.remove('hidden');offersCard?.classList.remove('hidden');$('requestQuickBtn')?.classList.remove('active');$('allFilterBtn')?.classList.add('active');if(map)setTimeout(()=>map.invalidateSize(true),50)}}
function showRequestsView(){toggleRequestMode(true);renderRequests();$('requestsPanel')?.scrollIntoView({behavior:'smooth',block:'start'})}
function closeRequestsPanel(){toggleRequestMode(false)}
function openRequestModal(){if(!currentUser)return alert('سجّل الدخول أولًا.');editingRequestId=null;if($('requestModalTitle'))$('requestModalTitle').textContent='إضافة طلب جديد';if($('requestText'))$('requestText').value='';if($('requestDistrict'))$('requestDistrict').value='';if($('requestPhone'))$('requestPhone').value='';if($('requestDeal'))$('requestDeal').value='';if($('requestSource'))$('requestSource').value='';if($('requestPropertyType'))$('requestPropertyType').value='';if($('requestCitySearch'))$('requestCitySearch').value='';if($('requestCity'))[...$('requestCity').options].forEach(o=>o.selected=false);renderRequestCities();$('requestModal')?.classList.remove('hidden');$('requestModal')?.setAttribute('aria-hidden','false');document.body.classList.add('modal-open')}
function openEditRequestModal(id){if(!currentUser)return alert('سجّل الدخول أولًا.');const r=requests.find(x=>String(x.id)===String(id));if(!r)return alert('تعذر العثور على الطلب.');editingRequestId=String(id);if($('requestModalTitle'))$('requestModalTitle').textContent='تعديل الطلب';if($('requestDeal'))$('requestDeal').value=String(r.deal||'');if($('requestSource'))$('requestSource').value=String(r.source||'');if($('requestPropertyType'))$('requestPropertyType').value=String(r.property_type==='__REQUEST__'?'':r.property_type||'');if($('requestText'))$('requestText').value=String(r.notes||'').replace(/^\[\[REQUEST\]\]\s*/i,'');if($('requestDistrict'))$('requestDistrict').value=String(r.district||'');if($('requestPhone'))$('requestPhone').value=String(r.phone||'');if($('requestCitySearch'))$('requestCitySearch').value='';renderRequestCities();const wanted=String(r.city||'').split(/[،,\n]+/).map(canonicalCity).filter(Boolean);if($('requestCity'))[...$('requestCity').options].forEach(o=>o.selected=wanted.includes(canonicalCity(o.value)));renderRequestCities();$('requestModal')?.classList.remove('hidden');$('requestModal')?.setAttribute('aria-hidden','false');document.body.classList.add('modal-open')}
function closeRequestModal(){editingRequestId=null;$('requestModal')?.classList.add('hidden');$('requestModal')?.setAttribute('aria-hidden','true');document.body.classList.remove('modal-open')}
function normalizePhone(v){return String(v||'').trim().replace(/[^0-9+]/g,'')}
function whatsappUrl(p){let n=normalizePhone(p).replace(/\D/g,'');if(n.startsWith('05'))n='966'+n.slice(1);if(n.startsWith('966'))return 'https://wa.me/'+n;return n?'https://wa.me/'+n:''}
function requestShareCity(r){
  const filtered=String($('requestViewCity')?.value||'').trim();
  if(filtered)return filtered;
  const cities=String(r?.city||'').split(/[،,\n]+/).map(c=>c.trim()).filter(Boolean);
  if(cities.length===1)return cities[0];
  return 'كل المدن';
}
function requestShareTitle(r){
  const deal=r?.deal==='شراء'?'طلب شراء':r?.deal==='استئجار'?'طلب استئجار':'طلب';
  const prop=String(r?.property_type||'').trim();
  const city=requestShareCity(r);
  return [deal,prop,city].filter(Boolean).join(' ');
}
function requestShareText(r){
  const lines=[];
  const title=requestShareTitle(r)||'طلب عقاري';
  const body=String(r?.notes||'').replace(/^\[\[REQUEST\]\]\s*/i,'').trim();
  const district=String(r?.district||'').trim();
  lines.push(`*${title}*`);
  if(district){lines.push('');lines.push(`📍 الأحياء المطلوبة: ${district}`)}
  if(body){lines.push('');lines.push(body)}
  const contact=shareContactLine();
  if(contact){lines.push('');lines.push(contact)}
  return lines.join('\n').trim();
}
async function shareRequest(id){
  const r=requests.find(x=>String(x.id)===String(id));
  if(!r)return;
  if(!getClientContactPhone()){const saved=await ensureAccountContactPhone();if(!saved)return;}
  const text=requestShareText(r);
  try{
    if(navigator.share){await navigator.share({title:requestShareTitle(r)||'طلب عقاري',text});return;}
  }catch(e){if(e?.name==='AbortError')return;console.warn('native request share',e)}
  try{await navigator.clipboard.writeText(text);alert('تم نسخ الطلب للمشاركة.')}catch(_){prompt('انسخ نص الطلب:',text)}
}
function formatRequestCitiesDisplay(value){const raw=String(value||'').trim();if(!raw)return 'غير محدد';const cities=raw.split(/[،,\n]+/).map(c=>c.trim()).filter(Boolean);if(cities.length>=20)return 'كل المدن';if(cities.length<=4)return cities.join('، ');return cities.slice(0,4).join('، ')+'، والمزيد';}
function renderRequests(){
  const list=$('requestsList'),count=$('requestCount'),quickCount=$('quickRequestCount');
  if(count)count.textContent=String(requests.length);
  if(quickCount)quickCount.textContent=String(requests.length);
  if(!list)return;
  const city=String($('requestViewCity')?.value||'').trim(),deal=String($('requestViewDeal')?.value||'').trim(),property=String($('requestViewProperty')?.value||'').trim();
  const arr=requests.filter(r=>requestCitiesMatch(r,city)&&(!deal||String(r.deal||'')===deal)&&(!property||String(r.property_type||'')===property));
  const sum=$('requestFilterSummary');if(sum)sum.textContent=city?`طلبات ${city}`:'جميع الطلبات';
  list.innerHTML=arr.length?arr.map(r=>{
    const wa=whatsappUrl(r.phone||'');
    const dealLabel=r.deal==='شراء'?'طلب شراء':r.deal==='استئجار'?'طلب استئجار':'طلب';
    const safeId=String(r.id).replace(/'/g,"\\'");
    const body=String(r.notes||'').replace(/^\[\[REQUEST\]\]\s*/i,'');
    return `<article class="request-item">
      ${compactRequestValues(r.city,'📍',safeId,'city')}
      ${r.district?compactRequestValues(r.district,'🏘️',safeId,'district'):''}
      <div class="request-request-type">${escapeHtml(dealLabel)}${r.property_type&&r.property_type!=='__REQUEST__'?` · ${escapeHtml(r.property_type)}`:''}${r.source?` · ${escapeHtml(r.source)}`:''}</div>
      <div class="raw-offer request-raw"><b>نص الطلب</b><div>${escapeHtml(body).replace(/\n/g,'<br>')}</div></div>
      <div class="request-card-actions">
        ${wa?`<a class="request-phone" href="${wa}" target="_blank" rel="noopener">🟢 واتساب</a>`:'<span class="request-empty-action"></span>'}
        <button class="request-edit" type="button" onclick="openEditRequestModal('${safeId}')">✏️ تعديل</button>
        <button class="request-delete" type="button" onclick="deleteRequest('${safeId}')">🗑️ حذف</button>
        <button class="request-share" type="button" onclick="shareRequest('${safeId}')">📤 مشاركة</button>
      </div>
    </article>`
  }).join(''):'<div class="request-empty">لا توجد طلبات مطابقة.</div>';
}
async function saveRequest(){if(!currentUser)return alert('سجّل الدخول أولًا.');const cities=selectedRequestCities(),deal=String($('requestDeal')?.value||'').trim(),source=String($('requestSource')?.value||'').trim(),propertyType=String($('requestPropertyType')?.value||'').trim(),district=String($('requestDistrict')?.value||'').trim(),text=String($('requestText')?.value||'').trim(),phone=String($('requestPhone')?.value||'').trim();if(!cities.length)return alert('اختر مدينة واحدة على الأقل.');if(!deal)return alert('اختر نوع الطلب: شراء أو استئجار.');if(!source)return alert('اختر المصدر: مباشر أو غير مباشر.');if(!propertyType)return alert('اختر نوع العقار.');if(!text)return alert('اكتب الطلب أولًا.');const now=new Date().toISOString();if(editingRequestId){const payload={city:cities.join('، '),district,deal,source,property_type:propertyType,phone,notes:'[[REQUEST]] '+text,status:'طلب',updated_at:now};const {error}=await supabaseClient.from('offers').update(payload).eq('id',editingRequestId).eq('user_id',currentUser.id);if(error){console.error(error);return alert('تعذر تعديل الطلب: '+(error.message||'خطأ غير معروف'));}closeRequestModal();await loadOffers();render();showRequestsView();showToast('تم تعديل الطلب بنجاح ✓','success');return}const id=crypto.randomUUID();const payload={id,user_id:currentUser.id,deal,source,property_type:propertyType,city:cities.join('، '),district,price:'',area:'',rooms:'',baths:'',owner:'',phone,location:'',map_url:'',latitude:null,longitude:null,status:'طلب',features:[],notes:'[[REQUEST]] '+text,created_at:now,updated_at:now,images:[]};const {error}=await supabaseClient.from('offers').insert(payload);if(error){console.error(error);return alert('تعذر حفظ الطلب: '+(error.message||'خطأ غير معروف'));}closeRequestModal();await loadOffers();render();showRequestsView();showToast('تم حفظ الطلب في القائمة الخاصة ✓','success')}
async function deleteRequest(id){if(!currentUser)return;if(!confirm('حذف هذا الطلب من القائمة الخاصة؟'))return;const {error}=await supabaseClient.from('offers').delete().eq('id',id).eq('user_id',currentUser.id);if(error)return alert('تعذر حذف الطلب: '+(error.message||'خطأ'));await loadOffers();render();showRequestsView()}
async function loadOffers(){
if(!supabaseClient){setAuthMsg('خدمة البيانات غير جاهزة. حدّث الصفحة ثم جرّب مرة أخرى.',true);return false}
const cacheKey=currentUser?.id?'uroodi_offers_cache_'+String(currentUser.id):'';
let cached=null;
try{if(cacheKey){const raw=localStorage.getItem(cacheKey);if(raw){const c=JSON.parse(raw);if(Array.isArray(c?.rows))cached=c.rows;}}}catch(_){}
const applyRows=rows=>{
requests=rows.filter(o=>o.property_type==='__REQUEST__'||o.status==='طلب'||String(o.notes||'').startsWith('[[REQUEST]]'));
offers=rows.filter(o=>!(o.property_type==='__REQUEST__'||o.status==='طلب'||String(o.notes||'').startsWith('[[REQUEST]]')));
};
let data=null,error=null;
try{({data,error}=await supabaseClient.from('offers').select('*').order('created_at',{ascending:false}));}catch(e){error=e}
if(error){
  if(Array.isArray(cached)&&cached.length){applyRows(cached.map(o=>({...o,type:o.property_type||'',mapUrl:o.map_url||'',images:Array.isArray(o.images)?o.images:[],_signed:[]})));setAuthMsg('تعذر تحديث البيانات الآن — تم عرض آخر نسخة محفوظة.',false);return renderAndPrepareOffers();}
  setAuthMsg(error.message||'تعذر تحميل البيانات.',true);return false;
}
const rows=(data||[]).map(o=>({...o,type:o.property_type||'',mapUrl:o.map_url||'',images:Array.isArray(o.images)?o.images:[],_signed:[]}));
// A transient empty Supabase response must not erase a known-good local copy.
if(rows.length===0 && Array.isArray(cached)&&cached.length){
  applyRows(cached.map(o=>({...o,type:o.property_type||'',mapUrl:o.map_url||'',images:Array.isArray(o.images)?o.images:[],_signed:[]})));
  setTimeout(async()=>{try{const retry=await supabaseClient.from('offers').select('*').order('created_at',{ascending:false});if(!retry.error && Array.isArray(retry.data) && retry.data.length){const rr=retry.data.map(o=>({...o,type:o.property_type||'',mapUrl:o.map_url||'',images:Array.isArray(o.images)?o.images:[],_signed:[]}));applyRows(rr);try{localStorage.setItem(cacheKey,JSON.stringify({rows:rr,savedAt:Date.now()}))}catch(_){};renderAndPrepareOffers()}}catch(_){ }},1200);
  return renderAndPrepareOffers();
}
applyRows(rows);
try{if(cacheKey)localStorage.setItem(cacheKey,JSON.stringify({rows,savedAt:Date.now()}))}catch(_){}
return renderAndPrepareOffers();
}
async function signOfferImage(path){
  const key=String(path||'').trim(); if(!key)return null;
  if(/^https?:\/\//i.test(key))return key;
  const cached=imageUrlCache.get(key);
  if(cached&&cached.url&&cached.expiresAt>Date.now()+120000)return cached.url;
  try{
    const r=await supabaseClient.storage.from('offer-images').createSignedUrl(key,3600);
    const u=r?.data?.signedUrl;
    if(u){imageUrlCache.set(key,{url:u,expiresAt:Date.now()+3300000});return u;}
  }catch(_){ }
  return null;
}
async function renderAndPrepareOffers(){
  await Promise.all(offers.map(async o=>{
    if(!Array.isArray(o.images)||!o.images[0])return;
    const u=await signOfferImage(o.images[0]);
    if(u)o._signed=[u,...(o._signed||[]).slice(1)];
  }));
  renderRequests(); populateRequestViewCities();
  const validIds=new Set(offers.map(o=>String(o.id)));
  const cleaned=[...favorites].filter(id=>validIds.has(String(id)));
  if(cleaned.length!==favorites.size){favorites=new Set(cleaned);saveFavorites();if(currentUser)syncFavoritesToCloud().catch(()=>{});updateFavoritesUI();}
  render();
  void Promise.all(offers.map(async o=>{
    const existingFirst=o._signed?.[0]||null;
    const rest=(Array.isArray(o.images)?o.images:[]).slice(existingFirst?1:0,8);
    const restSigned=(await Promise.all(rest.map(signOfferImage))).filter(Boolean);
    o._signed=(existingFirst?[existingFirst,...restSigned]:restSigned);
    const card=document.querySelector('#offer-'+CSS.escape(String(o.id)));
    if(card)card.querySelectorAll('.offer-photos img').forEach((img,i)=>{const src=o._signed?.[i];if(src&&img.getAttribute('src')!==src){img.src=src;img.dataset.imagePath=String(o.images?.[i]||'');attachOfferImageCache(o,img);}});
  })).catch(e=>console.warn('background image signing',e));
  return true;
}
async function repairMapLocations(){if(!currentUser)return;const targets=offers.filter(o=>Number.isFinite(Number(o.latitude))&&Number.isFinite(Number(o.longitude))&&(!canonicalCity(o.city)||!String(o.district||'').trim())).slice(0,6);if(!targets.length)return;let changed=false;await Promise.all(targets.map(async o=>{try{const text='@'+Number(o.latitude)+','+Number(o.longitude);const r=await fetch('/api/analyze',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({text})});if(!r.ok)return;const d=await r.json();const city=canonicalCity(d.city||o.city||'');const district=String(d.district||o.district||'').trim();const location=String(d.location||o.location||'').trim();if(!city&&!district)return;const patch={city,district,location,updated_at:new Date().toISOString()};const {error}=await supabaseClient.from('offers').update(patch).eq('id',o.id).eq('user_id',currentUser.id);if(!error){Object.assign(o,patch);changed=true}}catch(e){console.warn('repair map location',e)}}));if(changed){renderCityMenu();render();}}
async function uploadImages(offerId,images){const paths=[];for(let i=0;i<Math.min(8,images.length);i++){const src=images[i];const blob=await (await fetch(src)).blob();const path=`${currentUser.id}/${offerId}/${Date.now()}-${i}.jpg`;const {error}=await supabaseClient.storage.from('offer-images').upload(path,blob,{contentType:'image/jpeg',upsert:false});if(error)throw error;paths.push(path)}return paths}
async function migrateLocalOffers(){if(!currentUser||!localOffers.length)return;for(const lo of localOffers){const id=lo.id||crypto.randomUUID();const payload={id,user_id:currentUser.id,deal:lo.deal||'',source:lo.source||'',property_type:lo.type||'',city:lo.city||'',district:lo.district||'',price:lo.price||'',area:lo.area||'',rooms:lo.rooms||'',baths:lo.baths||'',owner:lo.owner||'',phone:lo.phone||'',location:lo.location||'',map_url:lo.mapUrl||'',latitude:lo.latitude?Number(lo.latitude):null,longitude:lo.longitude?Number(lo.longitude):null,status:lo.status||'متاح',features:lo.features||[],notes:lo.notes||'',created_at:lo.createdAt||new Date().toISOString(),updated_at:new Date().toISOString(),images:[]};const {error}=await supabaseClient.from('offers').upsert(payload);if(error)continue;if(lo.images?.length){try{const paths=await uploadImages(id,lo.images);await supabaseClient.from('offers').update({images:paths,updated_at:new Date().toISOString()}).eq('id',id).eq('user_id',currentUser.id)}catch(e){console.error(e)}}}}
function setMsg(t,err=false){$('msg').textContent=t;$('msg').className=err?'err':'ok'}
function imageToJpeg(file,maxSide=1600,quality=.82){return new Promise((resolve,reject)=>{const reader=new FileReader();reader.onerror=()=>reject(new Error('تعذر قراءة إحدى الصور.'));reader.onload=()=>{const img=new Image();img.onerror=()=>reject(new Error('تعذر قراءة إحدى الصور. جرّب JPG أو PNG.'));img.onload=()=>{const scale=Math.min(1,maxSide/Math.max(img.naturalWidth,img.naturalHeight)),w=Math.max(1,Math.round(img.naturalWidth*scale)),h=Math.max(1,Math.round(img.naturalHeight*scale)),c=document.createElement('canvas');c.width=w;c.height=h;c.getContext('2d').drawImage(img,0,0,w,h);resolve(c.toDataURL('image/jpeg',quality))};img.src=reader.result};reader.readAsDataURL(file)})}
function renderPhotoStrip(targetId,images){const el=$(targetId);if(!el)return;el.innerHTML=(images||[]).map((src,i)=>`<div class="photo-thumb"><img src="${src}" loading="eager" fetchpriority="high" decoding="async" crossorigin="anonymous" alt="صورة العرض ${i+1}"><span>${i+1}</span></div>`).join('')}
async function previewPhotos(){try{pendingImages=[];for(const f of [...$('photos').files].slice(0,8)){pendingImages.push(await imageToJpeg(f,1000,.68))}renderPhotoStrip('photoPreview',pendingImages)}catch(e){setMsg(e.message||'تعذر تجهيز الصور.',true)}}
let selectedDeal="",selectedSource="";
function syncOfferType(){
  const deal=$("addDeal")?.value||"", type=$("addPropertyType")?.value||"";
  selectedDeal=deal&&type ? `${type} ${deal==='إيجار'?'للإيجار':'للبيع'}` : '';
  selectedSource=$("addSource")?.value||selectedSource||'';
  const box=$("pricingBox"), sale=$("salePricing"), rent=$("rentPricing");
  if(box){box.classList.toggle('hidden',!deal); sale?.classList.toggle('hidden',deal!=='بيع'); rent?.classList.toggle('hidden',deal!=='إيجار');}
  updateSelectedSummary();
}
function updateSelectedSummary(){const el=$("selectedSummary");if(!el)return;el.textContent=(selectedDeal?`نوع العرض: ${selectedDeal}`:'اختر نوع العرض ونوع العقار')+'  ·  '+(selectedSource?`المصدر: ${selectedSource}`:'اختر المصدر')}
async function analyze(){
  const text=$("raw").value.trim(),phone=$("addPhone").value.trim();
  syncOfferType();
  if(!$("addDeal").value)return setMsg('اختر نوع العرض: بيع أو إيجار.',true);
  if(!$("addPropertyType").value)return setMsg('اختر نوع العقار.',true);
  if(!selectedSource)return setMsg('اختر مصدر العرض: مباشر أو غير مباشر.',true);
  if(!text)return setMsg('ألصق نص العرض أولاً.',true);
  $("analyzeBtn").disabled=true;setMsg('جاري تحديد الموقع والمدينة والحي...');
  try{
    const images=[];for(const f of [...$("photos").files].slice(0,8))images.push(await imageToJpeg(f,1600,.82));
    pendingImages=images.slice();renderPhotoStrip('photoPreview',pendingImages);
    const r=await fetch('/api/analyze',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({text})});
    const rawResponse=await r.text();
    let d={};try{d=rawResponse?JSON.parse(rawResponse):{}}catch(_){throw new Error(`تعذر قراءة رد الخادم (${r.status}).`)}
    if(!r.ok)throw new Error(d.error||`تعذر تحديد الموقع (${r.status})`);
    // Keep the modal open. The detected city/district are editable before saving.
    $('addCity').value=canonicalCity(d.city||'');
    $('addDistrict').value=String(d.district||'').trim();
    $('addMapUrl').value=d.mapUrl||'';
    $('addLat').value=d.latitude||'';
    $('addLng').value=d.longitude||'';
    $('addLocation').value=d.location||'';
    renderAddCityOptions();renderAddDistrictOptions($('addCity').value);
    const shown=[d.city,d.district].filter(Boolean).join(' — ');
    const loc=$('detectedLocation');
    if(loc){loc.classList.remove('hidden');loc.textContent=shown?`📍 الموقع المحدد تلقائيًا: ${shown} — يمكنك تعديل المدينة أو الحي قبل الحفظ.`:'📍 لم يتم التعرف على المدينة أو الحي. اكتبها يدويًا ثم احفظ العرض.';}
    $('analyzeBtn').textContent=editingId?'💾 حفظ تعديلات العرض':'💾 حفظ العرض';
    $('analyzeBtn').onclick=saveAnalyzedOffer;
    setMsg(shown?`تم تحديد الموقع: ${shown}. راجع المدينة والحي ثم اضغط حفظ العرض.`:'تم تحديد الموقع. اكتب المدينة والحي إذا لزم ثم اضغط حفظ العرض.');
  }catch(e){console.error(e);setMsg(e.message||'حدث خطأ غير متوقع.',true)}finally{$("analyzeBtn").disabled=false}
}

function renderAddCityOptions(){
  const dl=$('saudiCitiesList');if(!dl)return;
  const vals=[...new Set((typeof saudiCities!=='undefined'?saudiCities:[]).map(canonicalCity).filter(Boolean))].sort((a,b)=>a.localeCompare(b,'ar'));
  dl.innerHTML=vals.map(v=>`<option value="${escapeHtml(v)}"></option>`).join('');
}
function renderAddDistrictOptions(city){
  const dl=$('districtsList');if(!dl)return;
  const vals=[...new Set(districtValuesForCity(city))];
  dl.innerHTML=vals.map(v=>`<option value="${escapeHtml(v)}"></option>`).join('');
}
function resetAnalyzeState(){
  $('analyzeBtn').textContent=editingId?'💾 حفظ تعديلات العرض':'📍 تحديد الموقع';
  $('analyzeBtn').onclick=analyze;
  $('addCity').value='';$('addDistrict').value='';$('addMapUrl').value='';$('addLat').value='';$('addLng').value='';$('addLocation').value='';
  $('detectedLocation')?.classList.add('hidden');
  renderAddCityOptions();renderAddDistrictOptions('');
}
async function saveAnalyzedOffer(){
  const city=String($('addCity').value||'').trim(), district=String($('addDistrict').value||'').trim();
  if(!city)return setMsg('اكتب المدينة أو اخترها من قائمة المدن قبل الحفظ.',true);
  await saveSimpleOffer({
    text:$('raw').value.trim(),phone:$('addPhone').value.trim(),
    mapUrl:$('addMapUrl').value.trim(),latitude:$('addLat').value.trim(),longitude:$('addLng').value.trim(),
    city,district,location:$('addLocation').value.trim(),area:$('addArea').value.trim()
  });
}

function pricingFromForm(){
  const deal=$("addDeal")?.value||'';
  if(deal==='إيجار') return {deal:'إيجار',annual:String($("rentAnnual")?.value||'').trim()};
  if(deal==='بيع') return {deal:'بيع',sale:String($("salePrice")?.value||'').trim()};
  return {deal};
}
function pricingMarker(pr){return `\n\n[[PRICING:${JSON.stringify(pr)}]]`;}
function parsePricing(o){
  const raw=String(o?.notes||''); const m=raw.match(/\[\[PRICING:(.*?)\]\]/s); if(m){try{return JSON.parse(m[1])}catch(_){}}
  return o?.pricing&&typeof o.pricing==='object'?o.pricing:null;
}
function cleanOfferNotes(o){return String(o?.notes||'').replace(/\s*\[\[PRICING:.*?\]\]/gs,'').replace(/\s*\[\[BROKER_UPDATED\]\]/gi,'').trim()}
function pricingShareLines(o){
  const p=parsePricing(o); if(!p)return []; const lines=[];
  if(p.deal==='إيجار'){if(p.annual)lines.push(`💰 قيمة الإيجار: ${displayPrice(p.annual)}`);}
  else if(p.deal==='بيع'){if(p.sale)lines.push(`💰 قيمة البيع: ${displayPrice(p.sale)}`);}
  return lines;
}

async function saveSimpleOffer({text,phone,mapUrl,latitude,longitude,city='',district='',location='',area=''}){
  if(!currentUser) throw new Error('سجّل الدخول أولاً.');
  const isEdit=!!editingId;
  const id=editingId||crypto.randomUUID();
  const isRent=$('addDeal').value==='إيجار', propertyType=$('addPropertyType').value;
  const existing=offers.find(x=>x.id===id);
  const payload={
    id,user_id:currentUser.id,deal:isRent?'إيجار':'بيع',source:selectedSource,property_type:propertyType,
    city:canonicalCity(city||existing?.city||''),district:district||existing?.district||'',price:(pricingFromForm().deal==='إيجار'?pricingFromForm().annual:(pricingFromForm().sale||existing?.price||'')),area:area||existing?.area||'',
    rooms:existing?.rooms||'',baths:existing?.baths||'',owner:existing?.owner||'',phone,location:location||existing?.location||'',
    map_url:mapUrl||existing?.mapUrl||existing?.map_url||'',
    latitude:latitude!==''&&latitude!=null?Number(latitude):(existing?.latitude??null),
    longitude:longitude!==''&&longitude!=null?Number(longitude):(existing?.longitude??null),
    status:existing?.status||'متاح',features:existing?.features||[],notes:text+pricingMarker(pricingFromForm())+(isEdit?' [[BROKER_UPDATED]]':' [[BROKER_NEW]]'),updated_at:new Date().toISOString()
  };
  if(!isEdit) payload.created_at=new Date().toISOString();
  const {error}=await supabaseClient.from('offers').upsert(payload); if(error) throw error;
  if(pendingImages.length){
    if(existing?.images?.length){try{await supabaseClient.storage.from('offer-images').remove(existing.images)}catch(e){console.warn('old image cleanup',e)}}
    const paths=await uploadImages(id,pendingImages);
    const {error:e2}=await supabaseClient.from('offers').update({images:paths,updated_at:new Date().toISOString()}).eq('id',id).eq('user_id',currentUser.id);
    if(e2) throw e2;
  }
  await loadOffers(); render(); pendingImages=[]; renderPhotoStrip('photoPreview',[]); $('photos').value=''; $('raw').value=''; $('addPhone').value=''; $('addDeal').value=''; $('addPropertyType').value=''; $('addArea').value=''; $('addSource').value=''; $('salePrice').value=''; $('rentAnnual').value=''; $('addCity').value=''; $('addDistrict').value=''; $('addMapUrl').value=''; $('addLat').value=''; $('addLng').value=''; $('addLocation').value=''; $('detectedLocation')?.classList.add('hidden'); selectedDeal=''; selectedSource=''; editingId=null; $('analyzeBtn').textContent='📍 تحديد الموقع'; $('analyzeBtn').onclick=analyze; updateSelectedSummary(); renderAddCityOptions(); renderAddDistrictOptions('');
  closeAddModal();
  showToast(isEdit?'تم حفظ تعديلات العرض بنجاح ✓':'تم حفظ العرض بنجاح ✓','success');
  setMsg(isEdit?'تم حفظ تعديلات العرض بنجاح ✓':'تم حفظ العرض بنجاح ✓');
}

function extractCoords(url){if(!url)return null;const s=decodeURIComponent(String(url));let m=s.match(/@\s*(-?\d+(?:\.\d+)?)\s*,\s*(-?\d+(?:\.\d+)?)/);if(m)return[+m[1],+m[2]];m=s.match(/!3d(-?\d+(?:\.\d+)?)!4d(-?\d+(?:\.\d+)?)/);if(m)return[+m[1],+m[2]];m=s.match(/[?&](?:q|query|ll|center|destination|daddr)=(-?\d+(?:\.\d+)?)[, ]+(-?\d+(?:\.\d+)?)/);if(m)return[+m[1],+m[2]];m=s.match(/(-?\d{1,3}\.\d{4,})\s*,\s*(-?\d{1,3}\.\d{4,})/);return m?[+m[1],+m[2]]:null}
async function saveOffer(){if(!currentUser)return alert('سجّل الدخول أولًا.');const id=editingId||crypto.randomUUID();const o={id,user_id:currentUser.id,deal:$('deal').value,source:$('source').value,property_type:$('type').value.trim(),city:$('city').value.trim(),district:$('district').value.trim(),price:$('price').value.trim(),area:$('area').value.trim(),rooms:$('rooms').value.trim(),baths:$('baths').value.trim(),owner:$('owner').value.trim(),phone:$('phone').value.trim(),location:$('location').value.trim(),map_url:$('mapUrl').value.trim(),latitude:$('latitude').value.trim()?Number($('latitude').value):null,longitude:$('longitude').value.trim()?Number($('longitude').value):null,status:$('status').value,features:$('features').value.split('\n').map(x=>x.trim()).filter(Boolean),notes:$('notes').value.trim()+(editingId?' [[BROKER_UPDATED]]':' [[BROKER_NEW]]'),updated_at:new Date().toISOString()};if((o.latitude===null||o.longitude===null)&&o.map_url){const c=extractCoords(o.map_url);if(c){o.latitude=c[0];o.longitude=c[1]}else{try{const rr=await fetch('/api/analyze',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({text:o.map_url})});if(rr.ok){const dd=await rr.json();if(dd.latitude&&dd.longitude){o.latitude=Number(dd.latitude);o.longitude=Number(dd.longitude);if(!o.city&&dd.city)o.city=dd.city;if(!o.district&&dd.district)o.district=dd.district;if(!o.location&&dd.location)o.location=dd.location}}}catch(e){console.warn('map coordinate repair',e)}}}try{let existing=offers.find(x=>x.id===id);if(!existing)o.created_at=new Date().toISOString();const {error}=await supabaseClient.from('offers').upsert(o);if(error)throw error;if(pendingImages.length){if(existing?.images?.length){await supabaseClient.storage.from('offer-images').remove(existing.images)}const paths=await uploadImages(id,pendingImages);const {error:e2}=await supabaseClient.from('offers').update({images:paths,updated_at:new Date().toISOString()}).eq('id',id).eq('user_id',currentUser.id);if(e2)throw e2}await loadOffers();render();pendingImages=[];editingId=null;renderPhotoStrip('photoPreview',[]);renderPhotoStrip('editorPhotos',[]);$('photos').value='';$('editor').classList.add('hidden');alert('تم حفظ العرض والصور في حسابك السحابي.')}catch(e){console.error(e);alert('تعذر حفظ العرض: '+(e.message||'خطأ غير معروف'))}}
async function ensureAccountContactPhone(force=false){
  if(!currentUser||!supabaseClient)return '';
  const existing=String(currentUser?.user_metadata?.uroodi_contact_phone||'').trim();
  if(existing&&!force)return existing;
  const email=String(currentUser?.email||'').trim().toLowerCase();
  // للحساب المرتبط ببطاقة التواصل: خزّن الرقم تلقائياً مرة واحدة.
  if(email==='abo5alid190@gmail.com'&&!existing){
    try{
      const {data,error}=await supabaseClient.auth.updateUser({data:{uroodi_contact_phone:'0539004450'}});
      if(!error){if(data?.user)currentUser=data.user;return '0539004450';}
    }catch(e){console.warn('save branded contact',e)}
    return '0539004450';
  }
  let phone=window.prompt('رقم التواصل للعملاء (يُحفظ مرة واحدة لهذا الحساب فقط)\nمثال: 05xxxxxxxx');
  if(phone===null)return '';
  phone=String(phone).trim().replace(/[^0-9+]/g,'');
  if(phone.startsWith('+966')) phone='0'+phone.slice(4);
  if(phone.startsWith('966')) phone='0'+phone.slice(3);
  if(!/^05\d{8}$/.test(phone)){
    alert('رقم الجوال غير صحيح. أدخل رقمًا يبدأ بـ 05 ويتكون من 10 أرقام.');
    return '';
  }
  try{
    const {data,error}=await supabaseClient.auth.updateUser({data:{uroodi_contact_phone:phone}});
    if(error)throw error;
    if(data?.user)currentUser=data.user;
    return phone;
  }catch(e){console.error(e);alert('تعذر حفظ رقم الجوال. حاول مرة أخرى.');return ''}
}

function getClientContactPhone(){
  const saved=String(currentUser?.user_metadata?.uroodi_contact_phone||'').trim();
  if(/^05\d{8}$/.test(saved))return saved;
  // الحساب صاحب بطاقة التواصل: لا يعتمد على تأخر تحديث user_metadata في جلسة iOS.
  const email=String(currentUser?.email||'').trim().toLowerCase();
  if(email==='abo5alid190@gmail.com') return '0539004450';
  return '';
}
function shareContactLine(){
  const phone=getClientContactPhone();
  return phone?`📞 للتواصل: ${phone}`:'';
}
function normalizeShareSource(v){
  const s=String(v||'').trim().toLowerCase().replace(/\s+/g,' ');
  if(!s)return '';
  if(s==='مباشر'||s.includes('مباشر مع المالك')||s.includes('مع المالك')||s==='direct') return 'مع المالك';
  if(s==='غير مباشر'||s.includes('مع المباشر')||s.includes('غير مباشر')||s==='indirect'||s.includes('وسيط')) return 'مع المباشر';
  return s;
}
function shareSourceLabel(o){
  const source=normalizeShareSource(o?.source);
  if(source==='مع المالك') return '👤 مع المالك';
  if(source==='مع المباشر') return '🤝 مع المباشر';
  return '';
}

function wa(p){p=(p||'').replace(/\D/g,'');if(p.startsWith('05'))p='966'+p.slice(1);if(!p)return;const webUrl='https://wa.me/'+p;window.location.href=webUrl}
function offerShareText(o){
  const lines=[];
  const titleText=buildOfferTitle(o);
  if(titleText) lines.push(`🏠 ${titleText}`);
  const body=cleanOfferNotes(o);
  if(body){ lines.push(''); lines.push(body); lines.push(''); }
  const areaValue=String(o?.area||'').trim() || ((cleanOfferNotes(o).match(/(?:المساحة|مساحة|المساحه)\s*[:：]?\s*([0-9٠-٩][0-9٠-٩,٬.٫]*(?:\s*(?:م²|م2|متر(?:\s*مربع)?))?)/i)||[])[1] || '');
  if(areaValue) lines.push(`📐 المساحة: ${areaValue}`);
  const prices=pricingShareLines(o);
  if(prices.length) lines.push(...prices);
  const source=normalizeShareSource(o?.source);
  if(source==='مع المالك') lines.push('👤 الصفة: مع المالك');
  else if(source==='مع المباشر') lines.push('👤 الصفة: مع المباشر');
  else if(source) lines.push(`👤 الصفة: ${source}`);
  lines.push(`🪪 الرخصة العقارية: \u20661100119323\u2069`);
  lines.push(`📞 للتواصل: \u20660539004450\u2069`);
  return lines.join('\n').trim();
}
async function getShareFile(o){
  if(!o)return null;
  if(o._shareFile)return o._shareFile;
  if(o._shareFilePromise)return o._shareFilePromise;
  o._shareFilePromise=(async()=>{
    try{
      // First use the image that is already rendered on screen. This avoids a
      // second network download when the photo has already been loaded.
      const ready=shareImageFileFromCard(o);
      if(ready){o._shareFile=ready;return ready;}
      const path=String(o?.images?.[0]||'').trim();
      let blob=null;
    if(path && !/^https?:\/\//i.test(path) && supabaseClient){
      const r=await supabaseClient.storage.from('offer-images').download(path);
      if(!r.error)blob=r.data;
    }
    if(!blob && path && /^https?:\/\//i.test(path)){
      try{const r=await fetch('/api/public-image?url='+encodeURIComponent(path),{cache:'no-store'});if(r.ok)blob=await r.blob();}catch(_){}
    }
    if(!blob && o?._signed?.[0]){
      try{const r=await fetch(o._signed[0],{cache:'no-store'});if(r.ok)blob=await r.blob();}catch(_){}
      if(!blob){try{const r=await fetch('/api/public-image?url='+encodeURIComponent(o._signed[0]),{cache:'no-store'});if(r.ok)blob=await r.blob();}catch(_){} }
    }
      if(blob && blob.type.startsWith('image/')){
        o._shareFile=new File([blob],'صورة-العرض.jpg',{type:blob.type||'image/jpeg'});
        return o._shareFile;
      }
    }catch(e){console.warn('share image file',e)}
    return shareImageFileFromCard(o);
  })();
  try{return await o._shareFilePromise}
  finally{delete o._shareFilePromise}
}
function attachOfferImageCache(o,img){
  if(!img||img.dataset.shareCacheAttached==='1')return;
  img.dataset.shareCacheAttached='1';
  const capture=()=>{try{if(!o._shareFile&&img.complete&&img.naturalWidth)o._shareFile=shareImageFileFromCard(o,img);}catch(_){}};
  if(img.complete)capture(); else img.addEventListener('load',capture,{once:true});
}
function shareImageFileFromCard(o,providedImg){
  try{
    if(o?._shareFile)return o._shareFile;
    const el=providedImg||document.querySelector('#offer-'+CSS.escape(String(o.id))+' .offer-photos img');
    if(!el||!el.complete||!el.naturalWidth)return null;
    const max=1600,scale=Math.min(1,max/Math.max(el.naturalWidth,el.naturalHeight));
    const w=Math.max(1,Math.round(el.naturalWidth*scale)),h=Math.max(1,Math.round(el.naturalHeight*scale));
    const c=document.createElement('canvas');c.width=w;c.height=h;
    const ctx=c.getContext('2d');ctx.drawImage(el,0,0,w,h);
    const data=c.toDataURL('image/jpeg',.86),bin=atob(data.split(',')[1]),bytes=new Uint8Array(bin.length);
    for(let i=0;i<bin.length;i++)bytes[i]=bin.charCodeAt(i);
    return new File([bytes],'صورة-العرض.jpg',{type:'image/jpeg'});
  }catch(e){return null}
}
async function preloadShareFiles(){return true;}
async function shareOffer(id){
  const o=offers.find(x=>String(x.id)===String(id));
  if(!o)return false;
  const title=buildOfferTitle(o),text=offerShareText(o);
  let file=o._shareFile||shareImageFileFromCard(o)||null;
  if(!file && o._shareFilePromise){try{file=await o._shareFilePromise}catch(_){} }
  if(!file && o.images?.length){try{file=await getShareFile(o)}catch(_){} }
  try{
    if(typeof navigator.share==='function'){
      const payload={title:title||'مشاركة العرض',text:text||''};
      if(file&&(!navigator.canShare||navigator.canShare({files:[file]})))payload.files=[file];
      await navigator.share(payload);
      return true;
    }
  }catch(e){if(e?.name==='AbortError')return true;console.warn('share offer',e)}
  try{
    if(navigator.clipboard?.writeText){navigator.clipboard.writeText(text||'').then(()=>alert('تم نسخ نص العرض للمشاركة.')).catch(()=>alert(text||''));return true;}
  }catch(_){ }
  alert(text||'لا يوجد نص للمشاركة.');return false;
}

function num(v){const n=parseFloat(String(v||'').replace(/[^0-9.]/g,''));return Number.isFinite(n)?n:null}
let quickTypeFilter='';let quickCityFilter='';let quickDistrictFilter='';
const saudiCities=['الرياض','جدة','مكة المكرمة','المدينة المنورة','الدمام','الطائف','تبوك','بريدة','خميس مشيط','أبها','حائل','نجران','جازان','ينبع','الجبيل','الأحساء','الهفوف','المبرز','القطيف','الخبر','حفر الباطن','الخرج','الدرعية','الدوادمي','المجمعة','الزلفي','شقراء','وادي الدواسر','القويعية','رماح','ثادق','حريملاء','عفيف','ساجر','الرس','عنيزة','البكيرية','المذنب','البدائع','رياض الخبراء','الأسياح','عقلة الصقور','الشنان','بقعاء','الغزالة','رفحاء','عرعر','طريف','سكاكا','القريات','دومة الجندل','طبرجل','العلا','خيبر','الحناكية','المهد','بدر','الليث','القنفذة','رابغ','خليص','الجموم','بحرة','الخرمة','رنية','تربة','ميسان','المويه','بيشة','النماص','محايل عسير','سراة عبيدة','رجال ألمع','أحد رفيدة','ظهران الجنوب','بلقرن','تنومة','بارق','المجاردة','البرك','العارضة','صبيا','أبو عريش','صامطة','بيش','الدرب','الريث','فرسان','العارضية','الظهران','رأس تنورة','بقيق','صفوى','سيهات','عنك','النعيرية','قرية العليا','الخفجي','الشنان','الأسياح','المذنب','دومة الجندل','الحائط','تيماء','الوجه','ضباء','حقل','أملج','البدع','الحرث','الدائر','العيدابي','فيفاء'];
function initMap(){const el=$('map');if(!el||!window.L)return;if(map){setTimeout(()=>map.invalidateSize(true),50);return}try{
  map=L.map(el,{zoomControl:true,scrollWheelZoom:true,tap:true,preferCanvas:true});
  map.setView([24.7,45.0],5.3);
  const osm=L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',{maxZoom:19,minZoom:3,attribution:'© OpenStreetMap contributors'});
  let tileErrors=0,fallbackUsed=false;
  const useFallback=()=>{if(fallbackUsed||!map)return;fallbackUsed=true;try{map.removeLayer(osm)}catch{};L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Street_Map/MapServer/tile/{z}/{y}/{x}',{maxZoom:19,minZoom:3,attribution:'© Esri'}).addTo(map)};
  osm.on('tileerror',()=>{tileErrors++;if(tileErrors>=3)setTimeout(useFallback,150)});
  osm.addTo(map);
  map.whenReady(()=>setTimeout(()=>{map.invalidateSize(true);if(offers.length)updateMap(filtered(),false)},100));
  setTimeout(()=>{map.invalidateSize(true);if(offers.length)updateMap(filtered(),false)},500);
  window.addEventListener('resize',()=>{if(map)map.invalidateSize(true)});
}catch(e){console.error('Map init error',e);el.innerHTML='<div style="padding:24px;text-align:center;color:#667085;font-weight:800">تعذر تحميل الخريطة. اضغط تحديث الصفحة وحاول مرة أخرى.</div>'}}
const dealTypes=['شقة','بيت','فيلا','دور','عمارة','أرض','أرض تجارية','مزرعة','استراحة','مكتب','محل','مستودع','غرفة'];
function buildTypeMenu(targetId){const el=$(targetId);if(!el)return;el.innerHTML='<button type="button" class="menu-item" onclick="showTypeLevels(\''+targetId+'\',\'root\')">نوع العرض</button><button type="button" class="menu-item" onclick="showTypeLevels(\''+targetId+'\',\'sale\')">للبيع</button><button type="button" class="menu-item" onclick="showTypeLevels(\''+targetId+'\',\'rent\')">للإيجار</button>'}
function showTypeLevels(targetId,level){const el=$(targetId);if(!el)return;if(level==='root'){buildTypeMenu(targetId);return}const suffix=level==='rent'?'للإيجار':'للبيع';el.innerHTML='<button type="button" class="menu-item menu-back" onclick="showTypeLevels(\''+targetId+'\',\'root\')">‹ رجوع</button>'+dealTypes.map(t=>'<button type="button" class="menu-item" onclick="chooseType(\''+targetId+'\',\''+escapeHtml(t+' '+suffix)+'\')">'+escapeHtml(t+' '+suffix)+'</button>').join('')}
function chooseType(targetId,value){if(targetId==='dealMenu'){selectedDeal=value;$('dealPickerBtn').textContent=value+' ▾';$('dealMenu').classList.add('hidden');updateSelectedSummary()}else{quickTypeFilter=value;$('quickTypeBtn').textContent=value+' ▾';$('quickTypeMenu').classList.add('hidden');$('allFilterBtn')?.classList.remove('active');render()}}
function toggleDealMenu(){buildTypeMenu('dealMenu');$('sourceMenu')?.classList.add('hidden');$('dealMenu')?.classList.toggle('hidden')}
function toggleSourceMenu(){$('dealMenu')?.classList.add('hidden');$('sourceMenu').innerHTML='<button type="button" class="menu-item" onclick="chooseSource(\'مباشر\')">🟢 مباشر</button><button type="button" class="menu-item" onclick="chooseSource(\'غير مباشر\')">🔵 غير مباشر</button>';$('sourceMenu')?.classList.toggle('hidden')}
function chooseSource(v){selectedSource=v;$('sourcePickerBtn').textContent=v+' ▾';$('sourceMenu').classList.add('hidden');updateSelectedSummary()}
function toggleQuickTypeMenu(){buildTypeMenu('quickTypeMenu');$('quickSourceMenu')?.classList.add('hidden');$('cityMenu')?.classList.add('hidden');$('districtMenu')?.classList.add('hidden');$('quickTypeMenu')?.classList.toggle('hidden')}
function toggleQuickSourceMenu(){$('quickTypeMenu')?.classList.add('hidden');$('quickSourceMenu').innerHTML='<button type="button" class="menu-item" onclick="chooseQuickSource(\'\')">كل المصادر</button><button type="button" class="menu-item" onclick="chooseQuickSource(\'مباشر\')">🟢 مباشر</button><button type="button" class="menu-item" onclick="chooseQuickSource(\'غير مباشر\')">🔵 غير مباشر</button>';$('quickSourceMenu')?.classList.toggle('hidden')}
function chooseQuickSource(v){$('quickSourceBtn').textContent=(v||'مصدر العرض')+' ▾';$('quickSourceMenu').classList.add('hidden');$('fSource').value=v;render()}
const cityPriority=['الرياض','جدة','المدينة المنورة','مكة المكرمة','الدمام','الطائف','تبوك','بريدة','خميس مشيط','أبها','أحد رفيدة','حائل','نجران','جازان','ينبع','الجبيل','الخبر','الأحساء','حفر الباطن','القطيف','الخرج','عرعر','سكاكا','الباحة','القريات'];
function normalizeArabicKey(v){return String(v||'').trim().normalize('NFKC').replace(/[ًٌٍَُِّْـ]/g,'').replace(/[أإآٱ]/g,'ا').replace(/ى/g,'ي').replace(/ة/g,'ه').replace(/‏|‎/g,'').replace(/[ـ]/g,'').replace(/\s+/g,' ').toLowerCase()}
const cityAliases={
  'احد رفيدة':'أحد رفيدة','أحد رفيدة':'أحد رفيدة','احد رفيده':'أحد رفيدة','أحد رفيده':'أحد رفيدة',
  'ابها':'أبها','أبها':'أبها','خميس مشيط':'خميس مشيط','الرياض':'الرياض','جده':'جدة','جدة':'جدة',
  'مكه':'مكة المكرمة','مكه المكرمه':'مكة المكرمة','مكة':'مكة المكرمة','مكة المكرمة':'مكة المكرمة',
  'المدينه':'المدينة المنورة','المدينة':'المدينة المنورة','المدينه المنوره':'المدينة المنورة','المدينة المنورة':'المدينة المنورة',
  'الدمام':'الدمام','الطائف':'الطائف','تبوك':'تبوك','بريده':'بريدة','بريدة':'بريدة','حايل':'حائل','حائل':'حائل',
  'نجران':'نجران','جازان':'جازان','ينبع':'ينبع','الجبيل':'الجبيل','الخبر':'الخبر','الاحساء':'الأحساء','الأحساء':'الأحساء',
  'حفر الباطن':'حفر الباطن','القطيف':'القطيف','الخرج':'الخرج','عرعر':'عرعر','سكاكا':'سكاكا','الباحه':'الباحة','الباحة':'الباحة','القريات':'القريات'
};
const riyadhNeighborhoods=['عرقة','عرقه','لبن','عرقة لبن','عرقه لبن','ظهرة لبن','ظهرة البديعة','البديعة','السويدي','السويدي الغربي','السويدي الشرقي','نمار','طويق','ديراب','الشفا','عكاظ','العزيزية','الدار البيضاء','المروة','المنصورة','الفيصلية','الملز','الربوة','الروضة','النسيم','النسيم الشرقي','النسيم الغربي','الريان','الخليج','النهضة','اليرموك','قرطبة','الجنادرية','الرمال','المونسية','اليرموك','النرجس','الياسمين','الصحافة','الملقا','حطين','العقيق','النخيل','الرحمانية','الرائد','الورود','الملك فهد','المحمدية','السليمانية','العليا','الملك فيصل','غرناطة','اشبيلية','إشبيلية','الشهداء','العارض','القيروان','العارضية','العارضية القديمة','الشميسي','أم الحمام','ام الحمام','المعذر','المعذر الشمالي','المعذر الجنوبي','الدرعية الشمالية','السويدي'];
function canonicalCity(v){const raw=String(v||'').trim().replace(/^(مدينة|محافظة|منطقة|بلدية)\s*/,'').trim();if(!raw)return '';const k=normalizeArabicKey(raw);for(const n of riyadhNeighborhoods){const nk=normalizeArabicKey(n);if(k===nk||k.includes(nk)||nk.includes(k))return 'الرياض'}for(const [alias,label] of Object.entries(cityAliases)){if(normalizeArabicKey(alias)===k)return label}const compact=k.replace(/^ال/,'');for(const [alias,label] of Object.entries(cityAliases)){const ak=normalizeArabicKey(alias).replace(/^ال/,'');if(ak===compact)return label}return raw}
function orderedCities(){const fromOffers=[...new Set(offers.map(o=>canonicalCity(o.city)).filter(Boolean))];const base=fromOffers.length?fromOffers:[...new Set(saudiCities.map(canonicalCity))];return [...cityPriority.filter(x=>base.includes(x)),...base.filter(x=>!cityPriority.includes(x)).sort((a,b)=>a.localeCompare(b,'ar'))]}
function renderCityMenu(){const el=$('cityMenu');if(!el)return;const cities=orderedCities();el.innerHTML='<button type="button" class="menu-item" data-city="">كل المدن</button>'+cities.map(v=>'<button type="button" class="menu-item" data-city="'+escapeHtml(v)+'">'+escapeHtml(v)+'</button>').join('');el.querySelectorAll('[data-city]').forEach(btn=>btn.addEventListener('click',()=>selectCity(btn.getAttribute('data-city')||'')))}
function renderAllCities(){const row=$('allCitiesRow');if(!row)return;row.innerHTML=orderedCities().map(v=>'<button class="city-chip '+(canonicalCity(quickCityFilter)===v?'active':'')+'" onclick="selectCity(\''+escapeHtml(v)+'\')">'+escapeHtml(v)+'</button>').join('')}
function cityForOffer(o){return canonicalCity(o?.city||'')}
function districtValuesForCity(city){const c=canonicalCity(city);return [...new Set(offers.filter(o=>!c||cityForOffer(o)===c).map(o=>String(o.district||'').trim()).filter(Boolean))].sort((a,b)=>a.localeCompare(b,'ar'))}
function renderDistrictMenu(){const el=$('districtMenu');if(!el)return;const ds=districtValuesForCity(quickCityFilter);el.innerHTML=ds.length?'<button type="button" class="menu-item" data-district="">كل الأحياء</button>'+ds.map(v=>'<button type="button" class="menu-item" data-district="'+escapeHtml(v)+'">'+escapeHtml(v)+'</button>').join(''):'<div class="menu-empty">لا توجد أحياء محفوظة لهذه المدينة حتى الآن</div>';el.querySelectorAll('[data-district]').forEach(btn=>btn.addEventListener('click',()=>selectDistrict(btn.getAttribute('data-district')||'')))}
function positionMenu(menu,anchor){if(!menu||!anchor)return;menu.style.position='';menu.style.left='';menu.style.right='';menu.style.top='';menu.style.bottom='';menu.style.width='';menu.style.maxHeight=''}
function moveMenuToBody(id){return $(id)}
function toggleCityMenu(){const el=$('cityMenu');if(!el)return;renderCityMenu();$('quickTypeMenu')?.classList.add('hidden');$('quickSourceMenu')?.classList.add('hidden');$('districtMenu')?.classList.add('hidden');if(el.classList.contains('hidden')){el.classList.remove('hidden');el.style.display=''}else{el.classList.add('hidden');el.style.display='none'}}
function toggleDistrictMenu(){const el=$('districtMenu');if(!el)return;renderDistrictMenu();$('cityMenu')?.classList.add('hidden');$('cityMenu')?.style.setProperty('display','none');if(el.classList.contains('hidden')){el.classList.remove('hidden');el.style.display=''}else{el.classList.add('hidden');el.style.display='none'}}
function selectCity(city){favoritesOnly=false;$('favoritesFilterBtn')?.classList.remove('active');$('allFilterBtn')?.classList.remove('active');updateFavoritesUI();quickCityFilter=canonicalCity(city);quickDistrictFilter='';$('cityPickerBtn').textContent=(quickCityFilter||'المدينة')+' ▾';$('cityMenu')?.classList.add('hidden');$('allCitiesRow')?.classList.add('hidden');if(quickCityFilter){$('districtWrap')?.classList.remove('hidden');$('districtPickerBtn').textContent='الحي ▾';renderDistrictMenu()}else{$('districtWrap')?.classList.remove('hidden');$('districtPickerBtn').textContent='الحي ▾';$('districtMenu')?.classList.add('hidden')}render();requestAnimationFrame(()=>updateMap(filtered(),true))}
function selectDistrict(district){quickDistrictFilter=String(district||'').trim();$('districtPickerBtn').textContent=(quickDistrictFilter||'الحي')+' ▾';$('districtMenu')?.classList.add('hidden');render()}
window.addEventListener('resize',()=>{renderCityMenu();if(!quickCityFilter)renderDistrictMenu()});
document.addEventListener('click',e=>{
  const b=e.target.closest?.('.share-offer');
  if(!b)return;
  e.preventDefault();
  e.stopImmediatePropagation();
  const id=b.getAttribute('data-share-id');
  if(id)shareOffer(id);
},{capture:true});
document.addEventListener('click',e=>{if(!e.target.closest('#cityMenu')&&!e.target.closest('#cityPickerBtn'))$('cityMenu')?.classList.add('hidden');if(!e.target.closest('#districtMenu')&&!e.target.closest('#districtPickerBtn'))$('districtMenu')?.classList.add('hidden')});
function normalizeDeal(v){const s=String(v||'').trim();if(s.includes('إيجار')||s.includes('للايجار'))return 'إيجار';if(s.includes('بيع')||s.includes('للبيع'))return 'بيع';return s} function normalizePropertyType(v){return String(v||'').trim().replace(/\s*(?:للبيع|للإيجار|للايجار)\s*$/,'').trim()} function offerCategory(o){const type=normalizePropertyType(o?.property_type||o?.type);const deal=normalizeDeal(o?.deal);return type+' '+(deal==='إيجار'?'للإيجار':deal==='بيع'?'للبيع':deal)} function filtered(){const q=($('fSearch')?.value||'').trim().toLowerCase(),deal=$('fDeal')?.value||'',source=$('fSource')?.value||'',min=num($('fMin')?.value||''),max=num($('fMax')?.value||'');return offers.filter(o=>{const hay=[o.type,o.property_type,o.deal,o.city,o.district,o.owner,o.phone,o.location,o.notes].join(' ').toLowerCase();const typeLabel=offerCategory(o);return(!favoritesOnly||favorites.has(o.id))&&(!q||hay.includes(q))&&(!deal||normalizeDeal(o.deal)===deal)&&(!source||o.source===source)&&(!quickTypeFilter||typeLabel===quickTypeFilter)&&(!quickCityFilter||cityForOffer(o)===canonicalCity(quickCityFilter))&&(!quickDistrictFilter||o.district===quickDistrictFilter)&&(min===null||num(o.price)>=min)&&(max===null||num(o.price)<=max)})}

function applyFilters(){render()}
function closeAdvancedFilters(){
  ['fSearch','fDeal','fSource','fMin','fMax'].forEach(id=>{const el=$(id);if(el)el.value=''});
  favoritesOnly=false;quickTypeFilter='';quickCityFilter='';quickDistrictFilter='';
  $('cityPickerBtn').textContent='المدينة ▾';$('districtWrap')?.classList.add('hidden');
  $('cityMenu')?.classList.add('hidden');$('districtMenu')?.classList.add('hidden');
  document.querySelectorAll('.quick-type').forEach(b=>b.classList.remove('active'));
  $('allFilterBtn')?.classList.add('active');$('favoritesFilterBtn')?.classList.remove('active');
  updateFavoritesUI();$('advancedFilters')?.classList.add('hidden');render();
  window.scrollTo({top:0,behavior:'smooth'});
}
function quickType(btn,val){favoritesOnly=false;quickTypeFilter=val;document.querySelectorAll('.quick-type').forEach(b=>b.classList.remove('active'));btn.classList.add('active');$('allFilterBtn')?.classList.remove('active');$('favoritesFilterBtn')?.classList.remove('active');updateFavoritesUI();render()}
function quickCity(btn,val){selectCity(val)}
function quickAll(btn){
  toggleRequestMode(false);
  // «الكل» يلغي جميع الفلاتر ويرجع الصفحة لحالتها الأساسية: كل العروض + الخريطة.
  favoritesOnly=false;
  quickTypeFilter='';
  quickCityFilter='';
  quickDistrictFilter='';
  ['fSearch','fDeal','fSource','fMin','fMax'].forEach(id=>{const el=$(id);if(el)el.value=''});
  $('cityPickerBtn').textContent='المدينة ▾';
  $('districtPickerBtn').textContent='الحي ▾';
  $('districtWrap')?.classList.add('hidden');
  $('allCitiesRow')?.classList.add('hidden');
  $('cityMenu')?.classList.add('hidden');
  $('districtMenu')?.classList.add('hidden');
  document.querySelectorAll('.quick-type').forEach(b=>b.classList.remove('active'));
  $('allFilterBtn')?.classList.add('active');
  $('favoritesFilterBtn')?.classList.remove('active');
  updateFavoritesUI();
  render();
  setTimeout(()=>{if(map)map.invalidateSize(true);updateMap(offers)},50);
}
function toggleAdvancedFilters(){ $('advancedFilters').classList.toggle('hidden') }
function useNearby(){alert('ميزة القريب تحتاج السماح بالموقع من جهازك.')}

function fillSelect(id,values,label){const el=$(id),old=el.value;el.innerHTML='<option value="">'+label+'</option>'+values.filter(Boolean).sort((a,b)=>a.localeCompare(b,'ar')).map(v=>'<option>'+escapeHtml(v)+'</option>').join('');el.value=values.includes(old)?old:''}
function escapeHtml(s){return String(s??'').replace(/[&<>'"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]))}
function displayPrice(v){const s=String(v??'').trim();if(!s)return 'غير محدد';if(/ريال|ر\.س|SAR/i.test(s))return s;const normalized=s.replace(/,/g,'').replace(/\s+/g,'');if(/^[-+]?\d+(?:\.\d+)?$/.test(normalized))return s+' ريال';return s}
function displayArea(v){const s=String(v||'').trim();if(!s)return '—';if(/م²|م2|م\s*²/i.test(s))return s;return s+' م²'}
function normalizeOfferSource(v){
  const s=String(v||'').trim().toLowerCase().replace(/\s+/g,' ');
  if(!s)return "";
  if(s==='مباشر'||s.includes('مباشر مع المالك')||s.includes('مع المالك')||s==='direct')return "مع المالك";
  if(s==='غير مباشر'||s.includes('مع المباشر')||s.includes('غير مباشر')||s==='indirect'||s.includes('وسيط'))return "مع المباشر";
  return String(v||'').trim();
}
function buildOfferTitle(o){
  const property=String(o?.property_type||o?.type||'عقار').trim();
  const deal=o?.deal==='إيجار'?'للإيجار':o?.deal==='بيع'?'للبيع':String(o?.deal||'').trim();
  let title=[property,deal].filter(Boolean).join(' ');
  const city=String(o?.city||'').trim();
  const district=String(o?.district||'').trim();
  if(city) title += ` في مدينة ${city}`;
  if(district) title += ` ${/^حي\s/.test(district)?district:'حي '+district}`;
  const source=normalizeOfferSource(o?.source);
  if(source) title += ` · ${source}`;
  return title||'عرض عقاري';
}

async function deleteOffer(id){
  const o=offers.find(x=>x.id===id);
  if(!o||!currentUser)return;
  const title=buildOfferTitle(o);
  if(!confirm(`هل أنت متأكد من حذف «${title}»؟\n\nسيتم حذف العرض وصوره نهائيًا من حسابك.`))return;
  try{
    const oldImages=Array.isArray(o.images)?o.images.filter(Boolean):[];
    // احذف ملفات الصور من التخزين أولًا، لكن لا تمنع حذف العرض إذا تعذر حذف ملف صورة واحد.
    if(oldImages.length){try{await supabaseClient.storage.from('offer-images').remove(oldImages)}catch(e){console.warn('image cleanup',e)}}
    // تنظيف جدول الصور المساند إن كان موجودًا في المشروع.
    try{await supabaseClient.from('offer_images').delete().eq('offer_id',id).eq('user_id',currentUser.id)}catch(e){console.warn('offer_images cleanup',e)}
    const {error}=await supabaseClient.from('offers').delete().eq('id',id).eq('user_id',currentUser.id);
    if(error)throw error;
    offers=offers.filter(x=>x.id!==id);
    render();
    showToast('تم حذف العرض نهائيًا ✓','success');
  }catch(e){
    console.error('deleteOffer',e);
    showToast('تعذر حذف العرض: '+(e.message||'تحقق من صلاحية الحذف في Supabase'),'error');
  }
}
function showToast(message,type='info'){
  let el=document.getElementById('appToast');
  if(!el){el=document.createElement('div');el.id='appToast';document.body.appendChild(el)}
  el.className='app-toast '+type;el.textContent=message;el.classList.add('show');
  clearTimeout(window.__toastTimer);window.__toastTimer=setTimeout(()=>el.classList.remove('show'),3200);
}

function updateFavoritesUI(){const valid=new Set(offers.map(o=>String(o.id)));const count=[...favorites].filter(id=>valid.has(String(id))).length;const c=$('favoritesCount');if(c)c.textContent=String(count);const all=$('allCount');if(all)all.textContent=String(offers.length);$('favoritesFilterBtn')?.classList.toggle('active',favoritesOnly);}
function saveFavorites(){localStorage.setItem('uroodi_favorites',JSON.stringify([...favorites]));}
async function syncFavoritesToCloud(){if(!currentUser||!supabaseClient)return false;try{favoritesSyncBusy=true;const {data,error}=await supabaseClient.auth.updateUser({data:{uroodi_favorites:[...favorites]}});if(error)throw error;if(data?.user)currentUser=data.user;return true}catch(e){console.error('favorites sync',e);return false}finally{favoritesSyncBusy=false}}
async function toggleFavorite(id){const had=favorites.has(id);if(had)favorites.delete(id);else favorites.add(id);saveFavorites();updateFavoritesUI();render();const ok=await syncFavoritesToCloud();if(!ok){if(had)favorites.add(id);else favorites.delete(id);saveFavorites();updateFavoritesUI();render();showToast('تعذر مزامنة المفضلة سحابيًا','error');}else showToast(had?'تمت إزالة العرض من المفضلة':'تمت إضافة العرض للمفضلة','success');}
function toggleFavoritesFilter(btn){favoritesOnly=!favoritesOnly;if(favoritesOnly){quickTypeFilter='';quickCityFilter='';quickDistrictFilter='';document.querySelectorAll('.quick-type').forEach(b=>b.classList.remove('active'));$('favoritesFilterBtn')?.classList.add('active');$('allFilterBtn')?.classList.remove('active')}else{$('allFilterBtn')?.classList.add('active');$('favoritesFilterBtn')?.classList.remove('active');}updateFavoritesUI();render();}
function setNavActive(id){document.querySelectorAll('.nav-item').forEach(b=>b.classList.remove('active'));$(id)?.classList.add('active')}
function goSearch(){favoritesOnly=false;setNavActive('navSearch');$('advancedFilters')?.classList.remove('hidden');$('quickFilters')?.scrollIntoView({behavior:'smooth',block:'start'});setTimeout(()=>{$('fSearch')?.focus()},350)}
function goOffers(){favoritesOnly=false;updateFavoritesUI();setNavActive('navOffers');render();$('offersSection')?.scrollIntoView({behavior:'smooth',block:'start'})}
function goFavorites(){favoritesOnly=true;quickTypeFilter='';quickCityFilter='';quickDistrictFilter='';document.querySelectorAll('.quick-type').forEach(b=>b.classList.remove('active'));$('favoritesFilterBtn')?.classList.add('active');$('allFilterBtn')?.classList.remove('active');updateFavoritesUI();render();showToast(favorites.size?'تم عرض المفضلة':'لا توجد عروض في المفضلة بعد','info')}
function goAdd(){favoritesOnly=false;openAddModal()}

function offerCardMarkup(o){
 const title=buildOfferTitle(o),raw=o.notes||'';
 return `<span class="badge">${escapeHtml(title)}</span>${o.phone?`<div class="line">📱 ${escapeHtml(o.phone)}</div>`:''}<div class="raw-offer"><b>نص العرض</b><div>${escapeHtml(cleanOfferNotes(o)).replace(/\n/g,'<br>')}</div></div>${pricingShareLines(o).length?`<div class="price-summary">${pricingShareLines(o).map(x=>`<div>${escapeHtml(x)}</div>`).join('')}</div>`:''}${o.images?.length?`<div class="offer-photos">${(o._signed||[]).map((src,i)=>`<img src="${escapeHtml(src||'')}" data-image-path="${escapeHtml(String(o.images?.[i]||''))}" loading="eager" fetchpriority="${i===0?'high':'low'}" decoding="async" crossorigin="anonymous" alt="صورة العرض ${i+1}">`).join('')}</div>`:''}<div class="offer-actions">${o.phone?`<button class="primary wa-btn" onclick="wa('${escapeHtml(o.phone)}')">💬 واتساب المالك</button>`:''}<button class="secondary share-offer" type="button" data-share-id="${escapeHtml(String(o.id))}">📤 مشاركة العرض</button>${o.mapUrl?`<button class="secondary" onclick="window.open('${escapeHtml(o.mapUrl)}','_blank')">📍 فتح الموقع</button>`:''}<button class="secondary favorite-btn ${favorites.has(o.id)?'is-favorite':''}" onclick="toggleFavorite('${o.id}')">${favorites.has(o.id)?'♥':'♡'} المفضلة</button><button class="secondary" onclick="editOffer('${o.id}')">✏️ تعديل</button><button class="danger" type="button" onclick="deleteOffer('${o.id}')">🗑️ حذف</button></div>`;
}
function offerRenderKey(o){return JSON.stringify([o.id,o.deal,o.source,o.property_type,o.type,o.city,o.district,o.owner,o.phone,o.location,o.notes,o.price,o.sale_price,o.rent_annual,o.mapUrl,o.map_url,Array.isArray(o.images)?o.images:[]]);}
function render(){
 const arr=filtered();
 $('count').textContent=arr.length;
 const statTotal=$('statTotal');if(statTotal)statTotal.textContent=offers.length;
 const statMapped=$('statMapped');if(statMapped)statMapped.textContent=offers.filter(o=>o.latitude!=null&&o.longitude!=null).length;
 const statFav=$('statFav');if(statFav)statFav.textContent=[...favorites].filter(id=>offers.some(o=>String(o.id)===String(id))).length;
 const allCount=$('allCount');if(allCount)allCount.textContent=String(offers.length);
 const favoritesCount=$('favoritesCount');if(favoritesCount)favoritesCount.textContent=String([...favorites].filter(id=>offers.some(o=>String(o.id)===String(id))).length);
 const container=$('offers');if(!container)return;
 const beforeScroll=window.scrollY||window.pageYOffset||0;
 const active=document.activeElement;
 const old=new Map([...container.querySelectorAll(':scope > article.offer')].map(el=>[el.id,el]));
 if(!arr.length){
   const empty=container.querySelector(':scope > .empty');
   if(!empty){
     const el=document.createElement('div');el.className='empty';el.textContent='لا توجد عروض محفوظة.';
     container.replaceChildren(el);
   }
   updateMap(arr,false);
   return;
 }
 const wanted=[];
 arr.forEach(o=>{
   const id='offer-'+String(o.id),key=offerRenderKey(o);let card=old.get(id);
   if(card&&card.dataset.renderKey!==key){
     // تحديث محتوى العرض فقط عند تغير بياناته، وليس عند كل عملية render.
     card.innerHTML=offerCardMarkup(o);card.dataset.renderKey=key;
   }else if(!card){
     card=document.createElement('article');card.className='offer';card.id=id;card.dataset.renderKey=key;card.innerHTML=offerCardMarkup(o);
   }
   const imgs=card.querySelectorAll('.offer-photos img');
   imgs.forEach((img,i)=>{const src=o._signed?.[i]||'';if(src&&img.getAttribute('src')!==src)img.src=src;img.dataset.imagePath=String(o.images?.[i]||'');attachOfferImageCache(o,img);});
   const fav=card.querySelector('.favorite-btn');if(fav){fav.classList.toggle('is-favorite',favorites.has(o.id));fav.innerHTML=(favorites.has(o.id)?'♥':'♡')+' المفضلة';}
   wanted.push(card);
 });
 // لا نستخدم replaceChildren في كل render. نحتفظ بنفس عقد DOM حتى لا يعيد Safari تحميل الصور أو يغيّر موضع التمرير.
 const wantedIds=wanted.map(el=>el.id).join('|');
 const currentIds=[...container.querySelectorAll(':scope > article.offer')].map(el=>el.id).join('|');
 if(wantedIds!==currentIds){
   const keep=new Set(wanted.map(el=>el.id));
   [...container.querySelectorAll(':scope > article.offer')].forEach(el=>{if(!keep.has(el.id))el.remove()});
   wanted.forEach(el=>container.appendChild(el));
 }
 // احتياط إضافي لـ iOS: إذا كان render غير تفاعلي سبب انزياحًا بسيطًا، أعد نفس موضع القراءة.
 if(Math.abs((window.scrollY||window.pageYOffset||0)-beforeScroll)>2){
   requestAnimationFrame(()=>{
     if(Math.abs((window.scrollY||window.pageYOffset||0)-beforeScroll)>2)window.scrollTo(0,beforeScroll);
     if(active&&active.isConnected&&typeof active.focus==='function'){try{active.focus({preventScroll:true})}catch(_){} }
   });
 }
 updateMap(arr,false);
}
function openAddModal(){
  editingId=null; pendingImages=[]; selectedDeal=''; selectedSource='';
  $('addDeal').value=''; $('addPropertyType').value=''; $('addArea').value=''; $('addSource').value=''; $('raw').value=''; $('addPhone').value='';
  $('addCity').value=''; $('addDistrict').value=''; $('addMapUrl').value=''; $('addLat').value=''; $('addLng').value=''; $('addLocation').value=''; $('detectedLocation')?.classList.add('hidden');
  $('photos').value=''; renderPhotoStrip('photoPreview',[]); renderAddCityOptions(); renderAddDistrictOptions('');
  $('analyzeBtn').textContent='📍 تحديد الموقع'; $('analyzeBtn').onclick=analyze;
  setMsg(''); updateSelectedSummary();
  $('addModalTitle').textContent='إضافة عرض جديد';
  $('addModal').classList.remove('hidden'); $('addModal').setAttribute('aria-hidden','false'); document.body.classList.add('modal-open');
  setTimeout(()=>{$('raw')?.focus()},120);
}
function closeAddModal(){
  $('addModal')?.classList.add('hidden'); $('addModal')?.setAttribute('aria-hidden','true'); document.body.classList.remove('modal-open');
}
function showEditModal(){
  $('addModalTitle').textContent='تعديل العرض';
  $('addModal').classList.remove('hidden'); $('addModal').setAttribute('aria-hidden','false'); document.body.classList.add('modal-open');
}

function editOffer(id){
  const o=offers.find(x=>x.id===id); if(!o) return;
  editingId=id;
  $('addDeal').value=o.deal||'';
  $('addPropertyType').value=o.property_type||o.type||'';
  $('addArea').value=o.area||'';
  const ep=parsePricing(o)||{}; $('salePrice').value=ep.sale||''; $('rentAnnual').value=ep.annual||'';
  $('addSource').value=o.source||'';
  $('raw').value=cleanOfferNotes(o);
  $('addPhone').value=o.phone||'';
  $('addCity').value=canonicalCity(o.city||''); $('addDistrict').value=o.district||''; $('addMapUrl').value=o.mapUrl||o.map_url||''; $('addLat').value=o.latitude??''; $('addLng').value=o.longitude??''; $('addLocation').value=o.location||'';
  selectedSource=o.source||'';
  syncOfferType(); renderAddCityOptions(); renderAddDistrictOptions($('addCity').value);
  $('analyzeBtn').textContent='💾 حفظ تعديلات العرض'; $('analyzeBtn').onclick=saveAnalyzedOffer;
  const loc=$('detectedLocation');if(loc){loc.classList.remove('hidden');loc.textContent='📍 عدّل المدينة أو الحي إذا احتجت ثم اضغط حفظ تعديلات العرض.';}
  setMsg('وضع التعديل: عدّل المدينة أو الحي وباقي البيانات ثم اضغط حفظ تعديلات العرض.');
  renderPhotoStrip('photoPreview',o._signed||[]);
  showEditModal();
}


function openOfferFromMap(id){
  const run=()=>{
    const card=document.getElementById('offer-'+String(id));
    if(!card)return false;
    const top=card.getBoundingClientRect().top+window.pageYOffset-90;
    window.scrollTo({top:Math.max(0,top),behavior:'smooth'});
    document.querySelectorAll('.offer.map-selected').forEach(el=>el.classList.remove('map-selected'));
    card.classList.add('map-selected');
    setTimeout(()=>card.classList.remove('map-selected'),2200);
    return true;
  };
  if(run())return;
  requestAnimationFrame(()=>setTimeout(run,120));
  setTimeout(run,450);
}
function mapPopup(o){
  const title=buildOfferTitle(o), city=o.city||'', district=o.district||'', mapLink=o.mapUrl||o.map_url||'', photo=(o._signed||[])[0]||'';
  const meta=[city,district,normalizeOfferSource(o?.source)?'👤 '+normalizeOfferSource(o.source):'',o.price?displayPrice(o.price):'',o.area?displayArea(o.area):''].filter(Boolean).slice(0,5);
  return `<div class="map-popup map-compact-popup"><div class="map-popup-head"><div class="map-popup-pin">📍</div><h3>${escapeHtml(title)}</h3></div>${photo?`<div class="map-popup-photo-row"><img class="map-popup-mini-photo" src="${escapeHtml(photo)}" alt="صورة العرض" loading="lazy"><div class="map-popup-meta">${meta.map(v=>`<div>${escapeHtml(String(v))}</div>`).join('')}</div></div>`:`<div class="map-popup-meta map-popup-meta-full">${meta.map(v=>`<div>${escapeHtml(String(v))}</div>`).join('')}</div>`}${mapLink?`<a class="map-location-link" href="${escapeHtml(mapLink)}" target="_blank" rel="noopener">📍 فتح الموقع</a>`:''}<button class="map-open-offer" type="button" data-map-offer-id="${escapeHtml(String(o.id))}" onclick="openOfferFromMap('${escapeHtml(String(o.id))}')">↓ الانتقال للعرض</button></div>`;
}
function mapGroupPopup(group){
  const arr=group||[];
  const cards=arr.map((o,i)=>{
    const photo=(o._signed||[])[0]||'';
    const meta=[o.area?`📐 ${o.area}`:'',o.city?`📍 ${o.city}`:'',o.district?`حي ${String(o.district).replace(/^حي\s*/,'')}`:'',o.price?`💰 ${displayPrice(o.price)}`:''].filter(Boolean).join(' · ');
    return `<div class="map-group-card">${photo?`<img class="map-group-photo" src="${escapeHtml(photo)}" alt="صورة العرض" loading="lazy">`:''}<div class="map-group-title-text">${i+1}. ${escapeHtml(buildOfferTitle(o))}</div>${meta?`<div class="map-group-meta">${escapeHtml(meta)}</div>`:''}<div class="map-group-actions">${mapLinkForOffer(o)?`<a href="${escapeHtml(mapLinkForOffer(o))}" target="_blank" rel="noopener">📍 الموقع</a>`:''}<button type="button" data-map-offer-id="${escapeHtml(String(o.id))}" onclick="openOfferFromMap('${escapeHtml(String(o.id))}')">↓ العرض</button></div></div>`;
  }).join('');
  return `<div class="map-popup map-group-popup"><div class="map-group-count">📍 ${arr.length} عروض في نفس الموقع</div>${cards}</div>`;
}
function mapLinkForOffer(o){return o?.mapUrl||o?.map_url||''}


function clientShareData(arr){
  return (arr||[]).map(o=>{
    let lat=num(o.latitude),lng=num(o.longitude);
    const mapUrl=o.mapUrl||o.map_url||o.map_link||o.google_maps_url||'';
    if((lat===null||lng===null)&&mapUrl){
      const c=extractCoords(mapUrl);
      if(c){lat=c[0];lng=c[1]}
    }

    const propertyType=normalizePropertyType(
      o?.property_type||o?.type||'عقار'
    );

    const deal=normalizeDeal(
      [o?.deal,o?.title,o?.property_type,o?.type,o?.notes]
        .filter(Boolean).join(' ')
    );

    const shareTitle =
      [propertyType,
       deal==='إيجار'?'للإيجار':
       deal==='بيع'?'للبيع':
       String(o?.deal||'').trim()]
      .filter(Boolean).join(' ')
      +(o.city?` في ${String(o.city).trim()}`:'')
      +(o.district?
        ` ${/^حي\s/.test(String(o.district).trim())
          ?String(o.district).trim()
          :'حي '+String(o.district).trim()}`:'') ;

    return {
      title:shareTitle||'عرض عقاري',
      city:o.city||'',
      district:o.district||'',
      price:o.price?displayPrice(o.price):'',
      area:o.area?displayArea(o.area):'',
      location:o.location||'',
      text:cleanOfferNotes(o),
      source:String(o.source||'').trim(),
      propertyType,
      deal,
      pricing:pricingShareLines(o),
      mapUrl,
      lat,
      lng,
      images:Array.isArray(o._signed)
        ?o._signed.filter(Boolean).slice(0,8):[]
    };
  });
}

function shareCategoryKey(o){
  const type=normalizePropertyType(
    o?.propertyType||o?.property_type||o?.type||''
  );
  const deal=normalizeDeal(
    [o?.deal,o?.title,o?.propertyType,o?.property_type,o?.type,o?.text]
      .filter(Boolean).join(' ')
  );

  const family={
    'أرض':'الأراضي','أرض تجارية':'الأراضي','أراضي':'الأراضي',
    'أراضي تجارية':'الأراضي',
    'فيلا':'الفلل والبيوت','فلل':'الفلل والبيوت',
    'عمارة':'العمائر','عمائر':'العمائر',
    'بيت':'الفلل والبيوت','بيوت':'الفلل والبيوت',
    'شقة':'الشقق','شقق':'الشقق',
    'دور':'الأدوار','أدوار':'الأدوار',
    'مزرعة':'المزارع','مزارع':'المزارع',
    'استراحة':'الاستراحات','استراحات':'الاستراحات',
    'مكتب':'المكاتب','مكاتب':'المكاتب',
    'محل':'المحلات','محلات':'المحلات',
    'مستودع':'المستودعات','مستودعات':'المستودعات',
    'غرفة':'الغرف','غرف':'الغرف'
  };

  return `${deal}|${family[type]||type||'أخرى'}`;
}

const sharePropertyOrder=[
  'الأراضي','العمائر','الفلل والبيوت','الشقق','الأدوار',
  'المزارع','الاستراحات','المكاتب','المحلات','المستودعات','الغرف','أخرى'
];

function sharePropertyRank(type){
  const i=sharePropertyOrder.indexOf(String(type||''));
  return i===-1 ? 999 : i;
}

function buildGroupedClientShare(items){
  const arr=items||[];

  const city=quickCityFilter
    ? canonicalCity(quickCityFilter)
    : ([...new Set(
        arr.map(o=>canonicalCity(o.city)).filter(Boolean)
      )].length===1
        ? canonicalCity(arr[0]?.city)
        : '');

  const cityTitle=city||'العروض العقارية';
  const sections=[`🏠 *عروضي في ${cityTitle}*`, ''];
  let globalNumber=1;

  const addDeal=(dealKey,label)=>{
    const dealItems=arr.filter(
      o=>normalizeDeal(o.deal)===dealKey
    );
    if(!dealItems.length)return;

    sections.push(label,'');

    const groups=new Map();

    dealItems.forEach(o=>{
      const key=shareCategoryKey(o);

      if(!groups.has(key)){
        groups.set(key,{
          type:key.split('|')[1]||'أخرى',
          items:[]
        });
      }

      groups.get(key).items.push(o);
    });

    [...groups.values()]
      .sort((a,b)=>sharePropertyRank(a.type)-sharePropertyRank(b.type))
      .forEach(group=>{
        sections.push(`🏷️ *${group.type}*`,'');

        group.items.forEach(o=>{
          sections.push(
            `*${globalNumber++}. 🏠 ${o.title||'عرض عقاري'}*`
          );

          const place=[o.city,o.district]
            .filter(Boolean).join(' ');

          if(place)sections.push(`📍${place}`);

          const propertyArea=[];

          if(o.propertyType)
            propertyArea.push(`🏷️ ${o.propertyType}`);

          if(o.area)
            propertyArea.push(`📐 ${o.area}`);

          if(propertyArea.length)
            sections.push(propertyArea.join('  |  '));

          if(o.pricing?.length)
            sections.push(...o.pricing);

          const sourceLabel=shareSourceLabel(o);

          if(sourceLabel)
            sections.push(sourceLabel);

          let googleLink='';

          if(
            o.lat!==null &&
            o.lng!==null &&
            Number.isFinite(Number(o.lat)) &&
            Number.isFinite(Number(o.lng))
          ){
            googleLink=
              `https://maps.google.com/?q=${Number(o.lat).toFixed(6)},${Number(o.lng).toFixed(6)}`;
          }else if(o.mapUrl){
            googleLink=o.mapUrl;
          }

          if(googleLink)
            sections.push(`🗺️ ${googleLink}`);

          sections.push('────────────');
        });

        sections.push('');
      });
  };

  // البيع أولاً ثم الإيجار، كما في طريقة المشاركة القديمة.
  addDeal('بيع','✅ *عروض البيع*');
  addDeal('إيجار','🏠 *عروض الإيجار*');

  const unknown=arr.filter(
    o=>!['بيع','إيجار'].includes(normalizeDeal(o.deal))
  );

  if(unknown.length){
    sections.push('📌 *عروض أخرى*','');

    unknown.forEach(o=>{
      sections.push(
        `*${globalNumber++}. 🏠 ${o.title||'عرض عقاري'}*`
      );

      const place=[o.city,o.district]
        .filter(Boolean).join(' ');

      if(place)sections.push(`📍${place}`);
      if(o.area)sections.push(`📐 ${o.area}`);
      if(o.pricing?.length)sections.push(...o.pricing);

      const sourceLabel=shareSourceLabel(o);

      if(sourceLabel)
        sections.push(sourceLabel);

      if(o.mapUrl)
        sections.push(`🗺️ ${o.mapUrl}`);

      sections.push('────────────');
    });

    sections.push('');
  }

  const contact=shareContactLine();

  if(contact)
    sections.push('',contact);

  return [
    sections.join('\n')
      .replace(/\n{4,}/g,'\n\n')
      .trim()
  ];
}

async function shareClientMap(){
  const btn=document.querySelector('.client-map-btn');
  const old=btn?btn.textContent:'';

  if(btn){
    btn.disabled=true;
    btn.textContent='⏳ تجهيز الرسالة...';
  }

  try{
    let items=[];

    try{
      items=clientShareData(filtered());
    }catch(e){
      console.error('clientShareData',e);
      items=[];
    }

    if(!items.length){
      alert('لا توجد عروض مطابقة للفلاتر لإرسالها.');
      return;
    }

    let finalText='';

    try{
      const sections=buildGroupedClientShare(items);
      finalText=sections.join('\n\n\n').trim();
    }catch(e){
      console.error('buildGroupedClientShare',e);
      finalText=buildGroupedClientShare(items)[0]||'';
    }

    if(!finalText){
      alert('تعذر تجهيز نص العروض.');
      return;
    }

    if(typeof navigator.share==='function'){
      try{
        await navigator.share({
          title:'عروضي العقارية',
          text:finalText
        });
        return;
      }catch(e){
        if(e?.name==='AbortError')return;
        console.warn('share text failed',e);
      }
    }

    let copied=false;

    try{
      if(navigator.clipboard?.writeText){
        await navigator.clipboard.writeText(finalText);
        copied=true;
      }
    }catch(e){
      console.warn('clipboard API failed',e);
    }

    if(!copied){
      try{
        const ta=document.createElement('textarea');

        ta.value=finalText;
        ta.setAttribute('readonly','');
        ta.style.position='fixed';
        ta.style.left='-9999px';
        ta.style.top='0';
        ta.style.opacity='0';

        document.body.appendChild(ta);
        ta.focus();
        ta.select();

        copied=document.execCommand('copy');
        ta.remove();
      }catch(e){
        console.warn('execCommand copy failed',e);
      }
    }

    if(copied){
      alert(
        'تم تجهيز العروض ونسخها مرتبة حسب الأقسام. افتح واتساب والصق الرسالة.'
      );
    }else{
      const w=window.open('','_blank');

      if(w){
        w.document.write(`
          <html dir="rtl">
          <meta name="viewport" content="width=device-width,initial-scale=1">
          <body style="font-family:-apple-system,BlinkMacSystemFont,Segoe UI,Arial;padding:20px;white-space:pre-wrap">
          <textarea style="width:100%;min-height:80vh;font-size:17px;line-height:1.8">${escapeHtml(finalText)}</textarea>
          <p>اضغط مطولاً على النص ثم اختر نسخ.</p>
          </body>
          </html>
        `);

        w.document.close();
      }else{
        alert('تم تجهيز الرسالة. اضغط مشاركة المتصفح ثم اختر واتساب.');
      }
    }

  }catch(e){
    console.error('shareClientMap',e);

    try{
      const fallback=
        buildGroupedClientShare(
          clientShareData(filtered())
        )[0]||'';

      if(navigator.clipboard?.writeText && fallback){
        await navigator.clipboard.writeText(fallback);
        alert('تم نسخ العروض. افتح واتساب والصق الرسالة.');
      }else{
        alert('تعذر تجهيز الرسالة حالياً.');
      }
    }catch(_){
      alert('تعذر تجهيز الرسالة حالياً.');
    }

  }finally{
    if(btn){
      btn.disabled=false;
      btn.textContent=old||'📲 إرسال للعميل';
    }
  }
}


function groupMapOffers(arr){
  const groups=new Map();(arr||[]).forEach(o=>{const pairs=[[o?.latitude,o?.longitude],[o?.lat,o?.lng],[o?.lat,o?.lon],[o?.coordinates?.lat,o?.coordinates?.lng]];let c=null;for(const p of pairs){const a=Number(p[0]),b=Number(p[1]);if(Number.isFinite(a)&&Number.isFinite(b)&&Math.abs(a)<=90&&Math.abs(b)<=180){c=[a,b];break}}if(!c){const raw=o.mapUrl||o.map_url||o.map_link||o.google_maps_url||'';c=extractCoords(raw)}if(!c)return;const key=c[0].toFixed(5)+','+c[1].toFixed(5);if(!groups.has(key))groups.set(key,{lat:c[0],lng:c[1],offers:[]});groups.get(key).offers.push(o)});return [...groups.values()];
}
let mapHasStableView=false;
let lastMapSignature='';
function updateMap(arr,recenter=false){
  if(!map||!window.L)return;
  const list=Array.isArray(arr)?arr:[];
  const noActiveFilters=!favoritesOnly&&!quickTypeFilter&&!quickCityFilter&&!quickDistrictFilter&&!['fSearch','fDeal','fSource','fMin','fMax'].some(id=>String($(id)?.value||'').trim());
  const actual=(noActiveFilters&&!list.length&&offers.length)?offers:list;
  const signature=actual.map(o=>String(o.id)).join('|');
  $('mapCount').textContent=groupMapOffers(actual).reduce((n,g)=>n+g.offers.length,0)+' على الخريطة';
  // إذا لم تتغير مجموعة العلامات، لا تعيد بناء الخريطة أصلًا.
  if(signature===lastMapSignature&&!recenter){return;}
  const center=map.getCenter();const zoom=map.getZoom();
  markers.forEach(m=>m.remove());markers=[];
  const groups=groupMapOffers(actual),bounds=[];
  groups.forEach(g=>{
    const primary=g.offers[0],m=L.marker([g.lat,g.lng],{pane:'markerPane',title:g.offers.length>1?`${g.offers.length} عروض في نفس الموقع`:buildOfferTitle(primary)}).addTo(map);
    m.bindPopup(g.offers.length>1?mapGroupPopup(g.offers):mapPopup(g.offers[0]),{maxWidth:g.offers.length>1?360:300,minWidth:0,closeButton:true,autoPan:true,autoPanPaddingTopLeft:[12,12],autoPanPaddingBottomRight:[12,12],keepInView:true,offset:[0,18]});
    m.on('click',()=>m.openPopup());markers.push(m);bounds.push([g.lat,g.lng]);
  });
  lastMapSignature=signature;
  if(!mapHasStableView){
    if(bounds.length===1)map.setView(bounds[0],15);else if(bounds.length>1)map.fitBounds(bounds,{padding:[35,35],maxZoom:15});else map.setView([24.7,45],5.3);
    mapHasStableView=true;
  }else if(recenter){
    // إعادة تمركز مقصودة فقط بعد إجراء فلتر صريح، وليس بسبب تحميل صورة أو render داخلي.
    if(bounds.length===1)map.setView(bounds[0],15);else if(bounds.length>1)map.fitBounds(bounds,{padding:[35,35],maxZoom:15});
  }else{
    map.setView(center,zoom,{animate:false});
  }
  setTimeout(()=>map.invalidateSize(true),150);
}
$('allCitiesRow')?.classList.add('hidden');setAppVisible(false);if(!supabaseClient){setAuthMsg('تعذر تحميل خدمة تسجيل الدخول. اضغط تحديث الصفحة ثم جرّب مرة أخرى.',true)}const savedLoginEmail=localStorage.getItem('uroodi_login_email');if(savedLoginEmail){$('authEmail').value=savedLoginEmail;$('rememberMe').checked=true}if(supabaseClient){supabaseClient.auth.getSession().then(({data})=>{if(data.session)onSignedIn(data.session.user);else render()});supabaseClient.auth.onAuthStateChange((_event,session)=>{if(session&&!currentUser)onSignedIn(session.user)})}else{render()}; syncPricingInputs();

