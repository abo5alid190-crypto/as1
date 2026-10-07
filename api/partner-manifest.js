module.exports = (req, res) => {
  const token = String(req.query?.token || '').trim();
  if (!token) return res.status(400).json({error:'Missing token'});
  const safe = token.replace(/[^A-Za-z0-9_-]/g,'');
  if (!safe || safe !== token) return res.status(400).json({error:'Invalid token'});
  const manifest = {
    name:'منصة العقاريين — عروضي العقارية',
    short_name:'منصة العقاريين',
    description:'منصة العروض العقارية للعقاريين',
    lang:'ar', dir:'rtl', id:'/partners.html?token='+safe,
    start_url:'/partners.html?token='+safe,
    scope:'/', display:'standalone', background_color:'#f5f7fa', theme_color:'#0d1f36',
    icons:[
      {src:'/icons/partners-icon-192.png',sizes:'192x192',type:'image/png',purpose:'any maskable'},
      {src:'/icons/partners-icon-512.png',sizes:'512x512',type:'image/png',purpose:'any maskable'}
    ]
  };
  res.setHeader('Content-Type','application/manifest+json; charset=utf-8');
  res.setHeader('Cache-Control','no-store');
  return res.status(200).json(manifest);
};
