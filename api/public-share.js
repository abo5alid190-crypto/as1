const crypto = require('crypto');
const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = process.env.SUPABASE_URL || 'https://lpdhvtoayrlffrvthlsp.supabase.co';
const SERVICE_KEY = process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY || '';
const PUBLISHABLE_KEY = process.env.SUPABASE_PUBLISHABLE_KEY || 'sb_publishable_vZNa5FvZrHT2ZvJq_e7quA_88ihYsYb';

function json(res,status,body){
  res.status(status).setHeader('Content-Type','application/json; charset=utf-8');
  res.setHeader('Cache-Control','no-store');
  res.end(JSON.stringify(body));
}
function sign(payload){
  return crypto.createHmac('sha256', SERVICE_KEY).update(payload).digest('base64url');
}
function uuidToShortPayload(userId){
  const hex=String(userId||'').replace(/-/g,'').toLowerCase();
  if(!/^[0-9a-f]{32}$/.test(hex)) throw new Error('Invalid user id');
  return Buffer.from(hex,'hex').toString('base64url');
}
function makeToken(userId){
  // Compact, URL-safe token: 16-byte user UUID + 10-byte HMAC signature.
  // This keeps the public broker link short without storing a separate mapping table.
  const payload=uuidToShortPayload(userId);
  const sig=crypto.createHmac('sha256',SERVICE_KEY).update('v2:'+payload).digest().subarray(0,10).toString('base64url');
  return payload+'.'+sig;
}

module.exports = async (req,res)=>{
  if(req.method!=='POST') return json(res,405,{error:'Method not allowed'});
  if(!SERVICE_KEY) return json(res,500,{error:'يجب إضافة مفتاح الخدمة السري في إعدادات Vercel.'});
  try{
    const auth=String(req.headers.authorization||'');
    const accessToken=auth.startsWith('Bearer ')?auth.slice(7).trim():'';
    if(!accessToken) return json(res,401,{error:'انتهت جلسة الدخول.'});

    // Validate the access token with the public/publishable key.
    // The service-role key is kept only for server-side database/storage access.
    // This avoids rejecting a perfectly valid user session when the service key
    // is not accepted by Supabase Auth's getUser endpoint.
    const authClient=createClient(SUPABASE_URL,PUBLISHABLE_KEY,{auth:{persistSession:false,autoRefreshToken:false}});
    const {data:{user},error}=await authClient.auth.getUser(accessToken);
    if(error||!user?.id) return json(res,401,{error:'جلسة الدخول غير صالحة.'});

    const signed=makeToken(user.id);
    // Always create the share link on the Production deployment.
    // If this request is made from a Vercel Preview deployment, using req.headers.host
    // would generate a Preview URL. Users can then open the production domain without
    // the token, so partners.html never calls /api/public-offers.
    const productionHost=String(
      process.env.PUBLIC_SITE_URL ||
      process.env.VERCEL_PROJECT_PRODUCTION_URL ||
      process.env.VERCEL_URL ||
      req.headers.host ||
      ''
    ).replace(/^https?:\/\//,'').split('/')[0].replace(/\/$/,'');
    if(!productionHost) return json(res,500,{error:'تعذر تحديد نطاق الموقع.'});
    const url=`https://${productionHost}/platform?token=${encodeURIComponent(signed)}`;
    return json(res,200,{token:signed,url});
  }catch(e){
    console.error('public-share',e);
    return json(res,500,{error:'تعذر إنشاء رابط العقاريين.'});
  }
};
