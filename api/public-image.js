const { URL } = require('url');

module.exports = async (req, res) => {
  if (req.method !== 'GET') return res.status(405).end();
  try {
    const raw = String(req.query?.url || '').trim();
    if (!raw) return res.status(400).end('Missing url');
    const u = new URL(raw);
    const allowed = [
      'lpdhvtoayrlffrvthlsp.supabase.co',
      'storage.supabase.co'
    ];
    if (!allowed.includes(u.hostname)) return res.status(403).end('Forbidden');
    const r = await fetch(u.toString(), { redirect: 'follow' });
    if (!r.ok) return res.status(r.status).end();
    const ct = r.headers.get('content-type') || 'application/octet-stream';
    if (!ct.startsWith('image/')) return res.status(415).end('Not an image');
    const ab = await r.arrayBuffer();
    res.statusCode = 200;
    res.setHeader('Content-Type', ct);
    res.setHeader('Cache-Control', 'public, max-age=3600, s-maxage=3600');
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.end(Buffer.from(ab));
  } catch (e) {
    console.error('public-image', e);
    res.status(500).end();
  }
};
