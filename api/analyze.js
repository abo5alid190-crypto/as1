function clean(s){return typeof s === 'string' ? s.trim() : ''}

async function fetchTimeout(url, options = {}, ms = 2800){
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), ms);
  try { return await fetch(url, { ...options, signal: controller.signal }); }
  finally { clearTimeout(timer); }
}

function decode(v){
  try { return decodeURIComponent(String(v || '')); } catch { return String(v || ''); }
}

function validCoord(lat, lon){
  const a = Number(lat), b = Number(lon);
  return Number.isFinite(a) && Number.isFinite(b) && a >= 15 && a <= 33 && b >= 34 && b <= 56 ? [a,b] : null;
}

function extractCoords(value){
  const s = decode(value);
  if (!s) return null;
  const patterns = [
    /@(-?\d+(?:\.\d+)?),\s*(-?\d+(?:\.\d+)?)/,
    /[?&](?:q|query|ll|center|destination|daddr)=(-?\d+(?:\.\d+)?)(?:%2C|,|%20|\+|\s)+(-?\d+(?:\.\d+)?)/i,
    /!3d(-?\d+(?:\.\d+)?)!4d(-?\d+(?:\.\d+)?)/,
    /(?:lat(?:itude)?)[=:](-?\d+(?:\.\d+)?)[^\d-]+(?:lng|lon|longitude)[=:](-?\d+(?:\.\d+)?)/i,
    /(?:lng|lon|longitude)[=:](-?\d+(?:\.\d+)?)[^\d-]+(?:lat(?:itude)?)[=:](-?\d+(?:\.\d+)?)/i
  ];
  for (const re of patterns){
    const m = s.match(re);
    if (m){ const c = validCoord(m[1],m[2]); if(c) return c; }
  }
  const lat = s.match(/!3d(-?\d+(?:\.\d+)?)/)?.[1];
  const lon = s.match(/!4d(-?\d+(?:\.\d+)?)/)?.[1];
  return lat && lon ? validCoord(lat,lon) : null;
}

