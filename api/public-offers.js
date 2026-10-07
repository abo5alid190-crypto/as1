const crypto = require('crypto');
const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = process.env.SUPABASE_URL || 'https://lpdhvtoayrlffrvthlsp.supabase.co';
const SERVICE_KEY = process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY || '';

function json(res,status,body){
  res.status(status).setHeader('Content-Type','application/json; charset=utf-8');
  res.setHeader('Cache-Control','no-store, max-age=0');
  res.end(JSON.stringify(body));
}
function verify(token){
  const raw=String(token||'').trim();
  if(!raw||!SERVICE_KEY)return null;
  const parts=raw.split('.');

  // v2 compact token: base64url(16-byte UUID).base64url(10-byte HMAC)
  if(parts.length===2 && parts[0].length===22 && parts[1].length===14){
    const [payload,sig]=parts;
    const expected=crypto.createHmac('sha256',SERVICE_KEY).update('v2:'+payload).digest().subarray(0,10).toString('base64url');
    if(sig!==expected)return null;
    try{
      const b=Buffer.from(payload,'base64url');
      if(b.length!==16)return null;
      const h=b.toString('hex');
      const u=h.slice(0,8)+'-'+h.slice(8,12)+'-'+h.slice(12,16)+'-'+h.slice(16,20)+'-'+h.slice(20);
      return {u};
    }catch{return null}
  }

  // Backward compatibility with previously issued long links.
  const [payload,sig]=parts;
  if(!payload||!sig)return null;
  const expected=crypto.createHmac('sha256',SERVICE_KEY).update(payload).digest('base64url');
  if(sig.length!==expected.length)return null;
  if(!crypto.timingSafeEqual(Buffer.from(sig),Buffer.from(expected)))return null;
  try{
    const p=JSON.parse(Buffer.from(payload,'base64url').toString('utf8'));
    return p?.u?{u:String(p.u)}:null;
  }catch{return null}
}
function closed(v){
  return ['مغلق','مغلقه','مغلقة','مغلقه نهائيًا','مباع','مؤجر','منتهي'].includes(String(v||'').trim());
}
module.exports=async(req,res)=>{
  if(req.method!=='GET')return json(res,405,{error:'Method not allowed'});
  if(!SERVICE_KEY)return json(res,500,{error:'رابط العقاريين غير مفعّل بعد. أضف SUPABASE_SERVICE_ROLE_KEY في Vercel.'});
  try{
    const payload=verify(req.query?.token);
    if(!payload?.u)return json(res,401,{error:'الرابط غير صالح أو منتهي.'});

    const supabase=createClient(SUPABASE_URL,SERVICE_KEY,{auth:{persistSession:false,autoRefreshToken:false}});
    // Use the exact same owner column used by the private dashboard.
    const {data,error}=await supabase
      .from('offers')
      .select('*')
      .eq('user_id',payload.u)
      .order('updated_at',{ascending:false});
    if(error)throw error;

    const rows=data||[];
    for(const row of rows){
      if(row.latitude==null&&row.lat!=null)row.latitude=row.lat;
      if(row.longitude==null&&row.lng!=null)row.longitude=row.lng;
      if(!row.map_url&&row.mapUrl)row.map_url=row.mapUrl;
      if(!row.map_url&&row.map_link)row.map_url=row.map_link;
    }
    // Requests are intentionally kept out of normal offers and the map.
    // They are returned separately only to the brokers' page after a city is selected.
    const requestRows=rows.filter(o=>{
      const type=String(o.property_type||'').trim();
      const status=String(o.status||'').trim();
      const notes=String(o.notes||'').trim();
      const typeRequest=type==='__REQUEST__'||/^طلب(?:\s|$)/i.test(type);
      const statusRequest=/^طلب(?:\s|$)/i.test(status);
      const noteRequest=/\[\[REQUEST\]\]/i.test(notes);
      const isRequest=typeRequest||statusRequest||noteRequest;
      return isRequest&&!closed(status);
    });
    const active=rows.filter(o=>{
      const type=String(o.property_type||'').trim();
      const status=String(o.status||'').trim();
      const notes=String(o.notes||'').trim();
      return !(type==='__REQUEST__'||/^طلب(?:\s|$)/i.test(status)||/^\[\[REQUEST\]\]/i.test(notes));
    }).filter(o=>!closed(String(o.status||'').trim())).map(o=>{
      const copy={...o};
      copy.images=Array.isArray(copy.images)?copy.images.slice(0,8):[];
      // Never expose private owner/contact fields even if the schema contains them.
      delete copy.owner; delete copy.phone; delete copy.owner_phone; delete copy.contact_phone;
      delete copy.status; delete copy.features;
      return copy;
    });

    // Sign all images in parallel. Sequential signing can make the Vercel
    // function slow enough that the whole public page appears to hang.
    await Promise.all(active.map(async o=>{
      if(!o.images.length)return;
      o.images=(await Promise.all(o.images.slice(0,8).map(async path=>{
        try{
          // Keep already-public/full URLs untouched; otherwise sign the storage path.
          if(/^https?:\/\//i.test(String(path)))return String(path);
          const r=await supabase.storage.from('offer-images').createSignedUrl(path,60*60*24*7);
          return r.data?.signedUrl||null;
        }catch{return null}
      }))).filter(Boolean);
    }));

    const maxUpdated=active.reduce((m,o)=>Math.max(m,Date.parse(o.updated_at||o.created_at||'')||0),0);
    const requests=requestRows.map(o=>({
      id:o.id,
      city:o.city||'',
      district:o.district||'',
      text:String(o.notes||'').replace(/^\[\[REQUEST\]\]\s*/i,'').trim(),
      deal:o.deal||'',
      source:o.source||'',
      property_type:o.property_type==='__REQUEST__'?'':(o.property_type||''),
      created_at:o.created_at||'',
      updated_at:o.updated_at||o.created_at||''
    }));
    const maxRequestUpdated=requests.reduce((m,o)=>Math.max(m,Date.parse(o.updated_at||o.created_at||'')||0),0);
    return json(res,200,{
      city:'',
      updatedAt:Math.max(maxUpdated,maxRequestUpdated)?new Date(Math.max(maxUpdated,maxRequestUpdated)).toISOString():new Date().toISOString(),
      offers:active,
      requests
    });
  }catch(e){
    console.error('public-offers',e);
    return json(res,500,{error:'تعذر تحميل العروض.'});
  }
};