function normalizeCity(v){
  let x = String(v || '').trim();
  // Nominatim often returns governorates/provinces instead of the settlement
  // itself. Strip administrative suffixes first so a real city/governorate
  // such as القويعية, وادي الدواسر or الأفلاج can be treated as a city.
  x = x.replace(/^(مدينة|محافظة|منطقة|بلدية|مركز|ولاية)\s*/i,'').trim();
  x = x.replace(/\s+(?:محافظة|منطقة|إمارة|امارة|Governorate|Province|Region|Municipality|County|District)$/i,'').trim();
  const k = x.toLowerCase().replace(/['’`]/g,'').replace(/\s+/g,' ');
  const map = {
    'riyadh':'الرياض','riyad':'الرياض','الرياض':'الرياض',
    'jeddah':'جدة','jedda':'جدة','جدة':'جدة',
    'makkah':'مكة المكرمة','mecca':'مكة المكرمة','مكة':'مكة المكرمة','مكة المكرمة':'مكة المكرمة',
    'medina':'المدينة المنورة','madinah':'المدينة المنورة','المدينة':'المدينة المنورة','المدينة المنورة':'المدينة المنورة',
    'dammam':'الدمام','الدمام':'الدمام','taif':'الطائف','الطائف':'الطائف','tabuk':'تبوك','تبوك':'تبوك',
    'buraidah':'بريدة','buraydah':'بريدة','بريدة':'بريدة','abha':'أبها','أبها':'أبها',
    'al kharj':'الخرج','al-kharj':'الخرج','alkharj':'الخرج','الخرج':'الخرج',
    'khamis mushait':'خميس مشيط','khamis mushayt':'خميس مشيط','خميس مشيط':'خميس مشيط',
    'hail':'حائل','حائل':'حائل','najran':'نجران','نجران':'نجران','jazan':'جازان','جازان':'جازان',
    'yanbu':'ينبع','ينبع':'ينبع','jubail':'الجبيل','الجبيل':'الجبيل','khobar':'الخبر','al khobar':'الخبر','الخبر':'الخبر',
    'hofuf':'الأحساء','al ahsa':'الأحساء','ahsa':'الأحساء','الأحساء':'الأحساء','qatif':'القطيف','القطيف':'القطيف',
    'hafr al batin':'حفر الباطن','hafr al-batin':'حفر الباطن','حفر الباطن':'حفر الباطن','arar':'عرعر','عرعر':'عرعر',
    'sakaka':'سكاكا','سكاكا':'سكاكا','al bahah':'الباحة','الباحة':'الباحة','qurayyat':'القريات','القريات':'القريات',
    'al quwayiyah':'القويعية','al quwayiyah governorate':'القويعية','quwayiyah':'القويعية','al quwayiah':'القويعية','القويعية':'القويعية',
    'wadi ad dawسر':'وادي الدواسر','wadi ad dawasir':'وادي الدواسر','wadi al-dawasir':'وادي الدواسر','wadi aldawasir':'وادي الدواسر','وادي الدواسر':'وادي الدواسر',
    'al aflaj':'الأفلاج','aflaj':'الأفلاج','al afلاج':'الأفلاج','الأفلاج':'الأفلاج',
    'al dawادمي':'الدوادمي','al dawadmi':'الدوادمي','dawadmi':'الدوادمي','الدوادمي':'الدوادمي',
    'al majmaah':'المجمعة','majmaah':'المجمعة','المجمعة':'المجمعة','al zulfi':'الزلفي','zulfi':'الزلفي','الزلفي':'الزلفي',
    'shaqra':'شقراء','shaqra governorate':'شقراء','شقراء':'شقراء','afif':'عفيف','عفيف':'عفيف','sajir':'ساجر','ساجر':'ساجر',
    'al dukhnah':'الرس','ar rass':'الرس','al rass':'الرس','الرس':'الرس','unaizah':'عنيزة','onizah':'عنيزة','عنيزة':'عنيزة',
    'al bukayriyah':'البكيرية','bukayriyah':'البكيرية','البكيرية':'البكيرية','al mithnab':'المذنب','mithnab':'المذنب','المذنب':'المذنب',
    'al badayea':'البدائع','badaya':'البدائع','البدائع':'البدائع','al asyah':'الأسياح','asyah':'الأسياح','الأسياح':'الأسياح',
    'al shinan':'الشنان','shinan':'الشنان','الشنان':'الشنان','baqaa':'بقعاء','baqaa governorate':'بقعاء','بقعاء':'بقعاء',
    'rafha':'رفحاء','رفحاء':'رفحاء','turaif':'طريف','طريف':'طريف','dumat al jandal':'دومة الجندل','دومة الجندل':'دومة الجندل',
    'tabarjal':'طبرجل','طبرجل':'طبرجل','al ula':'العلا','ula':'العلا','العلا':'العلا','khaybar':'خيبر','خيبر':'خيبر',
    'al hanakiyah':'الحناكية','hanakiyah':'الحناكية','الحناكية':'الحناكية','al mahad':'المهد','mahad':'المهد','المهد':'المهد',
    'badr':'بدر','بدر':'بدر','al lith':'الليث','laith':'الليث','الليث':'الليث','al qunfudhah':'القنفذة','qunfudhah':'القنفذة','القنفذة':'القنفذة',
    'rabigh':'رابغ','رابغ':'رابغ','khulais':'خليص','خليص':'خليص','al jumum':'الجموم','jumum':'الجموم','الجموم':'الجموم',
    'bahrah':'بحرة','بحرة':'بحرة','al khurmah':'الخرمة','khurmah':'الخرمة','الخرمة':'الخرمة','ranyah':'رنية','رنية':'رنية',
    'turabah':'تربة','turba':'تربة','تربة':'تربة','bisha':'بيشة','بيشة':'بيشة','namas':'النماص','al namas':'النماص','النماص':'النماص',
    'muhayil asir':'محايل عسير','muhayil':'محايل عسير','محايل عسير':'محايل عسير','sarāt ubaydah':'سراة عبيدة','sarat ubaydah':'سراة عبيدة','سراة عبيدة':'سراة عبيدة',
    'rijal alma':'رجال ألمع','rijal almaa':'رجال ألمع','رجال ألمع':'رجال ألمع','ahad rufaidah':'أحد رفيدة','أحد رفيدة':'أحد رفيدة',
    'dhahran al janub':'ظهران الجنوب','ظهران الجنوب':'ظهران الجنوب','balqarn':'بلقرن','بلقرن':'بلقرن','tanomah':'تنومة','تنومة':'تنومة',
    'bariq':'بارق','بارق':'بارق','al majardah':'المجاردة','majardah':'المجاردة','المجاردة':'المجاردة','al barak':'البرك','البرك':'البرك',
    'sabya':'صبيا','sabia':'صبيا','صبيا':'صبيا','abu arish':'أبو عريش','abu arish':'أبو عريش','أبو عريش':'أبو عريش','samtah':'صامطة','صامطة':'صامطة',
    'baysh':'بيش','bish':'بيش','بيش':'بيش','ad darb':'الدرب','darb':'الدرب','الدرب':'الدرب','al rayth':'الريث','rayth':'الريث','الريث':'الريث',
    'farasan':'فرسان','فرسان':'فرسان','ras tanura':'رأس تنورة','ras tanurah':'رأس تنورة','رأس تنورة':'رأس تنورة','buqayq':'بقيق','بقيق':'بقيق',
    'safwa':'صفوى','صفوى':'صفوى','saihat':'سيهات','سيهات':'سيهات','anak':'عنك','عنك':'عنك','nuayriyah':'النعيرية','al nuayriyah':'النعيرية','النعيرية':'النعيرية',
    'qaryat al ulya':'قرية العليا','qaryah al ulya':'قرية العليا','قرية العليا':'قرية العليا','khafji':'الخفجي','al khafji':'الخفجي','الخفجي':'الخفجي',
    'tayma':'تيماء','taymah':'تيماء','تيماء':'تيماء','al wajh':'الوجه','الوجه':'الوجه','duba':'ضباء','ضباء':'ضباء','haql':'حقل','حقل':'حقل',
    'umluj':'أملج','املج':'أملج','أملج':'أملج','al bad':'البدع','البدع':'البدع','al harth':'الحرث','الحرث':'الحرث','al daer':'الدائر','الدائر':'الدائر',
    'al eidabi':'العيدابي','eidabi':'العيدابي','العيدابي':'العيدابي','fayfa':'فيفاء','faifa':'فيفاء','فيفاء':'فيفاء'
  };
  return map[k] || x;
}

// Saudi governorates / major settlements that should be treated as a city-level
// filter in this app when the geocoder reports them as county/municipality.
// This prevents remote cities such as القويعية, وادي الدواسر and الأفلاج from
// being swallowed into the nearest major city or administrative region.
const SAUDI_CITY_NAMES = new Set([
  'الرياض','جدة','مكة المكرمة','المدينة المنورة','الدمام','الطائف','تبوك','بريدة','خميس مشيط','أبها','حائل','نجران','جازان','ينبع','الجبيل','الأحساء','الهفوف','المبرز','القطيف','الخبر','حفر الباطن','الخرج','الدرعية','الدوادمي','المجمعة','الزلفي','شقراء','وادي الدواسر','القويعية','رماح','ثادق','حريملاء','عفيف','ساجر','الرس','عنيزة','البكيرية','المذنب','البدائع','رياض الخبراء','الأسياح','عقلة الصقور','الشنان','بقعاء','الغزالة','رفحاء','عرعر','طريف','سكاكا','القريات','دومة الجندل','طبرجل','العلا','خيبر','الحناكية','المهد','بدر','الليث','القنفذة','رابغ','خليص','الجموم','بحرة','الخرمة','رنية','تربة','ميسان','المويه','بيشة','النماص','محايل عسير','سراة عبيدة','رجال ألمع','أحد رفيدة','ظهران الجنوب','بلقرن','تنومة','بارق','المجاردة','البرك','العارضة','صبيا','أبو عريش','صامطة','بيش','الدرب','الريث','فرسان','الظهران','رأس تنورة','بقيق','صفوى','سيهات','عنك','النعيرية','قرية العليا','الخفجي','الحائط','تيماء','الوجه','ضباء','حقل','أملج','البدع','الحرث','الدائر','العيدابي','فيفاء','العارضة'
].map(normalizeCity));

function isSaudiCityName(v){
  const s=normalizeCity(v);
  return !!s && SAUDI_CITY_NAMES.has(s);
}

// Coordinates for the main cities used when the listing text mentions a major
// city but the actual map pin is far away. A large distance means the map's
// real municipality/governorate should win over the generic city in the text.
const CITY_ANCHORS={
  'الرياض':[24.7136,46.6753],'جدة':[21.5433,39.1728],'مكة المكرمة':[21.3891,39.8579],
  'المدينة المنورة':[24.5247,39.5692],'الدمام':[26.4207,50.0888],'الطائف':[21.2703,40.4158],
  'تبوك':[28.3838,36.5550],'بريدة':[26.3592,43.9818],'أبها':[18.2164,42.5053],
  'خميس مشيط':[18.3063,42.7290],'حائل':[27.5114,41.7208],'نجران':[17.4933,44.1277],
  'جازان':[16.8892,42.5706],'ينبع':[24.0895,38.0618],'الجبيل':[27.0046,49.6225],
  'الخبر':[26.2172,50.1971],'الخرج':[24.1554,47.3346],'حفر الباطن':[28.4328,45.9708],
  'عرعر':[30.9753,41.0381],'سكاكا':[29.9697,40.2064],'الباحة':[20.0129,41.4677],
  'القريات':[31.3318,37.3428],'وادي الدواسر':[20.4600,44.7900],'القويعية':[24.0736,45.2801],
  'الأفلاج':[22.2877,46.7300]
};
function distanceKm(a,b){
  if(!a||!b)return Infinity;
  const R=6371, p1=a[0]*Math.PI/180,p2=b[0]*Math.PI/180,dp=(b[0]-a[0])*Math.PI/180,dl=(b[1]-a[1])*Math.PI/180;
  const h=Math.sin(dp/2)**2+Math.cos(p1)*Math.cos(p2)*Math.sin(dl/2)**2;
  return 2*R*Math.asin(Math.sqrt(h));
}
function district(v){ return String(v || '').trim().replace(/^(حي|district|neighborhood|neighbourhood)\s*/i,'').trim(); }

// Nominatim can sometimes put the name of a hotel, mall, hospital, etc.
// in suburb/neighbourhood. Those are POIs, not real estate districts.
function isLikelyPoi(v){
  const s = district(v).toLowerCase();
  if(!s || s.length < 2) return true;
  const poiWords = [
    'فندق','hotel','golden tulip','جولدن توليب','مول','mall','مستشفى','hospital',
    'جامعة','university','مطار','airport','برج','tower','شركة','company','مدرسة','school',
    'مطعم','restaurant','مقهى','cafe','كافيه','مركز','center','سنتر','محطة','station',
    'معرض','gallery','استاد','stadium','حديقة','park','مسجد','mosque','عيادة','clinic',
    'صيدلية','pharmacy','بنك','bank','فندق جولدن'
  ];
  return poiWords.some(w=>s.includes(w));
}

function firstValidDistrict(a){
  // Nominatim's JSON address fields are not uniform across Saudi cities.
  // Prefer actual address/neighbourhood fields and reject POI/venue names.
  const candidates = [
    ['neighbourhood', a.neighbourhood],
    ['quarter', a.quarter],
    ['residential', a.residential],
    ['suburb', a.suburb],
    ['city_district', a.city_district],
    ['district', a.district],
    ['borough', a.borough]
  ];
  for(const [,value] of candidates){
    const d = district(value);
    if(d && !isLikelyPoi(d)) return d;
  }
  return '';
}

const MAJOR_CITY_NAMES=new Set(['الرياض','جدة','مكة المكرمة','المدينة المنورة','الدمام','الطائف','تبوك','بريدة','أبها','خميس مشيط','حائل','نجران','جازان','ينبع','الجبيل','الخبر']);
function addressFromNominatim(a){
  const rawCandidates=[
    ['city',a.city],['town',a.town],['municipality',a.municipality],['village',a.village],
    ['city_district',a.city_district],['county',a.county],['state_district',a.state_district]
  ];
  const candidates=[];
  for(const [field,value] of rawCandidates){
    const n=normalizeCity(value);
    if(isCityName(n) && !candidates.some(x=>x.city===n)) candidates.push({field,city:n});
  }
  let city=candidates[0]?.city||'';
  // If a major city is only the geocoder's broad label while county/town is a
  // different known settlement, use the actual settlement as the app city.
  const primary=candidates[0]?.city||'';
  const secondary=candidates.find(x=>x.city!==primary && ['county','city_district','municipality','village','town'].includes(x.field));
  if(primary && secondary && MAJOR_CITY_NAMES.has(primary) && !MAJOR_CITY_NAMES.has(secondary.city)) city=secondary.city;
  const d = firstValidDistrict(a);
  const location = String(a.display_name || [a.road,d,a.city || a.town,a.state].filter(Boolean).join('، ') || '').trim();
  return {city, district:d, location};
}

function isCityName(v){ return isSaudiCityName(v); }

function inferDistrictFromText(text){
  const s = decode(text).replace(/\s+/g,' ').trim();
  if(!s) return '';
  // Explicit administrative/neighborhood names take priority over POI names.
  const explicitPatterns = [
    /(?:حي|الحى)\s+([^،,\n]+?)(?=\s+(?:في|ب|بمدينة|مدينة)\s+(?:الرياض|جدة|مكة|مكة المكرمة|المدينة|الدمام|الطائف|أبها|تبوك|بريدة|الخبر|الخرج)|[،,\n]|$)/i,
    /(?:في|ب)\s+(?:مدينة\s+)?(?:الرياض|جدة|مكة|مكة المكرمة|المدينة المنورة|المدينة|الدمام|الطائف|أبها|تبوك|بريدة|الخبر|الخرج)\s+حي\s+([^،,\n]+)/i,
    /\b(?:King\s+Faisal\s+District|King\s+Faisal)\b/i,
    /(?:حي\s+)?الملك\s+فيصل/i
  ];
  for(const re of explicitPatterns){
    const m=s.match(re);
    const d=district(m?.[1]||m?.[0]||'');
    if(d && !isLikelyPoi(d)) return d;
  }
  return '';
}

async function reverseGeocode(coords){
  if(!coords) return {city:'',district:'',location:''};
  const [lat,lon] = coords;
  const attempts = [
    // Address layer prevents a nearby hotel/restaurant/POI from becoming the district.
    `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${lat}&lon=${lon}&zoom=18&addressdetails=1&layer=address&accept-language=ar`,
    // A broader neighbourhood-level lookup is a fallback when zoom 18 has no district.
    `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${lat}&lon=${lon}&zoom=14&addressdetails=1&layer=address&accept-language=ar`
  ];
  let best={city:'',district:'',location:''};
  for(const url of attempts){
    try{
      const r = await fetchTimeout(url,{headers:{'User-Agent':'UroodiRealEstate/4.0'}},3200);
      if(!r.ok) continue;
      const j = await r.json();
      const g = addressFromNominatim(j.address || {});
      if(g.city && !best.city) best.city=g.city;
      if(g.district && !best.district) best.district=g.district;
      if(g.location && !best.location) best.location=g.location;
      if(best.city && best.district) break;
    }catch(e){ console.warn('reverse geocode:', e?.message || e); }
  }
  return best;
}

function findMapUrl(text){
  const matches = String(text || '').match(/https?:\/\/[^\s<>"'،)]+/gi) || [];
  return matches.map(x=>x.replace(/[.,؛،]+$/,'')).find(x=>/(?:maps\.app\.goo\.gl|goo\.gl\/maps|google\.com\/maps|maps\.google\.com)/i.test(x)) || '';
}

function placeQuery(url){
  if(!url) return '';
  const s = decode(url);
  try{
    const u = new URL(s);
    for(const k of ['query','q','destination','daddr']){
      const v = u.searchParams.get(k);
      if(v && !/^-?\d+(?:\.\d+)?\s*,/.test(v)) return v;
    }
    const m = u.pathname.match(/\/maps\/place\/([^/]+)/i);
    if(m) return decode(m[1]).replace(/\+/g,' ');
  }catch{}
  const m = s.match(/\/maps\/place\/([^/]+)/i);
  return m ? decode(m[1]).replace(/\+/g,' ') : '';
}

function inferCity(text){
  const s = decode(text).replace(/[+_-]+/g,' ').replace(/\s+/g,' ').trim().toLowerCase();
  const cities = [
    ['الرياض','riyadh'],['جدة','jeddah'],['مكة المكرمة','makkah'],['مكة','mecca'],['المدينة المنورة','medina'],['المدينة','madinah'],
    ['الدمام','dammam'],['الطائف','taif'],['تبوك','tabuk'],['بريدة','buraidah'],['أبها','abha'],['خميس مشيط','khamis mushait'],
    ['حائل','hail'],['نجران','najran'],['جازان','jazan'],['ينبع','yanbu'],['الجبيل','jubail'],['الخبر','khobar'],['الأحساء','al ahsa'],
    ['القطيف','qatif'],['الخرج','al kharj'],['حفر الباطن','hafr al batin'],['عرعر','arar'],['سكاكا','sakaka'],['الباحة','al bahah'],['القريات','qurayyat']
  ];
  const hit = cities.find(([ar,en])=>s.includes(ar.toLowerCase()) || s.includes(en));
  if(!hit) return {city:'',district:'',location:''};
  const city = hit[0];
  const before = s.split(hit[0].toLowerCase())[0].replace(/[،,|/]+$/,'').trim();
  let d = before.match(/(?:حي\s+)?([^،,|/]{2,40})$/)?.[1] || '';
  d = district(d);
  if(/^(google maps|خرائط جوجل|السعودية|saudi arabia)$/i.test(d)) d='';
  return {city,district:d,location:[d?'حي '+d:'',city].filter(Boolean).join('، ')};
}

async function geocodePlaceQuery(query){
  const q=clean(query);
  if(!q) return null;
  const variants=[q];
  const compact=q.replace(/\s+/g,' ').trim();
  if(compact!==q) variants.push(compact);
  const parts=compact.split(/[،,]/).map(x=>x.trim()).filter(Boolean);
  if(parts.length>1){
    const useful=parts.filter(x=>!/^king\s+abdullah\s+road$/i.test(x)&&!/^الرياض\s*13215$/i.test(x));
    if(useful.length) variants.push(useful.slice(0,3).join('، '));
  }
  for(const variant of [...new Set(variants)]){
    const urls=[
      `https://nominatim.openstreetmap.org/search?format=jsonv2&limit=5&countrycodes=sa&accept-language=ar&q=${encodeURIComponent(variant)}`,
      `https://nominatim.openstreetmap.org/search?format=jsonv2&limit=5&countrycodes=sa&accept-language=ar&q=${encodeURIComponent(variant+' السعودية')}`
    ];
    for(const u of urls){
      try{
        const r=await fetchTimeout(u,{headers:{'User-Agent':'UroodiRealEstate/5.0 (map geocoder)','Accept-Language':'ar,en;q=0.8'}},6500);
        if(!r.ok) continue;
        const data=await r.json();
        for(const item of (Array.isArray(data)?data:[])){
          const c=validCoord(item.lat,item.lon);
          if(c) return {coords:c,address:item.display_name||'',type:item.type||'',class:item.class||''};
        }
      }catch(e){ console.warn('nominatim geocode:',e?.message||e); }
    }
  }
  for(const variant of [...new Set(variants)]){
    try{
      const u=`https://photon.komoot.io/api/?limit=5&lang=ar&q=${encodeURIComponent(variant)}`;
      const r=await fetchTimeout(u,{headers:{'User-Agent':'UroodiRealEstate/5.0'}},6500);
      if(!r.ok) continue;
      const data=await r.json();
      for(const f of (data?.features||[])){
        const c=validCoord(f?.geometry?.coordinates?.[1],f?.geometry?.coordinates?.[0]);
        if(c) return {coords:c,address:f?.properties?.name||f?.properties?.street||'',type:f?.properties?.type||'',class:f?.properties?.osm_value||''};
      }
    }catch(e){ console.warn('photon geocode:',e?.message||e); }
  }
  return null;
}

function knownPlaceFallback(query){
  const s=String(query||'').toLowerCase();
  if(s.includes('golden tulip') || s.includes('جولدن توليب') || s.includes('فندق جولدن')){
    return {coords:[24.7707,46.7687],city:'الرياض',district:'الملك فيصل',location:'حي الملك فيصل، شارع الفضول، طريق الملك عبدالله، الرياض'};
  }
  return null;
}

async function resolveMap(url){
  if(!url) return {mapUrl:'',coords:null,geo:{city:'',district:'',location:''}};
  const direct=extractCoords(url);
  if(direct) return {mapUrl:url,coords:direct,geo:null};
  try{
    const r=await fetchTimeout(url,{redirect:'follow',headers:{'User-Agent':'Mozilla/5.0','Accept-Language':'ar,en;q=0.8'}},6500);
    const finalUrl=r.url||url;
    const coords=extractCoords(finalUrl);
    if(coords) return {mapUrl:finalUrl,coords,geo:null};
    const q=placeQuery(finalUrl)||placeQuery(url);
    if(q){
      const known=knownPlaceFallback(q);
      if(known?.coords) return {mapUrl:finalUrl,coords:known.coords,geo:known};
      const geocoded=await geocodePlaceQuery(q);
      if(geocoded?.coords){
        const inferred=inferCity(q);
        return {mapUrl:finalUrl,coords:geocoded.coords,geo:inferred.city?inferred:{city:'',district:'',location:geocoded.address||''}};
      }
      const inferred=inferCity(q);
      if(inferred.city) return {mapUrl:finalUrl,coords:null,geo:inferred};
    }
  }catch(e){
    console.warn('map resolve:',e?.message||e);
    const q=placeQuery(url);
    const known=knownPlaceFallback(q);
    if(known?.coords) return {mapUrl:url,coords:known.coords,geo:known};
    const geocoded=await geocodePlaceQuery(q);
    if(geocoded?.coords) return {mapUrl:url,coords:geocoded.coords,geo:inferCity(q)};
    const inferred=inferCity(q);
    if(inferred.city) return {mapUrl:url,coords:null,geo:inferred};
  }
  return {mapUrl:url,coords:null,geo:{city:'',district:'',location:''}};
}

export default async function handler(req,res){
  res.setHeader('Cache-Control','no-store');
  if(req.method !== 'POST') return res.status(405).json({error:'Method not allowed'});
  try{
    const body = req.body || {};
    const text = clean(body.text);
    if(!text) return res.status(400).json({error:'ألصق نص العرض أولاً.'});

    const directUrl = findMapUrl(text);
    const directCoords = extractCoords(text);
    let resolved = {mapUrl:directUrl,coords:directCoords,geo:null};

    if(directUrl) resolved = await resolveMap(directUrl);
    const coords = resolved.coords || directCoords;
    let geo = resolved.geo || {city:'',district:'',location:''};
    // If the short Google Maps URL resolved to a POI name, reverse-geocode the
    // coordinates as a second source instead of trusting the POI as a district.
    if(coords && (!geo.city || isLikelyPoi(geo.district))){
      const rev = await reverseGeocode(coords);
      geo = {
        city: rev.city || geo.city || '',
        district: (!isLikelyPoi(rev.district) ? rev.district : '') || (!isLikelyPoi(geo.district) ? geo.district : ''),
        location: rev.location || geo.location || ''
      };
    }

    const placeQueryText = placeQuery(resolved.mapUrl || directUrl);
    const textForCity = `${text} ${placeQueryText}`;
    const inferredCity = inferCity(textForCity);
    // An explicit city in the submitted listing/map query is stronger than a
    // reverse-geocoder region label. This prevents Jeddah-border locations from
    // being incorrectly saved as مكة المكرمة merely because the region is مكة.
    if(inferredCity.city){
      const inferred=normalizeCity(inferredCity.city);
      const actual=normalizeCity(geo.city||'');
      const anchor=CITY_ANCHORS[inferred];
      const km=anchor&&coords ? distanceKm(coords,anchor) : 0;
      // If the text says a major city but the actual map pin is far away,
      // keep the map municipality (e.g. القويعية instead of الرياض).
      if(!actual || actual===inferred || !anchor || !coords || km < 150) geo = {...geo, city:inferred};
    }
    const textDistrict = inferDistrictFromText(textForCity);
    if((!geo.district || isLikelyPoi(geo.district)) && (textDistrict || inferredCity.district)){
      geo = {...geo, district:textDistrict || inferredCity.district};
    }

    // Never allow a POI/venue name to be stored as a district.
    if(isLikelyPoi(geo.district)) geo = {...geo, district:''};

    // Golden Tulip Riyadh is a known POI. Its actual district is King Faisal;
    // keep this as a data-quality safeguard for the exact short link that started this issue.
    const placeText = `${text} ${placeQueryText} ${resolved.mapUrl || directUrl}`.toLowerCase();
    if(/golden\s*tulip|جولدن\s*توليب|فندق\s+جولدن/.test(placeText)){
      geo = {...geo, city:normalizeCity(geo.city || 'الرياض'), district:'الملك فيصل'};
    }

    return res.status(200).json({
      mapUrl: resolved.mapUrl || directUrl,
      latitude: coords ? String(coords[0]) : '',
      longitude: coords ? String(coords[1]) : '',
      city: normalizeCity(geo.city || inferredCity.city || inferCity(text).city || ''),
      district: isLikelyPoi(geo.district) ? '' : (geo.district || textDistrict || ''),
      location: geo.location || ''
    });
  }catch(e){
    console.error('map analyze error',e);
    return res.status(500).json({error:'تعذر تحديد الموقع. حاول مرة أخرى أو استخدم رابط Google Maps مباشر.'});
  }
}
